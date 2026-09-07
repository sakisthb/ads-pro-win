"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  type TooltipContentProps,
} from "recharts";
import {
  Eye,
  MousePointer,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Sparkles,
  Activity,
  ArrowRight,
  Clock,
  Users,
  Globe,
  ShoppingCart,
  Smartphone,
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
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { deriveInsights, deriveStoreInsights, type CampaignLike, type PlatformPerf } from "@/lib/dashboard-insights";
import { downloadBlob, generateMultiSectionCSV } from "@/lib/export/csv-generator";
import { buildEspEmailExportRows } from "@/lib/email-desk";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { askAi } from "@/lib/ask-ai";
import { asClockNumber, buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";

// ---------------------------------------------------------------------------
// Stat card config
// ---------------------------------------------------------------------------
interface StatConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  value: number;
  prevValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend: number;
  /** When true, a falling number is good (CPA, CAC). Color inverts; the % stays actual. */
  lowerIsBetter?: boolean;
}

// ---------------------------------------------------------------------------
// Chart tabs
// ---------------------------------------------------------------------------
type ChartTabId = "overview" | "platform" | "sales";

const CHART_TABS = [
  { id: "overview" as const, label: "Overview" },
  { id: "platform" as const, label: "By Platform" },
  { id: "sales" as const, label: "Sales KPIs" },
];

// ---------------------------------------------------------------------------
// Demo datasets — cohort retention / geography / hourly heatmap / devices
// ---------------------------------------------------------------------------
const COHORT_DATA: { cohort: string; size: number; retention: (number | null)[] }[] = [
  { cohort: "Jun 30", size: 2840, retention: [100, 72, 58, 49, 43, 39, 36, 34] },
  { cohort: "Jul 7", size: 3120, retention: [100, 74, 60, 51, 45, 40, 37, null] },
  { cohort: "Jul 14", size: 2980, retention: [100, 71, 57, 48, 42, 38, null, null] },
  { cohort: "Jul 21", size: 3410, retention: [100, 76, 61, 52, 46, null, null, null] },
  { cohort: "Jul 28", size: 3260, retention: [100, 73, 59, 50, null, null, null, null] },
  { cohort: "Aug 4", size: 3540, retention: [100, 75, null, null, null, null, null, null] },
];

const GEO_DATA = [
  { country: "Germany", flag: "\u{1F1E9}\u{1F1EA}", revenue: 45200, conversions: 812, roas: 4.8, trend: 12.4 },
  { country: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}", revenue: 38100, conversions: 694, roas: 4.2, trend: 8.7 },
  { country: "France", flag: "\u{1F1EB}\u{1F1F7}", revenue: 29800, conversions: 541, roas: 3.9, trend: 5.2 },
  { country: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}", revenue: 18400, conversions: 367, roas: 4.5, trend: 15.1 },
  { country: "Italy", flag: "\u{1F1EE}\u{1F1F9}", revenue: 16200, conversions: 298, roas: 3.4, trend: -2.3 },
  { country: "Spain", flag: "\u{1F1EA}\u{1F1F8}", revenue: 14700, conversions: 264, roas: 3.1, trend: 4.6 },
  { country: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}", revenue: 11300, conversions: 187, roas: 5.2, trend: 9.8 },
  { country: "Austria", flag: "\u{1F1E6}\u{1F1F9}", revenue: 8900, conversions: 156, roas: 4.1, trend: 6.3 },
  { country: "Belgium", flag: "\u{1F1E7}\u{1F1EA}", revenue: 7600, conversions: 134, roas: 3.8, trend: 3.2 },
  { country: "Sweden", flag: "\u{1F1F8}\u{1F1EA}", revenue: 5800, conversions: 98, roas: 3.6, trend: -1.4 },
];

const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HOURLY_HEATMAP: number[][] = [
  [4, 3, 2, 2, 3, 8, 18, 32, 44, 38, 33, 36, 42, 47, 51, 56, 62, 71, 84, 92, 88, 76, 52, 21],
  [5, 3, 2, 2, 3, 9, 20, 34, 46, 40, 34, 37, 43, 48, 52, 58, 64, 73, 86, 94, 90, 78, 54, 22],
  [5, 4, 2, 3, 3, 9, 19, 35, 47, 41, 35, 38, 44, 50, 54, 60, 66, 75, 88, 96, 91, 80, 56, 23],
  [5, 4, 3, 3, 4, 10, 20, 36, 48, 42, 36, 39, 45, 51, 55, 61, 67, 76, 89, 97, 93, 81, 58, 24],
  [6, 4, 3, 3, 4, 10, 21, 37, 49, 43, 38, 41, 47, 53, 58, 64, 70, 80, 92, 100, 96, 84, 62, 28],
  [8, 6, 4, 4, 5, 8, 14, 22, 30, 36, 42, 48, 55, 60, 66, 72, 78, 85, 94, 98, 95, 87, 68, 38],
  [9, 7, 5, 4, 5, 7, 12, 18, 26, 32, 40, 46, 52, 58, 63, 69, 75, 82, 90, 93, 89, 80, 60, 32],
];

const DEVICE_DATA = [
  { name: "Mobile", value: 62, color: "#10B981", cvr: 2.8, revenue: 82400 },
  { name: "Desktop", value: 31, color: "#3B82F6", cvr: 4.1, revenue: 41200 },
  { name: "Tablet", value: 7, color: "#8B5CF6", cvr: 3.2, revenue: 9300 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtNumber = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(0)}k`
    : `${n}`;

function pctChange(prev: number, curr: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---------------------------------------------------------------------------
// Dark tooltip
// ---------------------------------------------------------------------------
function ChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  const { format: fmtEuro } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white/50">{entry.name}:</span>
          <span className="font-medium text-white">
            {entry.name === "Revenue" || entry.name === "Spend" || entry.name === "Pixel conversion value"
              ? fmtEuro(Number(entry.value))
              : fmtNumber(Number(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Device pie tooltip
// ---------------------------------------------------------------------------
function DeviceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-medium text-white/80">{entry.name}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload?.color }} />
        <span className="text-white/50">Traffic share:</span>
        <span className="font-semibold text-white">{entry.value}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ stat }: { stat: StatConfig }) {
  const Icon = stat.icon;
  const rose = stat.trend >= 0;
  const good =
    stat.trend === 0 ? true : stat.lowerIsBetter ? stat.trend < 0 : stat.trend > 0;

  return (
    <motion.div
      variants={fadeInUp}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-colors hover:border-white/20"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{stat.label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${stat.color}20` }}>
          <Icon className="h-4 w-4" style={{ color: stat.color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">
        <AnimatedCounter
          target={stat.value}
          prefix={stat.prefix}
          suffix={stat.suffix}
          decimals={stat.decimals}
          className="tabular-nums"
        />
      </p>
      <div className="mt-2 flex items-center gap-1 text-xs font-medium">
        {rose ? (
          <TrendingUp className={`h-3.5 w-3.5 ${good ? "text-emerald-400" : "text-red-400"}`} />
        ) : (
          <TrendingDown className={`h-3.5 w-3.5 ${good ? "text-emerald-400" : "text-red-400"}`} />
        )}
        <span className={good ? "text-emerald-400" : "text-red-400"}>
          {rose ? "+" : ""}{stat.trend.toFixed(1)}%
        </span>
        <span className="text-white/30">vs prev.</span>
      </div>
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: stat.color }}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const { isDemo } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { format: fmtEuro, symbol, currency } = useCurrency();
  const [chartTab, setChartTab] = useState<ChartTabId>("overview");
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  // Date range picker state — defaults to "last 30 days", set post-mount so
  // the SSR HTML never embeds a client-computed date.
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: "",
    endDate: "",
  });
  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);

  const datesValid = dateRange.startDate !== "" && dateRange.endDate !== "";
  const liveReady = datesValid && shopReady;

  // Previous period = same length immediately before the selected window.
  const prevDateRange = useMemo(() => {
    if (!datesValid) return { startDate: "", endDate: "" };
    const startD = new Date(`${dateRange.startDate}T00:00:00.000Z`);
    const endD = new Date(`${dateRange.endDate}T00:00:00.000Z`);
    const days =
      Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;
    const prevEndD = new Date(startD);
    prevEndD.setUTCDate(prevEndD.getUTCDate() - 1);
    const prevStartD = new Date(prevEndD);
    prevStartD.setUTCDate(prevStartD.getUTCDate() - (days - 1));
    const toStr = (d: Date) => d.toISOString().slice(0, 10);
    return { startDate: toStr(prevStartD), endDate: toStr(prevEndD) };
  }, [dateRange, datesValid]);

  // Current period
  const perfQuery = api.marketing.getBlendedPerformance.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );

  // Previous period for comparison
  const prevPerfQuery = api.marketing.getBlendedPerformance.useQuery(
    {
      startDate: prevDateRange.startDate,
      endDate: prevDateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );

  // Platform account summary (accepts the same date range)
  const accountQuery = api.marketing.getAccountSummary.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );

  const salesQuery = api.commerce.getActualSales.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );

  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady },
  );

  const campaignsQuery = api.marketing.getTopCampaigns.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      metric: "spend",
      limit: 8,
      ...shopQuery,
    },
    { enabled: liveReady && !isDemo },
  );

  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady && !isDemo },
  );

  const mixQuery = api.commerce.getOrderSourceMix.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady && !isDemo },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      platform: "all",
      ...shopQuery,
    },
    { enabled: liveReady && !isDemo },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(
    brandId ? { brandId } : {},
    { enabled: shopReady && !isDemo },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady && !isDemo },
  );

  // Derive KPI stats from real data
  const stats: StatConfig[] = useMemo(() => {
    const t = perfQuery.data?.data?.totals;
    const p = prevPerfQuery.data?.data?.totals;
    const mer = merQuery.data?.data;
    if (!t && !mer) return [];

    const pt = p ?? { totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalConversionValue: 0, blendedROAS: 0, blendedCTR: 0 };
    const impressions = asClockNumber(t?.totalImpressions);
    const clicks = asClockNumber(t?.totalClicks);
    const conversions = asClockNumber(t?.totalConversions) || asClockNumber(mer?.pixelConversions);
    const conversionValue = asClockNumber(t?.totalConversionValue) || asClockNumber(mer?.totalAttributedRevenue);
    const spend = asClockNumber(t?.totalSpend) || asClockNumber(mer?.totalSpend);
    const ctr = asClockNumber(t?.blendedCTR) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const roas = asClockNumber(t?.blendedROAS) || (spend > 0 ? conversionValue / spend : 0);

    return [
      {
        label: "Impressions",
        icon: Eye,
        color: "#1877F2",
        value: impressions,
        prevValue: asClockNumber(pt.totalImpressions),
        trend: pctChange(asClockNumber(pt.totalImpressions), impressions),
      },
      {
        label: "Clicks",
        icon: MousePointer,
        color: "#8B5CF6",
        value: clicks,
        prevValue: asClockNumber(pt.totalClicks),
        trend: pctChange(asClockNumber(pt.totalClicks), clicks),
      },
      {
        label: "CTR",
        icon: Target,
        color: "#10B981",
        value: ctr,
        prevValue: asClockNumber(pt.blendedCTR),
        suffix: "%",
        decimals: 2,
        trend: pctChange(asClockNumber(pt.blendedCTR), ctr),
      },
      {
        label: "Pixel conversions",
        icon: Activity,
        color: "#F59E0B",
        value: conversions,
        prevValue: asClockNumber(pt.totalConversions),
        trend: pctChange(asClockNumber(pt.totalConversions), conversions),
      },
      {
        label: "Pixel conversion value",
        icon: DollarSign,
        color: "#EC4899",
        value: conversionValue,
        prevValue: asClockNumber(pt.totalConversionValue),
        prefix: symbol,
        trend: pctChange(asClockNumber(pt.totalConversionValue), conversionValue),
      },
      {
        label: "Pixel ROAS",
        icon: TrendingUp,
        color: "#06B6D4",
        value: roas,
        prevValue: asClockNumber(pt.blendedROAS),
        suffix: "x",
        decimals: 2,
        trend: pctChange(asClockNumber(pt.blendedROAS), roas),
      },
    ];
  }, [perfQuery.data, prevPerfQuery.data, merQuery.data, symbol]);

  const salesStats: StatConfig[] = useMemo(() => {
    const t = perfQuery.data?.data?.totals;
    const p = prevPerfQuery.data?.data?.totals;
    const sales = salesQuery.data?.data;
    const mer = merQuery.data?.data;
    if (!t) return [];

    const spend = asClockNumber(mer?.totalSpend) || asClockNumber(t.totalSpend);
    const conversions = asClockNumber(t.totalConversions) || asClockNumber(mer?.pixelConversions);
    const clicks = asClockNumber(t.totalClicks);
    const storeOrders = asClockNumber(mer?.orderCount);
    const storeNet = asClockNumber(mer?.totalRevenue);
    const aov =
      asClockNumber(sales?.avgOrderValue) || (storeOrders > 0 ? storeNet / storeOrders : 0);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const newCustomers = sales?.newCustomers ?? 0;
    const cac = newCustomers > 0 ? spend / newCustomers : 0;
    const refundRate =
      (sales?.grossSales ?? 0) > 0
        ? ((sales?.refunds ?? 0) / (sales?.grossSales ?? 1)) * 100
        : 0;
    const leadToSale = clicks > 0 ? (conversions / clicks) * 100 : 0;

    const prevSpend = p?.totalSpend ?? 0;
    const prevConv = p?.totalConversions ?? 0;
    const prevClicks = p?.totalClicks ?? 0;
    const prevCpa = prevConv > 0 ? prevSpend / prevConv : 0;
    const prevLead = prevClicks > 0 ? (prevConv / prevClicks) * 100 : 0;

    return [
      {
        label: "AOV",
        icon: ShoppingCart,
        color: "#10B981",
        value: aov,
        prevValue: 0,
        prefix: symbol,
        decimals: 2,
        trend: 0,
      },
      {
        label: "CPA",
        icon: Target,
        color: "#F59E0B",
        value: cpa,
        prevValue: prevCpa,
        prefix: symbol,
        decimals: 2,
        trend: pctChange(prevCpa, cpa),
        lowerIsBetter: true,
      },
      {
        label: "CAC",
        icon: Users,
        color: "#8B5CF6",
        value: cac,
        prevValue: 0,
        prefix: symbol,
        decimals: 2,
        trend: 0,
      },
      {
        label: "Refund rate",
        icon: TrendingDown,
        color: "#EF4444",
        value: refundRate,
        prevValue: 0,
        suffix: "%",
        decimals: 1,
        trend: 0,
      },
      {
        label: "Click → pixel",
        icon: Activity,
        color: "#06B6D4",
        value: leadToSale,
        prevValue: prevLead,
        suffix: "%",
        decimals: 2,
        trend: pctChange(prevLead, leadToSale),
      },
    ];
  }, [perfQuery.data, prevPerfQuery.data, salesQuery.data, merQuery.data, symbol]);

  // Derive chart timeseries from real data
  const series = useMemo(() => {
    const ts = perfQuery.data?.data?.timeseries;
    if (!ts) return [];
    return ts.map((d) => ({
      day: d.date.slice(5), // MM-DD
      spend: d.totalSpend,
      revenue: d.totalConversionValue,
      impressions: d.totalImpressions,
      clicks: d.totalClicks,
      conversions: d.totalConversions,
    }));
  }, [perfQuery.data]);

  // Derive funnel from totals
  const funnelStages = useMemo(() => {
    const t = perfQuery.data?.data?.totals;
    if (!t) return [];
    return [
      { label: "Impressions", value: t.totalImpressions, color: "#3B82F6" },
      { label: "Clicks", value: t.totalClicks, color: "#8B5CF6" },
      { label: "Pixel conversions", value: t.totalConversions, color: "#10B981" },
    ];
  }, [perfQuery.data]);

  const liveInsights = useMemo(() => {
    const accounts = accountQuery.data?.data?.accounts ?? [];
    const byPlatform = new Map<string, { spend: number; revenue: number }>();
    for (const account of accounts) {
      const key = account.platform || "unknown";
      const prev = byPlatform.get(key) ?? { spend: 0, revenue: 0 };
      byPlatform.set(key, {
        spend: prev.spend + account.totalSpend,
        revenue: prev.revenue + account.totalConversionValue,
      });
    }
    const platforms: PlatformPerf[] = [...byPlatform.entries()].map(([name, row]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      spend: row.spend,
      revenue: row.revenue,
      roas: row.spend > 0 ? row.revenue / row.spend : 0,
    }));
    const campaigns: CampaignLike[] = (campaignsQuery.data?.data?.campaigns ?? []).map((c) => ({
      name: c.campaignName,
      platform: c.platform,
      spend: c.totalSpend,
      revenue: c.totalConversionValue,
      roas: c.roas,
      clicks: c.totalClicks,
      impressions: c.totalImpressions,
    }));
    const totals = perfQuery.data?.data?.totals;
    const mer = merQuery.data?.data;
    const ga4MixData = ga4Mix.data?.data;
    const ga4Channels = ga4MixData?.channels ?? [];
    const pixelInsights = deriveInsights(
      platforms,
      campaigns,
      totals
        ? {
            ctr: totals.blendedCTR,
            conversions: totals.totalConversions,
            spend: totals.totalSpend,
          }
        : null,
      currency,
    );
    const storeInsights = deriveStoreInsights({
      storeOrders: mer?.orderCount ?? 0,
      storeNet: mer?.totalRevenue ?? 0,
      pixelConversions: mer?.pixelConversions ?? totals?.totalConversions ?? 0,
      pixelRevenue: mer?.totalAttributedRevenue ?? 0,
      spend: mer?.totalSpend ?? totals?.totalSpend ?? 0,
      mer: mer?.mer ?? 0,
      platformRoas: mer?.platformROAS ?? 0,
      cogsKnown: mer?.cogsKnown === true,
      grossProfit: mer?.grossProfit,
      profitAfterAds: mer?.profitAfterAds,
      amer: mer?.amer,
      newCustomerShare: mer?.newCustomerShare,
      newCustomerNet: mer?.newCustomerNet,
      channels: mixQuery.data?.data?.channels ?? [],
      connectedPlatforms: mergeConnectedPaidPlatforms(
        (syncStatus.data?.platforms ?? []).map((p) => p.platform),
        accounts.map((a) => a.platform),
      ),
      currency,
      ga4Sessions: ga4MixData?.totals.sessions,
      ga4Purchases: ga4MixData?.totals.purchases,
      ga4UnassignedSessions: ga4Channels.find((c) => /unassigned/i.test(c.channel))?.sessions,
      ga4OrganicSearchSessions: ga4Channels.find((c) => /organic search/i.test(c.channel))?.sessions,
      ga4OrganicSearchPurchases: ga4Channels.find((c) => /organic search/i.test(c.channel))?.purchases,
      tax: mer?.tax,
      emailConnected: Boolean(emailMetrics.data?.data?.connected),
      emailDelivered: emailMetrics.data?.data?.totalSent ?? 0,
      googleAdsSpend: sumAccountSpendForPlatform(accounts, "google"),
    });
    return [...storeInsights, ...pixelInsights].slice(0, 6);
  }, [accountQuery.data, campaignsQuery.data, perfQuery.data, merQuery.data, ga4Mix.data, mixQuery.data, emailMetrics.data, syncStatus.data, currency]);

  const exportAnalytics = () => {
    const timeseries = perfQuery.data?.data?.timeseries ?? [];
    const accounts = accountQuery.data?.data?.accounts ?? [];
    const campaigns = campaignsQuery.data?.data?.campaigns ?? [];
    const mer = merQuery.data?.data;
    const ga4Purchases = ga4Mix.data?.data?.totals.purchases ?? 0;
    const blob = generateMultiSectionCSV([
      {
        title: "Daily blended (paid ads — pixel)",
        headers: ["Date", "Spend", "Impressions", "Clicks", "Pixel conversions", "Pixel conversion value"],
        rows: timeseries.map((d) => [
          d.date,
          Number(d.totalSpend.toFixed(2)),
          d.totalImpressions,
          d.totalClicks,
          Number(d.totalConversions.toFixed(2)),
          Number(d.totalConversionValue.toFixed(2)),
        ]),
      },
      {
        title: "Five clocks",
        headers: ["Metric", "Value"],
        rows: [
          ["Store orders", mer?.orderCount ?? 0],
          ["Pixel conversions", mer?.pixelConversions ?? perfQuery.data?.data?.totals.totalConversions ?? 0],
          ["GA4 ecommerce purchases", ga4Purchases],
          ["GSC clicks (not Ads spend)", gscQuery.data?.totals.clicks ?? 0],
          ["GSC impressions", gscQuery.data?.totals.impressions ?? 0],
          ["Email delivered (not Pixel ROAS)", emailMetrics.data?.data?.totalSent ?? 0],
          ["Store net", Number((mer?.totalRevenue ?? 0).toFixed(2))],
          ["Store MER", Number((mer?.mer ?? 0).toFixed(4))],
          ["Pixel ROAS", Number((mer?.platformROAS ?? 0).toFixed(4))],
        ],
      },
      {
        title: "Accounts",
        headers: ["Account", "Platform", "Spend", "Clicks", "Pixel conversions", "Pixel ROAS"],
        rows: accounts.map((a) => [
          a.name,
          a.platform,
          Number(a.totalSpend.toFixed(2)),
          a.totalClicks,
          Number(a.totalConversions.toFixed(2)),
          Number(a.roas.toFixed(2)),
        ]),
      },
      {
        title: "Campaigns",
        headers: ["Campaign", "Platform", "Spend", "Clicks", "Pixel conversions", "Pixel ROAS"],
        rows: campaigns.map((c) => [
          c.campaignName,
          c.platform,
          Number(c.totalSpend.toFixed(2)),
          c.totalClicks,
          Number(c.totalConversions.toFixed(2)),
          Number(c.roas.toFixed(2)),
        ]),
      },
      ...(emailMetrics.data?.data?.connected
        ? [
            {
              title: "ESP email (not till, not pixel)",
              headers: ["Metric", "Value"],
              rows: buildEspEmailExportRows({
                delivered: emailMetrics.data.data.totalSent,
                uniqueOpens: emailMetrics.data.data.totalOpens,
                clicks: emailMetrics.data.data.totalClicks,
                extrasPresent: Boolean(emailMetrics.data.data.extras?.present),
                appleMppOpens: emailMetrics.data.data.extras?.appleMppOpens ?? 0,
                retailDelivered: emailMetrics.data.data.desks?.retail?.delivered ?? 0,
                wholesaleDelivered: emailMetrics.data.data.desks?.wholesale?.delivered ?? 0,
              }),
            },
          ]
        : []),
    ]);
    downloadBlob(blob, `analytics-${dateRange.startDate}-${dateRange.endDate}.csv`);
  };

  const isLoading = !datesValid || !shopReady || perfQuery.isLoading;
  const hasData = perfQuery.data?.data?.timeseries?.length;
  const mer = merQuery.data?.data;
  const accountsForDesk = accountQuery.data?.data?.accounts ?? [];
  const operatorDesk = buildOperatorDesk({
    totals: perfQuery.data?.data?.totals,
    mer,
    ga4: ga4Mix.data?.data,
    gsc: gscQuery.data,
    email: emailMetrics.data?.data,
    googleAdsConnected: mergeConnectedPaidPlatforms(
      (syncStatus.data?.platforms ?? []).map((p) => p.platform),
      accountsForDesk.map((a) => a.platform),
    ).includes("google"),
    googleAdsSpend: sumAccountSpendForPlatform(accountsForDesk, "google"),
    currency,
  });
  const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailMetrics);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Analytics
            </h1>
            <p className="text-sm text-white/40">Paid DailyMetric across connected ad accounts — pixel, not till, not GA4. Five clocks — do not add them.</p>
            <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              type="button"
              onClick={exportAnalytics}
              disabled={!datesValid || !hasData}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDemo) {
                  document.getElementById("analytics-insights")?.scrollIntoView({ behavior: "smooth" });
                  return;
                }
                if (liveInsights[0]?.id === "ask-ai") {
                  askAi(liveInsights[0].description);
                  return;
                }
                document.getElementById("analytics-insights")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" /> Generate Insights
            </button>
          </div>
        </div>
      </AnimatedSection>

      {!isDemo && (
        <>
          <FiveClockStrip clocks={operatorDesk.clocks} ready={deskReady} />
          <OperatorBlockerBoard blockers={operatorDesk.blockers} ready={deskReady} />
        </>
      )}

      {/* 6 Stat cards */}
      {isLoading ? (
        <CardSkeleton count={6} />
      ) : stats.length === 0 ? (
        <EmptyDataState
          title="No performance data yet"
          description="Connect your ad accounts to see blended performance metrics across all platforms."
        />
      ) : (
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </StaggerContainer>
      )}

      {/* Sales suite — AOV / CPA / CAC from store + ads */}
      {!isLoading && salesStats.length > 0 && (
        <AnimatedSection>
          <div className="mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/80">Sales KPIs</h2>
            <span className="text-[11px] text-white/35">
              AOV from Woo when synced; CPA is spend / pixel conversions
            </span>
          </div>
          <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {salesStats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </StaggerContainer>
        </AnimatedSection>
      )}

      {/* Main Charts Area (tabbed) */}
      {isLoading ? (
        <DataLoadingState message="Loading chart data..." />
      ) : !hasData ? (
        <EmptyDataState
          title="No chart data available"
          description="Start running campaigns to see spend and revenue trends over time."
        />
      ) : (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
                {CHART_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setChartTab(tab.id)}
                    className={`relative rounded-lg px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                      chartTab === tab.id ? "text-white" : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {chartTab === tab.id && (
                      <motion.div
                        layoutId="chart-tab-hl"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/80 to-purple-500/80"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>
              {chartTab === "overview" && (
                <div className="hidden items-center gap-4 text-xs sm:flex">
                  <span className="flex items-center gap-1.5 text-white/50">
                    <span className="h-2 w-2 rounded-full bg-blue-400" /> Spend
                  </span>
                  <span className="flex items-center gap-1.5 text-white/50">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Revenue
                  </span>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {chartTab === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} />
                      <Tooltip content={(props: any) => <ChartTooltip {...props} />} />
                      <Bar yAxisId="left" dataKey="spend" name="Spend" fill="rgba(59,130,246,0.35)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line yAxisId="right" type="monotone" dataKey="revenue" name="Pixel conversion value" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#10B981" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {chartTab === "sales" && (
                <motion.div key="sales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Orders",
                        value: salesQuery.data?.data?.orderCount ?? 0,
                      },
                      {
                        label: "Net sales",
                        value: salesQuery.data?.data?.netSales ?? 0,
                        money: true,
                      },
                      {
                        label: salesQuery.data?.data?.cogsKnown ? "Gross profit" : "Refunds",
                        value: salesQuery.data?.data?.cogsKnown
                          ? (salesQuery.data?.data?.grossProfit ?? 0)
                          : (salesQuery.data?.data?.refunds ?? 0),
                        money: true,
                      },
                    ].map((row) => (
                      <div key={row.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-wider text-white/40">{row.label}</p>
                        <p className="mt-1 text-xl font-bold text-white tabular-nums">
                          {row.money ? fmtEuro(row.value) : fmtNumber(row.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/40">
                    New-customer orders: {salesQuery.data?.data?.newCustomers ?? 0} · Returning:{" "}
                    {salesQuery.data?.data?.returningCustomers ?? 0} · Store MER{" "}
                    {(merQuery.data?.data?.mer ?? 0).toFixed(2)}x · aMER{" "}
                    {(merQuery.data?.data?.amer ?? 0).toFixed(2)}x
                  </p>
                </motion.div>
              )}
              {chartTab === "platform" && (
                <motion.div key="platform" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-80 w-full">
                  {accountQuery.isLoading ? (
                    <DataLoadingState message="Loading platform data..." />
                  ) : accountQuery.data?.data?.accounts?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={accountQuery.data.data.accounts.map((a) => ({
                          name: a.name.length > 15 ? a.name.slice(0, 15) + "..." : a.name,
                          spend: a.totalSpend,
                          revenue: a.totalConversionValue,
                          clicks: a.totalClicks,
                        }))}
                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} />
                        <Tooltip content={(props: any) => <ChartTooltip {...props} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="spend" name="Spend" fill="rgba(59,130,246,0.6)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="revenue" name="Pixel conversion value" fill="rgba(16,185,129,0.6)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyDataState title="No platform data" description="Connect your ad accounts to see per-platform performance." />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AnimatedSection>
      )}

      {/* Conversion Funnel — derived from real totals */}
      {funnelStages.length > 0 && funnelStages[0].value > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-4 w-4 text-pink-400" />
              <h2 className="text-sm font-semibold text-white/80">Pixel funnel</h2>
              <span className="text-[11px] text-white/35">Impressions → clicks → pixel conversions. Not till, not GA4.</span>
            </div>
            <div className="flex items-center gap-0">
              {funnelStages.map((stage, idx) => {
                const maxVal = funnelStages[0].value;
                const widthPct = Math.max(12, (stage.value / maxVal) * 100);
                const nextStage = funnelStages[idx + 1];
                const convRate = nextStage ? ((nextStage.value / stage.value) * 100).toFixed(1) : null;

                return (
                  <div key={stage.label} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: idx * 0.15 }}
                        className="flex items-center justify-center rounded-xl py-3 text-center"
                        style={{
                          width: `${widthPct}px`,
                          minWidth: "100px",
                          backgroundColor: `${stage.color}20`,
                          borderLeft: `3px solid ${stage.color}`,
                          transformOrigin: "left",
                        }}
                      >
                        <div className="px-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{stage.label}</p>
                          <p className="text-sm font-bold text-white">{fmtCompact(stage.value)}</p>
                        </div>
                      </motion.div>
                    </div>
                    {convRate && (
                      <div className="mx-2 flex flex-col items-center">
                        <ArrowRight className="h-4 w-4 text-white/20" />
                        <span className="text-[10px] font-semibold text-white/50">{convRate}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedSection>
      )}

      {!isDemo && (
        <AnimatedSection>
          <div id="analytics-insights" className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white/80">Operator insights</h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              Derived from this window. Generate Insights scrolls here (or opens Ask AI when that is the only move).
            </p>
            {liveInsights.length === 0 ? (
              <p className="text-sm text-white/50">Need more than one funded platform or campaign to rank a move.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {liveInsights.map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-medium text-white">{insight.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">{insight.description}</p>
                    {insight.id === "ask-ai" ? (
                      <button
                        type="button"
                        onClick={() => askAi(insight.description)}
                        className="mt-3 text-sm font-medium text-violet-300 hover:text-violet-200"
                      >
                        {insight.actionLabel}
                      </button>
                    ) : (
                      <Link href={insight.href} className="mt-3 inline-flex text-sm font-medium text-blue-300 hover:text-blue-200">
                        {insight.actionLabel}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AnimatedSection>
      )}

      {!isDemo && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white/80">Retention &amp; cohorts</h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              Weekly cohort heatmaps need identified customer ids across weeks. Live we show new vs returning from Woo when orders exist — not a sample matrix.
            </p>
            {(salesQuery.data?.data?.orderCount ?? 0) > 0 ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">New-customer orders</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {salesQuery.data?.data?.newCustomers ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">Returning orders</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {salesQuery.data?.data?.returningCustomers ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">Store MER</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {(merQuery.data?.data?.mer ?? 0).toFixed(2)}x
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">aMER</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {(merQuery.data?.data?.amer ?? 0).toFixed(2)}x
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">
                No Woo orders in this window. Connect the store to unlock RFM on Customers.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <Link href="/customers" className="text-emerald-300 hover:text-emerald-200">Customers / RFM</Link>
              <Link href="/audiences" className="text-emerald-300 hover:text-emerald-200">Geo &amp; hour on Audiences</Link>
              <Link href="/funnel" className="text-emerald-300 hover:text-emerald-200">Device on Funnel</Link>
              <Link href="/connections?connect=woocommerce" className="text-emerald-300 hover:text-emerald-200">Connect Woo</Link>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Cohort Retention Analysis */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/80">Cohort Retention Analysis</h2>
          </div>
          <p className="mb-5 text-xs text-white/40">
            Share of users from each weekly acquisition cohort still active after N weeks.
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="mb-1.5 grid grid-cols-[110px_70px_repeat(8,1fr)] gap-1 text-[10px] font-medium uppercase tracking-wider text-white/30">
                <span className="px-1">Cohort</span>
                <span className="px-1 text-right">Users</span>
                {Array.from({ length: 8 }, (_, w) => (
                  <span key={w} className="text-center">W{w}</span>
                ))}
              </div>
              <div className="space-y-1">
                {COHORT_DATA.map((row, r) => (
                  <div key={row.cohort} className="grid grid-cols-[110px_70px_repeat(8,1fr)] items-center gap-1">
                    <span className="px-1 text-xs font-medium text-white/70">{row.cohort}</span>
                    <span className="px-1 text-right text-xs tabular-nums text-white/40">
                      {row.size.toLocaleString()}
                    </span>
                    {row.retention.map((v, w) => (
                      <div key={w} className="h-9">
                        {v === null ? (
                          <div className="flex h-full items-center justify-center rounded-md bg-white/[0.02] text-[10px] text-white/15">–</div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.35, delay: r * 0.06 + w * 0.045 }}
                            className="flex h-full items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
                            style={{
                              backgroundColor: `rgba(16,185,129,${(0.08 + (v / 100) * 0.55).toFixed(2)})`,
                              color: v >= 55 ? "#ffffff" : "rgba(255,255,255,0.7)",
                            }}
                          >
                            {v}%
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/30">
                <span>0%</span>
                {[0.1, 0.22, 0.34, 0.46, 0.58].map((a) => (
                  <span key={a} className="h-3 w-7 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${a})` }} />
                ))}
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* Geographic Performance */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white/80">Geographic Performance</h2>
          </div>
          <p className="mb-5 text-xs text-white/40">Revenue, conversions and ROAS for your top 10 markets.</p>
          <div className="space-y-1.5">
            {GEO_DATA.map((c, i) => {
              const pct = (c.revenue / GEO_DATA[0].revenue) * 100;
              const positive = c.trend >= 0;
              return (
                <motion.div
                  key={c.country}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex w-44 shrink-0 items-center gap-2 text-xs font-medium text-white/80">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.country}</span>
                  </span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.03]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
                      className="h-full rounded-md bg-gradient-to-r from-blue-500/50 via-blue-400/40 to-emerald-400/50"
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold tabular-nums text-white">
                      {fmtEuro(c.revenue)}
                    </span>
                  </div>
                  <span className="hidden w-20 shrink-0 text-right text-[11px] tabular-nums text-white/40 sm:block">
                    {c.conversions.toLocaleString()} conv.
                  </span>
                  <span className="hidden w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white/70 sm:block">
                    {c.roas.toFixed(1)}x
                  </span>
                  <span
                    className={`flex w-16 shrink-0 items-center justify-end gap-1 text-[11px] font-semibold tabular-nums ${
                      positive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {positive ? "+" : ""}
                    {c.trend.toFixed(1)}%
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* Hour-of-Day Heatmap */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white/80">Hour-of-Day Heatmap</h2>
          </div>
          <p className="mb-5 text-xs text-white/40">Conversion intensity by weekday and hour — greener cells convert better.</p>
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="mb-1 flex gap-1 pl-11">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="flex-1 text-center text-[9px] tabular-nums text-white/25">
                    {h % 3 === 0 ? `${h}h` : ""}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                {HEATMAP_DAYS.map((day, r) => (
                  <div key={day} className="flex items-center gap-1">
                    <span className="w-10 shrink-0 text-[10px] font-medium text-white/40">{day}</span>
                    {HOURLY_HEATMAP[r].map((v, h) => (
                      <motion.div
                        key={h}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: r * 0.05 + h * 0.012 }}
                        title={`${day} ${String(h).padStart(2, "0")}:00 — intensity ${v}/100`}
                        className="h-6 flex-1 cursor-default rounded-[3px] transition-transform duration-150 hover:scale-125"
                        style={{ backgroundColor: `rgba(16,185,129,${(0.05 + (v / 100) * 0.68).toFixed(2)})` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                  <span>Low</span>
                  {[0.1, 0.25, 0.4, 0.55, 0.73].map((a) => (
                    <span key={a} className="h-3 w-7 rounded-sm" style={{ backgroundColor: `rgba(16,185,129,${a})` }} />
                  ))}
                  <span>High</span>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
                  Peak window: Fri 19:00–21:00
                </span>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
      )}

      {/* Device Breakdown */}
      {isDemo && (
      <AnimatedSection>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white/80">Device Breakdown</h2>
          </div>
          <p className="mb-5 text-xs text-white/40">Traffic share, conversion rate and revenue by device type.</p>
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={(props: any) => <DeviceTooltip {...props} />} />
                  <Pie
                    data={DEVICE_DATA}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={4}
                    cornerRadius={6}
                    strokeWidth={0}
                  >
                    {DEVICE_DATA.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tabular-nums text-white">{DEVICE_DATA[0].value}%</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">on Mobile</p>
              </div>
            </div>
            <div className="space-y-3">
              {DEVICE_DATA.map((d, i) => (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <div>
                      <p className="text-sm font-semibold text-white">{d.name}</p>
                      <p className="text-[10px] text-white/40">
                        CVR {d.cvr.toFixed(1)}% · {fmtEuro(d.revenue)} revenue
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-white">{d.value}%</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>
      )}
    </div>
  );
}
