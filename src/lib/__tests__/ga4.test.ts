/**
 * @jest-environment node
 */

import {
  fetchGa4Metrics,
  fetchGa4Realtime,
  formatGa4ApiError,
  formatGa4Date,
  ga4PendingAccountId,
  ga4StoredAccountId,
  isGa4PropertyReady,
  listGa4Properties,
  mapGa4ReportToDailyMetrics,
  parseGa4PropertyId,
  parseGa4RealtimeDimension,
  parseGa4RealtimeTotals,
  collapseGa4BreakdownByShortLabel,
  shortGa4PageLabel,
  isGa4GenerativeChannel,
  isGa4OrganicSearchChannel,
  isGa4PaidChannel,
  ga4DeskLabel,
  rollupGa4DeskDays,
} from "@/lib/ga4";

describe("GA4 property ids", () => {
  it("treats legacy and pending placeholders as not ready", () => {
    expect(parseGa4PropertyId("ga4:cmtafnju70001i5h38yrzx25u")).toBeNull();
    expect(parseGa4PropertyId(ga4PendingAccountId("brand_1"))).toBeNull();
    expect(isGa4PropertyReady("ga4:pending:brand_1")).toBe(false);
  });

  it("parses stored, numeric, and resource names", () => {
    expect(parseGa4PropertyId(ga4StoredAccountId("brand_1", "123456789"))).toBe("123456789");
    expect(parseGa4PropertyId("properties/123456789")).toBe("123456789");
    expect(parseGa4PropertyId("123456789")).toBe("123456789");
    expect(isGa4PropertyReady("123456789")).toBe(true);
  });
});

describe("GA4 date and API errors", () => {
  it("normalizes YYYYMMDD", () => {
    expect(formatGa4Date("20260829")).toBe("2026-08-29");
    expect(formatGa4Date("2026-08-29")).toBe("2026-08-29");
  });

  it("shortens page titles by dropping the host suffix", () => {
    expect(
      shortGa4PageLabel(
        "SPRING – SUMMER 2026 Category - Γυναικείες Τσάντες & Αξεσουάρ, Λιανική & Χονδρική - bagtobag.com.gr",
      ),
    ).toBe("SPRING – SUMMER 2026 Category");
    expect(shortGa4PageLabel("Home")).toBe("Home");
  });

  it("merges realtime pages that shorten to the same label", () => {
    const rows = collapseGa4BreakdownByShortLabel([
      {
        label: "FALL- WINTER 2027 Category - bagtobag.com.gr",
        activeUsers: 4,
      },
      {
        label:
          "FALL- WINTER 2027 Category - Γυναικείες Τσάντες & Αξεσουάρ, Λιανική & Χονδρική - bagtobag.com.gr",
        activeUsers: 3,
      },
      { label: "Home - bagtobag.com.gr", activeUsers: 2 },
    ]);
    expect(rows).toEqual([
      { label: "FALL- WINTER 2027 Category", activeUsers: 7 },
      { label: "Home", activeUsers: 2 },
    ]);
  });

  it("points at Cloud APIs when they are disabled", () => {
    expect(
      formatGa4ApiError(
        403,
        JSON.stringify({
          error: { message: "Google Analytics Data API has not been used in project 1 before or it is disabled." },
        }),
      ),
    ).toMatch(/Enable Google Analytics/);
    expect(
      formatGa4ApiError(429, JSON.stringify({ error: { message: "RESOURCE_EXHAUSTED quota" } })),
    ).toMatch(/Realtime quota/);
  });
});

describe("GA4 report mapping", () => {
  it("maps channel-day rows onto DailyMetric fields", () => {
    const rows = mapGa4ReportToDailyMetrics({
      dimensionHeaders: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metricHeaders: [
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
        { name: "conversions" },
        { name: "totalRevenue" },
        { name: "ecommercePurchases" },
        { name: "addToCarts" },
        { name: "checkouts" },
      ],
      rows: [
        {
          dimensionValues: [{ value: "20260801" }, { value: "Organic Search" }],
          metricValues: [
            { value: "40" },
            { value: "120" },
            { value: "22" },
            { value: "3" },
            { value: "210.5" },
            { value: "2" },
            { value: "6" },
            { value: "4" },
          ],
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-08-01",
      campaignId: "Organic Search",
      impressions: 120,
      clicks: 40,
      conversions: 3,
      conversionValue: 210.5,
      websitePurchases: 2,
      addToCart: 6,
      spend: 0,
    });
  });
});

describe("GA4 HTTP helpers", () => {
  it("flattens accountSummaries into picker options", async () => {
    const fetchImpl = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            accountSummaries: [
              {
                displayName: "Bag to Bag",
                propertySummaries: [
                  { property: "properties/111", displayName: "BAGTOBAG web" },
                  { property: "accounts/skip-me" },
                ],
              },
            ],
          }),
      }),
    ) as unknown as typeof fetch;
    const properties = await listGa4Properties("tok", fetchImpl);
    expect(properties).toEqual([
      {
        id: "111",
        displayName: "BAGTOBAG web",
        accountName: "Bag to Bag",
        resourceName: "properties/111",
      },
    ]);
  });

  it("retries without ecommerce metrics when GA4 rejects them", async () => {
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("ecommercePurchases")) {
        return {
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ error: { message: "Metric ecommercePurchases is not compatible" } }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            dimensionHeaders: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
            metricHeaders: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "engagedSessions" }, { name: "conversions" }, { name: "totalRevenue" }],
            rows: [
              {
                dimensionValues: [{ value: "20260802" }, { value: "Direct" }],
                metricValues: [{ value: "5" }, { value: "9" }, { value: "3" }, { value: "0" }, { value: "0" }],
              },
            ],
          }),
      };
    }) as unknown as typeof fetch;
    const rows = await fetchGa4Metrics("tok", "properties/999", {
      startDate: "2026-08-01",
      endDate: "2026-08-02",
    }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(rows[0]?.campaignName).toBe("Direct");
    expect(rows[0]?.clicks).toBe(5);
  });
});

