/**
 * Meta Graph API reads for campaign objects + daily campaign insights.
 *
 * Sync strategy (Limits & Best Practices, May 2026):
 *  - synchronous GET first, 30-day chunks, paginate `paging.next`
 *  - unique metrics (reach/frequency) ride along when the preferred field
 *    set succeeds; dropped on fallback so spend/clicks still land
 *  - no breakdowns, so 18-month reach is allowed (breakdown+reach is 13 months)
 *  - pace chunks to stay under x-fb-ads-insights-throttle
 */

import type { DateRange } from "@/lib/mcp/types";
import { safeFetch } from "@/lib/safe-fetch";
import {
  ATC_ACTION_TYPES,
  CHECKOUT_ACTION_TYPES,
  LANDING_PAGE_ACTION_TYPES,
  LINK_CLICK_ACTION_TYPES,
  META_GRAPH_VERSION,
  META_INSIGHTS_CHUNK_DAYS,
  formatAttributionSetting,
  formatAttributionSpec,
  inferResultFromActions,
  mapMetaCampaignStatus,
  metaCentsToAmount,
  parseAction,
  parseInsightsResults,
  parseIntSafe,
  parseNumber,
  parsePurchaseCount,
  parsePurchaseValue,
  parseWebsitePurchaseValue,
  parseWebsitePurchases,
  splitDateRange,
  type MetaAction,
} from "@/lib/meta/actions";

const PREFERRED_FIELDS =
  "spend,impressions,clicks,inline_link_clicks,reach,frequency,actions,action_values,campaign_id,campaign_name,objective,attribution_setting,results";
const FALLBACK_FIELDS =
  "spend,impressions,clicks,inline_link_clicks,actions,action_values,campaign_id,campaign_name,objective,attribution_setting";
const MINIMAL_FIELDS =
  "spend,impressions,clicks,actions,action_values,campaign_id,campaign_name";

const CAMPAIGN_FIELDS =
  "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time";
const ADSET_FIELDS = "id,campaign_id,daily_budget,lifetime_budget,attribution_spec,effective_status";

const CAMPAIGN_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "CAMPAIGN_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "PENDING_REVIEW",
];

export interface MetaInsightRow {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  conversion_values?: MetaAction[];
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  attribution_setting?: string;
  results?: unknown;
  account_id?: string;
}

export interface MetaCampaignObject {
  platformCampaignId: string;
  name: string;
  status: string;
  effectiveStatus: string | null;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  budgetType: "daily" | "lifetime" | "adset";
  attributionSetting: string | null;
  startTime: Date | null;
  stopTime: Date | null;
  createdTime: Date | null;
  updatedTime: Date | null;
}

export interface MappedMetaMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  campaignId?: string;
  campaignName?: string;
  reach: number;
  frequency: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  checkouts: number;
  websitePurchases: number;
  websitePurchaseValue: number;
  results: number;
  resultType: string | null;
  attributionSetting: string | null;
}

async function graphGet(
  url: string,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; body: string }> {
  const res = await safeFetch(url);
  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body };
  try {
    return { ok: true, json: JSON.parse(body) as Record<string, unknown> };
  } catch {
    return { ok: false, status: res.status, body };
  }
}

async function paginateGraph(
  firstUrl: string,
  maxPages = 40,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let next: string | null = firstUrl;
  let pages = 0;
  while (next && pages < maxPages) {
    const result = await graphGet(next);
    if (!result.ok) {
      throw new Error(`Meta API error (${result.status}): ${result.body}`);
    }
    const rows = result.json.data;
    if (Array.isArray(rows)) all.push(...(rows as Record<string, unknown>[]));
    const paging = result.json.paging as { next?: string } | undefined;
    next = paging?.next ?? null;
    pages += 1;
  }
  return all;
}

function insightsUrl(
  accessToken: string,
  accountId: string,
  range: DateRange,
  fields: string,
): string {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", fields);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_range", JSON.stringify({ since: range.startDate, until: range.endDate }));
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  return url.toString();
}

