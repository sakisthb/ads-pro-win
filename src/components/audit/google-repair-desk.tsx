'use client';

import { useState } from 'react';
import { api } from '@/components/providers/trpc-provider';
import type { RepairPreview, RepairRequest } from '@/lib/google-repair';

const control = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-40 focus:ring-2 focus:ring-blue-400';
type Props = { brandId: string; adAccountId: string };
type Record = { id: string; preview: RepairPreview };
// Scope changes remount all local preview/confirmation state, including pending selections.
export function GoogleRepairDesk(props: Props) {
  return <RepairDesk key={`${props.brandId}:${props.adAccountId}`} {...props} />;
}
function RepairDesk(scope: Props) {
  const [campaignId, setCampaignId] = useState('');
  const [campaignChoices, setCampaignChoices] = useState<{ id: string; name: string; status: string }[]>([]);
  const inventory = api.googleRepair.inventory.useQuery(campaignId ? { ...scope, campaignId } : scope, { enabled: false, retry: false });
  const history = api.googleRepair.history.useQuery(scope, { retry: false });
  const prepare = api.googleRepair.prepare.useMutation();
  const execute = api.googleRepair.execute.useMutation();
  const reconcile = api.googleRepair.reconcile.useMutation();
  const [targetId, setTargetId] = useState('');
  const [operation, setOperation] = useState('');
  const [reason, setReason] = useState('');
  const [url, setUrl] = useState('');
  const [headlines, setHeadlines] = useState('');
  const [descriptions, setDescriptions] = useState('');
  const [record, setRecord] = useState<Record | null>(null);
  const [exact, setExact] = useState(false);
  const [serving, setServing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const busy = prepare.isPending || execute.isPending || reconcile.isPending;
  const targets = inventory.error || inventory.isFetching ? [] : inventory.data?.targets ?? [];
  const target = targets[Number(targetId)];
  const receipts = history.error ? [] : (history.data ?? []).filter(r => r.preview.scope.brandId === scope.brandId && r.preview.scope.adAccountId === scope.adAccountId);
  const invalidate = () => { setRecord(null); setExact(false); setServing(false); setAttempted(false); setError(''); };
  const message = (e: unknown) => e instanceof Error ? e.message : 'Repair request failed. Reload saved receipts before continuing.';
  async function loadInventory() {
    invalidate(); setTargetId('');
    const result = await inventory.refetch();
    if (result?.data?.campaigns) setCampaignChoices(result.data.campaigns);
  }
  function selectTarget(value: string) {
    invalidate(); setTargetId(value); setUrl(''); setHeadlines(''); setDescriptions('');
    setOperation(value === '' ? '' : targets[Number(value)]?.request.kind ?? '');
  }
  async function preview() {
    if (!target || targetId === '') return;
    invalidate();
    try {
      let request: RepairRequest;
      if (target.request.kind === 'rsa_update') {
        request = { ...target.request, reason, patch: { ...(url.trim() ? { finalUrls: [url.trim()] } : {}),
          ...(headlines.trim() ? { headlines: JSON.parse(headlines) } : {}), ...(descriptions.trim() ? { descriptions: JSON.parse(descriptions) } : {}) } };
      } else if (target.request.kind === 'keyword_pause') {
        request = operation === 'keyword_destination' ? { ...target.request, kind: 'keyword_destination', reason, finalUrls: [url.trim()] } : { ...target.request, reason };
      } else request = { ...target.request, reason };
      setRecord(await prepare.mutateAsync({ ...scope, request }));
      void history.refetch();
    } catch (e) { setError(message(e)); }
  }
  async function perform(action: 'execute' | 'reconcile') {
    if (!record) return;
    setError(''); setExact(false); setServing(false);
    if (action === 'execute') setAttempted(true);
    const ref = { ...scope, id: record.id, hash: record.preview.hash };
    try {
      const result = action === 'execute' ? await execute.mutateAsync({ ...ref, confirmExactRepair: true, acknowledgePossibleServing: true }) : await reconcile.mutateAsync(ref);
      setRecord(result);
    } catch (e) { setError(message(e)); }
    finally { void history.refetch(); }
  }
  const canExecute = record?.preview.state === 'prepared' && !attempted && Date.parse(record.preview.expiresAt) > Date.now() && exact && serving && !busy;
  const uncertain = record && (['executing', 'provider_unknown', 'readback_mismatch'].includes(record.preview.state) || attempted && record.preview.state === 'prepared');
  const campaignNetworkRepair = record?.preview.request.kind === 'campaign_network_update';
  return <section aria-label='Google Repair Desk' className='space-y-4 rounded-2xl border border-blue-400/20 bg-white/[0.025] p-5'>
    <h2 className='text-lg font-semibold'>Google Repair Desk</h2>
    <p className='text-sm text-zinc-300'>Existing BagToBag Search RSA copy/destinations, positive keyword pause/destinations, campaign sitelink pause and one-way Content Network disable only. No campaign activation, budget changes, campaign creation, shared negative-list edits or website/catalog writes.</p>
    <p className='text-sm text-amber-200'>A repaired enabled target may continue or resume serving and spend under its existing budget. Native field verification does not mean Google policy approval, delivery or improved ROAS.</p>
    <div className='flex flex-wrap gap-3'>
      <button className={control} disabled={busy || inventory.isFetching} onClick={() => void loadInventory()}>Load native Google targets (read-only)</button>
      <button className={control} disabled={busy || history.isFetching} onClick={() => { invalidate(); void history.refetch(); }}>Reload repair receipts</button>
    </div>
    {inventory.error ? <p role='alert'>Native Google inventory unavailable. Cached targets are withheld.</p> : null}
    {history.error ? <p role='alert'>Saved repair audit history unavailable. Do not repeat an uncertain execution.</p> : null}
    {inventory.data && !inventory.error ? <p className='text-xs text-zinc-400'>Native customer {inventory.data.customerId}. {inventory.data.limited ? 'Limited subset: at most 200 targets per type.' : 'Loaded current eligible Search targets; not historical performance or a complete account audit.'}</p> : null}
    <label className='block'>Native Search campaign<select className={`${control} block w-full`} value={campaignId} disabled={busy || inventory.isFetching} onChange={e => { invalidate(); setTargetId(''); setCampaignId(e.target.value); }}>
      <option value=''>All Search campaigns (bounded subset)</option>{campaignChoices.map(c => <option key={c.id} value={c.id}>{c.name} / {c.id} / {c.status}</option>)}
    </select></label>
    <p className='text-xs text-zinc-400'>Choose a campaign and press Load native Google targets again for its bounded inventory. Loading never executes ads.</p>
    <label className='block space-y-1'>Native repair target
      <select aria-label='Native repair target' value={targetId} disabled={busy || inventory.isFetching} onChange={e => selectTarget(e.target.value)} className={`${control} block w-full`}>
        <option value=''>Select an existing native target</option>{targets.map((t, i) => <option key={t.before.resourceName} value={String(i)}>{t.label} — {t.before.status}</option>)}
      </select>
    </label>
    {targetId !== '' && target ? <>
      <p className='break-all text-xs text-zinc-400'>{target.before.resourceName} · Campaign {target.before.campaignStatus} · Ad group {target.before.adGroupStatus ?? 'N/A'}</p>
      {target.request.kind === 'keyword_pause' ? <label className='block'>Keyword repair operation<select className={`${control} ml-2`} value={operation} disabled={busy} onChange={e => { invalidate(); setOperation(e.target.value); }}>
        <option value='keyword_pause'>Pause this keyword</option><option value='keyword_destination'>Repair this keyword destination</option>
      </select></label> : null}
      {target.request.kind === 'rsa_update' || operation === 'keyword_destination' ? <label className='block'>New final URL (blank = unchanged)
        <input className={`${control} block w-full`} value={url} disabled={busy} onChange={e => { invalidate(); setUrl(e.target.value); }} />
      </label> : null}
      {target.request.kind === 'rsa_update' ? <>
        <details><summary>Current RSA copy and mobile destinations</summary><pre className='overflow-auto whitespace-pre-wrap text-xs'>{JSON.stringify({ headlines: target.before.headlines, descriptions: target.before.descriptions, finalUrls: target.before.finalUrls, finalMobileUrls: target.before.finalMobileUrls }, null, 2)}</pre></details>
        <p className='text-xs text-zinc-400'>Optional copy replacement: use JSON arrays of text/pinnedField objects shown above. Blank = preserve current copy. An array replaces that entire asset list, including pins. Headlines: 3–15, 30 characters each; descriptions: 2–4, 90 each.</p>
        <label className='block'>Headlines JSON (optional)<textarea className={`${control} block w-full font-mono`} value={headlines} disabled={busy} onChange={e => { invalidate(); setHeadlines(e.target.value); }} /></label>
        <label className='block'>Descriptions JSON (optional)<textarea className={`${control} block w-full font-mono`} value={descriptions} disabled={busy} onChange={e => { invalidate(); setDescriptions(e.target.value); }} /></label>
      </> : null}
    </> : null}
    <label className='block'>Repair reason<textarea className={`${control} block w-full`} minLength={10} maxLength={1000} value={reason} disabled={busy} onChange={e => { invalidate(); setReason(e.target.value); }} /></label>
    <button className={control} disabled={busy || targetId === '' || !target || reason.trim().length < 10} onClick={() => void preview()}>Prepare exact repair preview</button>
    <label className='block'>Saved repair receipts<select className={`${control} block w-full`} aria-label='Saved repair receipts' value={receipts.some(r => r.id === record?.id) ? record!.id : ''} disabled={busy || Boolean(history.error)} onChange={e => {
      invalidate(); setTargetId(''); setOperation(''); setReason(''); setUrl(''); setHeadlines(''); setDescriptions('');
      setRecord(receipts.find(r => r.id === e.target.value) ?? null);
    }}>
      <option value=''>Choose a saved repair receipt</option>{receipts.map(r => <option key={r.id} value={r.id}>{r.preview.createdAt} / {r.preview.state} / {r.id}</option>)}
    </select></label>
    {error ? <p role='alert'>{error}</p> : null}
    {record ? <div className='space-y-3 rounded-xl border border-white/15 p-4'>
      <h3 className='font-medium'>Exact repair preview</h3>
      <p className='text-xs text-zinc-400'>Execution uses only this saved original target/reason, never the unsaved editor above. Campaign {record.preview.request.campaignId}.</p>
      <p className='break-all text-xs'>Customer {record.preview.scope.customerId} · {record.preview.request.kind} · Expires {record.preview.expiresAt} · SHA256 {record.preview.hash}</p>
      <p className='text-sm'>{record.preview.request.reason}</p>
      <div className='grid gap-3 md:grid-cols-2'>{[['Before', record.preview.before], ['Desired', record.preview.desired]].map(([label, state]) => <div key={label as string}><h4>{label as string}</h4><pre className='max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs'>{JSON.stringify(state, null, 2)}</pre></div>)}</div>
      <p role='status'>{record.preview.state}</p><p className='text-sm'>{record.preview.attempt?.message}</p>
      <details><summary>Durable execution / reconciliation audit</summary><pre className='max-h-48 overflow-auto whitespace-pre-wrap text-xs'>{JSON.stringify(record.preview.events, null, 2)}</pre></details>
      {attempted && record.preview.state === 'prepared' ? <p className='text-amber-200'>Client outcome unknown. Reload durable receipts and reconcile; do not repeat execution.</p> : null}
      <label className='flex gap-2'><input type='checkbox' checked={exact} disabled={busy || record.preview.state !== 'prepared' || attempted} onChange={e => setExact(e.target.checked)} />I approve these exact before/desired fields for this one target.</label>
      <label className='flex gap-2'><input type='checkbox' checked={serving} disabled={busy || record.preview.state !== 'prepared' || attempted} onChange={e => setServing(e.target.checked)} />{campaignNetworkRepair ? 'This campaign may continue serving and spending on Google Search under its existing budget.' : 'An enabled ad may resume serving and spend under its existing budget.'}</label>
      <button className={control} disabled={!canExecute} onClick={() => void perform('execute')}>Execute this exact repair</button>
      {uncertain ? <button className={`${control} ml-2`} disabled={busy} onClick={() => void perform('reconcile')}>Reconcile native fields (read-only)</button> : null}
    </div> : null}
  </section>;
}
