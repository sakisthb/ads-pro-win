/**
 * Google Analytics 4 Admin + Data API helpers.
 *
 * Property listing uses Analytics Admin accountSummaries.
 * Daily import uses Analytics Data runReport, grouped by default channel.
 * Scope required: https://www.googleapis.com/auth/analytics.readonly
 */

import type { DateRange } from "@/lib/mcp/types";
import type { DailyMetricRowSource } from "@/lib/sync/daily-metric-rows";
import { safeFetch } from "@/lib/safe-fetch";
import {
  collapseGa4BreakdownByShortLabel,
  formatGa4ApiError,
  formatGa4Date,
  ga4DeskLabel,
  ga4PendingAccountId,
  ga4StoredAccountId,
  isGa4GenerativeChannel,
  isGa4OrganicSearchChannel,
  isGa4PaidChannel,
  isGa4PropertyReady,
  parseGa4PropertyId,
  rollupGa4DeskDays,
  shortGa4PageLabel,
  type Ga4DeskDay,
  type Ga4DeskLabel,
  type Ga4Property,
  type Ga4RealtimeBreakdownRow,
} from "./ga4-shared";

export {
  collapseGa4BreakdownByShortLabel,
  formatGa4ApiError,
  formatGa4Date,
  ga4DeskLabel,
  ga4PendingAccountId,
  ga4StoredAccountId,
  isGa4GenerativeChannel,
  isGa4OrganicSearchChannel,
  isGa4PaidChannel,
  isGa4PropertyReady,
  parseGa4PropertyId,
  rollupGa4DeskDays,
  shortGa4PageLabel,
};
export type { Ga4DeskDay, Ga4DeskLabel, Ga4Property, Ga4RealtimeBreakdownRow };

interface AccountSummary {
  displayName?: string;
  propertySummaries?: Array<{
    property?: string;
    displayName?: string;
    propertyType?: string;
  }>;
}

export async function listGa4Properties(
  accessToken: string,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<Ga4Property[]> {
  const properties: Ga4Property[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(formatGa4ApiError(res.status, text));
    }
    const json = JSON.parse(text || "{}") as {
      accountSummaries?: AccountSummary[];
      nextPageToken?: string;
    };
    for (const account of json.accountSummaries ?? []) {
      const accountName = account.displayName?.trim() || "GA4 account";
      for (const summary of account.propertySummaries ?? []) {
        const id = parseGa4PropertyId(summary.property);
        if (!id) continue;
        properties.push({
          id,
          displayName: summary.displayName?.trim() || `Property ${id}`,
          accountName,
          resourceName: summary.property!.startsWith("properties/")
            ? summary.property!
            : `properties/${id}`,
        });
      }
    }
    pageToken = json.nextPageToken || undefined;
  } while (pageToken);

  return properties;
}

const GA4_CORE_METRICS = [
  "sessions",
  "screenPageViews",
  "engagedSessions",
  "conversions",
  "totalRevenue",
] as const;

const GA4_ECOM_METRICS = ["ecommercePurchases", "addToCarts", "checkouts"] as const;

export interface Ga4ReportRow {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

export interface Ga4ReportJson {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string }>;
  rows?: Ga4ReportRow[];
}

function metricNumber(row: Record<string, string>, key: string): number {
  const raw = row[key];
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function mapGa4ReportToDailyMetrics(report: Ga4ReportJson): DailyMetricRowSource[] {
  const dimNames = (report.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const metricNames = (report.metricHeaders ?? []).map((h) => h.name ?? "");
  const dateIdx = dimNames.indexOf("date");
  const channelIdx = dimNames.indexOf("sessionDefaultChannelGroup");

  return (report.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const metrics: Record<string, string> = {};
    (row.metricValues ?? []).forEach((cell, i) => {
      const name = metricNames[i];
      if (name) metrics[name] = cell.value ?? "0";
    });
    const dateRaw = dateIdx >= 0 ? (dims[dateIdx]?.value ?? "") : "";
    const channel =
      channelIdx >= 0 ? (dims[channelIdx]?.value ?? "(other)") : "(other)";
    const sessions = metricNumber(metrics, "sessions");
    const views = metricNumber(metrics, "screenPageViews");
    const engaged = metricNumber(metrics, "engagedSessions");
    const conversions = metricNumber(metrics, "conversions");
    const revenue = metricNumber(metrics, "totalRevenue");
    const purchases = metricNumber(metrics, "ecommercePurchases");
    return {
      date: formatGa4Date(dateRaw),
      spend: 0,
      impressions: Math.round(views || sessions),
      clicks: Math.round(sessions),
      conversions,
      conversionValue: revenue,
      campaignId: channel,
      campaignName: channel,
      linkClicks: Math.round(engaged || sessions),
      addToCart: metricNumber(metrics, "addToCarts"),
      checkouts: metricNumber(metrics, "checkouts"),
      websitePurchases: purchases,
      websitePurchaseValue: revenue,
      results: conversions,
      resultType: "ga4_key_event",
    };
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
}

async function runGa4Report(
  accessToken: string,
  propertyId: string,
  dateRange: DateRange,
  metricNames: readonly string[],
  fetchImpl: typeof fetch,
): Promise<Ga4ReportJson> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metrics: metricNames.map((name) => ({ name })),
      limit: "100000",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGa4ApiError(res.status, text));
  }
  return JSON.parse(text || "{}") as Ga4ReportJson;
}

