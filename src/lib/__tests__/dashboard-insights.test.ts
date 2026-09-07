import {
  buildAttributionHonestyRecs,
  buildAudienceOperatorRecs,
  buildMissingPlatformRecs,
  buildPixelLeakage,
  deriveFunnelActions,
  deriveInsights,
  deriveStoreInsights,
  selectPixelFunnelStages,
} from "@/lib/dashboard-insights";

describe("deriveFunnelActions", () => {
  it("flags high CTR with weak click-to-purchase", () => {
    const insights = deriveFunnelActions({
      ctr: 5.49,
      cvr: 0.32,
      spend: 653,
      conversions: 31,
      campaignCount: 1,
      bestCampaign: { name: "Advantage+ (PUR)", roas: 6.66, cvr: 0.32 },
    });
    expect(insights.map((i) => i.id)).toContain("landing-cvr");
    expect(insights[0]?.title).toBe("Clicks are cheap — purchases are not");
    expect(insights.some((i) => i.id === "scale-winner")).toBe(true);
    expect(insights.find((i) => i.id === "scale-winner")?.title).toBe(
      "Winner is the whole funnel",
    );
    expect(insights.find((i) => i.id === "scale-winner")?.href).toBe("/creative-fatigue");
    expect(insights.find((i) => i.id === "scale-winner")?.description).toMatch(
      /do not test a lookalike/i,
    );
  });

  it("does not invent a prospecting shift when extra campaigns have no spend", () => {
    const [winner] = deriveFunnelActions({
      ctr: 5.56,
      cvr: 0.29,
      spend: 640,
      conversions: 28,
      campaignCount: 3,
      bestCampaign: { name: "Advantage+ (PUR) // General Campaign", roas: 6.78, cvr: 0.29 },
    }).filter((i) => i.id === "scale-winner");
    expect(winner?.title).toBe("Winner is the whole funnel");
    expect(winner?.href).toBe("/creative-fatigue");
    expect(winner?.description).not.toMatch(/Shift prospecting/);
  });

  it("does not invent a TOFU budget steal when there is only one campaign", () => {
    const [winner] = deriveFunnelActions({
      ctr: 3,
      cvr: 4,
      spend: 200,
      conversions: 10,
      campaignCount: 1,
      bestCampaign: { name: "Only campaign", roas: 4.2, cvr: 4 },
    }).filter((i) => i.id === "scale-winner");
    expect(winner?.description).toContain("no separate TOFU budget");
  });

  it("recommends scaling the converting campaign when several exist", () => {
    const [winner] = deriveFunnelActions({
      ctr: 3,
      cvr: 4,
      spend: 400,
      conversions: 20,
      campaignCount: 3,
      bestCampaign: { name: "Retargeting", roas: 5, cvr: 8 },
    }).filter((i) => i.id === "scale-winner");
    expect(winner?.title).toBe("Scale the converting campaign");
    expect(winner?.description).toContain("Retargeting");
  });

  it("flags weak CTR as the impression leak", () => {
    const insights = deriveFunnelActions({
      ctr: 0.4,
      cvr: 3,
      spend: 100,
      conversions: 5,
      campaignCount: 2,
    });
    expect(insights[0]?.id).toBe("weak-ctr");
    expect(insights[0]?.title).toContain("Impression-to-click");
  });

  it("flags a pixel gap when landing views are far below clicks", () => {
    const insights = deriveFunnelActions({
      ctr: 5,
      cvr: 3,
      spend: 200,
      conversions: 10,
      campaignCount: 1,
      clicks: 1000,
      landingPageViews: 200,
    });
    expect(insights.map((i) => i.id)).toContain("pixel-gap");
  });
});

describe("selectPixelFunnelStages", () => {
  it("omits zero-volume pixel events", () => {
    expect(selectPixelFunnelStages({ landingPageViews: 0, addToCart: 0, checkouts: 0 })).toEqual([]);
  });

  it("keeps only events Meta actually returned", () => {
    expect(
      selectPixelFunnelStages({ landingPageViews: 400, addToCart: 0, checkouts: 12 }),
    ).toEqual([
      { key: "landing", volume: 400 },
      { key: "checkout", volume: 12 },
    ]);
  });
});

