/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findFirst: jest.fn() },
  adAccount: { findMany: jest.fn() }, dailyMetric: { findMany: jest.fn() },
  adCampaign: { findMany: jest.fn() }, wooOrder: { findMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({ OrganizationAuthorizationError: class extends Error {},
  organizationRoles: ["owner", "admin", "member", "viewer"], requireOrganizationRoleForUser: jest.fn() }));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { campaignStudyRouter } from "../campaign-study";

const caller = () => campaignStudyRouter.createCaller({ session: { user: { id: "fixture-user" }, expires: "2099-01-01" }, prisma });
const brandScope = { brandId: "fixture-brand" };

// Prisma.Decimal stand-ins exercise the router's Decimal → number conversion.
const dec = (v: number) => ({ toNumber: () => v }) as never;
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

function purRows() {
  const rows: Record<string, unknown>[] = [];
  for (let d = 1; d <= 16; d += 1) {
    const ds = `2026-07-${String(d).padStart(2, "0")}`;
    rows.push({ date: d === 1 ? "2026-07-01" : day(ds), platform: "meta", adAccountId: "acc-meta", campaignId: "cmp-pur",
      campaignName: "PUR · ΛΙΑΝΙΚΗ Sales", spend: d === 1 ? dec(40) : 40, impressions: 4000, clicks: 160,
      conversions: dec(0), conversionValue: dec(0), linkClicks: 80, landingPageViews: 60, addToCart: dec(0),
      websitePurchases: dec(0), websitePurchaseValue: dec(0) });
  }
  for (let d = 1; d <= 16; d += 1)
    rows.push({ date: day(`2026-08-${String(d).padStart(2, "0")}T00:00:00.000Z`.slice(0, 10)), platform: "meta", adAccountId: "acc-meta",
      campaignId: "cmp-pur", campaignName: "PUR · ΛΙΑΝΙΚΗ Sales", spend: dec(40), impressions: 4000, clicks: 160,
      conversions: dec(0), conversionValue: dec(0), linkClicks: 80, landingPageViews: 60, addToCart: dec(0),
      websitePurchases: dec(0), websitePurchaseValue: dec(0) });
  for (let d = 1; d <= 16; d += 1)
    rows.push({ date: day(`2026-09-${String(d).padStart(2, "0")}T00:00:00.000Z`.slice(0, 10)), platform: "meta", adAccountId: "acc-meta",
      campaignId: "cmp-pur", campaignName: "PUR · ΛΙΑΝΙΚΗ Sales", spend: dec(20), impressions: 2000, clicks: 80,
      conversions: dec(24), conversionValue: dec(5280), linkClicks: 40, landingPageViews: 4, addToCart: dec(30),
      websitePurchases: d === 16 ? dec(24) : dec(0), websitePurchaseValue: d === 16 ? dec(5280) : dec(0) });
  return rows;
}

function googleRows() {
  return [
    { date: day("2025-10-15"), platform: "google", adAccountId: "acc-google", campaignId: "g-shopping", campaignName: "Shopping", spend: dec(1500) },
    { date: day("2025-11-15"), platform: "google", adAccountId: "acc-google", campaignId: "g-shopping", campaignName: "Shopping", spend: dec(1500) },
    { date: day("2025-12-15"), platform: "google", adAccountId: "acc-google", campaignId: "g-shopping", campaignName: "Shopping", spend: dec(1334.49) },
  ];
}

function wooOrders(market: string, month: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({ dateCreated: day(`2026-${month}-10`), status: i % 5 === 0 ? "processing" : "completed",
    market, grossSales: dec(120), source: i % 3 === 0 ? (i % 9 === 0 ? "meta" : "google") : null }));
}

