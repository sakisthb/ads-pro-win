import type { PerformanceAudit } from "./performance-audit";
import type { GoogleResearchRecord } from "./trpc/routers/google-research";

export const GOOGLE_RESEARCH_RECORD_TYPE = "google_audit_research_v1";

export type GoogleResearchProposal = {
  id: string; kind: "measurement" | "investigation"; title: string; campaignId?: string;
  reason: string; evidence: string; nextCheck: string; successCriteria: string; risk: string;
  confidence: "observed" | "provisional"; expectedEffect: string; executionAllowed: false;
};

/** Research rules, not an LLM diagnosis, performance forecast or provider action. */
export function googleResearchProposals(audit: PerformanceAudit): GoogleResearchProposal[] {
  if (audit.platform !== "google") throw new Error("Google evidence is required");
  const proposals: GoogleResearchProposal[] = audit.findings.map(f => {
    const campaignId = f.campaignName ? audit.inventory.find(r => `${f.code}:${r.id}` === f.id)?.campaignId : undefined;
    return {
      id: f.id, kind: campaignId ? "investigation" : "measurement", title: f.title, ...(campaignId ? { campaignId } : {}),
      reason: campaignId ? "This stored observation warrants investigation before any restart, pause or budget decision."
        : "This evidence gap prevents a reliable account-wide campaign decision.",
      evidence: f.evidence, nextCheck: f.nextStep,
      successCriteria: campaignId ? "Explain the observation using conversion definitions/maturity, actual delivery and query/product evidence; record remaining unknowns."
        : "Record exact-account/window coverage, source provenance and native↔stored reconciliation; missing evidence remains Unverified.",
      risk: "Conversion lag, tracking, attribution and campaign mix may explain the result. Stored subsets are not complete provider outcomes.",
      confidence: f.confidence, expectedEffect: "Improved decision evidence, not a ROAS or revenue forecast.", executionAllowed: false,
    };
  });
  const needs = audit.kpis.filter(k => k.role === "primary" && k.status !== "stored_subset").map(k => k.label);
  proposals.push({ id: `objective:${audit.goal}`, kind: "measurement", title: `Validate ${audit.goal} measurement and commercial inputs`,
    reason: "The selected business objective must be measured independently of generic attributed conversion totals.",
    evidence: `Unverified primary measurements: ${needs.join(", ") || "objective validation still required"}. Market tagging and saved operator inputs are not outcome proof.`,
    nextCheck: audit.goal === "wholesale" ? "Verify qualified business leads → first paid order → repeat orders, market tagging, follow-up SLA and unit economics."
      : audit.goal === "branding" ? "Verify deduplicated reach/frequency scope, eligible lift evidence and the audience/message/commercial calendar."
      : "Verify purchase actions, deduplication/lag, net sales/costs, new customers, stock and the agreed ROAS vs MER vs contribution target type.",
    successCriteria: "Confirm definitions, denominator, currency/cost basis, owner constraints, review window and stop conditions before a campaign proposal.",
    risk: "Objective selection does not turn Retail data into Wholesale, or attributed value into incremental profit/brand lift.",
    confidence: "observed", expectedEffect: "Improved decision evidence, not a performance forecast.", executionAllowed: false });
  return proposals;
}

const mdText = (value: string) => value.replace(/\r?\n/g, " ").replace(/[\\`*_[\]<>#|]/g, "\\$&");
export function googleResearchReviewMarkdown(record: GoogleResearchRecord) {
  const s = record.snapshot;
  return [s.reportMarkdown, "", "## Saved research & review", "",
    `Snapshot: ${mdText(record.id)} · Created: ${s.createdAt} · Engine: ${s.engine}`,
    `Review: ${s.reviewStatus} · Revision: ${s.revision}`,
    "Research acceptance is not execution approval. Google remains read-only; no provider changes were executed.",
    `Evidence checksum: ${s.contentHash}. Covers frozen scope/report/proposals, not host trust or a cryptographic signature.`, "",
    ...s.proposals.flatMap(p => [`### ${mdText(p.title)}`, `Kind: ${p.kind} · Confidence: ${p.confidence}${p.campaignId ? ` · Campaign: ${mdText(p.campaignId)}` : ""}`,
      `Why: ${mdText(p.reason)}`, `Evidence: ${mdText(p.evidence)}`, `Next check: ${mdText(p.nextCheck)}`,
      `Success criteria: ${mdText(p.successCriteria)}`, `Risk: ${mdText(p.risk)}`, `Expected effect: ${mdText(p.expectedEffect)}`, ""]),
    "### Review history", ...(s.reviews.length ? s.reviews.map(r => `- ${r.at} · ${mdText(r.actorId)} · revision ${r.revision} · ${r.decision} · ${mdText(r.note)}`) : ["No review recorded."]), "",
  ].join("\n");
}
