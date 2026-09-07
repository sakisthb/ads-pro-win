/**
 * Google Search Console helpers (Webmaster Tools API v3).
 *
 * List verified properties, then import Search Analytics into DailyMetric.
 * Scope: https://www.googleapis.com/auth/webmasters.readonly
 * Enable Search Console API on the same Cloud project as Ads Pro Connects.
 */

import type { DateRange } from "@/lib/mcp/types";
import type { DailyMetricRowSource } from "@/lib/sync/daily-metric-rows";
import { safeFetch } from "@/lib/safe-fetch";

export const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_SITE_TOTAL_CAMPAIGN_ID = "__site__";
export const GSC_QUERY_LOOKBACK_DAYS = 28;
export const GSC_QUERY_ROW_LIMIT = 5_000;

export type GscDemandRow = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
  answerShaped: boolean;
};

export type GscPositionBandId = "page1" | "page2" | "deeper";

export type GscPositionBand = {
  id: GscPositionBandId;
  label: string;
  queries: number;
  clicks: number;
  impressions: number;
};

export function gscCtr(clicks: number, impressions: number): number {
  if (!(impressions > 0)) return 0;
  return (clicks / impressions) * 100;
}

export function impressionWeightedPosition(
  rows: Array<{ impressions: number; position: number }>,
): number | null {
  let weight = 0;
  let sum = 0;
  for (const row of rows) {
    if (!(row.impressions > 0) || !Number.isFinite(row.position)) continue;
    weight += row.impressions;
    sum += row.impressions * row.position;
  }
  return weight > 0 ? sum / weight : null;
}

/** Question-shaped queries — AEO candidates, not featured-snippet proof. */
export function looksLikeAnswerQuery(query: string): boolean {
  const t = query.trim().toLowerCase();
  if (!t || t === "(not set)" || t === GSC_SITE_TOTAL_CAMPAIGN_ID) return false;
  if (t.includes("?")) return true;
  return /^(how|what|why|when|where|who|which|can |does |is |are |do |should |πως|πώς|τι |γιατι|γιατί|που |πού |ποτε|πότε|ποιος|ποια )/.test(
    t,
  ) || /\b(how to|what is|τι ειναι|τι είναι|πως να|πώς να|where to buy)\b/.test(t);
}

export function isGscSiteTotalCampaignId(campaignId: string | null | undefined): boolean {
  return (campaignId ?? "") === GSC_SITE_TOTAL_CAMPAIGN_ID;
}

