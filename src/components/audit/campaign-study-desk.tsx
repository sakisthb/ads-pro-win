'use client';

import { api } from '@/components/providers/trpc-provider';
import type { CampaignStudy, ConclusionStatus, LpvReliability, OrderTrend, SpendCutStatus } from '@/lib/campaign-study';

const fmt = (v: number | null, suffix = '') => v === null ? 'Unverified' : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
const SPEND_CUT_LABEL: Record<SpendCutStatus, string> = { sharp: 'Sharp spend cut', moderate: 'Moderate spend cut', stable: 'Spend/day broadly stable' };
const LPV_LABEL: Record<LpvReliability, string> = { ok: 'LPV tracking OK', degraded: 'LPV tracking degraded', broken: 'LPV tracking broken', unverified: 'LPV unverified' };
const TREND_LABEL: Record<OrderTrend, string> = { rising: 'Rising', stable: 'Stable', dip: 'Dip', sustained_decline: 'Sustained decline', recovered: 'Recovered', insufficient_data: 'Insufficient data' };
const CONCLUSION_LABEL: Record<ConclusionStatus, string> = { evidence_backed: 'Evidence-backed', insufficient_data: 'Insufficient data', no_linkable_evidence: 'No linkable evidence' };
const DESK_HEADING: Record<string, string> = { retail: 'Retail · ΛΙΑΝΙΚΗ', branding: 'Branding / demand', wholesale: 'Wholesale · χονδρική' };
const chip = 'inline-block rounded-md px-2 py-0.5 text-xs';

// Brand scope changes remount the desk so a previous brand's study never stays rendered.
export function CampaignStudyDesk({ brandId }: { brandId: string }) {
  return <Desk key={brandId} brandId={brandId} />;
}

function Desk({ brandId }: { brandId: string }) {
  const study = api.campaignStudy.get.useQuery({ brandId }, { enabled: Boolean(brandId), retry: false });
  if (study.error) return <section aria-label="Campaign study" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <h2 className="text-lg font-semibold">Campaign study</h2>
    <p role="alert">Campaign study unavailable. Stored study evidence is withheld until it reloads; no fallback numbers are shown.</p>
  </section>;
  if (study.isLoading || !study.data) return <section aria-label="Campaign study" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <h2 className="text-lg font-semibold">Campaign study</h2>
    <p role="status">Loading stored campaign study…</p>
  </section>;
  return <StudyView study={study.data} />;
}

