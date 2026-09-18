/** @jest-environment node */
jest.mock("@/lib/safe-fetch", () => ({ safeFetch: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {} }));

import { safeFetch } from "@/lib/safe-fetch";
import { fetchGoogleAccountData } from "@/lib/sync/fetchers";

const range = { startDate: "2026-08-17", endDate: "2026-09-16" };
const fetchMock = jest.mocked(safeFetch);
const respond = (rows: unknown[]) => ({ ok: true, status: 200, text: async () => JSON.stringify([{ results: rows }]) }) as Response;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockImplementation(async (_url, init) => {
    const query = JSON.parse(String(init?.body)).query as string;
    if (query.includes("FROM customer")) return respond([{ customer: { id: "1234567890", timeZone: "Europe/Athens", currencyCode: "EUR" } }]);
    return query.includes("segments.date") ? respond([]) : respond([
      { campaign: { id: "100", name: "Winter PMax", status: "ENABLED", primaryStatus: "ENDED", advertisingChannelType: "PERFORMANCE_MAX" } },
      { campaign: { id: "101", name: "Search", status: "PAUSED", primaryStatus: "PAUSED", advertisingChannelType: "SEARCH" } },
    ]);
  });
});

it("fetches campaign inventory even when the metric window has valid zero activity", async () => {
  const data = await fetchGoogleAccountData("test-token", "gadsacct:brand:1234567890:9876543210", range);
  expect(data.metrics).toEqual([]);
  expect(data.campaigns).toEqual([
    expect.objectContaining({ platformCampaignId: "100", name: "Winter PMax", status: "active", effectiveStatus: "ENDED", objective: "PERFORMANCE_MAX" }),
    expect.objectContaining({ platformCampaignId: "101", status: "paused" }),
  ]);
  expect(data.account).toEqual({ customerId: "1234567890", timezone: "Europe/Athens", currency: "EUR" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  for (const [url, init] of fetchMock.mock.calls) {
    expect(url).toContain("/customers/1234567890/googleAds:searchStream");
    expect(init?.headers).toEqual(expect.objectContaining({ "login-customer-id": "9876543210" }));
    const query = JSON.parse(String(init?.body)).query as string;
    if (!query.includes("FROM customer")) expect(query).toContain("campaign.status IN ('ENABLED', 'PAUSED', 'REMOVED')");
    if (!query.includes("segments.date")) expect(query).not.toContain("BETWEEN");
  }
});

it("includes removed campaign history and preserves its non-serving inventory status", async () => {
  fetchMock.mockImplementation(async (_url, init) => {
    const query = JSON.parse(String(init?.body)).query as string;
    if (query.includes("FROM customer")) return respond([{ customer: { id: "1234567890", timeZone: "Europe/Athens", currencyCode: "EUR" } }]);
    const includesRemoved = query.includes("campaign.status IN ('ENABLED', 'PAUSED', 'REMOVED')");
    if (!includesRemoved) return respond([]);
    return query.includes("segments.date")
      ? respond([{ campaign: { id: "102", name: "Old Search" }, segments: { date: "2026-09-01" }, metrics: { costMicros: "15000000", conversions: 1.5, conversionsValue: 45 } }])
      : respond([{ campaign: { id: "102", name: "Old Search", status: "REMOVED", primaryStatus: "REMOVED", advertisingChannelType: "SEARCH" } }]);
  });
  const data = await fetchGoogleAccountData("test-token", "1234567890", range);
  expect(data.metrics).toEqual([expect.objectContaining({ campaignId: "102", spend: 15, conversions: 1.5, conversionValue: 45 })]);
  expect(data.campaigns).toEqual([expect.objectContaining({ platformCampaignId: "102", status: "archived", effectiveStatus: "REMOVED" })]);
});

it("fails the entire fetch if campaign inventory is unavailable", async () => {
  fetchMock.mockImplementation(async (_url, init) => {
    const query = JSON.parse(String(init?.body)).query as string;
    if (query.includes("FROM customer")) return respond([{ customer: { id: "1234567890", timeZone: "Europe/Athens", currencyCode: "EUR" } }]);
    if (!query.includes("segments.date")) throw new Error("inventory unavailable");
    return respond([]);
  });
  await expect(fetchGoogleAccountData("test-token", "1234567890", range)).rejects.toThrow("inventory unavailable");
});

it("rejects malformed metric values rather than storing fabricated zero spend", async () => {
  fetchMock.mockResolvedValue(respond([{ campaign: { id: "100", name: "Search" }, segments: { date: "2026-09-01" }, metrics: { costMicros: "not-a-number" } }]));
  await expect(fetchGoogleAccountData("test-token", "1234567890", range)).rejects.toThrow(/Invalid Google Ads/);
});

it.each([
  { startDate: "2026-08-17' OR 1=1", endDate: "2026-09-16" },
  { startDate: "2026-09-17", endDate: "2026-09-16" },
  { startDate: "2026-02-30", endDate: "2026-09-16" },
])("rejects invalid or reversed Google query dates before any provider call %j", async (dateRange) => {
  await expect(fetchGoogleAccountData("test-token", "1234567890", dateRange)).rejects.toThrow("Invalid Google Ads date range");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("normalizes historic nonzero campaign metrics without integer rounding conversions", async () => {
  fetchMock.mockImplementation(async (_url, init) => {
    const query = JSON.parse(String(init?.body)).query as string;
    if (query.includes("FROM customer")) return respond([{ customer: { id: "1234567890", timeZone: "Europe/Athens", currencyCode: "EUR" } }]);
    return query.includes("segments.date") ? respond([{ campaign: { id: "100", name: "Winter PMax" }, segments: { date: "2026-09-01" }, metrics: { costMicros: "742382635", impressions: "100", clicks: "50", conversions: 2.5, conversionsValue: 123.45 } }]) : respond([]);
  });
  expect((await fetchGoogleAccountData("test-token", "1234567890", range)).metrics).toEqual([
    { date: "2026-09-01", campaignId: "100", campaignName: "Winter PMax", spend: 742.382635, impressions: 100, clicks: 50, conversions: 2.5, conversionValue: 123.45 },
  ]);
});

it.each([
  { id: "9999999999", timeZone: "Europe/Athens", currencyCode: "EUR" },
  { id: "1234567890", timeZone: "not-a-timezone", currencyCode: "EUR" },
  { id: "1234567890", timeZone: "Europe/Athens", currencyCode: "bad" },
])("rejects mismatched or malformed provider identity %j", async (customer) => {
  fetchMock.mockImplementation(async (_url, init) => JSON.parse(String(init?.body)).query.includes("FROM customer") ? respond([{ customer }]) : respond([]));
  await expect(fetchGoogleAccountData("test-token", "1234567890", range)).rejects.toThrow(/Invalid Google Ads customer/);
});

it("rejects malformed campaign inventory instead of treating it as complete", async () => {
  fetchMock.mockResolvedValue(respond([{ campaign: { name: "Missing id", status: "ENABLED" } }]));
  await expect(fetchGoogleAccountData("test-token", "1234567890", range)).rejects.toThrow(/Invalid Google Ads/);
});
