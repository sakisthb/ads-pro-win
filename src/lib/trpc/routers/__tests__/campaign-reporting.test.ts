/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  adAccount: { findFirst: jest.fn(), findMany: jest.fn() },
  dailyMetric: { groupBy: jest.fn(), findMany: jest.fn() }, adCampaign: { findMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {}, organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn().mockResolvedValue({ organizationId: "org-1", membership: { role: "viewer" } }),
}));

import { prisma } from "@/lib/db";
import { marketingRouter } from "@/lib/trpc/routers/marketing";

const caller = () => marketingRouter.createCaller({ session: { user: { id: "user-1" }, expires: "2099-01-01" }, prisma });
const windowInput = { startDate: "2026-08-17", endDate: "2026-09-16" };
const metric = (adAccountId: string, spend: number) => ({
  adAccountId, campaignId: "123", campaignName: "Old metric name", platform: "google", currency: "EUR",
  _sum: { spend, impressions: 100, clicks: 10, conversions: 1, conversionValue: 40 },
});
const object = (adAccountId: string, name: string, status = "active") => ({
  adAccountId, platformCampaignId: "123", platform: "google", name, status, currency: "EUR",
  dailyBudget: 20, adAccount: { id: adAccountId, name: `${adAccountId} name`, accountId: `${adAccountId} provider`, currency: "EUR" },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-1", settings: null } as never);
  jest.mocked(prisma.brand.findUnique).mockResolvedValue({ id: "brand-1", organizationId: "org-1" } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ marketMode: "mixed" } as never);
  jest.mocked(prisma.brand.findMany).mockResolvedValue([]);
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({ id: "acc-a" } as never);
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue([]);
  jest.mocked(prisma.dailyMetric.groupBy).mockResolvedValue([]);
  jest.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([]);
});

it("applies platform/account/organization/date scope to metrics and inventory", async () => {
  await caller().getCampaignPerformance({ ...windowInput, brandId: "brand-1", platform: "google", adAccountId: "acc-a" } as never);
  expect(prisma.dailyMetric.groupBy).toHaveBeenCalledWith(expect.objectContaining({
    by: ["adAccountId", "campaignId", "platform", "currency"],
    where: expect.objectContaining({ platform: "google", adAccountId: "acc-a", date: {
      gte: new Date("2026-08-17T00:00:00Z"), lte: new Date("2026-09-16T23:59:59.999Z"),
    }, adAccount: { brand: { organizationId: "org-1", id: "brand-1" } } }),
  }));
  expect(prisma.adCampaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
    platform: "google", adAccountId: "acc-a", adAccount: { brand: { organizationId: "org-1", id: "brand-1" } },
  }) }));
});

it("rejects an inaccessible or wrong-brand account before metrics", async () => {
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue(null);
  await expect(caller().getCampaignPerformance({ ...windowInput, brandId: "brand-1", adAccountId: "foreign" } as never))
    .rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled();
});

it("keeps same provider campaign IDs separate by account and uses current object names", async () => {
  jest.mocked(prisma.dailyMetric.groupBy).mockResolvedValue([metric("acc-a", 10), metric("acc-b", 30)] as never);
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([object("acc-a", "Current A"), object("acc-b", "Current B")] as never);
  const { data } = await caller().getCampaignPerformance(windowInput);
  expect(data.campaigns).toHaveLength(2);
  expect(data.campaigns).toEqual(expect.arrayContaining([
    expect.objectContaining({ adAccountId: "acc-a", campaignName: "Current A", totalSpend: 10, currency: "EUR" }),
    expect.objectContaining({ adAccountId: "acc-b", campaignName: "Current B", totalSpend: 30, currency: "EUR" }),
  ]));
});

it("applies search/status before limit and computes full filtered totals", async () => {
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([
    object("acc-a", "Winter Bags"), object("acc-b", "winter paused", "paused"), object("acc-c", "Other"),
    { ...object("acc-d", "Winter new"), platformCampaignId: "456" },
  ] as never);
  const { data } = await caller().getCampaignPerformance({ ...windowInput, status: "active", search: "WINTER", limit: 1 } as never);
  expect(data.campaigns).toHaveLength(1);
  expect(data.campaigns[0].campaignName).toMatch(/Winter/);
  expect(data).toMatchObject({ totals: { campaigns: 2, active: 2, storedMetricCampaigns: 0, unverifiedCampaigns: 2 }, truncated: true });
});

it.each([
  { startDate: "2026-02-30", endDate: "2026-03-05" },
  { startDate: "2026-09-17", endDate: "2026-09-16" },
])("rejects invalid reporting windows before querying metrics: %j", async (input) => {
  await expect(caller().getCampaignPerformance(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled();
});

it("returns exact storage window and marks inventory without metrics as unverified", async () => {
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([object("acc-a", "Current A")] as never);
  const { data } = await caller().getCampaignPerformance(windowInput);
  expect(data).toMatchObject({ window: windowInput, coverage: "stored_only_not_provider_verified" });
  expect(data.campaigns[0]).toMatchObject({ adAccountId: "acc-a", metricState: "no_stored_metrics", currency: "EUR" });
});

it("supports a bounded complete audit inventory above the legacy 200-row display cap", async () => {
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue(Array.from({length:300},(_,i)=>({
    ...object("acc-a", `Fixture campaign ${i}`), platformCampaignId:`fixture-${i}`,
  })) as never);
  const {data}=await caller().getCampaignPerformance({...windowInput,limit:1000});
  expect(data.campaigns).toHaveLength(300);
  expect(data.truncated).toBe(false);
  expect(data.totals.campaigns).toBe(300);
  await expect(caller().getCampaignPerformance({...windowInput,limit:1001})).rejects.toMatchObject({code:"BAD_REQUEST"});
});

it("does not add different currencies into one spend total", async () => {
  jest.mocked(prisma.dailyMetric.groupBy).mockResolvedValue([metric("acc-a", 10), { ...metric("acc-b", 30), currency: "USD" }] as never);
  const { data } = await caller().getCampaignPerformance(windowInput);
  expect(data).toMatchObject({ totals: { spendByCurrency: { EUR: 10, USD: 30 }, storedMetricCampaigns: 2 } });
});

it("lists owned account metadata without credentials or refresh calls", async () => {
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue([{ id: "acc-a", name: "Fixture account" }] as never);
  const result = await caller().getCampaignReportAccounts({ brandId: "brand-1", platform: "google" });
  expect(result.accounts).toEqual([{ id: "acc-a", name: "Fixture account" }]);
  expect(prisma.adAccount.findMany).toHaveBeenCalledWith({
    where: { platform: "google", brand: { organizationId: "org-1", id: "brand-1" } },
    select: { id: true, accountId: true, name: true, platform: true, currency: true }, orderBy: { name: "asc" },
  });
});

it("rejects foreign brands before listing report accounts", async () => {
  jest.mocked(prisma.brand.findUnique).mockResolvedValue({ id: "brand-1", organizationId: "foreign" } as never);
  await expect(caller().getCampaignReportAccounts({ brandId: "brand-1" })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Brand not found" });
  expect(prisma.adAccount.findMany).not.toHaveBeenCalled();
});