describe("deriveStoreInsights", () => {
  it("flags till vs pixel when store orders dwarf claimed conversions", () => {
    const insights = deriveStoreInsights({
      storeOrders: 133,
      storeNet: 16000,
      pixelConversions: 33,
      pixelRevenue: 4500,
      spend: 680,
      mer: 24,
      platformRoas: 6.6,
      cogsKnown: false,
      channels: [
        { channel: "direct", orders: 70, netSales: 9000, share: 0.55 },
        { channel: "meta", orders: 40, netSales: 5000, share: 0.3 },
      ],
      connectedPlatforms: ["meta"],
    });
    expect(insights.map((i) => i.id)).toContain("till-vs-pixel");
    expect(insights.map((i) => i.id)).toContain("mer-not-causal");
    expect(insights.find((i) => i.id === "till-vs-pixel")?.description).toMatch(/CAPI/);
    expect(insights[0]?.href).toBe("/help");
  });

  it("names the five clocks when GA4 purchases sit between till and pixel", () => {
    const insights = deriveStoreInsights({
      storeOrders: 121,
      storeNet: 17414,
      pixelConversions: 28,
      pixelRevenue: 4300,
      spend: 647,
      mer: 26.9,
      platformRoas: 6.71,
      cogsKnown: true,
      grossProfit: 2296,
      profitAfterAds: 1650,
      amer: 6.45,
      newCustomerShare: 0.24,
      newCustomerNet: 4174,
      channels: [
        { channel: "direct", orders: 75, netSales: 9784, share: 0.56 },
        { channel: "google", orders: 30, netSales: 5946, share: 0.34 },
      ],
      connectedPlatforms: ["meta"],
      ga4Sessions: 11540,
      ga4Purchases: 107,
      ga4UnassignedSessions: 1001,
      ga4OrganicSearchSessions: 7104,
      ga4OrganicSearchPurchases: 67,
      tax: 0,
    });
    expect(insights.map((i) => i.id)).toContain("ga4-three-clocks");
    expect(insights.find((i) => i.id === "ga4-three-clocks")?.title).toMatch(/Five clocks/);
    expect(insights.find((i) => i.id === "ga4-three-clocks")?.href).toBe("/help");
    expect(insights.find((i) => i.id === "till-vs-pixel")?.description).toMatch(/107/);
    expect(insights.map((i) => i.id)).toContain("ga4-unassigned");
    expect(insights.map((i) => i.id)).toContain("ga4-organic-not-ads");
    expect(insights.map((i) => i.id)).toContain("woo-tax-zero");
  });

  it("flags aMER when repeats are carrying blended MER", () => {
    const insights = deriveStoreInsights({
      storeOrders: 123,
      storeNet: 17414,
      pixelConversions: 28,
      pixelRevenue: 4300,
      spend: 640,
      mer: 27,
      platformRoas: 6.8,
      cogsKnown: true,
      grossProfit: 2296,
      profitAfterAds: 1656,
      amer: 11,
      newCustomerShare: 0.4,
      newCustomerNet: 7000,
      channels: [
        { channel: "direct", orders: 77, netSales: 9000, share: 0.56 },
        { channel: "meta", orders: 9, netSales: 400, share: 0.01 },
      ],
      connectedPlatforms: ["meta"],
    });
    const amerInsight = insights.find((i) => i.id === "amer-vs-mer");
    expect(amerInsight?.title).toBe("aMER is the acquisition read");
    expect(amerInsight?.description).toMatch(/11\.0x/);
  });

  it("says catalog margin is not MER once COGS is known", () => {
    const insights = deriveStoreInsights({
      storeOrders: 123,
      storeNet: 17414,
      pixelConversions: 28,
      pixelRevenue: 4300,
      spend: 640,
      mer: 27,
      platformRoas: 6.8,
      cogsKnown: true,
      grossProfit: 2296,
      profitAfterAds: 1656,
      channels: [
        { channel: "direct", orders: 77, netSales: 9000, share: 0.56 },
        { channel: "meta", orders: 9, netSales: 400, share: 0.01 },
      ],
      connectedPlatforms: ["meta"],
    });
    const thin = insights.find((i) => i.id === "thin-margin");
    expect(thin?.title).toBe("Catalog margin is not MER");
    expect(thin?.description).toMatch(/13%/);
    expect(thin?.description).toContain("€1,656");
  });

  it("asks to connect Google Ads when last-click Google is material", () => {
    const insights = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 10000,
      pixelConversions: 80,
      pixelRevenue: 10000,
      spend: 2000,
      mer: 5,
      platformRoas: 5,
      cogsKnown: true,
      channels: [{ channel: "google", orders: 40, netSales: 6000, share: 0.6 }],
      connectedPlatforms: ["meta"],
    });
    expect(insights.map((i) => i.id)).toContain("connect-google");
  });

  it("does not treat OAuth-connected Google Ads with €0 spend as Google Ads ROAS", () => {
    const insights = deriveStoreInsights({
      storeOrders: 85,
      storeNet: 11621,
      pixelConversions: 13,
      pixelRevenue: 1746,
      spend: 412,
      mer: 28.2,
      platformRoas: 4.23,
      cogsKnown: true,
      channels: [
        { channel: "direct", orders: 50, netSales: 7000, share: 0.6 },
        { channel: "google", orders: 40, netSales: 6000, share: 0.34 },
      ],
      connectedPlatforms: ["meta", "google"],
      googleAdsSpend: 0,
      ga4OrganicSearchSessions: 7104,
      ga4OrganicSearchPurchases: 67,
    });
    const empty = insights.find((i) => i.id === "google-ads-no-spend");
    expect(empty?.title).toMatch(/spend is empty/i);
    expect(empty?.description).toMatch(/till, not spend/);
    expect(empty?.description).toMatch(/Basic Access/);
    expect(empty?.description).not.toMatch(/email ROAS/i);
    expect(insights.map((i) => i.id)).not.toContain("connect-google");
    expect(insights.map((i) => i.id)).not.toContain("ga4-organic-not-ads");
  });

  it("does not pretend Microsoft Ads can be connected", () => {
    const insights = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 10000,
      pixelConversions: 80,
      pixelRevenue: 10000,
      spend: 2000,
      mer: 5,
      platformRoas: 5,
      cogsKnown: true,
      channels: [{ channel: "bing", orders: 20, netSales: 2500, share: 0.25 }],
      connectedPlatforms: ["meta"],
    });
    const bing = insights.find((i) => i.id === "connect-bing");
    expect(bing?.title).toBe("Microsoft Ads is not wired");
    expect(bing?.href).toBe("/attribution");
  });

  it("points email last-click at the Email desk, not Pixel ROAS", () => {
    const insights = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 10000,
      pixelConversions: 20,
      pixelRevenue: 3000,
      spend: 500,
      mer: 20,
      platformRoas: 6,
      cogsKnown: false,
      channels: [
        { channel: "direct", orders: 50, netSales: 7000, share: 0.7 },
        { channel: "email", orders: 18, netSales: 925, share: 0.09 },
      ],
      connectedPlatforms: ["meta", "brevo"],
    });
    const email = insights.find((i) => i.id === "email-till");
    expect(email?.href).toBe("/email");
    expect(email?.description).toMatch(/18 orders/);
    expect(email?.description).toMatch(/not Pixel ROAS/);
    expect(email?.description).not.toMatch(/email ROAS is/i);
  });

  it("says a quiet window is not 0 influence when Brevo is connected", () => {
    const insights = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 10000,
      pixelConversions: 20,
      pixelRevenue: 3000,
      spend: 500,
      mer: 20,
      platformRoas: 6,
      cogsKnown: false,
      channels: [{ channel: "direct", orders: 80, netSales: 10000, share: 1 }],
      connectedPlatforms: ["meta"],
      emailConnected: true,
      emailDelivered: 0,
    });
    const quiet = insights.find((i) => i.id === "email-quiet-window");
    expect(quiet?.href).toBe("/email");
    expect(quiet?.description).toMatch(/0 delivered/);
    expect(quiet?.description).toMatch(/not Pixel ROAS/);
    expect(quiet?.description).toMatch(/180 days/);
  });

  it("splits mixed tills and stays quiet on a retail-only shop", () => {
    const mixed = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 12000,
      pixelConversions: 20,
      pixelRevenue: 3000,
      spend: 500,
      mer: 24,
      platformRoas: 6,
      cogsKnown: false,
      channels: [{ channel: "direct", orders: 80, netSales: 12000, share: 1 }],
      connectedPlatforms: ["meta"],
      marketMode: "mixed",
      markets: {
        retail: { orders: 50, netSales: 7000 },
        wholesale: { orders: 30, netSales: 5000 },
      },
    });
    expect(mixed.map((i) => i.id)).toContain("two-tills");
    const retailOnly = deriveStoreInsights({
      storeOrders: 80,
      storeNet: 12000,
      pixelConversions: 20,
      pixelRevenue: 3000,
      spend: 500,
      mer: 24,
      platformRoas: 6,
      cogsKnown: false,
      channels: [{ channel: "direct", orders: 80, netSales: 12000, share: 1 }],
      connectedPlatforms: ["meta"],
      marketMode: "retail",
      markets: {
        retail: { orders: 80, netSales: 12000 },
        wholesale: { orders: 0, netSales: 0 },
      },
    });
    expect(retailOnly.map((i) => i.id)).not.toContain("two-tills");
  });
});

