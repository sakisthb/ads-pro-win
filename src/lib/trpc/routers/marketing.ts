// Marketing tRPC Router — Blended performance analytics across ad platforms
// Phase 4: Business Tools

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import { decrypt } from "@/lib/crypto";
import { logSecurityEvent } from "@/lib/security-events";
import { safeFetch } from "@/lib/safe-fetch";
import {
  currencyFromSettings,
  formatMoneyExact,
  type ReportingCurrency,
} from "@/lib/currency";
import {
  assembleFatiguePayload,
  buildFatigueAlertDrafts,
  catalogSignalFromMetaProducts,
  catalogSignalFromWooProducts,
  canonicalizeShopUrl,
  deliverySpanDays,
  emptyCatalogSignal,
  emptyFatiguePayload,
  emptyLandingProbe,
  emptyStoreSnapshot,
  extractHttpUrl,
  inferFormat,
  inferObjective,
  landingUrlsToProbe,
  looksLikeAdvantagePlus,
  looksLikeBotWall,
  looksLikeCatalogCreative,
  looksLikeLiquidTemplate,
  mergeCatalogSignals,
  mergeLandingWithCatalog,
  scoreDrafts,
  shopOrigin,
  wooStoreApiUrls,
  type FatigueAdDraft,
  type FatigueCoverage,
  type FatigueDailyPoint,
  type FatigueEconomics,
  type FatigueLandingProbe,
  type FatiguePlatform,
  type FatiguePlatformStatus,
  type FatigueStoreSnapshot,
  type WooCatalogSignal,
} from "@/lib/creative-fatigue";
import {
  ATC_ACTION_TYPES,
  CHECKOUT_ACTION_TYPES,
  LANDING_PAGE_ACTION_TYPES,
  META_GRAPH_VERSION,
  parseAction as parseMetaAction,
  parsePurchaseCount,
  parsePurchaseValue,
  rollupReachFrequency,
} from "@/lib/meta/actions";
import {
  assembleSiteSeo,
  emptySiteSeoReport,
  fetchSiteDoc,
  parseRobotsTxt,
  resolveBrandWebsite,
} from "@/lib/site-seo";
import { UNPAID_WOO_STATUS_LIST } from "@/lib/woo-orders";
import {
  dailyMetricPlatformWhere,
  PAID_AD_PLATFORMS,
  SITE_ANALYTICS_PLATFORM,
  SEARCH_CONSOLE_PLATFORM,
} from "@/lib/paid-ad-metrics";
import {
  MARKET_FILTER_SCHEMA,
  adDeskForName,
  type MarketFilter,
} from "@/lib/market-desk";
import { loadShopMarketMode } from "@/lib/shop-market-mode";
import {
  fetchGa4Realtime,
  isGa4GenerativeChannel,
  isGa4OrganicSearchChannel,
  isGa4PropertyReady,
  parseGa4PropertyId,
  rollupGa4DeskDays,
} from "@/lib/ga4";
import {
  GSC_QUERY_LOOKBACK_DAYS,
  GSC_SITE_TOTAL_CAMPAIGN_ID,
  collectGscQueries,
  gscPositionBands,
  isGscSiteTotalCampaignId,
  rollupGscQueries,
  rollupGscSiteDays,
} from "@/lib/gsc";
import { ensureFreshGoogleAccessToken } from "@/lib/oauth/google-refresh";
import {
  googleAdsLoginCustomerId,
  googleAdsSearchRows,
  parseGoogleAdsCustomerId,
} from "@/lib/google-ads-accounts";

const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ============================================================================
// Shared helpers
// ============================================================================

/** Convert a Prisma Decimal (or null) to a plain number for JSON serialization. */
function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return typeof value.toNumber === "function" ? value.toNumber() : Number(value);
}

function isPrismaMissingColumn(error: unknown, fragment: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; meta?: unknown; message?: string };
  if (err.code !== "P2022") return false;
  const blob = `${err.message ?? ""} ${JSON.stringify(err.meta ?? {})}`.toLowerCase();
  return blob.includes(fragment.toLowerCase());
}

/** Compute the percentage change between two metric values (guarding divide-by-zero). */
function pctChange(prev: number, next: number): number {
  if (prev === 0) return next === 0 ? 0 : 100;
  return ((next - prev) / Math.abs(prev)) * 100;
}

/** Parse a `YYYY-MM-DD` string into a Date at the start of that day (UTC). */
function startOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid date: ${dateStr} (expected YYYY-MM-DD)`,
    });
  }
  return d;
}

/** Parse a `YYYY-MM-DD` string into a Date at the end of that day (UTC). */
function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid date: ${dateStr} (expected YYYY-MM-DD)`,
    });
  }
  return d;
}

/** A single day's blended metrics. */
interface DailyBlended {
  date: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  totalReach: number;
  totalLinkClicks: number;
  totalLandingPageViews: number;
  totalAddToCart: number;
  totalCheckouts: number;
  blendedROAS: number;
  blendedCPC: number;
  blendedCPM: number;
  blendedCTR: number;
}

/** Aggregated blended metrics across a date range. */
interface BlendedMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  /** Sum of daily reach — not unique people. Campaign rows use impression-weighted rollup. */
  totalReach: number;
  totalLinkClicks: number;
  totalLandingPageViews: number;
  totalAddToCart: number;
  totalCheckouts: number;
  blendedROAS: number;
  blendedCPC: number;
  blendedCPM: number;
  blendedCTR: number;
}

/**
 * Build a Prisma `where` clause for DailyMetric that enforces organization
 * isolation via the Brand -> AdAccount -> DailyMetric join chain, optionally
 * narrowed to a single brand and/or platform.
 */
function buildDailyMetricWhere(args: {
  organizationId: string;
  startDate: string;
  endDate: string;
  brandId?: string;
  platform?: string;
}): Prisma.DailyMetricWhereInput {
  const { organizationId, startDate, endDate, brandId, platform } = args;
  return {
    date: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    ...dailyMetricPlatformWhere(platform),
    adAccount: {
      brand: {
        organizationId,
        ...(brandId ? { id: brandId } : {}),
      },
    },
  };
}

/** Verify that a brand belongs to the caller's organization. */
async function validateBrandAccess(
  prisma: PrismaClient,
  organizationId: string,
  brandId?: string,
): Promise<void> {
  if (!brandId) return;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, organizationId: true },
  });
  if (!brand || brand.organizationId !== organizationId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
  }
}

/** Aggregate blended metrics for a DailyMetric where clause. */
async function getBlendedMetrics(
  prisma: PrismaClient,
  where: Prisma.DailyMetricWhereInput,
): Promise<BlendedMetrics> {
  const sumWithoutReach = {
    spend: true,
    impressions: true,
    clicks: true,
    conversions: true,
    conversionValue: true,
    linkClicks: true,
    landingPageViews: true,
    addToCart: true,
    checkouts: true,
  } as const;
  let agg: {
    _sum: {
      spend: Prisma.Decimal | null;
      impressions: number | null;
      clicks: number | null;
      conversions: Prisma.Decimal | null;
      conversionValue: Prisma.Decimal | null;
      reach?: number | null;
      linkClicks: number | null;
      landingPageViews: number | null;
      addToCart: Prisma.Decimal | null;
      checkouts: Prisma.Decimal | null;
    };
  };
  try {
    agg = await prisma.dailyMetric.aggregate({
      where,
      _sum: { ...sumWithoutReach, reach: true },
    });
  } catch (error) {
    if (!isPrismaMissingColumn(error, "reach")) throw error;
    agg = await prisma.dailyMetric.aggregate({
      where,
      _sum: sumWithoutReach,
    });
  }

  const totalSpend = toNumber(agg._sum.spend);
  const totalImpressions = agg._sum.impressions ?? 0;
  const totalClicks = agg._sum.clicks ?? 0;
  const totalConversions = toNumber(agg._sum.conversions);
  const totalConversionValue = toNumber(agg._sum.conversionValue);

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    totalConversionValue,
    totalReach: agg._sum.reach ?? 0,
    totalLinkClicks: agg._sum.linkClicks ?? 0,
    totalLandingPageViews: agg._sum.landingPageViews ?? 0,
    totalAddToCart: toNumber(agg._sum.addToCart),
    totalCheckouts: toNumber(agg._sum.checkouts),
    blendedROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
    blendedCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
    blendedCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    blendedCTR:
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  };
}

/** Build a per-day blended timeseries for a DailyMetric where clause. */
async function getBlendedTimeseries(
  prisma: PrismaClient,
  where: Prisma.DailyMetricWhereInput,
): Promise<DailyBlended[]> {
  const sumWithoutReach = {
    spend: true,
    impressions: true,
    clicks: true,
    conversions: true,
    conversionValue: true,
    linkClicks: true,
    landingPageViews: true,
    addToCart: true,
    checkouts: true,
  } as const;
  let grouped: Array<{
    date: Date;
    _sum: {
      spend: Prisma.Decimal | null;
      impressions: number | null;
      clicks: number | null;
      conversions: Prisma.Decimal | null;
      conversionValue: Prisma.Decimal | null;
      reach?: number | null;
      linkClicks: number | null;
      landingPageViews: number | null;
      addToCart: Prisma.Decimal | null;
      checkouts: Prisma.Decimal | null;
    };
  }>;
  try {
    grouped = (await prisma.dailyMetric.groupBy({
      by: ["date"],
      where,
      _sum: { ...sumWithoutReach, reach: true },
      orderBy: { date: "asc" },
    })) as unknown as typeof grouped;
  } catch (error) {
    if (!isPrismaMissingColumn(error, "reach")) throw error;
    grouped = (await prisma.dailyMetric.groupBy({
      by: ["date"],
      where,
      _sum: sumWithoutReach,
      orderBy: { date: "asc" },
    })) as unknown as typeof grouped;
  }

  return grouped.map((day) => {
    const totalSpend = toNumber(day._sum.spend);
    const totalImpressions = day._sum.impressions ?? 0;
    const totalClicks = day._sum.clicks ?? 0;
    const totalConversions = toNumber(day._sum.conversions);
    const totalConversionValue = toNumber(day._sum.conversionValue);
    return {
      date: day.date instanceof Date ? day.date.toISOString().slice(0, 10) : String(day.date),
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalConversionValue,
      totalReach: day._sum.reach ?? 0,
      totalLinkClicks: day._sum.linkClicks ?? 0,
      totalLandingPageViews: day._sum.landingPageViews ?? 0,
      totalAddToCart: toNumber(day._sum.addToCart),
      totalCheckouts: toNumber(day._sum.checkouts),
      blendedROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
      blendedCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
      blendedCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    };
  });
}

