"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/components/providers/trpc-provider";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { lastCompletedCampaignWindow, validCampaignWindow } from "@/lib/campaign-reporting";
import { auditMarkdown, auditProviderAccountLabel, buildPerformanceAudit, precedingAuditWindow, BUSINESS_CONTEXT_CAUTION, type AuditBusinessContext, type AuditGoal } from "@/lib/performance-audit";
import { projectContextEntries } from "@/lib/project-context";
import { auditPresetWindow, resolveAuditPeriods, type AuditComparison, type AuditPreset } from "@/lib/audit-periods";
import { AUDIT_KPI_REFERENCES } from "@/lib/audit-kpis";
import { GoogleResearchDesk } from "@/components/audit/google-research-desk";
import { GoogleRepairDesk } from "@/components/audit/google-repair-desk";
import { GoogleHistoryImport } from "@/components/audit/google-history-import";
import { GoogleCampaignAdaptationReview } from '@/components/audit/google-campaign-adaptation-review';
import { ResearchMemoryPanel } from "@/components/audit/research-memory-panel";
import { CampaignStudyDesk } from "@/components/audit/campaign-study-desk";
import { ProposalsDesk } from "@/components/audit/proposals-desk";

const control = "max-w-full min-w-0 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400";
const section = "rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4";
const fmt = (v: number | null, suffix = "") => v === null ? "Unverified" : `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;

export default function AccountAuditPage() {
  const { brands, brandId, setBrandId } = useActiveBrand();
  const { market } = useActiveMarket();
  const [platform, setPlatform] = useState<"google" | "meta" | "tiktok">("google");
  const [goal, setGoal] = useState<AuditGoal>("sales");
  const [window, setWindow] = useState(() => lastCompletedCampaignWindow());
  const [asOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [preset, setPreset] = useState<AuditPreset | "custom">("month");
  const [comparisonSelection, setComparisonSelection] = useState("previous");
  const [customBaseline, setCustomBaseline] = useState(() => precedingAuditWindow(lastCompletedCampaignWindow()));
  const [selected, setSelected] = useState({ scope: "", id: "" });
  const [chartSelection, setChartSelection] = useState({ scope: "", currency: "" });
  const [downloadReceipt, setDownloadReceipt] = useState({ scope: "", message: "" });
  const scope = `${brandId}:${platform}`;
  const accountsQuery = api.marketing.getCampaignReportAccounts.useQuery({ brandId: brandId || undefined, platform }, { enabled: Boolean(brandId) });
  const accounts = accountsQuery.data?.accounts ?? [];
  const accountId = selected.scope === scope && accounts.some(a => a.id === selected.id)
    ? selected.id : accounts.length === 1 ? accounts[0].id : "";
  const account = accounts.find(a => a.id === accountId);
  const comparison: AuditComparison = comparisonSelection === "custom" ? { mode: "custom", window: customBaseline }
    : comparisonSelection.startsWith("year_") ? { mode: "year", yearsBack: Number(comparisonSelection.slice(5)) } : { mode: "previous" };
  let periods: ReturnType<typeof resolveAuditPeriods> | undefined;
  let periodError = "";
  try { periods = resolveAuditPeriods(window, comparison, asOf); }
  catch (error) { periodError = error instanceof Error ? error.message : "Invalid audit periods"; }
  const previousWindow = periods?.window;
  const valid = Boolean(periods);
  const enabled = Boolean(brandId && account && valid);
  const contextQuery = api.onboarding.getBrandContext.useQuery({ brandId: brandId || "" }, { enabled });
  const businessContext: AuditBusinessContext = contextQuery.error || contextQuery.data?.brandId !== brandId
    ? { source: "unavailable", context: null }
    : { source: contextQuery.data.source, context: contextQuery.data.context };
  const common = { brandId: brandId || undefined, platform, adAccountId: accountId || undefined, market, limit: 1000 };
  const currentQuery = api.marketing.getCampaignPerformance.useQuery({ ...common, ...window }, { enabled });
  const previousQuery = api.marketing.getCampaignPerformance.useQuery({ ...common, ...(previousWindow ?? window) }, { enabled });
  const currentError = currentQuery.error;
  const loading = enabled && (currentQuery.isLoading || currentQuery.isFetching || previousQuery.isLoading || previousQuery.isFetching || contextQuery.isLoading || contextQuery.isFetching);
  const current = currentQuery.data?.data;
  const currentWindowMatches = current?.window.startDate === window.startDate && current?.window.endDate === window.endDate;
  const audit = enabled && !currentError && !loading && current && currentWindowMatches ? buildPerformanceAudit({ current,
    previous: previousQuery.error ? undefined : previousQuery.data?.data,
    goal, asOf, platform, adAccountId: accountId, businessContext, comparison,
    contextConnections: contextQuery.data?.brandId === brandId ? contextQuery.data.connections ?? [] : [],
  }) : null;
  const chartScope = `${scope}:${accountId}:${market}:${window.startDate}:${window.endDate}:${comparisonSelection}:${previousWindow?.startDate}:${previousWindow?.endDate}`;
  const downloadScope = `${chartScope}:${goal}:${JSON.stringify(businessContext)}`;
  const downloadMessage = audit && downloadReceipt.scope === downloadScope ? downloadReceipt.message : "";
  const currencies = audit?.summaries.map(s => s.currency) ?? [];
  const chartCurrency = chartSelection.scope === chartScope && currencies.includes(chartSelection.currency)
    ? chartSelection.currency : currencies[0] ?? "";
  const chartRows = audit?.inventory.filter(r => r.currency === chartCurrency && r.spend !== null)
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 8) ?? [];

  function download() {
    if (!audit || !account) return;
    try {
      const md = auditMarkdown(audit, { brand: brands.find(b => b.id === brandId)?.name ?? "Selected shop",
        account: account.name, providerAccountId: auditProviderAccountLabel(platform, account.accountId), market });
      const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `account-audit-${platform}-${window.startDate}_${window.endDate}-vs-${audit.comparisonWindow.startDate}_${audit.comparisonWindow.endDate}.md`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadReceipt({ scope: downloadScope, message: "Audit download requested for this displayed scope." });
    } catch { setDownloadReceipt({ scope: downloadScope, message: "Could not prepare the audit download. Please retry." }); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24 text-zinc-100">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">Performance Marketing Desk</h1>
        <p className="text-sm text-zinc-400">Account audit → evidence → strategy → decision. Stored diagnostics, not automatic campaign changes.</p>
        <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Platform
            <select aria-label="Platform" className={control} value={platform} onChange={e => setPlatform(e.target.value as typeof platform)}>
              <option value="google">Google Ads</option><option value="meta">Meta</option><option value="tiktok">TikTok</option>
            </select>
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Ad account
            <select aria-label="Ad account" className={`${control} max-w-full sm:max-w-xs`} value={accountId}
              onChange={e => setSelected({ scope, id: e.target.value })} disabled={!accounts.length}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {auditProviderAccountLabel(platform, a.accountId)}</option>)}
            </select>
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Business objective
            <select aria-label="Business objective" className={control} value={goal} onChange={e => setGoal(e.target.value as AuditGoal)}>
              <option value="sales">Sales / profitable acquisition</option><option value="branding">Branding / demand</option><option value="wholesale">Wholesale / qualified buyers</option>
            </select>
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Audit period
            <select aria-label="Audit period" className={control} value={preset} onChange={e => {
              const next = e.target.value as AuditPreset | "custom";
              setPreset(next); if (next !== "custom") setWindow(auditPresetWindow(next, asOf));
            }}>
              <option value="week">Last 7 completed days</option><option value="month">Last 30 completed days</option>
              <option value="six_months">Last 6 calendar months</option><option value="year">Last 12 calendar months</option><option value="custom">Custom dates</option>
            </select>
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Comparison period
            <select aria-label="Comparison period" className={control} value={comparisonSelection} onChange={e => {
              const next = e.target.value; setComparisonSelection(next);
              if (next === "custom" && validCampaignWindow(window.startDate, window.endDate)) {
                try { setCustomBaseline(precedingAuditWindow(window)); } catch { /* keep explicit invalid state */ }
              }
            }}>
              <option value="previous">Previous equal-length period</option><option value="year_1">Same dates last year</option>
              <option value="year_2">Same dates 2 years earlier</option><option value="year_3">Same dates 3 years earlier</option><option value="custom">Custom historical baseline</option>
            </select>
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Start date (UTC)
            <input aria-label="Start date (UTC)" type="date" className={control} value={window.startDate}
              onChange={e => { setPreset("custom"); setWindow({ ...window, startDate: e.target.value }); }} />
          </label>
          <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">End date (UTC)
            <input aria-label="End date (UTC)" type="date" className={control} value={window.endDate} max={lastCompletedCampaignWindow().endDate}
              onChange={e => { setPreset("custom"); setWindow({ ...window, endDate: e.target.value }); }} />
          </label>
          {comparisonSelection === "custom" && <>
            <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Baseline start date (UTC)
              <input aria-label="Baseline start date (UTC)" type="date" className={control} value={customBaseline.startDate}
                onChange={e => setCustomBaseline({ ...customBaseline, startDate: e.target.value })} />
            </label>
            <label className="grid max-w-full min-w-0 gap-1 text-xs text-zinc-400">Baseline end date (UTC)
              <input aria-label="Baseline end date (UTC)" type="date" className={control} value={customBaseline.endDate}
                onChange={e => setCustomBaseline({ ...customBaseline, endDate: e.target.value })} />
            </label>
          </>}
          <button className={control} onClick={() => { setPreset("month"); setWindow(auditPresetWindow("month", asOf)); setComparisonSelection("previous"); }}>Reset to 30 completed days</button>
          <button className={`${control} disabled:opacity-40`} disabled={!audit} onClick={download}>Download audit (.md)</button>
        </div>
        <p className="text-xs text-zinc-400">Current: {window.startDate} → {window.endDate} UTC. Baseline: {previousWindow?.startDate ?? "Unverified"} → {previousWindow?.endDate ?? "Unverified"} UTC. Same account/market; currencies remain separate.</p>
        {periods && <p className="text-xs text-amber-200">{periods.label} · {periods.currentDays} current days / {periods.baselineDays} baseline days. {periods.notice}</p>}
        {downloadMessage && <p role="status" className="text-sm text-blue-200">{downloadMessage}</p>}
      </header>

      {!valid && <p role="alert" className="rounded-xl border border-amber-400/30 p-4 text-amber-100">{periodError}</p>}
      {accountsQuery.error && <p role="alert">Could not load owned ad accounts. No account-wide fallback is used.</p>}
      {!account && !accountsQuery.isLoading && !accountsQuery.error && <p className={section}>Select an owned ad account to run the audit.</p>}
      {accountsQuery.isLoading && <p role="status">Loading owned ad accounts…</p>}
      {enabled && currentError && <p role="alert" className={section}>Could not load account audit. No empty-success report is generated.</p>}
      {enabled && current && !loading && !currentError && !currentWindowMatches && <p role="alert" className={section}>Stored response does not match the selected current window. Report and export withheld.</p>}
      {loading && <p role="status" className={section}>Loading current and baseline stored windows and brand business context…</p>}
      {enabled && previousQuery.error && !currentError && <p role="alert">Baseline window could not be loaded. Current data remains available; comparisons are withheld.</p>}

      {platform === "google" && brandId && account && previousWindow && valid && <GoogleHistoryImport
        brandId={brandId} adAccountId={accountId} providerAccountId={account.accountId} current={window} baseline={previousWindow}
        onImported={() => { void currentQuery.refetch(); void previousQuery.refetch(); }} />}
      {platform === "google" && brandId && accountId && <GoogleRepairDesk brandId={brandId} adAccountId={accountId} />}
      {brandId && <ResearchMemoryPanel key={brandId} brandId={brandId} />}
      {brandId && <CampaignStudyDesk key={brandId} brandId={brandId} />}
      {brandId && <ProposalsDesk key={brandId} brandId={brandId} />}
      {audit && <>
        <section className={section} aria-label="Business Context (brand-level)">
          <h2 className="text-lg font-semibold">Business Context (brand-level)</h2>
          <p className="text-xs text-zinc-400">Business context source: {audit.businessContext.source}</p>
          <p className="text-sm text-zinc-400">Operator inputs, not verified business economics; shared across accounts and markets, not an account/wholesale-specific profile.</p>
          <p className="text-xs text-zinc-400">No verified economics or numeric targets are inferred. The selected audit objective remains separate from the saved objective.</p>
          <p className="text-sm text-amber-200">{BUSINESS_CONTEXT_CAUTION}</p>
          {audit.businessContextStaleness && <p className="text-sm text-amber-200">{audit.businessContextStaleness}</p>}
          {audit.businessContext.context ? <dl className="grid gap-3 sm:grid-cols-2">
            {projectContextEntries(audit.businessContext.context).map(([label, value]) => <div key={label} className="min-w-0">
              <dt className="text-xs text-zinc-400">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{value || "Not provided"}</dd>
            </div>)}
          </dl> : <p className="text-sm text-amber-200">{audit.businessContext.source === "unavailable"
            ? "Could not load the exact brand context. No legacy fallback is used." : "No context saved for this brand. No legacy fallback is used."}</p>}
          <Link href={`/onboarding?brand=${encodeURIComponent(brandId)}`} className="inline-block text-sm text-blue-300 underline">Review / edit saved brand context</Link>
        </section>

        <section className={section} aria-label="Audit performance summary">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Data quality & account coverage</h2>
            <span className="rounded-md bg-amber-400/10 px-3 py-1 text-sm text-amber-200">{audit.verdict === "blocked" ? "Blocked — resolve evidence gaps" : "Review — provisional stored evidence"}</span>
          </div>
          <p className="text-sm text-zinc-400">{audit.inventoryTotals.campaigns} inventory campaigns · {audit.inventoryTotals.active} active status (not serving proof) · {audit.inventoryTotals.storedMetricCampaigns} with stored metrics · {audit.inventoryTotals.unverifiedCampaigns} without window metrics.</p>
          <p className="text-xs text-zinc-400">{audit.coverage}. No native reconciliation or purchase-only conversion verification is claimed. Read-only reporting does not run Sync.</p>
          {!audit.summaries.length ? <p>Performance: Unverified. Missing observations or limited rows are not measured zero.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm" aria-label="Stored performance comparison">
              <caption className="pb-3 text-left text-xs text-zinc-400">Stored metric subset, separated by currency. Attributed value ≠ store revenue or incremental profit. Ratios are recomputed from sums.</caption>
              <thead><tr>{["Currency", "Spend", "Attributed value", "Conversions", "ROAS", "Baseline ROAS", "CPA", "CTR"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead>
              <tbody>{audit.summaries.map(s => <tr key={s.currency} className="border-t border-white/10">
                <td className="p-2">{s.currency}</td><td className="p-2">{fmt(s.spend)}</td><td className="p-2">{fmt(s.value)}</td><td className="p-2">{fmt(s.conversions)}</td>
                <td className="p-2">{fmt(s.roas, "x")}</td><td className="p-2">{fmt(s.previous?.roas ?? null, "x")}</td><td className="p-2">{fmt(s.cpa)}</td><td className="p-2">{fmt(s.ctr, "%")}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>

        <section className={section} aria-label="KPI definitions and availability">
          <h2 className="text-lg font-semibold">KPI definitions and availability</h2>
          <p className="text-sm text-zinc-400">Objective-aware measurement inventory, not validated targets or campaign recommendations. Stored subset ≠ provider-complete coverage. Missing denominators stay Unverified.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm" aria-label="Objective KPI availability">
            <thead><tr>{["KPI / role", "Availability", "Current / baseline", "Definition & limitation"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead>
            <tbody>{audit.kpis.map(k => <tr key={k.id} className="border-t border-white/10 align-top">
              <td className="p-2"><p>{k.label}</p><p className="text-xs text-zinc-500">{k.role}</p></td>
              <td className="p-2 text-amber-200">{k.status}</td>
              <td className="p-2">{k.values.length ? k.values.map(v => <p key={v.currency}>{v.currency}: {fmt(v.current)} / {fmt(v.baseline)}</p>) : "Unverified"}</td>
              <td className="max-w-md p-2"><p>{k.formula}</p><p className="text-xs text-zinc-400">{k.caveat}</p></td>
            </tr>)}</tbody>
          </table></div>
          <p className="text-xs text-zinc-400">Reference documentation for conversion/reach definitions, not account-coverage proof. Google-specific eligibility/retention limits do not automatically apply to Meta or TikTok.</p>
          <div className="flex flex-wrap gap-3 text-xs">{AUDIT_KPI_REFERENCES.map(s => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">{s.label}</a>)}</div>
        </section>

        {chartRows.length > 0 && !audit.truncated && <section className={section}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recorded spend by campaign</h2>
            <select className={control} aria-label="Chart currency" value={chartCurrency} onChange={e => setChartSelection({ scope: chartScope, currency: e.target.value })}>
              {currencies.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-xs text-zinc-400">Up to 8 highest-spend stored campaigns · {chartCurrency} · selected current window. Not a winner ranking.</p>
          <div className="h-72 w-full" role="img" aria-label={`Campaign recorded spend in ${chartCurrency}; exact values in inventory table`}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} margin={{ bottom: 24, left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 10 }} tickFormatter={(v: string) => v.length > 18 ? `${v.slice(0, 18)}…` : v} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} domain={[0, "auto"]} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #475569", color: "#fff" }} formatter={value => [fmt(Number(value)), `Spend (${chartCurrency})`]} />
              <Bar dataKey="spend" fill="#60a5fa" />
            </BarChart></ResponsiveContainer>
          </div>
        </section>}

        <section className={section}>
          <h2 className="text-lg font-semibold">Findings & anomalies</h2>
          <p className="text-xs text-zinc-400">Observed data issues and provisional watch rules. No causal claim, automatic pause or automatic budget change.</p>
          <div className="grid gap-3 md:grid-cols-2">{audit.findings.map(f => <article key={f.id} className="rounded-xl border border-white/10 p-4 space-y-2">
            <p className="text-xs uppercase text-amber-200">{f.severity} · {f.confidence}</p>
            <h3 className="font-medium">{f.title}</h3>{f.campaignName && <p className="break-words text-sm text-blue-200">{f.campaignName}</p>}
            <p className="text-sm text-zinc-400">{f.evidence}</p><p className="text-sm">Next investigation: {f.nextStep}</p>
          </article>)}</div>
        </section>

        <section className={section}>
          <h2 className="text-lg font-semibold">Calendar & seasonal planning</h2>
          <p>{audit.calendar.asOf} · {audit.calendar.season}</p><p className="text-sm text-zinc-400">{audit.calendar.basis}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">{audit.calendar.prompts.map(p => <li key={p}>{p}</li>)}</ul>
        </section>

        <section className={section}>
          <h2 className="text-lg font-semibold">Objective strategy</h2><p>{audit.strategy.question}</p>
          <div className="grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 font-medium">Required business evidence</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">{audit.strategy.requiredEvidence.map(p => <li key={p}>{p}</li>)}</ul></div>
            <div><h3 className="mb-2 font-medium">Next investigation / test design</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">{audit.strategy.nextSteps.map(p => <li key={p}>{p}</li>)}</ol></div></div>
        </section>

        {audit.adaptation && <GoogleCampaignAdaptationReview review={audit.adaptation} />}

        <section className={section}>
          <h2 className="text-lg font-semibold">Account inventory</h2>
          {audit.truncated && <p className="text-amber-200">Limited row subset. Account performance totals/comparisons are withheld.</p>}
          <p className="text-xs text-zinc-400">All {audit.inventory.length} loaded records are retained. Scroll within the table to inspect inventory; the Markdown export includes every loaded record.</p>
          <div className="max-h-96 overflow-auto rounded-lg border border-white/10" tabIndex={0} role="region" aria-label="Scrollable campaign inventory"><table className="w-full min-w-[820px] text-left text-sm" aria-label="Account campaign inventory">
            <thead className="sticky top-0 bg-zinc-900"><tr>{["Campaign / ID", "Status", "Objective", "Currency", "Spend", "ROAS", "Metric state"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead>
            <tbody>{audit.inventory.map(r => <tr key={r.id} className="border-t border-white/10">
              <td className="p-2"><p className="max-w-xs break-words">{r.name}</p><p className="text-xs text-zinc-500">{r.campaignId}</p></td>
              <td className="p-2">{r.status}</td><td className="p-2">{r.objective}</td><td className="p-2">{r.currency}</td>
              <td className="p-2">{fmt(r.spend)}</td><td className="p-2">{fmt(r.roas, "x")}</td><td className="p-2">{r.metricState === "stored_metrics" ? "Stored" : "Unverified"}</td>
            </tr>)}</tbody>
          </table></div>
        </section>

        <section className={section}>
          <h2 className="text-lg font-semibold">Unavailable evidence</h2>
          <p className="text-sm text-zinc-400">These datasets are not loaded by this desk. Generic conversion totals do not validate purchases, profitable acquisition, brand lift or qualified wholesale buyers.</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">{audit.unavailableEvidence.map(p => <li key={p}>{p}</li>)}</ul>
        </section>

        {platform === "google" && brandId && <GoogleResearchDesk key={JSON.stringify({brandId,accountId,market,goal,window,comparison})}
          brandId={brandId} adAccountId={accountId} providerAccountId={account?.accountId} market={market} goal={goal} window={window} comparison={comparison} />}

        <section className={section}>
          <h2 className="text-lg font-semibold">Decision plan</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">{audit.decisionPlan.map(p => <li key={p}>{p}</li>)}</ol>
          <div className="flex flex-wrap items-center gap-4"><button disabled className={`${control} opacity-40`}>Campaign activation locked</button>
            <Link href="/connections" className="text-sm text-blue-300 underline">Review connector coverage</Link>
            <Link href="/campaigns" className="text-sm text-blue-300 underline">Inspect campaigns</Link>
          </div>
        </section>
      </>}
    </div>
  );
}