describe("buildPixelLeakage", () => {
  it("shares drop-off across stages and skips overflow", () => {
    const rows = buildPixelLeakage([
      { key: "impressions", name: "Impressions", dropped: 80, overflow: false },
      { key: "clicks", name: "Clicks", dropped: 20, overflow: false },
      { key: "landing", name: "Landing", dropped: 50, overflow: true },
    ]);
    expect(rows.map((r) => r.reason)).toEqual(["Did not click", "Clicks without the next pixel"]);
    expect(rows[0]?.share).toBe(80);
    expect(rows[1]?.share).toBe(20);
  });
});

describe("buildAudienceOperatorRecs", () => {
  it("flags high frequency and missing Woo seed", () => {
    const recs = buildAudienceOperatorRecs({
      countries: [{ label: "GR", spend: 600 }],
      ages: [{ label: "25-34", spend: 400 }],
      frequencyReach: [
        { bucket: "1", reach: 100 },
        { bucket: "7-10", reach: 80 },
      ],
      wooConnected: false,
    });
    expect(recs.map((r) => r.id)).toEqual(
      expect.arrayContaining(["geo-concentrate", "high-frequency", "woo-seed"]),
    );
    expect(recs.find((r) => r.id === "woo-seed")?.href).toContain("woocommerce");
  });
});

