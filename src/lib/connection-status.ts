/** Server + client helper for Connections: when an AdAccount counts as live. */

const OAUTH_PLATFORMS = new Set([
  "meta",
  "google",
  "tiktok",
  "google-analytics",
  "google-search-console",
]);

export function isOAuthAdPlatform(platform: string): boolean {
  return OAUTH_PLATFORMS.has(platform);
}

export function adAccountIsConnected(account: {
  platform: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | string | null;
}): boolean {
  if (!account.accessToken) return false;
  if (!isOAuthAdPlatform(account.platform)) return true;
  if (account.refreshToken?.trim()) return true;
  if (!account.tokenExpiry) return true;
  const expiry = account.tokenExpiry instanceof Date ? account.tokenExpiry : new Date(account.tokenExpiry);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() > Date.now();
}

export function adAccountTokenExpired(account: {
  platform: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | string | null;
}): boolean {
  if (!account.accessToken || !isOAuthAdPlatform(account.platform) || !account.tokenExpiry) {
    return false;
  }
  if (account.refreshToken?.trim()) return false;
  const expiry = account.tokenExpiry instanceof Date ? account.tokenExpiry : new Date(account.tokenExpiry);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() <= Date.now();
}
