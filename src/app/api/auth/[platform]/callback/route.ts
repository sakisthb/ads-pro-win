import { NextResponse } from "next/server";
import { safeFetch, safeFetchJson } from "@/lib/safe-fetch";
import {
  isOAuthPlatform,
  OAUTH_PLATFORMS,
  getClientId,
  getClientSecret,
  getOrigin,
  googleOAuthOrigin,
  oauthAuthorizationCode,
} from "@/lib/oauth/platforms";
import {
  consumeOAuthTransaction,
  OAuthTransactionError,
} from "@/lib/oauth/oauth-transactions";
import { META_GRAPH_VERSION } from "@/lib/meta/actions";
import { encrypt } from "@/lib/crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";
import {
  OrganizationAuthorizationError,
  type OrganizationMembershipAuthorization,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";
import {
  ga4PendingAccountId,
  ga4StoredAccountId,
  listGa4Properties,
} from "@/lib/ga4";
import {
  gscPendingAccountId,
  gscStoredAccountId,
  listGscSites,
  preferGscSite,
} from "@/lib/gsc";
import {
  googleAdsPendingAccountId,
  googleAdsStoredAccountId,
  listGoogleAdsCustomers,
  preferGoogleAdsCustomer,
} from "@/lib/google-ads-accounts";

/** Normalised token set returned by every platform-specific exchanger. */
interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

/** Minimal shape of an ad account returned by Meta's /me/adaccounts edge. */
interface MetaAdAccount {
  id: string;
  name?: string | null;
  account_status?: number | null;
}

/**
 * Meta (Facebook) token exchange — two sequential GET requests.
 *
 * 1. Swap the auth code for a short-lived user access token.
 * 2. Upgrade it to a 60-day long-lived token via fb_exchange_token.
 *
 * Meta does not issue refresh tokens; re-authorisation is required before the
 * long-lived token expires.
 */
async function exchangeMetaToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenSet> {
  // Step 1 — code → short-lived user token
  const shortUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", clientId);
  shortUrl.searchParams.set("client_secret", clientSecret);
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);

  const shortJson = await safeFetchJson<{
    access_token?: string;
  }>(shortUrl.toString(), { method: "GET" });
  const shortToken: string | undefined = shortJson.access_token;
  if (!shortToken) {
    throw new Error("Meta exchange: access_token missing from short-lived response");
  }

  // Step 2 — short-lived → 60-day long-lived token
  const longUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", clientId);
  longUrl.searchParams.set("client_secret", clientSecret);
  longUrl.searchParams.set("fb_exchange_token", shortToken);

  const longJson = await safeFetchJson<{
    access_token?: string;
    expires_in?: number;
  }>(longUrl.toString(), { method: "GET" });
  const accessToken: string | undefined = longJson.access_token;
  if (!accessToken) {
    throw new Error("Meta exchange: access_token missing from long-lived response");
  }

  return {
    accessToken,
    refreshToken: null,
    expiresIn: Number(longJson.expires_in) || 5_184_000, // 60-day fallback
  };
}

/**
 * Google (Ads & Analytics) token exchange — POST form-encoded.
 *
 * Returns an access token (~1 h) and a refresh token (guaranteed because the
 * auth URL always sends `prompt=consent` + `access_type=offline`).
 */
async function exchangeGoogleToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string | null,
): Promise<TokenSet> {
  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (codeVerifier) {
    form.set("code_verifier", codeVerifier);
  }

  const json = await safeFetchJson<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const accessToken: string | undefined = json.access_token;
  if (!accessToken) {
    throw new Error("Google exchange: access_token missing from response");
  }

  return {
    accessToken,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    expiresIn: Number(json.expires_in) || 3_600,
  };
}

interface TikTokTokenSet extends TokenSet {
  advertiserIds: string[];
}

/**
 * TikTok token exchange — POST JSON.
 *
 * The token payload is nested under `data` in the response body. TikTok v1.3
 * DOES issue a refresh token alongside the access token; the access token
 * lives ~24 h and can be renewed via /oauth2/refresh_token/ (see the sync
 * route) before expiry. `advertiser_ids` is the granted account list.
 */
async function exchangeTikTokToken(
  authCode: string,
  appId: string,
  secret: string,
): Promise<TikTokTokenSet> {
  const json = await safeFetchJson<{
    code?: number;
    message?: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      advertiser_ids?: Array<string | number>;
    };
  }>("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
  });
  const data = json.data ?? {};
  const accessToken: string | undefined = data.access_token;
  if (!accessToken) {
    throw new Error(
      `TikTok exchange: access_token missing (code ${json.code}): ${json.message}`,
    );
  }

  const advertiserIds = Array.isArray(data.advertiser_ids)
    ? (data.advertiser_ids as Array<string | number>).map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    accessToken,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresIn: Number(data.expires_in) || 86_400, // 24 h access-token lifetime
    advertiserIds,
  };
}

