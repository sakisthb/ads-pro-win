import { validCampaignWindow } from "./campaign-reporting";
import { projectContextEntries, type ProjectContext } from "./project-context";

export type AuditGoal = "sales" | "branding" | "wholesale";
export type AuditWindow = { startDate: string; endDate: string };
export type AuditBusinessContext = { source: "brand" | "missing" | "unavailable"; context: ProjectContext | null };
export const BUSINESS_CONTEXT_CAUTION = "Saved inputs may be outdated; revalidate connections, economics and dates before decisions. They never override measured coverage.";
export interface AuditCampaign {
  reportRowId: string; adAccountId: string; campaignId: string; campaignName: string;
  platform: string; currency: string; status: string; metricState: string;
  totalSpend: number; totalConversionValue: number; totalConversions: number;
  totalClicks: number; totalImpressions: number;
  dailyBudget?: number | null; objective?: string | null;
}
export interface AuditSnapshot {
  window: AuditWindow; campaigns: AuditCampaign[]; truncated: boolean;
  coverage: "stored_only_not_provider_verified";
  totals: { campaigns: number; active: number; storedMetricCampaigns: number; unverifiedCampaigns: number };
}
type Measures = { spend: number; value: number; conversions: number; clicks: number; impressions: number;
  roas: number | null; cpa: number | null; cpc: number | null; ctr: number | null };
export type AuditFinding = {
  id: string; code: string; severity: "blocker" | "watch"; confidence: "observed" | "provisional";
  title: string; evidence: string; nextStep: string; campaignName?: string; currency?: string;
};
export type PerformanceAudit = ReturnType<typeof buildPerformanceAudit>;
const dayMs = 86_400_000;
const atUtc = (day: string) => new Date(`${day}T00:00:00Z`).getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Display only. Never use this label instead of server-side account ownership. */
export function auditProviderAccountLabel(platform: string, raw: string): string {
  if (platform === "google") {
    if (raw.startsWith("gads:pending:")) return "Unverified customer";
    return raw.match(/^gadsacct:[^:]+:(\d+)(?::\d+)?$/)?.[1] ?? raw;
  }
  return platform === "meta" ? raw.replace(/^act_/, "") : raw;
}

export function precedingAuditWindow(window: AuditWindow): AuditWindow {
  if (!validCampaignWindow(window.startDate, window.endDate)) throw new Error("Invalid audit window");
  const days = (atUtc(window.endDate) - atUtc(window.startDate)) / dayMs + 1;
  if (days > 366) throw new Error("Audit window must be at most 366 days");
  return { startDate: iso(atUtc(window.startDate) - days * dayMs), endDate: iso(atUtc(window.startDate) - dayMs) };
}

function key(row: AuditCampaign) { return JSON.stringify([row.adAccountId, row.platform, row.campaignId, row.currency]); }
function validMetrics(row: AuditCampaign) {
  return /^[A-Z]{3}$/.test(row.currency) &&
    [row.totalSpend, row.totalConversionValue, row.totalConversions, row.totalClicks, row.totalImpressions]
      .every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
}
function measured(rows: AuditCampaign[]) { return rows.filter(r => r.metricState === "stored_metrics"); }
function aggregate(rows: AuditCampaign[]): Measures {
  const sums = rows.reduce((s, r) => ({ spend: s.spend + r.totalSpend, value: s.value + r.totalConversionValue,
    conversions: s.conversions + r.totalConversions, clicks: s.clicks + r.totalClicks, impressions: s.impressions + r.totalImpressions }),
  { spend: 0, value: 0, conversions: 0, clicks: 0, impressions: 0 });
  return { ...sums, roas: sums.spend > 0 ? sums.value / sums.spend : null,
    cpa: sums.conversions > 0 ? sums.spend / sums.conversions : null,
    cpc: sums.clicks > 0 ? sums.spend / sums.clicks : null,
    ctr: sums.impressions > 0 ? sums.clicks / sums.impressions * 100 : null };
}