describe("GA4 Realtime mapping", () => {
  it("reads active users from a totals report", () => {
    expect(
      parseGa4RealtimeTotals({
        metricHeaders: [
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "eventCount" },
          { name: "keyEvents" },
        ],
        rows: [
          {
            metricValues: [
              { value: "17" },
              { value: "41" },
              { value: "90" },
              { value: "2" },
            ],
          },
        ],
      }),
    ).toEqual({
      activeUsers: 17,
      screenPageViews: 41,
      eventCount: 90,
      keyEvents: 2,
    });
  });

  it("sorts country rows by active users", () => {
    const rows = parseGa4RealtimeDimension({
      dimensionHeaders: [{ name: "country" }],
      metricHeaders: [{ name: "activeUsers" }],
      rows: [
        { dimensionValues: [{ value: "Italy" }], metricValues: [{ value: "1" }] },
        { dimensionValues: [{ value: "Greece" }], metricValues: [{ value: "12" }] },
      ],
    });
    expect(rows.map((r) => r.label)).toEqual(["Greece", "Italy"]);
  });

  it("calls runRealtimeReport not runReport", async () => {
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      if (body.includes("unifiedScreenName") || body.includes("deviceCategory") || body.includes("country")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              dimensionHeaders: [{ name: "country" }],
              metricHeaders: [{ name: "activeUsers" }],
              rows: [{ dimensionValues: [{ value: "Greece" }], metricValues: [{ value: "4" }] }],
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            metricHeaders: [
              { name: "activeUsers" },
              { name: "screenPageViews" },
              { name: "eventCount" },
              { name: "keyEvents" },
            ],
            rows: [{ metricValues: [{ value: "4" }, { value: "9" }, { value: "11" }, { value: "0" }] }],
          }),
      };
    }) as unknown as typeof fetch;
    const snap = await fetchGa4Realtime("tok", "271832507", fetchImpl);
    expect(snap.totals.activeUsers).toBe(4);
    expect(snap.countries[0]?.label).toBe("Greece");
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes("runRealtimeReport"))).toBe(true);
    expect(urls.some((u) => u.includes("runReport"))).toBe(false);
  });
});

describe("GA4 channel desks", () => {
  it("keeps Organic Search as SEO and AI Assistant as GEO", () => {
    expect(isGa4OrganicSearchChannel("Organic Search")).toBe(true);
    expect(isGa4OrganicSearchChannel("Paid Search")).toBe(false);
    expect(isGa4GenerativeChannel("AI Assistant")).toBe(true);
    expect(isGa4GenerativeChannel("Organic AI")).toBe(true);
    expect(isGa4GenerativeChannel("Organic Search")).toBe(false);
    expect(isGa4PaidChannel("Paid Search")).toBe(true);
    expect(ga4DeskLabel("AI Assistant")).toBe("GEO");
    expect(ga4DeskLabel("Organic Search")).toBe("SEO");
    expect(ga4DeskLabel("Paid Social")).toBe("Paid (GA4)");
    expect(ga4DeskLabel("Direct")).toBe("Other");
  });

  it("rolls generative days without mixing Organic Search", () => {
    const days = rollupGa4DeskDays(
      [
        { date: "2026-09-01", channel: "Organic Search", sessions: 100, purchases: 4, revenue: 200 },
        { date: "2026-09-01", channel: "AI Assistant", sessions: 7, purchases: 0, revenue: 0 },
        { date: "2026-09-02", channel: "AI Assistant", sessions: 3, purchases: 1, revenue: 40 },
      ],
      isGa4GenerativeChannel,
    );
    expect(days).toEqual([
      { date: "2026-09-01", sessions: 7, purchases: 0, revenue: 0 },
      { date: "2026-09-02", sessions: 3, purchases: 1, revenue: 40 },
    ]);
  });
});
