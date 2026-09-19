'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/providers/trpc-provider';
import { resolveAuditPeriods } from '@/lib/audit-periods';
import { GoogleCoveragePanel } from '@/components/connections/GoogleCoveragePanel';
import { auditProviderAccountLabel, type AuditWindow } from '@/lib/performance-audit';

type Props = { brandId: string; adAccountId: string; providerAccountId: string; current: AuditWindow; baseline: AuditWindow; onImported: () => void };
type ImportRun = { syncJobId: string; recordsSynced: number; startDate: string; endDate: string };
type ImportResponse = { success?: unknown; error?: unknown; adAccountId?: unknown; customerId?: unknown; startDate?: unknown; endDate?: unknown; syncJobId?: unknown; recordsSynced?: unknown };
const control = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-40 focus:ring-2 focus:ring-blue-400';

/** Explicit reporting imports only; never auto-syncs, reconnects or changes ads. */
export function GoogleHistoryImport(props: Props) {
  return <HistoryImport key={JSON.stringify([props.brandId, props.adAccountId, props.providerAccountId, props.current, props.baseline])} {...props} />;
}

function HistoryImport(props: Props) {
  const label = auditProviderAccountLabel('google', props.providerAccountId);
  const customerId = /^\d{6,}$/.test(label) ? label : null; // Display pin only; server verifies actual connector identity and ownership.
  const coverage = api.syncStatus.getGoogleCoverage.useQuery({ adAccountId: props.adAccountId }, { retry: false });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  let validPeriods = true;
  try { resolveAuditPeriods(props.current, { mode: 'custom', window: props.baseline }, new Date().toISOString().slice(0, 10)); }
  catch { validPeriods = false; }
  const available = validPeriods && Boolean(customerId) && !coverage.isLoading && !coverage.isFetching && !coverage.isError && coverage.data?.availability === 'available';

  async function importHistory() {
    if (!available || !confirmed || busy || !customerId) return;
    setBusy(true); setConfirmed(false); setError(''); setMessage(''); setRuns([]);
    const completed: ImportRun[] = [];
    try {
      for (const window of [props.current, props.baseline]) {
        if (!mounted.current) break; // Scope changes cancel subsequent requests, not an already-running server import.
        const response: Response = await fetch('/api/sync/google', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: props.brandId, adAccountId: props.adAccountId, expectedGoogleCustomerId: customerId, ...window }) });
        const data: ImportResponse | null = await response.json().catch(() => null);
        if (!response.ok || data?.success !== true) throw new Error(typeof data?.error === 'string' ? data.error : 'Reporting import failed. Review receipts before retrying.');
        if (data.adAccountId !== props.adAccountId || data.customerId !== customerId || data.startDate !== window.startDate || data.endDate !== window.endDate
          || typeof data.syncJobId !== 'string' || !data.syncJobId || typeof data.recordsSynced !== 'number' || !Number.isInteger(data.recordsSynced) || data.recordsSynced < 0) {
          throw new Error('Reporting import scope or result mismatch. Review receipts before continuing.');
        }
        completed.push({ syncJobId: data.syncJobId, recordsSynced: data.recordsSynced, ...window });
        if (mounted.current) setRuns([...completed]);
      }
      if (mounted.current) setMessage(`${completed.length} reporting imports finished. Review receipts and refreshed audit; this is not campaign readiness.`);
    } catch (e) {
      if (mounted.current) setError(`Stopped after ${completed.length} confirmed imports. ${e instanceof Error ? e.message : 'Reporting import failed.'} No automatic retry or rollback.`);
    } finally {
      if (mounted.current) {
        setBusy(false); void coverage.refetch();
        if (completed.length) props.onImported();
      }
    }
  }

  return <section aria-label='Google historical reporting import' className='space-y-4 rounded-2xl border border-blue-400/20 bg-white/[0.025] p-5'>
    <h2 className='text-lg font-semibold'>Import Google historical evidence</h2>
    <p className='text-sm text-zinc-300'>Account {customerId ?? 'unverified'} · exact selected brand/account. Owner/admin only; server authorization is required.</p>
    <p className='text-sm'>Current: {props.current.startDate} → {props.current.endDate}. Baseline: {props.baseline.startDate} → {props.baseline.endDate}.</p>
    <p className='text-sm text-zinc-400'>Two sequential reporting imports update ADPD campaign/day records, including paused and removed history. Google uses its account timezone. No campaign activation, budget/ad changes, OAuth reconnect or website writes.</p>
    <p className='text-sm text-amber-200'>An already-started import can finish after you change scope. A failed import may leave partial data; review each receipt. Stored metrics and attributed conversions alone do not verify purchase-only ROAS or qualified Wholesale leads.</p>
    {!available && <p className='text-sm text-amber-200'>{coverage.data?.availability === 'migration_required'
      ? 'Coverage receipt migration is required. Import remains blocked; no provider calls are launched.'
      : 'Valid completed periods, a selected Google customer and available receipt schema are required. Import remains blocked.'}</p>}
    <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={confirmed} disabled={!available || busy} onChange={e => setConfirmed(e.target.checked)} />
      Confirm reporting import for this exact account and both displayed periods; update ADPD data, not ads.</label>
    <button className={control} disabled={!available || !confirmed || busy} onClick={() => void importHistory()}>{busy ? 'Importing Google history…' : 'Import selected Google history'}</button>
    {error && <p role='alert' className='text-amber-200'>{error}</p>}
    {message && <p role='status' className='text-blue-200'>{message}</p>}
    {runs.length > 0 && <ul className='space-y-1 text-xs text-zinc-400'>{runs.map(run => <li key={run.syncJobId}>{run.startDate} → {run.endDate} · run {run.syncJobId} · {run.recordsSynced} processed records (not conversions or spend)</li>)}</ul>}
    <GoogleCoveragePanel key={runs.map(run => run.syncJobId).join(':')} adAccountId={props.adAccountId} />
  </section>;
}
