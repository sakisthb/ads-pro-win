import { buildPerformanceAudit, auditMarkdown, precedingAuditWindow, auditProviderAccountLabel } from "../performance-audit";
import type { AuditCampaign, AuditSnapshot } from "../performance-audit";

const window = { startDate: "2026-08-18", endDate: "2026-09-16" };
const row = (extra: Partial<AuditCampaign> = {}): AuditCampaign => ({
  reportRowId: "fixture-a", adAccountId: "fixture-account", campaignId: "fixture-campaign",
  campaignName: "Fixture search", platform: "google", currency: "EUR", status: "active",
  metricState: "stored_metrics", totalSpend: 100, totalConversionValue: 300,
  totalConversions: 20, totalClicks: 100, totalImpressions: 1000, ...extra,
});
const snapshot = (campaigns: AuditCampaign[] = [row()], extra: Partial<AuditSnapshot> = {}): AuditSnapshot => ({
  window, campaigns, truncated: false, coverage: "stored_only_not_provider_verified",
  totals: { campaigns: campaigns.length, active: campaigns.filter(c=>c.status === "active").length,
    storedMetricCampaigns: campaigns.filter(c=>c.metricState === "stored_metrics").length,
    unverifiedCampaigns: campaigns.filter(c=>c.metricState !== "stored_metrics").length }, ...extra,
});
const run = (current = snapshot(), previous?: AuditSnapshot, goal: "sales" | "branding" | "wholesale" = "sales") =>
  buildPerformanceAudit({ current, previous, goal, asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account" });

it("labels provider identity without leaking the internal connector encoding or treating pending as a customer", () => {
  expect(auditProviderAccountLabel("google","gadsacct:fixture-brand:1111111111:2222222222")).toBe("1111111111");
  expect(auditProviderAccountLabel("google","gads:pending:fixture-brand")).toBe("Unverified customer");
  expect(auditProviderAccountLabel("meta","act_1111111111")).toBe("1111111111");
});

it("uses an adjacent equal-length completed UTC comparison including year/leap boundaries", () => {
  expect(precedingAuditWindow(window)).toEqual({ startDate: "2026-07-19", endDate: "2026-08-17" });
  expect(precedingAuditWindow({ startDate: "2024-03-01", endDate: "2024-03-01" })).toEqual({ startDate: "2024-02-29", endDate: "2024-02-29" });
});
it.each([{startDate:"2026-02-30",endDate:"2026-03-05"},{startDate:"2026-09-17",endDate:"2026-09-16"}])("rejects invalid/reversed windows %j", input => {
  expect(()=>precedingAuditWindow(input)).toThrow();
});
it("blocks empty Google coverage instead of reporting zero performance or a winner", () => {
  const result = run(snapshot([]));
  expect(result.verdict).toBe("blocked");
  expect(result.summaries).toEqual([]);
  expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "no_metrics", severity: "blocker" })]));
  expect(result.activationAllowed).toBe(false);
});
it("keeps inventory without metrics separate from measured zero", () => {
  const result = run(snapshot([row({ metricState: "no_stored_metrics", totalSpend: 0, totalConversions: 0 })]));
  expect(result.summaries).toEqual([]);
  expect(result.findings.some(f=>f.code === "no_conversion_spend")).toBe(false);
  expect(result.inventory[0].spend).toBeNull();
});
it("recomputes ratios from sums and never combines EUR/USD", () => {
  const result = run(snapshot([row(), row({reportRowId:"b",campaignId:"b",totalSpend:300,totalConversionValue:300}),
    row({reportRowId:"c",campaignId:"c",currency:"USD",totalSpend:200,totalConversionValue:1000})]));
  expect(result.summaries).toEqual(expect.arrayContaining([
    expect.objectContaining({ currency:"EUR",spend:400,value:600,roas:1.5 }),
    expect.objectContaining({ currency:"USD",spend:200,value:1000,roas:5 }),
  ]));
});
it("uses null for ratios with zero denominator", () => {
  const result = run(snapshot([row({totalSpend:0,totalClicks:0,totalImpressions:0,totalConversions:0,totalConversionValue:0})]));
  expect(result.summaries[0]).toMatchObject({roas:null,cpa:null,cpc:null,ctr:null});
});
it("does not publish account totals or comparisons from a limited row subset", () => {
  const result = run(snapshot([row()], { truncated:true }), snapshot([row()], {window:precedingAuditWindow(window)}));
  expect(result.summaries).toEqual([]);
  expect(result.findings.some(f=>f.code === "truncated")).toBe(true);
  expect(result.findings.some(f=>f.code === "roas_drop")).toBe(false);
});
it("does not turn missing previous metrics into a zero baseline", () => {
  const result = run(snapshot(), snapshot([row({metricState:"no_stored_metrics"})], {window:precedingAuditWindow(window)}));
  expect(result.summaries[0].previous).toBeNull();
  expect(result.findings.some(f=>f.code === "roas_drop")).toBe(false);
  expect(result.findings.some(f=>f.code === "comparison_unavailable")).toBe(true);
});
it("rejects non-adjacent comparison periods", () => {
  const result = run(snapshot(), snapshot([row()], {window}));
  expect(result.findings.some(f=>f.code === "comparison_unavailable")).toBe(true);
  expect(result.summaries[0].previous).toBeNull();
});
it("matches account/currency/campaign grain, never provider campaign id alone", () => {
  const result = run(snapshot(), snapshot([row({adAccountId:"other-account",totalConversionValue:10000})], {window:precedingAuditWindow(window)}));
  expect(result.findings.some(f=>f.code === "roas_drop")).toBe(false);
});
it("flags a disclosed ROAS-drop heuristic without attributing cause or executing a change", () => {
  const result = run(snapshot([row({totalConversionValue:100})]), snapshot([row({totalConversionValue:400})], {window:precedingAuditWindow(window)}));
  expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({code:"roas_drop",severity:"watch",confidence:"provisional"})]));
  expect(result.activationAllowed).toBe(false);
});
it("does not infer a significant ROAS drop from a tiny conversion sample", () => {
  const result = run(snapshot([row({totalConversions:1,totalConversionValue:10})]), snapshot([row()], {window:precedingAuditWindow(window)}));
  expect(result.findings.some(f=>f.code === "roas_drop")).toBe(false);
});
it("treats recorded spend without conversions as investigation, not an automatic pause", () => {
  const result = run(snapshot([row({totalConversions:0,totalConversionValue:0})]));
  expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({code:"no_conversion_spend",severity:"watch"})]));
  expect(result.activationAllowed).toBe(false);
});
it.each([NaN,Infinity,-1])("rejects malformed metric input %s rather than coercing it to zero", totalSpend => {
  const result = run(snapshot([row({totalSpend})]));
  expect(result.verdict).toBe("blocked");
  expect(result.summaries).toEqual([]);
  expect(result.findings.some(f=>f.code === "invalid_metrics")).toBe(true);
});
it("blocks duplicate account/campaign/currency grains", () => {
  const result = run(snapshot([row(),row({reportRowId:"different-id"})]));
  expect(result.findings.some(f=>f.code === "invalid_metrics")).toBe(true);
  expect(result.summaries).toEqual([]);
});
it("uses today's calendar season, not the report period or invented market demand", () => {
  const result = buildPerformanceAudit({current:snapshot(),goal:"sales",asOf:"2026-07-01",platform:"google",adAccountId:"fixture-account"});
  expect(result.calendar.season).toBe("Summer");
  expect(result.calendar.basis).toContain("calendar");
  expect(result.calendar.demandVerified).toBe(false);
  expect(result.calendar.asOf).toBe("2026-07-01");
});
it.each(["sales","branding","wholesale"] as const)("includes objective-specific evidence gaps and a decision plan for %s", goal => {
  const result = run(snapshot(),undefined,goal);
  expect(result.strategy.goal).toBe(goal);
  expect(result.strategy.requiredEvidence.length).toBeGreaterThan(2);
  expect(result.strategy.nextSteps.length).toBeGreaterThan(2);
  expect(result.activationAllowed).toBe(false);
});
it("exports the same scope, limitations, diagnostics, strategy and calendar as the desk", () => {
  const result = run(snapshot([row({campaignName:"Fixture | injected\n## heading"})]));
  const md = auditMarkdown(result,{brand:"Fixture shop",account:"Fixture account",providerAccountId:"1111111111",market:"all"});
  expect(md).toContain("2026-08-18");
  expect(md).toContain("2026-09-16");
  expect(md).toContain("stored_only_not_provider_verified");
  expect(md).toContain("1111111111");
  expect(md).toContain("Calendar");
  expect(md).toContain("Unavailable evidence");
  expect(md).toContain("read-only");
  expect(md).toContain("| CPA | CTR (%) |");
  expect(md).toContain("| Status | Objective | Currency |");
  expect(md).toContain("Stored metric campaigns: 1; without window metrics: 0.");
  expect(md).not.toContain("\n## heading");
});
