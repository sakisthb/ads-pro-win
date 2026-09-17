import { buildQuickAudit, targetRoasForObjective } from "@/lib/quick-audit";

describe("retired unscoped quick audit", () => {
  it.each(["sales", "leads", "awareness", "traffic", undefined])("never invents a numeric target for %s", objective => {
    expect(targetRoasForObjective(objective)).toBeNull();
  });
  it.each([0, 3.1, NaN, Infinity])("withholds legacy campaign advice rather than classify ROAS %s", roas => {
    const result = buildQuickAudit({ objective: "sales", targetRoas: 2.5, campaigns: [{
      campaignId: "c1", campaignName: "Unscoped fixture", platform: "google", totalSpend: 120,
      roas, totalConversions: 0,
    }] });
    expect(result).toMatchObject({ status: "retired", executionAllowed: false, auditUrl: "/account-audit", items: [] });
    expect(result.summary).toMatch(/retired/i);
    expect(result.summary).not.toMatch(/No emergency|protect.*performer|without a purchase|pause or rebuild|scale in small/i);
  });
  it("does not interpret an empty legacy result as measured zero or a Connect/Sync diagnosis", () => {
    const result = buildQuickAudit({ campaigns: [] });
    expect(result.summary).toMatch(/exact.*account/i);
    expect(result.summary).toMatch(/no.*performance verdict/i);
    expect(result.summary).not.toMatch(/Connect an|Sync the account|No emergency/i);
  });
});
