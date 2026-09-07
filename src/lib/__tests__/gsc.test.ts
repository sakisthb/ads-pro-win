/**
 * @jest-environment node
 */

import {
  decodeGscSiteKey,
  encodeGscSiteKey,
  fetchGscMetrics,
  formatGscApiError,
  gscPendingAccountId,
  gscSiteDisplayName,
  gscStoredAccountId,
  gscPositionBands,
  isGscSiteReady,
  isReadableGscPermission,
  listGscSites,
  mapGscDateRows,
  mapGscQueryRows,
  parseGscSiteUrl,
  preferGscSite,
  rollupGscQueries,
  looksLikeAnswerQuery,
  GSC_SITE_TOTAL_CAMPAIGN_ID,
} from "@/lib/gsc";

describe("Search Console site ids", () => {
  it("treats pending placeholders as not ready", () => {
    expect(parseGscSiteUrl(gscPendingAccountId("brand_1"))).toBeNull();
    expect(isGscSiteReady("gsc:pending:brand_1")).toBe(false);
  });

  it("round-trips URL-prefix and domain properties", () => {
    const prefix = "https://bagtobag.com.gr/";
    const stored = gscStoredAccountId("brand_1", prefix);
    expect(parseGscSiteUrl(stored)).toBe(prefix);
    expect(isGscSiteReady(stored)).toBe(true);
    expect(decodeGscSiteKey(encodeGscSiteKey("sc-domain:bagtobag.com.gr"))).toBe(
      "sc-domain:bagtobag.com.gr",
    );
  });
});

describe("Search Console display and picker", () => {
  it("prefers the shop hostname when several sites exist", () => {
    const sites = [
      {
        siteUrl: "https://richgirlboudoir.gr/",
        permissionLevel: "siteOwner",
        displayName: "richgirlboudoir.gr",
      },
      {
        siteUrl: "https://bagtobag.com.gr/",
        permissionLevel: "siteOwner",
        displayName: "bagtobag.com.gr",
      },
    ];
    expect(preferGscSite(sites, "https://www.bagtobag.com.gr/")?.siteUrl).toBe(
      "https://bagtobag.com.gr/",
    );
    expect(gscSiteDisplayName("sc-domain:bagtobag.com.gr")).toBe("bagtobag.com.gr");
  });

  it("skips unverified properties", () => {
    expect(isReadableGscPermission("siteUnverifiedUser")).toBe(false);
    expect(isReadableGscPermission("siteOwner")).toBe(true);
  });
});

describe("Search Console mapping", () => {
  it("maps date totals onto DailyMetric and keeps queries separate", () => {
    const totals = mapGscDateRows(
      [{ keys: ["2026-08-01"], clicks: 40.2, impressions: 900.8, position: 8.1 }],
      "https://bagtobag.com.gr/",
    );
    expect(totals[0]).toMatchObject({
      date: "2026-08-01",
      campaignId: GSC_SITE_TOTAL_CAMPAIGN_ID,
      clicks: 40,
      impressions: 901,
      spend: 0,
    });
    const queries = mapGscQueryRows([
      { keys: ["2026-08-01", "τσαντες"], clicks: 12, impressions: 80, position: 4.2 },
    ]);
    expect(queries[0]).toMatchObject({
      campaignId: "τσαντες",
      campaignName: "τσαντες",
      resultType: "gsc_query",
    });
  });

  it("rolls query demand and flags AEO-shaped questions", () => {
    const rolled = rollupGscQueries([
      { campaignName: "bag to bag", clicks: 10, impressions: 100, position: 1.5 },
      { campaignName: "bag to bag", clicks: 5, impressions: 50, position: 2 },
      { campaignName: "πως να πλύνω τσάντα", clicks: 4, impressions: 40, position: 3 },
      { campaignId: GSC_SITE_TOTAL_CAMPAIGN_ID, campaignName: "bagtobag.com.gr", clicks: 99, impressions: 999, position: 8 },
    ]);
    expect(rolled[0]).toMatchObject({ query: "bag to bag", clicks: 15, impressions: 150 });
    expect(rolled[0]!.position).toBeCloseTo((100 * 1.5 + 50 * 2) / 150);
    expect(rolled.find((row) => row.query.includes("πως"))?.answerShaped).toBe(true);
    expect(rolled.find((row) => row.query === "bag to bag")?.answerShaped).toBe(false);
  });

  it("buckets queries into Search Console position bands", () => {
    const bands = gscPositionBands([
      { query: "a", clicks: 10, impressions: 20, position: 3, ctr: 50, answerShaped: false },
      { query: "b", clicks: 2, impressions: 40, position: 14, ctr: 5, answerShaped: false },
      { query: "c", clicks: 1, impressions: 80, position: 28, ctr: 1.25, answerShaped: true },
    ]);
    expect(bands[0]).toMatchObject({ id: "page1", queries: 1, clicks: 10 });
    expect(bands[1]).toMatchObject({ id: "page2", queries: 1, clicks: 2 });
    expect(bands[2]).toMatchObject({ id: "deeper", queries: 1, clicks: 1 });
  });

  it("treats question marks and English how/what as AEO", () => {
    expect(looksLikeAnswerQuery("what is bagtobag")).toBe(true);
    expect(looksLikeAnswerQuery("bag to bag greece")).toBe(false);
  });

  it("points at Cloud APIs when Search Console API is disabled", () => {
    expect(
      formatGscApiError(
        403,
        JSON.stringify({
          error: { message: "Search Console API has not been used in project 1 before or it is disabled." },
        }),
      ),
    ).toMatch(/Enable Google Search Console API/);
  });
});

describe("Search Console HTTP helpers", () => {
  it("lists readable sites and fetches date plus query reports", async () => {
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/sites")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              siteEntry: [
                { siteUrl: "https://bagtobag.com.gr/", permissionLevel: "siteOwner" },
                { siteUrl: "https://skip.example/", permissionLevel: "siteUnverifiedUser" },
              ],
            }),
        };
      }
      const body = String(init?.body ?? "");
      if (body.includes('"query"')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              rows: [{ keys: ["2026-08-20", "leather tote"], clicks: 3, impressions: 40, position: 5 }],
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            rows: [{ keys: ["2026-08-20"], clicks: 11, impressions: 200, position: 7 }],
          }),
      };
    }) as unknown as typeof fetch;

    const sites = await listGscSites("tok", fetchImpl);
    expect(sites.map((s) => s.siteUrl)).toEqual(["https://bagtobag.com.gr/"]);

    const rows = await fetchGscMetrics(
      "tok",
      "https://bagtobag.com.gr/",
      { startDate: "2026-08-01", endDate: "2026-08-20" },
      fetchImpl,
    );
    expect(rows.some((r) => r.campaignId === GSC_SITE_TOTAL_CAMPAIGN_ID)).toBe(true);
    expect(rows.some((r) => r.campaignName === "leather tote")).toBe(true);
  });
});
