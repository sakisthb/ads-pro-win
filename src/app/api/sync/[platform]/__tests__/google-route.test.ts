/** @jest-environment node */
import { NextRequest } from "next/server";
jest.mock("@/lib/auth", () => ({ getSession: jest.fn().mockResolvedValue({ userId: "user-1" }) }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {},
  requireOrganizationRoleForUser: jest.fn().mockResolvedValue({ organizationId: "org-1" }),
  requireOwnedBrand: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/crypto", () => ({ decrypt: jest.fn(() => "test-token"), encrypt: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  adAccount: { findFirst: jest.fn(), update: jest.fn() },
  syncJob: { create: jest.fn().mockResolvedValue({ id: "job-1" }), update: jest.fn() },
  syncCoverageReceipt: { create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
} }));
jest.mock("@/lib/oauth/google-refresh", () => ({ ensureFreshGoogleAccessToken: jest.fn().mockResolvedValue("fresh-test-token") }));
jest.mock("@/lib/sync/fetchers", () => ({
  validateGoogleDateRange: jest.requireActual("@/lib/sync/fetchers").validateGoogleDateRange,
  fetchGoogleMetrics: jest.fn().mockResolvedValue([]), fetchGoogleAccountData: jest.fn(),
  upsertDailyMetrics: jest.fn().mockResolvedValue(0), upsertAdCampaigns: jest.fn().mockResolvedValue(1), cleanupAccountLevelRows: jest.fn(),
}));
jest.mock("@/lib/sync/google-network-split", () => ({ fetchGoogleNetworkSplit: jest.fn().mockResolvedValue([]), upsertGoogleNetworkSplit: jest.fn().mockResolvedValue(0) }));
import { prisma } from "@/lib/db";
import { fetchGoogleAccountData, upsertAdCampaigns } from "@/lib/sync/fetchers";
import { POST } from "../route";

const campaigns = [{ platformCampaignId: "100", name: "Winter PMax", status: "active" }];
const run = () => POST(new NextRequest("http://localhost:3000/api/sync/google", { method: "POST", body: JSON.stringify({ brandId: "brand-1", startDate: "2026-08-17", endDate: "2026-09-16" }) }), { params: Promise.resolve({ platform: "google" }) });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({ id: "acc-1", brandId: "brand-1", accountId: "gadsacct:brand-1:1234567890:9876543210", platform: "google", isActive: true, accessToken: "encrypted-test-token", refreshToken: null, tokenExpiry: null, currency: "EUR" } as never);
  jest.mocked(fetchGoogleAccountData).mockResolvedValue({ metrics: [], campaigns, account: { customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" } });
});

it("persists inventory independently of metrics in the manual Google sync path", async () => {
  const response = await run();
  expect(response.status).toBe(200);
  expect(upsertAdCampaigns).toHaveBeenCalledWith(campaigns, "acc-1", "google", "EUR");
  expect(await response.json()).toEqual(expect.objectContaining({ recordsSynced: 1 }));
});

it("records inventory failure without advancing lastSyncAt", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    jest.mocked(fetchGoogleAccountData).mockRejectedValue(new Error("inventory unavailable"));
    expect((await run()).status).toBe(500);
    expect(prisma.adAccount.update).not.toHaveBeenCalled();
    expect(prisma.syncJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
  } finally { log.mockRestore(); }
});

it("records the exact manual window and separate zero-metric / nonzero-inventory counts", async () => {
  const response = await run();
  expect(prisma.syncCoverageReceipt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    syncJobId: "job-1", customerId: "1234567890", loginCustomerId: "9876543210", executionPath: "manual",
    startDate: "2026-08-17", endDate: "2026-09-16", status: "running",
  }) }));
  expect(prisma.syncCoverageReceipt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    status: "completed", providerTimezone: "Europe/Athens", metricRowsFetched: 0, campaignRowsFetched: 1,
    metricRowsPersisted: 0, campaignRowsPersisted: 1, networkRowsFetched: 0, networkRowsPersisted: 0, storageMayBePartial: false,
  }) }));
  expect(jest.mocked(prisma.$transaction).mock.calls[0][0]).toHaveLength(3);
  expect(await response.json()).toEqual(expect.objectContaining({ syncJobId: "job-1", recordsSynced: 1 }));
});
