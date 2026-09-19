/** @jest-environment node */
jest.mock("@/lib/db", () => ({ prisma: {
  syncCoverageReceipt: { create: jest.fn(), update: jest.fn() },
  syncJob: { update: jest.fn() }, adAccount: { update: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
} }));
jest.mock("@/lib/oauth/google-refresh", () => ({ ensureFreshGoogleAccessToken: jest.fn().mockResolvedValue("fresh-fixture-token") }));
jest.mock("@/lib/sync/fetchers", () => ({
  ...jest.requireActual("@/lib/sync/fetchers"),
  fetchGoogleAccountData: jest.fn(), upsertDailyMetrics: jest.fn(), upsertAdCampaigns: jest.fn(), cleanupAccountLevelRows: jest.fn(),
}));
jest.mock("@/lib/sync/google-network-split", () => ({
  fetchGoogleNetworkSplit: jest.fn(), upsertGoogleNetworkSplit: jest.fn(),
}));
import { prisma } from "@/lib/db";
import { ensureFreshGoogleAccessToken } from "@/lib/oauth/google-refresh";
import { fetchGoogleAccountData, upsertDailyMetrics, upsertAdCampaigns, cleanupAccountLevelRows } from "@/lib/sync/fetchers";
import { fetchGoogleNetworkSplit, upsertGoogleNetworkSplit } from "@/lib/sync/google-network-split";
import { syncGoogleReporting } from "@/lib/sync/google-coverage-import";

const input = {
  syncJobId: "job-1", executionPath: "manual" as const,
  account: { id: "acc-1", accountId: "gadsacct:brand:1234567890:9876543210", accessToken: "encrypted-fixture", refreshToken: null, tokenExpiry: null, currency: "EUR" },
  dateRange: { startDate: "2026-08-17", endDate: "2026-09-16" },
};
const metric = { date: "2026-09-01", spend: 1, impressions: 1, clicks: 1, conversions: 0, conversionValue: 0, campaignId: "100" };
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(prisma.$transaction).mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[]) as never);
  jest.mocked(ensureFreshGoogleAccessToken).mockResolvedValue("fresh-fixture-token");
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [], campaigns: [{ platformCampaignId: "100", name: "Fixture campaign", status: "active" }], account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
  jest.mocked(upsertDailyMetrics).mockResolvedValue(0);
  jest.mocked(upsertAdCampaigns).mockResolvedValue(1);
  jest.mocked(fetchGoogleNetworkSplit).mockResolvedValue([]);
  jest.mocked(upsertGoogleNetworkSplit).mockResolvedValue(0);
});

it("completes inventory-only reporting without pretending inventory is metric coverage", async () => {
  expect(await syncGoogleReporting(input)).toEqual({ recordsProcessed: 1 });
  expect(prisma.syncCoverageReceipt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerApiVersion: "v25", transport: "google_ads_search_stream", queryScope: "enabled_paused_removed_campaigns" }) }));
  expect(prisma.syncCoverageReceipt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", metricRowsFetched: 0, campaignRowsFetched: 1, metricRowsPersisted: 0, campaignRowsPersisted: 1, networkRowsFetched: 0, networkRowsPersisted: 0, providerTimezone: "Europe/Athens", storageMayBePartial: false }) }));
  expect(jest.mocked(prisma.$transaction).mock.calls[0][0]).toHaveLength(3);
  expect(cleanupAccountLevelRows).not.toHaveBeenCalled();
});

it("fails before credential/provider requests if a durable receipt cannot be created", async () => {
  jest.mocked(prisma.syncCoverageReceipt.create).mockRejectedValueOnce(new Error("receipt unavailable"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("receipt unavailable");
  expect(ensureFreshGoogleAccessToken).not.toHaveBeenCalled();
  expect(upsertDailyMetrics).not.toHaveBeenCalled();
});

it("records fetch failure with unknown counts, not fabricated empty reporting", async () => {
  jest.mocked(fetchGoogleAccountData).mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("provider unavailable");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed", stage: "fetch", metricRowsFetched: null, campaignRowsFetched: null, metricRowsPersisted: null, storageMayBePartial: false }) }));
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it("records unknown partial metric persistence without completing or advancing lastSyncAt", async () => {
  jest.mocked(upsertDailyMetrics).mockRejectedValueOnce(new Error("batch failed"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("batch failed");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "partial", stage: "metrics", metricRowsPersisted: null, storageMayBePartial: true }) }));
  expect(prisma.adAccount.update).not.toHaveBeenCalled();
  expect(upsertAdCampaigns).not.toHaveBeenCalled();
});

it("retains known metric counts when inventory persistence partially fails", async () => {
  jest.mocked(upsertAdCampaigns).mockRejectedValueOnce(new Error("inventory batch failed"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("inventory batch failed");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "partial", stage: "campaigns", metricRowsPersisted: 0, campaignRowsPersisted: null, storageMayBePartial: true }) }));
});

