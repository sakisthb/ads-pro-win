/**
 * Pure helpers for DailyMetric batch writes.
 *
 * PostgreSQL bind-parameter limit (Prisma reports 32,767; wire protocol is
 * 65,535). `createMany` is one INSERT with one bind per field per row, so an
 * 18-month Meta pull (~27 fields × thousands of campaign-days) overflows.
 * Prisma staff: split into smaller chunks and run them in a transaction.
 *
 * NUMERIC(p,s) overflows when left-of-decimal digits exceed p−s. CTR was
 * Decimal(6,4) (max 99.9999). Values are rounded to schema scale and passed
 * as strings (Prisma's recommended Decimal input).
 */

export interface DailyMetricRowSource {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  campaignId?: string;
  campaignName?: string;
  reach?: number;
  frequency?: number;
  linkClicks?: number;
  landingPageViews?: number;
  addToCart?: number;
  checkouts?: number;
  websitePurchases?: number;
  websitePurchaseValue?: number;
  results?: number;
  resultType?: string | null;
  attributionSetting?: string | null;
}

/** Stay well under 32,767 binds: 500 rows × ~27 fields ≈ 13,500 params. */
export const DAILY_METRIC_INSERT_CHUNK = 500;

/** Short transactions (Prisma default timeout is 5s). */
export const DAILY_METRIC_DATE_WINDOW = 14;

const PG_INT_MAX = 2_147_483_647;

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize) as T[]);
  }
  return chunks;
}

export function windowSortedDates(dates: readonly string[], windowSize: number): string[][] {
  const unique = [...new Set(dates)].sort();
  return chunkArray(unique, windowSize);
}

export function dailyMetricUniqueKey(row: DailyMetricRowSource): string {
  return `${row.date}\0${row.campaignId ?? ""}`;
}

/** Last row wins so a later Graph chunk can restate the same campaign-day. */
export function dedupeDailyMetrics<T extends DailyMetricRowSource>(metrics: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of metrics) {
    map.set(dailyMetricUniqueKey(row), row);
  }
  return [...map.values()];
}

export function roundToScale(value: number, scale: number): string {
  if (!Number.isFinite(value)) return (0).toFixed(scale);
  const factor = 10 ** scale;
  return (Math.round(value * factor) / factor).toFixed(scale);
}

export function toPgInt(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(PG_INT_MAX, Math.round(value)));
}

export function optionalScaled(value: number | null | undefined, scale: number): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundToScale(value, scale);
}

function asText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toDailyMetricCreateData(
  row: DailyMetricRowSource,
  adAccountId: string,
  platform: string,
) {
  const impressions = toPgInt(row.impressions);
  const clicks = toPgInt(row.clicks);
  const spend = Number.isFinite(row.spend) ? row.spend : 0;
  const conversionValue = Number.isFinite(row.conversionValue) ? row.conversionValue : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  const roas = spend > 0 ? conversionValue / spend : null;

  return {
    date: new Date(row.date),
    platform,
    adAccountId,
    campaignId: row.campaignId ?? "",
    campaignName: row.campaignName ?? null,
    adGroupId: "",
    adId: "",
    spend: roundToScale(spend, 4),
    impressions,
    clicks,
    conversions: roundToScale(Number.isFinite(row.conversions) ? row.conversions : 0, 2),
    conversionValue: roundToScale(conversionValue, 4),
    reach: toPgInt(row.reach),
    frequency: optionalScaled(row.frequency, 4),
    linkClicks: toPgInt(row.linkClicks),
    landingPageViews: toPgInt(row.landingPageViews),
    addToCart: roundToScale(row.addToCart ?? 0, 2),
    checkouts: roundToScale(row.checkouts ?? 0, 2),
    websitePurchases: roundToScale(row.websitePurchases ?? 0, 2),
    websitePurchaseValue: roundToScale(row.websitePurchaseValue ?? 0, 4),
    results: roundToScale(row.results ?? 0, 2),
    resultType: asText(row.resultType),
    attributionSetting: asText(row.attributionSetting),
    ctr: optionalScaled(ctr, 4),
    cpc: optionalScaled(cpc, 4),
    cpm: optionalScaled(cpm, 4),
    roas: optionalScaled(roas, 4),
  };
}