async function getBlendedForMarket(
  prisma: PrismaClient,
  where: Prisma.DailyMetricWhereInput,
  mode: Awaited<ReturnType<typeof loadShopMarketMode>>,
  filter: MarketFilter,
): Promise<{ totals: BlendedMetrics; timeseries: DailyBlended[] }> {
  if (filter === "all") {
    const [totals, timeseries] = await Promise.all([
      getBlendedMetrics(prisma, where),
      getBlendedTimeseries(prisma, where),
    ]);
    return { totals, timeseries };
  }
  const grouped = await prisma.dailyMetric.groupBy({
    by: ["date", "campaignName"],
    where,
    _sum: {
      spend: true,
      impressions: true,
      clicks: true,
      conversions: true,
      conversionValue: true,
      linkClicks: true,
      landingPageViews: true,
      addToCart: true,
      checkouts: true,
    },
    orderBy: { date: "asc" },
  });
  const kept = grouped.filter((row) => adDeskForName(row.campaignName, mode) === filter);
  const byDate = new Map<string, DailyBlended>();
  const totalsAcc = {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalConversionValue: 0,
    totalReach: 0,
    totalLinkClicks: 0,
    totalLandingPageViews: 0,
    totalAddToCart: 0,
    totalCheckouts: 0,
  };
  for (const row of kept) {
    const date =
      row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    const spend = toNumber(row._sum.spend);
    const impressions = row._sum.impressions ?? 0;
    const clicks = row._sum.clicks ?? 0;
    const conversions = toNumber(row._sum.conversions);
    const conversionValue = toNumber(row._sum.conversionValue);
    totalsAcc.totalSpend += spend;
    totalsAcc.totalImpressions += impressions;
    totalsAcc.totalClicks += clicks;
    totalsAcc.totalConversions += conversions;
    totalsAcc.totalConversionValue += conversionValue;
    totalsAcc.totalLinkClicks += row._sum.linkClicks ?? 0;
    totalsAcc.totalLandingPageViews += row._sum.landingPageViews ?? 0;
    totalsAcc.totalAddToCart += toNumber(row._sum.addToCart);
    totalsAcc.totalCheckouts += toNumber(row._sum.checkouts);
    const prev = byDate.get(date);
    if (prev) {
      prev.totalSpend += spend;
      prev.totalImpressions += impressions;
      prev.totalClicks += clicks;
      prev.totalConversions += conversions;
      prev.totalConversionValue += conversionValue;
    } else {
      byDate.set(date, {
        date,
        totalSpend: spend,
        totalImpressions: impressions,
        totalClicks: clicks,
        totalConversions: conversions,
        totalConversionValue: conversionValue,
        totalReach: 0,
        totalLinkClicks: row._sum.linkClicks ?? 0,
        totalLandingPageViews: row._sum.landingPageViews ?? 0,
        totalAddToCart: toNumber(row._sum.addToCart),
        totalCheckouts: toNumber(row._sum.checkouts),
        blendedROAS: 0,
        blendedCPC: 0,
        blendedCPM: 0,
        blendedCTR: 0,
      });
    }
  }
  const timeseries = [...byDate.values()].map((day) => ({
    ...day,
    blendedROAS: day.totalSpend > 0 ? day.totalConversionValue / day.totalSpend : 0,
    blendedCPC: day.totalClicks > 0 ? day.totalSpend / day.totalClicks : 0,
    blendedCPM: day.totalImpressions > 0 ? (day.totalSpend / day.totalImpressions) * 1000 : 0,
    blendedCTR: day.totalImpressions > 0 ? (day.totalClicks / day.totalImpressions) * 100 : 0,
  }));
  const totals: BlendedMetrics = {
    ...totalsAcc,
    blendedROAS: totalsAcc.totalSpend > 0 ? totalsAcc.totalConversionValue / totalsAcc.totalSpend : 0,
    blendedCPC: totalsAcc.totalClicks > 0 ? totalsAcc.totalSpend / totalsAcc.totalClicks : 0,
    blendedCPM:
      totalsAcc.totalImpressions > 0
        ? (totalsAcc.totalSpend / totalsAcc.totalImpressions) * 1000
        : 0,
    blendedCTR:
      totalsAcc.totalImpressions > 0
        ? (totalsAcc.totalClicks / totalsAcc.totalImpressions) * 100
        : 0,
  };
  return { totals, timeseries };
}

// ============================================================================
// Live Meta Graph API helpers
// ============================================================================

/** ISO `YYYY-MM-DD` date string, regex-validated. */
const metaDateRangeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be an ISO YYYY-MM-DD date"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be an ISO YYYY-MM-DD date"),
  brandId: z.string().min(1).optional(),
});

/** Resolve the caller's organization's first active Meta ad account with a
 * stored (encrypted) access token; returns the account plus the decrypted
 * token, or `null` when no connected account exists. */
