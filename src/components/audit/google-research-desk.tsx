"use client";

import { useState } from "react";
import { api } from "@/components/providers/trpc-provider";
import { googleResearchReviewMarkdown } from "@/lib/google-audit-research";
import type { GoogleResearchRecord } from "@/lib/trpc/routers/google-research";
import type { AuditComparison, AuditWindow } from "@/lib/audit-periods";
import type { AuditGoal } from "@/lib/performance-audit";
import { auditProviderAccountLabel } from "@/lib/performance-audit";
import type { MarketFilter } from "@/lib/market-desk";

type Props = { brandId: string; adAccountId: string; market: MarketFilter; goal: AuditGoal; window: AuditWindow; comparison: AuditComparison };
const control = "max-w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40";
export function GoogleResearchDesk(props: Props) {
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
  const busy = working || save.isPending || review.isPending;
  const records = (response ? [response, ...(history.data ?? []).filter(r => r.id !== response.id)] : history.data ?? [])
    .filter(r => r.snapshot.scope.brandId === props.brandId && r.snapshot.scope.adAccountId === props.adAccountId && r.snapshot.scope.platform === "google");
  const record = records.find(r => r.id === selectedId);
  const saved = record?.snapshot;
  const sameScope = saved && saved.scope.market === props.market && saved.scope.goal === props.goal &&
    saved.scope.window.startDate === props.window.startDate && saved.scope.window.endDate === props.window.endDate &&
    JSON.stringify(saved.scope.comparison) === JSON.stringify(props.comparison);

  async function generate() {
    setWorking(true); setError(""); setMessage("");
    try {
      const result = await save.mutateAsync({ ...props, acknowledgeResearchOnly: true });
      setResponse(result); setSelectedId(result.id); setAcknowledge(false); setConfirm(false); setNote("");
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
    <p className="text-sm text-amber-200">Google is read-only. Accepting research never approves activation, budget changes or campaign creation. Saving/reviewing requires owner/admin access.</p>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledge} disabled={busy} onChange={e => setAcknowledge(e.target.checked)} />Save research only — no Google Ads changes</label>
    <button className={control} disabled={!acknowledge || busy} onClick={generate}>Generate &amp; save Google research</button>
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