function strategy(goal: AuditGoal) {
  const plans = {
    sales: {
      question: "Which acquisition activity can produce profitable sales, not just attributed revenue?",
      requiredEvidence: ["Purchase-only conversion actions, deduplication and conversion lag", "Product margins, returns, VAT and contribution after ad spend",
        "Search terms / brand vs non-brand / new-customer quality", "PMax product/feed eligibility, stock and landing-page performance"],
      nextSteps: ["Verify purchase values and compare ad attribution with store outcomes without adding the clocks",
        "Separate brand capture from non-brand acquisition; inspect product and query evidence",
        "Design one bounded test with owner-approved economics, budget and stop conditions; do not scale from ROAS alone"],
    },
    branding: {
      question: "Are we creating relevant demand, rather than judging awareness by purchase ROAS?",
      requiredEvidence: ["Reach, frequency and audience overlap at their non-additive grain", "Creative/video delivery and message testing",
        "Comparable branded-search / direct-demand history", "Lift or incrementality design and eligibility"],
      nextSteps: ["Define audience, message and distinct awareness objective",
        "Use lift evidence where available; label search/traffic changes as proxies, not causal proof",
        "Set a separate test envelope and review creative fatigue before a sales-budget decision"],
    },
    wholesale: {
      question: "Which activity brings qualified wholesale buyers who place and repeat paid orders?",
      requiredEvidence: ["Business qualification, country, store type and minimum-order fit", "Lead identity → sales follow-up → first paid order",
        "Repeat wholesale orders and contribution/cohort value", "Wholesale landing page, catalog availability and ordering lead times"],
      nextSteps: ["Define qualified business lead and separate it from clicks, registrations and retail purchases",
        "Validate the lead-to-order handoff and offline-conversion matching before bidding on lead volume",
        "Test wholesale intent and messaging separately from B2C; evaluate paid and repeat buyers, not generic ROAS"],
    },
  };
  return { goal, ...plans[goal] };
}

function calendar(asOf: string) {
  if (!validCampaignWindow(asOf, asOf)) throw new Error("Invalid calendar date");
  const month = new Date(`${asOf}T00:00:00Z`).getUTCMonth();
  const season = month >= 2 && month <= 4 ? "Spring" : month >= 5 && month <= 7 ? "Summer" : month >= 8 && month <= 10 ? "Autumn" : "Winter";
  return { asOf, season, basis: "Northern-hemisphere meteorological calendar; planning context, not measured market demand.", demandVerified: false,
    prompts: ["Confirm the current collection, stock, margins, geography and commercial calendar with the operator",
      "Use comparable year-over-year query/product history to validate seasonal demand; this desk does not load that history yet",
      "Check retail campaign timing and wholesale buying/fulfilment lead times separately"] };
}

