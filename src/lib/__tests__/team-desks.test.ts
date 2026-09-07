import {
  buildTeamPlanAsk,
  deriveTeamDesks,
  type DeriveTeamDesksInput,
} from "@/lib/team-desks";

const empty: DeriveTeamDesksInput = {
  currency: "EUR",
  connectedAccounts: 0,
  accounts: [],
  campaigns: [],
  wasted: { count: 0, totalWastedSpend: 0 },
  totals: null,
  alertCount: 0,
};

describe("deriveTeamDesks", () => {
  it("marks every desk needs_data when the workspace has no spend", () => {
    const { desks } = deriveTeamDesks(empty);
    expect(desks).toHaveLength(5);
    expect(desks.every((d) => d.status === "needs_data")).toBe(true);
    expect(desks.find((d) => d.id === "optimizer")?.href).toBe("/connections");
    expect(desks.every((d) => d.askPrompt.includes("Finding:"))).toBe(true);
  });

  it("flags the optimizer when campaigns sit below 1x ROAS", () => {
    const { desks, tasks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      wasted: {
        count: 2,
        totalWastedSpend: 880,
        topName: "Prospecting",
        topRoas: 0.4,
      },
      totals: { spend: 2000, revenue: 900, roas: 0.45, conversions: 12, ctr: 1.2 },
    });
    const optimizer = desks.find((d) => d.id === "optimizer");
    expect(optimizer?.status).toBe("ready");
    expect(optimizer?.href).toBe("/bidding");
    expect(optimizer?.finding).toMatch(/€880/);
    expect(optimizer?.finding).toMatch(/Prospecting/);
    expect(tasks.some((t) => t.deskId === "optimizer" && t.status === "ready")).toBe(
      true,
    );
  });

  it("flags creative when a campaign CTR is well below blended", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      campaigns: [
        { name: "Tired set", spend: 400, roas: 1.1, impressions: 10000, clicks: 40 },
        { name: "Healthy set", spend: 400, roas: 3.2, impressions: 10000, clicks: 400 },
      ],
      totals: { spend: 800, revenue: 1700, roas: 2.1, conversions: 20, ctr: 2.2 },
    });
    const creative = desks.find((d) => d.id === "creative");
    expect(creative?.status).toBe("ready");
    expect(creative?.href).toBe("/creative-fatigue");
    expect(creative?.finding).toMatch(/Tired set/);
  });

  it("flags budget when two platforms have a wide ROAS gap", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 2,
      accounts: [
        { name: "Meta", platform: "meta", totalSpend: 5000, roas: 4.2 },
        { name: "TikTok", platform: "tiktok", totalSpend: 2000, roas: 1.5 },
      ],
      totals: { spend: 7000, revenue: 24000, roas: 3.4, conversions: 80, ctr: 2 },
    });
    const budget = desks.find((d) => d.id === "budget");
    expect(budget?.status).toBe("ready");
    expect(budget?.href).toBe("/cross-platform");
    expect(budget?.finding).toMatch(/Meta/);
    expect(budget?.finding).toMatch(/TikTok/);
  });

  it("flags audience from a 3x+ winner and reports when spend exists", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      campaigns: [
        { name: "VIP retargeting", spend: 900, roas: 5.1, impressions: 8000, clicks: 320 },
      ],
      totals: { spend: 900, revenue: 4590, roas: 5.1, conversions: 40, ctr: 4 },
      alertCount: 1,
    });
    expect(desks.find((d) => d.id === "audience")?.status).toBe("ready");
    expect(desks.find((d) => d.id === "audience")?.href).toBe("/audiences");
    const reports = desks.find((d) => d.id === "reports");
    expect(reports?.status).toBe("ready");
    expect(reports?.finding).toMatch(/1 budget alert/);
    expect(reports?.href).toBe("/reports");
  });

  it("keeps ESP email off the paid brief when Brevo is quiet in 30 days", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      totals: { spend: 412, revenue: 1746, roas: 4.23, conversions: 13, ctr: 5.5 },
      email: { connected: true, delivered: 0, uniqueOpens: 0, clicks: 0 },
    });
    const reports = desks.find((d) => d.id === "reports");
    expect(reports?.finding).toMatch(/Brevo is connected/);
    expect(reports?.finding).toMatch(/180 days/);
    expect(reports?.finding).not.toMatch(/email ROAS/i);
  });

  it("does not treat empty Google Ads OAuth as a second funded platform", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 2,
      accounts: [{ name: "Meta", platform: "meta", totalSpend: 412, roas: 4.23 }],
      totals: { spend: 412, revenue: 1746, roas: 4.23, conversions: 13, ctr: 5.5 },
      googleAds: { connected: true, spend: 0 },
    });
    const budget = desks.find((d) => d.id === "budget");
    expect(budget?.finding).toMatch(/€0 DailyMetric/);
    expect(budget?.finding).toMatch(/till/);
    expect(budget?.actionLabel).toMatch(/Google Ads/);
    const reports = desks.find((d) => d.id === "reports");
    expect(reports?.finding).toMatch(/0 spend rows/);
    expect(reports?.finding).toMatch(/Meta-only/);
  });

  it("does not send Advantage+ winners to a lookalike test", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      campaigns: [
        {
          name: "Advantage+ (PUR) // General Campaign",
          spend: 680,
          roas: 6.78,
          impressions: 174000,
          clicks: 9700,
        },
      ],
      totals: { spend: 680, revenue: 4600, roas: 6.78, conversions: 28, ctr: 5.56 },
    });
    const audience = desks.find((d) => d.id === "audience");
    expect(audience?.href).toBe("/creative-fatigue");
    expect(audience?.finding).toMatch(/lookalikes are not the next move/i);
    expect(audience?.finding).not.toMatch(/1–3% lookalike/);
    expect(audience?.role).toMatch(/do not invent a lookalike/i);
  });

  it("builds a plan prompt that names every desk finding", () => {
    const { desks } = deriveTeamDesks({
      ...empty,
      connectedAccounts: 1,
      totals: { spend: 100, revenue: 400, roas: 4, conversions: 10, ctr: 2 },
    });
    const prompt = buildTeamPlanAsk(desks);
    expect(prompt).toMatch(/Campaign Optimizer/);
    expect(prompt).toMatch(/Report Generator/);
    expect(prompt).toMatch(/ranked plan/);
  });
});
