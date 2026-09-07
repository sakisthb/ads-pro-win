import { getAdSetBidSuggestion } from "@/lib/bid-suggestions";

const base = {
  spend: 640,
  impressions: 174000,
  clicks: 9700,
  ctr: 5.56,
  frequency: 3.5,
  cpc: 0.07,
  conversions: 28,
};

describe("getAdSetBidSuggestion", () => {
  it("keeps Advantage+ as control instead of a lookalike or launcher scale", () => {
    const rec = getAdSetBidSuggestion(
      { ...base, adsetName: "Advantage+ // 03.10.2024" },
      0.07,
    );
    expect(rec.href).toBe("/creative-fatigue");
    expect(rec.label).toMatch(/keep Advantage\+ as control/i);
    expect(rec.label).not.toMatch(/lookalike/i);
  });

  it("does not tell Advantage+ to expand audience when frequency is high", () => {
    const rec = getAdSetBidSuggestion(
      { ...base, adsetName: "ASC catalog", frequency: 5.2, conversions: 10 },
      0.07,
    );
    expect(rec.label).toMatch(/do not expand a lookalike/i);
    expect(rec.href).toBe("/creative-fatigue");
  });

  it("still offers audience expansion on a non-Advantage+ set", () => {
    const rec = getAdSetBidSuggestion(
      { ...base, adsetName: "Prospecting interests", frequency: 5.1, conversions: 2 },
      0.07,
    );
    expect(rec.label).toMatch(/expand audience/i);
  });
});