/**
 * Discover authorized TikTok advertiser accounts.
 * GET /oauth2/advertiser/get/ requires Access-Token plus app_id and secret.
 */
async function discoverTikTokAccount(
  accessToken: string,
  appId: string,
  secret: string,
  fallbackIds: string[] = [],
): Promise<{
  accountId: string;
  name: string;
} | null> {
  try {
    const url = new URL("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("secret", secret);
    const res = await safeFetch(url.toString(), {
      method: "GET",
      headers: { "Access-Token": accessToken },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { list?: Array<{ advertiser_id?: string | number; advertiser_name?: string }> };
      };
      const list = json.data?.list ?? [];
      const first = list.find((a) => a.advertiser_id != null && a.advertiser_id !== "");
      if (first) {
        return {
          accountId: String(first.advertiser_id),
          name: first.advertiser_name?.trim() || `TikTok Ads ${first.advertiser_id}`,
        };
      }
    } else {
      logSecurityEvent("oauth_failure", "warn", {
        code: "resource_discovery_failed",
        platform: "tiktok",
        message: `advertiser/get failed (${res.status}): ${await res.text()}`,
      });
    }
  } catch (error) {
    logSecurityEvent("oauth_failure", "warn", {
      code: "resource_discovery_failed",
      platform: "tiktok",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const fallback = fallbackIds[0];
  if (!fallback) return null;
  return { accountId: fallback, name: `TikTok Ads ${fallback}` };
}

/**
 * GET /api/auth/[platform]/callback
 *
 * OAuth redirect endpoint. Receives the authorization `code` from the
 * provider, exchanges it for real access/refresh tokens, encrypts them, and
 * persists them to the matching AdAccount for the authenticated user's
 * organization.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const origin = getOrigin(request);
  const oauthOrigin =
    platform === "google-ads" ||
    platform === "google-analytics" ||
    platform === "google-search-console"
      ? googleOAuthOrigin(request)
      : origin;
  const { searchParams } = new URL(request.url);

  // 1. Validate the platform slug.
  if (!isOAuthPlatform(platform)) {
    return NextResponse.redirect(
      `${origin}/connections?error=${encodeURIComponent(platform)}`,
    );
  }

  // 1b. Map the OAuth slug to the canonical DB platform value. AdAccount
  // rows store 'meta' | 'google' | 'tiktok' | 'google-analytics' |
  // 'google-search-console'. The `google-ads` slug collapses to `google`.
  const dbPlatform:
    | "meta"
    | "google"
    | "tiktok"
    | "google-analytics"
    | "google-search-console"
    | null =
    platform === "google-ads"
      ? "google"
      : platform === "google-analytics"
        ? "google-analytics"
        : platform === "google-search-console"
          ? "google-search-console"
          : platform === "meta" || platform === "tiktok"
            ? platform
            : null;
  if (!dbPlatform) {
    logSecurityEvent("oauth_failure", "error", {
      code: "platform_mapping_missing",
      platform,
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }

  // 2. Extract & validate the authorization code.
  const code = oauthAuthorizationCode(searchParams);
  const providerError = searchParams.get("error");
  if (providerError || !code) {
    logSecurityEvent("oauth_failure", "warn", {
      code: providerError ? "provider_error" : "missing_code",
      platform,
      message: providerError,
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }

  const rawState = searchParams.get("state") ?? "";
  const session = await getSession();
  if (!session) {
    logSecurityEvent("oauth_failure", "warn", { code: "unauthenticated", platform });
    return NextResponse.redirect(`${origin}/login`);
  }

  let authorization: OrganizationMembershipAuthorization;
  let returnPath = "/connections";
  let stateBrandId: string | undefined;
  let oauthTransaction: {
    brandId: string | null;
    returnPath: string;
    codeVerifier: string | null;
  } | null = null;
  try {
    authorization = await requireOrganizationRoleForUser(session.userId, ["owner", "admin"]);
    const transaction = await consumeOAuthTransaction(prisma, rawState, {
      platform,
      userId: session.userId,
      organizationId: authorization.organizationId,
    });
    oauthTransaction = transaction;
    returnPath = transaction.returnPath;
    stateBrandId = transaction.brandId ?? undefined;
    if (stateBrandId) {
      await requireOwnedBrand(authorization, stateBrandId);
    }
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      return NextResponse.redirect(`${origin}${returnPath}?error=${platform}&reason=authorization`);
    }
    if (error instanceof OAuthTransactionError) {
      logSecurityEvent("oauth_failure", "warn", {
        code: error.code,
        platform,
        message: "oauth state rejected",
      });
      return NextResponse.redirect(`${origin}${returnPath}?error=${platform}&reason=invalid_state`);
    }
    throw error;
  }

  // 3. Resolve platform config & OAuth credentials.
  const config = OAUTH_PLATFORMS[platform];
  const clientId = getClientId(platform);
  const clientSecret = getClientSecret(platform);
  const redirectUri = `${oauthOrigin}${config.callbackPath}`;

  if (!clientId || !clientSecret) {
    logSecurityEvent("oauth_failure", "error", {
      code: "credentials_not_configured",
      platform,
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }

  // 4. Resolve the target organization and its brands before exchanging tokens
  //    or making provider calls. This avoids leaking credentials/network calls
  //    when there is nowhere to attach the resulting account.
  const organization = await prisma.organization.findUnique({
    where: { id: authorization.organizationId },
    include: { brands: { include: { adAccounts: true } } },
  });

  if (!organization) {
    logSecurityEvent("oauth_failure", "error", {
      code: "organization_not_found",
      platform,
      organizationId: authorization.organizationId,
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }

  const brands = organization.brands;
  if (brands.length === 0) {
    logSecurityEvent("oauth_failure", "error", {
      code: "no_brands",
      platform,
      organizationId: authorization.organizationId,
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }

  let targetBrand = brands[0];
  if (stateBrandId) {
    const matched = brands.find((b) => b.id === stateBrandId);
    if (!matched) {
      logSecurityEvent("oauth_failure", "warn", {
        code: "brand_mismatch",
        platform,
        brandId: stateBrandId,
        organizationId: authorization.organizationId,
      });
      return NextResponse.redirect(
        `${origin}${returnPath}?error=${platform}&reason=brand`,
      );
    }
    targetBrand = matched;
  }

  // Attach to the selected shop only — never overwrite another brand's token.
  let adAccount = targetBrand.adAccounts.find((a) => a.platform === dbPlatform);

  try {
    // 5-6. Exchange the code for tokens (platform-specific).
    let tokens: TokenSet;
    let tiktokAdvertiserIds: string[] = [];
    if (platform === "meta") {
      tokens = await exchangeMetaToken(code, clientId, clientSecret, redirectUri);
    } else if (
      platform === "google-ads" ||
      platform === "google-analytics" ||
      platform === "google-search-console"
    ) {
      tokens = await exchangeGoogleToken(
        code,
        clientId,
        clientSecret,
        redirectUri,
        oauthTransaction?.codeVerifier,
      );
    } else {
      const tiktok = await exchangeTikTokToken(code, clientId, clientSecret);
      tokens = tiktok;
      tiktokAdvertiserIds = tiktok.advertiserIds;
    }

    // Meta only: resolve the REAL ad account id via the /me/adaccounts edge.
    // The sync fetcher calls graph.facebook.com/{version}/act_<accountId>/insights,
    // so `accountId` must be the numeric Meta ad account id (without the `act_`
    // prefix that the Graph API itself prepends in URLs). Selection prefers an
    // account whose name matches one of the org's brand names (case-insensitive),
    // falling back to the first account in the list.
    let metaAccounts: MetaAdAccount[] = [];
    if (platform === "meta") {
      const accountsUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts`);
      accountsUrl.searchParams.set("fields", "id,name,account_status");
      accountsUrl.searchParams.set("access_token", tokens.accessToken);

      const accountsJson = await safeFetchJson<{
        data?: MetaAdAccount[];
      }>(accountsUrl.toString(), { method: "GET" });
      metaAccounts = Array.isArray(accountsJson.data) ? accountsJson.data : [];
      if (metaAccounts.length === 0) {
        logSecurityEvent("oauth_failure", "warn", {
          code: "no_meta_accounts",
          platform,
        });
        return NextResponse.redirect(`${origin}/connections?error=meta-no-accounts`);
      }
    }

    // Google / TikTok: resolve the REAL ad account id via the provider API.
    // On failure (or when the Google developer token is absent) we persist a
    // pending placeholder ("") — the sync route refuses to fetch metrics for
    // such accounts until setup is completed via re-connect.
    let discoveredAccountId: string | null = null;
    let discoveredName: string | null = null;
    if (platform === "tiktok") {
      const discovered = await discoverTikTokAccount(
        tokens.accessToken,
        clientId,
        clientSecret,
        tiktokAdvertiserIds,
      );
      discoveredAccountId = discovered?.accountId ?? "";
      discoveredName = discovered?.name ?? "TikTok Ads (setup pending)";
    }

    // 7. Encrypt tokens before persistence.
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : null;
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    // Meta only: pick the ad account to persist — prefer one whose name
    // matches the target brand, else the first Meta account the user granted.
    let chosenMetaAccount: MetaAdAccount | undefined;
    if (platform === "meta") {
      const brandName = targetBrand.name.trim().toLowerCase();
      chosenMetaAccount =
        metaAccounts.find(
          (acc) =>
            typeof acc.name === "string" &&
            acc.name.trim().toLowerCase() === brandName,
        ) ?? metaAccounts[0];
    }

    // Resolve the accountId / name to persist for this platform.
    //  - Meta: real numeric ad account id (no `act_` prefix) + account name.
    //  - Google / TikTok: id discovered via provider API, or "" + a
    //    "(setup pending)" name when discovery could not run.
    //  - GA4: auto-select when the Google account has exactly one property.
    let persistAccountId: string;
    let persistName: string;
    let resourceFlag = "";
    let resourceQueryKey = "";
    if (platform === "meta") {
      persistAccountId = (chosenMetaAccount?.id ?? "").replace(/^act_/, "");
      persistName = chosenMetaAccount?.name ?? `${config.name} Account`;
    } else if (platform === "google-analytics") {
      persistAccountId = ga4PendingAccountId(targetBrand.id);
      persistName = "Google Analytics (pick property)";
      resourceQueryKey = "ga4";
      resourceFlag = "pick";
      try {
        const properties = await listGa4Properties(tokens.accessToken);
        if (properties.length === 1 && properties[0]) {
          persistAccountId = ga4StoredAccountId(targetBrand.id, properties[0].id);
          persistName = properties[0].displayName;
          resourceFlag = "auto";
        } else if (properties.length === 0) {
          persistName = "Google Analytics (no properties)";
          resourceFlag = "none";
        }
      } catch (error) {
        logSecurityEvent("oauth_failure", "warn", {
          code: "resource_discovery_failed",
          platform,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (platform === "google-search-console") {
      persistAccountId = gscPendingAccountId(targetBrand.id);
      persistName = "Search Console (pick site)";
      resourceQueryKey = "gsc";
      resourceFlag = "pick";
      try {
        const sites = await listGscSites(tokens.accessToken);
        const preferred = preferGscSite(sites, targetBrand.website);
        if (preferred) {
          persistAccountId = gscStoredAccountId(targetBrand.id, preferred.siteUrl);
          persistName = preferred.displayName;
          resourceFlag = "auto";
        } else if (sites.length === 0) {
          persistName = "Search Console (no sites)";
          resourceFlag = "none";
        }
      } catch (error) {
        logSecurityEvent("oauth_failure", "warn", {
          code: "resource_discovery_failed",
          platform,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (platform === "google-ads") {
      persistAccountId = googleAdsPendingAccountId(targetBrand.id);
      persistName = "Google Ads (pick account)";
      resourceQueryKey = "gads";
      resourceFlag = "pick";
      try {
        const customers = await listGoogleAdsCustomers(tokens.accessToken);
        const preferred = preferGoogleAdsCustomer(customers, targetBrand.name);
        if (preferred) {
          persistAccountId = googleAdsStoredAccountId(
            targetBrand.id,
            preferred.id,
            preferred.loginCustomerId,
          );
          persistName = preferred.descriptiveName;
          resourceFlag = "auto";
        } else if (customers.length === 0) {
          persistName = "Google Ads (no accounts)";
          resourceFlag = "none";
        }
      } catch (error) {
        logSecurityEvent("oauth_failure", "warn", {
          code: "resource_discovery_failed",
          platform,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      persistAccountId = discoveredAccountId ?? "";
      persistName = discoveredName ?? `${config.name} Account`;
    }

    // No existing AdAccount for this platform on this shop — create one.
    if (!adAccount) {
      adAccount = await prisma.adAccount.create({
        data: {
          brandId: targetBrand.id,
          // Canonical DB platform value ('meta' | 'google' | 'tiktok') — the
          // OAuth slug (e.g. 'google-ads') is never stored.
          platform: dbPlatform,
          accountId: persistAccountId,
          name: persistName,
        },
      });
    }

    // 8. Persist the encrypted tokens (and keep the resolved account
    // id/name in sync in case the record pre-existed).
    await prisma.adAccount.update({
      where: { id: adAccount.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        accountId: persistAccountId,
        name: persistName,
        isActive: true,
      },
    });

    // 9. Success — bounce back to Connections, or First session if that started OAuth.
    const resourceQuery =
      resourceQueryKey && resourceFlag ? `&${resourceQueryKey}=${resourceFlag}` : "";
    return NextResponse.redirect(
      `${origin}${returnPath}?connected=${platform}${stateBrandId ? `&brand=${stateBrandId}` : ""}${resourceQuery}`,
    );
  } catch (error) {
    logSecurityEvent("oauth_failure", "error", {
      code: "token_exchange_failed",
      platform,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${origin}/connections?error=${platform}`);
  }
}
