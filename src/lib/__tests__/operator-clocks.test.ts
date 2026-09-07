import {
  asClockNumber,
  buildOperatorDesk,
  deriveOperatorBlockers,
  deriveOperatorClocks,
  operatorDeskReady,
} from "@/lib/operator-clocks";

describe("operatorDeskReady", () => {
  it("is false until every clock query has fetched", () => {
    expect(operatorDeskReady({ isFetched: false }, { isFetched: true })).toBe(false);
    expect(operatorDeskReady({ isFetched: true }, { isFetched: true })).toBe(true);
    expect(operatorDeskReady()).toBe(false);
  });
});

describe("asClockNumber", () => {
  it("treats empty objects and NaN as 0 so tiles can fall back to mer", () => {
    expect(asClockNumber(412.4)).toBe(412.4);
    expect(asClockNumber("412")).toBe(412);
    expect(asClockNumber({})).toBe(0);
    expect(asClockNumber(undefined)).toBe(0);
  });
});

describe("deriveOperatorClocks", () => {
  const clocks = deriveOperatorClocks({
    pixelSpend: 412,
    pixelConversions: 97,
    pixelRoas: 4.23,
    storeOrders: 180,
    storeNet: 22000,
    ga4Connected: true,
    ga4Sessions: 12000,
    ga4Purchases: 40,
    gscConnected: true,
    gscClicks: 3100,
    gscImpressions: 88000,
    emailConnected: true,
    emailDelivered: 71029,
    emailCampaigns: 28,
    currency: "EUR",
  });

  it("names five clocks in order and never mixes money into GSC or email", () => {
    expect(clocks.map((c) => c.id)).toEqual(["pixel", "till", "ga4", "gsc", "email"]);
    expect(clocks.find((c) => c.id === "gsc")?.secondary).toMatch(/€0 value/);
    expect(clocks.find((c) => c.id === "gsc")?.not).toMatch(/not Google Ads/);
    expect(clocks.find((c) => c.id === "email")?.not).toMatch(/not Pixel ROAS/);
    expect(clocks.find((c) => c.id === "pixel")?.not).toMatch(/not till/);
  });

  it("keeps a quiet email window as connected, not zero influence", () => {
    const quiet = deriveOperatorClocks({
      pixelSpend: 0,
      pixelConversions: 0,
      pixelRoas: 0,
      storeOrders: 0,
      storeNet: 0,
      ga4Connected: false,
      ga4Sessions: 0,
      ga4Purchases: 0,
      gscConnected: false,
      gscClicks: 0,
      gscImpressions: 0,
      emailConnected: true,
      emailDelivered: 0,
      emailCampaigns: 0,
    });
    const email = quiet.find((c) => c.id === "email");
    expect(email?.connected).toBe(true);
    expect(email?.secondary).toMatch(/not 0 influence/);
  });

  it("splits the till clock only when both desks have volume", () => {
    const split = deriveOperatorClocks({
      pixelSpend: 100,
      pixelConversions: 10,
      pixelRoas: 2,
      storeOrders: 80,
      storeNet: 9000,
      ga4Connected: false,
      ga4Sessions: 0,
      ga4Purchases: 0,
      gscConnected: false,
      gscClicks: 0,
      gscImpressions: 0,
      emailConnected: false,
      emailDelivered: 0,
      emailCampaigns: 0,
      marketMode: "mixed",
      retailOrders: 50,
      wholesaleOrders: 30,
    }).find((c) => c.id === "till");
    expect(split?.secondary).toMatch(/ΛΙΑΝΙΚΗ 50/);
    expect(split?.secondary).toMatch(/χονδρική 30/);
    const retailOnly = deriveOperatorClocks({
      pixelSpend: 100,
      pixelConversions: 10,
      pixelRoas: 2,
      storeOrders: 80,
      storeNet: 9000,
      ga4Connected: false,
      ga4Sessions: 0,
      ga4Purchases: 0,
      gscConnected: false,
      gscClicks: 0,
      gscImpressions: 0,
      emailConnected: false,
      emailDelivered: 0,
      emailCampaigns: 0,
      marketMode: "retail",
      retailOrders: 80,
      wholesaleOrders: 0,
    }).find((c) => c.id === "till");
    expect(retailOnly?.secondary).toBe("80 paid Woo orders");
  });
});

describe("deriveOperatorBlockers", () => {
  it("flags CAPI, Google Ads token, Woo VAT, and a quiet email window", () => {
    const blockers = deriveOperatorBlockers({
      storeOrders: 180,
      pixelConversions: 40,
      googleAdsConnected: true,
      googleAdsSpend: 0,
      emailConnected: true,
      emailDelivered: 0,
      tax: 0,
      ga4Sessions: 8000,
      ga4Purchases: 40,
      ga4UnassignedSessions: 900,
    });
    expect(blockers.map((b) => b.id)).toEqual([
      "capi-emq",
      "google-ads-api",
      "ga4-mp",
      "woo-vat",
      "ga4-unassigned",
      "email-quiet",
    ]);
    expect(blockers.find((b) => b.id === "email-quiet")?.detail).toMatch(/not 0 influence/);
    expect(blockers.find((b) => b.id === "woo-vat")?.detail).toMatch(/ΦΠΑ/);
    expect(blockers.find((b) => b.id === "google-ads-api")?.href).toBe("/connections?connect=google-ads");
  });

  it("stays quiet when clocks already agree and Google Ads has spend", () => {
    expect(
      deriveOperatorBlockers({
        storeOrders: 40,
        pixelConversions: 38,
        googleAdsConnected: true,
        googleAdsSpend: 120,
        emailConnected: true,
        emailDelivered: 4000,
        tax: 480,
        ga4Sessions: 200,
        ga4Purchases: 39,
        ga4UnassignedSessions: 4,
      }),
    ).toEqual([]);
  });
});

describe("buildOperatorDesk", () => {
  it("falls through empty totals objects to mer so KPI tiles match the pixel clock", () => {
    const desk = buildOperatorDesk({
      totals: { totalSpend: {}, totalConversionValue: {}, totalConversions: {}, blendedROAS: {} },
      mer: {
        totalSpend: 412.4,
        totalAttributedRevenue: 1744,
        pixelConversions: 13,
        platformROAS: 4.23,
        orderCount: 85,
        totalRevenue: 11621,
        tax: 0,
      },
      ga4: { connected: true, totals: { sessions: 10172, purchases: 97 }, channels: [] },
      gsc: { connected: true, totals: { clicks: 3635, impressions: 60078 } },
      email: { connected: true, totalSent: 0, campaignCount: 0 },
      googleAdsConnected: true,
      googleAdsSpend: 0,
      currency: "EUR",
    });
    expect(desk.pixelSpend).toBe(412.4);
    expect(desk.pixelConversions).toBe(13);
    expect(desk.clocks.find((c) => c.id === "pixel")?.primary).toMatch(/412/);
    expect(desk.clocks.find((c) => c.id === "email")?.secondary).toMatch(/not 0 influence/);
    expect(desk.blockers.map((b) => b.id)).toEqual(
      expect.arrayContaining(["capi-emq", "google-ads-api", "woo-vat", "email-quiet"]),
    );
  });
});
