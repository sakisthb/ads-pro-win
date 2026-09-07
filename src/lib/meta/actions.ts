/**
 * Meta Ads Insights / campaign-object parsers.
 *
 * Field names and behaviour follow the Marketing API Ads Insights reference
 * (v21–v26) and Limits & Best Practices:
 *   - purchases live in `actions` / `action_values` as action_type rows
 *   - Ads Manager "Link clicks" is `inline_link_clicks` (fixed 1d_click)
 *   - `clicks` is Clicks (all)
 *   - `results` is the Ads Manager Results column (objective-based)
 *   - unique metrics (`reach`, `frequency`) are estimates and must not be
 *     summed across days
 *   - Insights can restate for 28 days after first report
 *   - `attribution_spec` is an ad-set field; insights expose
 *     `attribution_setting` rolled up from ad sets
 */

import type { CampaignStatus } from "@/lib/mcp/types";
import { labelMetaResultType } from "@/lib/meta/labels";

export { labelMetaResultType };

export const META_GRAPH_VERSION = "v25.0";

/** ~18 months. Aggregate insights (no breakdowns) are retained ~37 months. */
export const META_FULL_LOOKBACK_DAYS = 547;

/** Official restatement window — metrics can keep updating for 28 days. */
export const META_DELTA_LOOKBACK_DAYS = 28;

/** Chunk size for synchronous daily (`time_increment=1`) campaign insights. */
export const META_INSIGHTS_CHUNK_DAYS = 30;

export type MetaAction = { action_type?: string; value?: string | number };

export const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
] as const;

export const WEBSITE_PURCHASE_ACTION_TYPES = [
  "offsite_conversion.fb_pixel_purchase",
] as const;

export const LANDING_PAGE_ACTION_TYPES = [
  "omni_landing_page_view",
  "landing_page_view",
] as const;

export const ATC_ACTION_TYPES = [
  "omni_add_to_cart",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
] as const;

export const CHECKOUT_ACTION_TYPES = [
  "omni_initiated_checkout",
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
] as const;

export const LINK_CLICK_ACTION_TYPES = ["link_click"] as const;

const OBJECTIVE_RESULT_TYPES: Record<string, readonly string[]> = {
  OUTCOME_SALES: PURCHASE_ACTION_TYPES,
  CONVERSIONS: PURCHASE_ACTION_TYPES,
  PRODUCT_CATALOG_SALES: PURCHASE_ACTION_TYPES,
  CATALOG_SALES: PURCHASE_ACTION_TYPES,
  OUTCOME_TRAFFIC: [...LANDING_PAGE_ACTION_TYPES, ...LINK_CLICK_ACTION_TYPES],
  LINK_CLICKS: [...LINK_CLICK_ACTION_TYPES, ...LANDING_PAGE_ACTION_TYPES],
  LANDING_PAGE_VIEWS: LANDING_PAGE_ACTION_TYPES,
  OUTCOME_AWARENESS: ["estimated_ad_recallers"],
  BRAND_AWARENESS: ["estimated_ad_recallers"],
  REACH: ["reach"],
  OUTCOME_ENGAGEMENT: ["post_engagement", "page_engagement"],
  POST_ENGAGEMENT: ["post_engagement"],
  PAGE_LIKES: ["like"],
  OUTCOME_LEADS: ["lead", "offsite_conversion.fb_pixel_lead", "omni_complete_registration"],
  LEAD_GENERATION: ["lead"],
  OUTCOME_APP_PROMOTION: ["omni_app_install", "app_install", "mobile_app_install"],
  APP_INSTALLS: ["mobile_app_install", "omni_app_install"],
};

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function parseIntSafe(value: unknown): number {
  return Math.round(parseNumber(value));
}

/**
 * First matching action_type with a positive value. Never sums sibling
 * types — `omni_purchase` already includes website + in-app + offline.
 */
export function parseAction(
  actions: MetaAction[] | undefined,
  types: readonly string[],
): number {
  if (!actions?.length) return 0;
  for (const type of types) {
    const entry = actions.find((a) => a.action_type === type);
    const value = parseNumber(entry?.value);
    if (value > 0) return value;
  }
  return 0;
}

export function parsePurchaseCount(actions: MetaAction[] | undefined): number {
  return parseAction(actions, PURCHASE_ACTION_TYPES);
}

export function parsePurchaseValue(actionValues: MetaAction[] | undefined): number {
  return parseAction(actionValues, PURCHASE_ACTION_TYPES);
}

export function parseWebsitePurchases(actions: MetaAction[] | undefined): number {
  return parseAction(actions, WEBSITE_PURCHASE_ACTION_TYPES);
}

export function parseWebsitePurchaseValue(actionValues: MetaAction[] | undefined): number {
  return parseAction(actionValues, WEBSITE_PURCHASE_ACTION_TYPES);
}

