/** @jest-environment node */
import { mapInsightRow } from "@/lib/meta/graph";
import {
  defaultSyncLookbackDays,
  formatAttributionSetting,
  formatAttributionSpec,
  inferResultFromActions,
  labelMetaResultType,
  mapMetaCampaignStatus,
  metaCentsToAmount,
  parseAction,
  parseInsightsResults,
  parsePurchaseCount,
  parsePurchaseValue,
  rollupReachFrequency,
  splitDateRange,
} from "@/lib/meta/actions";

const pixelPurchase = [
  { action_type: "offsite_conversion.fb_pixel_purchase", value: "2017" },
  { action_type: "omni_add_to_cart", value: "3303" },
  { action_type: "omni_landing_page_view", value: "6878" },
  { action_type: "link_click", value: "182363" },
];

describe("Meta insights parsers", () => {
  it("reads pixel purchases when omni_purchase is absent", () => {
    expect(parsePurchaseCount(pixelPurchase)).toBe(2017);
    expect(parsePurchaseValue(pixelPurchase)).toBe(2017);
  });

  it("prefers omni_purchase and does not double-count pixel purchases", () => {
    const actions = [
      { action_type: "omni_purchase", value: "10" },
      { action_type: "purchase", value: "10" },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "10" },
    ];
    expect(parsePurchaseCount(actions)).toBe(10);
  });

  it("maps Ads Manager inactive/paused statuses", () => {
    expect(mapMetaCampaignStatus("PAUSED")).toBe("paused");
    expect(mapMetaCampaignStatus("ACTIVE", "CAMPAIGN_PAUSED")).toBe("paused");
    expect(mapMetaCampaignStatus("inactive")).toBe("paused");
    expect(mapMetaCampaignStatus("ARCHIVED")).toBe("archived");
    expect(mapMetaCampaignStatus("ACTIVE")).toBe("active");
  });

  it("converts Meta cent budgets to currency units", () => {
    expect(metaCentsToAmount("1956253")).toBeCloseTo(19562.53);
    expect(metaCentsToAmount(4000)).toBe(40);
    expect(metaCentsToAmount("0")).toBeNull();
  });

  it("formats ad-set attribution_spec like Ads Manager", () => {
    expect(
      formatAttributionSpec([
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH", window_days: 1 },
      ]),
    ).toBe("7-day click or 1-day view");
    expect(formatAttributionSetting("7d_click 1d_view")).toBe("7-day click or 1-day view");
    expect(formatAttributionSetting("7d_click_1d_view")).toBe("7-day click or 1-day view");
    expect(formatAttributionSetting("Multiple attribution settings")).toBe(
      "Multiple attribution settings",
    );
  });

  it("uses traffic objective for landing-page results, not purchases", () => {
    const result = inferResultFromActions(pixelPurchase, "OUTCOME_TRAFFIC", 116558);
    expect(result.resultType).toBe("omni_landing_page_view");
    expect(result.results).toBe(6878);
  });

  it("uses sales objective for purchases", () => {
    const result = inferResultFromActions(pixelPurchase, "OUTCOME_SALES", 424360);
    expect(result.resultType).toBe("offsite_conversion.fb_pixel_purchase");
    expect(result.results).toBe(2017);
  });

  it("parses Insights results list (Ads Manager Results column)", () => {
    expect(
      parseInsightsResults([
        { indicator: "actions:offsite_conversion.fb_pixel_purchase", value: "2017" },
      ]),
    ).toEqual({
      resultType: "actions:offsite_conversion.fb_pixel_purchase",
      results: 2017,
    });
  });

  it("labels result types for the UI", () => {
    expect(labelMetaResultType("actions:omni_landing_page_view")).toBe("Landing views");
    expect(labelMetaResultType("offsite_conversion.fb_pixel_purchase")).toBe("Purchases");
    expect(labelMetaResultType("estimated_ad_recallers")).toBe("Est. ad recall");
  });

  it("chunks an 18-month window into 30-day ranges", () => {
    const chunks = splitDateRange("2025-03-01", "2026-08-28", 30);
    expect(chunks[0]).toEqual({ startDate: "2025-03-01", endDate: "2025-03-30" });
    expect(chunks[chunks.length - 1]?.endDate).toBe("2026-08-28");
    expect(chunks.length).toBeGreaterThan(15);
  });

  it("does not sum unique reach; uses impression-weighted frequency", () => {
    const rolled = rollupReachFrequency([
      { impressions: 1000, frequency: 2, reach: 500 },
      { impressions: 3000, frequency: 4, reach: 750 },
    ]);
    expect(rolled.frequency).toBeCloseTo(3.5);
    expect(rolled.reach).toBeCloseTo(4000 / 3.5);
  });

  it("uses a long Meta lookback and 28-day delta restatement", () => {
    expect(defaultSyncLookbackDays("meta", false)).toBe(547);
    expect(defaultSyncLookbackDays("meta", true)).toBe(28);
    expect(defaultSyncLookbackDays("google", false)).toBe(30);
    expect(defaultSyncLookbackDays("woocommerce", false)).toBe(365);
    expect(defaultSyncLookbackDays("brevo", false)).toBe(180);
    expect(defaultSyncLookbackDays("omnisend", false)).toBe(180);
    expect(defaultSyncLookbackDays("google-search-console", false)).toBe(480);
  });

  it("reads landing page views from omni then pixel actions", () => {
    expect(parseAction(pixelPurchase, ["omni_landing_page_view", "landing_page_view"])).toBe(6878);
  });

  it("maps a Graph insights row like the BagToBag Advantage+ CSV", () => {
    const row = mapInsightRow(
      {
        date_start: "2025-03-01",
        spend: "19562.53",
        impressions: "4366580",
        clicks: "189064",
        inline_link_clicks: "182363",
        reach: "424360",
        frequency: "10.289936",
        campaign_id: "123",
        campaign_name: "Advantage+ (PUR) // General Campaign",
        objective: "OUTCOME_SALES",
        attribution_setting: "7d_click_1d_view",
        actions: pixelPurchase,
        action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "146333.37" }],
        results: [{ indicator: "actions:offsite_conversion.fb_pixel_purchase", value: "2017" }],
      },
      "OUTCOME_SALES",
    );
    expect(row.conversions).toBe(2017);
    expect(row.conversionValue).toBeCloseTo(146333.37);
    expect(row.linkClicks).toBe(182363);
    expect(row.reach).toBe(424360);
    expect(row.results).toBe(2017);
    expect(row.resultType).toContain("purchase");
    expect(row.attributionSetting).toBe("7-day click or 1-day view");
    expect(row.spend / row.conversionValue).toBeLessThan(1);
  });
});
