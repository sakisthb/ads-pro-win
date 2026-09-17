import { prisma } from "@/lib/db";
import { GOOGLE_ADS_API_VERSION, googleAdsLoginCustomerId, parseGoogleAdsCustomerId } from "@/lib/google-ads-accounts";
import { ensureFreshGoogleAccessToken } from "@/lib/oauth/google-refresh";
import { cleanupAccountLevelRows, fetchGoogleAccountData, upsertAdCampaigns, upsertDailyMetrics, validateGoogleDateRange } from "./fetchers";
import type { DateRange } from "@/lib/mcp/types";

interface GoogleImportInput {
  syncJobId: string;
  executionPath: "manual" | "worker";
  account: { id: string; accountId: string; accessToken: string | null; refreshToken: string | null; tokenExpiry: Date | null; currency: string };
  dateRange: DateRange;
}

/** Reporting-only. Caller creates the running SyncJob and persists job failures. */
export async function syncGoogleReporting({ syncJobId, executionPath, account, dateRange }: GoogleImportInput): Promise<{ recordsProcessed: number }> {
  validateGoogleDateRange(dateRange);
  const customerId = parseGoogleAdsCustomerId(account.accountId);
  if (!customerId) throw new Error("Invalid Google Ads customer identity");

  // No provider call or import is allowed without a durable initial receipt.
  await prisma.syncCoverageReceipt.create({ data: {
    syncJobId, customerId, loginCustomerId: googleAdsLoginCustomerId(account.accountId) ?? null,
    startDate: dateRange.startDate, endDate: dateRange.endDate, executionPath,
    providerApiVersion: GOOGLE_ADS_API_VERSION, transport: "google_ads_search_stream",
    queryScope: "non_removed_campaigns", status: "running", stage: "credentials",
  } });

  let stage = "credentials";
  let storageMayBePartial = false;
  const evidence: {
    providerTimezone: string | null; providerCurrency: string | null;
    metricRowsFetched: number | null; campaignRowsFetched: number | null;
    metricRowsPersisted: number | null; campaignRowsPersisted: number | null;
  } = { providerTimezone: null, providerCurrency: null, metricRowsFetched: null, campaignRowsFetched: null, metricRowsPersisted: null, campaignRowsPersisted: null };
  const checkpoint = () => prisma.syncCoverageReceipt.update({ where: { syncJobId }, data: { ...evidence, stage, storageMayBePartial } });
  try {
    if (!account.accessToken) throw new Error("No Google Ads access token stored");
    const accessToken = await ensureFreshGoogleAccessToken({ id: account.id, accessToken: account.accessToken, refreshToken: account.refreshToken, tokenExpiry: account.tokenExpiry }, "ads");
    stage = "fetch";
    await checkpoint();
    const { metrics, campaigns, account: provider } = await fetchGoogleAccountData(accessToken, account.accountId, dateRange);
    Object.assign(evidence, { providerTimezone: provider.timezone, providerCurrency: provider.currency, metricRowsFetched: metrics.length, campaignRowsFetched: campaigns.length });
    if (provider.currency !== account.currency) {
      throw new Error("Google Ads currency differs from stored account; review connector identity before Sync");
    }

    stage = "metrics";
    // Persist the risk flag BEFORE entering a non-atomic batched import.
    storageMayBePartial = true;
    await checkpoint();
    evidence.metricRowsPersisted = await upsertDailyMetrics(metrics, account.id, "google");
    stage = "campaigns";
    await checkpoint();
    evidence.campaignRowsPersisted = await upsertAdCampaigns(campaigns, account.id, "google", provider.currency);
    stage = "cleanup";
    await checkpoint();
    if (metrics.length > 0) await cleanupAccountLevelRows(account.id, "google");

    const recordsProcessed = evidence.metricRowsPersisted + evidence.campaignRowsPersisted;
    const completedAt = new Date();
    stage = "finalize";
    await checkpoint();
    // Commit the successful receipt, job and freshness timestamp atomically.
    await prisma.$transaction([
      prisma.syncCoverageReceipt.update({ where: { syncJobId }, data: { ...evidence, status: "completed", stage: "completed", storageMayBePartial: false, completedAt } }),
      prisma.syncJob.update({ where: { id: syncJobId }, data: { status: "completed", completedAt, recordsProcessed, error: null } }),
      prisma.adAccount.update({ where: { id: account.id }, data: { lastSyncAt: completedAt } }),
    ]);
    return { recordsProcessed };
  } catch (error) {
    try {
      await prisma.syncCoverageReceipt.update({ where: { syncJobId }, data: { ...evidence, status: storageMayBePartial ? "partial" : "failed", stage, storageMayBePartial, completedAt: new Date() } });
    } catch {
      // Preserve the original failure; never serialize credentials/raw payloads.
      console.error("Failed to persist Google reporting failure receipt");
    }
    throw error;
  }
}
