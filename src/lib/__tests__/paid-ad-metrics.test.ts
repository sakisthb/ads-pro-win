import {
  dailyMetricPlatformWhere,
  isPaidAdPlatform,
  isSiteAnalyticsPlatform,
  mergeConnectedPaidPlatforms,
  PAID_AD_PLATFORMS,
  SITE_ANALYTICS_PLATFORM,
  sumAccountSpendForPlatform,
} from "@/lib/paid-ad-metrics";

describe("paid ad DailyMetric isolation", () => {
  it("treats omitted and all as paid ads only", () => {
    expect(dailyMetricPlatformWhere()).toEqual({
      platform: { in: [...PAID_AD_PLATFORMS] },
    });
    expect(dailyMetricPlatformWhere("all")).toEqual({
      platform: { in: [...PAID_AD_PLATFORMS] },
    });
    expect(PAID_AD_PLATFORMS).not.toContain(SITE_ANALYTICS_PLATFORM);
    expect(PAID_AD_PLATFORMS).not.toContain("google-search-console");
    expect(PAID_AD_PLATFORMS).not.toContain("omnisend");
    expect(PAID_AD_PLATFORMS).not.toContain("opencart");
  });

  it("keeps an explicit platform so GA4 channel mix can still query", () => {
    expect(dailyMetricPlatformWhere("google-analytics")).toEqual({
      platform: "google-analytics",
    });
    expect(dailyMetricPlatformWhere("meta")).toEqual({ platform: "meta" });
  });

  it("classifies platforms without mixing site analytics into paid ads", () => {
    expect(isPaidAdPlatform("meta")).toBe(true);
    expect(isPaidAdPlatform("google")).toBe(true);
    expect(isPaidAdPlatform("google-analytics")).toBe(false);
    expect(isPaidAdPlatform("google-search-console")).toBe(false);
    expect(isSiteAnalyticsPlatform("google-analytics")).toBe(true);
    expect(isSiteAnalyticsPlatform("google-search-console")).toBe(false);
    expect(isSiteAnalyticsPlatform("meta")).toBe(false);
  });

  it("does not count OAuth-connected Google with €0 as funded spend", () => {
    expect(sumAccountSpendForPlatform([{ platform: "google", totalSpend: 0 }], "google")).toBe(0);
    expect(
      mergeConnectedPaidPlatforms(["Google"], ["meta"], ["google-analytics", "brevo"]),
    ).toEqual(["google", "meta"]);
  });
});
