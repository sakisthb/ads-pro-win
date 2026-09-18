/** @jest-environment node */
jest.mock("@/lib/safe-fetch", () => ({ safeFetch: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  googleNetworkDailyMetric: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
} }));

import { safeFetch } from "@/lib/safe-fetch";
import { prisma } from "@/lib/db";
import { fetchGoogleNetworkSplit, upsertGoogleNetworkSplit } from "@/lib/sync/google-network-split";

const range = { startDate: "2026-08-17", endDate: "2026-09-16" };
const fetchMock = jest.mocked(safeFetch);
const respond = (rows: unknown[]) => ({ ok: true, status: 200, text: async () => JSON.stringify([{ results: rows }]) }) as Response;
const splitRow = (networkType: string, costMicros = "150000000") => ({
  campaign: { id: "100", name: "Winter PMax" },
  segments: { date: "2026-09-01", adNetworkType: networkType },
  metrics: { costMicros, impressions: "1000", clicks: "50", conversions: "2", conversionsValue: "240" },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)({
        googleNetworkDailyMetric: {
          deleteMany: prisma.googleNetworkDailyMetric.deleteMany,
          createMany: prisma.googleNetworkDailyMetric.createMany,
        },
      });
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

it("queries segments.ad_network_type and keeps every network row of a campaign-day", async () => {
  fetchMock.mockResolvedValue(respond([splitRow("DISPLAY", "50000000"), splitRow("SEARCH")]));
  const rows = await fetchGoogleNetworkSplit("test-token", "gadsacct:brand:1234567890:9876543210", range);
  expect(rows).toEqual([
    expect.objectContaining({ date: "2026-09-01", campaignId: "100", campaignName: "Winter PMax", networkType: "DISPLAY", spend: 50, impressions: 1000, clicks: 50, conversions: 2, conversionValue: 240 }),
    expect.objectContaining({ networkType: "SEARCH", spend: 150 }),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain("/customers/1234567890/googleAds:searchStream");
  expect(init?.headers).toEqual(expect.objectContaining({ "login-customer-id": "9876543210" }));
  const query = JSON.parse(String(init?.body)).query as string;
  expect(query).toContain("segments.ad_network_type");
  expect(query).toContain("FROM campaign");
  expect(query).toContain("segments.date BETWEEN '2026-08-17' AND '2026-09-16'");
  expect(query).toContain("campaign.status != 'REMOVED'");
});

it.each([
  [{ ...splitRow("SEARCH"), segments: { date: "2026-09-01" } }, "missing network type"],
  [splitRow(""), "empty network type"],
  [{ ...splitRow("SEARCH"), campaign: { id: "abc", name: "Bad id" } }, "non-numeric campaign id"],
  [splitRow("SEARCH", "not-a-number"), "malformed metric value"],
])("rejects malformed network split rows instead of fabricating data (%s)", async (row) => {
  fetchMock.mockResolvedValue(respond([row]));
  await expect(fetchGoogleNetworkSplit("test-token", "1234567890", range)).rejects.toThrow(/Invalid Google Ads/);
});

it("rejects network split dates outside the requested window", async () => {
  fetchMock.mockResolvedValue(respond([{ ...splitRow("SEARCH"), segments: { date: "2026-09-17", adNetworkType: "SEARCH" } }]));
  await expect(fetchGoogleNetworkSplit("test-token", "1234567890", range)).rejects.toThrow(/Invalid Google Ads/);
});

it("replaces only the synced dates per account and persists rows keyed by campaign and network", async () => {
  const rows = [
    { date: "2026-09-01", campaignId: "100", campaignName: "Winter PMax", networkType: "DISPLAY", spend: 50, impressions: 1000, clicks: 50, conversions: 2, conversionValue: 240 },
    { date: "2026-09-01", campaignId: "100", campaignName: "Winter PMax", networkType: "SEARCH", spend: 150, impressions: 1000, clicks: 50, conversions: 2, conversionValue: 240 },
    { date: "2026-09-02", campaignId: "101", campaignName: "Search Brand", networkType: "SEARCH", spend: 10, impressions: 100, clicks: 10, conversions: 1, conversionValue: 30 },
  ];
  jest.mocked(prisma.googleNetworkDailyMetric.createMany).mockResolvedValue({ count: 3 } as never);
  await expect(upsertGoogleNetworkSplit(rows, "acc-1")).resolves.toBe(3);
  expect(prisma.googleNetworkDailyMetric.deleteMany).toHaveBeenCalledWith({
    where: { adAccountId: "acc-1", date: { in: [new Date("2026-09-01"), new Date("2026-09-02")] } },
  });
  expect(prisma.googleNetworkDailyMetric.createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({ date: new Date("2026-09-01"), adAccountId: "acc-1", campaignId: "100", networkType: "DISPLAY", spend: "50.0000" }),
      expect.objectContaining({ networkType: "SEARCH", campaignId: "100" }),
      expect.objectContaining({ date: new Date("2026-09-02"), campaignId: "101" }),
    ]),
  });
});

it("writes nothing for an empty network split batch", async () => {
  await expect(upsertGoogleNetworkSplit([], "acc-1")).resolves.toBe(0);
  expect(prisma.googleNetworkDailyMetric.deleteMany).not.toHaveBeenCalled();
  expect(prisma.googleNetworkDailyMetric.createMany).not.toHaveBeenCalled();
});
