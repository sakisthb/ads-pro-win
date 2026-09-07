import {
  buildGroundedChatReply,
  looksLikeAuctionIntelQuestion,
  looksLikeBlendedRoasQuestion,
  looksLikeLookalikeQuestion,
} from "@/lib/ai/chat-fallback";

describe("buildGroundedChatReply", () => {
  it("labels DailyMetric conversion value as pixel ROAS, not MER", () => {
    const text = buildGroundedChatReply({
      question: "How is ROAS?",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 640, revenue: 4340, clicks: 9694, conversions: 28 },
      ],
      storeNet: 0,
      orderCount: 0,
    });
    expect(text).toMatch(/Pixel ROAS: \*\*6\.78x\*\*/);
    expect(text).not.toMatch(/Blended MER/);
    expect(text).toMatch(/Store MER is unavailable/);
  });

  it("separates store MER when Woo orders exist", () => {
    const text = buildGroundedChatReply({
      question: "What is MER?",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 640, revenue: 4340, clicks: 9694, conversions: 28 },
      ],
      storeNet: 17414,
      orderCount: 123,
    });
    expect(text).toMatch(/Store MER: \*\*27\.21x\*\*/);
    expect(text).toMatch(/Do not scale Advantage\+ off MER/);
  });

  it("names store, pixel, and GA4 as five clocks and never adds them", () => {
    const text = buildGroundedChatReply({
      question: "How many purchases?",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 640, revenue: 4340, clicks: 9694, conversions: 28 },
      ],
      storeNet: 17414,
      orderCount: 121,
      ga4Purchases: 107,
    });
    expect(text).toMatch(/Five clocks/);
    expect(text).toMatch(/Search Console/);
    expect(text).toMatch(/\*\*121\*\* store orders/);
    expect(text).toMatch(/\*\*28\*\* pixel conversions/);
    expect(text).toMatch(/\*\*107\*\* GA4 ecommerce purchases/);
    expect(text).toMatch(/Do not add them/);
    expect(text).toMatch(/GA4 sessions are not ad clicks/);
    expect(text).toMatch(/synced paid DailyMetric/);
  });

  it("blocks a lookalike test when the operator asks for one", () => {
    expect(looksLikeLookalikeQuestion("Compare 1% vs 3% lookalike")).toBe(true);
    const text = buildGroundedChatReply({
      question: "Which lookalikes should I test next?",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 640, revenue: 4340, clicks: 9694, conversions: 28 },
      ],
      storeNet: 17414,
      orderCount: 123,
    });
    expect(text).toMatch(/do not test a 1–3% lookalike/i);
  });

  it("refuses blended ROAS when the operator asks to mix clocks", () => {
    expect(looksLikeBlendedRoasQuestion("Show blended ROAS")).toBe(true);
    const text = buildGroundedChatReply({
      question: "Show blended ROAS for the last 30 days",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 412, revenue: 1743, clicks: 6675, conversions: 13 },
      ],
      storeNet: 11621,
      orderCount: 85,
      ga4Purchases: 97,
    });
    expect(text).toMatch(/There is no blended ROAS/);
    expect(text).toMatch(/Do not add the five clocks/);
    expect(text).not.toMatch(/Blended ROAS: \*\*/);
  });

  it("refuses invented auction intel", () => {
    expect(looksLikeAuctionIntelQuestion("Show competitor auction insights")).toBe(true);
    const text = buildGroundedChatReply({
      question: "What is our impression share vs competitors?",
      currency: "EUR",
      platforms: [
        { platform: "meta", spend: 412, revenue: 1743, clicks: 6675, conversions: 13 },
      ],
      storeNet: 11621,
      orderCount: 85,
    });
    expect(text).toMatch(/will not invent them/);
    expect(text).toMatch(/Woo last-click Google is till/);
  });
});
