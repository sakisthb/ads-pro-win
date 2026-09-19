import { GOOGLE_ADAPTATION_REFERENCES, type GoogleCampaignAdaptation } from '@/lib/google-campaign-adaptation';

export function GoogleCampaignAdaptationReview({ review }: { review: GoogleCampaignAdaptation }) {
  return <section aria-label="Campaign adaptation review" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <h2 className="text-lg font-semibold">Campaign adaptation review</h2>
    <p className="text-sm text-amber-200">{review.caution}</p>
    <p className="text-xs text-zinc-400">{review.ordering} Omitted research candidates: {review.omittedCount}.</p>
    {review.candidates.length ? <div className="grid gap-4 lg:grid-cols-2">{review.candidates.map(c => <article key={c.id} className="min-w-0 space-y-3 rounded-xl border border-white/10 p-4">
      <h3 className="break-words font-medium">{c.name} · {c.campaignId} · {c.currency}</h3>
      <p className="text-xs text-zinc-400">Current inventory status: {c.currentStatus} · {c.assessment}. Status is not serving proof.</p>
      <div className="space-y-2 text-sm"><h4 className="font-medium">Before</h4>
        <p className="text-xs text-zinc-400">Selected stored aggregate windows; actual active days Unverified.</p>
        <ul className="list-disc space-y-2 pl-5">{c.periods.map(p => <li key={p.source}>
          {p.source}: {p.window.startDate} → {p.window.endDate} · {p.spend.toFixed(2)} {c.currency} spend · {p.value.toFixed(2)} attributed value · {p.conversions.toFixed(2)} credits · {p.roas === null ? 'Unverified ROAS' : `${p.roas.toFixed(2)}x ROAS`}
        </li>)}</ul>
      </div>
      <dl className="space-y-3 text-sm">{[['Proposed adaptation', c.proposedAdaptation], ['Why', c.why], ['Risk', c.risk]].map(([label, text]) => <div key={label}>
        <dt className="font-medium">{label}</dt><dd className="mt-1 text-zinc-300">{text}</dd>
      </div>)}</dl>
    </article>)}</div> : <p className="text-sm">No validated stored study candidates in the selected windows. This is not proof that the account has no historical winners.</p>}
    <h3 className="font-medium">Required checks — not fetched or verified by this review</h3>
    <ul className="space-y-3 text-sm">{review.checks.map(c => <li key={c.id}>
      <p className="font-medium">{c.label} · Unverified</p><p className="mt-1 text-zinc-400">{c.requiredEvidence}</p>
    </li>)}</ul>
    <p className="text-xs text-zinc-400">Official feature references, not proof of account eligibility, API availability or implementation parity.</p>
    <div className="flex flex-wrap gap-3 text-xs">{GOOGLE_ADAPTATION_REFERENCES.map(s => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">{s.label}</a>)}</div>
  </section>;
}
