"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/providers/trpc-provider";
import { auditEvidenceUrl, matchesAuditEvidenceReference, parseAuditEvidenceSearch, type AuditEvidenceReference } from "@/lib/audit-evidence-reference";
import { googleResearchReviewMarkdown } from "@/lib/google-audit-research";
import { googleResearchProposalCsv, type GoogleEvidenceExplanation } from "@/lib/google-evidence-explanation";
import { downloadBlob } from "@/lib/export/csv-generator";

type Mode = "chat" | "report";
const control = "max-w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40";

function EvidenceGate({ message, brandId }: { message: string; brandId?: string }) {
  return <section className="space-y-4 p-6"><h1 className="text-2xl font-semibold">Scoped Google Audit — evidence withheld</h1>
    <p role="alert">{message}</p><p>No workspace fallback, metric reads, provider changes or invented account verdict.</p>
    <Link href={brandId ? `/account-audit?brand=${encodeURIComponent(brandId)}` : "/account-audit"}>Return to Performance Marketing Desk</Link></section>;
}

/** Only mount legacy consumers when no scoped reference was requested. */
export function AuditEvidenceRoute({ mode, fallback }: { mode: Mode; fallback: ReactNode }) {
  const params = useSearchParams();
  const parsed = parseAuditEvidenceSearch(params ?? new URLSearchParams());
  if (parsed.mode === "workspace") return <>
    <p className="border-b border-amber-400/20 bg-amber-400/5 px-4 py-2 text-xs text-amber-200">Workspace mode — not a scoped Google audit. Open a saved snapshot from the Performance Marketing Desk for matched Chat / Report evidence.</p>
    {fallback}</>;
  if (parsed.mode === "invalid") return <EvidenceGate message="Invalid scoped audit reference. Select a saved snapshot from the Desk; no workspace fallback is allowed." />;
  return <ScopedAuditEvidence key={`${mode}:${JSON.stringify(parsed.reference)}`} mode={mode} reference={parsed.reference} />;
}

