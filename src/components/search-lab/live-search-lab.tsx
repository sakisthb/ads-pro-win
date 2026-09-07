"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Search,
} from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import type { SiteSeoCheck, SiteSeoPage, SiteSeoReport, SiteSeoStatus } from "@/lib/site-seo";
import type { GscDemandRow, GscPositionBand } from "@/lib/gsc";
import {
  ga4DeskLabel,
  isGa4GenerativeChannel,
  isGa4OrganicSearchChannel,
  type Ga4DeskDay,
} from "@/lib/ga4-shared";

type GscDeskData = {
  connected: boolean;
  siteName: string | null;
  lastSyncAt: string | null;
  queryLookbackDays: number;
  totals: { clicks: number; impressions: number; ctr: number; avgPosition: number | null };
  days: Array<{ date: string; clicks: number; impressions: number; position: number | null }>;
  queries: GscDemandRow[];
  answerQueries: GscDemandRow[];
  unseenAnswerQueries: GscDemandRow[];
  positionBands: GscPositionBand[];
  queryCount: number;
};

type Ga4ChannelRow = {
  channel: string;
  sessions: number;
  views: number;
  purchases: number;
  revenue: number;
};

type Ga4MixData = {
  connected: boolean;
  propertyName: string | null;
  lastSyncAt: string | null;
  channels: Ga4ChannelRow[];
  totals: { sessions: number; views: number; keyEvents: number; revenue: number; purchases: number };
  organicDays: Ga4DeskDay[];
  generativeDays: Ga4DeskDay[];
};

export type SearchDesk = "seo" | "geo" | "aeo";

const CHECK_TONE: Record<SiteSeoStatus, string> = {
  pass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  fail: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtPos = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) || n <= 0 ? "—" : n.toFixed(1);
const fmtUtc = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : null;

function readDesk(): SearchDesk {
  if (typeof window === "undefined") return "seo";
  const value = new URLSearchParams(window.location.search).get("desk");
  return value === "geo" || value === "aeo" || value === "seo" ? value : "seo";
}

function writeDesk(desk: SearchDesk) {
  const url = new URL(window.location.href);
  url.searchParams.set("desk", desk);
  window.history.replaceState({}, "", url);
}

function ScoreGauge({ score }: { score: number }) {
  const R = 84, CX = 110, CY = 104;
  const angle = Math.PI * (score / 100);
  const x = CX - R * Math.cos(angle);
  const y = CY - R * Math.sin(angle);
  return (
    <div className="relative mx-auto w-[220px]">
      <svg viewBox="0 0 220 122" className="w-full">
        <defs>
          <linearGradient id="seoGaugeGradLive" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} strokeLinecap="round" />
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="url(#seoGaugeGradLive)" strokeWidth={12} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-4xl font-bold text-white">
          <AnimatedCounter target={score} className="tabular-nums" />
          <span className="text-lg font-medium text-white/30">/100</span>
        </p>
      </div>
    </div>
  );
}