/** Meta budgets are integer subunits (cents). €40.00 arrives as `"4000"`. */
export function metaCentsToAmount(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const n = parseNumber(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 100;
}

export function mapMetaCampaignStatus(
  status?: string | null,
  effectiveStatus?: string | null,
): CampaignStatus {
  const raw = (effectiveStatus || status || "").toLowerCase();
  if (!raw) return "unknown";
  if (raw === "active") return "active";
  if (
    raw === "paused" ||
    raw === "inactive" ||
    raw === "campaign_paused" ||
    raw === "adset_paused" ||
    raw === "paused_with_review_requested"
  ) {
    return "paused";
  }
  if (raw === "archived" || raw === "deleted") return "archived";
  return "unknown";
}

export function formatAttributionSpec(spec: unknown): string | null {
  if (!Array.isArray(spec) || spec.length === 0) return null;
  const labels: string[] = [];
  for (const item of spec) {
    if (!item || typeof item !== "object") continue;
    const row = item as { event_type?: string; window_days?: number | string };
    const days = parseIntSafe(row.window_days);
    const event = (row.event_type ?? "").toUpperCase();
    if (!days || !event) continue;
    if (event === "CLICK_THROUGH") labels.push(`${days}-day click`);
    else if (event === "VIEW_THROUGH") labels.push(`${days}-day view`);
    else if (event === "ENGAGED_VIDEO_VIEW") labels.push(`${days}-day engaged-view`);
  }
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

/** Normalize insights `attribution_setting` or a free-form Ads Manager string. */
export function formatAttributionSetting(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return null;
  if (/multiple/i.test(trimmed)) return "Multiple attribution settings";
  if (/\d+-day/.test(trimmed)) {
    return trimmed;
  }
  const tokens = trimmed
    .toLowerCase()
    .replace(/-/g, "_")
    .split(/[,\s+|]+/)
    .flatMap((token) => token.split("_").length > 2 ? token.match(/\d+d_(?:click|view|ev)/g) ?? [token] : [token])
    .filter(Boolean);
  const labels: string[] = [];
  for (const token of tokens) {
    const match = /^(\d+)d_(click|view|ev)$/.exec(token);
    if (!match) continue;
    const days = match[1];
    const kind =
      match[2] === "click" ? "click" : match[2] === "ev" ? "engaged-view" : "view";
    labels.push(`${days}-day ${kind}`);
  }
  if (labels.length === 0) return trimmed;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export interface MetaResult {
  resultType: string | null;
  results: number;
}

interface InsightsResultRow {
  indicator?: string;
  action_type?: string;
  value?: string | number;
}

/** Parse Insights `results` / `objective_results` (Ads Manager Results). */
export function parseInsightsResults(raw: unknown): MetaResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { resultType: null, results: 0 };
  }
  const row = raw[0] as InsightsResultRow;
  const resultType = (row.indicator || row.action_type || "").trim() || null;
  return { resultType, results: parseNumber(row.value) };
}

export function inferResultFromActions(
  actions: MetaAction[] | undefined,
  objective?: string | null,
  reach = 0,
): MetaResult {
  const key = (objective ?? "").toUpperCase();
  const preferred = OBJECTIVE_RESULT_TYPES[key] ?? PURCHASE_ACTION_TYPES;
  for (const type of preferred) {
    if (type === "reach") {
      if (reach > 0) return { resultType: "reach", results: reach };
      continue;
    }
    const value = parseAction(actions, [type]);
    if (value > 0) return { resultType: type, results: value };
  }
  const fallbacks = [
    ...PURCHASE_ACTION_TYPES,
    ...ATC_ACTION_TYPES,
    ...LANDING_PAGE_ACTION_TYPES,
    "estimated_ad_recallers",
    ...LINK_CLICK_ACTION_TYPES,
  ];
  for (const type of fallbacks) {
    const value = parseAction(actions, [type]);
    if (value > 0) return { resultType: type, results: value };
  }
  return { resultType: null, results: 0 };
}

export function isoDateOffset(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultMetaLookbackDays(isDelta = false): number {
  if (isDelta) return META_DELTA_LOOKBACK_DAYS;
  const env = Number(process.env.META_SYNC_LOOKBACK_DAYS);
  if (Number.isFinite(env) && env > 0) return Math.min(Math.floor(env), 730);
  return META_FULL_LOOKBACK_DAYS;
}

export function defaultSyncLookbackDays(platform: string, isDelta = false): number {
  if (platform === "meta") return defaultMetaLookbackDays(isDelta);
  if (isDelta) return 1;
  if (platform === "woocommerce") return 365;
  if (platform === "brevo" || platform === "omnisend") return 180;
  // Search Console Search Analytics keeps ~16 months of data.
  if (platform === "google-search-console") return 480;
  return 30;
}

export function splitDateRange(
  startDate: string,
  endDate: string,
  chunkDays = META_INSIGHTS_CHUNK_DAYS,
): Array<{ startDate: string; endDate: string }> {
  const chunks: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    return [{ startDate, endDate }];
  }
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    const until = chunkEnd > end ? end : chunkEnd;
    chunks.push({
      startDate: cursor.toISOString().slice(0, 10),
      endDate: until.toISOString().slice(0, 10),
    });
    cursor = new Date(until);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

/** Impression-weighted frequency; estimated unique reach = impressions / freq. */
export function rollupReachFrequency(
  rows: Array<{ impressions: number; frequency: number; reach: number }>,
): { frequency: number; reach: number } {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const weighted = rows.reduce((s, r) => s + r.frequency * r.impressions, 0);
  const frequency = impressions > 0 && weighted > 0 ? weighted / impressions : 0;
  const reach = frequency > 0 ? impressions / frequency : rows.reduce((s, r) => s + r.reach, 0);
  return { frequency, reach };
}