describe("buildAttributionHonestyRecs", () => {
  it("does not pretend MTA exists on a Meta-only account", () => {
    const recs = buildAttributionHonestyRecs({
      platforms: ["meta"],
      orderCount: 0,
      pixelConversions: 34,
      mer: 0,
    });
    expect(recs.map((r) => r.id)).toEqual(
      expect.arrayContaining(["need-mix", "need-woo", "offer-leak", "no-mta"]),
    );
  });

  it("points at the tracking playbook when GA4 purchases disagree with the pixel", () => {
    const recs = buildAttributionHonestyRecs({
      platforms: ["meta"],
      orderCount: 121,
      pixelConversions: 28,
      mer: 26.91,
      amer: 6.45,
      ga4Purchases: 107,
    });
    expect(recs.map((r) => r.id)).toContain("three-clocks");
    expect(recs.find((r) => r.id === "three-clocks")?.href).toBe("/help");
  });

  it("names email last-click as till, not Brevo ROAS", () => {
    const recs = buildAttributionHonestyRecs({
      platforms: ["meta", "google"],
      orderCount: 80,
      pixelConversions: 20,
      mer: 12,
      emailOrders: 18,
      emailNet: 925,
    });
    const email = recs.find((r) => r.id === "email-till");
    expect(email?.href).toBe("/email");
    expect(email?.description).toMatch(/18 orders/);
    expect(email?.description).toMatch(/Pixel ROAS/);
  });
});

describe("buildMissingPlatformRecs", () => {
  it("asks for Google and TikTok when only Meta is live", () => {
    const recs = buildMissingPlatformRecs(["meta"]);
    expect(recs.map((r) => r.id)).toEqual(["connect-google", "connect-tiktok"]);
  });

  it("does not call OAuth-connected empty Google a live mix", () => {
    const recs = buildMissingPlatformRecs(["meta", "google"], { google: 0, tiktok: 0 });
    expect(recs.map((r) => r.id)).toEqual(["google-ads-no-spend", "connect-tiktok"]);
    expect(recs.find((r) => r.id === "google-ads-no-spend")?.description).toMatch(/till/);
    expect(recs.map((r) => r.id)).not.toContain("mix-live");
  });
});

describe("deriveInsights", () => {
  it("does not invent a budget shift on a Meta-only mix", () => {
    const insights = deriveInsights(
      [{ name: "Meta", spend: 680, revenue: 4500, roas: 6.6 }],
      [
        {
          name: "Advantage+",
          platform: "meta",
          spend: 680,
          revenue: 4500,
          roas: 6.6,
          clicks: 10000,
          impressions: 180000,
        },
      ],
      { ctr: 5.5, conversions: 34, spend: 680 },
      "EUR",
    );
    expect(insights.map((i) => i.id)).not.toContain("budget-shift");
    expect(insights.map((i) => i.id)).not.toContain("audience-expand");
    expect(insights.map((i) => i.id)).toContain("advantage-plus-control");
    expect(insights.find((i) => i.id === "advantage-plus-control")?.href).toBe(
      "/creative-fatigue",
    );
  });

  it("keeps lookalike expansion for a non-Advantage+ winner", () => {
    const insights = deriveInsights(
      [{ name: "Meta", spend: 400, revenue: 1600, roas: 4 }],
      [
        {
          name: "Prospecting — cold traffic",
          platform: "meta",
          spend: 400,
          revenue: 1600,
          roas: 4,
          clicks: 800,
          impressions: 40000,
        },
      ],
      { ctr: 2, conversions: 12, spend: 400 },
      "EUR",
    );
    expect(insights.map((i) => i.id)).toContain("audience-expand");
    expect(insights.find((i) => i.id === "audience-expand")?.description).toMatch(
      /lookalike/i,
    );
  });

  it("asks AI when spend exists but there is nothing to rank", () => {
    const insights = deriveInsights([], [], { ctr: 1, conversions: 2, spend: 100 }, "EUR");
    expect(insights.map((i) => i.id)).toEqual(["ask-ai"]);
  });
});
