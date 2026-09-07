import {
  aggregateCampaigns,
  readMystery,
  resolveSubject,
  type MysteryCampaign,
} from "@/lib/mystery-insights";

const winner: MysteryCampaign = {
  name: "Advantage+ (PUR)",
  platform: "Meta",
  spend: 100,
  revenue: 666,
  roas: 6.66,
  clicks: 500,
  impressions: 10_000,
  conversions: 31,
  ctr: 5,
  cpc: 0.2,
};

const loser: MysteryCampaign = {
  name: "Prospecting cold",
  platform: "Google",
  spend: 80,
  revenue: 20,
  roas: 0.25,
  clicks: 40,
  impressions: 8_000,
  conversions: 1,
  ctr: 0.5,
  cpc: 2,
};

describe("mystery insights", () => {
  it("aggregates spend and ROAS across campaigns", () => {
    const all = aggregateCampaigns([winner, loser]);
    expect(all.spend).toBe(180);
    expect(all.revenue).toBe(686);
    expect(all.roas).toBeCloseTo(686 / 180);
  });

  it("cites the winner's ROAS in a fortune reading", () => {
    const reading = readMystery("fortune", [winner, loser], "Advantage+ (PUR)");
    expect(reading.message).toContain("6.66");
    expect(reading.cited).toContain("Advantage+ (PUR)");
    expect(reading.tone).toBe("success");
    expect(reading.title).toBe("Keep the catalog");
    expect(reading.message).toMatch(/lookalike/i);
    expect(reading.message).not.toMatch(/Protect budget here before spreading/);
  });

  it("flags spend with no conversions", () => {
    const dry: MysteryCampaign = { ...loser, conversions: 0, revenue: 0, roas: 0 };
    const reading = readMystery("fortune", [dry], dry.name);
    expect(reading.tone).toBe("danger");
    expect(reading.message.toLowerCase()).toContain("conversion");
  });

  it("spy mode names strongest and weakest platforms", () => {
    const reading = readMystery("spy", [winner, loser], "all");
    expect(reading.message).toContain("Meta");
    expect(reading.message).toContain("Google");
    expect(reading.cited).toContain("Meta");
  });

  it("returns an empty-state reading when nothing is synced", () => {
    const reading = readMystery("crystal", [], "all");
    expect(reading.title.toLowerCase()).toContain("no campaign");
    expect(resolveSubject([], "all")).toBeNull();
  });
});