it("records finalization failure as partial even when all import counts are known", async () => {
  jest.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("finalization failed"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("finalization failed");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "partial", stage: "finalize", metricRowsPersisted: 0, campaignRowsPersisted: 1, storageMayBePartial: true }) }));
});

it("does not lose the original failure if the failure receipt cannot be persisted", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    jest.mocked(fetchGoogleAccountData).mockRejectedValueOnce(new Error("original provider failure"));
    jest.mocked(prisma.syncCoverageReceipt.update).mockResolvedValueOnce({} as never).mockRejectedValue(new Error("audit database unavailable"));
    await expect(syncGoogleReporting(input)).rejects.toThrow("original provider failure");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});

it("uses provider currency and cleans up legacy aggregates only for actual metric rows", async () => {
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [metric], campaigns: [], account: { customerId: "1234567890", timezone: "America/New_York", currency: "USD" } });
  jest.mocked(upsertDailyMetrics).mockResolvedValue(1);
  jest.mocked(upsertAdCampaigns).mockResolvedValue(0);
  await syncGoogleReporting({ ...input, account: { ...input.account, currency: "USD" } });
  expect(upsertDailyMetrics).toHaveBeenCalledWith([metric], "acc-1", "google", "USD");
  expect(upsertAdCampaigns).toHaveBeenCalledWith([], "acc-1", "google", "USD");
  expect(cleanupAccountLevelRows).toHaveBeenCalledWith("acc-1", "google");
});

it("rejects currency mismatch before importing native spend under an incorrect stored currency", async () => {
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [metric], campaigns: [], account: { customerId: "1234567890", timezone: "America/New_York", currency: "USD" } });
  await expect(syncGoogleReporting(input)).rejects.toThrow(/currency.*stored account/i);
  expect(upsertDailyMetrics).not.toHaveBeenCalled();
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed", stage: "fetch", providerCurrency: "USD", storageMayBePartial: false }) }));
});

it("records credential failure before reporting with unknown provider evidence", async () => {
  jest.mocked(ensureFreshGoogleAccessToken).mockRejectedValueOnce(new Error("credential unavailable"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("credential unavailable");
  expect(fetchGoogleAccountData).not.toHaveBeenCalled();
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed", stage: "credentials", storageMayBePartial: false, providerTimezone: null, metricRowsFetched: null }) }));
});

it("records cleanup failure as partial after both imports with known counts", async () => {
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [metric], campaigns: [], account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
  jest.mocked(upsertDailyMetrics).mockResolvedValue(1);
  jest.mocked(upsertAdCampaigns).mockResolvedValue(0);
  jest.mocked(cleanupAccountLevelRows).mockRejectedValueOnce(new Error("cleanup failed"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("cleanup failed");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "partial", stage: "cleanup", metricRowsPersisted: 1, campaignRowsPersisted: 0 }) }));
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

const networkRows = [{ date: "2026-09-01", campaignId: "100", campaignName: "Fixture campaign", networkType: "SEARCH", spend: 1, impressions: 1, clicks: 1, conversions: 0, conversionValue: 0 }];

it("persists the Search/Display network split with the same sync evidence", async () => {
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [metric], campaigns: [], account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
  jest.mocked(upsertDailyMetrics).mockResolvedValue(1);
  jest.mocked(upsertAdCampaigns).mockResolvedValue(0);
  jest.mocked(fetchGoogleNetworkSplit).mockResolvedValue(networkRows);
  jest.mocked(upsertGoogleNetworkSplit).mockResolvedValue(1);
  expect(await syncGoogleReporting(input)).toEqual({ recordsProcessed: 2 });
  expect(fetchGoogleNetworkSplit).toHaveBeenCalledWith("fresh-fixture-token", input.account.accountId, input.dateRange);
  expect(upsertGoogleNetworkSplit).toHaveBeenCalledWith(networkRows, "acc-1", "EUR");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", networkRowsFetched: 1, networkRowsPersisted: 1 }) }));
});

it("records network split persistence failure as partial before any finalization", async () => {
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [metric], campaigns: [], account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
  jest.mocked(upsertDailyMetrics).mockResolvedValue(1);
  jest.mocked(upsertAdCampaigns).mockResolvedValue(0);
  jest.mocked(fetchGoogleNetworkSplit).mockResolvedValue(networkRows);
  jest.mocked(upsertGoogleNetworkSplit).mockRejectedValueOnce(new Error("network batch failed"));
  await expect(syncGoogleReporting(input)).rejects.toThrow("network batch failed");
  expect(prisma.syncCoverageReceipt.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "partial", stage: "metrics", metricRowsPersisted: 1, networkRowsFetched: 1, networkRowsPersisted: null, storageMayBePartial: true }) }));
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
