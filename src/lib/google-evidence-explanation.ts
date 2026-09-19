import type { GoogleResearchRecord } from "./trpc/routers/google-research";
import { auditEvidenceReference } from "./audit-evidence-reference";

type Question = { question: string; proposalId?: string };
type Intent = "why" | "next" | "limitations" | "execution" | "scope" | "unsupported";

function questionIntent(question: string): Intent {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/activate|enable|launch|create.*campaign|budget|pause|ενεργοπο|ανοιξ|φτιαξ|αλλαξ/.test(text)) return "execution";
  if (/why|reason|explain|risk|γιατι|λογο|εξηγ|κινδυν/.test(text)) return "why";
  if (/next|suggest|recommend|επομε|προτειν|προτασ|προτερ/.test(text)) return "next";
  if (/roas|kpi|performance|profit|winter|season|audience|creative|campaign|what.*work|αποδοση|δουλευ|χειμεριν|καμπαν|κοιν|δημιουργ/.test(text)) return "limitations";
  if (/scope|account|period|date|snapshot|λογαριασ|περιοδ|ημερομην/.test(text)) return "scope";
  return "unsupported";
}

/** Deterministic explanations of saved fields. No LLM, tools, fresh metrics or actions. */
export function explainGoogleResearch(record: GoogleResearchRecord, input: Question) {
  const s = record.snapshot;
  const selected = input.proposalId ? s.proposals.find(p => p.id === input.proposalId) : undefined;
  if (input.proposalId && !selected) throw new Error("Proposal not found in this research snapshot");
  const intent = questionIntent(input.question);
  const proposals = selected ? [selected] : s.proposals;
  const lines = [
    "Frozen research explanation — deterministic saved-field reader, not a new campaign-performance study or senior-marketer/LLM diagnosis.",
    "Google remains read-only. Research acceptance never approves execution, spending or campaign creation.",
    `Snapshot: ${record.id} · checksum ${s.contentHash} · review revision ${s.revision} (${s.reviewStatus})`,
    `Saved scope: ${s.scope.brandName} / ${s.scope.accountName} (${s.scope.providerAccountId}) · ${s.scope.market}/${s.scope.goal}`,
    `Current evidence window: ${s.scope.window.startDate} → ${s.scope.window.endDate} UTC`,
    `Baseline evidence window: ${s.scope.baselineWindow.startDate} → ${s.scope.baselineWindow.endDate} UTC`,
    `Saved verdict: ${s.verdict}. Created ${s.createdAt}; not a fresh provider/account-health check.`, "",
  ];
  if (intent === "unsupported") lines.push("This question is not answered by this frozen research packet. Ask why a saved proposal exists, its risks, next checks or saved scope; no answer is invented.");
  else if (intent === "execution") lines.push("No campaign change was made or approved. This mode cannot activate campaigns, change budgets, build audiences or create campaigns. A later scoped action policy and specific preview/confirmation/readback are separate requirements.");
  else if (intent === "limitations") lines.push("A question alone does not create new performance evidence, forecasts, seasonal research or campaign recommendations. Inspect the frozen report below. Missing historical/query/product/economics/purchase evidence remains Unverified; generic conversions are not purchases and attributed ROAS is not incremental profit.");
  if (intent === "why" || intent === "next" || intent === "execution" || intent === "limitations") {
    lines.push("", "Saved research proposals (not new campaign instructions):");
    if (!proposals.length) lines.push("No research proposals were saved. No replacement proposals are invented.");
    for (const p of proposals) lines.push("", `${p.title} [proposal:${p.id}]${p.campaignId ? ` · campaign:${p.campaignId}` : ""}`,
      `Kind / confidence: ${p.kind} / ${p.confidence}`, `Why: ${p.reason}`, `Evidence: ${p.evidence}`,
      `Next check: ${p.nextCheck}`, `Success criteria: ${p.successCriteria}`, `Risk: ${p.risk}`, `Expected effect: ${p.expectedEffect}`);
  }
  return { reference: auditEvidenceReference(record), question: input.question, proposalId: input.proposalId ?? null,
    intent, answer: lines.join("\n"), engine: "frozen_fields_v1" as const, executionAllowed: false as const };
}
export type GoogleEvidenceExplanation = ReturnType<typeof explainGoogleResearch>;

/** CSV is research fields only. Neutralize formulas without modifying frozen source values. */
export function googleResearchProposalCsv(record: GoogleResearchRecord): string {
  const s = record.snapshot;
  const cell = (value: string | number | boolean) => {
    let text = String(value);
    if (/^[\s]*[=+@-]|^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: (string | number | boolean)[][] = [
    ["Export type", "research proposals, not a performance dataset"],
    ["Snapshot", record.id], ["Checksum", s.contentHash], ["Review revision", s.revision], ["Review status", s.reviewStatus],
    ["Brand ID", s.scope.brandId], ["Ad account ID", s.scope.adAccountId], ["Google customer ID", s.scope.providerAccountId],
    ["Market", s.scope.market], ["Objective", s.scope.goal], ["Created at", s.createdAt],
    ["Current start (UTC)", s.scope.window.startDate], ["Current end (UTC)", s.scope.window.endDate],
    ["Baseline start (UTC)", s.scope.baselineWindow.startDate], ["Baseline end (UTC)", s.scope.baselineWindow.endDate],
    ["Execution allowed", false], ["Limitations", "Frozen stored research only; no provider reconciliation, fresh campaign study or action approval"], [],
    ["Proposal ID", "Campaign ID", "Kind", "Confidence", "Title", "Why", "Evidence", "Next check", "Success criteria", "Risk", "Expected effect", "Execution allowed"],
    ...s.proposals.map(p => [p.id, p.campaignId ?? "", p.kind, p.confidence, p.title, p.reason, p.evidence, p.nextCheck, p.successCriteria, p.risk, p.expectedEffect, false]),
  ];
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}
