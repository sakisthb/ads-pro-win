/** @jest-environment node */
import type { Job } from "bullmq";
import type { MetricSyncJobData } from "@/lib/workers/queues";
jest.mock("@/lib/config", () => ({ config: { features: { mcpEnabled: true, woocommerceEnabled: true }, marketing: { google: {} } } }));
jest.mock("@/lib/workers/redis-connection", () => ({ createRedisConnection: jest.fn(() => ({})) }));
jest.mock("bullmq", () => ({ Worker: jest.fn(), Queue: jest.fn() }));
jest.mock("@/lib/security-events", () => ({ logSecurityEvent: jest.fn() }));
jest.mock("@/lib/crypto", () => ({ decrypt: jest.fn(() => "test-token") }));
jest.mock("@/lib/db", () => ({ prisma: {
  adAccount: { findUnique: jest.fn(), update: jest.fn() },
  syncJob: { create: jest.fn().mockResolvedValue({ id: "job-1" }), update: jest.fn() },
  syncCoverageReceipt: { create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
} }));
jest.mock("@/lib/oauth/google-refresh", () => ({ ensureFreshGoogleAccessToken: jest.fn().mockResolvedValue("fresh-test-token") }));
jest.mock("@/lib/mcp/adapters/google-ads", () => ({ GoogleAdsAdapter: jest.fn(() => { throw new Error("Google worker must not depend on MCP"); }) }));
jest.mock("@/lib/sync/fetchers", () => ({
  validateGoogleDateRange: jest.requireActual("@/lib/sync/fetchers").validateGoogleDateRange,
  fetchGoogleAccountData: jest.fn(), upsertDailyMetrics: jest.fn().mockResolvedValue(0),
  upsertAdCampaigns: jest.fn().mockResolvedValue(1), cleanupAccountLevelRows: jest.fn(),
}));
jest.mock("@/lib/sync/google-network-split", () => ({ fetchGoogleNetworkSplit: jest.fn().mockResolvedValue([]), upsertGoogleNetworkSplit: jest.fn().mockResolvedValue(0) }));

import { prisma } from "@/lib/db";
import { ensureFreshGoogleAccessToken } from "@/lib/oauth/google-refresh";
import { fetchGoogleAccountData, upsertAdCampaigns, upsertDailyMetrics, cleanupAccountLevelRows } from "@/lib/sync/fetchers";
import { processMetricSync } from "@/lib/workers/sync-processor";

const account = { id: "acc-1", brandId: "brand-1", platform: "google", accountId: "gadsacct:brand-1:1234567890:9876543210", isActive: true, accessToken: "encrypted-test-token", refreshToken: "encrypted-test-refresh", tokenExpiry: new Date("2026-09-01"), currency: "EUR" };
const campaigns = [{ platformCampaignId: "100", name: "Winter PMax", status: "active" }];
const job = { data: { adAccountId: "acc-1", platform: "google", startDate: "2026-08-17", endDate: "2026-09-16", isDelta: false } } as Job<MetricSyncJobData>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.adAccount.findUnique).mockResolvedValue(account as never);
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [], campaigns, account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
});

it("uses refreshed direct Google reporting with the stored MCC hint and persists inventory even for zero metrics", async () => {
  await processMetricSync(job);
  expect(ensureFreshGoogleAccessToken).toHaveBeenCalledWith(expect.objectContaining({ id: "acc-1", accessToken: "encrypted-test-token" }), "ads");
  expect(fetchGoogleAccountData).toHaveBeenCalledWith("fresh-test-token", account.accountId, { startDate: "2026-08-17", endDate: "2026-09-16" });
  expect(upsertAdCampaigns).toHaveBeenCalledWith(campaigns, "acc-1", "google", "EUR");
  expect(cleanupAccountLevelRows).not.toHaveBeenCalled();
  expect(prisma.syncJob.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ brandId: "brand-1" }) }));
  expect(prisma.syncJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", recordsProcessed: 1 }) }));
});

it("does not mark a failed inventory fetch completed or advance lastSyncAt", async () => {
  jest.mocked(fetchGoogleAccountData).mockRejectedValue(new Error("inventory unavailable"));
  await expect(processMetricSync(job)).rejects.toThrow("inventory unavailable");
  expect(prisma.syncJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
  expect(prisma.adAccount.update).not.toHaveBeenCalled();
  expect(upsertDailyMetrics).not.toHaveBeenCalled();
});

it.each([{ platform: "meta" }, { isActive: false }])("rejects queued jobs for a mismatched or inactive account %j", async (override) => {
  jest.mocked(prisma.adAccount.findUnique).mockResolvedValue({ ...account, ...override } as never);
  await expect(processMetricSync(job)).rejects.toThrow(/inactive|platform/i);
  expect(fetchGoogleAccountData).not.toHaveBeenCalled();
  expect(prisma.syncJob.create).not.toHaveBeenCalled();
});

it("resolves repeatable Google job dates relative to execution time", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-09-17T08:00:00Z"));
  try {
    await processMetricSync({ data: { ...job.data, startDate: "", endDate: "" } } as Job<MetricSyncJobData>);
    expect(fetchGoogleAccountData).toHaveBeenCalledWith("fresh-test-token", account.accountId, { startDate: "2026-08-18", endDate: "2026-09-17" });
    expect(prisma.syncCoverageReceipt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ executionPath: "worker", startDate: "2026-08-18", endDate: "2026-09-17" }) }));
  } finally { jest.useRealTimers(); }
});
