"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  type TooltipContentProps,
} from "recharts";
import {
  GitCompare,
  Sparkles,
  Trophy,
  Target,
  Sliders,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  AnimatedSection,
  StaggerContainer,
} from "@/components/ui/animated-section";
import {
  EmptyDataState,
  CardSkeleton,
  DataLoadingState,
} from "@/components/ui/data-state";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import { api } from "@/lib/trpc/react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { buildMissingPlatformRecs } from "@/lib/dashboard-insights";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#FF0050",
  unknown: "#888888",
};

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Demo datasets — correlation / diminishing returns / optimizer / activity
// ---------------------------------------------------------------------------
const CORRELATION_CHANNELS = ["Meta", "Google", "TikTok", "WooCommerce"];

const CORRELATION_MATRIX: number[][] = [
  [1.0, 0.82, 0.45, 0.67],
  [0.82, 1.0, 0.38, 0.74],
  [0.45, 0.38, 1.0, 0.29],
  [0.67, 0.74, 0.29, 1.0],
];

const RETURNS_CURVE_DATA = [
  { budget: 500, google: 6.2, meta: 5.4, tiktok: 4.8 },
  { budget: 1000, google: 5.5, meta: 4.8, tiktok: 4.1 },
  { budget: 1500, google: 5.0, meta: 4.3, tiktok: 3.6 },
  { budget: 2000, google: 4.6, meta: 3.9, tiktok: 3.1 },
  { budget: 2500, google: 4.3, meta: 3.6, tiktok: 2.8 },
  { budget: 3000, google: 4.0, meta: 3.3, tiktok: 2.5 },
  { budget: 3500, google: 3.7, meta: 3.1, tiktok: 2.3 },
  { budget: 4000, google: 3.5, meta: 2.9, tiktok: 2.1 },
  { budget: 4500, google: 3.3, meta: 2.7, tiktok: 2.0 },
  { budget: 5000, google: 3.1, meta: 2.6, tiktok: 1.9 },
];

const BUDGET_RECOMMENDATIONS = [
  {
    from: "TikTok",
    to: "Google Search",
    amount: 500,
    impact: "+12% blended ROAS",
    detail: "TikTok marginal ROAS sits at 1.9x while Google Search still returns 4.6x at current spend levels.",
    confidence: 94,
  },
  {
    from: "Meta (Broad)",
    to: "Meta (Retargeting)",
    amount: 300,
    impact: "+€2.4K weekly revenue",
    detail: "Retargeting audiences convert at 4.7x vs 2.8x for broad prospecting — headroom before saturation.",
    confidence: 88,
  },
  {
    from: "Google Display",
    to: "Google Search",
    amount: 200,
    impact: "+8% CPA efficiency",
    detail: "Display CPA runs 41% above search at the current allocation and search inventory is not yet exhausted.",
    confidence: 81,
  },
  {
    from: "TikTok (Prospecting)",
    to: "Meta (Lookalike)",
    amount: 250,
    impact: "+6% new-customer ROAS",
    detail: "Meta lookalikes deliver cheaper assisted conversions that compound down-funnel for new customers.",
    confidence: 76,
  },
];

