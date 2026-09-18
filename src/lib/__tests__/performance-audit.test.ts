import { buildPerformanceAudit, auditMarkdown, precedingAuditWindow, auditProviderAccountLabel } from "../performance-audit";
import type { AuditCampaign, AuditSnapshot } from "../performance-audit";
import { emptyProjectContext } from "../project-context";

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
it('distinguishes ADR 0003 repairs from still-locked campaign actions in the report',()=>{
  expect(run(snapshot([])).decisionPlan.join(' ')).toContain('Google Repair Desk (ADR 0003)');
});
it('keeps campaign strategy evidence-first rather than turning every audit into host recovery', () => {
  const result = run(snapshot([]));
  expect(result.decisionPlan[0]).toMatch(/Reconcile the exact owned account/i);
  expect(result.decisionPlan.join(' ')).not.toMatch(/host\/recovery|reinstall/i);
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
  const result = buildPerformanceAudit({current:snapshot([], {window:{startDate:"2026-06-01",endDate:"2026-06-30"}}),goal:"sales",asOf:"2026-07-01",platform:"google",adAccountId:"fixture-account"});
  expect(result.calendar.season).toBe("Summer");
  expect(result.calendar.basis).toContain("calendar");
  expect(result.calendar.demandVerified).toBe(false);
  expect(result.calendar.asOf).toBe("2026-07-01");
});

