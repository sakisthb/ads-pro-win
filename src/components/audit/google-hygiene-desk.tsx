'use client';

import { useState } from 'react';
import { api } from '@/components/providers/trpc-provider';
import type { GoogleHygieneAudit, GoogleHygieneDisposition } from '@/lib/google-hygiene';

type Props = { brandId: string; adAccountId: string };
const control = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-40 focus:ring-2 focus:ring-blue-400';
const labels: Record<GoogleHygieneDisposition, string> = {
  detected: 'Detected', repairable_in_adpd: 'Repairable in ADPD', manual_google_action: 'Manual Google action', monitoring: 'Monitoring',
};

export function GoogleHygieneDesk(props: Props) {
  return <HygieneDesk key={`${props.brandId}:${props.adAccountId}`} {...props} />;
}

function HygieneDesk(scope: Props) {
  const query = api.googleHygiene.scan.useQuery(scope, { enabled: false, retry: false });
  const [audit, setAudit] = useState<GoogleHygieneAudit | null>(null);
  const [error, setError] = useState('');
  async function run() {
    setAudit(null); setError('');
    const result = await query.refetch();
    if (result.error || !result.data) {
      setError('Native Google hygiene scan unavailable. No empty-success audit was produced and no Google Ads write was attempted.');
      return;
    }
    setAudit(result.data);
  }
  const failed = Boolean(query.error || error);
  const visible = failed ? null : audit;
  return <section id='google-hygiene-desk' aria-label='Google Account Hygiene Audit' className='space-y-4 rounded-2xl border border-emerald-400/20 bg-white/[0.025] p-5'>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div><h2 className='text-lg font-semibold'>Google Account Hygiene Audit</h2>
        <p className='text-sm text-zinc-300'>Explicit read-only native inventory: current campaigns, ads, keywords, campaign assets and conversion actions.</p></div>
      <button className={control} disabled={query.isFetching} onClick={() => void run()}>{query.isFetching ? 'Scanning Google Ads…' : 'Run full native hygiene scan'}</button>
    </div>
    <p className='text-sm text-amber-200'>The scan classifies evidence; it never applies a recommendation. Only targets already covered by ADR 0003 can move to the separate exact-preview Repair Desk.</p>
    {failed ? <p role='alert'>Native Google hygiene scan unavailable. Cached or partial results are withheld; no empty-success audit exists.</p> : null}
    {!visible && !failed ? <p className='text-xs text-zinc-400'>No scan has run for this account in this browser view. Stored campaign reporting remains separate from this live native inventory.</p> : null}
    {visible ? <>
      <section aria-label='Google hygiene summary' className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {(Object.keys(labels) as GoogleHygieneDisposition[]).map(key => <div key={key} className='rounded-xl border border-white/10 p-3'>
          <p className='text-xs text-zinc-400'>{labels[key]}</p><p className='text-2xl font-semibold'>{visible.counts[key]}</p>
        </div>)}
      </section>
      <p className='text-xs text-zinc-400'>Native customer {visible.customerId} · scanned {visible.scannedAt}. Coverage: campaigns {visible.coverage.campaigns.scanned}, ads {visible.coverage.ads.scanned}, keywords {visible.coverage.keywords.scanned}, campaign assets {visible.coverage.campaignAssets.scanned}, conversion actions {visible.coverage.conversionActions.scanned}.</p>
      {!visible.complete ? <p role='alert' className='text-amber-200'>At least one native inventory exceeded the bounded 10,000-row scan. Findings are partial and must not be treated as account-complete.</p> : <p className='text-sm text-emerald-200'>All five native inventories completed within the bounded scan.</p>}
      {visible.findings.length ? <div className='overflow-x-auto'><table aria-label='Google hygiene findings' className='w-full min-w-[980px] text-left text-sm'>
        <thead><tr>{['Severity', 'Disposition', 'Finding', 'Evidence', 'Next action'].map(label => <th key={label} className='p-2'>{label}</th>)}</tr></thead>
        <tbody>{visible.findings.map(finding => <tr key={finding.id} className='border-t border-white/10 align-top'>
          <td className='p-2'>{finding.severity}</td><td className='p-2'>{finding.disposition.replaceAll('_', ' ')}</td>
          <td className='p-2'><p>{finding.title}</p><p className='text-xs text-zinc-400'>{finding.category} · {finding.entityType} {finding.entityId}</p></td>
          <td className='max-w-sm p-2 text-xs text-zinc-300'>{finding.evidence.join(' · ')}</td>
          <td className='max-w-sm p-2'><p>{finding.recommendedAction}</p><p className='mt-1 text-xs text-zinc-400'>{finding.rationale}</p></td>
        </tr>)}</tbody>
      </table></div> : <p>No native hygiene findings were detected in the bounded current inventory. This is not proof of profitable performance or valid landing-page content.</p>}
      {visible.counts.repairable_in_adpd > 0 ? <a className='inline-block text-sm text-blue-300 underline' href='#google-repair-desk'>Open Google Repair Desk</a> : null}
    </> : null}
  </section>;
}
