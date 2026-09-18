/**
 * Google Ads network-split (Search / Search partners / Display / YouTube)
 * daily metrics.
 *
 * GAQL exposes `segments.ad_network_type` only when it is selected, and the
 * per-campaign rows in DailyMetric deliberately stay network-agnostic so the
 * same spend is never stored twice. Network rows live in their own table
 * keyed by (date, adAccountId, campaignId, networkType); the account currency
 * is validated once per sync by the caller, so rows inherit that currency.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  googleAdsLoginCustomerId,
  googleAdsSearchRows,
  parseGoogleAdsCustomerId,
} from "@/lib/google-ads-accounts";
import type { DateRange } from "@/lib/mcp/types";
import {
  DAILY_METRIC_DATE_WINDOW,
  DAILY_METRIC_INSERT_CHUNK,
  chunkArray,
  roundToScale,
  toPgInt,
  windowSortedDates,
} from "@/lib/sync/daily-metric-rows";
import { validateGoogleDateRange } from "./fetchers";

export interface GoogleNetworkMetricInput {
  date: string;
  campaignId: string;
  campaignName?: string;
  networkType: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

interface GoogleNetworkMetricRow {
  segments: { date: string; adNetworkType?: string };
  campaign: { id?: string; name?: string };
  metrics: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: string;
    conversionsValue?: string;
  };
}

async function withSerializableRetry<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code !== "P2034") throw error;
    }
  }
  throw lastError;
}

function googleNetworkNumber(value: string | undefined): number {
  // Unset numeric protobuf fields are valid zero; malformed supplied values are not.
  if (value === undefined) return 0;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid Google Ads metric value");
  if (String(value).trim() === "") throw new Error("Invalid Google Ads metric value");
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid Google Ads metric value");
  return number;
}

function validNetworkDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Fetch daily campaign metrics segmented by ad network via GAQL searchStream.
 * The caller passes an already-refreshed access token; OAuth refresh handling
 * lives in the sync route.
 */
export async function fetchGoogleNetworkSplit(
  accessToken: string,
  customerId: string,
  dateRange: DateRange,
): Promise<GoogleNetworkMetricInput[]> {
  const { startDate, endDate } = dateRange;
  validateGoogleDateRange(dateRange);
  const cid = parseGoogleAdsCustomerId(customerId);
  if (!cid) {
    throw new Error("Pick a Google Ads account on Connections before syncing.");
  }

  const gaqlQuery = `
    SELECT segments.date, segments.ad_network_type, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `.trim();

  const rows = await googleAdsSearchRows<GoogleNetworkMetricRow>(
    accessToken,
    cid,
    gaqlQuery,
    googleAdsLoginCustomerId(customerId),
  );

  return rows.map((r) => {
    const networkType = r?.segments?.adNetworkType?.trim().toUpperCase();
    if (
      !r?.campaign?.id ||
      !/^\d+$/.test(r.campaign.id) ||
      !r.segments?.date ||
      !validNetworkDate(r.segments.date) ||
      r.segments.date < startDate ||
      r.segments.date > endDate ||
      !networkType ||
      !r.metrics
    ) {
      throw new Error("Invalid Google Ads network split row");
    }
    return {
      date: r.segments.date,
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      networkType,
      spend: googleNetworkNumber(r.metrics.costMicros) / 1_000_000,
      impressions: googleNetworkNumber(r.metrics.impressions),
      clicks: googleNetworkNumber(r.metrics.clicks),
      conversions: googleNetworkNumber(r.metrics.conversions),
      conversionValue: googleNetworkNumber(r.metrics.conversionsValue),
    };
  });
}

/**
 * Persist network-split rows for one ad account. Dates present in this batch
 * are replaced (delete+insert per date window, one serializable transaction)
 * so a re-sync restates history without wiping days that already landed.
 */
export async function upsertGoogleNetworkSplit(
  metrics: GoogleNetworkMetricInput[],
  adAccountId: string,
  currency = "EUR",
): Promise<number> {
  if (metrics.length === 0) return 0;

  const unique = new Map<string, GoogleNetworkMetricInput>();
  for (const row of metrics) {
    unique.set(`${row.date}\0${row.campaignId}\0${row.networkType}`, row);
  }
  const byDate = new Map<string, GoogleNetworkMetricInput[]>();
  for (const row of unique.values()) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  let written = 0;
  for (const dateWindow of windowSortedDates([...byDate.keys()], DAILY_METRIC_DATE_WINDOW)) {
    const rows = dateWindow.flatMap((date) => byDate.get(date) ?? []);
    const data = rows.map((row) => ({
      date: new Date(row.date),
      adAccountId,
      campaignId: row.campaignId,
      campaignName: row.campaignName ?? null,
      networkType: row.networkType,
      currency,
      spend: roundToScale(row.spend, 4),
      impressions: toPgInt(row.impressions),
      clicks: toPgInt(row.clicks),
      conversions: roundToScale(row.conversions, 2),
      conversionValue: roundToScale(row.conversionValue, 4),
    }));
    const dateObjs = dateWindow.map((date) => new Date(date));

    await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await tx.googleNetworkDailyMetric.deleteMany({
            where: { adAccountId, date: { in: dateObjs } },
          });
          for (const chunk of chunkArray(data, DAILY_METRIC_INSERT_CHUNK)) {
            await tx.googleNetworkDailyMetric.createMany({ data: chunk });
          }
        },
        {
          maxWait: 10_000,
          timeout: 30_000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
    written += data.length;
  }

  return written;
}
