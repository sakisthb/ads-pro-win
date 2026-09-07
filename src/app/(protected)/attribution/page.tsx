"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  TrendingUp, Zap, Brain, ArrowRight, DollarSign, Network,
  GitBranch, Activity, ArrowUpRight, ArrowDownRight, Sparkles,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  AnimatedSection,
  StaggerContainer,
  fadeInUp,
} from "@/components/ui/animated-section";
import {
  CardSkeleton,
  EmptyDataState,
  DataLoadingState,
} from "@/components/ui/data-state";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { api } from "@/lib/trpc/react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow, MarketSplitStrip } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { WOO_CHANNEL_COLOR } from "@/lib/woo-channels";
import { buildAttributionHonestyRecs } from "@/lib/dashboard-insights";
import { isGa4GenerativeChannel, isGa4OrganicSearchChannel } from "@/lib/ga4-shared";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";

// Platform config
const PLATFORMS = {
  meta: { name: "Meta", color: "#1877F2", icon: "\u{1F4D8}" },
  google: { name: "Google", color: "#4285F4", icon: "\u{1F50D}" },
  tiktok: { name: "TikTok", color: "#FF0050", icon: "\u{1F3B5}" },
} as const;

// Attribution models — UI config only
const MODELS = [
  { id: "last_touch", label: "Last Touch", description: "100% credit to final touchpoint before conversion" },
  { id: "first_touch", label: "First Touch", description: "100% credit to the first interaction in the journey" },
  { id: "linear", label: "Linear", description: "Equal credit distributed across all touchpoints" },
  { id: "time_decay", label: "Time Decay", description: "Exponential weight favoring recent touchpoints" },
  { id: "data_driven", label: "Data-Driven (AI)", description: "Credit weighted by each connected account's observed ROAS" },
] as const;

// ---------------------------------------------------------------------------
// Demo datasets — journeys / synergy / ML accuracy / recommendations
// ---------------------------------------------------------------------------
const JOURNEY_PATHS = [
  { steps: ["Meta Ad", "Google Search", "Direct", "Purchase"], conversions: 482, revenue: 68400 },
  { steps: ["Google Search", "Direct", "Purchase"], conversions: 391, revenue: 52700 },
  { steps: ["TikTok Ad", "Meta Ad", "Google Search", "Purchase"], conversions: 267, revenue: 38200 },
  { steps: ["Meta Ad", "Direct", "Purchase"], conversions: 224, revenue: 29100 },
  { steps: ["Google Search", "Meta Retargeting", "Purchase"], conversions: 189, revenue: 24600 },
];

const stepColor = (step: string) =>
  step === "Purchase"
    ? "#10B981"
    : step.includes("TikTok")
    ? "#FF0050"
    : step.includes("Retargeting")
    ? "#A855F7"
    : step.includes("Meta")
    ? "#1877F2"
    : step.includes("Google")
    ? "#4285F4"
    : "#94A3B8";

const SYNERGY_CHANNELS = ["Meta", "Google", "TikTok", "WooCommerce"];

const SYNERGY_MATRIX: (number | null)[][] = [
  [null, 18, 12, 24],
  [18, null, 9, 21],
  [12, 9, null, 15],
  [24, 21, 15, null],
];

const ML_ACCURACY_DATA = [
  { week: "W1", accuracy: 85.1 },
  { week: "W2", accuracy: 85.6 },
  { week: "W3", accuracy: 86.2 },
  { week: "W4", accuracy: 86.8 },
  { week: "W5", accuracy: 87.5 },
  { week: "W6", accuracy: 88.1 },
  { week: "W7", accuracy: 88.9 },
  { week: "W8", accuracy: 89.6 },
  { week: "W9", accuracy: 90.2 },
  { week: "W10", accuracy: 90.8 },
  { week: "W11", accuracy: 91.5 },
  { week: "W12", accuracy: 92.0 },
];

const ML_METRICS = [
  { label: "Accuracy", value: "92.0%", delta: "+6.9 pts", color: "#8B5CF6" },
  { label: "Precision", value: "91.2%", delta: "+5.8 pts", color: "#3B82F6" },
  { label: "Recall", value: "89.7%", delta: "+7.2 pts", color: "#10B981" },
  { label: "F1 Score", value: "90.4%", delta: "+6.5 pts", color: "#F59E0B" },
];