export function collectGscQueries(
  rows: Array<{
    campaignName?: string | null;
    campaignId?: string | null;
    clicks: number;
    impressions: number;
    position: number;
  }>,
): GscDemandRow[] {
  const map = new Map<
    string,
    { clicks: number; impressions: number; posRows: Array<{ impressions: number; position: number }> }
  >();
  for (const row of rows) {
    if (isGscSiteTotalCampaignId(row.campaignId)) continue;
    const query = (row.campaignName || row.campaignId || "").trim();
    if (!query) continue;
    const cur = map.get(query) ?? { clicks: 0, impressions: 0, posRows: [] };
    cur.clicks += row.clicks;
    cur.impressions += row.impressions;
    if (Number.isFinite(row.position) && row.impressions > 0) {
      cur.posRows.push({ impressions: row.impressions, position: row.position });
    }
    map.set(query, cur);
  }
  return [...map.entries()]
    .map(([query, cur]) => ({
      query,
      clicks: cur.clicks,
      impressions: cur.impressions,
      position: impressionWeightedPosition(cur.posRows) ?? 0,
      ctr: gscCtr(cur.clicks, cur.impressions),
      answerShaped: looksLikeAnswerQuery(query),
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export function rollupGscQueries(
  rows: Array<{
    campaignName?: string | null;
    campaignId?: string | null;
    clicks: number;
    impressions: number;
    position: number;
  }>,
  limit = 40,
): GscDemandRow[] {
  return collectGscQueries(rows).slice(0, limit);
}

export function gscPositionBands(rows: GscDemandRow[]): GscPositionBand[] {
  const empty: Record<GscPositionBandId, GscPositionBand> = {
    page1: { id: "page1", label: "Page 1 (pos ≤ 10)", queries: 0, clicks: 0, impressions: 0 },
    page2: { id: "page2", label: "Page 2 (11–20)", queries: 0, clicks: 0, impressions: 0 },
    deeper: { id: "deeper", label: "Page 3+ (pos > 20)", queries: 0, clicks: 0, impressions: 0 },
  };
  for (const row of rows) {
    const id: GscPositionBandId =
      row.position > 0 && row.position <= 10
        ? "page1"
        : row.position > 10 && row.position <= 20
          ? "page2"
          : "deeper";
    empty[id].queries += 1;
    empty[id].clicks += row.clicks;
    empty[id].impressions += row.impressions;
  }
  return [empty.page1, empty.page2, empty.deeper];
}

export function rollupGscSiteDays(
  rows: Array<{ date: string; clicks: number; impressions: number; position: number }>,
): {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
  days: Array<{ date: string; clicks: number; impressions: number; position: number | null }>;
} {
  const days = [...rows]
    .map((row) => ({
      date: row.date,
      clicks: row.clicks,
      impressions: row.impressions,
      position: Number.isFinite(row.position) && row.position > 0 ? row.position : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const clicks = days.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = days.reduce((sum, row) => sum + row.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: gscCtr(clicks, impressions),
    avgPosition: impressionWeightedPosition(
      rows.map((row) => ({ impressions: row.impressions, position: row.position })),
    ),
    days,
  };
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
  displayName: string;
}

interface GscSearchRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export function gscPendingAccountId(brandId: string): string {
  return `gsc:pending:${brandId}`;
}

export function encodeGscSiteKey(siteUrl: string): string {
  return Buffer.from(siteUrl, "utf8").toString("base64url");
}

export function decodeGscSiteKey(key: string): string | null {
  try {
    const decoded = Buffer.from(key, "base64url").toString("utf8").trim();
    if (decoded.startsWith("http://") || decoded.startsWith("https://") || decoded.startsWith("sc-domain:")) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function gscStoredAccountId(brandId: string, siteUrl: string): string {
  return `gscsite:${brandId}:${encodeGscSiteKey(siteUrl)}`;
}

export function parseGscSiteUrl(accountId: string | null | undefined): string | null {
  const raw = (accountId ?? "").trim();
  if (!raw || raw.startsWith("gsc:pending:")) return null;
  const stored = raw.match(/^gscsite:[^:]+:(.+)$/);
  if (stored?.[1]) return decodeGscSiteKey(stored[1]);
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("sc-domain:")) {
    return raw;
  }
  return null;
}

export function isGscSiteReady(accountId: string | null | undefined): boolean {
  return parseGscSiteUrl(accountId) != null;
}

export function gscSiteDisplayName(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.slice("sc-domain:".length);
  try {
    return new URL(siteUrl).hostname || siteUrl;
  } catch {
    return siteUrl;
  }
}

export function preferGscSite(sites: GscSite[], website?: string | null): GscSite | null {
  if (sites.length === 0) return null;
  const host = hostnameFromWebsite(website);
  if (host) {
    const match = sites.find((site) => {
      const name = gscSiteDisplayName(site.siteUrl).toLowerCase();
      return name === host || name.endsWith(`.${host}`) || host.endsWith(`.${name}`);
    });
    if (match) return match;
  }
  return sites.length === 1 ? sites[0]! : null;
}

function hostnameFromWebsite(website?: string | null): string | null {
  const raw = (website ?? "").trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function formatGscApiError(status: number, body: string): string {
  let message = body.slice(0, 400);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message ?? message;
  } catch {
    /* raw body */
  }
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes("unauthenticated")) {
    return "Search Console token expired. Reconnect Search Console, then retry.";
  }
  if (lower.includes("has not been used") || lower.includes("is disabled") || lower.includes("access not configured")) {
    return "Enable Google Search Console API in this Google Cloud project, then retry Sync Now.";
  }
  if (lower.includes("insufficient") || lower.includes("permission") || status === 403) {
    return "This Google account cannot read the selected Search Console property. Pick another site or reconnect.";
  }
  return `Search Console API error (${status}): ${message}`;
}

export function isReadableGscPermission(level: string | undefined): boolean {
  const value = (level ?? "").trim();
  return value === "siteOwner" || value === "siteFullUser" || value === "siteRestrictedUser";
}

export async function listGscSites(
  accessToken: string,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<GscSite[]> {
  const res = await fetchImpl("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGscApiError(res.status, text));
  }
  const json = JSON.parse(text || "{}") as {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
  };
  return (json.siteEntry ?? [])
    .filter((entry) => entry.siteUrl && isReadableGscPermission(entry.permissionLevel))
    .map((entry) => ({
      siteUrl: entry.siteUrl!,
      permissionLevel: entry.permissionLevel ?? "siteRestrictedUser",
      displayName: gscSiteDisplayName(entry.siteUrl!),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function gscQueryCampaignId(query: string): string {
  const trimmed = query.trim() || "(not set)";
  return trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 179)}…`;
}

export function mapGscDateRows(rows: GscSearchRow[], siteUrl: string): DailyMetricRowSource[] {
  const name = gscSiteDisplayName(siteUrl);
  return rows
    .map((row) => {
      const date = (row.keys?.[0] ?? "").trim();
      const clicks = Math.round(Number(row.clicks) || 0);
      const impressions = Math.round(Number(row.impressions) || 0);
      return {
        date,
        spend: 0,
        impressions,
        clicks,
        conversions: 0,
        conversionValue: 0,
        campaignId: GSC_SITE_TOTAL_CAMPAIGN_ID,
        campaignName: name,
        linkClicks: clicks,
        frequency: Number.isFinite(Number(row.position)) ? Number(row.position) : undefined,
        results: clicks,
        resultType: "gsc_click",
      };
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
}

export function mapGscQueryRows(rows: GscSearchRow[]): DailyMetricRowSource[] {
  return rows
    .map((row) => {
      const date = (row.keys?.[0] ?? "").trim();
      const query = (row.keys?.[1] ?? "").trim() || "(not set)";
      const clicks = Math.round(Number(row.clicks) || 0);
      const impressions = Math.round(Number(row.impressions) || 0);
      return {
        date,
        spend: 0,
        impressions,
        clicks,
        conversions: 0,
        conversionValue: 0,
        campaignId: gscQueryCampaignId(query),
        campaignName: query,
        linkClicks: clicks,
        frequency: Number.isFinite(Number(row.position)) ? Number(row.position) : undefined,
        results: clicks,
        resultType: "gsc_query",
      };
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<GscSearchRow[]> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetchImpl(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGscApiError(res.status, text));
  }
  const json = JSON.parse(text || "{}") as { rows?: GscSearchRow[] };
  return json.rows ?? [];
}

function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function fetchGscMetrics(
  accessToken: string,
  siteUrl: string,
  dateRange: DateRange,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<DailyMetricRowSource[]> {
  const site = parseGscSiteUrl(siteUrl) ?? siteUrl;
  if (!site.startsWith("http") && !site.startsWith("sc-domain:")) {
    throw new Error("Pick a Search Console property on Connections before syncing.");
  }
  const dateRows = await querySearchAnalytics(
    accessToken,
    site,
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ["date"],
      type: "web",
      dataState: "all",
      rowLimit: 25_000,
    },
    fetchImpl,
  );
  const queryStart =
    dateRange.endDate > dateRange.startDate
      ? shiftIsoDate(dateRange.endDate, -GSC_QUERY_LOOKBACK_DAYS + 1)
      : dateRange.startDate;
  const queryRangeStart = queryStart < dateRange.startDate ? dateRange.startDate : queryStart;
  const queryRows = await querySearchAnalytics(
    accessToken,
    site,
    {
      startDate: queryRangeStart,
      endDate: dateRange.endDate,
      dimensions: ["date", "query"],
      type: "web",
      dataState: "all",
      rowLimit: GSC_QUERY_ROW_LIMIT,
    },
    fetchImpl,
  );
  return [...mapGscDateRows(dateRows, site), ...mapGscQueryRows(queryRows)];
}