const inventory = [
  { adAccountId: "acc-meta", platform: "meta", platformCampaignId: "cmp-pur", name: "PUR · ΛΙΑΝΙΚΗ Sales", objective: "OUTCOME_SALES", status: "active" },
];

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00.000Z"));
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "member" } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "fixture-org", settings: null } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ id: "fixture-brand", name: "BagToBag" } as never);
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue([
    { id: "acc-meta", platform: "meta" }, { id: "acc-google", platform: "google" }] as never);
  jest.mocked(prisma.dailyMetric.findMany).mockResolvedValue([...purRows(), ...googleRows()] as never);
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue(inventory as never);
  jest.mocked(prisma.wooOrder.findMany).mockResolvedValue([
    ...wooOrders("retail", "07", 10), ...wooOrders("retail", "08", 4), ...wooOrders("retail", "09", 4),
    ...wooOrders("wholesale", "07", 10), ...wooOrders("wholesale", "08", 8), ...wooOrders("wholesale", "09", 9),
  ] as never);
});
afterEach(() => jest.useRealTimers());

describe("campaignStudy.get", () => {
  it("builds a data-derived study from stored rows for the owned brand", async () => {
    const study = await caller().get(brandScope);
    expect(study.asOf).toBe("2026-09-18");
    expect(study.windows.map(w => w.label)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(study.metaCoverage.primaryCampaign?.campaignId).toBe("cmp-pur");
    const funnel = study.purchaseFunnel;
    expect(funnel[0].spendPerDay).toBeCloseTo(40, 5);
    expect(funnel[2].spend).toBeCloseTo(320, 5);
    expect(funnel[2].purchases).toBe(24);
    expect(study.spendCut.status).toBe("sharp");
    expect(study.lpv.status).toBe("broken");
    expect(study.retail.status).toBe("sustained_decline");
    expect(study.wholesale.status).toBe("recovered");
    expect(study.googleCoverage.activeMonths).toEqual(["2025-10", "2025-11", "2025-12"]);
    expect(study.googleCoverage.seasonalOnly).toBe(true);
    expect(study.conclusions.find(c => c.desk === "retail")?.status).toBe("evidence_backed");
    expect(study.conclusions.find(c => c.desk === "branding")?.status).toBe("insufficient_data");
  });
  it("scopes every query to the owned brand and its meta/google accounts", async () => {
    await caller().get(brandScope);
    expect(prisma.adAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      brandId: "fixture-brand", platform: { in: ["meta", "google"] } } }));
    expect(prisma.dailyMetric.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      platform: { in: ["meta", "google"] }, adAccountId: { in: ["acc-meta", "acc-google"] } } }));
    expect(prisma.adCampaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      adAccountId: { in: ["acc-meta", "acc-google"] } } }));
    expect(prisma.wooOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "fixture-brand" } }));
  });
  it("maps inventory platformCampaignId and mixed Decimal/number/date shapes", async () => {
    const study = await caller().get(brandScope);
    expect(study.metaCoverage.primaryCampaign?.campaignId).toBe("cmp-pur");
    expect(study.metaCoverage.primaryCampaign?.name).toBe("PUR · ΛΙΑΝΙΚΗ Sales");
    expect(study.purchaseFunnel[0].daysWithRows).toBe(16);
  });
  it("withholds the study for a brand outside the organization", async () => {
    jest.mocked(prisma.brand.findFirst).mockResolvedValue(null as never);
    await expect(caller().get(brandScope)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.dailyMetric.findMany).not.toHaveBeenCalled();
    expect(prisma.wooOrder.findMany).not.toHaveBeenCalled();
  });
  it("stays available to read-only organization members", async () => {
    const study = await caller().get(brandScope);
    expect(study.metaCoverage.primaryCampaign).not.toBeNull();
  });
  it("returns an explicit insufficient-data study when nothing is stored", async () => {
    jest.mocked(prisma.adAccount.findMany).mockResolvedValue([] as never);
    jest.mocked(prisma.dailyMetric.findMany).mockResolvedValue([] as never);
    jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([] as never);
    jest.mocked(prisma.wooOrder.findMany).mockResolvedValue([] as never);
    const study = await caller().get(brandScope);
    expect(study.metaCoverage.primaryCampaign).toBeNull();
    expect(study.retail.status).toBe("insufficient_data");
    expect(study.wholesale.status).toBe("insufficient_data");
    expect(study.googleCoverage.activeMonths).toEqual([]);
    expect(study.limits.length).toBeGreaterThan(0);
  });
});
