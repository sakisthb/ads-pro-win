import {
  amountToMetaCents,
  attributionSpecFromPreset,
  advantageAudienceOn,
  bidFieldsForStrategy,
  budgetChangeResetsLearning,
  canEditBudgetThisHour,
  clockToMinutes,
  copiedIdFromBody,
  countriesFromTargeting,
  formatMetaRecommendations,
  frequencyFromSpec,
  isLearningStatus,
  LEARNING_RESET_MESSAGE,
  mapCtaToMeta,
  localesFromTargeting,
  mergeAdsetTargeting,
  metaWriteBlockedReason,
  minutesToClock,
  normalizeUrlTags,
  operatorBudgetAmount,
  parseAdsetSchedule,
  requireLearningConfirm,
  resolveBudgetEditTarget,
  specialAdCategoriesPayload,
  adCreateCreativeField,
  stripGraphField,
  unknownFieldFromGraphError,
  isMetaUserRateLimit,
} from "@/lib/meta/operator-logic";

describe("Meta operator budget targeting", () => {
  it("edits the campaign when Advantage+ CBO holds the daily budget", () => {
    const target = resolveBudgetEditTarget({
      campaignId: "120214020766100271",
      campaignDailyCents: 4000,
      campaignLifetimeCents: null,
      adSets: [{ id: "as1", dailyCents: null, lifetimeCents: null }],
    });
    expect(target).toMatchObject({
      layer: "campaign",
      id: "120214020766100271",
      kind: "daily",
      cbo: true,
      currentCents: 4000,
    });
  });

  it("falls back to the first ad set daily budget for ABO", () => {
    const target = resolveBudgetEditTarget({
      campaignId: "c1",
      campaignDailyCents: null,
      campaignLifetimeCents: null,
      adSets: [
        { id: "empty", dailyCents: null, lifetimeCents: null },
        { id: "as2", dailyCents: 2500, lifetimeCents: null },
      ],
    });
    expect(target.layer).toBe("adset");
    expect(target.id).toBe("as2");
    expect(target.cbo).toBe(false);
  });

  it("treats 20% as safe and anything above as a learning reset", () => {
    expect(budgetChangeResetsLearning(4000, 4800)).toBe(false);
    expect(budgetChangeResetsLearning(4000, 4801)).toBe(true);
    expect(budgetChangeResetsLearning(4000, 2000)).toBe(true);
  });

  it("blocks the fifth budget edit inside an hour", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const times = [
      "2026-08-28T17:10:00.000Z",
      "2026-08-28T17:20:00.000Z",
      "2026-08-28T17:30:00.000Z",
      "2026-08-28T17:40:00.000Z",
    ];
    expect(canEditBudgetThisHour(times, now)).toEqual({ ok: false, remaining: 0, recent: 4 });
    expect(canEditBudgetThisHour(times.slice(0, 3), now).remaining).toBe(1);
  });
});

describe("Meta operator bid / CTA / attribution", () => {
  it("does not send bid_amount with lowest cost", () => {
    expect(bidFieldsForStrategy({ strategy: "LOWEST_COST_WITHOUT_CAP", bidAmount: 12 })).toEqual({
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    });
  });

  it("sends bid cap in cents and min ROAS as a 10000-based floor", () => {
    expect(bidFieldsForStrategy({ strategy: "COST_CAP", bidAmount: 18.5 })).toEqual({
      bid_strategy: "COST_CAP",
      bid_amount: "1850",
    });
    expect(bidFieldsForStrategy({ strategy: "LOWEST_COST_WITH_MIN_ROAS", minRoas: 2.5 })).toEqual({
      bid_strategy: "LOWEST_COST_WITH_MIN_ROAS",
      bid_constraints: JSON.stringify({ roas_average_floor: 25000 }),
    });
  });

  it("maps CTAs and 7d click / 1d view attribution", () => {
    expect(mapCtaToMeta("Shop Now")).toBe("SHOP_NOW");
    expect(mapCtaToMeta("LEARN_MORE")).toBe("LEARN_MORE");
    expect(attributionSpecFromPreset("7d_click_1d_view")).toEqual([
      { event_type: "CLICK_THROUGH", window_days: 7 },
      { event_type: "VIEW_THROUGH", window_days: 1 },
    ]);
  });

  it("requires confirm when the ad set is still learning", () => {
    expect(isLearningStatus("ACTIVE", "LEARNING_LIMITED")).toBe(true);
    expect(() =>
      requireLearningConfirm({ kind: "targeting", learning: true, confirm: false }),
    ).toThrow(LEARNING_RESET_MESSAGE);
    expect(() =>
      requireLearningConfirm({ kind: "targeting", learning: true, confirm: true }),
    ).not.toThrow();
  });

  it("reads countries and Advantage+ audience from targeting", () => {
    const targeting = {
      geo_locations: { countries: ["GR", "CY"] },
      targeting_automation: { advantage_audience: 0 },
    };
    expect(countriesFromTargeting(targeting)).toEqual(["GR", "CY"]);
    expect(advantageAudienceOn(targeting)).toBe(false);
    expect(advantageAudienceOn({})).toBe(true);
  });

  it("parses copy endpoint ids", () => {
    expect(copiedIdFromBody({ copied_campaign_id: "99" })).toBe("99");
    expect(copiedIdFromBody({ id: "12" })).toBe("12");
  });

  it("rounds operator amounts to Meta cents", () => {
    expect(amountToMetaCents(40)).toBe(4000);
    expect(amountToMetaCents(0)).toBe(100);
  });

  it("never invents a €40 budget when Graph did not return one", () => {
    expect(
      operatorBudgetAmount({
        campaignDaily: null,
        campaignLifetime: null,
        budgetTarget: null,
      }),
    ).toBeNull();
    expect(
      operatorBudgetAmount({
        campaignDaily: null,
        campaignLifetime: null,
        budgetTarget: { layer: "adset", id: "as2", currentCents: 2000, kind: "daily", cbo: false },
      }),
    ).toBe(20);
  });

  it("detects Meta user request limits and missing ads_management", () => {
    expect(isMetaUserRateLimit("User request limit reached", 17, 2446079)).toBe(true);
    expect(isMetaUserRateLimit("ok", 1)).toBe(false);
    expect(metaWriteBlockedReason(["ads_read", "public_profile"])).toMatch(/ads_read, public_profile/);
    expect(metaWriteBlockedReason(["ads_read", "ads_management"])).toBeNull();
  });
});