/** Pure, deterministic stored-data diagnostics. No provider calls, writes or invented targets. */
export function buildPerformanceAudit(input: {
  current: AuditSnapshot; previous?: AuditSnapshot; goal: AuditGoal; asOf: string;
  platform: string; adAccountId: string;
  businessContext?: AuditBusinessContext;
}) {
  const { current, previous } = input;
  const businessContext: AuditBusinessContext = input.businessContext?.source === "brand" && input.businessContext.context
    ? input.businessContext : { source: input.businessContext?.source === "unavailable" ? "unavailable" : "missing", context: null };
  const comparisonWindow = precedingAuditWindow(current.window);
  const findings: AuditFinding[] = [];
  const add = (f: Omit<AuditFinding, "id">, suffix = "") => findings.push({ ...f, id: `${f.code}:${suffix}` });
  const inScope = (r: AuditCampaign) => r.adAccountId === input.adAccountId &&
    (input.platform === "meta" ? ["meta", "facebook", "instagram"].includes(r.platform) : r.platform === input.platform);
  const seen = new Set<string>();
  const badCurrent = current.campaigns.some(r => {
    const duplicate = seen.has(key(r)); seen.add(key(r));
    return !inScope(r) || duplicate || (r.metricState === "stored_metrics" && !validMetrics(r));
  });
  if (badCurrent) add({ code: "invalid_metrics", severity: "blocker", confidence: "observed", title: "Invalid or out-of-scope metric rows",
    evidence: "Duplicate grains, invalid numeric/currency values or account/platform mismatch detected. Totals and comparisons withheld.",
    nextStep: "Reconcile source rows at account + platform + campaign + currency grain before interpreting performance" });
  if (current.truncated) add({ code: "truncated", severity: "blocker", confidence: "observed", title: "Campaign row limit reached",
    evidence: "Only a subset of the account is loaded. Account performance totals and period comparisons are withheld.",
    nextStep: "Load the complete account dataset before ranking performance or producing an account-wide recommendation" });
  const rows = badCurrent ? [] : measured(current.campaigns);
  if (!rows.length) add({ code: "no_metrics", severity: "blocker", confidence: "observed", title: "No stored metrics for this account/window",
    evidence: "Inventory or a Connected badge is not performance coverage. Missing observations are not measured zero.",
    nextStep: "Resolve the connector/coverage gate and reconcile an approved account/window Sync before performance decisions" });
  if (current.totals.unverifiedCampaigns > 0) add({ code: "inventory_gap", severity: "watch", confidence: "observed", title: "Inventory without window metrics",
    evidence: `${current.totals.unverifiedCampaigns} inventory campaigns have no stored metrics in this window; they may be inactive or outside coverage.`,
    nextStep: "Check expected delivery and coverage; do not declare these campaigns zero-return losers" });
  add({ code: "provider_unverified", severity: "watch", confidence: "observed", title: "Provider completeness is unverified",
    evidence: current.coverage, nextStep: "Review coverage receipts and native↔stored reconciliation; stored metrics alone never unlock activation" });

  let comparable = false;
  if (previous && !current.truncated && !badCurrent && !previous.truncated &&
      previous.window.startDate === comparisonWindow.startDate && previous.window.endDate === comparisonWindow.endDate) {
    const previousSeen = new Set<string>();
    comparable = measured(previous.campaigns).length > 0 && previous.campaigns.every(r => {
      const duplicate = previousSeen.has(key(r)); previousSeen.add(key(r));
      return !duplicate && inScope(r) && (r.metricState !== "stored_metrics" || validMetrics(r));
    });
  }
  if (!comparable) add({ code: "comparison_unavailable", severity: "watch", confidence: "observed", title: "Comparable baseline unavailable",
    evidence: "An adjacent equal-length, untruncated, same-account/currency stored baseline is required. No zero baseline is invented.",
    nextStep: "Review the previous window and conversion maturity/coverage before interpreting change" });
  const priorRows = comparable && previous ? measured(previous.campaigns) : [];
  const priorByKey = new Map(priorRows.map(r => [key(r), r]));
  if (!current.truncated && !badCurrent) for (const r of rows) {
    if (r.totalSpend > 0 && r.totalConversions === 0) add({ code: "no_conversion_spend", severity: "watch", confidence: "provisional",
      title: "Recorded spend without recorded conversions", campaignName: r.campaignName, currency: r.currency,
      evidence: `${r.totalSpend.toFixed(2)} ${r.currency}; 0 attributed conversions in the selected window. Conversion lag/type/tracking may matter.`,
      nextStep: "Inspect conversion definitions, lag, traffic and landing-page evidence; not an automatic pause" }, key(r));
    const p = priorByKey.get(key(r));
    if (input.goal === "sales" && p && r.totalSpend > 0 && p.totalSpend > 0 && r.totalConversions >= 20 && p.totalConversions >= 20) {
      const priorRoas = p.totalConversionValue / p.totalSpend;
      const currentRoas = r.totalConversionValue / r.totalSpend;
      if (priorRoas > 0 && currentRoas / priorRoas <= 0.7) add({ code: "roas_drop", severity: "watch", confidence: "provisional",
        title: "Recorded ROAS drop warrants investigation", campaignName: r.campaignName, currency: r.currency,
        evidence: `${priorRoas.toFixed(2)}x → ${currentRoas.toFixed(2)}x. Heuristic: ≥30% drop and ≥20 attributed conversions in each window; not statistical significance or causal proof.`,
        nextStep: "Check conversion maturity/value, mix, bidding, queries/products and tracking before proposing a change" }, key(r));
    }
  }
  const currencies = [...new Set(rows.map(r => r.currency))].sort();
  const summaries = current.truncated || badCurrent ? [] : currencies.map(currency => {
    const group = rows.filter(r => r.currency === currency);
    const prior = priorRows.filter(r => r.currency === currency);
    return { currency, measuredCampaigns: group.length, ...aggregate(group), previous: prior.length ? aggregate(prior) : null };
  });
  return {
    platform: input.platform, adAccountId: input.adAccountId, goal: input.goal, window: current.window, comparisonWindow,
    coverage: current.coverage, truncated: current.truncated, inventoryTotals: current.totals,
    verdict: findings.some(f => f.severity === "blocker") ? "blocked" as const : "review" as const,
    activationAllowed: false as const,
    businessContext,
    findings, summaries,
    inventory: current.campaigns.filter(inScope).map(r => ({ id: key(r), campaignId: r.campaignId, name: r.campaignName,
      status: r.status, currency: r.currency, objective: r.objective ?? "Unknown", metricState: r.metricState,
      spend: r.metricState === "stored_metrics" && validMetrics(r) ? r.totalSpend : null,
      value: r.metricState === "stored_metrics" && validMetrics(r) ? r.totalConversionValue : null,
      conversions: r.metricState === "stored_metrics" && validMetrics(r) ? r.totalConversions : null,
      roas: r.metricState === "stored_metrics" && validMetrics(r) && r.totalSpend > 0 ? r.totalConversionValue / r.totalSpend : null,
    })),
    calendar: calendar(input.asOf), strategy: strategy(input.goal),
    unavailableEvidence: ["Provider-reconciled completeness and conversion-action definitions", "Search terms, keywords, bidding strategy and change history",
      "PMax product/feed eligibility and product-level outcomes", "Margins, returns, inventory and incremental profit",
      "Comparable year-over-year demand and verified commercial events", "Qualified wholesale lead → paid/repeat-order linkage"],
    decisionPlan: ["Close host/recovery and release gates before production rollout", "Reconcile the exact owned account and current/previous windows",
      "Resolve blockers, validate conversion/business economics and inspect objective-specific evidence",
      "Agree two campaign IDs, budgets/exposure and stop conditions only after the audit",
      "Google/TikTok remain read-only; later scoped action policy, preview, specific confirmation, audit log and provider readback are required"],
  };
}