export async function fetchGa4Metrics(
  accessToken: string,
  propertyId: string,
  dateRange: DateRange,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<DailyMetricRowSource[]> {
  const id = parseGa4PropertyId(propertyId) ?? propertyId;
  if (!/^\d+$/.test(id)) {
    throw new Error("Select a GA4 property before syncing.");
  }
  const fullMetrics = [...GA4_CORE_METRICS, ...GA4_ECOM_METRICS];
  try {
    const report = await runGa4Report(accessToken, id, dateRange, fullMetrics, fetchImpl);
    return mapGa4ReportToDailyMetrics(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ecommerce|addToCart|checkout|metric/i.test(message)) {
      throw error;
    }
    const report = await runGa4Report(accessToken, id, dateRange, GA4_CORE_METRICS, fetchImpl);
    return mapGa4ReportToDailyMetrics(report);
  }
}

export interface Ga4RealtimeTotals {
  activeUsers: number;
  screenPageViews: number;
  eventCount: number;
  keyEvents: number;
}

export interface Ga4RealtimeSnapshot {
  totals: Ga4RealtimeTotals;
  countries: Ga4RealtimeBreakdownRow[];
  devices: Ga4RealtimeBreakdownRow[];
  pages: Ga4RealtimeBreakdownRow[];
}

function metricMapFromRow(
  report: Ga4ReportJson,
  row: Ga4ReportRow | undefined,
): Record<string, number> {
  const metricNames = (report.metricHeaders ?? []).map((h) => h.name ?? "");
  const out: Record<string, string> = {};
  (row?.metricValues ?? []).forEach((cell, i) => {
    const name = metricNames[i];
    if (name) out[name] = cell.value ?? "0";
  });
  return {
    activeUsers: metricNumber(out, "activeUsers"),
    screenPageViews: metricNumber(out, "screenPageViews"),
    eventCount: metricNumber(out, "eventCount"),
    keyEvents: metricNumber(out, "keyEvents") || metricNumber(out, "conversions"),
  };
}

export function parseGa4RealtimeTotals(report: Ga4ReportJson): Ga4RealtimeTotals {
  const mapped = metricMapFromRow(report, report.rows?.[0]);
  return {
    activeUsers: Math.round(mapped.activeUsers),
    screenPageViews: Math.round(mapped.screenPageViews),
    eventCount: Math.round(mapped.eventCount),
    keyEvents: Math.round(mapped.keyEvents),
  };
}

export function parseGa4RealtimeDimension(
  report: Ga4ReportJson,
  limit = 8,
): Ga4RealtimeBreakdownRow[] {
  const dimName = report.dimensionHeaders?.[0]?.name ?? "";
  if (!dimName) return [];
  const rows = (report.rows ?? []).map((row) => {
    const label = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const mapped = metricMapFromRow(report, row);
    return { label, activeUsers: Math.round(mapped.activeUsers) };
  });
  return rows
    .filter((row) => row.activeUsers > 0 || row.label !== "(not set)")
    .sort((a, b) => b.activeUsers - a.activeUsers)
    .slice(0, limit);
}

async function runGa4RealtimeReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Ga4ReportJson> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGa4ApiError(res.status, text));
  }
  return JSON.parse(text || "{}") as Ga4ReportJson;
}

const REALTIME_METRIC_SETS: readonly string[][] = [
  ["activeUsers", "screenPageViews", "eventCount", "keyEvents"],
  ["activeUsers", "screenPageViews", "eventCount"],
  ["activeUsers", "eventCount"],
];

async function fetchGa4RealtimeTotals(
  accessToken: string,
  propertyId: string,
  fetchImpl: typeof fetch,
): Promise<Ga4RealtimeTotals> {
  let lastError: unknown;
  for (const metrics of REALTIME_METRIC_SETS) {
    try {
      const report = await runGa4RealtimeReport(
        accessToken,
        propertyId,
        { metrics: metrics.map((name) => ({ name })), limit: "1" },
        fetchImpl,
      );
      return parseGa4RealtimeTotals(report);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/keyevent|screenpageview|metric|compatible|not found/i.test(message)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GA4 Realtime totals failed.");
}

async function fetchGa4RealtimeDimension(
  accessToken: string,
  propertyId: string,
  dimension: string,
  fetchImpl: typeof fetch,
): Promise<Ga4RealtimeBreakdownRow[]> {
  const base = {
    dimensions: [{ name: dimension }],
    metrics: [{ name: "activeUsers" }],
    limit: "10",
  };
  try {
    const report = await runGa4RealtimeReport(
      accessToken,
      propertyId,
      {
        ...base,
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      },
      fetchImpl,
    );
    return parseGa4RealtimeDimension(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/orderby/i.test(message)) {
      try {
        const report = await runGa4RealtimeReport(accessToken, propertyId, base, fetchImpl);
        return parseGa4RealtimeDimension(report);
      } catch {
        return [];
      }
    }
    if (/dimension|not found|compatible|invalid/i.test(message)) {
      return [];
    }
    throw error;
  }
}

/** Last ~30 minutes of site activity. Not a WebSocket. Not till. Not pixel ROAS. */
export async function fetchGa4Realtime(
  accessToken: string,
  propertyId: string,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<Ga4RealtimeSnapshot> {
  const id = parseGa4PropertyId(propertyId) ?? propertyId;
  if (!/^\d+$/.test(id)) {
    throw new Error("Select a GA4 property before loading Realtime.");
  }
  const totals = await fetchGa4RealtimeTotals(accessToken, id, fetchImpl);
  const [countries, devices, pages] = await Promise.all([
    fetchGa4RealtimeDimension(accessToken, id, "country", fetchImpl),
    fetchGa4RealtimeDimension(accessToken, id, "deviceCategory", fetchImpl),
    fetchGa4RealtimeDimension(accessToken, id, "unifiedScreenName", fetchImpl),
  ]);
  return { totals, countries, devices, pages };
}
