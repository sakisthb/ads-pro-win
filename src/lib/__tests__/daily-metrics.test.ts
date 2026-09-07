import {
  DAILY_METRIC_INSERT_CHUNK,
  chunkArray,
  dailyMetricUniqueKey,
  dedupeDailyMetrics,
  optionalScaled,
  roundToScale,
  toDailyMetricCreateData,
  toPgInt,
  windowSortedDates,
} from "@/lib/sync/daily-metric-rows";

describe("daily metric persist helpers", () => {
  it("chunks below the Postgres bind-parameter budget", () => {
    const rows = Array.from({ length: 1201 }, (_, i) => i);
    const chunks = chunkArray(rows, DAILY_METRIC_INSERT_CHUNK);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(201);
    expect(DAILY_METRIC_INSERT_CHUNK * 27).toBeLessThan(32767);
  });

  it("windows dates without splitting a day across transactions", () => {
    expect(windowSortedDates(["2026-01-03", "2026-01-01", "2026-01-01"], 2)).toEqual([
      ["2026-01-01", "2026-01-03"],
    ]);
    expect(windowSortedDates(["2025-03-01", "2025-03-02", "2025-03-03"], 2)).toEqual([
      ["2025-03-01", "2025-03-02"],
      ["2025-03-03"],
    ]);
  });

  it("dedupes campaign-day keys with last write winning", () => {
    const rows = dedupeDailyMetrics([
      {
        date: "2026-08-01",
        spend: 1,
        impressions: 10,
        clicks: 1,
        conversions: 0,
        conversionValue: 0,
        campaignId: "c1",
      },
      {
        date: "2026-08-01",
        spend: 9,
        impressions: 100,
        clicks: 8,
        conversions: 2,
        conversionValue: 40,
        campaignId: "c1",
      },
      {
        date: "2026-08-01",
        spend: 3,
        impressions: 20,
        clicks: 2,
        conversions: 0,
        conversionValue: 0,
        campaignId: "c2",
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.campaignId === "c1")?.spend).toBe(9);
    expect(dailyMetricUniqueKey(rows[0])).toContain("2026-08-01");
  });

  it("rounds decimals to schema scale and stores CTR that used to overflow Decimal(6,4)", () => {
    const row = toDailyMetricCreateData(
      {
        date: "2026-08-01",
        spend: 82.020438,
        impressions: 818.4,
        clicks: 82.2,
        conversions: 1.234,
        conversionValue: 6678.9,
        frequency: 1.504649,
        linkClicks: 41.8,
        landingPageViews: 12.2,
        addToCart: 3.333,
        results: 12.9,
        resultType: "  omni_purchase  ",
        attributionSetting: "7-day click or 1-day view",
      },
      "acct_1",
      "meta",
    );
    expect(row.spend).toBe("82.0204");
    expect(row.impressions).toBe(818);
    expect(row.clicks).toBe(82);
    expect(row.conversions).toBe("1.23");
    expect(row.frequency).toBe("1.5046");
    expect(row.ctr).toBe("10.0244");
    expect(row.roas).toBe("81.4297");
    expect(row.resultType).toBe("omni_purchase");
    expect(optionalScaled(100.0224, 4)).toBe("100.0224");
    expect(toPgInt(Number.NaN)).toBe(0);
    expect(roundToScale(10.022438294689604, 4)).toBe("10.0224");
  });
});