const mdCell = (v: unknown) => String(v ?? "Unverified").replace(/\r?\n/g, " ").replace(/[\\`*_[\]<>#|]/g, "\\$&");
const n = (value: number | null) => value === null ? "Unverified" : value.toFixed(2);
export function auditMarkdown(audit: PerformanceAudit, context: { brand: string; account: string; providerAccountId: string; market: string }) {
  return ["# Performance Marketing Desk — account audit", "",
    `Brand: ${mdCell(context.brand)} · Account: ${mdCell(context.account)} (${mdCell(context.providerAccountId)})`,
    `Platform: ${audit.platform} · Market: ${mdCell(context.market)} · Objective: ${audit.goal}`,
    `Window (UTC): ${audit.window.startDate} → ${audit.window.endDate}`,
    `Comparison (UTC): ${audit.comparisonWindow.startDate} → ${audit.comparisonWindow.endDate}`,
    `Coverage: ${audit.coverage} · Verdict: ${audit.verdict} · Live activation: locked / read-only`, "",
    "## Business Context (brand-level)", "",
    `Business context source: ${audit.businessContext.source}`,
    "Operator inputs, not verified business economics; shared across accounts and markets, not an account/wholesale-specific profile.",
    "No verified economics or numeric targets are inferred. The selected audit objective remains separate from the saved objective.", "",
    BUSINESS_CONTEXT_CAUTION, "",
    ...(audit.businessContext.context ? projectContextEntries(audit.businessContext.context).map(([label, value]) => `${label}: ${mdCell(value || "Not provided")}`) : [
      audit.businessContext.source === "unavailable" ? "Could not load the exact brand context. No legacy fallback is used." : "No context saved for this brand. No legacy fallback is used.",
    ]), "",
    "## Stored performance by currency", "", "Attributed conversion value is not store revenue, purchase-only proof or incremental profit.", "",
    "| Currency | Spend | Attributed value | Conversions | ROAS | Previous stored ROAS | CPA | CTR (%) |", "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...audit.summaries.map(s => `| ${s.currency} | ${n(s.spend)} | ${n(s.value)} | ${n(s.conversions)} | ${n(s.roas)} | ${n(s.previous?.roas ?? null)} | ${n(s.cpa)} | ${n(s.ctr)} |`),
    ...(audit.summaries.length ? [] : ["No complete usable metric subset. Totals withheld, not measured zero."]), "",
    "## Inventory", "", `Total inventory: ${audit.inventoryTotals.campaigns}; active status: ${audit.inventoryTotals.active} (not serving proof). Truncated: ${audit.truncated}.`, "",
    `Stored metric campaigns: ${audit.inventoryTotals.storedMetricCampaigns}; without window metrics: ${audit.inventoryTotals.unverifiedCampaigns}.`, "",
    "| Campaign | ID | Status | Objective | Currency | Spend | ROAS | Metric state |", "|---|---|---|---|---|---:|---:|---|",
    ...audit.inventory.map(r => `| ${mdCell(r.name)} | ${mdCell(r.campaignId)} | ${mdCell(r.status)} | ${mdCell(r.objective)} | ${mdCell(r.currency)} | ${n(r.spend)} | ${n(r.roas)} | ${mdCell(r.metricState)} |`), "",
    "## Findings and anomalies", "",
    ...audit.findings.flatMap(f => [`### ${mdCell(f.title)}`, "", `${f.severity} · ${f.confidence}${f.campaignName ? ` · ${mdCell(f.campaignName)}` : ""}`,
      "", `Evidence: ${mdCell(f.evidence)}`, "", `Next investigation: ${mdCell(f.nextStep)}`, ""]),
    "## Calendar context", "", `${audit.calendar.asOf}: ${audit.calendar.season}. ${audit.calendar.basis}`, "",
    ...audit.calendar.prompts.map(p => `- ${p}`), "", "## Objective strategy", "", audit.strategy.question, "",
    "Required evidence:", "", ...audit.strategy.requiredEvidence.map(p => `- ${p}`), "", "Next steps:", "",
    ...audit.strategy.nextSteps.map(p => `- ${p}`), "", "## Unavailable evidence", "", ...audit.unavailableEvidence.map(p => `- ${p}`), "",
    "## Decision plan", "", ...audit.decisionPlan.map((p, i) => `${i + 1}. ${p}`), "",
    "Method: account + platform + campaign + currency grain; additive metrics summed, ratios recomputed. Missing/zero denominators are Unverified. No FX blending. ROAS-drop rule is a disclosed watch heuristic, not a causal model or automatic change.", "",
  ].join("\n");
}