it("uses an explicitly selected year-over-year baseline in the engine and export", () => {
  const prior = snapshot([row({totalConversionValue:400})], {window:{startDate:"2025-08-18",endDate:"2025-09-16"}});
  const result = buildPerformanceAudit({current:snapshot(),previous:prior,comparison:{mode:"year",yearsBack:1},goal:"sales",asOf:"2026-09-17",platform:"google",adAccountId:"fixture-account"});
  expect(result.summaries[0].previous?.roas).toBe(4);
  expect(result.comparisonWindow).toEqual(prior.window);
  expect(result.comparison.label).toContain("1 year");
  expect(auditMarkdown(result,{brand:"Fixture",account:"Fixture",providerAccountId:"1",market:"all"})).toContain("2025-08-18");
});
it("withholds unequal-length historical comparisons and watch rules", () => {
  const result = buildPerformanceAudit({current:snapshot(),previous:snapshot([row({totalConversionValue:10000})],{window:{startDate:"2020-01-01",endDate:"2020-01-07"}}),
    comparison:{mode:"custom",window:{startDate:"2020-01-01",endDate:"2020-01-07"}},goal:"sales",asOf:"2026-09-17",platform:"google",adAccountId:"fixture-account"});
  expect(result.summaries[0].previous).toBeNull();
  expect(result.findings.some(f=>f.code==="roas_drop")).toBe(false);
  expect(result.comparison.equalDays).toBe(false);
});
it("exposes all supported sums and ratios without mislabelling conversion rate or AOV", () => {
  const result = run();
  expect(result.summaries[0]).toMatchObject({clicks:100,impressions:1000,cpc:1,ctr:10,cpm:100});
  expect(result.kpis.find(k=>k.id==="cpm")).toMatchObject({status:"stored_subset",values:[{currency:"EUR",current:100,baseline:null}]});
  expect(result.kpis.find(k=>k.id==="purchase_roas")).toMatchObject({status:"unavailable",values:[]});
  expect(result.kpis.find(k=>k.id==="conversion_rate")).toMatchObject({status:"unavailable",values:[]});
  expect(result.kpis.find(k=>k.id==="aov")).toBeUndefined();
  const md = auditMarkdown(result,{brand:"Fixture",account:"Fixture",providerAccountId:"1",market:"all"});
  expect(md).toContain("KPI definitions and availability");
  expect(md).toContain("CPM");
  expect(md).toContain("Clicks");
  expect(md).toContain("https://support.google.com/google-ads/answer/6270625?hl=en");
});
it.each(["branding","wholesale"] as const)("does not fabricate primary %s outcomes from generic conversions", goal => {
  const result=run(snapshot(),undefined,goal);
  expect(result.kpis.filter(k=>k.role==="primary").length).toBeGreaterThan(0);
  expect(result.kpis.filter(k=>k.role==="primary").every(k=>k.status==="unavailable" && !k.values.length)).toBe(true);
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

it("carries saved business inputs into the audit and export without inventing numeric economics or overriding the selected goal", () => {
  const context = { ...emptyProjectContext(), objective: "leads" as const, targetResult: "Owner target | text", priorities: "Qualified shops",
    constraints: "No automatic scaling", seasonality: "Operator winter plan", notes: "Unverified\n## injected heading", updatedAt: "2026-09-17T10:00:00Z" };
  const result = buildPerformanceAudit({ current: snapshot(), goal: "wholesale", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account",
    businessContext: { source: "brand", context } });
  expect(result.businessContext).toEqual({ source: "brand", context });
  expect(result.goal).toBe("wholesale");
  expect(result.summaries[0].roas).toBe(3);
  expect(result.activationAllowed).toBe(false);
  const md = auditMarkdown(result, { brand: "Fixture shop", account: "Fixture account", providerAccountId: "1111111111", market: "wholesale" });
  expect(md).toContain("## Business Context (brand-level)");
  expect(md).toContain("Operator inputs, not verified business economics");
  expect(md).toContain("shared across accounts and markets");
  expect(md).toContain("Saved inputs may be outdated");
  expect(md).toContain("Saved objective: leads");
  expect(md).toContain("No automatic scaling");
  expect(md).toContain("Operator winter plan");
  expect(md).toContain("2026-09-17T10:00:00Z");
  expect(md).not.toContain("\n## injected heading");
});
it("marks saved business context that predates a live connection as stale claims on the desk and in the export", () => {
  const context = { ...emptyProjectContext(), notes: "Google not connected yet; Meta only", updatedAt: "2026-08-28T10:00:00Z" };
  const result = buildPerformanceAudit({ current: snapshot(), goal: "sales", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account",
    businessContext: { source: "brand", context }, contextConnections: [{ platform: "google", connectedAt: "2026-09-17" }] });
  expect(result.businessContextStaleness).toContain("Saved on 2026-08-28, before the google connection");
  const md = auditMarkdown(result, { brand: "Fixture", account: "Fixture", providerAccountId: "1", market: "all" });
  expect(md).toContain("Saved on 2026-08-28, before the google connection");
  expect(md).toContain("historical, not current truth");
});

it("keeps business context staleness silent when connections predate the save or none are provided", () => {
  const context = { ...emptyProjectContext(), notes: "Meta only", updatedAt: "2026-08-28T10:00:00Z" };
  const stale = buildPerformanceAudit({ current: snapshot(), goal: "sales", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account",
    businessContext: { source: "brand", context }, contextConnections: [{ platform: "google", connectedAt: "2026-08-01" }] });
  expect(stale.businessContextStaleness).toBeNull();
  expect(auditMarkdown(stale, { brand: "Fixture", account: "Fixture", providerAccountId: "1", market: "all" })).not.toContain("before the google connection");
  const none = buildPerformanceAudit({ current: snapshot(), goal: "sales", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account",
    businessContext: { source: "brand", context } });
  expect(none.businessContextStaleness).toBeNull();
});

it.each(["missing", "unavailable"] as const)("exports %s business context as a gap, not a legacy or invented profile", source => {
  const result = buildPerformanceAudit({ current: snapshot(), goal: "sales", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account",
    businessContext: { source, context: null } });
  const md = auditMarkdown(result, { brand: "Fixture", account: "Fixture", providerAccountId: "1", market: "all" });
  expect(md).toContain(`Business context source: ${source}`);
  expect(md).toContain("No verified economics or numeric targets are inferred");
  expect(result.activationAllowed).toBe(false);
});
