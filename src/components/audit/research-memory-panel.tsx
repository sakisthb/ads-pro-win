'use client';

import { useState } from 'react';
import { api } from '@/components/providers/trpc-provider';
import type { ResearchMemoryRecord } from '@/lib/research-memory';

const control = 'rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-40 focus:ring-2 focus:ring-blue-400';
// Brand scope changes remount the selection so a previous brand's entry never stays open.
export function ResearchMemoryPanel({ brandId }: { brandId: string }) {
  return <Panel key={brandId} brandId={brandId} />;
}

function Panel({ brandId }: { brandId: string }) {
  const list = api.researchMemory.list.useQuery({ brandId }, { enabled: Boolean(brandId), retry: false });
  const [selectedId, setSelectedId] = useState('');
  const records = (list.data ?? []).filter(record => record.entry.brandId === brandId);
  const selected = records.find(record => record.id === selectedId) ?? null;
  return <section aria-label="Research memory" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <h2 className="text-lg font-semibold">Research memory</h2>
    <p className="text-sm text-zinc-300">Imported operator research for this brand: versioned, source-labeled and integrity-checked. Research context, not provider-verified metrics; it never authorizes campaign, budget or AI setting writes.</p>
    {list.error ? <p role="alert">Saved research memory unavailable. Imported research is withheld until it reloads.</p> : null}
    {!list.error && list.isLoading ? <p role="status">Loading saved research memory…</p> : null}
    {!list.error && !list.isLoading ? <>
      {records.length === 0 ? <p className="text-sm text-zinc-400">No research memory imported for this brand yet.</p> : null}
      <label className="block">Saved research memory
        <select className={`${control} block w-full`} aria-label="Saved research memory" value={selected?.id ?? ''} onChange={e => setSelectedId(e.target.value)}>
          <option value="">Choose a saved research entry</option>
          {records.map(record => <option key={record.id} value={record.id}>v{record.entry.version} · {record.entry.sourceDate} · {record.entry.title}</option>)}
        </select>
      </label>
      {selected ? <EntryView record={selected} /> : null}
    </> : null}
  </section>;
}

function EntryView({ record }: { record: ResearchMemoryRecord }) {
  const entry = record.entry;
  return <div className="space-y-3 rounded-xl border border-white/15 p-4">
    <h3 className="font-medium">{entry.title}</h3>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-zinc-400">Source document</dt><dd className="break-all">{entry.sourceDoc}</dd></div>
      <div><dt className="text-xs text-zinc-400">Source date</dt><dd>{entry.sourceDate}</dd></div>
      <div><dt className="text-xs text-zinc-400">Version</dt><dd>v{entry.version}{entry.supersedesId ? ` (supersedes ${entry.supersedesId})` : ''}</dd></div>
      <div><dt className="text-xs text-zinc-400">Imported</dt><dd>{entry.importedAt} by {entry.importedBy}</dd></div>
      <div><dt className="text-xs text-zinc-400">Evidence checksum (SHA256)</dt><dd className="break-all text-xs">{entry.contentHash}</dd></div>
      <div><dt className="text-xs text-zinc-400">Record</dt><dd className="break-all text-xs">{record.id}</dd></div>
    </dl>
    {entry.sourceUrls.length > 0 ? <div className="flex flex-wrap gap-3 text-xs">{entry.sourceUrls.map(url =>
      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">{url}</a>)}</div> : null}
    <details open><summary className="cursor-pointer text-sm">Imported research Markdown</summary>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">{entry.markdown}</pre></details>
  </div>;
}
