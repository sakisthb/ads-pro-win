import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";
import { z } from "zod";
import {
  fetchMetaAccountData,
  fetchGoogleMetrics,
  fetchTikTokMetrics,
  fetchOmnisendData,
  fetchBrevoData,
  persistWooCommerceSync,
  fetchOpenCartData,
  upsertDailyMetrics,
  upsertAdCampaigns,
  upsertWooOrders,
  upsertWooProducts,
  cleanupAccountLevelRows,
} from "@/lib/sync/fetchers";
import { defaultSyncLookbackDays } from "@/lib/meta/actions";
import { costMapFromProducts } from "@/lib/woo-orders";
import { fetchGa4Metrics, isGa4PropertyReady, parseGa4PropertyId } from "@/lib/ga4";
import { fetchGscMetrics, isGscSiteReady, parseGscSiteUrl } from "@/lib/gsc";
import { isGoogleAdsAccountReady } from "@/lib/google-ads-accounts";
import {
  ensureFreshGoogleAccessToken,
} from "@/lib/oauth/google-refresh";
import { safeFetch } from "@/lib/safe-fetch";

// ---------------------------------------------------------------------------
// Supported platforms
// ---------------------------------------------------------------------------

const SUPPORTED_PLATFORMS = ["meta", "google", "tiktok", "woocommerce", "opencart", "omnisend", "brevo", "google-analytics", "google-search-console"] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