describe("Meta Graph field fallbacks and schedules", () => {
  it("strips unknown top-level and nested Graph fields", () => {
    expect(stripGraphField("id,name,learning_stage_info,recommendations", "learning_stage_info")).toBe(
      "id,name,recommendations",
    );
    expect(stripGraphField("id,creative{id,name,object_story_spec,thumbnail_url}", "object_story_spec")).toBe(
      "id,creative{id,name,thumbnail_url}",
    );
    expect(stripGraphField("id,creative{object_story_spec}", "object_story_spec")).toBe("id,creative");
    expect(stripGraphField("id,name", "missing")).toBeNull();
  });

  it("reads the unknown field name from Graph error text", () => {
    expect(
      unknownFieldFromGraphError("(#100) Tried accessing nonexisting field (learning_stage_info)"),
    ).toBe("learning_stage_info");
    expect(unknownFieldFromGraphError("unknown field 'recommendations'")).toBe("recommendations");
  });

  it("parses ad set dayparts and clock conversion", () => {
    expect(parseAdsetSchedule([{ start_minute: 540, end_minute: 1260, days: [1, 2, 3, 4, 5] }])).toEqual({
      startMinute: 540,
      endMinute: 1260,
      days: [1, 2, 3, 4, 5],
    });
    expect(minutesToClock(540)).toBe("09:00");
    expect(clockToMinutes("21:00")).toBe(1260);
  });

  it("merges audience patches without wiping placements", () => {
    const merged = mergeAdsetTargeting(
      {
        geo_locations: { countries: ["GR"], location_types: ["home"] },
        publisher_platforms: ["facebook", "instagram"],
        targeting_automation: { advantage_audience: 1 },
      },
      {
        geo_locations: { countries: ["GR", "CY"] },
        targeting_automation: { advantage_audience: 0 },
      },
    );
    expect(merged.publisher_platforms).toEqual(["facebook", "instagram"]);
    expect(merged.geo_locations).toEqual({ countries: ["GR", "CY"], location_types: ["home"] });
    expect(merged.targeting_automation).toEqual({ advantage_audience: 0 });
  });

  it("reads locales, URL tags, frequency, and recommendation copy", () => {
    expect(localesFromTargeting({ locales: [6, "24"] })).toEqual([6, 24]);
    expect(normalizeUrlTags("?utm_source=meta &utm_medium=paid")).toBe("utm_source=meta&utm_medium=paid");
    expect(frequencyFromSpec([{ event: "IMPRESSIONS", interval_days: 7, max_frequency: 3 }])).toEqual({
      intervalDays: 7,
      maxFrequency: 3,
    });
    expect(formatMetaRecommendations([{ title: "Learning limited", message: "Add budget" }])).toEqual([
      "Learning limited — Add budget",
    ]);
  });

  it("builds special ad category and paused-ad creative payloads", () => {
    expect(specialAdCategoriesPayload([], [])).toEqual({
      special_ad_categories: JSON.stringify(["NONE"]),
    });
    expect(specialAdCategoriesPayload(["housing"], ["gr", "CY"])).toEqual({
      special_ad_categories: JSON.stringify(["HOUSING"]),
      special_ad_category_country: JSON.stringify(["GR", "CY"]),
    });
    expect(() => specialAdCategoriesPayload(["HOUSING"], [])).toThrow(/ISO country/);
    expect(adCreateCreativeField("120214020766100271")).toBe(
      JSON.stringify({ creative_id: "120214020766100271" }),
    );
  });
});