function ScopedAuditEvidence({ mode, reference }: { mode: Mode; reference: AuditEvidenceReference }) {
  const query = api.googleResearch.get.useQuery(reference, { retry: false, staleTime: 0, refetchOnWindowFocus: true });
  const utils = api.useUtils();
  const [question, setQuestion] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [reply, setReply] = useState<GoogleEvidenceExplanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const record = query.data;

  async function ask(value: string) {
    const requestedQuestion = value.trim();
    if (busy || requestedQuestion.length < 3 || requestedQuestion.length > 2000) return;
    setBusy(true); setReply(null); setError(""); setMessage(""); setQuestion(requestedQuestion);
    try {
      const result = await utils.googleResearch.explain.fetch({ ...reference, question: requestedQuestion, proposalId: proposalId || undefined }, { staleTime: 0 });
      const r = result.reference;
      if (r.id !== reference.id || r.brandId !== reference.brandId || r.adAccountId !== reference.adAccountId ||
        r.contentHash !== reference.contentHash || r.revision !== reference.revision || result.question !== requestedQuestion ||
        result.proposalId !== (proposalId || null) || result.executionAllowed !== false)
        throw new Error("Explanation reference mismatch; evidence withheld. Return to the Desk and reload the saved snapshot.");
      setReply(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Explanation unavailable; no replacement answer is invented."); }
    finally { setBusy(false); }
  }
  async function download(format: "md" | "csv") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      // Revalidate immediately before export. Cached success cannot certify a changed review.
      const fresh = await query.refetch();
      if (fresh.error) throw fresh.error;
      if (!fresh.data || !matchesAuditEvidenceReference(fresh.data, reference)) throw new Error("Evidence reference mismatch; download withheld.");
      const value = format === "md" ? googleResearchReviewMarkdown(fresh.data) : googleResearchProposalCsv(fresh.data);
      downloadBlob(new Blob([value], { type: format === "md" ? "text/markdown;charset=utf-8" : "text/csv;charset=utf-8" }),
        `google-research-${reference.id}-review-${reference.revision}${format === "csv" ? "-proposals" : ""}.${format}`);
      setMessage("Frozen evidence download requested. No provider history was fetched or campaign action executed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Export unavailable; evidence withheld."); }
    finally { setBusy(false); }
  }

  if (query.error) return <EvidenceGate message={query.error.message} brandId={reference.brandId} />;
  if (query.isLoading || query.isFetching) return <p role="status" className="p-6">Validating owned frozen evidence…</p>;
  if (!record || !matchesAuditEvidenceReference(record, reference))
    return <EvidenceGate message="Evidence reference mismatch; saved data and actions are withheld." brandId={reference.brandId} />;
  const s = record.snapshot;

  return <section aria-label="Scoped audit evidence" className="mx-auto min-h-screen max-w-6xl space-y-5 p-4 text-zinc-100 sm:p-8">
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold">Scoped Google Audit {mode === "chat" ? "Chat" : "Report"}</h1>
      <p className="text-sm text-amber-200">Frozen stored research only, not a complete senior-marketer/LLM diagnosis or fresh campaign-performance study. Google is read-only. Review acceptance does not authorize execution.</p>
      <p className="text-sm">{s.scope.brandName} · {s.scope.accountName} ({s.scope.providerAccountId}) · {s.scope.market}/{s.scope.goal}</p>
      <p className="text-sm">Saved current: {s.scope.window.startDate} → {s.scope.window.endDate} UTC · Saved baseline: {s.scope.baselineWindow.startDate} → {s.scope.baselineWindow.endDate} UTC</p>
      <p className="break-all text-xs text-zinc-400">Snapshot {record.id} · checksum {s.contentHash} · review revision {s.revision} · {s.reviewStatus} · created {s.createdAt}</p>
      <p className="text-xs text-zinc-400">These are saved snapshot dates/objective, not current Desk controls. Checksum is integrity metadata, not a signature or host-trust proof. No provider/metric refresh or transcript persistence is performed.</p>
      <nav className="flex flex-wrap gap-3 text-sm text-sky-200">
        <Link href={`/account-audit?brand=${encodeURIComponent(reference.brandId)}`}>Return to Performance Marketing Desk</Link>
        <Link href={auditEvidenceUrl(mode === "chat" ? "/reports" : "/chat", reference)}>{mode === "chat" ? "Open matching Scoped Report" : "Discuss in matching Scoped Chat"}</Link>
      </nav>
    </header>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {message && <p role="status" className="text-sky-200">{message}</p>}
    {mode === "chat" ? <section className="space-y-3 rounded-xl border border-white/15 p-4">
      <h2 className="text-lg font-semibold">Discuss saved research</h2>
      <p className="text-sm text-zinc-400">Deterministic explanations of saved Why / Evidence / Risk / Next check fields. Outside-packet questions stay unanswered; no new campaigns, budgets, targets or outcomes are inferred.</p>
      <label className="grid gap-1 text-sm">Proposal to discuss<select aria-label="Proposal to discuss" className={control} value={proposalId} disabled={busy} onChange={e => { setProposalId(e.target.value); setReply(null); }}>
        <option value="">All saved proposals</option>{s.proposals.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">Question about saved research<textarea aria-label="Question about saved research" className={control} value={question} disabled={busy} maxLength={2000} rows={3} onChange={e => setQuestion(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button className={control} disabled={busy || question.trim().length < 3} onClick={() => void ask(question)}>Explain from saved evidence</button>
        <button className={control} disabled={busy} onClick={() => void ask("Why these proposals?")}>Why these proposals?</button>
        <button className={control} disabled={busy} onClick={() => void ask("What is next?")}>What is next?</button>
      </div>
      {busy && <p role="status">Reading owned frozen research…</p>}
      {reply && <section aria-label="Scoped explanation" className="space-y-2 border-t border-white/10 pt-4">
        <p className="text-sm">Answered question: {reply.question}</p><p className="text-xs text-zinc-400">{reply.engine} · intent {reply.intent} · no execution allowed</p>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm">{reply.answer}</pre>
      </section>}
    </section> : <div className="flex flex-wrap gap-3">
      <button className={control} disabled={busy} onClick={() => void download("md")}>Download frozen report (.md)</button>
      <button className={control} disabled={busy} onClick={() => void download("csv")}>Download research proposals (.csv)</button>
      <p className="w-full text-xs text-zinc-400">Markdown contains the entire frozen evidence/inventory and reviews. CSV contains all research proposals, not a performance dataset. Existing workspace CSV/PDF is a separate mode.</p>
    </div>}
    <section aria-label="Saved research proposals" className="space-y-3">
      <h2 className="text-lg font-semibold">All {s.proposals.length} saved research proposals</h2>
      <div className="max-h-[32rem] space-y-3 overflow-auto">
        {s.proposals.map(p => <article key={p.id} className="space-y-2 rounded-xl border border-white/10 p-4">
          <h3 className="font-semibold">{p.title}</h3><p className="text-xs text-zinc-400">proposal:{p.id} · {p.kind}/{p.confidence}{p.campaignId ? ` · campaign:${p.campaignId}` : ""}</p>
          <dl className="space-y-2 text-sm">{[["Why", p.reason], ["Evidence", p.evidence], ["Next check", p.nextCheck], ["Success criteria", p.successCriteria], ["Risk", p.risk], ["Expected effect", p.expectedEffect]].map(([label, value]) =>
            <div key={label}><dt className="text-zinc-400">{label}</dt><dd>{value}</dd></div>)}</dl>
        </article>)}
      </div>
    </section>
    <section aria-label="Frozen evidence report" className="space-y-3">
      <h2 className="text-lg font-semibold">Frozen evidence report</h2>
      <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 p-4 text-xs text-zinc-300">{s.reportMarkdown}</pre>
    </section>
    <section aria-label="Frozen review history" className="space-y-2 text-sm"><h2 className="text-lg font-semibold">Review history</h2>
      {s.reviews.length ? <ul>{s.reviews.map(r => <li key={r.revision}>{r.at} · revision {r.revision} · {r.decision} · {r.note}</li>)}</ul> : <p>No review recorded.</p>}
    </section>
    <button className={control} disabled>Execute Google changes</button>
  </section>;
}