const HOURLY_ACTIVITY = [
  { hour: "00", meta: 14, google: 9, tiktok: 22 },
  { hour: "01", meta: 9, google: 6, tiktok: 15 },
  { hour: "02", meta: 6, google: 4, tiktok: 9 },
  { hour: "03", meta: 4, google: 3, tiktok: 6 },
  { hour: "04", meta: 5, google: 4, tiktok: 7 },
  { hour: "05", meta: 9, google: 7, tiktok: 10 },
  { hour: "06", meta: 18, google: 14, tiktok: 14 },
  { hour: "07", meta: 30, google: 24, tiktok: 18 },
  { hour: "08", meta: 41, google: 36, tiktok: 22 },
  { hour: "09", meta: 47, google: 44, tiktok: 27 },
  { hour: "10", meta: 51, google: 48, tiktok: 33 },
  { hour: "11", meta: 54, google: 50, tiktok: 38 },
  { hour: "12", meta: 58, google: 52, tiktok: 45 },
  { hour: "13", meta: 60, google: 54, tiktok: 52 },
  { hour: "14", meta: 63, google: 55, tiktok: 58 },
  { hour: "15", meta: 66, google: 58, tiktok: 64 },
  { hour: "16", meta: 70, google: 62, tiktok: 70 },
  { hour: "17", meta: 76, google: 68, tiktok: 76 },
  { hour: "18", meta: 84, google: 74, tiktok: 82 },
  { hour: "19", meta: 92, google: 80, tiktok: 90 },
  { hour: "20", meta: 96, google: 84, tiktok: 94 },
  { hour: "21", meta: 90, google: 76, tiktok: 88 },
  { hour: "22", meta: 72, google: 58, tiktok: 74 },
  { hour: "23", meta: 38, google: 28, tiktok: 44 },
];

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------
function CurveTooltip({ active, payload, label }: TooltipContentProps<number, number>) {
  const { format: fmtEuro } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {fmtEuro(Number(e.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function RoaTooltip({ active, payload, label }: TooltipContentProps<number, number>) {
  const { symbol } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">Daily budget {symbol}{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {Number(e.value).toFixed(1)}x ROAS
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">{label}:00 — activity index</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {Number(e.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CrossPlatformPage() {
  const { isDemo } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { format: fmtEuro, formatExact, formatAxis, symbol, currency } = useCurrency();
  const dateRange = useIsoDateRange(30);
  const datesValid = dateRange.startDate !== "";
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));
  const liveReady = datesValid && shopReady;

  const accountQuery = api.marketing.getAccountSummary.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(
    brandId ? { brandId } : {},
    { enabled: shopReady && !isDemo },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveReady && !isDemo },
  );

  const accounts = accountQuery.data?.data?.accounts ?? [];
  const totals = accountQuery.data?.data?.totals;
  const isLoading = !shopReady || accountQuery.isLoading;
  const hasData = accounts.length > 0;
  const mer = merQuery.data?.data;
  const operatorDesk = buildOperatorDesk({
    totals,
    mer,
    ga4: ga4Mix.data?.data,
    gsc: gscQuery.data,
    email: emailMetrics.data?.data,
    googleAdsConnected: mergeConnectedPaidPlatforms(
      (syncStatus.data?.platforms ?? []).map((p) => p.platform),
      accounts.map((a: { platform: string }) => a.platform),
    ).includes("google"),
    googleAdsSpend: sumAccountSpendForPlatform(accounts, "google"),
    currency,
  });
  const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailMetrics);

  // Build chart data from accounts
  const chartData = useMemo(() => {
    return accounts.map((a: any) => ({
      name: a.name.length > 12 ? a.name.slice(0, 12) + "..." : a.name,
      spend: a.totalSpend,
      revenue: a.totalConversionValue,
      clicks: a.totalClicks,
      impressions: a.totalImpressions,
    }));
  }, [accounts]);

  return (
    <div className="relative">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <StaggerContainer className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <AnimatedSection variant="fadeInUp">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-violet-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                Unified channel intelligence
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Cross-Platform Analysis
              </span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Paid ad accounts head-to-head — pixel ROAS, not till, not GA4. Five clocks — do not add them.
            </p>
            <div className="mt-3">
              <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
            </div>
          </AnimatedSection>
        </StaggerContainer>

        {!isDemo && (
          <>
            <FiveClockStrip clocks={operatorDesk.clocks} ready={deskReady} />
            <OperatorBlockerBoard blockers={operatorDesk.blockers} ready={deskReady} />
          </>
        )}

        {/* Platform comparison cards — wired to getAccountSummary */}
        {isLoading ? (
          <CardSkeleton count={3} />
        ) : !hasData ? (
          <EmptyDataState
            title="No platform data available"
            description="Connect your ad accounts to compare performance across Meta, Google, and TikTok."
          />
        ) : (
          <StaggerContainer className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {accounts.map((account: any) => {
              const color = PLATFORM_COLORS[account.platform] ?? "#888888";
              return (
                <AnimatedSection key={account.adAccountId} variant="fadeInUp" className="h-full">
                  <div className={cn(GLASS, "relative h-full overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: color }}>
                          {account.name.charAt(0)}
                        </span>
                        <h3 className="text-base font-semibold text-white">{account.name}</h3>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">{account.platform}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">Spend</p>
                        <p className="text-sm font-bold text-white tabular-nums">{fmtEuro(account.totalSpend)}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">{isDemo ? "Revenue" : "Pixel conversion value"}</p>
                        <p className="text-sm font-bold text-white tabular-nums">{fmtEuro(account.totalConversionValue)}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">{isDemo ? "ROAS" : "Pixel ROAS"}</p>
                        <p className="text-sm font-bold text-white tabular-nums">{account.roas.toFixed(2)}x</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">CTR</p>
                        <p className="text-sm font-bold text-white tabular-nums">{account.ctr.toFixed(2)}%</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">CPC</p>
                        <p className="text-sm font-bold text-white tabular-nums">{formatExact(account.cpc)}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-2.5">
                        <p className="text-[10px] text-white/30">Pixel conversions</p>
                        <p className="text-sm font-bold text-white tabular-nums">{account.totalConversions}</p>
                      </div>
                    </div>

                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 hover:opacity-20" style={{ backgroundColor: color }} />
                  </div>
                </AnimatedSection>
              );
            })}
          </StaggerContainer>
        )}

        {/* Totals overview */}
        {totals && (
          <AnimatedSection variant="fadeInUp">
            <div className={cn(GLASS, "p-5 sm:p-6")}>
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  {isDemo ? "Blended Totals (30 days)" : "Paid totals (30 days)"}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] text-white/30">Total Spend</p>
                  <p className="text-lg font-bold text-white">{fmtEuro(totals.totalSpend)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] text-white/30">Pixel conversion value</p>
                  <p className="text-lg font-bold text-white">{fmtEuro(totals.totalConversionValue)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] text-white/30">Pixel ROAS</p>
                  <p className="text-lg font-bold text-white">{totals.blendedROAS.toFixed(2)}x</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-center">
                  <p className="text-[10px] text-white/30">Total Clicks</p>
                  <p className="text-lg font-bold text-white">{totals.totalClicks.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}

        {!isDemo && hasData && (
          <AnimatedSection variant="fadeInUp">
            <div className={cn(GLASS, "p-5 sm:p-6")}>
              <div className="mb-1 flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-violet-400" />
                <h2 className="text-base font-semibold text-white">What this mix is missing</h2>
              </div>
              <p className="mb-4 text-xs text-white/40">
                Pearson correlation needs two paid channels with daily conversions. This desk will not invent a matrix.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {buildMissingPlatformRecs(
                  mergeConnectedPaidPlatforms(
                    (syncStatus.data?.platforms ?? []).map((p) => p.platform),
                    accounts.map((a: { platform: string }) => a.platform),
                  ),
                  {
                    google: sumAccountSpendForPlatform(accounts, "google"),
                    tiktok: sumAccountSpendForPlatform(accounts, "tiktok"),
                  },
                ).map((rec) => (
                  <div key={rec.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{rec.title}</p>
                      <Link href={rec.href} className="shrink-0 text-[11px] font-semibold text-violet-300 hover:text-violet-200">
                        {rec.actionLabel}
                      </Link>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">{rec.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Correlation Matrix */}
        {isDemo && (
        <>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Demo workspace · sample correlation matrix. Live BAGTOBAG will not invent a second paid channel.
        </div>
        <AnimatedSection variant="fadeInUp">
          <div className={cn(GLASS, "p-5 sm:p-6")}>
            <div className="mb-1 flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-violet-400" />
              <h2 className="text-base font-semibold text-white">Correlation Matrix</h2>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Sample
              </span>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Pearson correlation of daily conversion counts across channels (30 days). Strong pairs share audiences.
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[120px_repeat(4,1fr)] gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/30">
                  <span />
                  {CORRELATION_CHANNELS.map((c) => (
                    <span key={c} className="text-center">{c}</span>
                  ))}
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {CORRELATION_MATRIX.map((row, r) => (
                    <div key={r} className="grid grid-cols-[120px_repeat(4,1fr)] items-center gap-1.5">
                      <span className="text-xs font-medium text-white/60">{CORRELATION_CHANNELS[r]}</span>
                      {row.map((v, c) => {
                        const diag = r === c;
                        return (
                          <motion.div
                            key={c}
                            initial={{ opacity: 0, scale: 0.85 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: r * 0.06 + c * 0.04 }}
                            className="flex h-12 items-center justify-center rounded-lg text-xs font-semibold tabular-nums"
                            style={
                              diag
                                ? { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }
                                : {
                                    backgroundColor: `rgba(139,92,246,${(0.08 + v * 0.45).toFixed(2)})`,
                                    color: "#ffffff",
                                  }
                            }
                          >
                            {v.toFixed(2)}
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] text-white/30">
              <span>Weak</span>
              {[0.15, 0.3, 0.45].map((a) => (
                <span key={a} className="h-3 w-7 rounded-sm" style={{ backgroundColor: `rgba(139,92,246,${a})` }} />
              ))}
              <span>Strong</span>
              <span className="ml-3 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold text-violet-300">
                Meta × Google: 0.82 — heavy audience overlap
              </span>
            </div>
          </div>
        </AnimatedSection>
        </>
        )}

        {/* Diminishing Returns Curves */}
        {isDemo && (
        <AnimatedSection variant="fadeInUp">
          <div className={cn(GLASS, "p-5 sm:p-6")}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <h2 className="text-base font-semibold text-white">Diminishing Returns Curves</h2>
              </div>
              <div className="hidden items-center gap-4 text-xs sm:flex">
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#34A853]" /> Google Search
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#1877F2]" /> Meta
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#FF0050]" /> TikTok
                </span>
              </div>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Projected marginal ROAS as daily budget per platform increases — every extra euro buys less.
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={RETURNS_CURVE_DATA} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="budget"
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatAxis(v)}
                  />
                  <YAxis
                    domain={[0, 7]}
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}x`}
                  />
                  <Tooltip content={(props: any) => <RoaTooltip {...props} />} />
                  <Line type="monotone" dataKey="google" name="Google Search" stroke="#34A853" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="meta" name="Meta" stroke="#1877F2" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="tiktok" name="TikTok" stroke="#FF0050" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>
        )}

        {/* Budget Optimizer */}
        {isDemo && (
        <AnimatedSection variant="fadeInUp">
          <div className={cn(GLASS, "p-5 sm:p-6")}>
            <div className="mb-1 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-fuchsia-400" />
              <h2 className="text-base font-semibold text-white">Budget Optimizer</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              AI-generated reallocation moves ranked by projected impact on blended performance.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {BUDGET_RECOMMENDATIONS.map((rec, i) => (
                <motion.div
                  key={`${rec.from}-${rec.to}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">{rec.from}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/30" />
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{rec.to}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white">{fmtEuro(rec.amount)}<span className="text-[10px] font-medium text-white/30">/day</span></span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/50">{rec.detail}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                      <Zap className="h-3 w-3" /> {rec.impact.replaceAll("€", symbol)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30">confidence</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${rec.confidence}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.08 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                        />
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums text-white/50">{rec.confidence}%</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>
        )}

        {/* Platform Activity Timeline */}
        {isDemo && (
        <AnimatedSection variant="fadeInUp">
          <div className={cn(GLASS, "p-5 sm:p-6")}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h2 className="text-base font-semibold text-white">Platform Activity Timeline</h2>
              </div>
              <div className="hidden items-center gap-4 text-xs sm:flex">
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#1877F2]" /> Meta
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#34A853]" /> Google
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-[#FF0050]" /> TikTok
                </span>
              </div>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Hourly activity intensity (impressions + clicks index) stacked by platform — evenings dominate.
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={HOURLY_ACTIVITY} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={(props: any) => <ActivityTooltip {...props} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="meta" name="Meta" stackId="activity" fill="#1877F2" />
                  <Bar dataKey="google" name="Google" stackId="activity" fill="#34A853" />
                  <Bar dataKey="tiktok" name="TikTok" stackId="activity" fill="#FF0050" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>
        )}
      </div>
    </div>
  );
}