async function resolveMetaAccount(
  ctx: {
    prisma: PrismaClient;
    organizationId: string;
  },
  brandId?: string,
) {
  const account = await ctx.prisma.adAccount.findFirst({
    where: {
      ...(brandId ? { brandId } : {}),
      brand: { organizationId: ctx.organizationId },
      platform: "meta",
      isActive: true,
      accessToken: { not: null },
    },
    include: { brand: true },
  });
  if (!account || !account.accessToken) return null;
  try {
    return { account, accessToken: decrypt(account.accessToken) };
  } catch (error) {
    logSecurityEvent("oauth_failure", "error", {
      code: "token_decrypt_failed",
      platform: "meta",
      organizationId: ctx.organizationId,
      adAccountId: account.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** A single Graph API action entry (e.g. inside `actions`). */
interface MetaGraphAction {
  action_type: string;
  value: string;
}

/** An insights row from a breakdown query (age, gender, geo, platform,
 * device, frequency_value). */
interface MetaGraphBreakdownRow {
  age?: string;
  gender?: string;
  country?: string;
  region?: string;
  publisher_platform?: string;
  device_platform?: string;
  impression_device?: string;
  frequency_value?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaGraphAction[];
}

/** Breakdown row keys usable as bucket labels. */
type MetaBreakdownLabelKey =
  | "age"
  | "gender"
  | "country"
  | "region"
  | "publisher_platform"
  | "device_platform"
  | "impression_device";

/** An insights row at ad level (creative fatigue query). */
interface MetaGraphAdRow {
  id?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  date_start?: string;
  frequency?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  spend?: string;
  actions?: MetaGraphAction[];
  action_values?: MetaGraphAction[];
  video_avg_time_watched_actions?: MetaGraphAction[];
}

/** An insights row at ad set level (bid suggestion query). */
interface MetaGraphAdSetRow {
  id: string;
  adset_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaGraphAction[];
  ctr?: string;
  frequency?: string;
}

/** An ad object fetched via the batch endpoint (creative fatigue enrichment). */
interface MetaGraphAdObject {
  id: string;
  name?: string;
  created_time?: string;
  campaign?: { id?: string; name?: string; objective?: string };
  adset?: { id?: string; name?: string; optimization_goal?: string; daily_budget?: string; promoted_object?: { product_catalog_id?: string; product_set_id?: string } };
  creative?: {
    image_url?: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
    object_type?: string;
    video_id?: string;
    link_url?: string;
    template_url?: string;
    object_story_spec?: {
      link_data?: { link?: string };
      video_data?: { call_to_action?: { value?: { link?: string } } };
      template_data?: { link?: string };
    };
    product_set_id?: string;
  };
}

/** Fields validated live against the Graph API for ad-object enrichment.
 * (`adset_name` is not a top-level ad field — it must be expanded via
 * `adset{id,name}`; the GET root-`ids` endpoint is deprecated, so the POST
 * batch mechanism is used instead.) */
const META_AD_OBJECT_FIELDS =
  "name,created_time,campaign{id,name,objective},adset{id,name,optimization_goal,daily_budget,promoted_object},creative{image_url,thumbnail_url,title,body,object_type,video_id,link_url,template_url,product_set_id,object_story_spec}";

/**
 * Batch-fetch ad objects (creative metadata + parent ad set) for the given ad
 * ids using the Graph API POST batch endpoint (max 50 ops per request).
 * Per-id errors are skipped gracefully; a transport failure on one chunk does
 * not abort the others. Returns a Map keyed by ad id.
 */
async function fetchMetaAdObjects(
  accessToken: string,
  adIds: string[],
): Promise<Map<string, MetaGraphAdObject>> {
  const result = new Map<string, MetaGraphAdObject>();
  if (adIds.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < adIds.length; i += 50) {
    chunks.push(adIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const batch = chunk.map((id) => ({
        method: "GET",
        relative_url: `${id}?fields=${encodeURIComponent(META_AD_OBJECT_FIELDS)}`,
      }));
      const form = new URLSearchParams();
      form.set("access_token", accessToken);
      form.set("batch", JSON.stringify(batch));

      const res = await safeFetch(`${META_GRAPH}/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const body = (await res.json().catch(() => null)) as
        | Array<{ code?: number; body?: string } | null>
        | null;
      if (!res.ok || !Array.isArray(body)) continue;

      for (const op of body) {
        if (!op?.body) continue;
        let parsed: MetaGraphAdObject & { error?: unknown } | null = null;
        try {
          parsed = JSON.parse(op.body);
        } catch {
          continue;
        }
        // Skip per-id errors (e.g. permission or deleted objects) gracefully.
        if (!parsed || parsed.error || !parsed.id) continue;
        result.set(parsed.id, parsed);
      }
    } catch (error) {
      // Degrade gracefully: enrichment is best-effort, fatigue rows still return.
      console.error("fetchMetaAdObjects chunk error:", error);
    }
  }
  return result;
}

/**
 * Call `act_{accountId}/insights` on Graph API with the given query
 * params. Throws an Error carrying the Meta error message on failure.
 */
async function fetchMetaInsights(
  accessToken: string,
  accountId: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const all: Record<string, unknown>[] = [];
  let next: string | null = url.toString();
  let pages = 0;
  while (next && pages < 15) {
    const res = await safeFetch(next);
    const body = (await res.json().catch(() => null)) as {
      data?: Record<string, unknown>[];
      error?: { message?: string };
      paging?: { next?: string };
    } | null;

    if (!res.ok) {
      throw new Error(body?.error?.message ?? `Meta API error (${res.status})`);
    }
    all.push(...(body?.data ?? []));
    next = body?.paging?.next ?? null;
    pages += 1;
  }
  return all;
}

/** Try preferred Graph fields, then a known-good fallback, then empty.
 * Lets funnel/audiences ask for clicks+purchases on hourly/device without
 * 500ing the whole breakdown when Meta rejects the richer field set. */
async function fetchMetaInsightsPrefer(
  accessToken: string,
  accountId: string,
  preferred: Record<string, string>,
  fallback: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchMetaInsights(accessToken, accountId, preferred);
  } catch (error) {
    console.error("fetchMetaInsights preferred fields failed, retrying fallback:", error);
    try {
      return await fetchMetaInsights(accessToken, accountId, fallback);
    } catch (fallbackError) {
      console.error("fetchMetaInsights fallback failed:", fallbackError);
      return [];
    }
  }
}

/** Aggregate breakdown rows into labeled buckets, skipping unknown/empty
 * labels, sorted by spend descending. `labelKey` selects the row field that
 * carries the bucket label (row keys equal the breakdown name). */
function aggregateBreakdownRows(
  rows: MetaGraphBreakdownRow[],
  labelKey: MetaBreakdownLabelKey,
) {
  return rows
    .map((r) => {
      const label = (r[labelKey] ?? "").trim();
      return {
        label,
        spend: parseFloat(r.spend ?? "0"),
        impressions: parseInt(r.impressions ?? "0", 10),
        clicks: parseInt(r.clicks ?? "0", 10),
        conversions: parsePurchaseActions(r.actions),
        reach: parseInt(r.reach ?? "0", 10),
        frequency: parseFloat(r.frequency ?? "0"),
      };
    })
    .filter((b) => b.label !== "" && b.label.toLowerCase() !== "unknown")
    .sort((a, b) => b.spend - a.spend);
}

/** Aggregate hourly breakdown rows into {hour, spend, impressions, clicks,
 * conversions} buckets. Row values look like "00:00:00 - 00:59:59"; the
 * leading "HH" is the bucket key. Sorted ascending by hour. Clicks and
 * purchases are 0 when Graph omitted those fields. */
function aggregateHourlyRows(rows: MetaGraphBreakdownRow[]) {
  return rows
    .map((r) => {
      const hour = (r.hourly_stats_aggregated_by_advertiser_time_zone ?? "")
        .trim()
        .slice(0, 2);
      return {
        hour,
        spend: parseFloat(r.spend ?? "0"),
        impressions: parseInt(r.impressions ?? "0", 10),
        clicks: parseInt(r.clicks ?? "0", 10),
        conversions: parsePurchaseActions(r.actions),
      };
    })
    .filter((b) => /^\d{2}$/.test(b.hour))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

/** Parse age × gender combination breakdown rows into typed metrics,
 * dropping rows with an unknown/empty gender label. */
function parseAgeGenderRows(rows: MetaGraphBreakdownRow[]) {
  return rows
    .map((r) => ({
      age: (r.age ?? "").trim(),
      gender: (r.gender ?? "").trim(),
      spend: parseFloat(r.spend ?? "0"),
      impressions: parseInt(r.impressions ?? "0", 10),
      reach: parseInt(r.reach ?? "0", 10),
      frequency: parseFloat(r.frequency ?? "0"),
    }))
    .filter(
      (r) =>
        r.age !== "" && r.gender !== "" && r.gender.toLowerCase() !== "unknown",
    );
}

/** Numeric start of a frequency_value bucket label ("1" → 1, "6-10" → 6,
 * "21+" → 21). Non-numeric labels sort last. */
function frequencyBucketStart(bucket: string): number {
  const match = /^(\d+)/.exec(bucket);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

/** Parse frequency_value breakdown rows into {bucket, reach} pairs sorted by
 * the bucket's numeric start. (Meta only returns reach for this breakdown.) */
function parseFrequencyReachRows(rows: MetaGraphBreakdownRow[]) {
  return rows
    .map((r) => ({
      bucket: (r.frequency_value ?? "").trim(),
      reach: parseInt(r.reach ?? "0", 10),
    }))
    .filter((b) => b.bucket !== "")
    .sort(
      (a, b) => frequencyBucketStart(a.bucket) - frequencyBucketStart(b.bucket),
    );
}

/** Parse publisher_platform × impression_device breakdown rows into typed
 * combos, sorted by spend descending and capped at the top 12. */
function parsePlatformDeviceRows(rows: MetaGraphBreakdownRow[]) {
  return rows
    .map((r) => ({
      platform: (r.publisher_platform ?? "").trim(),
      device: (r.impression_device ?? "").trim(),
      spend: parseFloat(r.spend ?? "0"),
      impressions: parseInt(r.impressions ?? "0", 10),
    }))
    .filter((r) => r.platform !== "" && r.device !== "")
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 12);
}

function parseNum(value: string | undefined, asInt = false): number {
  if (!value) return 0;
  return asInt ? parseInt(value, 10) || 0 : parseFloat(value) || 0;
}

function parseAction(actions: MetaGraphAction[] | undefined, types: readonly string[]): number {
  return parseMetaAction(actions, types);
}

function parsePurchaseActions(actions: MetaGraphAction[] | undefined): number {
  return parsePurchaseCount(actions);
}

const EMPTY_PIXEL_EVENTS = {
  landingPageViews: 0,
  addToCart: 0,
  checkouts: 0,
};

/** Sum landing / ATC / checkout pixel events from account-level insights rows. */
function sumPixelEvents(rows: MetaGraphBreakdownRow[]) {
  return rows.reduce(
    (acc, r) => ({
      landingPageViews:
        acc.landingPageViews +
        parseAction(r.actions, LANDING_PAGE_ACTION_TYPES),
      addToCart:
        acc.addToCart +
        parseAction(r.actions, ATC_ACTION_TYPES),
      checkouts:
        acc.checkouts +
        parseAction(r.actions, CHECKOUT_ACTION_TYPES),
    }),
    { ...EMPTY_PIXEL_EVENTS },
  );
}

function destinationFromCreative(
  creative: MetaGraphAdObject["creative"] | undefined,
): string | null {
  if (!creative) return null;
  const spec = creative.object_story_spec;
  return (
    extractHttpUrl(creative.link_url) ??
    extractHttpUrl(spec?.link_data?.link) ??
    extractHttpUrl(spec?.video_data?.call_to_action?.value?.link) ??
    extractHttpUrl(spec?.template_data?.link) ??
    extractHttpUrl(creative.template_url)
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

function titleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, " ").trim().slice(0, 180);
}

async function probeLandingPages(urls: string[]): Promise<FatigueLandingProbe> {
  const unique = urls.filter((url) => Boolean(extractHttpUrl(url))).slice(0, 3);
  if (unique.length === 0) return emptyLandingProbe();

  const pages = await Promise.all(
    unique.map(async (url) => {
      try {
        const res = await safeFetch(url, {
          timeoutMs: 4500,
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          },
        });
        const html = await res.text();
        const text = htmlToText(html);
        const blocked = looksLikeBotWall(text) || looksLikeLiquidTemplate(url);
        return {
          url,
          fetched: res.ok && !blocked && text.length > 80,
          title: titleFromHtml(html),
          text,
        };
      } catch {
        return { url, fetched: false, title: null, text: "" };
      }
    }),
  );

  const ok = pages.filter((page) => page.fetched);
  if (ok.length === 0) {
    return {
      url: pages[0]?.url ?? unique[0] ?? null,
      fetched: false,
      title: pages[0]?.title ?? null,
      text: "",
    };
  }
  return {
    url: ok[0].url,
    fetched: true,
    title: ok[0].title,
    text: ok.map((page) => page.text).join("\n"),
    source: "html",
  };
}

async function probeWooCatalog(website: string | null): Promise<WooCatalogSignal> {
  const urls = wooStoreApiUrls(website);
  if (urls.length === 0) return emptyCatalogSignal();
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await safeFetch(url, {
          timeoutMs: 4500,
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          },
        });
        if (!res.ok) return { ...emptyCatalogSignal(), attempted: true };
        const json: unknown = await res.json().catch(() => null);
        return catalogSignalFromWooProducts(json, url);
      } catch {
        return { ...emptyCatalogSignal(), attempted: true };
      }
    }),
  );
  return mergeCatalogSignals(pages);
}

async function fetchGraphJson(
  url: string,
): Promise<{
  data?: unknown[];
  paging?: { next?: string };
  product_catalog_id?: string;
  business?: { id?: string };
} | null> {
  const res = await safeFetch(url, { timeoutMs: 8000 });
  const body = (await res.json().catch(() => null)) as {
    data?: unknown[];
    paging?: { next?: string };
    product_catalog_id?: string;
    business?: { id?: string };
    error?: { message?: string };
  } | null;
  if (!res.ok || !body || body.error) return null;
  return body;
}

function catalogIdsFromGraph(body: { data?: unknown[] } | null): string[] {
  const ids: string[] = [];
  for (const row of body?.data ?? []) {
    if (row && typeof row === "object" && "id" in row && typeof (row as { id?: unknown }).id === "string") {
      ids.push((row as { id: string }).id);
    }
  }
  return ids;
}

async function fetchGraphProductPages(
  startUrl: string,
  website: string | null,
  publicUrl: string | null,
): Promise<WooCatalogSignal> {
  const products: unknown[] = [];
  let next: string | null = startUrl;
  let pages = 0;
  while (next && pages < 3) {
    const body = await fetchGraphJson(next);
    if (!body) break;
    products.push(...(body.data ?? []));
    next = body.paging?.next ?? null;
    pages += 1;
  }
  return catalogSignalFromMetaProducts(products, website, publicUrl);
}

async function listAdAccountCatalogIds(
  accessToken: string,
  accountId: string,
): Promise<string[]> {
  const actId = accountId.replace(/^act_/i, "");
  const token = `access_token=${encodeURIComponent(accessToken)}`;
  const ids = new Set<string>();
  for (const edge of ["owned_product_catalogs", "assigned_product_catalogs"] as const) {
    const body = await fetchGraphJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${actId}/${edge}?fields=id,name,product_count&limit=10&${token}`,
    );
    for (const id of catalogIdsFromGraph(body)) ids.add(id);
  }
  if (ids.size > 0) return [...ids];
  const act = await fetchGraphJson(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${actId}?fields=business{id}&${token}`,
  );
  const businessId = act?.business?.id;
  if (!businessId) return [];
  for (const edge of ["owned_product_catalogs", "client_product_catalogs"] as const) {
    const body = await fetchGraphJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/${edge}?fields=id,name,product_count&limit=10&${token}`,
    );
    for (const id of catalogIdsFromGraph(body)) ids.add(id);
  }
  return [...ids];
}

async function fetchMetaCatalogSignal(
  accessToken: string,
  accountId: string,
  website: string | null,
  knownCatalogIds: string[],
  knownProductSetIds: string[] = [],
): Promise<WooCatalogSignal> {
  const token = `access_token=${encodeURIComponent(accessToken)}`;
  const fields = "id,name,price,sale_price,url,availability";
  const shop = shopOrigin(website);
  const publicUrl = shop ? `${shop}/` : null;
  const parts: WooCatalogSignal[] = [];
  const seenCatalogs = new Set<string>();
  let attempted = knownCatalogIds.length > 0 || knownProductSetIds.length > 0;

  const pullProducts = async (nodeId: string) => {
    attempted = true;
    parts.push(
      await fetchGraphProductPages(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${nodeId}/products?fields=${fields}&limit=50&${token}`,
        website,
        publicUrl,
      ),
    );
  };

  for (const setId of knownProductSetIds.slice(0, 3)) {
    const meta = await fetchGraphJson(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${setId}?fields=id,product_catalog_id,product_count&${token}`,
    );
    if (typeof meta?.product_catalog_id === "string") {
      knownCatalogIds = [...knownCatalogIds, meta.product_catalog_id];
    }
    await pullProducts(setId);
  }

  if (mergeCatalogSignals(parts).sampleCount === 0) {
    for (const catalogId of knownCatalogIds) {
      if (seenCatalogs.has(catalogId)) continue;
      seenCatalogs.add(catalogId);
      await pullProducts(catalogId);
    }
  }

  const early = mergeCatalogSignals(parts);
  if (early.sampleCount === 0) {
    for (const catalogId of await listAdAccountCatalogIds(accessToken, accountId)) {
      if (seenCatalogs.has(catalogId)) continue;
      if (seenCatalogs.size >= 3) break;
      seenCatalogs.add(catalogId);
      await pullProducts(catalogId);
    }
  }

  const merged = mergeCatalogSignals(parts);
  return {
    ...merged,
    attempted: attempted || merged.attempted || merged.sampleCount > 0,
    url: merged.url ?? publicUrl,
  };
}

function parseAvgWatch(actions?: MetaGraphAction[]): number | null {
  const raw = parseFloat(actions?.[0]?.value ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw > 120 ? raw / 1000 : raw;
}

function daysLiveFromCreated(
  created: string | undefined,
  endDate: string,
  fallbackDaily: string | undefined,
): number {
  const start = (created ?? fallbackDaily ?? endDate).slice(0, 10);
  const a = Date.parse(`${start}T00:00:00.000Z`);
  const b = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

async function resolvePlatformAccount(
  ctx: { prisma: PrismaClient; organizationId: string },
  platform: FatiguePlatform,
  brandId?: string,
) {
  const account = await ctx.prisma.adAccount.findFirst({
    where: {
      ...(brandId ? { brandId } : {}),
      brand: { organizationId: ctx.organizationId },
      platform,
      isActive: true,
      accessToken: { not: null },
      NOT: { accountId: { contains: "placeholder" } },
    },
    include: { brand: true },
  });
  if (!account?.accessToken) return null;
  if (/^demo-|act_demo_|act_sacos_/i.test(account.accountId)) return null;
  try {
    return { account, accessToken: decrypt(account.accessToken) };
  } catch (error) {
    logSecurityEvent("oauth_failure", "error", {
      code: "token_decrypt_failed",
      platform,
      organizationId: ctx.organizationId,
      adAccountId: account.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function groupDailyByAd(rows: MetaGraphAdRow[]): Map<string, FatigueDailyPoint[]> {
  const map = new Map<string, Map<string, FatigueDailyPoint>>();
  for (const r of rows) {
    const adId = r.ad_id || r.id;
    const date = r.date_start;
    if (!adId || !date) continue;
    const impressions = parseNum(r.impressions, true);
    const clicks = parseNum(r.clicks, true);
    const conversions = parsePurchaseActions(r.actions);
    const point: FatigueDailyPoint = {
      date,
      impressions,
      clicks,
      conversions,
      spend: parseNum(r.spend),
      frequency: parseNum(r.frequency),
      ctr: parseNum(r.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
    };
    const days = map.get(adId) ?? new Map<string, FatigueDailyPoint>();
    const existing = days.get(date);
    if (existing) {
      existing.impressions += point.impressions;
      existing.clicks += point.clicks;
      existing.conversions += point.conversions;
      existing.spend += point.spend;
      existing.frequency = Math.max(existing.frequency, point.frequency);
      existing.ctr =
        existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
    } else {
      days.set(date, point);
    }
    map.set(adId, days);
  }
  const out = new Map<string, FatigueDailyPoint[]>();
  for (const [adId, days] of map) {
    out.set(adId, [...days.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return out;
}

async function fetchMetaAccountSpend(
  accessToken: string,
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<number | null> {
  try {
    const rows = await fetchMetaInsights(accessToken, accountId, {
      fields: "spend",
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      limit: "1",
    });
    const spend = parseNum(rows[0]?.spend as string | undefined);
    return Number.isFinite(spend) ? spend : null;
  } catch {
    return null;
  }
}

async function fetchMetaFatigueDrafts(
  accessToken: string,
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<{
  drafts: FatigueAdDraft[];
  accountSpend: number | null;
  catalogIds: string[];
  productSetIds: string[];
}> {
  const timeRange = JSON.stringify({ since: startDate, until: endDate });
  const periodFieldsVideo =
    "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,frequency,impressions,reach,clicks,ctr,spend,actions,action_values,video_avg_time_watched_actions";
  const periodFieldsBasic =
    "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,frequency,impressions,reach,clicks,ctr,spend,actions,action_values";

  const periodFieldsLegacy =
    "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,frequency,impressions,reach,clicks,ctr,spend,actions";

  const loadPeriod = (fields: string, withFilter: boolean) =>
    fetchMetaInsights(accessToken, accountId, {
      level: "ad",
      fields,
      time_range: timeRange,
      ...(withFilter
        ? {
            filtering: JSON.stringify([
              { field: "impressions", operator: "GREATER_THAN", value: "0" },
            ]),
          }
        : {}),
      limit: "200",
    }) as Promise<unknown> as Promise<MetaGraphAdRow[]>;

  let periodRows: MetaGraphAdRow[] = [];
  try {
    periodRows = await loadPeriod(periodFieldsVideo, true);
  } catch {
    try {
      periodRows = await loadPeriod(periodFieldsBasic, true);
    } catch {
      try {
        periodRows = await loadPeriod(periodFieldsBasic, false);
      } catch {
        periodRows = await loadPeriod(periodFieldsLegacy, false);
      }
    }
  }

  let dailyRows: MetaGraphAdRow[] = [];
  try {
    dailyRows = (await fetchMetaInsights(accessToken, accountId, {
      level: "ad",
      fields:
        "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,frequency,reach,actions",
      time_range: timeRange,
      time_increment: "1",
      limit: "500",
    })) as unknown as MetaGraphAdRow[];
  } catch (error) {
    console.error("Meta daily fatigue insights failed:", error);
  }

  const accountSpend = await fetchMetaAccountSpend(
    accessToken,
    accountId,
    startDate,
    endDate,
  );

  const dailyByAd = groupDailyByAd(dailyRows);
  const labelByAd = new Map<
    string,
    {
      adName: string;
      campaignId: string;
      campaignName: string;
      adsetId: string;
      adsetName: string;
    }
  >();
  for (const r of [...periodRows, ...dailyRows]) {
    const id = r.ad_id || r.id;
    if (!id) continue;
    const existing = labelByAd.get(id);
    if (existing?.campaignName) continue;
    labelByAd.set(id, {
      adName: r.ad_name ?? existing?.adName ?? "Unknown ad",
      campaignId: r.campaign_id ?? existing?.campaignId ?? "",
      campaignName: r.campaign_name ?? existing?.campaignName ?? "",
      adsetId: r.adset_id ?? existing?.adsetId ?? "",
      adsetName: r.adset_name ?? existing?.adsetName ?? "Unassigned",
    });
  }

  const adIds = [...new Set([...periodRows.map((r) => r.ad_id || r.id), ...dailyByAd.keys()])].filter(
    (id): id is string => Boolean(id),
  );
  const adObjects = await fetchMetaAdObjects(accessToken, adIds);

  const drafts: FatigueAdDraft[] = [];
  const catalogIds = new Set<string>();
  const productSetIds = new Set<string>();
  const pushDraft = (r: {
    adId: string;
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    frequency: number;
    conversions: number;
    reach: number;
    daily: FatigueDailyPoint[];
    watch?: MetaGraphAction[] | undefined;
    landingPageViews?: number;
    addToCart?: number;
    checkouts?: number;
    conversionValue?: number;
  }) => {
    const obj = adObjects.get(r.adId);
    const labels = labelByAd.get(r.adId);
    const adName = labels?.adName ?? obj?.name ?? "Unknown ad";
    const campaignName = labels?.campaignName ?? obj?.campaign?.name ?? "";
    const adsetName = labels?.adsetName ?? obj?.adset?.name ?? "Unassigned";
    const title = obj?.creative?.title ?? adName;
    const body = obj?.creative?.body ?? null;
    const catalogTemplate = looksLikeCatalogCreative(title, adName, campaignName, adsetName);
    const firstDay = r.daily[0]?.date;
    const objectAgeDays = daysLiveFromCreated(obj?.created_time, endDate, firstDay);
    const span = r.daily.length > 0 ? deliverySpanDays(r.daily, endDate) : objectAgeDays;
    const daysLive =
      catalogTemplate && objectAgeDays > span + 7 ? Math.max(1, span) : objectAgeDays;
    const hasVideo = Boolean(obj?.creative?.video_id);
    const format = inferFormat({
      objectType: obj?.creative?.object_type,
      name: `${title} ${adName}`,
      body,
      hasVideo,
    });
    drafts.push({
      adId: r.adId,
      adName,
      platform: "meta",
      campaignId: labels?.campaignId ?? obj?.campaign?.id ?? "",
      campaignName,
      adsetId: labels?.adsetId ?? obj?.adset?.id ?? "",
      adsetName,
      creativeTitle: title,
      creativeBody: body,
      creativeImageUrl: obj?.creative?.thumbnail_url ?? obj?.creative?.image_url ?? null,
      format,
      objective: inferObjective(
        campaignName,
        adsetName,
        obj?.campaign?.objective,
        obj?.adset?.optimization_goal,
      ),
      spend: r.spend,
      impressions: r.impressions,
      reach: r.reach,
      clicks: r.clicks,
      ctr: r.ctr,
      frequency: r.frequency,
      conversions: r.conversions,
      daysLive,
      avgWatchSeconds: format === "video" ? parseAvgWatch(r.watch) : null,
      accountId,
      catalogTemplate,
      advantagePlus: looksLikeAdvantagePlus(campaignName, adsetName),
      objectAgeDays,
      landingPageViews: r.landingPageViews ?? 0,
      addToCart: r.addToCart ?? 0,
      checkouts: r.checkouts ?? 0,
      conversionValue: r.conversionValue ?? 0,
      destinationUrl: canonicalizeShopUrl(destinationFromCreative(obj?.creative)),
      daily: r.daily,
    });
    const catalogId = obj?.adset?.promoted_object?.product_catalog_id;
    if (catalogId) catalogIds.add(catalogId);
    const setId = obj?.adset?.promoted_object?.product_set_id ?? obj?.creative?.product_set_id;
    if (setId) productSetIds.add(setId);
  };

  const seen = new Set<string>();
  for (const r of periodRows) {
    const adId = r.ad_id || r.id;
    if (!adId) continue;
    const impressions = parseNum(r.impressions, true);
    const clicks = parseNum(r.clicks, true);
    const conversions = parsePurchaseActions(r.actions);
    pushDraft({
      adId,
      impressions,
      clicks,
      ctr: parseNum(r.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
      spend: parseNum(r.spend),
      frequency: parseNum(r.frequency),
      conversions,
      reach: parseNum(r.reach, true),
      daily: dailyByAd.get(adId) ?? [],
      watch: r.video_avg_time_watched_actions,
      landingPageViews: parseAction(r.actions, LANDING_PAGE_ACTION_TYPES),
      addToCart: parseAction(r.actions, ATC_ACTION_TYPES),
      checkouts: parseAction(r.actions, CHECKOUT_ACTION_TYPES),
      conversionValue: parsePurchaseValue(r.action_values),
    });
    seen.add(adId);
  }

  for (const [adId, daily] of dailyByAd) {
    if (seen.has(adId)) continue;
    const impressions = daily.reduce((s, p) => s + p.impressions, 0);
    if (impressions <= 0) continue;
    const clicks = daily.reduce((s, p) => s + p.clicks, 0);
    const spend = daily.reduce((s, p) => s + p.spend, 0);
    const conversions = daily.reduce((s, p) => s + p.conversions, 0);
    pushDraft({
      adId,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      spend,
      frequency: Math.max(0, ...daily.map((p) => p.frequency)),
      conversions,
      reach: 0,
      daily,
    });
  }

  return { drafts, accountSpend, catalogIds: [...catalogIds], productSetIds: [...productSetIds] };
}

async function fetchGoogleFatigueDrafts(
  accessToken: string,
  customerId: string,
  startDate: string,
  endDate: string,
): Promise<FatigueAdDraft[]> {
  const cid = parseGoogleAdsCustomerId(customerId);
  if (!cid) return [];

  const query = `
    SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
           ad_group.id, ad_group.name, campaign.id, campaign.name,
           metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros,
           metrics.conversions, segments.date
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group_ad.status != 'REMOVED'
      AND metrics.impressions > 0
  `.trim();

  type GoogleFatigueRow = {
    adGroupAd?: { ad?: { id?: string; name?: string; type?: string } };
    adGroup?: { id?: string; name?: string };
    campaign?: { id?: string; name?: string };
    metrics?: {
      impressions?: string;
      clicks?: string;
      ctr?: string;
      costMicros?: string;
      conversions?: string;
    };
    segments?: { date?: string };
  };

  const results = await googleAdsSearchRows<GoogleFatigueRow>(
    accessToken,
    cid,
    query,
    googleAdsLoginCustomerId(customerId),
  );

  const byAd = new Map<string, FatigueAdDraft>();
  for (const row of results) {
      const adId = row.adGroupAd?.ad?.id;
      if (!adId) continue;
      const impressions = parseNum(row.metrics?.impressions, true);
      const clicks = parseNum(row.metrics?.clicks, true);
      const spend = parseNum(row.metrics?.costMicros) / 1_000_000;
      const conversions = parseNum(row.metrics?.conversions);
      const date = row.segments?.date ?? startDate;
      const ctr =
        parseNum(row.metrics?.ctr) * 100 ||
        (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const existing = byAd.get(adId);
      const point: FatigueDailyPoint = {
        date,
        ctr,
        frequency: 0,
        spend,
        impressions,
        clicks,
        conversions,
      };
      if (!existing) {
        const name = row.adGroupAd?.ad?.name || `Ad ${adId}`;
        const campaignName = row.campaign?.name ?? "";
        byAd.set(adId, {
          adId,
          adName: name,
          platform: "google",
          campaignId: row.campaign?.id ?? "",
          campaignName,
          adsetId: row.adGroup?.id ?? "",
          adsetName: row.adGroup?.name ?? "Unassigned",
          creativeTitle: name,
          creativeBody: null,
          creativeImageUrl: null,
          format: inferFormat({ name, googleAdType: row.adGroupAd?.ad?.type }),
          objective: inferObjective(campaignName, row.adGroup?.name),
          spend,
          impressions,
          reach: 0,
          clicks,
          ctr,
          frequency: 0,
          conversions,
          daysLive: 1,
          avgWatchSeconds: null,
          accountId: customerId,
          daily: [point],
        });
      } else {
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.conversions += conversions;
        existing.ctr =
          existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
        existing.daily.push(point);
      }
  }

  return [...byAd.values()].map((ad) => {
    const dates = ad.daily.map((d) => d.date).sort();
    return {
      ...ad,
      daysLive: daysLiveFromCreated(dates[0], endDate, dates[0]),
    };
  });
}

async function fetchTikTokFatigueDrafts(
  accessToken: string,
  advertiserId: string,
  startDate: string,
  endDate: string,
): Promise<FatigueAdDraft[]> {
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/");
  url.searchParams.set("advertiser_id", advertiserId);
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_AD");
  url.searchParams.set("dimensions", JSON.stringify(["ad_id", "stat_time_day"]));
  url.searchParams.set(
    "metrics",
    JSON.stringify(["spend", "impression", "click", "ctr", "conversion", "average_video_play"]),
  );
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("page_size", "1000");

  const res = await safeFetch(url.toString(), { headers: { "Access-Token": accessToken } });
  if (!res.ok) throw new Error(`TikTok API error (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    code?: number;
    message?: string;
    data?: {
      list?: Array<{
        dimensions?: { ad_id?: string; stat_time_day?: string };
        metrics?: {
          spend?: string;
          impression?: string;
          click?: string;
          ctr?: string;
          conversion?: string;
          average_video_play?: string;
        };
      }>;
    };
  };
  if (data.code !== 0) {
    throw new Error(`TikTok API error (code ${data.code}): ${data.message}`);
  }

  const rows = data.data?.list ?? [];
  const byAd = new Map<string, FatigueAdDraft>();
  for (const row of rows) {
    const adId = row.dimensions?.ad_id;
    const date = row.dimensions?.stat_time_day;
    if (!adId || !date) continue;
    const impressions = parseNum(row.metrics?.impression, true);
    const clicks = parseNum(row.metrics?.click, true);
    const spend = parseNum(row.metrics?.spend);
    const conversions = parseNum(row.metrics?.conversion);
    const ctr =
      parseNum(row.metrics?.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const point: FatigueDailyPoint = {
      date,
      ctr,
      frequency: 0,
      spend,
      impressions,
      clicks,
      conversions,
    };
    const existing = byAd.get(adId);
    const watch = parseNum(row.metrics?.average_video_play);
    if (!existing) {
      byAd.set(adId, {
        adId,
        adName: `TikTok ${adId}`,
        platform: "tiktok",
        campaignId: "",
        campaignName: "TikTok Ads",
        adsetId: "",
        adsetName: "TikTok",
        creativeTitle: `TikTok ${adId}`,
        creativeBody: null,
        creativeImageUrl: null,
        format: "video",
        objective: "prospecting",
        spend,
        impressions,
        reach: 0,
        clicks,
        ctr,
        frequency: 0,
        conversions,
        daysLive: 1,
        avgWatchSeconds: watch > 0 ? (watch > 120 ? watch / 1000 : watch) : null,
        accountId: advertiserId,
        daily: [point],
      });
    } else {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.conversions += conversions;
      existing.ctr =
        existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
      existing.daily.push(point);
    }
  }

  return [...byAd.values()].map((ad) => {
    const dates = ad.daily.map((d) => d.date).sort();
    return { ...ad, daysLive: daysLiveFromCreated(dates[0], endDate, dates[0]) };
  });
}

async function loadFatigueStoreSnapshot(
  prisma: PrismaClient,
  organizationId: string,
  startDate: string,
  endDate: string,
  brandId?: string,
): Promise<FatigueStoreSnapshot> {
  const empty = emptyStoreSnapshot();
  const brands = await prisma.brand.findMany({
    where: { organizationId, ...(brandId ? { id: brandId } : {}) },
    select: { id: true, website: true, slug: true },
  });
  if (brands.length === 0) return empty;
  const brandIds = brands.map((b) => b.id);
  const website = brands.find((b) => Boolean(b.website))?.website ?? null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return empty;
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const inRange: { brandId: { in: string[] }; dateCreated: { gte: Date; lte: Date } } = {
    brandId: { in: brandIds },
    dateCreated: { gte: start, lte: end },
  };
  const paid = {
    ...inRange,
    status: { notIn: [...UNPAID_WOO_STATUS_LIST] },
  };

  const [agg, baseline, recent, productCount, outOfStockCount] = await Promise.all([
    prisma.wooOrder.aggregate({
      where: paid,
      _sum: { netSales: true, refunds: true },
      _count: { id: true },
    }),
    prisma.wooOrder.aggregate({
      where: { ...paid, dateCreated: { gte: start, lt: mid } },
      _sum: { netSales: true },
      _count: { id: true },
    }),
    prisma.wooOrder.aggregate({
      where: { ...paid, dateCreated: { gte: mid, lte: end } },
      _sum: { netSales: true },
      _count: { id: true },
    }),
    prisma.wooProduct.count({ where: { brandId: { in: brandIds } } }),
    prisma.wooProduct.count({
      where: {
        brandId: { in: brandIds },
        OR: [{ stockStatus: "outofstock" }, { stockQty: { lte: 0 } }],
      },
    }),
  ]);

  const orders = agg._count.id ?? 0;
  const netSales = toNumber(agg._sum.netSales);
  const baseCount = baseline._count.id ?? 0;
  const recentCount = recent._count.id ?? 0;
  return {
    connected: orders > 0 || productCount > 0,
    website,
    orders,
    netSales,
    refunds: toNumber(agg._sum.refunds),
    aov: orders > 0 ? netSales / orders : 0,
    aovBaseline: baseCount > 0 ? toNumber(baseline._sum.netSales) / baseCount : 0,
    aovRecent: recentCount > 0 ? toNumber(recent._sum.netSales) / recentCount : 0,
    outOfStockCount,
    productCount,
  };
}

async function persistFatigueAlerts(
  prisma: PrismaClient,
  organizationId: string,
  ads: ReturnType<typeof scoreDrafts>,
  currency: ReportingCurrency,
  economics?: Pick<FatigueEconomics, "checks"> | null,
): Promise<number> {
  const drafts = buildFatigueAlertDrafts(ads, currency, economics);
  if (drafts.length === 0) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.notification.findMany({
    where: { organizationId, type: "alert", createdAt: { gte: start } },
    select: { data: true },
  });
  const already = new Set(
    existing
      .map((n) => {
        const data = n.data as { adId?: string; kind?: string } | null;
        return data?.kind && data?.adId ? `${data.kind}:${data.adId}` : undefined;
      })
      .filter((id): id is string => Boolean(id)),
  );
  let created = 0;
  for (const draft of drafts) {
    const key = `${draft.kind}:${draft.adId}`;
    if (already.has(key)) continue;
    await prisma.notification.create({
      data: {
        organizationId,
        type: "alert",
        title: draft.title,
        message: draft.message,
        isRead: false,
        data: {
          kind: draft.kind,
          adId: draft.adId,
          platform: draft.platform,
          fatigueScore: draft.fatigueScore,
          href: draft.href,
        },
      },
    });
    already.add(key);
    created += 1;
  }
  return created;
}

// ============================================================================
// Router
// ============================================================================

export const marketingRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // Get blended performance across all platforms for a date range
  // --------------------------------------------------------------------------
  getBlendedPerformance: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
        platform: z.enum(["meta", "google", "tiktok", "all"]).default("all"),
        market: z.enum(MARKET_FILTER_SCHEMA).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
          platform: input.platform,
        });
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;
        const { totals, timeseries } = await getBlendedForMarket(
          ctx.prisma,
          where,
          mode,
          filter,
        );

        return {
          success: true,
          data: {
            startDate: input.startDate,
            endDate: input.endDate,
            platform: input.platform,
            brandId: input.brandId ?? null,
            totals,
            timeseries,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getBlendedPerformance error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load blended performance",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Compare two time periods
  // --------------------------------------------------------------------------
  comparePeriods: organizationProcedure
    .input(
      z.object({
        period1Start: z.string(),
        period1End: z.string(),
        period2Start: z.string(),
        period2End: z.string(),
        brandId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where1 = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.period1Start,
          endDate: input.period1End,
          brandId: input.brandId,
        });
        const where2 = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.period2Start,
          endDate: input.period2End,
          brandId: input.brandId,
        });

        const [period1, period2] = await Promise.all([
          getBlendedMetrics(ctx.prisma, where1),
          getBlendedMetrics(ctx.prisma, where2),
        ]);

        const changes = {
          totalSpend: pctChange(period1.totalSpend, period2.totalSpend),
          totalImpressions: pctChange(
            period1.totalImpressions,
            period2.totalImpressions,
          ),
          totalClicks: pctChange(period1.totalClicks, period2.totalClicks),
          totalConversions: pctChange(
            period1.totalConversions,
            period2.totalConversions,
          ),
          totalConversionValue: pctChange(
            period1.totalConversionValue,
            period2.totalConversionValue,
          ),
          blendedROAS: pctChange(period1.blendedROAS, period2.blendedROAS),
          blendedCPC: pctChange(period1.blendedCPC, period2.blendedCPC),
          blendedCPM: pctChange(period1.blendedCPM, period2.blendedCPM),
          blendedCTR: pctChange(period1.blendedCTR, period2.blendedCTR),
        };

        return {
          success: true,
          data: {
            period1: {
              startDate: input.period1Start,
              endDate: input.period1End,
              ...period1,
            },
            period2: {
              startDate: input.period2Start,
              endDate: input.period2End,
              ...period2,
            },
            changes,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("comparePeriods error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compare periods",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get per-account summary
  // --------------------------------------------------------------------------
  getAccountSummary: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });

        const [grouped, totals] = await Promise.all([
          ctx.prisma.dailyMetric.groupBy({
            by: ["adAccountId"],
            where,
            _sum: {
              spend: true,
              impressions: true,
              clicks: true,
              conversions: true,
              conversionValue: true,
            },
            orderBy: { adAccountId: "asc" },
          }),
          getBlendedMetrics(ctx.prisma, where),
        ]);

        // Fetch the account metadata (platform + name) for every grouped id.
        const accountIds = grouped.map((g) => g.adAccountId);
        const accounts = accountIds.length
          ? await ctx.prisma.adAccount.findMany({
              where: { id: { in: accountIds } },
              select: {
                id: true,
                platform: true,
                accountId: true,
                name: true,
                currency: true,
              },
            })
          : [];
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        const accountSummaries = grouped.map((g) => {
          const meta = accountMap.get(g.adAccountId);
          const totalSpend = toNumber(g._sum.spend);
          const totalImpressions = g._sum.impressions ?? 0;
          const totalClicks = g._sum.clicks ?? 0;
          const totalConversions = toNumber(g._sum.conversions);
          const totalConversionValue = toNumber(g._sum.conversionValue);
          return {
            adAccountId: g.adAccountId,
            platform: meta?.platform ?? "unknown",
            accountId: meta?.accountId ?? "",
            name: meta?.name ?? "Unknown account",
            currency: meta?.currency ?? "EUR",
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            totalConversionValue,
            roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
            cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          };
        });

        return {
          success: true,
          data: {
            accounts: accountSummaries,
            totals,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getAccountSummary error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load account summary",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Find campaigns with high spend but low ROAS
  // --------------------------------------------------------------------------
  findWastedSpend: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        roasThreshold: z.number().default(1.0),
        minSpend: z.number().default(50),
        brandId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });

        // Aggregate per campaign, excluding rows without a campaign id.
        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["campaignId", "campaignName", "platform"],
          where: { ...where, campaignId: { not: "" } },
          _sum: {
            spend: true,
            conversionValue: true,
            impressions: true,
            clicks: true,
            conversions: true,
          },
        });

        const wastedCampaigns = grouped
          .map((g) => {
            const totalSpend = toNumber(g._sum.spend);
            const totalConversionValue = toNumber(g._sum.conversionValue);
            return {
              campaignId: g.campaignId ?? "",
              campaignName: g.campaignName ?? "Unknown campaign",
              platform: g.platform,
              totalSpend,
              totalImpressions: g._sum.impressions ?? 0,
              totalClicks: g._sum.clicks ?? 0,
              totalConversions: toNumber(g._sum.conversions),
              totalConversionValue,
              roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
            };
          })
          .filter(
            (c) => c.totalSpend >= input.minSpend && c.roas < input.roasThreshold,
          )
          .sort((a, b) => b.totalSpend - a.totalSpend);

        const totalWastedSpend = wastedCampaigns.reduce(
          (sum, c) => sum + c.totalSpend,
          0,
        );

        return {
          success: true,
          data: {
            wastedCampaigns,
            threshold: input.roasThreshold,
            minSpend: input.minSpend,
            totalWastedSpend,
            count: wastedCampaigns.length,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("findWastedSpend error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to find wasted spend",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get top performing campaigns
  // --------------------------------------------------------------------------
  getTopCampaigns: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        metric: z
          .enum(["spend", "conversions", "roas", "clicks"])
          .default("conversions"),
        limit: z.number().default(10),
        brandId: z.string().optional(),
        market: z.enum(MARKET_FILTER_SCHEMA).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;

        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["campaignId", "campaignName", "platform"],
          where: { ...where, campaignId: { not: "" } },
          _sum: {
            spend: true,
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
          },
        });

        const campaigns = grouped
          .map((g) => {
            const totalSpend = toNumber(g._sum.spend);
            const totalImpressions = g._sum.impressions ?? 0;
            const totalClicks = g._sum.clicks ?? 0;
            const totalConversions = toNumber(g._sum.conversions);
            const totalConversionValue = toNumber(g._sum.conversionValue);
            const market = adDeskForName(g.campaignName, mode);
            return {
              campaignId: g.campaignId ?? "",
              campaignName: g.campaignName ?? "Unknown campaign",
              platform: g.platform,
              market,
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              totalConversionValue,
              roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
              cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            };
          })
          .filter((row) => filter === "all" || row.market === filter)
          .sort((a, b) => {
            switch (input.metric) {
              case "spend":
                return b.totalSpend - a.totalSpend;
              case "conversions":
                return b.totalConversions - a.totalConversions;
              case "clicks":
                return b.totalClicks - a.totalClicks;
              case "roas":
                return b.roas - a.roas;
              default:
                return 0;
            }
          })
          .slice(0, input.limit);

        return {
          success: true,
          data: {
            metric: input.metric,
            campaigns,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getTopCampaigns error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load top campaigns",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get per-campaign performance (optional date window; defaults to all time)
  // --------------------------------------------------------------------------
  getCampaignPerformance: organizationProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(200),
        brandId: z.string().min(1).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        market: z.enum(MARKET_FILTER_SCHEMA).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;
        const today = new Date().toISOString().slice(0, 10);
        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate ?? "2000-01-01",
          endDate: input.endDate ?? today,
          brandId: input.brandId,
        });

        const groupedSumWithoutReach = {
          spend: true,
          impressions: true,
          clicks: true,
          conversions: true,
          conversionValue: true,
          linkClicks: true,
          landingPageViews: true,
          addToCart: true,
          checkouts: true,
          websitePurchases: true,
          websitePurchaseValue: true,
          results: true,
        } as const;
        let grouped;
        try {
          grouped = await ctx.prisma.dailyMetric.groupBy({
            by: ["campaignId", "campaignName", "platform"],
            where: { ...where, campaignId: { not: "" } },
            _sum: { ...groupedSumWithoutReach, reach: true },
          });
        } catch (error) {
          if (!isPrismaMissingColumn(error, "reach")) throw error;
          grouped = await ctx.prisma.dailyMetric.groupBy({
            by: ["campaignId", "campaignName", "platform"],
            where: { ...where, campaignId: { not: "" } },
            _sum: groupedSumWithoutReach,
          });
        }

        let freqRows: Array<{
          campaignId: string | null;
          platform: string;
          impressions: number;
          frequency: Prisma.Decimal | number | null;
          reach: number;
          resultType: string | null;
          attributionSetting: string | null;
        }>;
        try {
          freqRows = await ctx.prisma.dailyMetric.findMany({
            where: { ...where, campaignId: { not: "" } },
            select: {
              campaignId: true,
              platform: true,
              impressions: true,
              frequency: true,
              reach: true,
              resultType: true,
              attributionSetting: true,
            },
          });
        } catch (error) {
          if (
            !isPrismaMissingColumn(error, "reach") &&
            !isPrismaMissingColumn(error, "frequency")
          ) {
            throw error;
          }
          const fallback = await ctx.prisma.dailyMetric.findMany({
            where: { ...where, campaignId: { not: "" } },
            select: {
              campaignId: true,
              platform: true,
              impressions: true,
              resultType: true,
              attributionSetting: true,
            },
          });
          freqRows = fallback.map((row) => ({ ...row, frequency: 0, reach: 0 }));
        }
        const freqByKey = new Map<string, { impressions: number; frequency: number; reach: number }[]>();
        const resultTypeByKey = new Map<string, string>();
        const attributionByKey = new Map<string, string>();
        for (const row of freqRows) {
          const key = `${row.platform}:${row.campaignId}`;
          const list = freqByKey.get(key) ?? [];
          list.push({
            impressions: row.impressions,
            frequency: toNumber(row.frequency),
            reach: row.reach,
          });
          freqByKey.set(key, list);
          if (row.resultType && !resultTypeByKey.has(key)) resultTypeByKey.set(key, row.resultType);
          if (row.attributionSetting && !attributionByKey.has(key)) {
            attributionByKey.set(key, row.attributionSetting);
          }
        }

        const objects = await ctx.prisma.adCampaign.findMany({
          where: {
            adAccount: {
              brand: {
                organizationId: ctx.organizationId,
                ...(input.brandId ? { id: input.brandId } : {}),
              },
            },
          },
        });
        const objectByKey = new Map(
          objects.map((o) => [`${o.platform}:${o.platformCampaignId}`, o]),
        );

        const campaigns = grouped.map((g) => {
          const totalSpend = toNumber(g._sum.spend);
          const totalImpressions = g._sum.impressions ?? 0;
          const totalClicks = g._sum.clicks ?? 0;
          const totalConversions = toNumber(g._sum.conversions);
          const totalConversionValue = toNumber(g._sum.conversionValue);
          const key = `${g.platform}:${g.campaignId}`;
          const rolled = rollupReachFrequency(freqByKey.get(key) ?? []);
          const obj = objectByKey.get(key);
          const totalLinkClicks = g._sum.linkClicks ?? 0;
          const totalResults = toNumber(g._sum.results);
          return {
            campaignId: g.campaignId ?? "",
            campaignName: g.campaignName ?? obj?.name ?? "Unknown campaign",
            market: adDeskForName(g.campaignName ?? obj?.name, mode),
            platform: g.platform,
            status: obj?.status ?? "unknown",
            objective: obj?.objective ?? null,
            dailyBudget: obj?.dailyBudget != null ? toNumber(obj.dailyBudget) : null,
            lifetimeBudget: obj?.lifetimeBudget != null ? toNumber(obj.lifetimeBudget) : null,
            budgetType: obj?.budgetType ?? null,
            attributionSetting:
              obj?.attributionSetting ?? attributionByKey.get(key) ?? null,
            createdTime: obj?.createdTime?.toISOString() ?? null,
            updatedTime: obj?.updatedTime?.toISOString() ?? null,
            stopTime: obj?.stopTime?.toISOString() ?? null,
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            totalConversionValue,
            totalReach: Math.round(rolled.reach),
            frequency: Number(rolled.frequency.toFixed(2)),
            totalLinkClicks,
            totalLandingPageViews: g._sum.landingPageViews ?? 0,
            totalAddToCart: toNumber(g._sum.addToCart),
            totalCheckouts: toNumber(g._sum.checkouts),
            totalWebsitePurchases: toNumber(g._sum.websitePurchases),
            totalWebsitePurchaseValue: toNumber(g._sum.websitePurchaseValue),
            totalResults,
            resultType: resultTypeByKey.get(key) ?? null,
            roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
            cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            linkCtr: totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0,
            cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
            costPerResult: totalResults > 0 ? totalSpend / totalResults : 0,
          };
        });

        const seen = new Set(campaigns.map((c) => `${c.platform}:${c.campaignId}`));
        for (const obj of objects) {
          const key = `${obj.platform}:${obj.platformCampaignId}`;
          if (seen.has(key)) continue;
          campaigns.push({
            campaignId: obj.platformCampaignId,
            campaignName: obj.name,
            market: adDeskForName(obj.name, mode),
            platform: obj.platform,
            status: obj.status,
            objective: obj.objective ?? null,
            dailyBudget: obj.dailyBudget != null ? toNumber(obj.dailyBudget) : null,
            lifetimeBudget: obj.lifetimeBudget != null ? toNumber(obj.lifetimeBudget) : null,
            budgetType: obj.budgetType ?? null,
            attributionSetting: obj.attributionSetting ?? null,
            createdTime: obj.createdTime?.toISOString() ?? null,
            updatedTime: obj.updatedTime?.toISOString() ?? null,
            stopTime: obj.stopTime?.toISOString() ?? null,
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            totalConversionValue: 0,
            totalReach: 0,
            frequency: 0,
            totalLinkClicks: 0,
            totalLandingPageViews: 0,
            totalAddToCart: 0,
            totalCheckouts: 0,
            totalWebsitePurchases: 0,
            totalWebsitePurchaseValue: 0,
            totalResults: 0,
            resultType: null,
            roas: 0,
            cpc: 0,
            ctr: 0,
            linkCtr: 0,
            cpa: 0,
            costPerResult: 0,
          });
        }

        campaigns.sort((a, b) => {
          if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend;
          if (a.status === "active" && b.status !== "active") return -1;
          if (b.status === "active" && a.status !== "active") return 1;
          return a.campaignName.localeCompare(b.campaignName);
        });

        const scoped =
          filter === "all" ? campaigns : campaigns.filter((row) => row.market === filter);

        return {
          success: true,
          data: { campaigns: scoped.slice(0, input.limit) },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getCampaignPerformance error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaign performance",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get today's (UTC) per-platform totals snapshot
  // --------------------------------------------------------------------------
  getTodaySnapshot: organizationProcedure
    .input(z.object({ brandId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
    try {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input?.brandId);
      const today = new Date().toISOString().slice(0, 10);

      const loadByDate = async (dateStr: string) => {
        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["platform"],
          where: buildDailyMetricWhere({
            organizationId: ctx.organizationId,
            startDate: dateStr,
            endDate: dateStr,
            brandId: input?.brandId,
          }),
          _sum: {
            spend: true,
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
          },
          _count: true,
        });
        return grouped.map((g) => ({
          platform: g.platform,
          totalSpend: toNumber(g._sum.spend),
          totalImpressions: g._sum.impressions ?? 0,
          totalClicks: g._sum.clicks ?? 0,
          totalConversions: toNumber(g._sum.conversions),
          totalConversionValue: toNumber(g._sum.conversionValue),
          records: g._count,
        }));
      };

      let date = today;
      let snapshot = await loadByDate(today);

      // Syncs often lag UTC "today". Prefer the latest DailyMetric day over a
      // zero strip that looks like −100% vs the period average.
      if (snapshot.length === 0) {
        const latest = await ctx.prisma.dailyMetric.findFirst({
          where: {
            platform: { in: [...PAID_AD_PLATFORMS] },
            adAccount: {
              brand: {
                organizationId: ctx.organizationId,
                ...(input?.brandId ? { id: input.brandId } : {}),
              },
            },
          },
          orderBy: { date: "desc" },
          select: { date: true },
        });
        if (latest?.date) {
          date =
            latest.date instanceof Date
              ? latest.date.toISOString().slice(0, 10)
              : String(latest.date).slice(0, 10);
          snapshot = await loadByDate(date);
        }
      }

      return {
        success: true,
        data: { date, isToday: date === today, platforms: snapshot },
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("getTodaySnapshot error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load today's snapshot",
        cause: error,
      });
    }
  }),

  // --------------------------------------------------------------------------
  // GA4 Realtime — active users in the last ~30 minutes for this shop's property.
  // Not till. Not pixel ROAS. Not a WebSocket.
  // --------------------------------------------------------------------------
  getGa4Realtime: organizationAdminProcedure
    .input(z.object({ brandId: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input?.brandId);
        const account = await ctx.prisma.adAccount.findFirst({
          where: {
            platform: SITE_ANALYTICS_PLATFORM,
            ...(input?.brandId ? { brandId: input.brandId } : {}),
            brand: { organizationId: ctx.organizationId },
            isActive: true,
            accessToken: { not: null },
          },
          select: {
            id: true,
            accountId: true,
            name: true,
            accessToken: true,
            refreshToken: true,
            tokenExpiry: true,
          },
        });
        if (!account?.accessToken) {
          return {
            status: "disconnected" as const,
            message: "Connect Google Analytics on Connections, then pick this shop's property.",
          };
        }
        if (!isGa4PropertyReady(account.accountId)) {
          return {
            status: "pick-property" as const,
            message: "Pick the GA4 property for this shop on Connections. Do not select another brand's property.",
            propertyName: account.name,
          };
        }
        const accessToken = await ensureFreshGoogleAccessToken(
          {
            id: account.id,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            tokenExpiry: account.tokenExpiry,
          },
          "analytics",
        );
        const snapshot = await fetchGa4Realtime(accessToken, account.accountId);
        return {
          status: "ok" as const,
          propertyId: parseGa4PropertyId(account.accountId),
          propertyName: account.name,
          fetchedAt: new Date().toISOString(),
          ...snapshot,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          status: "error" as const,
          message:
            error instanceof Error
              ? error.message
              : "Google Analytics Realtime failed.",
        };
      }
    }),

  // --------------------------------------------------------------------------
  // Settled GA4 channel mix from DailyMetric (sessions stored as clicks).
  // Not live visitors. Not Pixel ROAS.
  // --------------------------------------------------------------------------
  getGa4ChannelMix: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
          platform: SITE_ANALYTICS_PLATFORM,
        });
        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["campaignName"],
          where,
          _sum: {
            clicks: true,
            impressions: true,
            conversions: true,
            conversionValue: true,
            websitePurchases: true,
          },
        });
        const dailyGrouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["date", "campaignName"],
          where,
          _sum: {
            clicks: true,
            conversions: true,
            conversionValue: true,
            websitePurchases: true,
          },
        });
        const ga4Account = await ctx.prisma.adAccount.findFirst({
          where: {
            platform: SITE_ANALYTICS_PLATFORM,
            brand: {
              organizationId: ctx.organizationId,
              ...(input.brandId ? { id: input.brandId } : {}),
            },
          },
          select: { name: true, lastSyncAt: true },
          orderBy: { lastSyncAt: "desc" },
        });
        const channels = grouped
          .map((g) => ({
            channel: g.campaignName?.trim() || "(other)",
            sessions: g._sum.clicks ?? 0,
            views: g._sum.impressions ?? 0,
            keyEvents: toNumber(g._sum.conversions),
            revenue: toNumber(g._sum.conversionValue),
            purchases: toNumber(g._sum.websitePurchases),
          }))
          .sort((a, b) => b.sessions - a.sessions);
        const totals = channels.reduce(
          (acc, row) => {
            acc.sessions += row.sessions;
            acc.views += row.views;
            acc.keyEvents += row.keyEvents;
            acc.revenue += row.revenue;
            acc.purchases += row.purchases;
            return acc;
          },
          { sessions: 0, views: 0, keyEvents: 0, revenue: 0, purchases: 0 },
        );
        const deskRows = dailyGrouped.map((g) => ({
          date:
            g.date instanceof Date ? g.date.toISOString().slice(0, 10) : String(g.date),
          channel: g.campaignName?.trim() || "(other)",
          sessions: g._sum.clicks ?? 0,
          purchases: toNumber(g._sum.websitePurchases),
          revenue: toNumber(g._sum.conversionValue),
        }));
        return {
          success: true,
          data: {
            startDate: input.startDate,
            endDate: input.endDate,
            connected: Boolean(ga4Account),
            propertyName: ga4Account?.name ?? null,
            lastSyncAt: ga4Account?.lastSyncAt?.toISOString() ?? null,
            channels,
            totals,
            organicDays: rollupGa4DeskDays(deskRows, isGa4OrganicSearchChannel),
            generativeDays: rollupGa4DeskDays(deskRows, isGa4GenerativeChannel),
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getGa4ChannelMix error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load GA4 channel mix",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Live Meta audience breakdown (age, gender, age × gender matrix, frequency
  // distribution, geography, platforms, devices, platform × device combos,
  // peak hours) from the Graph API
  // --------------------------------------------------------------------------
  getAudienceBreakdown: organizationAdminProcedure
    .input(metaDateRangeSchema)
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const resolved = await resolveMetaAccount(ctx, input.brandId);
        if (!resolved) {
          return {
            connected: false,
            accountId: null as string | null,
            ages: [],
            genders: [],
            countries: [],
            regions: [],
            platforms: [],
            devicePlatforms: [],
            impressionDevices: [],
            hourly: [],
            ageGender: [],
            frequencyReach: [],
            platformDevice: [],
            pixelEvents: { ...EMPTY_PIXEL_EVENTS },
          };
        }

        const timeRange = JSON.stringify({
          since: input.startDate,
          until: input.endDate,
        });
        // Age/gender buckets include purchase actions plus reach/frequency.
        // Device and hourly prefer clicks+purchases, then fall back to delivery
        // metrics if Meta rejects the richer field set.
        const baseParams = { time_range: timeRange };
        const fullFields = {
          ...baseParams,
          fields: "spend,impressions,clicks,actions,reach,frequency",
        };
        const listFields = { ...baseParams, fields: "spend,impressions,clicks" };
        const conversionFields = {
          ...baseParams,
          fields: "spend,impressions,clicks,actions",
        };
        const hourlyFields = { ...baseParams, fields: "spend,impressions", limit: "48" };
        const hourlyConversionFields = {
          ...baseParams,
          fields: "spend,impressions,clicks,actions",
          limit: "48",
        };
        const ageGenderFields = {
          ...baseParams,
          fields: "spend,impressions,reach,frequency",
        };
        const frequencyValueFields = { ...baseParams, fields: "reach" };
        const platformDeviceFields = { ...baseParams, fields: "spend,impressions" };

        const [
          ageRows,
          genderRows,
          countryRows,
          regionRows,
          platformRows,
          devicePlatformRows,
          impressionDeviceRows,
          hourlyRows,
          ageGenderRows,
          frequencyValueRows,
          platformDeviceRows,
          pixelRows,
        ] = await Promise.all([
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...fullFields,
            breakdowns: "age",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...fullFields,
            breakdowns: "gender",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...listFields,
            breakdowns: "country",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...listFields,
            breakdowns: "region",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...listFields,
            breakdowns: "publisher_platform",
          }),
          fetchMetaInsightsPrefer(
            resolved.accessToken,
            resolved.account.accountId,
            { ...conversionFields, breakdowns: "device_platform" },
            { ...listFields, breakdowns: "device_platform" },
          ),
          fetchMetaInsightsPrefer(
            resolved.accessToken,
            resolved.account.accountId,
            { ...conversionFields, breakdowns: "impression_device" },
            { ...listFields, breakdowns: "impression_device" },
          ),
          fetchMetaInsightsPrefer(
            resolved.accessToken,
            resolved.account.accountId,
            {
              ...hourlyConversionFields,
              breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
            },
            {
              ...hourlyFields,
              breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
            },
          ),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...ageGenderFields,
            breakdowns: "age,gender",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...frequencyValueFields,
            breakdowns: "frequency_value",
          }),
          fetchMetaInsights(resolved.accessToken, resolved.account.accountId, {
            ...platformDeviceFields,
            breakdowns: "publisher_platform,impression_device",
          }),
          fetchMetaInsightsPrefer(
            resolved.accessToken,
            resolved.account.accountId,
            { ...baseParams, fields: "impressions,clicks,actions" },
            { ...baseParams, fields: "actions" },
          ),
        ]);

        return {
          connected: true,
          accountId: resolved.account.accountId,
          ages: aggregateBreakdownRows(ageRows as MetaGraphBreakdownRow[], "age"),
          genders: aggregateBreakdownRows(
            genderRows as MetaGraphBreakdownRow[],
            "gender",
          ),
          countries: aggregateBreakdownRows(
            countryRows as MetaGraphBreakdownRow[],
            "country",
          ),
          regions: aggregateBreakdownRows(
            regionRows as MetaGraphBreakdownRow[],
            "region",
          ),
          platforms: aggregateBreakdownRows(
            platformRows as MetaGraphBreakdownRow[],
            "publisher_platform",
          ),
          devicePlatforms: aggregateBreakdownRows(
            devicePlatformRows as MetaGraphBreakdownRow[],
            "device_platform",
          ),
          impressionDevices: aggregateBreakdownRows(
            impressionDeviceRows as MetaGraphBreakdownRow[],
            "impression_device",
          ),
          hourly: aggregateHourlyRows(hourlyRows as MetaGraphBreakdownRow[]),
          ageGender: parseAgeGenderRows(ageGenderRows as MetaGraphBreakdownRow[]),
          frequencyReach: parseFrequencyReachRows(
            frequencyValueRows as MetaGraphBreakdownRow[],
          ),
          platformDevice: parsePlatformDeviceRows(
            platformDeviceRows as MetaGraphBreakdownRow[],
          ),
          pixelEvents: sumPixelEvents(pixelRows as MetaGraphBreakdownRow[]),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getAudienceBreakdown error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load audience breakdown",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Live Meta creative fatigue (ad-level frequency/reach) from the Graph API
  // --------------------------------------------------------------------------
  getCreativeFatigue: organizationAdminProcedure
    .input(metaDateRangeSchema)
    .query(async ({ input, ctx }) => {
      try {
        const platforms: FatiguePlatformStatus[] = [
          { id: "meta", connected: false, accountName: null },
          { id: "google", connected: false, accountName: null },
          { id: "tiktok", connected: false, accountName: null },
        ];
        const drafts: FatigueAdDraft[] = [];
        const coverage: FatigueCoverage[] = [];
        let metaCatalogIds: string[] = [];
        let metaProductSetIds: string[] = [];

        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const meta = await resolvePlatformAccount(ctx, "meta", input.brandId);
        if (meta) {
          try {
            const { drafts: rows, accountSpend, catalogIds, productSetIds } = await fetchMetaFatigueDrafts(
              meta.accessToken,
              meta.account.accountId,
              input.startDate,
              input.endDate,
            );
            drafts.push(...rows);
            metaCatalogIds = catalogIds;
            metaProductSetIds = productSetIds;
            platforms[0] = {
              id: "meta",
              connected: true,
              accountName: meta.account.name,
            };
            coverage.push({
              platform: "meta",
              scoredSpend: rows.reduce((s, r) => s + r.spend, 0),
              accountSpend,
            });
          } catch (error) {
            platforms[0] = {
              id: "meta",
              connected: false,
              accountName: meta.account.name,
              error: error instanceof Error ? error.message : "Meta fetch failed",
            };
          }
        }

        const google = await resolvePlatformAccount(ctx, "google", input.brandId);
        if (google) {
          try {
            const rows = await fetchGoogleFatigueDrafts(
              google.accessToken,
              google.account.accountId,
              input.startDate,
              input.endDate,
            );
            drafts.push(...rows);
            platforms[1] = {
              id: "google",
              connected: true,
              accountName: google.account.name,
            };
          } catch (error) {
            platforms[1] = {
              id: "google",
              connected: false,
              accountName: google.account.name,
              error: error instanceof Error ? error.message : "Google fetch failed",
            };
          }
        }

        const tiktok = await resolvePlatformAccount(ctx, "tiktok", input.brandId);
        if (tiktok) {
          try {
            const rows = await fetchTikTokFatigueDrafts(
              tiktok.accessToken,
              tiktok.account.accountId,
              input.startDate,
              input.endDate,
            );
            drafts.push(...rows);
            platforms[2] = {
              id: "tiktok",
              connected: true,
              accountName: tiktok.account.name,
            };
          } catch (error) {
            platforms[2] = {
              id: "tiktok",
              connected: false,
              accountName: tiktok.account.name,
              error: error instanceof Error ? error.message : "TikTok fetch failed",
            };
          }
        }

        if (!platforms.some((p) => p.connected)) {
          return emptyFatiguePayload(platforms);
        }

        const ads = scoreDrafts(drafts);
        let store = emptyStoreSnapshot();
        try {
          store = await loadFatigueStoreSnapshot(
            ctx.prisma,
            ctx.organizationId,
            input.startDate,
            input.endDate,
            input.brandId,
          );
        } catch (error) {
          console.error("loadFatigueStoreSnapshot error:", error);
        }
        let landing = emptyLandingProbe();
        try {
          const [html, woo, metaCatalog] = await Promise.all([
            probeLandingPages(
              landingUrlsToProbe(
                store.website,
                ads.map((ad) => ad.destinationUrl),
              ),
            ),
            probeWooCatalog(store.website),
            meta
              ? fetchMetaCatalogSignal(
                  meta.accessToken,
                  meta.account.accountId,
                  store.website,
                  metaCatalogIds,
                  metaProductSetIds,
                )
              : Promise.resolve(emptyCatalogSignal()),
          ]);
          landing = mergeLandingWithCatalog(html, mergeCatalogSignals([woo, metaCatalog]));
        } catch (error) {
          console.error("probeLandingPages error:", error);
        }
        const currency = currencyFromSettings(ctx.organization.settings);
        const payload = assembleFatiguePayload(
          ads,
          platforms,
          0,
          coverage,
          currency,
          store,
          landing,
        );
        let alertsCreated = 0;
        try {
          alertsCreated = await persistFatigueAlerts(
            ctx.prisma,
            ctx.organizationId,
            ads,
            currency,
            payload.economics,
          );
        } catch (error) {
          console.error("persistFatigueAlerts error:", error);
        }
        return { ...payload, alertsCreated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getCreativeFatigue error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to load creative fatigue",
          cause: error,
        });
      }
    }),

  applyCreativeAction: organizationAdminProcedure
    .input(
      z.object({
        action: z.enum(["pause", "reduce_budget"]),
        adId: z.string().min(1),
        adsetId: z.string().optional(),
        brandId: z.string().min(1).optional(),
        platform: z.enum(["meta", "google", "tiktok"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.platform !== "meta") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pause and budget cuts currently run on Meta ads only.",
        });
      }
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
      const resolved = await resolvePlatformAccount(ctx, "meta", input.brandId);
      if (!resolved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect a Meta ad account first.",
        });
      }

      try {
        if (input.action === "pause") {
          const form = new URLSearchParams();
          form.set("access_token", resolved.accessToken);
          form.set("status", "PAUSED");
          const res = await safeFetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${input.adId}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
          });
          const body = (await res.json().catch(() => null)) as {
            success?: boolean;
            error?: { message?: string };
          } | null;
          if (!res.ok || body?.error) {
            throw new Error(body?.error?.message ?? `Meta pause failed (${res.status})`);
          }
          return { ok: true, action: input.action, adId: input.adId, detail: "Ad paused on Meta." };
        }

        const adsetId = input.adsetId;
        if (!adsetId) {
          throw new Error("Missing ad set id for a budget cut.");
        }
        const read = await safeFetch(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${adsetId}?fields=daily_budget,name&access_token=${encodeURIComponent(resolved.accessToken)}`,
        );
        const adset = (await read.json().catch(() => null)) as {
          daily_budget?: string;
          error?: { message?: string };
        } | null;
        if (!read.ok || !adset || adset.error) {
          throw new Error(adset?.error?.message ?? "Could not read ad set budget.");
        }
        const current = parseInt(adset.daily_budget ?? "0", 10);
        if (!current) {
          throw new Error("This ad set has no daily budget to cut (campaign-budget Advantage+).");
        }
        const next = Math.max(100, Math.floor(current * 0.5));
        const form = new URLSearchParams();
        form.set("access_token", resolved.accessToken);
        form.set("daily_budget", String(next));
        const res = await safeFetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${adsetId}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        const body = (await res.json().catch(() => null)) as {
          success?: boolean;
          error?: { message?: string };
        } | null;
        if (!res.ok || body?.error) {
          throw new Error(body?.error?.message ?? `Budget update failed (${res.status})`);
        }
        return {
          ok: true,
          action: input.action,
          adId: input.adId,
          detail: `Daily budget cut from ${formatMoneyExact(current / 100, currencyFromSettings(ctx.organization.settings))} to ${formatMoneyExact(next / 100, currencyFromSettings(ctx.organization.settings))}.`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Creative action failed",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Org-scoped daily timeseries used as the prediction/forecast basis
  // --------------------------------------------------------------------------
  getPredictionBasis: organizationProcedure
    .input(metaDateRangeSchema)
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const where = buildDailyMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });

        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["date"],
          where,
          _sum: {
            spend: true,
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
          },
          orderBy: { date: "asc" },
        });

        return grouped.map((day) => ({
          date:
            day.date instanceof Date
              ? day.date.toISOString().slice(0, 10)
              : String(day.date),
          spend: toNumber(day._sum.spend),
          impressions: day._sum.impressions ?? 0,
          clicks: day._sum.clicks ?? 0,
          conversions: toNumber(day._sum.conversions),
          conversionValue: toNumber(day._sum.conversionValue),
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getPredictionBasis error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load prediction basis",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Live Meta ad set performance from the Graph API (bid suggestions)
  // --------------------------------------------------------------------------
  getAdSetPerformance: organizationAdminProcedure
    .input(metaDateRangeSchema)
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const resolved = await resolveMetaAccount(ctx, input.brandId);
        if (!resolved) {
          return { connected: false as const, adsets: [] };
        }

        const rows = (await fetchMetaInsights(
          resolved.accessToken,
          resolved.account.accountId,
          {
            level: "adset",
            fields: "adset_name,spend,impressions,clicks,actions,ctr,frequency",
            time_range: JSON.stringify({
              since: input.startDate,
              until: input.endDate,
            }),
            limit: "100",
          },
        )) as unknown as MetaGraphAdSetRow[];

        const adsets = rows
          .map((r) => {
            const spend = parseFloat(r.spend ?? "0");
            const clicks = parseInt(r.clicks ?? "0", 10);
            return {
              adsetId: r.id,
              adsetName: r.adset_name ?? "Unknown ad set",
              spend,
              impressions: parseInt(r.impressions ?? "0", 10),
              clicks,
              ctr: parseFloat(r.ctr ?? "0"),
              frequency: parseFloat(r.frequency ?? "0"),
              cpc: clicks > 0 ? spend / clicks : 0,
              conversions: parsePurchaseCount(r.actions),
            };
          })
          .sort((a, b) => b.spend - a.spend);

        return { connected: true as const, adsets };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getAdSetPerformance error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load ad set performance",
          cause: error,
        });
      }
    }),

  getSearchConsole: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().min(1).optional(),
        queryLimit: z.number().int().min(5).max(200).default(80),
      }),
    )
    .query(async ({ ctx, input }) => {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          platform: SEARCH_CONSOLE_PLATFORM,
          brand: {
            organizationId: ctx.organizationId,
            ...(input.brandId ? { id: input.brandId } : {}),
          },
        },
        select: {
          id: true,
          name: true,
          lastSyncAt: true,
          accountId: true,
        },
        orderBy: { lastSyncAt: "desc" },
      });
      if (!account) {
        return {
          connected: false as const,
          siteName: null,
          lastSyncAt: null,
          queryLookbackDays: GSC_QUERY_LOOKBACK_DAYS,
          totals: {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            avgPosition: null as number | null,
          },
          days: [] as Array<{ date: string; clicks: number; impressions: number; position: number | null }>,
          queries: [] as ReturnType<typeof rollupGscQueries>,
          answerQueries: [] as ReturnType<typeof rollupGscQueries>,
          unseenAnswerQueries: [] as ReturnType<typeof rollupGscQueries>,
          positionBands: gscPositionBands([]),
          queryCount: 0,
        };
      }

      const where = {
        platform: SEARCH_CONSOLE_PLATFORM,
        adAccountId: account.id,
        date: { gte: startOfDay(input.startDate), lte: endOfDay(input.endDate) },
      };
      const [siteRows, queryRows] = await Promise.all([
        ctx.prisma.dailyMetric.findMany({
          where: { ...where, campaignId: GSC_SITE_TOTAL_CAMPAIGN_ID },
          select: { date: true, clicks: true, impressions: true, frequency: true },
          orderBy: { date: "asc" },
        }),
        ctx.prisma.dailyMetric.findMany({
          where: {
            ...where,
            resultType: "gsc_query",
            NOT: { campaignId: GSC_SITE_TOTAL_CAMPAIGN_ID },
          },
          select: {
            campaignId: true,
            campaignName: true,
            clicks: true,
            impressions: true,
            frequency: true,
          },
          take: 8_000,
        }),
      ]);

      const totals = rollupGscSiteDays(
        siteRows.map((row) => ({
          date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
          clicks: row.clicks,
          impressions: row.impressions,
          position: toNumber(row.frequency),
        })),
      );
      const allQueries = collectGscQueries(
        queryRows
          .filter((row) => !isGscSiteTotalCampaignId(row.campaignId))
          .map((row) => ({
            campaignId: row.campaignId,
            campaignName: row.campaignName,
            clicks: row.clicks,
            impressions: row.impressions,
            position: toNumber(row.frequency),
          })),
      );
      const queries = allQueries.slice(0, input.queryLimit);
      const answerQueries = allQueries.filter((row) => row.answerShaped).slice(0, 80);
      const unseenAnswerQueries = allQueries
        .filter((row) => row.answerShaped && row.clicks === 0 && row.impressions >= 20)
        .slice(0, 30);

      return {
        connected: true as const,
        siteName: account.name,
        lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
        queryLookbackDays: GSC_QUERY_LOOKBACK_DAYS,
        totals: {
          clicks: totals.clicks,
          impressions: totals.impressions,
          ctr: totals.ctr,
          avgPosition: totals.avgPosition,
        },
        days: totals.days,
        queries,
        answerQueries,
        unseenAnswerQueries,
        positionBands: gscPositionBands(allQueries),
        queryCount: allQueries.length,
      };
    }),

  getSiteSeoAudit: organizationAdminProcedure
    .input(z.object({ brandId: z.string().min(1).optional() }).optional())
    .query(async ({ input, ctx }) => {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input?.brandId);
      const brands = await ctx.prisma.brand.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input?.brandId ? { id: input.brandId } : {}),
        },
        select: { id: true, website: true, slug: true },
        orderBy: { name: "asc" },
      });
      const brand =
        brands.find((row) => Boolean(row.website)) ??
        brands[0];
      const homepageUrl = brand ? resolveBrandWebsite(brand) : null;
      if (!homepageUrl) return emptySiteSeoReport(null);

      const origin = shopOrigin(homepageUrl);
      const robotsUrl = origin ? `${origin}/robots.txt` : null;
      const sitemapUrl = origin ? `${origin}/sitemap.xml` : null;
      const llmsUrl = origin ? `${origin}/llms.txt` : null;
      const [homepage, robots, llms] = await Promise.all([
        fetchSiteDoc(homepageUrl),
        robotsUrl ? fetchSiteDoc(robotsUrl) : Promise.resolve(null),
        llmsUrl ? fetchSiteDoc(llmsUrl) : Promise.resolve(null),
      ]);
      const robotsParsed = robots?.fetched
        ? parseRobotsTxt(robots.text)
        : { fetched: false, sitemapUrls: [] as string[], preview: "" };
      const sitemapTarget = robotsParsed.sitemapUrls[0] ?? sitemapUrl;
      const sitemap = sitemapTarget ? await fetchSiteDoc(sitemapTarget) : null;
      return assembleSiteSeo({
        homepageUrl,
        homepage,
        robots,
        sitemap,
        llms,
      });
    }),
});