function StudyView({ study }: { study: CampaignStudy }) {
  const s = study;
  const insufficient = !s.metaCoverage.primaryCampaign && s.metaCoverage.rowCount === 0 && s.googleCoverage.rowCount === 0 && s.retail.status === 'insufficient_data';
  return <section aria-label="Campaign study" className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Campaign study</h2>
      <span className="rounded-md bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Stored-rows diagnosis · as of {s.asOf} · no provider fetch, no campaign writes</span>
    </div>
    <p className="text-sm text-zinc-300">Same-day (1–16) monthly windows over stored Meta daily metrics, Google historical coverage and Woo order outcomes.
      Every figure derives from stored rows; missing observations stay Unverified and are never read as zero performance.</p>
    {insufficient ? <p className="text-sm text-amber-200">Insufficient stored data — windows shown with Unverified values, conclusions stay insufficient_data.</p> : null}

    <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
      {s.windows.map(w => <div key={w.label} className="rounded-lg border border-white/15 px-3 py-2">
        <p className="font-medium text-zinc-200">{w.label}</p>
        <p>{w.startDate} → {w.endDate} ({w.daysInWindow} days)</p>
      </div>)}
    </div>

    {s.metaCoverage.primaryCampaign ? <>
      <h3 className="font-medium">Primary Meta purchase campaign: {s.metaCoverage.primaryCampaign.name}</h3>
      <p className="text-xs text-zinc-400">Share of stored Meta spend {fmt(s.metaCoverage.primaryCampaign.shareOfMetaSpend * 100, '%')} ·
        stored rows {s.metaCoverage.primaryCampaign.firstRow} → {s.metaCoverage.primaryCampaign.lastRow}.
        {s.metaCoverage.channelRatio ? ` Stored Meta spend is ${fmt(s.metaCoverage.channelRatio.multiple, '×')} Google spend — Meta-only reads are not account-wide truth.` : ''}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm" aria-label="Primary Meta purchase funnel by same-day window">
        <caption className="pb-3 text-left text-xs text-zinc-400">Stored daily-metric subset per same-day window. Zero-spend / gap days are coverage facts, not performance.</caption>
        <thead><tr>{['Window', 'Days with rows', 'Zero-spend days', 'Gap days', 'Spend/day', 'Purchases', 'Purchase value', 'ROAS', 'Click → LPV'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{s.purchaseFunnel.map(f => <tr key={f.window.label} className="border-t border-white/10">
          <td className="p-2">{f.window.label}</td><td className="p-2">{f.daysWithRows}</td><td className="p-2">{f.zeroSpendDays}</td>
          <td className="p-2">{f.gapDays}</td><td className="p-2">{fmt(f.spendPerDay)}</td><td className="p-2">{f.purchases}</td>
          <td className="p-2">{fmt(f.purchaseValue)}</td><td className="p-2">{fmt(f.roas, 'x')}</td><td className="p-2">{fmt(f.clickToLpvRate === null ? null : f.clickToLpvRate * 100, '%')}</td>
        </tr>)}</tbody>
      </table></div>
    </> : <p className="text-sm text-zinc-400">Primary Meta purchase campaign: Unverified — no stored Meta purchase rows for this brand.</p>}

    <div className="grid gap-3 lg:grid-cols-3">
      <Diagnostic title={SPEND_CUT_LABEL[s.spendCut.status]} tone={s.spendCut.status === 'stable' ? 'ok' : 'warn'} summary={s.spendCut.summary} />
      <Diagnostic title={LPV_LABEL[s.lpv.status]} tone={s.lpv.status === 'ok' ? 'ok' : s.lpv.status === 'unverified' ? 'muted' : 'warn'} summary={s.lpv.summary} />
      <Diagnostic title="Retail drop timing" tone={s.timing.dropBeforeSpendCut === false ? 'ok' : 'warn'} summary={s.timing.summary} />
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <DeskTrend label="Retail · ΛΙΑΝΙΚΗ orders (processing/completed)" diagnostic={s.retail} />
      <DeskTrend label="Wholesale · χονδρική orders (processing/completed)" diagnostic={s.wholesale} />
    </div>

    <div className="rounded-xl border border-white/15 p-4">
      <h3 className="font-medium">Google historical coverage</h3>
      <p className="text-sm text-zinc-300">{s.googleCoverage.summary}</p>
      {s.utmCoverage.orders > 0 ? <p className="text-xs text-zinc-400">UTM source coverage on Woo orders: {fmt(s.utmCoverage.coveragePct === null ? null : s.utmCoverage.coveragePct * 100, '%')}
        ({s.utmCoverage.withSource}/{s.utmCoverage.orders}){s.utmCoverage.sufficient ? '' : ' — below 50%, so source-level channel splits are not reliable'}. Meta-attributed: {s.utmCoverage.metaAttributed}.</p> : null}
    </div>

    <div className="space-y-3">
      <h3 className="font-medium">Conclusions per desk</h3>
      {s.conclusions.map(c => <div key={c.desk} className="rounded-xl border border-white/15 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="font-medium">{DESK_HEADING[c.desk]}</h4>
          <span className={`${chip} ${c.status === 'evidence_backed' ? 'bg-emerald-400/10 text-emerald-200' : c.status === 'no_linkable_evidence' ? 'bg-amber-400/10 text-amber-200' : 'bg-zinc-400/10 text-zinc-300'}`}>{CONCLUSION_LABEL[c.status]}</span>
        </div>
        <p className="mt-1 text-sm font-medium">{c.title}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">{c.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>)}
    </div>

    <div className="rounded-xl border border-amber-400/30 p-4">
      <h3 className="font-medium">Limits of this study</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/90">{s.limits.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  </section>;
}

function Diagnostic({ title, tone, summary }: { title: string; tone: 'ok' | 'warn' | 'muted'; summary: string }) {
  const toneClass = tone === 'ok' ? 'bg-emerald-400/10 text-emerald-200' : tone === 'warn' ? 'bg-amber-400/10 text-amber-200' : 'bg-zinc-400/10 text-zinc-300';
  return <div className="rounded-xl border border-white/15 p-4">
    <span className={`${chip} ${toneClass}`}>{title}</span>
    <p className="mt-2 text-sm text-zinc-300">{summary}</p>
  </div>;
}

function DeskTrend({ label, diagnostic }: { label: string; diagnostic: CampaignStudy['retail'] }) {
  const tone = diagnostic.status === 'rising' || diagnostic.status === 'recovered' ? 'bg-emerald-400/10 text-emerald-200'
    : diagnostic.status === 'stable' ? 'bg-zinc-400/10 text-zinc-300' : 'bg-amber-400/10 text-amber-200';
  return <div className="rounded-xl border border-white/15 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">{label}</h3>
      <span className={`${chip} ${tone}`}>{TREND_LABEL[diagnostic.status]}</span>
    </div>
    <p className="mt-2 text-xs text-zinc-400">{diagnostic.counts.map(c => `${c.label}: ${c.orders} orders · ${fmt(c.grossSales)}`).join(' · ')}</p>
    <p className="mt-1 text-sm text-zinc-300">{diagnostic.summary}</p>
  </div>;
}