export function LiveSearchLab() {
  const { brands, brandId, setBrandId } = useActiveBrand();
  const { market } = useActiveMarket();
  const [desk, setDesk] = useState<SearchDesk>("seo");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });
  const [queryFilter, setQueryFilter] = useState("");

  useEffect(() => {
    setDesk(readDesk());
    setDateRange({ startDate: isoDaysAgo(28), endDate: todayIso() });
  }, []);

  const selectDesk = (next: SearchDesk) => {
    setDesk(next);
    writeDesk(next);
  };

  const datesValid = dateRange.startDate !== "";
  const shopQuery = withMarketQuery(brandId, market);
  const seoQuery = api.marketing.getSiteSeoAudit.useQuery(
    { brandId: brandId || undefined },
    { enabled: Boolean(brandId), retry: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      queryLimit: 80,
      ...shopQuery,
    },
    { enabled: datesValid && Boolean(brandId), retry: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: datesValid && Boolean(brandId), retry: false },
  );

  const report = seoQuery.data as SiteSeoReport | undefined;
  const home = report?.homepage;
  const gsc = gscQuery.data as GscDeskData | undefined;
  const ga4 = ga4Mix.data?.data as Ga4MixData | undefined;
  const ga4Channels = ga4?.channels ?? [];
  const organic = ga4Channels.find((row) => isGa4OrganicSearchChannel(row.channel));
  const generative = ga4Channels.filter((row) => isGa4GenerativeChannel(row.channel));
  const geoSessions = generative.reduce((sum, row) => sum + row.sessions, 0);
  const geoPurchases = generative.reduce((sum, row) => sum + row.purchases, 0);
  const geoRevenue = generative.reduce((sum, row) => sum + row.revenue, 0);
  const answerQueries = gsc?.answerQueries ?? [];
  const unseenAnswers = gsc?.unseenAnswerQueries ?? [];
  const filteredQueries = useMemo(() => {
    const q = queryFilter.trim().toLowerCase();
    const rows = gsc?.queries ?? [];
    if (!q) return rows;
    return rows.filter((row) => row.query.toLowerCase().includes(q));
  }, [gsc?.queries, queryFilter]);

  const seoChecks = (report?.checks ?? []).filter(
    (row) => !["aeo-schema", "geo-crawlers", "geo-llms"].includes(row.id),
  );
  const geoChecks = (report?.checks ?? []).filter((row) => row.id.startsWith("geo-"));
  const aeoChecks = (report?.checks ?? []).filter((row) => row.id === "aeo-schema");

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <AnimatedSection>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                  Search Lab · SEO · GEO · AEO
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Search Lab
                </span>
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400">
                SEO is Search Console. GEO is GA4 generative sessions plus llms.txt. AEO is question-shaped queries and FAQ schema.
                None of these is Google Ads, keyword volume, or a ChatGPT rank.
              </p>
              <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker
                value={datesValid ? dateRange : { startDate: isoDaysAgo(28), endDate: todayIso() }}
                onChange={setDateRange}
                presets={[7, 28, 90, 180]}
              />
              {report?.url && (
                <a
                  href={report.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 hover:border-white/20"
                >
                  Open site
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </AnimatedSection>

        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => selectDesk("seo")} className="text-left">
            <DeskStat
              active={desk === "seo"}
              label="SEO · Search Console"
              value={gsc?.connected ? fmtInt(gsc.totals.clicks) : "—"}
              hint={
                gsc?.connected
                  ? `${fmtInt(gsc.totals.impressions)} impressions · CTR ${gsc.totals.ctr.toFixed(1)}% · avg pos ${fmtPos(gsc.totals.avgPosition)}`
                  : "Connect Search Console, pick the shop property, Sync Now."
              }
            />
          </button>
          <button type="button" onClick={() => selectDesk("geo")} className="text-left">
            <DeskStat
              active={desk === "geo"}
              label="GEO · GA4 generative"
              value={fmtInt(geoSessions)}
              hint={
                generative.length > 0
                  ? `${generative.map((row) => row.channel).join(", ")} · ${fmtInt(geoPurchases)} GA4 purchases · not ChatGPT rankings`
                  : ga4?.connected
                    ? "No AI Assistant / Organic AI sessions in this GA4 window."
                    : "Connect GA4 and pick the property."
              }
            />
          </button>
          <button type="button" onClick={() => selectDesk("aeo")} className="text-left">
            <DeskStat
              active={desk === "aeo"}
              label="AEO · question queries"
              value={fmtInt(answerQueries.length)}
              hint={
                answerQueries.length > 0
                  ? `${fmtInt(answerQueries.reduce((sum, row) => sum + row.clicks, 0))} clicks on question-shaped queries. Not a featured-snippet tracker.`
                  : "No question-shaped GSC queries in this window."
              }
            />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "seo" as const, label: "SEO", icon: Search },
              { id: "geo" as const, label: "GEO", icon: Bot },
              { id: "aeo" as const, label: "AEO", icon: HelpCircle },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = desk === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectDesk(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {desk === "seo" && (
          <SeoDesk
            gsc={gsc}
            gscLoading={gscQuery.isLoading}
            report={report}
            home={home}
            seoChecks={seoChecks}
            seoQueryError={seoQuery.error?.message ?? null}
            seoQueryLoading={seoQuery.isLoading}
            filteredQueries={filteredQueries}
            queryFilter={queryFilter}
            setQueryFilter={setQueryFilter}
          />
        )}
        {desk === "geo" && (
          <GeoDesk
            ga4={ga4}
            ga4Loading={ga4Mix.isLoading}
            report={report}
            organic={organic}
            generative={generative}
            geoSessions={geoSessions}
            geoPurchases={geoPurchases}
            geoRevenue={geoRevenue}
            geoChecks={geoChecks}
            channels={ga4Channels}
          />
        )}
        {desk === "aeo" && (
          <AeoDesk
            gsc={gsc}
            report={report}
            answerQueries={answerQueries}
            unseenAnswers={unseenAnswers}
            aeoChecks={aeoChecks}
          />
        )}
      </div>
    </div>
  );
}

