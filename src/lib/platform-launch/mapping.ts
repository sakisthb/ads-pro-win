export type LaunchPlatform = "meta" | "google" | "tiktok";
export type LaunchObjective =
  | "sales"
  | "traffic"
  | "awareness"
  | "leads"
  | "engagement";
export type LiveStatus = "PAUSED" | "ACTIVE";

export const LAUNCH_OBJECTIVES: LaunchObjective[] = [
  "sales",
  "traffic",
  "awareness",
  "leads",
  "engagement",
];

export function stripActPrefix(accountId: string): string {
  return accountId.replace(/^act_/i, "");
}

export function metaActPath(accountId: string): string {
  return `act_${stripActPrefix(accountId)}`;
}

/** Meta daily budgets are integer cents in the account currency. */
export function dailyBudgetToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 100;
  return Math.max(100, Math.round(amount * 100));
}

/** Google Ads budgets are micros (1 unit = 1_000_000 micros). */
export function dailyBudgetToMicros(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "1000000";
  return String(Math.max(1_000_000, Math.round(amount * 1_000_000)));
}

export function mapMetaObjective(objective: LaunchObjective): string {
  switch (objective) {
    case "sales":
      return "OUTCOME_SALES";
    case "traffic":
      return "OUTCOME_TRAFFIC";
    case "awareness":
      return "OUTCOME_AWARENESS";
    case "leads":
      return "OUTCOME_LEADS";
    case "engagement":
      return "OUTCOME_ENGAGEMENT";
  }
}

export function mapMetaOptimization(objective: LaunchObjective): {
  optimizationGoal: string;
  billingEvent: string;
} {
  switch (objective) {
    case "sales":
      return { optimizationGoal: "OFFSITE_CONVERSIONS", billingEvent: "IMPRESSIONS" };
    case "leads":
      return { optimizationGoal: "LEAD_GENERATION", billingEvent: "IMPRESSIONS" };
    case "awareness":
      return { optimizationGoal: "REACH", billingEvent: "IMPRESSIONS" };
    case "engagement":
      return { optimizationGoal: "POST_ENGAGEMENT", billingEvent: "IMPRESSIONS" };
    case "traffic":
      return { optimizationGoal: "LINK_CLICKS", billingEvent: "IMPRESSIONS" };
  }
}

export function mapTikTokObjective(objective: LaunchObjective): string {
  switch (objective) {
    case "sales":
      return "CONVERSIONS";
    case "leads":
      return "LEAD_GENERATION";
    case "awareness":
      return "REACH";
    case "engagement":
      return "ENGAGEMENT";
    case "traffic":
      return "TRAFFIC";
  }
}

export function mapPrismaPlatform(
  platform: LaunchPlatform,
): "facebook" | "google" | "tiktok" {
  return platform === "meta" ? "facebook" : platform;
}

export function fromPrismaPlatform(platform: string): LaunchPlatform | null {
  if (platform === "facebook" || platform === "instagram" || platform === "meta") {
    return "meta";
  }
  if (platform === "google") return "google";
  if (platform === "tiktok") return "tiktok";
  return null;
}

export function adsManagerUrl(
  platform: LaunchPlatform,
  accountId: string,
  campaignId?: string,
): string {
  if (platform === "meta") {
    const act = stripActPrefix(accountId);
    const selected = campaignId ? `&selected_campaign_ids=${campaignId}` : "";
    return `https://www.facebook.com/adsmanager/manage/campaigns?act=${act}${selected}`;
  }
  if (platform === "google") {
    const cid = campaignId ? `&campaignId=${campaignId}` : "";
    return `https://ads.google.com/aw/campaigns?ocid=${stripActPrefix(accountId)}${cid}`;
  }
  return `https://ads.tiktok.com/i18n/perf/campaign?aadvid=${accountId}`;
}

export function friendlyPlatformError(platform: LaunchPlatform, raw: string): string {
  const text = raw || "Unknown platform error";
  if (
    platform === "meta" &&
    /ads_management|\(#10\)|#10\b|#200\b|insufficient/i.test(text)
  ) {
    return "Meta is still on a read-only token. Reconnect Meta on Connections and approve ads_management so we can create and edit campaigns.";
  }
  if (platform === "google" && /developer.?token|UNAUTHENTICATED|403/i.test(text)) {
    return "Google Ads write failed. Check the developer token and reconnect Google Ads on Connections.";
  }
  if (platform === "tiktok" && /permission|scope|40100|40001/i.test(text)) {
    return "TikTok rejected the write. Reconnect TikTok Ads and confirm the app has campaign-management access.";
  }
  return text;
}

export function normalizeCountries(countries: string[] | undefined): string[] {
  const fallback = ["GR", "DE", "AT", "CH"];
  if (!countries || countries.length === 0) return fallback;
  const cleaned = countries
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return cleaned.length > 0 ? cleaned : fallback;
}

export function clampAge(min: number | undefined, max: number | undefined): {
  ageMin: number;
  ageMax: number;
} {
  const ageMin = Math.min(65, Math.max(18, Math.round(min ?? 18)));
  const ageMax = Math.min(65, Math.max(ageMin, Math.round(max ?? 65)));
  return { ageMin, ageMax };
}

export function canSubmitLaunch(input: {
  name: string;
  headline: string;
  primaryText: string;
  dailyBudget: number;
  platformCount: number;
  includeAd: boolean;
  isDemo: boolean;
  pending?: boolean;
}): boolean {
  if (input.isDemo || input.pending) return false;
  if (!input.name.trim() || input.dailyBudget <= 0 || input.platformCount < 1) return false;
  if (input.includeAd && (!input.headline.trim() || !input.primaryText.trim())) return false;
  return true;
}