function isSupportedPlatform(value: string): value is Platform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const syncBodySchema = z.object({
  brandId: z.string().min(1, "brandId is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

/** Prisma dumps the full createMany payload; keep the client-facing error short. */
function publicSyncError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const meta =
    error && typeof error === "object" && "meta" in error
      ? (error as { meta?: { database_error?: string; target?: unknown } }).meta
      : undefined;
  const firstLine = (error instanceof Error ? error.message : String(error))
    .split("\n")
    .find((line) => line.trim())
    ?.trim();
  const invocation = firstLine?.match(/Invalid `[^`]+` invocation/)?.[0];
  const parts = [
    code,
    meta?.database_error,
    invocation,
    firstLine && firstLine.length < 280 ? firstLine : null,
  ].filter(Boolean);
  const text = parts.join(" — ") || "Sync failed";
  return text.slice(0, 500);
}

function defaultDateRange(platform?: string): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const lookback = defaultSyncLookbackDays(platform ?? "", false);
  start.setDate(start.getDate() - lookback);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function syncJobType(platform: Platform): string {
  return platform === "woocommerce" || platform === "opencart"
    ? "orders_products"
    : "metrics";
}

// ---------------------------------------------------------------------------
// OAuth token refresh (Google Ads & TikTok)
// ---------------------------------------------------------------------------

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

/** True when the stored token is expired or expires within 5 minutes. */
function tokenNeedsRefresh(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return false; // unknown expiry — trust the stored token
  return tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;
}

/**
 * Refresh a TikTok Business API access token via
 * /open_api/v1.3/oauth2/refresh_token/. TikTok rotates both tokens: the
 * response carries a new access token (~24 h) and a new refresh token.
 */
async function refreshTikTokAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const res = await safeFetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.TIKTOK_APP_ID ?? "",
        secret: process.env.TIKTOK_APP_SECRET ?? "",
        refresh_token: refreshToken,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`TikTok token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const data = json.data ?? {};
  const accessToken: string | undefined = data.access_token;
  if (!accessToken) {
    throw new Error(
      `TikTok token refresh failed (code ${json.code}): ${json.message ?? "no access_token"}`,
    );
  }
  const expiresIn = Number(data.expires_in) || 86_400;
  return {
    accessToken,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/**
 * Re-encrypt refreshed tokens and persist them on the AdAccount before any
 * platform API call is made with them.
 */
async function persistRefreshedTokens(
  adAccountId: string,
  tokens: RefreshedTokens,
): Promise<void> {
  await prisma.adAccount.update({
    where: { id: adAccountId },
    data: {
      accessToken: encrypt(tokens.accessToken),
      ...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
      tokenExpiry: tokens.expiresAt,
    },
  });
}

/** Human-readable platform names for error messages. */
const PLATFORM_DISPLAY_NAMES: Partial<Record<Platform, string>> = {
  google: "Google Ads",
  tiktok: "TikTok Ads",
  "google-analytics": "Google Analytics",
  "google-search-console": "Search Console",
};

// ---------------------------------------------------------------------------
// POST /api/sync/[platform]
//
// Validation, session check and platform routing live here; the actual
// platform API calls and Prisma writes are delegated to the shared
// `@/lib/sync/fetchers` module (also used by the BullMQ background workers).
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  // 1. Session check
  const session = await getSession();
  if (!session) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // 2. Validate platform
  const { platform } = await params;
  if (!isSupportedPlatform(platform)) {
    return json(
      {
        success: false,
        error: `Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(", ")}`,
      },
      400,
    );
  }

  // 3. Parse & validate body
  let body: z.infer<typeof syncBodySchema>;
  try {
    const raw = await request.json();
    const result = syncBodySchema.safeParse(raw);
    if (!result.success) {
      return json(
        { success: false, error: result.error.issues[0]?.message ?? "Invalid request" },
        400,
      );
    }
    body = result.data;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { brandId } = body;

  try {
    const authorization = await requireOrganizationRoleForUser(session.userId, [
      "owner",
      "admin",
    ]);
    await requireOwnedBrand(authorization, brandId);
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      return json({ success: false, error: error.message }, error.status);
    }
    throw error;
  }

  const { startDate, endDate } = { ...defaultDateRange(platform), ...body };
  const dateRange = { startDate, endDate };
  let syncJobId: string | null = null;

  try {
    // 4. Resolve the AdAccount for this brand + platform
    const adAccount = await prisma.adAccount.findFirst({
      where: { brandId, platform, isActive: true },
    });

    if (!adAccount) {
      return json(
        { success: false, error: `No active ${platform} account found for brand ${brandId}` },
        404,
      );
    }

    if (!adAccount.accessToken) {
      return json(
        { success: false, error: `No access token stored for this ${platform} account` },
        400,
      );
    }

    const accessToken = decrypt(adAccount.accessToken);
    let recordsSynced = 0;

    // 4b. Google & TikTok only: refuse to sync while account discovery is
    // still pending (callback stored accountId "" because the developer
    // token was missing or the provider account lookup failed).
    if (platform === "google" && !isGoogleAdsAccountReady(adAccount.accountId)) {
      return json(
        {
          success: false,
          error: "Pick a Google Ads account on Connections before syncing.",
        },
        400,
      );
    }
    if ((platform === "tiktok") && adAccount.accountId === "") {
      const displayName = PLATFORM_DISPLAY_NAMES[platform] ?? platform;
      return json(
        {
          success: false,
          error: `${displayName} account discovery pending — complete setup / re-connect first.`,
        },
        400,
      );
    }
    if (platform === "google-analytics" && !isGa4PropertyReady(adAccount.accountId)) {
      return json(
        {
          success: false,
          error: "Pick a GA4 property on Connections before syncing Google Analytics.",
        },
        400,
      );
    }
    if (platform === "google-search-console" && !isGscSiteReady(adAccount.accountId)) {
      return json(
        {
          success: false,
          error: "Pick a Search Console property on Connections before syncing.",
        },
        400,
      );
    }

    const syncJob = await prisma.syncJob.create({
      data: {
        adAccountId: adAccount.id,
        brandId: adAccount.brandId,
        type: syncJobType(platform),
        platform,
        status: "running",
        startedAt: new Date(),
      },
      select: { id: true },
    });
    syncJobId = syncJob.id;

    // 5. Platform-specific fetch + upsert (shared fetchers module)
    if (platform === "meta") {
      const { metrics: rows, campaigns } = await fetchMetaAccountData(
        accessToken,
        adAccount.accountId,
        dateRange,
      );
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
      const campaignCount = await upsertAdCampaigns(
        campaigns,
        adAccount.id,
        platform,
        adAccount.currency,
      );
      recordsSynced += campaignCount;
      if (rows.length > 0) {
        await cleanupAccountLevelRows(adAccount.id, platform);
      }
    } else if (platform === "google") {
      const googleAccessToken = await ensureFreshGoogleAccessToken(
        {
          id: adAccount.id,
          accessToken: adAccount.accessToken,
          refreshToken: adAccount.refreshToken,
          tokenExpiry: adAccount.tokenExpiry,
        },
        "ads",
      );

      const rows = await fetchGoogleMetrics(googleAccessToken, adAccount.accountId, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
      // Campaign-level rows landed: drop legacy account-aggregated rows
      // (campaignId: "") for this account so spend is not counted twice.
      if (rows.length > 0) {
        await cleanupAccountLevelRows(adAccount.id, platform);
      }
    } else if (platform === "google-analytics") {
      const gaAccessToken = await ensureFreshGoogleAccessToken(
        {
          id: adAccount.id,
          accessToken: adAccount.accessToken,
          refreshToken: adAccount.refreshToken,
          tokenExpiry: adAccount.tokenExpiry,
        },
        "analytics",
      );
      const propertyId = parseGa4PropertyId(adAccount.accountId);
      if (!propertyId) {
        throw new Error("Pick a GA4 property on Connections before syncing Google Analytics.");
      }
      const rows = await fetchGa4Metrics(gaAccessToken, propertyId, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
    } else if (platform === "google-search-console") {
      const gscAccessToken = await ensureFreshGoogleAccessToken(
        {
          id: adAccount.id,
          accessToken: adAccount.accessToken,
          refreshToken: adAccount.refreshToken,
          tokenExpiry: adAccount.tokenExpiry,
        },
        "analytics",
      );
      const siteUrl = parseGscSiteUrl(adAccount.accountId);
      if (!siteUrl) {
        throw new Error("Pick a Search Console property on Connections before syncing.");
      }
      const rows = await fetchGscMetrics(gscAccessToken, siteUrl, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
    } else if (platform === "tiktok") {
      // Refresh the ~24 h access token when it is expired or within 5
      // minutes of expiry, persist the rotated tokens, then fetch.
      let tiktokAccessToken = accessToken;
      if (adAccount.refreshToken && tokenNeedsRefresh(adAccount.tokenExpiry)) {
        const refreshed = await refreshTikTokAccessToken(decrypt(adAccount.refreshToken));
        await persistRefreshedTokens(adAccount.id, refreshed);
        tiktokAccessToken = refreshed.accessToken;
      }

      const rows = await fetchTikTokMetrics(tiktokAccessToken, adAccount.accountId, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
    } else if (platform === "omnisend") {
      const rows = await fetchOmnisendData(accessToken, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
    } else if (platform === "brevo") {
      const rows = await fetchBrevoData(accessToken, dateRange);
      recordsSynced = await upsertDailyMetrics(rows, adAccount.id, platform);
    } else if (platform === "woocommerce") {
      // For WooCommerce, accessToken = encrypted consumerKey, refreshToken = encrypted consumerSecret,
      // accountId = storeUrl (set by the connections route).
      const consumerSecret = adAccount.refreshToken ? decrypt(adAccount.refreshToken) : "";
      const storeUrl = adAccount.accountId;
      const woo = await persistWooCommerceSync({
        storeUrl,
        consumerKey: accessToken,
        consumerSecret,
        brandId: adAccount.brandId,
        dateRange,
      });
      recordsSynced = woo.orderCount + woo.productCount;
    } else if (platform === "opencart") {
      // For OpenCart, accessToken = encrypted username, refreshToken =
      // encrypted API key, accountId = storeUrl (set by the connections
      // route). READ-ONLY: only GET requests are issued.
      const apiKey = adAccount.refreshToken ? decrypt(adAccount.refreshToken) : "";
      const storeUrl = adAccount.accountId;

      // Fetch + map orders and products (read-only GETs), plus the daily
      // revenue aggregation derived from the fetched orders.
      const result = await fetchOpenCartData(accessToken, apiKey, storeUrl, dateRange);

      // Persist products first so order COGS can use catalog costs when present.
      const productCount = await upsertWooProducts(result.products, adAccount.brandId);
      const orderCount = await upsertWooOrders(
        result.orders,
        adAccount.brandId,
        costMapFromProducts(result.products),
      );

      // Aggregate order revenue into DailyMetric (platform "opencart")
      await upsertDailyMetrics(result.metrics, adAccount.id, "opencart");

      recordsSynced = orderCount + productCount;
    }

    // 6. Commit lastSyncAt and the durable run record together. Connections
    // can now render real records/success/failure data after a page reload.
    const completedAt = new Date();
    await prisma.$transaction([
      prisma.adAccount.update({
        where: { id: adAccount.id },
        data: { lastSyncAt: completedAt },
      }),
      prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "completed",
          completedAt,
          recordsProcessed: recordsSynced,
          error: null,
        },
      }),
    ]);

    // 7. Success response
    return json({ success: true, platform, recordsSynced, syncJobId: syncJob.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const publicError = publicSyncError(error);
    if (syncJobId) {
      try {
        await prisma.syncJob.update({
          where: { id: syncJobId },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: publicError.slice(0, 1_000),
          },
        });
      } catch (jobError) {
        console.error(`[api/sync/${platform}] Failed to persist SyncJob failure:`, jobError);
      }
    }
    console.error(`[api/sync/${platform}] Sync failed:`, message.slice(0, 2_000));
    return json({ success: false, error: publicError }, 500);
  }
}
