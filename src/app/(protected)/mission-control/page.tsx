"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  DollarSign, Target, UserPlus, Crown, Gauge, Megaphone,
  MousePointerClick, CreditCard, AlertOctagon, AlertTriangle,
  Info, CheckCircle2, Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedSection, StaggerContainer, fadeInUp } from "@/components/ui/animated-section";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { api } from "@/lib/trpc/react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { mergeConnectedPaidPlatforms } from "@/lib/paid-ad-metrics";
import { asClockNumber, buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";

// Demo workspace only — never render these on a live shop.
const DEMO_EXEC_KPIS = [
  { label: "Revenue (30d)", value: 1.24, prefix: "€", suffix: "M", decimals: 2, delta: "+18.2%", positive: true, icon: DollarSign, color: "#10B981" },
  { label: "ROAS", value: 4.62, prefix: "", suffix: "x", decimals: 2, delta: "+0.34", positive: true, icon: Target, color: "#38BDF8" },
  { label: "CAC", value: 23.4, prefix: "€", suffix: "", decimals: 2, delta: "-6.1%", positive: true, icon: UserPlus, color: "#F59E0B" },
  { label: "LTV", value: 847, prefix: "€", suffix: "", decimals: 0, delta: "+5.4%", positive: true, icon: Crown, color: "#8B5CF6" },
  { label: "MER", value: 3.84, prefix: "", suffix: "x", decimals: 2, delta: "+0.21", positive: true, icon: Gauge, color: "#22D3EE" },
  { label: "Active Campaigns", value: 23, prefix: "", suffix: "", decimals: 0, delta: "+4 this week", positive: true, icon: Megaphone, color: "#F43F5E" },
  { label: "Conversion Rate", value: 3.42, prefix: "", suffix: "%", decimals: 2, delta: "+0.3pp", positive: true, icon: MousePointerClick, color: "#F97316" },
  { label: "Ad Spend (30d)", value: 268, prefix: "€", suffix: "K", decimals: 0, delta: "+12.8%", positive: false, icon: CreditCard, color: "#A78BFA" },
];

const DEMO_PLATFORM_HEALTH = [
  { name: "Meta", color: "#1877F2", score: 92, status: "Excellent", note: "CTR +14% WoW · frequency healthy at 2.3" },
  { name: "Google", color: "#4285F4", score: 87, status: "Good", note: "Impression share 61% · avg QS 8.2" },
  { name: "TikTok", color: "#FF0050", score: 78, status: "Watch", note: "CPA +9% over target — spend capped" },
];

const DEMO_RADAR_DATA = [
  { metric: "ROAS", Meta: 82, Google: 90, TikTok: 64 },
  { metric: "CTR", Meta: 74, Google: 66, TikTok: 88 },
  { metric: "CVR", Meta: 68, Google: 78, TikTok: 54 },
  { metric: "Reach", Meta: 88, Google: 72, TikTok: 92 },
  { metric: "Frequency", Meta: 58, Google: 46, TikTok: 70 },
  { metric: "Efficiency", Meta: 80, Google: 86, TikTok: 62 },
];

const SEVERITY = {
  critical: { icon: AlertOctagon, color: "#F43F5E", chip: "border-rose-500/20 bg-rose-500/10 text-rose-400" },
  warning: { icon: AlertTriangle, color: "#F59E0B", chip: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  info: { icon: Info, color: "#38BDF8", chip: "border-sky-500/20 bg-sky-500/10 text-sky-400" },
  success: { icon: CheckCircle2, color: "#10B981", chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
} as const;

const PLATFORM_COLORS: Record<string, string> = {
  Meta: "#1877F2", Google: "#4285F4", TikTok: "#FF0050", WooCommerce: "#96588A", System: "#A1A1AA",
};

const DEMO_ALERTS = [
  { severity: "critical" as const, message: "TikTok CPA exceeded target by 9% — Budget Allocator capped spend", platform: "TikTok", time: "2 min ago" },
  { severity: "warning" as const, message: "Creative fatigue detected on Meta ad set \u201CSS26-Launch\u201D", platform: "Meta", time: "18 min ago" },
  { severity: "info" as const, message: "Google Shopping feed synced — 1,204 products live", platform: "Google", time: "1 hr ago" },
  { severity: "success" as const, message: "High-Value segment synced from WooCommerce — 34,012 customers", platform: "WooCommerce", time: "2 hr ago" },
  { severity: "success" as const, message: "Weekly investor report generated and delivered", platform: "System", time: "6 hr ago" },
];

function RingGauge({ value, color, size = 118, stroke = 9 }: { value: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
          viewport={{ once: true }} transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white"><AnimatedCounter target={value} suffix="%" className="tabular-nums" /></span>
      </div>
    </div>
  );
}

export default function MissionControlPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { symbol, format, currency } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  // Real orgs: blended performance, account summary and triggered alerts.
  const dateRange = useIsoDateRange(30);
  const datesValid = dateRange.startDate !== "";
  const liveReady = !isDemo && !isLoading && datesValid && shopReady;
  const perfQuery = api.marketing.getBlendedPerformance.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false },
  );
  const accountQuery = api.marketing.getAccountSummary.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false },
  );
  const alertsQuery = api.alerts.listTriggered.useQuery(undefined, {
    enabled: !isDemo && !isLoading,
    retry: false,
  });
  const fatigueQuery = api.marketing.getCreativeFatigue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const emailQuery = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const syncStatusQuery = api.syncStatus.getStatus.useQuery(brandId ? { brandId } : {}, {
    enabled: liveReady,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Real workspace: live blended performance + account health + alerts
  // -------------------------------------------------------------------------
  if (!isDemo) {
    const totals = perfQuery.data?.data?.totals;
    const timeseries = perfQuery.data?.data?.timeseries ?? [];
    const accounts = accountQuery.data?.data?.accounts ?? [];
    const alerts = alertsQuery.data ?? [];
    const loading = !shopReady || perfQuery.isLoading || accountQuery.isLoading || alertsQuery.isLoading;
    const mer = merQuery.data?.data;
    const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailQuery);
    const { clocks, blockers, pixelSpend, pixelValue, pixelConversions, pixelRoas } = buildOperatorDesk({
      totals,
      mer,
      ga4: ga4Mix.data?.data,
      gsc: gscQuery.data,
      email: emailQuery.data?.data,
      googleAdsConnected: mergeConnectedPaidPlatforms(
        (syncStatusQuery.data?.platforms ?? []).map((p) => p.platform),
        accounts.map((a: { platform?: string | null }) => a.platform ?? ""),
      ).includes("google"),
      googleAdsSpend: accounts
        .filter((a: { platform?: string | null }) => (a.platform ?? "").toLowerCase() === "google")
        .reduce((sum: number, a: { totalSpend?: number | null }) => sum + asClockNumber(a.totalSpend), 0),
      currency,
    });

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400" />
        </div>
      );
    }

    const kpis =
      pixelSpend > 0 || pixelConversions > 0 || asClockNumber(totals?.totalImpressions) > 0
        ? [
            { label: "Ad Spend (30d)", display: format(pixelSpend), icon: CreditCard, color: "#A78BFA" },
            { label: "Pixel conversion value", display: format(pixelValue), icon: DollarSign, color: "#10B981" },
            { label: "Pixel ROAS", display: `${pixelRoas.toFixed(2)}x`, icon: Target, color: "#38BDF8" },
            { label: "Impressions", display: asClockNumber(totals?.totalImpressions).toLocaleString("en-US"), icon: Activity, color: "#F43F5E" },
            { label: "Clicks", display: asClockNumber(totals?.totalClicks).toLocaleString("en-US"), icon: MousePointerClick, color: "#F97316" },
            { label: "CTR", display: `${asClockNumber(totals?.blendedCTR).toFixed(2)}%`, icon: Gauge, color: "#22D3EE" },
            { label: "Pixel conversions", display: pixelConversions.toFixed(0), icon: CheckCircle2, color: "#F59E0B" },
            {
              label: "CPC",
              display: format(
                asClockNumber(totals?.blendedCPC) ||
                  (asClockNumber(totals?.totalClicks) > 0 ? pixelSpend / asClockNumber(totals?.totalClicks) : 0),
                { maximumFractionDigits: 2, minimumFractionDigits: 2 },
              ),
              icon: Crown,
              color: "#8B5CF6",
            },
          ]
        : [];

    const chartData = timeseries.map((d) => ({
      ...d,
      label: d.date.slice(5),
    }));

    return (
      <div className="relative">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl space-y-6 px-1">
          {/* Header */}
          <AnimatedSection>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-400" />
                  <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Blended performance · last 30 days</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight"><span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Mission Control</span></h1>
                <p className="text-sm text-zinc-400">Five clocks — pixel, till, GA4, Search Console, email. Do not add them.</p>
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold tracking-widest text-rose-300">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-rose-400" /></span>
                LIVE
              </span>
            </div>
          </AnimatedSection>

          <FiveClockStrip clocks={clocks} ready={deskReady} />
          <OperatorBlockerBoard blockers={blockers} ready={deskReady} />

          {/* KPI grid */}
          {kpis.length > 0 ? (
            <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <motion.div key={kpi.label} variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-colors hover:border-white/20">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}20` }}>
                        <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-white">{kpi.display}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">{kpi.label}</p>
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: kpi.color }} />
                  </motion.div>
                );
              })}
            </StaggerContainer>
          ) : (
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
                <p className="text-sm text-zinc-400">No synced performance data yet — connect an ad account from Connections and run a sync.</p>
              </div>
            </AnimatedSection>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnimatedSection>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-cyan-400" />
                    <h2 className="text-sm font-semibold text-white">Store MER</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/realtime" className="text-[11px] text-sky-300 hover:underline">
                      Realtime
                    </Link>
                    <Link href="/connections?connect=woocommerce" className="text-[11px] text-sky-300 hover:underline">
                      WooCommerce
                    </Link>
                  </div>
                </div>
                {merQuery.data?.data && merQuery.data.data.orderCount > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{merQuery.data.data.mer.toFixed(2)}x</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Store MER</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{(merQuery.data.data.amer ?? 0).toFixed(2)}x</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">aMER</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{format(merQuery.data.data.totalRevenue)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Store revenue</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{merQuery.data.data.orderCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Store orders</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{(merQuery.data.data.pixelConversions ?? totals?.totalConversions ?? 0).toFixed(0)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pixel conversions</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white tabular-nums">{(ga4Mix.data?.data?.totals.purchases ?? 0).toLocaleString("en-US")}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">GA4 purchases</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Connect WooCommerce to compare Meta spend against real store orders. Pixel ROAS alone is not MER.
                  </p>
                )}
              </div>
            </AnimatedSection>
            <AnimatedSection delay={0.08}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-white">Creative ops</h2>
                  </div>
                  <Link href="/creative-fatigue" className="text-[11px] text-sky-300 hover:underline">
                    Open desk
                  </Link>
                </div>
                {fatigueQuery.data?.ads.length ? (
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-white">
                      {fatigueQuery.data.health?.grade ?? "—"}
                      <span className="ml-2 text-sm font-medium text-zinc-400">{fatigueQuery.data.health?.score ?? 0}/100</span>
                    </p>
                    <p className="text-[12px] text-zinc-400">
                      {fatigueQuery.data.inbox[0]?.title ?? "No urgent inbox item"} · CPA watch {format(fatigueQuery.data.kpis.cpaWatchSpend)}
                    </p>
                    <p className="text-[11px] text-zinc-500">{fatigueQuery.data.inbox[0]?.why}</p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Creative Fatigue will score Meta ads once the Graph sync returns delivery.</p>
                )}
              </div>
            </AnimatedSection>
          </div>

          {/* Spend vs conversion value timeseries */}
          {chartData.length > 0 && (
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-orange-400" />
                  <h2 className="text-sm font-semibold text-white/80">Spend vs Pixel Conversion Value</h2>
                </div>
                <p className="text-xs text-zinc-400">Daily paid-ad totals — not store net, not GA4 revenue</p>
                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="mcSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="mcValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(9,9,11,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="totalSpend" name="Spend" stroke="#F43F5E" fill="url(#mcSpend)" strokeWidth={2} />
                      <Area type="monotone" dataKey="totalConversionValue" name="Conversion Value" stroke="#10B981" fill="url(#mcValue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Account health + alert feed */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <AnimatedSection className="lg:col-span-7">
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-rose-400" />
                    <h2 className="text-sm font-semibold text-white/80">Account Health</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/50">{accounts.length} ACCOUNT{accounts.length !== 1 ? "S" : ""}</span>
                </div>
                {accounts.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-400">No ad accounts connected yet.</p>
                ) : (
                  <div className="space-y-3">
                    {accounts.map((a, i) => {
                      const platformKey = a.platform.charAt(0).toUpperCase() + a.platform.slice(1);
                      const color = PLATFORM_COLORS[platformKey] ?? "#A1A1AA";
                      return (
                        <motion.div
                          key={a.adAccountId}
                          initial={{ opacity: 0, y: 24 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.08 }}
                          className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                              <p className="truncate text-sm font-bold text-white">{a.name || `${platformKey} account`}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${a.roas >= 3 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : a.roas >= 1.5 ? "border-sky-500/20 bg-sky-500/10 text-sky-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
                              Pixel ROAS {a.roas.toFixed(2)}x
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                            <div><p className="text-xs font-bold text-white tabular-nums">{format(a.totalSpend)}</p><p className="text-[9px] uppercase tracking-wider text-white/30">Spend</p></div>
                            <div><p className="text-xs font-bold text-white tabular-nums">{a.totalClicks.toLocaleString()}</p><p className="text-[9px] uppercase tracking-wider text-white/30">Clicks</p></div>
                            <div><p className="text-xs font-bold text-white tabular-nums">{a.ctr.toFixed(2)}%</p><p className="text-[9px] uppercase tracking-wider text-white/30">CTR</p></div>
                            <div><p className="text-xs font-bold text-white tabular-nums">{a.totalConversions.toLocaleString()}</p><p className="text-[9px] uppercase tracking-wider text-white/30">Pixel conv.</p></div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </AnimatedSection>

            <AnimatedSection className="lg:col-span-5" delay={0.1}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-rose-400" />
                    <h2 className="text-sm font-semibold text-white/80">Recent Alerts</h2>
                  </div>
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">{alerts.length}</span>
                </div>
                {alerts.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-400">No alerts yet. Configure budget rules under Budget Alerts.</p>
                ) : (
                  <div className="space-y-2.5">
                    {alerts.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: 24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                        className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3.5 transition-colors hover:border-white/10"
                      >
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${a.isRead ? "border-sky-500/20 bg-sky-500/10 text-sky-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug text-white/85">{a.title}</p>
                          <p className="mt-1 text-[11px] leading-snug text-zinc-400">{a.message}</p>
                          <span className="mt-1.5 block text-[10px] text-white/30">
                            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Demo workspace · €1.24M / 4.62x ROAS are sample theater. Switch to a live shop for BAGTOBAG clocks.
        </div>
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Executive command center</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight"><span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Mission Control</span></h1>
              <p className="text-sm text-zinc-400">Demo workspace theater — StyleVault sample KPIs, not BAGTOBAG live clocks.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
                Sample theater
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold tracking-widest text-amber-300">
                DEMO
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Executive KPI grid */}
        <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DEMO_EXEC_KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <motion.div key={kpi.label} variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-colors hover:border-white/20">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}20` }}>
                    <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kpi.positive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{kpi.delta}</span>
                </div>
                <p className="text-2xl font-bold text-white"><AnimatedCounter target={kpi.value} prefix={kpi.prefix === "€" ? symbol : kpi.prefix} suffix={kpi.suffix} decimals={kpi.decimals} className="tabular-nums" /></p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{kpi.label}</p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: kpi.color }} />
              </motion.div>
            );
          })}
        </StaggerContainer>

        {/* Platform health gauges */}
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-rose-400" />
                  <h2 className="text-sm font-semibold text-white/80">Platform Health Scores</h2>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Weighted across spend efficiency, delivery and creative freshness</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/50">UPDATED 2 MIN AGO</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {DEMO_PLATFORM_HEALTH.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                  className="flex flex-col items-center rounded-xl border border-white/5 bg-white/[0.03] p-5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-bold text-white">{p.name}</span>
                  </div>
                  <RingGauge value={p.score} color={p.color} />
                  <span className={`mt-3 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${p.score >= 90 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : p.score >= 80 ? "border-sky-500/20 bg-sky-500/10 text-sky-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>{p.status}</span>
                  <p className="mt-2.5 text-center text-[11px] leading-snug text-zinc-400">{p.note}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Cross-channel radar + alert feed */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnimatedSection className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-white/80">Cross-Channel Radar</h2>
              </div>
              <p className="text-xs text-zinc-400">Normalized performance index (0–100) across six dimensions</p>
              <div className="mt-2 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={DEMO_RADAR_DATA} outerRadius="72%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "rgba(9,9,11,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Radar name="Meta" dataKey="Meta" stroke="#1877F2" fill="#1877F2" fillOpacity={0.16} strokeWidth={2} />
                    <Radar name="Google" dataKey="Google" stroke="#4285F4" fill="#4285F4" fillOpacity={0.16} strokeWidth={2} />
                    <Radar name="TikTok" dataKey="TikTok" stroke="#FF0050" fill="#FF0050" fillOpacity={0.16} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AnimatedSection>
          <AnimatedSection className="lg:col-span-5" delay={0.1}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-400" />
                  <h2 className="text-sm font-semibold text-white/80">Real-Time Alerts</h2>
                </div>
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">5 TODAY</span>
              </div>
              <div className="space-y-2.5">
                {DEMO_ALERTS.map((a, i) => {
                  const sev = SEVERITY[a.severity];
                  const Icon = sev.icon;
                  return (
                    <motion.div
                      key={a.message}
                      initial={{ opacity: 0, x: 24 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
                      className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3.5 transition-colors hover:border-white/10"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${sev.chip}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug text-white/85">{a.message}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[a.platform] }} />
                            {a.platform}
                          </span>
                          <span className="text-[10px] text-white/30">{a.time}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
