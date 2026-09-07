import type { AdAccount, Brand, PrismaClient } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { logSecurityEvent } from "@/lib/security-events";
import { safeFetch } from "@/lib/safe-fetch";
import type { LaunchPlatform } from "./mapping";

export type ResolvedAdAccount = {
  account: AdAccount & { brand: Brand };
  accessToken: string;
};

function isDemoAccount(accountId: string): boolean {
  return /^(demo-|act_demo_|act_sacos_)/i.test(accountId) || accountId.includes("placeholder");
}

function tokenNeedsRefresh(tokenExpiry: Date | null): boolean {
  if (!tokenExpiry) return false;
  return tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}> {
  const form = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await safeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("Google token refresh returned no access_token");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
  };
}

async function refreshTikTokAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}> {
  const res = await safeFetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.TIKTOK_APP_ID,
        secret: process.env.TIKTOK_APP_SECRET,
        refresh_token: refreshToken,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`TikTok token refresh failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { access_token?: string; refresh_token?: string; expires_in?: number };
  };
  const accessToken = json.data?.access_token;
  if (!accessToken) {
    throw new Error(`TikTok token refresh failed: ${json.message ?? "no access_token"}`);
  }
  return {
    accessToken,
    refreshToken: json.data?.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (json.data?.expires_in ?? 86_400) * 1000),
  };
}

export async function resolveLaunchAccount(
  prisma: PrismaClient,
  organizationId: string,
  platform: LaunchPlatform,
  adAccountId?: string,
  brandId?: string,
): Promise<ResolvedAdAccount | null> {
  const account = await prisma.adAccount.findFirst({
    where: {
      ...(adAccountId ? { id: adAccountId } : {}),
      ...(brandId ? { brandId } : {}),
      platform,
      isActive: true,
      accessToken: { not: null },
      brand: { organizationId },
    },
    include: { brand: true },
  });
  if (!account?.accessToken) return null;
  if (isDemoAccount(account.accountId) || !account.accountId) return null;

  let accessToken = decrypt(account.accessToken);

  if (
    (platform === "google" || platform === "tiktok") &&
    account.refreshToken &&
    tokenNeedsRefresh(account.tokenExpiry)
  ) {
    try {
      const refreshed =
        platform === "google"
          ? await refreshGoogleAccessToken(decrypt(account.refreshToken))
          : await refreshTikTokAccessToken(decrypt(account.refreshToken));
      accessToken = refreshed.accessToken;
      await prisma.adAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          ...(refreshed.refreshToken
            ? { refreshToken: encrypt(refreshed.refreshToken) }
            : {}),
          tokenExpiry: refreshed.expiresAt,
        },
      });
    } catch (error) {
      logSecurityEvent("oauth_failure", "warn", {
        code: "token_refresh_failed",
        platform,
        brandId: account.brandId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { account, accessToken };
}