const OPTIMIZATION_RECS = [
  {
    priority: "High",
    title: "Shift 15% of TikTok prospecting budget to Meta retargeting",
    impact: "+8.4% attributed revenue",
    detail:
      "TikTok prospecting ROAS (1.9x) is below the 2.5x threshold while Meta retargeting holds 4.7x with unmet inventory.",
  },
  {
    priority: "High",
    title: "Expand Google Branded Search coverage to 24/7",
    impact: "+€3.2K monthly revenue",
    detail:
      "Branded search converts at 6.1x but current dayparts only cover 68% of the week — overnight demand is unguarded.",
  },
  {
    priority: "Medium",
    title: "Extend TikTok attribution window from 7 to 14 days",
    impact: "+5.1% TikTok credit accuracy",
    detail:
      "31% of TikTok-assisted conversions land outside the 7-day click window and are currently credited to Direct.",
  },
  {
    priority: "Low",
    title: "Rebalance linear model weights toward first-touch for new customers",
    impact: "+2.3% model F1 score",
    detail:
      "First-touch weighting better matches new-customer journeys observed across the last 90 days of path data.",
  },
];

const PRIORITY_STYLES: Record<string, string> = {
  High: "border-red-500/20 bg-red-500/10 text-red-300",
  Medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  Low: "border-blue-500/20 bg-blue-500/10 text-blue-300",
};

// SVG Sparkline
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 100, h = 28, stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  const gid = `spark-${color.replace("#", "")}`;
  const lastY = h - ((data[data.length - 1] - min) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r={2} fill={color} />
      {data[data.length - 1] >= data[0] ? (
        <ArrowUpRight x={w - 8} y={2} width={8} height={8} className="text-emerald-400" />
      ) : (
        <ArrowDownRight x={w - 8} y={2} width={8} height={8} className="text-red-400" />
      )}
    </svg>
  );
}

const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

function AccuracyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-medium text-white/80">{label}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
        <span className="text-white/50">Accuracy:</span>
        <span className="font-semibold text-white">{Number(payload[0].value).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Page component
export default function AttributionPage() {
  const { isDemo } = useActiveOrg();
  const { format: fmtCurrency, symbol, currency } = useCurrency();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market, setDesks } = useActiveMarket();
  const [activeModel, setActiveModel] = useState("last_touch");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });
  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);
  const datesValid = dateRange.startDate !== "";
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));
  const liveEnabled = !isDemo && datesValid && shopReady;

  const accountQuery = api.marketing.getAccountSummary.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: datesValid && (isDemo || shopReady) },
  );

  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: datesValid && (isDemo || shopReady) },
  );
  useEffect(() => {
    setDesks(merQuery.data?.data?.markets);
  }, [merQuery.data?.data?.markets, setDesks]);
  const mixQuery = api.commerce.getOrderSourceMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveEnabled },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(brandId ? { brandId } : {}, {
    enabled: liveEnabled,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const accounts = accountQuery.data?.data?.accounts ?? [];
  const isLoading = accountQuery.isLoading;
  const hasData = accounts.length > 0 || (merQuery.data?.data?.orderCount ?? 0) > 0;
  const mer = merQuery.data?.data;
  const channels = mixQuery.data?.data?.channels ?? [];
  const emailChannel = channels.find((row) => row.channel === "email");
  const ga4MixData = ga4Mix.data?.data;
  const ga4Channels = ga4MixData?.channels ?? [];
  const gsc = gscQuery.data;
  const operatorDesk = useMemo(
    () =>
      buildOperatorDesk({
        mer,
        ga4: ga4MixData,
        gsc,
        email: emailMetrics.data?.data,
        googleAdsConnected: mergeConnectedPaidPlatforms(
          (syncStatus.data?.platforms ?? []).map((p) => p.platform),
          accounts.map((a) => a.platform),
        ).includes("google"),
        googleAdsSpend: sumAccountSpendForPlatform(accounts, "google"),
        currency,
      }),
    [mer, ga4MixData, gsc, emailMetrics.data, accounts, currency, syncStatus.data],
  );
  const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailMetrics);
  const organicSearch = ga4Channels.find((row) => isGa4OrganicSearchChannel(row.channel));
  const generativeSessions = ga4Channels
    .filter((row) => isGa4GenerativeChannel(row.channel))
    .reduce((sum, row) => sum + row.sessions, 0);

  const mixRecs = useMemo(() => {
    const funded = accounts.filter((a: { totalSpend: number }) => a.totalSpend > 0);
    if (funded.length < 2) return [];
    const ranked = [...funded].sort(
      (a: { roas: number }, b: { roas: number }) => b.roas - a.roas,
    );
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (!best || !worst || best.adAccountId === worst.adAccountId) return [];
    const lift = worst.roas > 0 ? ((best.roas - worst.roas) / worst.roas) * 100 : 0;
    return [
      {
        priority: lift >= 20 ? "High" : "Medium",
        title: `Shift 15% of ${worst.name} spend toward ${best.name}`,
        impact: lift >= 8 ? `+${lift.toFixed(0)}% ROAS gap to close` : "Rebalance mix",
        detail: `${best.name} is at ${best.roas.toFixed(2)}x vs ${worst.name} at ${worst.roas.toFixed(2)}x on ${fmtCurrency(worst.totalSpend)} spend this window.`,
      },
    ];
  }, [accounts, fmtCurrency]);

  const honestyRecs = useMemo(() => {
    if (isDemo) return [];
    return buildAttributionHonestyRecs({
      platforms: accounts.map((a: { platform: string }) => a.platform),
      orderCount: mer?.orderCount ?? 0,
      pixelConversions: mer?.pixelConversions ?? 0,
      mer: mer?.mer ?? 0,
      amer: mer?.amer,
      ga4Purchases: ga4MixData?.totals.purchases,
      emailOrders: emailChannel?.orders,
      emailNet: emailChannel?.netSales,
      currency,
    });
  }, [accounts, isDemo, mer, ga4MixData, emailChannel, currency]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {isDemo ? "Multi-Touch Attribution" : "Till vs pixel"}
              </span>
            </h1>
            <p className="text-sm text-white/40">
              {isDemo
                ? "Sample multi-touch journeys for the demo workspace"
                : "Last-click from the WooCommerce till vs pixel conversions vs GA4 ecommerce purchases. Channel GP and refunds are last-click, not journeys. Five clocks — do not add them."}
            </p>
            {!isDemo && (
              <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker
              value={
                datesValid ? dateRange : { startDate: isoDaysAgo(30), endDate: todayIso() }
              }
              onChange={setDateRange}
              presets={[30, 90, 180, 360]}
            />
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <Activity className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">MER</p>
                <div className="flex items-center gap-1.5">
                  <AnimatedCounter target={merQuery.data?.data?.mer ?? 0} decimals={2} suffix="x" className="text-xl font-bold text-white tabular-nums" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">From synced accounts</span>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {!isDemo && merQuery.data?.data?.markets ? (
        <MarketSplitStrip
          markets={merQuery.data.data.markets}
          adMarkets={merQuery.data.data.adMarkets}
          marketMode={merQuery.data.data.marketMode}
          unnamedAdSpend={merQuery.data.data.unnamedAdSpend}
        />
      ) : null}

      {isDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Demo workspace · sample multi-touch journeys. Live BAGTOBAG is till vs pixel vs GA4, not invented paths.
        </div>
      )}

      {!isDemo && (
        <>
          <FiveClockStrip clocks={operatorDesk.clocks} ready={deskReady} />
          <OperatorBlockerBoard blockers={operatorDesk.blockers} ready={deskReady} />
        </>
      )}

      {isDemo ? (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white/80">Attribution Model</h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Sample
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setActiveModel(model.id)}
                className={`group relative overflow-hidden rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  activeModel === model.id
                    ? "text-white shadow-lg shadow-purple-500/20"
                    : "border border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
                }`}
              >
                {activeModel === model.id && (
                  <motion.div
                    layoutId="model-highlight"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500"
                  />
                )}
                <span className="relative z-10">{model.label}</span>
                {activeModel === model.id && model.id === "data_driven" && (
                  <span className="relative z-10 ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">AI</span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/40">
            {MODELS.find((m) => m.id === activeModel)?.description}
          </p>
        </div>
      </AnimatedSection>
      ) : (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white/80">Last-click from the till</h2>
          </div>
          <p className="mb-4 text-xs text-white/40">
            Woo Order Attribution / UTM on paid orders. First-touch, linear, and data-driven models need journey stitching we do not have. aMER is new-customer net / spend. Net is usually VAT-inclusive.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Store orders", value: (mer?.orderCount ?? 0).toLocaleString() },
              { label: "Pixel conversions", value: (mer?.pixelConversions ?? 0).toFixed(0) },
              {
                label: "GA4 purchases",
                value: (ga4MixData?.totals.purchases ?? 0).toLocaleString(),
              },
              { label: "Pixel ROAS", value: `${(mer?.platformROAS ?? 0).toFixed(2)}x` },
              { label: "Store MER", value: `${(mer?.mer ?? 0).toFixed(2)}x` },
              { label: "aMER", value: `${(mer?.amer ?? 0).toFixed(2)}x` },
              {
                label: "New-customer net",
                value: `${((mer?.newCustomerShare ?? 0) * 100).toFixed(0)}% · ${fmtCurrency(mer?.newCustomerNet ?? 0)}`,
              },
              { label: "Net ex VAT", value: fmtCurrency(mer?.netExVat ?? 0) },
              { label: "VAT / refunds", value: `${fmtCurrency(mer?.tax ?? 0)} / ${fmtCurrency(mer?.refunds ?? 0)}` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/30">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-white tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
          {typeof mer?.breakEvenMer === "number" && mer.breakEvenMer > 0 && (
            <p className="mt-3 text-xs text-white/40">
              Break-even MER at catalog GP is {mer.breakEvenMer.toFixed(1)}x. Pixel vs till is a CAPI / EMQ job in Events Manager, not a new Ads Pro model.
              {(mer.tax ?? 0) <= 0
                ? " VAT on these Woo rows is 0, so Net ex VAT equals store net until total_tax is present."
                : ""}
            </p>
          )}
          {channels.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-white/30">
                    <th className="pb-2 font-medium">Last-click</th>
                    <th className="pb-2 text-right font-medium">Orders</th>
                    <th className="pb-2 text-right font-medium">Net</th>
                    <th className="pb-2 text-right font-medium">GP</th>
                    <th className="pb-2 text-right font-medium">Refunds</th>
                    <th className="pb-2 text-right font-medium">New net</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((row) => (
                    <tr key={row.channel} className="border-t border-white/5">
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: WOO_CHANNEL_COLOR[row.channel] }}
                          />
                          <span className="text-white/80">{row.label}</span>
                          <span className="text-[11px] text-white/35">{(row.share * 100).toFixed(0)}%</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{row.orders}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{fmtCurrency(row.netSales)}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{fmtCurrency(row.grossProfit)}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">{fmtCurrency(row.refunds)}</td>
                      <td className="py-2.5 text-right tabular-nums text-white/70">
                        {(row.newShare * 100).toFixed(0)}% · {fmtCurrency(row.newNetSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {emailChannel && emailChannel.orders > 0 && (
            <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.06] p-4">
              <p className="text-sm font-semibold text-teal-100">Email last-click is till</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                Woo last-click email is {emailChannel.orders} orders ({fmtCurrency(emailChannel.netSales)}).
                That is this table, not Brevo delivered and not Pixel ROAS. Gmail-app last-click is not a proven
                Brevo UTM — the Email desk splits those sources.
              </p>
              <Link
                href="/email"
                className="mt-2 inline-flex text-[11px] font-semibold text-teal-300 hover:text-teal-200"
              >
                Open Email desk
              </Link>
            </div>
          )}
          {ga4Channels.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">
                GA4 default channel · settled sessions, not live visitors
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-white/30">
                      <th className="pb-2 font-medium">Channel</th>
                      <th className="pb-2 text-right font-medium">Sessions</th>
                      <th className="pb-2 text-right font-medium">GA4 purchases</th>
                      <th className="pb-2 text-right font-medium">GA4 revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ga4Channels.slice(0, 10).map((row) => (
                      <tr key={row.channel} className="border-t border-white/5">
                        <td className="py-2.5 text-white/80">{row.channel}</td>
                        <td className="py-2.5 text-right tabular-nums text-white/70">
                          {row.sessions.toLocaleString("en-US")}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-white/70">
                          {row.purchases.toLocaleString("en-US")}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-white/70">
                          {fmtCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-white/40">
                Organic Search here is not Google Ads spend. Unassigned is a tagging hole. Pixel ROAS stays on paid DailyMetric only.
              </p>
            </div>
          )}
          {(gsc?.connected || (organicSearch?.sessions ?? 0) > 0 || generativeSessions > 0) && (
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">
                Organic clocks · GSC click ≠ GA4 session ≠ Google Ads
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">SEO · GSC clicks</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {(gsc?.totals.clicks ?? 0).toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">Search Console web clicks. No money field.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">SEO · GA4 Organic Search</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {(organicSearch?.sessions ?? 0).toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {(organicSearch?.purchases ?? 0).toLocaleString("en-US")} GA4 purchases · not Ads spend
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">GEO · GA4 generative</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {generativeSessions.toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">AI Assistant / Organic AI sessions. Not ChatGPT rank.</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-white/40">
                AEO question queries live on Search Lab. Do not add these clocks into Pixel ROAS or Store MER.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/seo?desk=seo" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:border-white/20">SEO tab</Link>
                <Link href="/seo?desk=geo" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:border-white/20">GEO tab</Link>
                <Link href="/seo?desk=aeo" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:border-white/20">AEO tab</Link>
                <Link href="/email" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:border-white/20">Email · Brevo</Link>
              </div>
            </div>
          )}
          {(mer?.orderCount ?? 0) > 0 && (mer?.pixelConversions ?? 0) > 0 && (
            <p className="mt-4 text-xs text-white/40">
              Do not scale paid media as if store MER were incremental. Direct and organic sit inside the till; pixel ROAS only counts what the ad account claimed.
            </p>
          )}
        </div>
      </AnimatedSection>
      )}

      {/* Channel Performance Cards — wired to getAccountSummary */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : !hasData ? (
        <EmptyDataState
          title="No channel data available"
          description="Connect your ad accounts to see per-channel attribution and performance breakdown."
        />
      ) : (
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account: any) => {
            const platform = (PLATFORMS as any)[account.platform] ?? { name: account.name, color: "#888", icon: "\u{1F4E2}" };
            return (
              <motion.div
                key={account.adAccountId}
                variants={fadeInUp}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-colors hover:border-white/20"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
                      style={{ backgroundColor: `${platform.color}20` }}
                    >
                      {platform.icon}
                    </div>
                    <span className="text-sm font-semibold text-white/80">{account.name}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      account.roas >= 4
                        ? "bg-emerald-500/10 text-emerald-400"
                        : account.roas >= 3
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {account.roas.toFixed(1)}x pixel ROAS
                  </span>
                </div>

                <div className="mb-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Pixel conversion value</p>
                  <p className="text-xl font-bold text-white">
                    <AnimatedCounter target={account.totalConversionValue} prefix="\u20AC" className="tabular-nums" />
                  </p>
                </div>

                <div className="mb-3 flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-white/30">Conversions</p>
                    <p className="text-sm font-semibold text-white/80">
                      <AnimatedCounter target={account.totalConversions} className="tabular-nums" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">CPC</p>
                    <p className="text-sm font-semibold text-white/80">\u20AC{account.cpc.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">Spend</p>
                    <p className="text-sm font-semibold text-white/80">{fmtCurrency(account.totalSpend)}</p>
                  </div>
                </div>

                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: platform.color }} />
              </motion.div>
            );
          })}
        </StaggerContainer>
      )}

      {mixRecs.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white/80">Optimization from this mix</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Derived from connected account pixel ROAS — not a sample LSTM score.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {mixRecs.map((rec) => (
                <div
                  key={rec.title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {rec.priority}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">{rec.impact}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{rec.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{rec.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}

      {honestyRecs.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white/80">What this mix can and cannot do</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Last-click + MER only. The model picker above does not reallocate credit.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {honestyRecs.map((rec) => (
                <div key={rec.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {rec.impact}
                    </span>
                    <Link href={rec.href} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                      {rec.actionLabel}
                    </Link>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{rec.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}

      {!isDemo && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white/80">Journey paths</h2>
            </div>
            <p className="text-sm text-white/50">
              Multi-touch journeys need click-path storage we do not have. Connect Google or TikTok for a second last-click column — that still is not MTA.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/connections?connect=google" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20">
                Connect Google
              </Link>
              <Link href="/connections?connect=tiktok" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20">
                Connect TikTok
              </Link>
              <Link href="/seo?desk=seo" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20">
                SEO
              </Link>
              <Link href="/seo?desk=geo" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20">
                GEO
              </Link>
              <Link href="/seo?desk=aeo" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20">
                AEO
              </Link>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Journey Path Analysis */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Network className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white/80">Journey Path Analysis</h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Sample
            </span>
          </div>
          <p className="mb-5 text-xs text-white/40">
            Top 5 conversion journeys by volume over the last 30 days — multi-touch paths that end in purchase.
          </p>
          <div className="space-y-3">
            {JOURNEY_PATHS.map((path, i) => (
              <motion.div
                key={path.steps.join(" > ")}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {path.steps.map((step, s) => (
                    <span key={`${step}-${s}`} className="flex items-center gap-2">
                      <span
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          backgroundColor: `${stepColor(step)}20`,
                          color: stepColor(step),
                          border: `1px solid ${stepColor(step)}35`,
                        }}
                      >
                        {step}
                      </span>
                      {s < path.steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-white/25" />}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <span className="text-xs text-white/40">
                    <span className="font-bold tabular-nums text-white">{path.conversions}</span> conversions
                  </span>
                  <span className="text-xs text-white/40">
                    <span className="font-bold tabular-nums text-white">{fmtCurrency(path.revenue)}</span> revenue
                  </span>
                  <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(path.conversions / JOURNEY_PATHS[0].conversions) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-400"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* Cross-Channel Synergy Matrix */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/80">Cross-Channel Synergy Matrix</h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Sample
            </span>
          </div>
          <p className="mb-5 text-xs text-white/40">
            Incremental conversion lift when a channel pair appears in the same journey vs. its solo baseline.
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[130px_repeat(4,1fr)] gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/30">
                <span />
                {SYNERGY_CHANNELS.map((c) => (
                  <span key={c} className="text-center">{c}</span>
                ))}
              </div>
              <div className="mt-1.5 space-y-1.5">
                {SYNERGY_MATRIX.map((row, r) => (
                  <div key={r} className="grid grid-cols-[130px_repeat(4,1fr)] items-center gap-1.5">
                    <span className="text-xs font-medium text-white/60">{SYNERGY_CHANNELS[r]}</span>
                    {row.map((v, c) => (
                      <motion.div
                        key={c}
                        initial={{ opacity: 0, scale: 0.85 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: r * 0.06 + c * 0.04 }}
                        className="flex h-12 items-center justify-center rounded-lg text-xs font-bold tabular-nums"
                        style={
                          v === null
                            ? { backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)" }
                            : {
                                backgroundColor: `rgba(16,185,129,${(0.08 + (v / 24) * 0.5).toFixed(2)})`,
                                color: "#ffffff",
                              }
                        }
                      >
                        {v === null ? "—" : `+${v}%`}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] text-white/30">
            <span>0%</span>
            {[0.14, 0.28, 0.42, 0.58].map((a) => (
              <span key={a} className="h-3 w-7 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${a})` }} />
            ))}
            <span>+24%</span>
            <span className="ml-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
              Meta + WooCommerce: +24% strongest pairing
            </span>
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* ML Model Accuracy */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white/80">ML Model Accuracy</h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Sample
            </span>
          </div>
          <p className="mb-5 text-xs text-white/40">
            Weekly retraining accuracy of the LSTM attribution model — 85.1% → 92.0% over 12 weeks.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-64 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ML_ACCURACY_DATA} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[84, 94]}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip content={(props: any) => <AccuracyTooltip {...props} />} />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: "#8B5CF6", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#8B5CF6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {ML_METRICS.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{m.label}</p>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  </div>
                  <p className="mt-1.5 text-xl font-bold tabular-nums text-white">{m.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-emerald-400">{m.delta} in 12 weeks</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* Optimization Recommendations */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white/80">Optimization Recommendations</h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Sample
            </span>
          </div>
          <p className="mb-5 text-xs text-white/40">
            Ranked by expected impact on attributed revenue — generated from the current data-driven model.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {OPTIMIZATION_RECS.map((rec, i) => (
              <motion.div
                key={rec.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      PRIORITY_STYLES[rec.priority] ?? ""
                    }`}
                  >
                    {rec.priority} priority
                  </span>
                  <span className="text-[10px] font-medium tabular-nums text-white/25">#{i + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-white">{rec.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/50">{rec.detail}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Expected impact: {rec.impact.replaceAll("€", symbol)}
                </div>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-500 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10" />
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>
      )}
    </div>
  );
}
