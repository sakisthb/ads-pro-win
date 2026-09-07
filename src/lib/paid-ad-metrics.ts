/**
 * DailyMetric stores paid ads, GA4 sessions, email, and OpenCart on the same table.
 * Pixel ROAS / MER / blended "all" must only sum paid ad platforms.
 */

export const PAID_AD_PLATFORMS = [
  "meta",
  "facebook",
  "instagram",
  "google",
  "tiktok",
] as const;

export type PaidAdPlatform = (typeof PAID_AD_PLATFORMS)[number];

export const SITE_ANALYTICS_PLATFORM = "google-analytics";
export const SEARCH_CONSOLE_PLATFORM = "google-search-console";

export const NON_PAID_DAILY_METRIC_PLATFORMS = [
  SITE_ANALYTICS_PLATFORM,
  SEARCH_CONSOLE_PLATFORM,
  "omnisend",
  "brevo",
  "opencart",
] as const;

export function isPaidAdPlatform(platform: string | null | undefined): boolean {
  return (PAID_AD_PLATFORMS as readonly string[]).includes((platform ?? "").toLowerCase());
}

/** Union OAuth-connected + DailyMetric platforms. Display names like "Google" fold to google. */
export function mergeConnectedPaidPlatforms(
  ...groups: Array<Iterable<string> | undefined>
): string[] {
  const out = new Set<string>();
  for (const group of groups) {
    for (const raw of group ?? []) {
      let key = (raw ?? "").toLowerCase();
      if (key === "facebook" || key === "instagram") key = "meta";
      if (isPaidAdPlatform(key)) out.add(key);
    }
  }
  return [...out];
}

/** Sum DailyMetric spend for one paid platform. OAuth-connected with €0 is still empty. */
export function sumAccountSpendForPlatform(
  accounts: Array<{ platform?: string | null; totalSpend?: number | null }>,
  platform: string,
): number {
  const key = platform.toLowerCase();
  return accounts.reduce((sum, row) => {
    if ((row.platform ?? "").toLowerCase() !== key) return sum;
    const spend = Number(row.totalSpend);
    return sum + (Number.isFinite(spend) ? spend : 0);
  }, 0);
}

export function isSiteAnalyticsPlatform(platform: string | null | undefined): boolean {
  return (platform ?? "").toLowerCase() === SITE_ANALYTICS_PLATFORM;
}

/**
 * Prisma `platform` clause for DailyMetric.
 * Omitted or `"all"` = paid ads only. An explicit platform is an exact match
 * (so GA4 channel mix can still query `google-analytics`).
 */
export function dailyMetricPlatformWhere(
  platform?: string | null,
): { platform: string } | { platform: { in: string[] } } {
  if (platform && platform !== "all") {
    return { platform };
  }
  return { platform: { in: [...PAID_AD_PLATFORMS] } };
}
