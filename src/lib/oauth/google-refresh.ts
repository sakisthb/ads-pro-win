/**
 * Shared Google OAuth access-token refresh for Ads, Analytics, and Search Console.
 */

import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { resolveGoogleOAuthClient } from "@/lib/oauth/platforms";
import { safeFetch } from "@/lib/safe-fetch";

export interface RefreshedGoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export function tokenNeedsRefresh(tokenExpiry: Date | null | undefined): boolean {
  if (!tokenExpiry) return false;
  return tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;
}

export function googleOAuthClient(kind: "ads" | "analytics"): {
  clientId: string;
  clientSecret: string;
} {
  return resolveGoogleOAuthClient(kind === "ads" ? "google-ads" : "google-analytics");
}

export async function refreshGoogleOAuthToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<RefreshedGoogleTokens> {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
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
    throw new Error("Google token refresh: access_token missing from response");
  }
  const expiresIn = Number(json.expires_in) || 3_600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

export async function ensureFreshGoogleAccessToken(
  adAccount: {
    id: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiry: Date | null;
  },
  kind: "ads" | "analytics",
): Promise<string> {
  const current = decrypt(adAccount.accessToken);
  if (!adAccount.refreshToken || !tokenNeedsRefresh(adAccount.tokenExpiry)) {
    return current;
  }
  const creds = googleOAuthClient(kind);
  if (!creds.clientId || !creds.clientSecret) {
    return current;
  }
  const refreshed = await refreshGoogleOAuthToken(
    decrypt(adAccount.refreshToken),
    creds.clientId,
    creds.clientSecret,
  );
  await prisma.adAccount.update({
    where: { id: adAccount.id },
    data: {
      accessToken: encrypt(refreshed.accessToken),
      ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
      tokenExpiry: refreshed.expiresAt,
    },
  });
  return refreshed.accessToken;
}
