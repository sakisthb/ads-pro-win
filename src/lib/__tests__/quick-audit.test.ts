import { buildQuickAudit, targetRoasForObjective } from "@/lib/quick-audit";

describe("quick audit", () => {
  it("sets a higher ROAS bar for sales than for leads", () => {
    expect(targetRoasForObjective("sales")).toBe(2.5);
    expect(targetRoasForObjective("leads")).toBe(1.5);
    expect(targetRoasForObjective("awareness")).toBe(0);
  });

  it("flags high spend with no purchases as high priority", () => {
    const result = buildQuickAudit({
      objective: "sales",
      campaigns: [
        {
          campaignId: "c1",
          campaignName: "No conversions",
          platform: "facebook",
          totalSpend: 120,
          roas: 0,
          totalConversions: 0,
        },
      ],
    });
    expect(result.highCount).toBe(1);
    expect(result.items[0]?.priority).toBe("high");
  });

  it("protects campaigns at or above the target ROAS", () => {
    const result = buildQuickAudit({
      objective: "sales",
      campaigns: [
        {
          campaignId: "c2",
          campaignName: "Winner",
          platform: "google",
          totalSpend: 80,
          roas: 3.1,
          totalConversions: 12,
        },
      ],
    });
    expect(result.items[0]?.priority).toBe("stable");
    expect(result.highCount).toBe(0);
  });
});