async function fetchInsightsChunk(
  accessToken: string,
  accountId: string,
  range: DateRange,
): Promise<MetaInsightRow[]> {
  const attempts = [PREFERRED_FIELDS, FALLBACK_FIELDS, MINIMAL_FIELDS];
  let lastError = "";
  for (const fields of attempts) {
    try {
      const rows = await paginateGraph(insightsUrl(accessToken, accountId, range, fields));
      return rows as unknown as MetaInsightRow[];
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || "Meta insights request failed");
}

export async function fetchMetaInsightRows(
  accessToken: string,
  accountId: string,
  dateRange: DateRange,
): Promise<MetaInsightRow[]> {
  const chunks = splitDateRange(dateRange.startDate, dateRange.endDate, META_INSIGHTS_CHUNK_DAYS);
  const all: MetaInsightRow[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const rows = await fetchInsightsChunk(accessToken, accountId, chunk);
    all.push(...rows);
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return all;
}

function parseMetaTime(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchMetaCampaignObjects(
  accessToken: string,
  accountId: string,
): Promise<MetaCampaignObject[]> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}/campaigns`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", CAMPAIGN_FIELDS);
  url.searchParams.set("effective_status", JSON.stringify(CAMPAIGN_STATUSES));
  url.searchParams.set("limit", "200");

  const rows = await paginateGraph(url.toString());
  return rows.map((raw) => {
    const dailyBudget = metaCentsToAmount(raw.daily_budget as string | undefined);
    const lifetimeBudget = metaCentsToAmount(raw.lifetime_budget as string | undefined);
    const budgetType: MetaCampaignObject["budgetType"] = dailyBudget
      ? "daily"
      : lifetimeBudget
        ? "lifetime"
        : "adset";
    const effectiveStatus = (raw.effective_status as string | undefined) ?? null;
    return {
      platformCampaignId: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      status: mapMetaCampaignStatus(raw.status as string | undefined, effectiveStatus),
      effectiveStatus,
      objective: (raw.objective as string | undefined) ?? null,
      dailyBudget,
      lifetimeBudget,
      budgetType,
      attributionSetting: null,
      startTime: parseMetaTime(raw.start_time as string | undefined),
      stopTime: parseMetaTime(raw.stop_time as string | undefined),
      createdTime: parseMetaTime(raw.created_time as string | undefined),
      updatedTime: parseMetaTime(raw.updated_time as string | undefined),
    };
  }).filter((c) => c.platformCampaignId);
}

interface AdSetAttribution {
  campaignId: string;
  attribution: string | null;
  hasAdsetBudget: boolean;
}

export async function fetchMetaAdSetAttribution(
  accessToken: string,
  accountId: string,
): Promise<AdSetAttribution[]> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}/adsets`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", ADSET_FIELDS);
  url.searchParams.set("effective_status", JSON.stringify(CAMPAIGN_STATUSES));
  url.searchParams.set("limit", "200");

  try {
    const rows = await paginateGraph(url.toString());
    return rows.map((raw) => ({
      campaignId: String(raw.campaign_id ?? ""),
      attribution: formatAttributionSpec(raw.attribution_spec),
      hasAdsetBudget:
        metaCentsToAmount(raw.daily_budget as string | undefined) != null ||
        metaCentsToAmount(raw.lifetime_budget as string | undefined) != null,
    })).filter((r) => r.campaignId);
  } catch (error) {
    console.error("[meta/graph] ad set attribution fetch failed:", error);
    return [];
  }
}

export function mergeCampaignAttribution(
  campaigns: MetaCampaignObject[],
  adsets: AdSetAttribution[],
): MetaCampaignObject[] {
  const byCampaign = new Map<string, { labels: Set<string>; hasAdsetBudget: boolean }>();
  for (const row of adsets) {
    const entry = byCampaign.get(row.campaignId) ?? { labels: new Set<string>(), hasAdsetBudget: false };
    if (row.attribution) entry.labels.add(row.attribution);
    if (row.hasAdsetBudget) entry.hasAdsetBudget = true;
    byCampaign.set(row.campaignId, entry);
  }
  return campaigns.map((campaign) => {
    const extra = byCampaign.get(campaign.platformCampaignId);
    let attributionSetting = campaign.attributionSetting;
    if (extra) {
      const labels = [...extra.labels];
      if (labels.length > 1) attributionSetting = "Multiple attribution settings";
      else if (labels.length === 1) attributionSetting = labels[0];
      if (campaign.budgetType === "adset" && !extra.hasAdsetBudget) {
        // keep adset — CBO-off with no stored ad set budget still uses ad set budget
      }
    }
    return { ...campaign, attributionSetting };
  });
}

export function mapInsightRow(
  row: MetaInsightRow,
  campaignObjective?: string | null,
): MappedMetaMetric {
  const actions = row.actions;
  const actionValues = row.action_values ?? row.conversion_values;
  const reach = parseIntSafe(row.reach);
  const fromResults = parseInsightsResults(row.results);
  const inferred = inferResultFromActions(actions, row.objective ?? campaignObjective, reach);
  const resultType = fromResults.resultType ?? inferred.resultType;
  const results = fromResults.results > 0 ? fromResults.results : inferred.results;
  const inlineLinkClicks = parseIntSafe(row.inline_link_clicks);
  const actionLinkClicks = parseAction(actions, LINK_CLICK_ACTION_TYPES);

  return {
    date: row.date_start ?? new Date().toISOString().slice(0, 10),
    spend: parseNumber(row.spend),
    impressions: parseIntSafe(row.impressions),
    clicks: parseIntSafe(row.clicks),
    conversions: parsePurchaseCount(actions),
    conversionValue: parsePurchaseValue(actionValues),
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    reach,
    frequency: parseNumber(row.frequency),
    linkClicks: inlineLinkClicks > 0 ? inlineLinkClicks : actionLinkClicks,
    landingPageViews: parseIntSafe(parseAction(actions, LANDING_PAGE_ACTION_TYPES)),
    addToCart: parseAction(actions, ATC_ACTION_TYPES),
    checkouts: parseAction(actions, CHECKOUT_ACTION_TYPES),
    websitePurchases: parseWebsitePurchases(actions),
    websitePurchaseValue: parseWebsitePurchaseValue(actionValues),
    results,
    resultType,
    attributionSetting: formatAttributionSetting(row.attribution_setting),
  };
}

export async function fetchMetaAccountSync(
  accessToken: string,
  accountId: string,
  dateRange: DateRange,
): Promise<{ metrics: MappedMetaMetric[]; campaigns: MetaCampaignObject[] }> {
  const [campaignsRaw, adsets, insightRows] = await Promise.all([
    fetchMetaCampaignObjects(accessToken, accountId),
    fetchMetaAdSetAttribution(accessToken, accountId),
    fetchMetaInsightRows(accessToken, accountId, dateRange),
  ]);
  const campaigns = mergeCampaignAttribution(campaignsRaw, adsets);
  const objectiveById = new Map(campaigns.map((c) => [c.platformCampaignId, c.objective]));
  const metrics = insightRows.map((row) =>
    mapInsightRow(row, row.campaign_id ? objectiveById.get(row.campaign_id) : null),
  );

  const settingFromInsights = new Map<string, string>();
  for (const metric of metrics) {
    if (metric.campaignId && metric.attributionSetting && !settingFromInsights.has(metric.campaignId)) {
      settingFromInsights.set(metric.campaignId, metric.attributionSetting);
    }
  }
  const campaignsWithInsightAttr = campaigns.map((campaign) => ({
    ...campaign,
    attributionSetting:
      campaign.attributionSetting ?? settingFromInsights.get(campaign.platformCampaignId) ?? null,
  }));

  return { metrics, campaigns: campaignsWithInsightAttr };
}