function DeskStat({
  label,
  value,
  hint,
  active,
}: {
  label: string;
  value: string;
  hint: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/5 bg-white/[0.03] hover:border-white/15"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function SeoDesk({
  gsc,
  gscLoading,
  report,
  home,
  seoChecks,
  seoQueryError,
  seoQueryLoading,
  filteredQueries,
  queryFilter,
  setQueryFilter,
}: {
  gsc: GscDeskData | undefined;
  gscLoading: boolean;
  report: SiteSeoReport | undefined;
  home: SiteSeoPage | null | undefined;
  seoChecks: SiteSeoCheck[];
  seoQueryError: string | null;
  seoQueryLoading: boolean;
  filteredQueries: GscDemandRow[];
  queryFilter: string;
  setQueryFilter: (value: string) => void;
}) {
  return (
    <>
      {gscLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-400" />
        </div>
      ) : !gsc?.connected ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          Search Console is not connected on this shop.{" "}
          <Link href="/connections#google-search-console" className="font-semibold text-emerald-300">
            Open Connections
          </Link>
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {gsc.siteName} · last sync {fmtUtc(gsc.lastSyncAt) ?? "unknown"} · query pull is the last {gsc.queryLookbackDays} days of that sync. Position is impression-weighted. Not search volume.
          </p>
          {(gsc.days?.length ?? 0) > 1 && (
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-sm font-semibold text-white/80">Daily Search Console clicks</h2>
                <p className="mt-1 text-xs text-zinc-400">Site totals from GSC. A click here is not a GA4 session and not a Google Ads click.</p>
                <div className="mt-4 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={gsc.days} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gscClicksGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(`${v}T00:00:00Z`);
                          return Number.isNaN(d.getTime())
                            ? v
                            : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                        }}
                      />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(9,9,11,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#34D399" fill="url(#gscClicksGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#5EEAD4" fill="none" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedSection>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {(gsc.positionBands ?? []).map((band) => (
              <div key={band.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/30">{band.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{fmtInt(band.queries)}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {fmtInt(band.clicks)} clicks · {fmtInt(band.impressions)} impressions
                </p>
              </div>
            ))}
          </div>

          <AnimatedSection>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white/80">Queries</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Showing {filteredQueries.length} of {gsc.queryCount} rolled queries. Desk column is AEO only when the query is question-shaped.
                  </p>
                </div>
                <input
                  value={queryFilter}
                  onChange={(event) => setQueryFilter(event.target.value)}
                  placeholder="Filter queries"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
              </div>
              {filteredQueries.length === 0 ? (
                <p className="text-sm text-zinc-400">No query rows match this filter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-white/30">
                        <th className="pb-2 font-medium">Query</th>
                        <th className="pb-2 text-right font-medium">Clicks</th>
                        <th className="pb-2 text-right font-medium">Impressions</th>
                        <th className="pb-2 text-right font-medium">CTR</th>
                        <th className="pb-2 text-right font-medium">Pos</th>
                        <th className="pb-2 font-medium">Desk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueries.map((row) => (
                        <tr key={row.query} className="border-t border-white/5">
                          <td className="py-2 pr-3 text-white/80">{row.query}</td>
                          <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.clicks)}</td>
                          <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.impressions)}</td>
                          <td className="py-2 text-right tabular-nums text-white/70">{row.ctr.toFixed(1)}%</td>
                          <td className="py-2 text-right tabular-nums text-white/70">{fmtPos(row.position)}</td>
                          <td className="py-2 text-[11px] text-white/40">{row.answerShaped ? "AEO" : "SEO"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </AnimatedSection>
        </>
      )}

      {seoQueryLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-400" />
        </div>
      ) : seoQueryError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">
          On-site probe failed: {seoQueryError}
        </div>
      ) : !report ? null : (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <AnimatedSection className="lg:col-span-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-wider text-white/30">On-site score</p>
                <ScoreGauge score={report.score} />
                <p className="mt-2 text-center text-sm font-semibold text-white">Grade {report.grade}</p>
                <p className="mt-1 text-center text-[11px] text-zinc-400">{report.origin ?? "No shop URL"}</p>
              </div>
            </AnimatedSection>
            <AnimatedSection className="lg:col-span-8" delay={0.05}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white/80">On-site SEO checks</h2>
                </div>
                <div className="space-y-2">
                  {seoChecks.map((row) => (
                    <div key={row.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-white">{row.title}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${CHECK_TONE[row.status]}`}>
                          {row.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{row.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-teal-400" />
                  <h2 className="text-sm font-semibold text-white/80">Homepage tags</h2>
                </div>
                {home?.blocked && (
                  <p className="mb-3 flex items-start gap-2 text-xs text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Cloudflare challenged this server. Open {report.origin ?? "the shop"} in a browser for the real page.
                  </p>
                )}
                <dl className="grid gap-3 text-sm">
                  {[
                    ["Title", home?.title],
                    ["Meta description", home?.metaDescription],
                    ["H1", home?.h1],
                    ["Canonical", home?.canonical],
                    ["Lang", home?.lang],
                    ["og:title", home?.ogTitle],
                    ["Words", home?.wordCount != null ? String(home.wordCount) : null],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] uppercase tracking-wider text-white/30">{label}</dt>
                      <dd className="mt-0.5 text-white/80">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.05}>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-sm font-semibold text-white/80">robots.txt</h2>
                  <p className="mt-1 text-xs text-zinc-400">{report.robotsTxt.fetched ? "Fetched" : "Not fetched"}</p>
                  {report.robotsTxt.preview && (
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] text-zinc-400">
                      {report.robotsTxt.preview}
                    </pre>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h2 className="text-sm font-semibold text-white/80">sitemap.xml</h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    {report.sitemap.fetched
                      ? `${report.sitemap.urlCount} apex URLs (sample, en. host stripped)`
                      : "Not fetched"}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                    {report.sitemap.urls.slice(0, 12).map((url) => (
                      <li key={url} className="truncate font-mono">{url}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </>
      )}
    </>
  );
}

function GeoDesk({
  ga4,
  ga4Loading,
  report,
  organic,
  generative,
  geoSessions,
  geoPurchases,
  geoRevenue,
  geoChecks,
  channels,
}: {
  ga4: Ga4MixData | undefined;
  ga4Loading: boolean;
  report: SiteSeoReport | undefined;
  organic: Ga4ChannelRow | undefined;
  generative: Ga4ChannelRow[];
  geoSessions: number;
  geoPurchases: number;
  geoRevenue: number;
  geoChecks: SiteSeoCheck[];
  channels: Ga4ChannelRow[];
}) {
  const chartDays = (ga4?.organicDays ?? []).map((row) => ({
    date: row.date,
    organic: row.sessions,
    generative: ga4?.generativeDays?.find((geo) => geo.date === row.date)?.sessions ?? 0,
  }));
  const extraGeoDays = (ga4?.generativeDays ?? []).filter(
    (row) => !(ga4?.organicDays ?? []).some((organicDay) => organicDay.date === row.date),
  );
  const mergedDays = [
    ...chartDays,
    ...extraGeoDays.map((row) => ({ date: row.date, organic: 0, generative: row.sessions })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (ga4Loading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-zinc-500">
        {ga4?.connected
          ? `${ga4.propertyName ?? "GA4"} · last sync ${fmtUtc(ga4.lastSyncAt) ?? "unknown"}`
          : "GA4 is not connected on this shop."}{" "}
        GEO is sessions GA4 labelled AI Assistant / Organic AI. llms.txt is plumbing, not citations.
      </p>
      {!ga4?.connected ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          Connect Google Analytics and pick the property.{" "}
          <Link href="/connections#google-analytics" className="font-semibold text-emerald-300">
            Open Connections
          </Link>
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30">GEO sessions</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{fmtInt(geoSessions)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {fmtInt(geoPurchases)} GA4 purchases · {geoRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })} GA4 revenue
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30">Organic Search (SEO)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{fmtInt(organic?.sessions ?? 0)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {(organic?.purchases ?? 0).toLocaleString("en-US")} GA4 purchases · not Google Ads
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30">Share of site sessions</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {(ga4.totals.sessions ?? 0) > 0 ? `${((geoSessions / ga4.totals.sessions) * 100).toFixed(2)}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{fmtInt(ga4.totals.sessions)} GA4 sessions in window</p>
            </div>
          </div>

          {mergedDays.length > 1 && (
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-sm font-semibold text-white/80">Organic Search vs generative sessions</h2>
                <p className="mt-1 text-xs text-zinc-400">Two GA4 clocks. Do not add them. Do not treat either as Ads Pro spend.</p>
                <div className="mt-4 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mergedDays} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(`${v}T00:00:00Z`);
                          return Number.isNaN(d.getTime())
                            ? v
                            : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                        }}
                      />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(9,9,11,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Area type="monotone" dataKey="organic" name="Organic Search" stroke="#34D399" fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="generative" name="GEO" stroke="#A78BFA" fill="none" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedSection>
          )}

          <AnimatedSection>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <div className="border-b border-white/5 p-6 pb-4">
                <h2 className="text-sm font-semibold text-white/80">GA4 default channels</h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Desk is inferred from the GA4 channel name. Paid (GA4) is still not Ads Pro DailyMetric spend.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-white/30">
                      <th className="px-6 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Desk</th>
                      <th className="px-4 py-3 text-right font-medium">Sessions</th>
                      <th className="px-4 py-3 text-right font-medium">Purchases</th>
                      <th className="px-6 py-3 text-right font-medium">GA4 revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((row) => (
                      <tr key={row.channel} className="border-t border-white/5">
                        <td className="px-6 py-2.5 text-white/80">{row.channel}</td>
                        <td className="px-4 py-2.5 text-[11px] text-white/40">{ga4DeskLabel(row.channel)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtInt(row.sessions)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtInt(row.purchases)}</td>
                        <td className="px-6 py-2.5 text-right tabular-nums text-white/70">
                          {row.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </AnimatedSection>
        </>
      )}

      {report && (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatedSection>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white/80">llms.txt</h2>
              <p className="mt-1 text-xs text-zinc-400">
                {report.llmsTxt.fetched ? "Present — generative crawlers can read this file." : "Missing on this host. Optional. We will not invent Perplexity or ChatGPT rankings."}
              </p>
              {report.llmsTxt.preview ? (
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] text-zinc-400">
                  {report.llmsTxt.preview}
                </pre>
              ) : null}
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.05}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white/80">Named AI crawlers</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Unnamed bots follow User-agent: *. This is robots.txt, not a citation log.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {(report.aiCrawlers ?? []).map((row) => (
                  <li key={row.agent} className="flex items-center justify-between border-t border-white/5 pt-2 first:border-0 first:pt-0">
                    <span className="font-mono text-white/80">{row.agent}</span>
                    <span className="text-[11px] text-white/40">
                      {row.disallowAll == null ? "follows *" : row.disallowAll ? "blocked" : "allowed"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-2">
                {geoChecks.map((row) => (
                  <p key={row.id} className="text-xs text-zinc-500">{row.detail}</p>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      )}
    </>
  );
}

function AeoDesk({
  gsc,
  report,
  answerQueries,
  unseenAnswers,
  aeoChecks,
}: {
  gsc: GscDeskData | undefined;
  report: SiteSeoReport | undefined;
  answerQueries: GscDemandRow[];
  unseenAnswers: GscDemandRow[];
  aeoChecks: SiteSeoCheck[];
}) {
  const answerClicks = answerQueries.reduce((sum, row) => sum + row.clicks, 0);
  const answerImpressions = answerQueries.reduce((sum, row) => sum + row.impressions, 0);
  return (
    <>
      <p className="text-xs text-zinc-500">
        AEO here is question-shaped Search Console queries plus FAQ / Q&A / HowTo JSON-LD. It is not People Also Ask proof and not a featured-snippet tracker.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Question queries</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{fmtInt(answerQueries.length)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{fmtInt(answerClicks)} clicks · {fmtInt(answerImpressions)} impressions</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Seen, no click</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{fmtInt(unseenAnswers.length)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Question queries with ≥20 impressions and 0 clicks</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Homepage JSON-LD</p>
          <p className="mt-1 text-lg font-bold text-white">
            {(report?.jsonLdTypes.length ?? 0) > 0 ? report!.jsonLdTypes.join(", ") : "none"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">FAQPage / QAPage / HowTo would help answer engines</p>
        </div>
      </div>

      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-white/80">Question-shaped queries</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Detected from how / what / γιατί / πώς and similar. Branded head terms like “bag to bag” stay on the SEO tab.
          </p>
          {answerQueries.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">
              {gsc?.connected
                ? "No question-shaped queries in this GSC window. That is a real empty — we do not invent PAA."
                : "Connect Search Console to see question queries."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-white/30">
                    <th className="pb-2 font-medium">Query</th>
                    <th className="pb-2 text-right font-medium">Clicks</th>
                    <th className="pb-2 text-right font-medium">Impressions</th>
                    <th className="pb-2 text-right font-medium">CTR</th>
                    <th className="pb-2 text-right font-medium">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {answerQueries.map((row) => (
                    <tr key={row.query} className="border-t border-white/5">
                      <td className="py-2 pr-3 text-white/80">{row.query}</td>
                      <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.clicks)}</td>
                      <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.impressions)}</td>
                      <td className="py-2 text-right tabular-nums text-white/70">{row.ctr.toFixed(1)}%</td>
                      <td className="py-2 text-right tabular-nums text-white/70">{fmtPos(row.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AnimatedSection>

      {unseenAnswers.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-sm font-semibold text-white/80">Impressions without a click</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Google showed the shop for these questions. That is demand, not a snippet win.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {unseenAnswers.map((row) => (
                <li key={row.query} className="flex justify-between gap-3 border-t border-white/5 pt-2 first:border-0 first:pt-0">
                  <span>{row.query}</span>
                  <span className="shrink-0 tabular-nums text-white/50">
                    {fmtInt(row.impressions)} imp · pos {fmtPos(row.position)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AnimatedSection>
      )}

      {aeoChecks.map((row) => (
        <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-white">{row.title}</p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${CHECK_TONE[row.status]}`}>
              {row.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-400">{row.detail}</p>
        </div>
      ))}
    </>
  );
}
