"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/components/providers/trpc-provider";
import { googleResearchReviewMarkdown } from "@/lib/google-audit-research";
import type { GoogleResearchRecord } from "@/lib/trpc/routers/google-research";
import type { AuditComparison, AuditWindow } from "@/lib/audit-periods";
import type { AuditGoal } from "@/lib/performance-audit";
import { auditProviderAccountLabel } from "@/lib/performance-audit";
import type { MarketFilter } from "@/lib/market-desk";
import { auditEvidenceReference, auditEvidenceUrl } from "@/lib/audit-evidence-reference";

type Props = { brandId: string; adAccountId: string; providerAccountId?: string; market: MarketFilter; goal: AuditGoal; window: AuditWindow; comparison: AuditComparison };
const control = "max-w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40";
export function GoogleResearchDesk(props: Props) {
  return <ResearchDesk key={JSON.stringify(props)} {...props} />;
}
function ResearchDesk(props: Props) {
  const history = api.googleResearch.history.useQuery({ brandId: props.brandId, adAccountId: props.adAccountId });
  const save = api.googleResearch.save.useMutation();
  const review = api.googleResearch.review.useMutation();
  const [acknowledge, setAcknowledge] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [response, setResponse] = useState<GoogleResearchRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [studyMarkdown, setStudyMarkdown] = useState('');
  const [studyTitle, setStudyTitle] = useState('Account study and strategy');
  const [studyObservedAt, setStudyObservedAt] = useState(() => new Date().toISOString());
  const [studySources, setStudySources] = useState('');
  const [studyAcknowledged, setStudyAcknowledged] = useState(false);
  const customer = auditProviderAccountLabel('google', props.providerAccountId ?? '');
  const hasStudy = studyMarkdown.length > 0;
  const studyReady = !hasStudy || (studyMarkdown.trim().length > 0 && studyTitle.trim().length >= 3 && studyObservedAt.length > 0 && studyAcknowledged && /^\d{6,}$/.test(customer));
  const busy = working || save.isPending || review.isPending;
  const records = (response ? [response, ...(history.data ?? []).filter(r => r.id !== response.id)] : history.data ?? [])
    .filter(r => r.snapshot.scope.brandId === props.brandId && r.snapshot.scope.adAccountId === props.adAccountId && r.snapshot.scope.platform === "google");
  const record = records.find(r => r.id === selectedId);
  const saved = record?.snapshot;
  const sameScope = saved && saved.scope.market === props.market && saved.scope.goal === props.goal &&
    saved.scope.window.startDate === props.window.startDate && saved.scope.window.endDate === props.window.endDate &&
    JSON.stringify(saved.scope.comparison) === JSON.stringify(props.comparison);

  async function loadStudyFile(file: File | undefined) {
    if (!file || busy) return;
    setError(''); setMessage(''); setStudyAcknowledged(false);
    if (!/\.md$/i.test(file.name) || file.size > 1000000) { setError('Choose a Markdown (.md) file of at most 1 MB.'); return; }
    setWorking(true);
    try {
      const text = await file.text();
      if (!text.trim() || text.length > 250000) throw new Error('Study must contain 1–250,000 characters.');
      setStudyMarkdown(text);
      setMessage('Markdown loaded into the draft editor. Confirm its account, sources and observation time before saving.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the Markdown study.'); }
    finally { setWorking(false); }
  }

  async function generate() {
    if (!acknowledge || busy || !studyReady) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const { providerAccountId: _providerAccountId, ...scope } = props;
      const result = await save.mutateAsync({ ...scope, acknowledgeResearchOnly: true,
        ...(hasStudy ? { operatorStudy: { customerId: customer, title: studyTitle.trim(), observedAt: studyObservedAt,
          markdown: studyMarkdown, sourceUrls: studySources.split(/\r?\n/).map(url => url.trim()).filter(Boolean), confirmOperatorSource: true as const } } : {}) });
      setResponse(result); setSelectedId(result.id); setAcknowledge(false); setConfirm(false); setNote("");
      setStudyMarkdown(''); setStudySources(''); setStudyAcknowledged(false);
      setMessage("Research snapshot saved from server-owned stored-data reads. No provider changes executed.");
      await history.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save research snapshot"); }
    finally { setWorking(false); }
  }
  async function decide(decision: "accepted_research" | "changes_requested" | "rejected") {
    if (!record) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const result = await review.mutateAsync({ brandId: props.brandId, adAccountId: props.adAccountId, id: record.id,
        revision: record.snapshot.revision, decision, note: note.trim(), confirmResearchOnly: true });
      setResponse(result); setConfirm(false); setNote("");
      setMessage(decision === "changes_requested" ? "Change request recorded. Revise the inputs and generate a new snapshot; the frozen evidence is unchanged."
        : "Research review recorded. This is not execution approval; no provider changes executed.");
      await history.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record review; reload history before retrying"); }
    finally { setWorking(false); }
  }
  function download() {
    if (!record) return;
    try {
      const url = URL.createObjectURL(new Blob([googleResearchReviewMarkdown(record)], { type: "text/markdown;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `google-research-${record.id}-review-${record.snapshot.revision}.md`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Saved research download requested for this snapshot and review revision.");
    } catch { setError("Could not prepare saved research download"); }
  }
  return <section aria-label="Google research & review" className="space-y-4 rounded-2xl border border-blue-400/20 bg-white/[0.025] p-5">
    <h2 className="text-lg font-semibold">Google research & review</h2>
    <p className="text-sm text-zinc-400">Evidence → reasoned research proposals → your review. Stored rule-based research, not a complete senior-marketer/LLM diagnosis. Missing history, queries/products, economics and tracking remain Unverified.</p>
    <p className="text-sm text-amber-200">This research workflow is read-only. Accepting research never approves activation, budget changes or campaign creation. Specific existing-target corrections use the separate Google Repair Desk with exact preview confirmation. Saving/reviewing requires owner/admin access.</p>
    <details className='space-y-3 rounded-xl border border-white/10 p-3' open={hasStudy}>
      <summary className='cursor-pointer text-sm'>Retain an operator study / web research (optional)</summary>
      <p className='text-xs text-zinc-400'>Load or paste the complete Markdown study. It is retained verbatim in this owned account&apos;s frozen report with sources/time and the same checksum used by Scoped Chat/Reports. It does not replace Google metrics, prove coverage or authorize ads. New snapshots preserve past studies; source text is not execution instructions.</p>
      <label className='grid gap-1 text-sm'>Load study Markdown file<input aria-label='Load study Markdown file' type='file' accept='.md,text/markdown' className={control} disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void loadStudyFile(file); }} /></label>
      <label className='grid gap-1 text-sm'>Study title<input aria-label='Study title' className={control} value={studyTitle} maxLength={200} disabled={busy} onChange={e => { setStudyTitle(e.target.value); setStudyAcknowledged(false); }} /></label>
      <label className='grid gap-1 text-sm'>Study observed at (ISO UTC)<input aria-label='Study observed at (ISO UTC)' className={control} value={studyObservedAt} disabled={busy} onChange={e => { setStudyObservedAt(e.target.value); setStudyAcknowledged(false); }} /></label>
      <label className='grid gap-1 text-sm'>Study source URLs (one HTTPS URL per line)<textarea aria-label='Study source URLs (one HTTPS URL per line)' className={control} rows={3} value={studySources} disabled={busy} onChange={e => { setStudySources(e.target.value); setStudyAcknowledged(false); }} /></label>
      <label className='grid gap-1 text-sm'>Operator study Markdown<textarea aria-label='Operator study Markdown' className={control} rows={8} maxLength={250000} value={studyMarkdown} disabled={busy} onChange={e => { setStudyMarkdown(e.target.value); setStudyAcknowledged(false); }} /></label>
      <p className='text-xs text-zinc-500'>{studyMarkdown.length.toLocaleString()} / 250,000 characters · declared Google customer {/^\d{6,}$/.test(customer) ? customer : 'Unverified'}. Saving requires an exact account pin and owner/admin authorization.</p>
      <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={studyAcknowledged} disabled={busy || !hasStudy || !/^\d{6,}$/.test(customer)} onChange={e => setStudyAcknowledged(e.target.checked)} />Include this operator study as research, not verified metrics or Ads approval</label>
    </details>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledge} disabled={busy} onChange={e => setAcknowledge(e.target.checked)} />Save research only — no Google Ads changes</label>
    <button className={control} disabled={!acknowledge || busy || !studyReady} onClick={generate}>Generate &amp; save Google research</button>
    {history.isLoading && <p role="status">Loading saved Google research…</p>}
    {history.error && <p role="alert">Saved research history unavailable. No empty-success history is claimed.</p>}
    <label className="grid gap-1 text-sm">Saved Google research
      <select aria-label="Saved Google research" className={control} value={selectedId} disabled={busy} onChange={e => {
        setSelectedId(e.target.value); setConfirm(false); setNote(""); setMessage(""); setError("");
      }}>
        <option value="">Select a saved snapshot</option>
        {records.map(r => <option key={r.id} value={r.id}>{r.snapshot.createdAt} · {r.snapshot.scope.market}/{r.snapshot.scope.goal} · {r.snapshot.scope.window.startDate} → {r.snapshot.scope.window.endDate} · {r.snapshot.reviewStatus}</option>)}
      </select>
    </label>
    <p className="text-xs text-zinc-500">Latest 25 snapshots for this owned Google account. Selecting an old snapshot preserves its original evidence/scope; it does not refresh provider data.</p>
    <button className={control} disabled={busy || history.isFetching} onClick={() => { setResponse(null); setMessage(""); setError(""); void history.refetch(); }}>Reload research history</button>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {message && <p role="status" className="text-blue-200">{message}</p>}
    {record && saved && <>
      {!sameScope && <p className="text-sm text-amber-200">Saved scope differs from current controls. You are reviewing the historical saved scope below, not the currently displayed audit.</p>}
      <p className="text-sm">{saved.scope.brandName} · {saved.scope.accountName} ({auditProviderAccountLabel("google", saved.scope.providerAccountId)}) · {saved.scope.market}/{saved.scope.goal} · {saved.scope.window.startDate} → {saved.scope.window.endDate} UTC</p>
      <p className="text-sm">Baseline: {saved.scope.baselineWindow.startDate} → {saved.scope.baselineWindow.endDate} UTC · Verdict: {saved.verdict} · Review: {saved.reviewStatus} · Revision: {saved.revision}</p>
      <div className="flex flex-wrap gap-2">
        <Link className={control} href={auditEvidenceUrl("/chat", auditEvidenceReference(record))}>Discuss saved audit in Scoped Chat</Link>
        <Link className={control} href={auditEvidenceUrl("/reports", auditEvidenceReference(record))}>Open Scoped Report</Link>
      </div>
      <p className="text-xs text-zinc-500">Both pages use this frozen snapshot, checksum and review revision, not current controls or organization-wide metrics. They do not refresh provider data.</p>
      <p className="text-xs text-zinc-500">Created {saved.createdAt} by {saved.createdBy} · {saved.engine} · frozen evidence checksum {saved.contentHash}. Checksum is not host-trust proof or a cryptographic signature. Revalidate freshness before decisions.</p>
      <p className="text-sm">Showing {Math.min(10, saved.proposals.length)} of {saved.proposals.length} research proposals; the download contains all proposals and frozen inventory.</p>
      {saved.proposals.slice(0, 10).map(p => <article key={p.id} className="space-y-2 rounded-xl border border-white/10 p-4">
        <h3 className="font-medium">{p.title}</h3>
        <p className="text-xs text-zinc-400">{p.kind} · {p.confidence}{p.campaignId ? ` · Campaign ${p.campaignId}` : ""} · No execution allowed</p>
        <dl className="grid gap-2 text-sm">{[["Why", p.reason], ["Evidence", p.evidence], ["Next check", p.nextCheck], ["Success criteria", p.successCriteria], ["Risk", p.risk], ["Expected effect", p.expectedEffect]].map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd>{value}</dd></div>)}</dl>
      </article>)}
      <details><summary className="cursor-pointer text-sm">Frozen evidence report</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zinc-400">{saved.reportMarkdown}</pre></details>
      <label className="grid gap-1 text-sm">Review note / requested changes<textarea aria-label="Review note / requested changes" className={control} maxLength={2000} rows={3} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirm} disabled={busy} onChange={e => setConfirm(e.target.checked)} />This review does not authorize Google execution or spending</label>
      <div className="flex flex-wrap gap-2">
        <button className={control} disabled={!confirm || busy} onClick={() => decide("accepted_research")}>Accept research plan</button>
        <button className={control} disabled={!confirm || busy || note.trim().length < 3} onClick={() => decide("changes_requested")}>Request revised research</button>
        <button className={control} disabled={!confirm || busy} onClick={() => decide("rejected")}>Reject research plan</button>
        <button className={control} disabled={busy} onClick={download}>Download saved research (.md)</button>
      </div>
      <h3 className="text-sm font-medium">Review history</h3>
      {saved.reviews.length ? <ul className="space-y-2 text-xs text-zinc-400">{saved.reviews.map(r => <li key={r.revision}>{r.at} · {r.actorId} · revision {r.revision} · {r.decision} · {r.note}</li>)}</ul> : <p className="text-sm text-zinc-500">No review recorded.</p>}
    </>}
    <button className={control} disabled>Execute Google changes</button>
  </section>;
}
