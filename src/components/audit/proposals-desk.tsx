'use client';

import { useState } from 'react';
import { api } from '@/components/providers/trpc-provider';
import { buildProposals, type CampaignProposal } from '@/lib/proposals';
import type { ProposalDecisionRecord } from '@/lib/proposals-store';

const chip = 'inline-block rounded-md px-2 py-0.5 text-xs';
const section = 'space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5';
const button = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-400';
const DESK_LABEL: Record<CampaignProposal['desk'], string> = { retail: 'Retail · ΛΙΑΝΙΚΗ', branding: 'Branding / demand', wholesale: 'Wholesale · χονδρική' };
const KIND_LABEL: Record<CampaignProposal['kind'], string> = {
  meta_spend_review: 'Meta spend review', tracking_check: 'Tracking check',
  google_planning_note: 'Google planning note', order_ops_review: 'Order follow-up',
};

// Brand scope changes remount the desk so a previous brand's proposals and decisions never stay rendered.
export function ProposalsDesk({ brandId }: { brandId: string }) {
  return <Desk key={brandId} brandId={brandId} />;
}

function Desk({ brandId }: { brandId: string }) {
  const study = api.campaignStudy.get.useQuery({ brandId }, { enabled: Boolean(brandId), retry: false });
  const decisions = api.proposals.decisions.useQuery({ brandId }, { enabled: Boolean(brandId), retry: false });
  const orgs = api.organizations.list.useQuery();
  if (study.error) return <section aria-label="Proposals" className={section}>
    <h2 className="text-lg font-semibold">Proposals</h2>
    <p role="alert">Proposals unavailable. Study-derived proposals are withheld until the stored campaign study reloads; no fallback suggestions are shown.</p>
  </section>;
  if (study.isLoading || !study.data) return <section aria-label="Proposals" className={section}>
    <h2 className="text-lg font-semibold">Proposals</h2>
    <p role="status">Loading study-derived proposals…</p>
  </section>;
  const role = orgs.data?.find(o => o.isActive)?.role;
  const canDecide = role === 'owner' || role === 'admin';
  const proposals = buildProposals(study.data);
  const byKey = new Map((decisions.data ?? []).map(record => [record.decision.proposalKey, record]));
  return <section aria-label="Proposals" className={section}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Proposals</h2>
      <span className="rounded-md bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Derived from the stored campaign study · as of {study.data.asOf} · a decision never executes a provider write</span>
    </div>
    <p className="text-sm text-zinc-300">Each proposal is recomputed from the stored-rows study. Approving records an operator decision only —
      Meta writes stay behind the audited write desk (ADR 0002) and Google stays read-only (ADR 0003).</p>
    {decisions.error ? <p role="alert">Saved decisions unavailable. Decision state is withheld; the proposals themselves stay visible.</p> : null}
    {proposals.length === 0 ? <p className="text-sm text-zinc-400">No proposals derived from the current study — every diagnostic is stable or has insufficient stored data.</p> : null}
    {proposals.map(proposal => <ProposalCard key={proposal.key} proposal={proposal} record={byKey.get(proposal.key) ?? null} canDecide={canDecide} brandId={brandId} />)}
  </section>;
}

function ProposalCard({ proposal, record, canDecide, brandId }: {
  proposal: CampaignProposal; record: ProposalDecisionRecord | null; canDecide: boolean; brandId: string;
}) {
  const [note, setNote] = useState('');
  const utils = api.useUtils();
  const decide = api.proposals.decide.useMutation({
    onSuccess: async () => { await utils.proposals.decisions.invalidate({ brandId }); },
  });
  const decision = record?.decision ?? null;
  return <article aria-label={`Proposal ${proposal.title}`} className="space-y-3 rounded-xl border border-white/15 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <h3 className="font-medium">{proposal.title}</h3>
      <span className={`${chip} bg-zinc-400/10 text-zinc-300`}>{DESK_LABEL[proposal.desk]}</span>
      <span className={`${chip} bg-zinc-400/10 text-zinc-300`}>{KIND_LABEL[proposal.kind]}</span>
      {decision
        ? <span className={`${chip} ${decision.decision === 'approved' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{decision.decision === 'approved' ? 'Approved' : 'Rejected'}</span>
        : <span className={`${chip} bg-amber-400/10 text-amber-200`}>Pending decision</span>}
    </div>
    <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">{proposal.rationale.map((part, i) => <li key={i}>{part}</li>)}</ul>
    <p className="text-sm text-zinc-300"><span className="font-medium">Execution: </span>{proposal.execution}</p>
    <details>
      <summary className="cursor-pointer text-xs text-zinc-400">Uncertainty (study limits) · evidence as of {proposal.evidenceAsOf}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/90">{proposal.uncertainty.map((limit, i) => <li key={i}>{limit}</li>)}</ul>
    </details>
    {decision
      ? <p className="text-xs text-zinc-400">Decided {decision.decision} on {decision.decidedAt.slice(0, 10)} by {decision.decidedBy}{decision.note ? ` — ${decision.note}` : ''}</p>
      : canDecide
        ? <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Decision note" value={note} onChange={e => setNote(e.target.value)} placeholder="Decision note (optional)"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="button" className={button} disabled={decide.isPending}
              onClick={() => decide.mutate({ brandId, proposalKey: proposal.key, decision: 'approved', note: note || null })}>Approve</button>
            <button type="button" className={button} disabled={decide.isPending}
              onClick={() => decide.mutate({ brandId, proposalKey: proposal.key, decision: 'rejected', note: note || null })}>Reject</button>
          </div>
        : <p className="text-xs text-zinc-400">Awaiting an organization admin decision.</p>}
    {decide.error ? <p role="alert">Decision failed: {decide.error.message}</p> : null}
  </article>;
}
