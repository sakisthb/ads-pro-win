"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Brain,
  FileText,
  LineChart as LineChartIcon,
  Megaphone,
  Percent,
  PieChart as PieChartIcon,
  Plug,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { api } from "@/components/providers/trpc-provider";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  AnimatedSection,
  StaggerContainer,
} from "@/components/ui/animated-section";
import { cn } from "@/lib/utils";
import { EmailMetricsPanel } from "@/components/dashboard/EmailMetricsPanel";
import { ExportToolbar } from "@/components/dashboard/ExportToolbar";
import {
  ActivityFeed,
  AiInsightsGrid,
  AttributionFunnelWidget,
  ComposedRoasChart,
  HourlyOrWeekdayChart,
  LiveStrip,
} from "@/components/dashboard/command-center";
import {
  deriveActivity,
  deriveFunnel,
  deriveInsights,
  deriveLiveStrip,
  deriveStoreInsights,
  syncHealth,
  weekdayPattern,
} from "@/lib/dashboard-insights";
import { useCurrency } from "@/components/providers/currency";
import { DeskFilterRow, MarketSplitStrip } from "@/components/brands/desk-filters";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { useActiveOrg } from "@/hooks/use-active-org";
import { mergeConnectedPaidPlatforms } from "@/lib/paid-ad-metrics";
import { deriveOperatorBlockers, deriveOperatorClocks, operatorDeskReady } from "@/lib/operator-clocks";
import {
  FiveClockStrip,
  OperatorBlockerBoard,
} from "@/components/dashboard/operator-board";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";

// ---------------------------------------------------------------------------
// Platform color system
// ---------------------------------------------------------------------------
const PLATFORM_COLORS = {
  Meta: "#1877F2",
  Google: "#4285F4",
  TikTok: "#FF0050",
  WooCommerce: "#96588A",
  omnisend: "#1abc9c",
  brevo: "#0b5ed7",
} as const;

type PlatformName = keyof typeof PLATFORM_COLORS;

// Glassmorphism surface used by every card.
const GLASS =
  "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TimeseriesPoint {
  date: string;
  spend: number;
  revenue: number;
  meta: number;
  google: number;
  tiktok: number;
}

interface PlatformSlice {
  platform: PlatformName;
  value: number;
  color: string;
  pct: number;
}

interface Campaign {
  id: string;
  name: string;
  platform: PlatformName;
  spend: number;
  revenue: number;
  roas: number;
  status: "active" | "paused";
  clicks: number;
  impressions: number;
}

type ChartTab = "trends" | "campaigns" | "platform";

// ---------------------------------------------------------------------------
// Data layer — tRPC queries + mappers (real data replaces the former mock
// constants).  All shape conversions between the router return types and the
// UI component contracts live here so the rendering layer stays unchanged.
// ---------------------------------------------------------------------------

/** Format a Date as a `YYYY-MM-DD` string (the shape the tRPC routers expect). */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Derive the current + previous equal-length date windows from the picked
 * ISO range. The previous window is the same number of days immediately
 * before the selected start, so week-over-week style deltas can be computed
 * without an extra endpoint.
 */
function rangeToWindows(value: DateRangeValue) {
  const startD = new Date(`${value.startDate}T00:00:00.000Z`);
  const endD = new Date(`${value.endDate}T00:00:00.000Z`);
  const days =
    Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1;

  const prevEndD = new Date(startD);
  prevEndD.setUTCDate(prevEndD.getUTCDate() - 1);
  const prevStartD = new Date(prevEndD);
  prevStartD.setUTCDate(prevStartD.getUTCDate() - (days - 1));

  return {
    start: value.startDate,
    end: value.endDate,
    prevStart: toDateStr(prevStartD),
    prevEnd: toDateStr(prevEndD),
    days,
  };
}

const EMPTY_WINDOWS = {
  start: "",
  end: "",
  prevStart: "",
  prevEnd: "",
  days: 0,
};

/** Lowercase router platform key -> UI PlatformName. */
const PLATFORM_KEY_MAP: Record<string, PlatformName> = {
  meta: "Meta",
  facebook: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

function mapPlatformKey(key: string | null | undefined): PlatformName | null {
  if (!key) return null;
  return PLATFORM_KEY_MAP[key.toLowerCase()] ?? null;
}

/** Compact a YYYY-MM-DD date into a short `Mon DD` axis-tick label. */
function shortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Percentage change between two metric values (divide-by-zero safe). */
function pctChange(prev: number, next: number): number {
  if (prev === 0) return next === 0 ? 0 : 100;
  return ((next - prev) / Math.abs(prev)) * 100;
}

// -- Router row shapes (mirrored locally for the mappers) --------------------

interface BlendedDay {
  date: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  blendedROAS: number;
  blendedCPC: number;
  blendedCPM: number;
  blendedCTR: number;
}

interface AccountSummaryRow {
  adAccountId: string;
  platform: string;
  accountId: string;
  name: string;
  currency: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  roas: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

interface TopCampaignRow {
  campaignId: string;
  campaignName: string;
  platform: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  roas: number;
  cpc: number;
}

// -- Mappers ----------------------------------------------------------------

/**
 * Merge the blended (all-platform) daily series with the per-platform series
 * into the TimeseriesPoint shape the charts expect. Per-platform values
 * default to 0 when a platform has no row for a given day.
 */
function mergeTimeseries(
  blended: BlendedDay[] | undefined,
  meta: BlendedDay[] | undefined,
  google: BlendedDay[] | undefined,
  tiktok: BlendedDay[] | undefined,
): TimeseriesPoint[] {
  if (!blended || blended.length === 0) return [];
  const spendByKey = (arr: BlendedDay[] | undefined) => {
    const m = new Map<string, number>();
    arr?.forEach((d) => m.set(d.date, d.totalSpend ?? 0));
    return m;
  };
  const metaMap = spendByKey(meta);
  const googleMap = spendByKey(google);
  const tiktokMap = spendByKey(tiktok);
  return blended.map((d) => ({
    date: shortDate(d.date),
    spend: d.totalSpend ?? 0,
    revenue: d.totalConversionValue ?? 0,
    meta: metaMap.get(d.date) ?? 0,
    google: googleMap.get(d.date) ?? 0,
    tiktok: tiktokMap.get(d.date) ?? 0,
  }));
}

/** Map getTopCampaigns rows to the UI Campaign shape. */
function mapTopCampaigns(rows: TopCampaignRow[] | undefined): Campaign[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.campaignId || `${r.platform}:${r.campaignName}`,
    name: r.campaignName || "Unknown campaign",
    platform: mapPlatformKey(r.platform) ?? "Meta",
    spend: r.totalSpend ?? 0,
    revenue: r.totalConversionValue ?? 0,
    roas: Number.isFinite(r.roas) ? r.roas : 0,
    status: "active" as const,
    clicks: r.totalClicks ?? 0,
    impressions: r.totalImpressions ?? 0,
  }));
}

/** Build platform donut slices + connected-channel list from account summary. */
function summarizeAccounts(accounts: AccountSummaryRow[] | undefined) {
  const rows = accounts ?? [];
  const byPlatform = new Map<PlatformName, number>();
  const channels = new Set<PlatformName>();
  for (const a of rows) {
    const p = mapPlatformKey(a.platform);
    if (!p) continue;
    byPlatform.set(p, (byPlatform.get(p) ?? 0) + (a.totalSpend ?? 0));
    channels.add(p);
  }
  const total = [...byPlatform.values()].reduce((s, v) => s + v, 0) || 1;
  const slices: PlatformSlice[] = [...byPlatform.entries()]
    .map(([platform, value]) => ({
      platform,
      value,
      color: PLATFORM_COLORS[platform],
      pct: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
  const connectedChannels: PlatformName[] = [...channels].sort();
  return { slices, connectedChannels, total };
}

// ---------------------------------------------------------------------------
// Loading + empty-state primitives
// ---------------------------------------------------------------------------
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn(GLASS, "relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-7 w-28 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-xl bg-white/10" />
      </div>
      <div className="mt-4 h-3 w-32 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function SkeletonRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Sparkles className="h-5 w-5 text-white/40" />
      </span>
      <p className="max-w-sm text-sm text-white/55">{message}</p>
      <Link
        href="/connections"
        className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 transition-transform hover:scale-[1.02]"
      >
        Connect your accounts
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}









// ---------------------------------------------------------------------------
// Quick Actions data
// ---------------------------------------------------------------------------
const QUICK_ACTIONS = [
  { label: "New Campaign", href: "/campaigns", icon: Megaphone, gradient: "from-violet-500 to-fuchsia-500" },
  { label: "Generate Report", href: "/reports", icon: FileText, gradient: "from-blue-500 to-cyan-500" },
  { label: "Ask AI", href: "/chat", icon: Brain, gradient: "from-amber-400 to-orange-500" },
  { label: "Sync Data", href: "/connections", icon: RefreshCw, gradient: "from-emerald-500 to-teal-500" },
] as const;









// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
interface StatCardProps {
  label: string;
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta: string;
  deltaPositive: boolean;
  icon: React.ElementType;
  accent: string;
}

function StatCard({
  label,
  target,
  prefix,
  suffix,
  decimals = 0,
  delta,
  deltaPositive,
  icon: Icon,
  accent,
}: StatCardProps) {
  return (
    <div
      className={cn(
        GLASS,
        "group relative h-full overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            <AnimatedCounter
              target={target}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
            />
          </p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shadow-lg",
            accent,
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        {deltaPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className={deltaPositive ? "text-emerald-400" : "text-rose-400"}>
          {delta}
        </span>
        <span className="text-white/30">vs last week</span>
      </div>
      {/* hover glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25",
          accent,
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform badge
// ---------------------------------------------------------------------------
function PlatformBadge({ platform }: { platform: PlatformName }) {
  const color = PLATFORM_COLORS[platform];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {platform}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { format: fmtCurrency } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      {label && (
        <p className="mb-1.5 font-medium text-white/70">{label}</p>
      )}
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey)}
          className="flex items-center gap-2 py-0.5"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/50">{entry.name}:</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {fmtCurrency(Number(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: TooltipContentProps<number, string>) {
  const { format: fmtCurrency } = useCurrency();
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const p = entry.payload as PlatformSlice;
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: p.color }}
        />
        <span className="font-medium text-white/80">{p.platform}</span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-white/50">Spend:</span>
        <span className="font-semibold text-white tabular-nums">
          {fmtCurrency(p.value)}
        </span>
        <span className="text-white/40">{p.pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
function PerformanceChart({ data }: { data: TimeseriesPoint[] }) {
  const { formatAxis: fmtAxis } = useCurrency();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          yAxisId="spend"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmtAxis(v)}
        />
        <YAxis
          yAxisId="rev"
          orientation="right"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmtAxis(v)}
        />
        <Tooltip content={(props: TooltipContentProps<number, string>) => <ChartTooltip {...props} />} />
        <Line
          yAxisId="spend"
          type="monotone"
          dataKey="spend"
          name="Spend"
          stroke="#a855f7"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          yAxisId="rev"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#38bdf8"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CampaignChart({ data }: { data: TimeseriesPoint[] }) {
  const { formatAxis: fmtAxis } = useCurrency();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gMeta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PLATFORM_COLORS.Meta} stopOpacity={0.55} />
            <stop offset="100%" stopColor={PLATFORM_COLORS.Meta} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PLATFORM_COLORS.Google} stopOpacity={0.55} />
            <stop offset="100%" stopColor={PLATFORM_COLORS.Google} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gTikTok" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PLATFORM_COLORS.TikTok} stopOpacity={0.55} />
            <stop offset="100%" stopColor={PLATFORM_COLORS.TikTok} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmtAxis(v)}
        />
        <Tooltip content={(props: TooltipContentProps<number, string>) => <ChartTooltip {...props} />} />
        <Area
          type="monotone"
          stackId="1"
          dataKey="meta"
          name="Meta"
          stroke={PLATFORM_COLORS.Meta}
          strokeWidth={2}
          fill="url(#gMeta)"
        />
        <Area
          type="monotone"
          stackId="1"
          dataKey="google"
          name="Google"
          stroke={PLATFORM_COLORS.Google}
          strokeWidth={2}
          fill="url(#gGoogle)"
        />
        <Area
          type="monotone"
          stackId="1"
          dataKey="tiktok"
          name="TikTok"
          stroke={PLATFORM_COLORS.TikTok}
          strokeWidth={2}
          fill="url(#gTikTok)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PlatformChart({ data }: { data: PlatformSlice[] }) {
  const { format: fmtCurrency } = useCurrency();
  const total = data.reduce((a, p) => a + p.value, 0);
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-12">
      <div className="relative h-60 w-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="platform"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={104}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((p) => (
                <Cell key={p.platform} fill={p.color} />
              ))}
            </Pie>
            <Tooltip content={(props: TooltipContentProps<number, string>) => <DonutTooltip {...props} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">
            Total Spend
          </span>
          <span className="mt-1 text-xl font-bold text-white tabular-nums">
            {fmtCurrency(total)}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-56">
        {data.map((p) => (
          <div
            key={p.platform}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-white/70">{p.platform}</span>
            <span className="ml-auto font-semibold text-white tabular-nums">
              {fmtCurrency(p.value)}
            </span>
            <span className="w-12 text-right text-xs text-white/40">
              {p.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function DashboardClient() {
  const { format: fmtCurrency, symbol, currency } = useCurrency();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { org } = useActiveOrg();
  const { market, setDesks } = useActiveMarket();
  const shopQuery = withMarketQuery(brandId, market);
  // Date range picker state — defaults to "last 30 days", set post-mount so
  // the SSR HTML never embeds a client-computed date.
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: "",
    endDate: "",
  });
  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);

  const [chartTab, setChartTab] = useState<ChartTab>("trends");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // -- Date windows derived from the picked range --------------------------
  const datesValid = dateRange.startDate !== "" && dateRange.endDate !== "";
  const { start, end, prevStart, prevEnd, days } = useMemo(
    () => (datesValid ? rangeToWindows(dateRange) : EMPTY_WINDOWS),
    [datesValid, dateRange],
  );

  // -- tRPC queries (all org-scoped; empty/error treated as "no data yet") --
  // The marketing router groups DailyMetric by date; the all-platform call
  // drives the blended trend line + headline totals, while the per-platform
  // variants feed the stacked campaign chart. Every query stays disabled
  // until the picker has produced a valid range.
  const shopReady = datesValid && !brandsLoading && (brands.length === 0 || Boolean(brandId));
  const blendedPerf = api.marketing.getBlendedPerformance.useQuery(
    { startDate: start, endDate: end, platform: "all", ...shopQuery },
    { enabled: shopReady },
  );
  // Previous period = same length immediately before the selected window.
  const prevBlended = api.marketing.getBlendedPerformance.useQuery(
    { startDate: prevStart, endDate: prevEnd, platform: "all", ...shopQuery },
    { enabled: shopReady },
  );
  const metaPerf = api.marketing.getBlendedPerformance.useQuery(
    { startDate: start, endDate: end, platform: "meta", ...shopQuery },
    { enabled: shopReady },
  );
  const googlePerf = api.marketing.getBlendedPerformance.useQuery(
    { startDate: start, endDate: end, platform: "google", ...shopQuery },
    { enabled: shopReady },
  );
  const tiktokPerf = api.marketing.getBlendedPerformance.useQuery(
    { startDate: start, endDate: end, platform: "tiktok", ...shopQuery },
    { enabled: shopReady },
  );
  const topCampaigns = api.marketing.getTopCampaigns.useQuery(
    { startDate: start, endDate: end, metric: "spend", limit: 10, ...shopQuery },
    { enabled: shopReady },
  );
  const accountSummary = api.marketing.getAccountSummary.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady },
  );
  const merData = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady },
  );
  const prevMerData = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: prevStart, endDate: prevEnd, ...shopQuery },
    { enabled: shopReady },
  );
  const mixQuery = api.commerce.getOrderSourceMix.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: start, endDate: end, platform: "all", ...shopQuery },
    { enabled: shopReady },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady, retry: false },
  );
  const todaySnap = api.marketing.getTodaySnapshot.useQuery(shopQuery, {
    refetchInterval: 60_000,
    enabled: !brandsLoading && (brands.length === 0 || Boolean(brandId)),
  });
  const syncStatusQuery = api.syncStatus.getStatus.useQuery(
    brandId ? { brandId } : {},
  );
  const audience = api.marketing.getAudienceBreakdown.useQuery(
    { startDate: start, endDate: end, ...shopQuery },
    { enabled: shopReady, staleTime: 5 * 60_000 },
  );

  // Unwrap the { success, data, timestamp } envelopes. Errors (e.g. a caller
  // without an organization yet) leave these undefined, which the render
  // layer treats as "no data yet — connect your accounts".
  const blendedData = blendedPerf.data?.data;
  const prevData = prevBlended.data?.data;
  const merPayload = merData.data?.data;
  const prevMerPayload = prevMerData.data?.data;
  useEffect(() => {
    setDesks(merPayload?.markets);
  }, [merPayload?.markets, setDesks]);
  const mixChannels = mixQuery.data?.data?.channels ?? [];
  const ga4MixData = ga4Mix.data?.data;
  const ga4Channels = ga4MixData?.channels ?? [];
  const accounts = accountSummary.data?.data?.accounts;
  const campaignRows = topCampaigns.data?.data?.campaigns;

  const hasConnections =
    (blendedData?.timeseries?.length ?? 0) > 0 ||
    (accounts?.length ?? 0) > 0 ||
    (merPayload?.orderCount ?? 0) > 0;

  // A query is "loading" until the first response (data or error) lands.
  const loading =
    !datesValid ||
    blendedPerf.isLoading ||
    merData.isLoading ||
    accountSummary.isLoading ||
    topCampaigns.isLoading;

  // -- Derived UI shapes -----------------------------------------------------
  const sliced = useMemo(
    () =>
      mergeTimeseries(
        blendedData?.timeseries,
        metaPerf.data?.data?.timeseries,
        googlePerf.data?.data?.timeseries,
        tiktokPerf.data?.data?.timeseries,
      ),
    [blendedData, metaPerf.data, googlePerf.data, tiktokPerf.data],
  );

  const kpis = useMemo(() => {
    const n = (v: unknown) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    };
    const adSpend = n(blendedData?.totals?.totalSpend);
    const adRevenue = n(blendedData?.totals?.totalConversionValue);
    const storeRevenue =
      n(merPayload?.orderCount) > 0 ? n(merPayload?.totalRevenue) : 0;
    const spend = adSpend > 0 ? adSpend : n(merPayload?.totalSpend);
    const revenue = storeRevenue > 0 ? storeRevenue : adRevenue;
    const mer = spend > 0 ? revenue / spend : 0;
    const profit =
      n(merPayload?.orderCount) > 0
        ? n(merPayload?.cogsKnown ? merPayload?.profitAfterAds : merPayload?.contributionAfterAds ?? revenue - spend)
        : Math.max(revenue - spend, 0);
    return { spend, revenue, roas: mer, profit };
  }, [blendedData, merPayload]);

  // Week-over-week deltas — current window vs the prior equal-length window.
  const wow = useMemo(() => {
    const cur = blendedData?.totals;
    const prev = prevData?.totals;
    const storeNow = Number(merPayload?.orderCount ?? 0) > 0;
    if (storeNow && merPayload) {
      const profitNow = merPayload.cogsKnown
        ? merPayload.profitAfterAds
        : merPayload.contributionAfterAds;
      const profitPrev = prevMerPayload
        ? prevMerPayload.cogsKnown
          ? prevMerPayload.profitAfterAds
          : prevMerPayload.contributionAfterAds
        : 0;
      return {
        spend: pctChange(prev?.totalSpend ?? 0, cur?.totalSpend ?? merPayload.totalSpend),
        revenue: pctChange(prevMerPayload?.totalRevenue ?? 0, merPayload.totalRevenue),
        profit: pctChange(profitPrev, profitNow),
        roas: (merPayload.mer ?? 0) - (prevMerPayload?.mer ?? 0),
      };
    }
    if (!cur || !prev) return { spend: 0, revenue: 0, profit: 0, roas: 0 };
    const profit =
      merPayload?.profitAfterAds ??
      cur.totalConversionValue - cur.totalSpend;
    const prevProfit = prev.totalConversionValue - prev.totalSpend;
    return {
      spend: pctChange(prev.totalSpend, cur.totalSpend),
      revenue: pctChange(prev.totalConversionValue, cur.totalConversionValue),
      profit: pctChange(prevProfit, profit),
      roas: (cur.blendedROAS ?? 0) - (prev.blendedROAS ?? 0),
    };
  }, [blendedData, prevData, merPayload, prevMerPayload]);

  const paidCpcVsPrior = useMemo(() => {
    const clicks = Number(blendedData?.totals?.totalClicks ?? 0);
    const prevClicks = Number(prevData?.totals?.totalClicks ?? 0);
    const spend = Number(blendedData?.totals?.totalSpend ?? 0);
    const prevSpend = Number(prevData?.totals?.totalSpend ?? 0);
    if (!(clicks > 0 && prevClicks > 0 && spend > 0 && prevSpend > 0)) return null;
    const prevCpc = prevSpend / prevClicks;
    if (!(prevCpc > 0)) return null;
    const pct = ((spend / clicks - prevCpc) / prevCpc) * 100;
    return { pct, down: pct < 0 };
  }, [blendedData, prevData]);

  const platformBreakdown = useMemo<PlatformSlice[]>(() => {
    const { slices } = summarizeAccounts(accounts);
    const funded = slices.filter((s) => s.value > 0);
    if (funded.length) return funded;
    // Fallback: derive from the per-platform timeseries totals when the
    // account summary has no rows yet.
    const sum = (arr?: BlendedDay[]) =>
      (arr ?? []).reduce((a, d) => a + (d.totalSpend ?? 0), 0);
    const meta = sum(metaPerf.data?.data?.timeseries);
    const google = sum(googlePerf.data?.data?.timeseries);
    const tiktok = sum(tiktokPerf.data?.data?.timeseries);
    const total = meta + google + tiktok || 1;
    return [
      { platform: "Meta" as const, value: meta, color: PLATFORM_COLORS.Meta, pct: (meta / total) * 100 },
      { platform: "Google" as const, value: google, color: PLATFORM_COLORS.Google, pct: (google / total) * 100 },
      { platform: "TikTok" as const, value: tiktok, color: PLATFORM_COLORS.TikTok, pct: (tiktok / total) * 100 },
    ].filter((s) => s.value > 0);
  }, [accounts, metaPerf.data, googlePerf.data, tiktokPerf.data]);

  const topCampaignsMapped = useMemo(
    () => mapTopCampaigns(campaignRows),
    [campaignRows],
  );

  const connectedChannels = useMemo<PlatformName[]>(() => {
    return summarizeAccounts(accounts).slices.filter((s) => s.value > 0).map((s) => s.platform);
  }, [accounts]);

  // Platform performance mini-cards: spend + 7-pt sparkline from the
  // per-platform series. WoW change is computed from the series when ≥14
  // daily points are available, otherwise reported as 0.
  const platformPerf = useMemo(() => {
    const build = (name: PlatformName, arr: BlendedDay[] | undefined) => {
      const spend = (arr ?? []).reduce((a, d) => a + (d.totalSpend ?? 0), 0);
      const tail = (arr ?? []).slice(-7).map((d) => ({ v: d.totalSpend ?? 0 }));
      const last7 = (arr ?? []).slice(-7);
      const prev7 = (arr ?? []).slice(-14, -7);
      const sumLast = last7.reduce((a, d) => a + (d.totalSpend ?? 0), 0);
      const sumPrev = prev7.reduce((a, d) => a + (d.totalSpend ?? 0), 0);
      const change = prev7.length ? pctChange(sumPrev, sumLast) : 0;
      return { name, spend, change, data: tail.length ? tail : [{ v: 0 }] };
    };
    return [
      build("Meta", metaPerf.data?.data?.timeseries),
      build("Google", googlePerf.data?.data?.timeseries),
      build("TikTok", tiktokPerf.data?.data?.timeseries),
    ];
  }, [metaPerf.data, googlePerf.data, tiktokPerf.data]);

  const composedSeries = useMemo(
    () =>
      (blendedData?.timeseries ?? []).map((d) => ({
        date: shortDate(d.date),
        spend: d.totalSpend ?? 0,
        revenue: d.totalConversionValue ?? 0,
        roas: d.blendedROAS ?? 0,
      })),
    [blendedData],
  );

  const [liveStrip, liveAsOf] = useMemo(() => {
    const plats = todaySnap.data?.data?.platforms ?? [];
    const snapDate = todaySnap.data?.data?.date;
    const todayIso = new Date().toISOString().slice(0, 10);
    let clicksToday = plats.reduce((a, p) => a + (p.totalClicks ?? 0), 0);
    let revenueToday = plats.reduce(
      (a, p) => a + (p.totalConversionValue ?? 0),
      0,
    );
    const series = blendedData?.timeseries ?? [];
    const last = series.length ? series[series.length - 1] : undefined;
    const lastIso = last?.date?.slice(0, 10);
    const snapIsStale = Boolean(snapDate && snapDate !== todayIso);
    const useSeriesFallback =
      clicksToday === 0 &&
      revenueToday === 0 &&
      last != null &&
      lastIso !== todayIso;
    if (useSeriesFallback) {
      clicksToday = last.totalClicks ?? 0;
      revenueToday = last.totalConversionValue ?? 0;
    }
    const asOfLabel = useSeriesFallback
      ? shortDate(last.date)
      : snapIsStale && snapDate
        ? shortDate(snapDate)
        : "today";
    return [
      deriveLiveStrip({
        todayClicks: clicksToday,
        todayRevenue: revenueToday,
        periodClicks: blendedData?.totals?.totalClicks ?? 0,
        periodRevenue: blendedData?.totals?.totalConversionValue ?? 0,
        periodDays: days || 1,
        campaignsLive: topCampaignsMapped.filter((c) => c.spend > 0).length,
        avgCtr: blendedData?.totals?.blendedCTR ?? 0,
      }),
      asOfLabel,
    ] as const;
  }, [todaySnap.data, blendedData, days, topCampaignsMapped]);

  const insights = useMemo(() => {
    const platforms = [
      {
        name: "Meta",
        spend: platformPerf[0]?.spend ?? 0,
        revenue: (metaPerf.data?.data?.timeseries ?? []).reduce(
          (a, d) => a + (d.totalConversionValue ?? 0),
          0,
        ),
        roas: metaPerf.data?.data?.totals?.blendedROAS ?? 0,
        ctr: metaPerf.data?.data?.totals?.blendedCTR,
      },
      {
        name: "Google",
        spend: platformPerf[1]?.spend ?? 0,
        revenue: (googlePerf.data?.data?.timeseries ?? []).reduce(
          (a, d) => a + (d.totalConversionValue ?? 0),
          0,
        ),
        roas: googlePerf.data?.data?.totals?.blendedROAS ?? 0,
        ctr: googlePerf.data?.data?.totals?.blendedCTR,
      },
      {
        name: "TikTok",
        spend: platformPerf[2]?.spend ?? 0,
        revenue: (tiktokPerf.data?.data?.timeseries ?? []).reduce(
          (a, d) => a + (d.totalConversionValue ?? 0),
          0,
        ),
        roas: tiktokPerf.data?.data?.totals?.blendedROAS ?? 0,
        ctr: tiktokPerf.data?.data?.totals?.blendedCTR,
      },
    ];
    const pixelInsights = deriveInsights(platforms, topCampaignsMapped, blendedData?.totals
      ? {
          ctr: blendedData.totals.blendedCTR,
          conversions: blendedData.totals.totalConversions,
          spend: blendedData.totals.totalSpend,
        }
      : null, currency);
    const storeInsights = deriveStoreInsights({
      storeOrders: merPayload?.orderCount ?? 0,
      storeNet: merPayload?.totalRevenue ?? 0,
      pixelConversions: merPayload?.pixelConversions ?? blendedData?.totals?.totalConversions ?? 0,
      pixelRevenue: merPayload?.totalAttributedRevenue ?? 0,
      spend: merPayload?.totalSpend ?? blendedData?.totals?.totalSpend ?? 0,
      mer: merPayload?.mer ?? 0,
      platformRoas: merPayload?.platformROAS ?? 0,
      cogsKnown: merPayload?.cogsKnown === true,
      grossProfit: merPayload?.grossProfit,
      profitAfterAds: merPayload?.profitAfterAds,
      amer: merPayload?.amer,
      newCustomerShare: merPayload?.newCustomerShare,
      newCustomerNet: merPayload?.newCustomerNet,
      channels: mixChannels,
      connectedPlatforms: mergeConnectedPaidPlatforms(
        (syncStatusQuery.data?.platforms ?? []).map((p) => p.platform),
        summarizeAccounts(accounts).connectedChannels,
      ),
      currency,
      ga4Sessions: ga4MixData?.totals.sessions,
      ga4Purchases: ga4MixData?.totals.purchases,
      ga4UnassignedSessions: ga4Channels.find((c) => /unassigned/i.test(c.channel))?.sessions,
      ga4OrganicSearchSessions: ga4Channels.find((c) => /organic search/i.test(c.channel))?.sessions,
      ga4OrganicSearchPurchases: ga4Channels.find((c) => /organic search/i.test(c.channel))?.purchases,
      tax: merPayload?.tax,
      emailConnected: Boolean(emailMetrics.data?.data?.connected),
      emailDelivered: emailMetrics.data?.data?.totalSent ?? 0,
      googleAdsSpend: googlePerf.data?.data?.totals?.totalSpend ?? 0,
      marketMode: merPayload?.marketMode,
      markets: merPayload?.markets
        ? {
            retail: {
              orders: merPayload.markets.retail.orders,
              netSales: merPayload.markets.retail.netSales,
            },
            wholesale: {
              orders: merPayload.markets.wholesale.orders,
              netSales: merPayload.markets.wholesale.netSales,
            },
          }
        : undefined,
    });
    return [...storeInsights, ...pixelInsights].slice(0, 6);
  }, [
    platformPerf,
    metaPerf.data,
    googlePerf.data,
    tiktokPerf.data,
    topCampaignsMapped,
    blendedData,
    currency,
    merPayload,
    mixChannels,
    accounts,
    ga4MixData,
    ga4Channels,
    emailMetrics.data,
    syncStatusQuery.data,
  ]);

  const funnelStages = useMemo(
    () =>
      deriveFunnel({
        impressions: blendedData?.totals?.totalImpressions ?? 0,
        clicks: blendedData?.totals?.totalClicks ?? 0,
        conversions: blendedData?.totals?.totalConversions ?? 0,
      }),
    [blendedData],
  );

  const weekday = useMemo(
    () =>
      weekdayPattern(
        (blendedData?.timeseries ?? []).map((d) => ({
          date: d.date,
          conversions: d.totalConversions ?? 0,
          impressions: d.totalImpressions ?? 0,
        })),
      ),
    [blendedData],
  );

  const hourly = audience.data?.hourly ?? [];

  const syncMeta = useMemo(() => {
    const platforms = syncStatusQuery.data?.platforms ?? [];
    const accounts = platforms.flatMap((p) => p.accounts);
    return syncHealth({ accounts });
  }, [syncStatusQuery.data]);

  const activityItems = useMemo(() => {
    const syncEvents =
      (syncStatusQuery.data?.platforms ?? []).flatMap((p) =>
        p.accounts.flatMap((a) =>
          (a.recentJobs ?? []).slice(0, 1).map((job) => ({
            platform: p.platform,
            status: job.status,
            at: job.completedAt ?? job.createdAt,
            records: job.recordsProcessed,
            accountName: a.name,
          })),
        ),
      );
    return deriveActivity({
      campaigns: topCampaignsMapped,
      syncEvents,
      currency,
    });
  }, [syncStatusQuery.data, topCampaignsMapped, currency]);

  const operatorClocks = useMemo(
    () =>
      deriveOperatorClocks({
        pixelSpend: merPayload?.totalSpend ?? blendedData?.totals?.totalSpend ?? 0,
        pixelConversions: merPayload?.pixelConversions ?? blendedData?.totals?.totalConversions ?? 0,
        pixelRoas: merPayload?.platformROAS ?? blendedData?.totals?.blendedROAS ?? 0,
        storeOrders: merPayload?.orderCount ?? 0,
        storeNet: merPayload?.totalRevenue ?? 0,
        ga4Connected: Boolean(ga4MixData?.connected) || (ga4MixData?.totals.sessions ?? 0) > 0,
        ga4Sessions: ga4MixData?.totals.sessions ?? 0,
        ga4Purchases: ga4MixData?.totals.purchases ?? 0,
        gscConnected: Boolean(gscQuery.data?.connected),
        gscClicks: gscQuery.data?.totals.clicks ?? 0,
        gscImpressions: gscQuery.data?.totals.impressions ?? 0,
        emailConnected: Boolean(emailMetrics.data?.data?.connected),
        emailDelivered: emailMetrics.data?.data?.totalSent ?? 0,
        emailCampaigns: emailMetrics.data?.data?.campaignCount ?? 0,
        currency,
        marketMode: merPayload?.marketMode,
        retailOrders: merPayload?.markets?.retail.orders,
        wholesaleOrders: merPayload?.markets?.wholesale.orders,
      }),
    [merPayload, blendedData, ga4MixData, gscQuery.data, emailMetrics.data, currency],
  );

  const operatorBlockers = useMemo(
    () =>
      deriveOperatorBlockers({
        storeOrders: merPayload?.orderCount ?? 0,
        pixelConversions: merPayload?.pixelConversions ?? blendedData?.totals?.totalConversions ?? 0,
        googleAdsConnected: mergeConnectedPaidPlatforms(
          (syncStatusQuery.data?.platforms ?? []).map((p) => p.platform),
          summarizeAccounts(accounts).connectedChannels,
        ).includes("google"),
        googleAdsSpend: googlePerf.data?.data?.totals?.totalSpend ?? 0,
        emailConnected: Boolean(emailMetrics.data?.data?.connected),
        emailDelivered: emailMetrics.data?.data?.totalSent ?? 0,
        tax: merPayload?.tax ?? 0,
        ga4Sessions: ga4MixData?.totals.sessions ?? 0,
        ga4Purchases: ga4MixData?.totals.purchases ?? 0,
        ga4UnassignedSessions: ga4Channels.find((c) => /unassigned/i.test(c.channel))?.sessions ?? 0,
      }),
    [
      merPayload,
      blendedData,
      syncStatusQuery.data,
      accounts,
      googlePerf.data,
      emailMetrics.data,
      ga4MixData,
      ga4Channels,
    ],
  );
  const deskReady = operatorDeskReady(merData, ga4Mix, gscQuery, emailMetrics);

  const showEmpty = !loading && !hasConnections;

  return (
    <div className="relative">
      {/* ambient platform glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <StaggerContainer className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <AnimatedSection variant="fadeInUp">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                {loading ? "Syncing your data…" : hasConnections ? "Live · Synced data" : "Awaiting first sync"}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                {mounted
                  ? new Date().getHours() < 12
                    ? "Good morning"
                    : new Date().getHours() < 18
                      ? "Good afternoon"
                      : "Good evening"
                  : "Good evening"}
                {org?.name ? ` · ${org.name}` : ""}
              </span>
            </h1>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-sm text-white/50">
                {mounted
                  ? new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "Loading..."}
              </p>
              <span className="text-white/20">·</span>
              <p className="text-sm text-white/50">
                {brandId
                  ? `Live ads and Woo for ${brands.find((b) => b.id === brandId)?.name ?? "this shop"}.`
                  : "Pixel, till, GA4, Search Console, and email — five clocks, never added."}
              </p>
            </div>
            {brands.length > 0 && (
              <div className="mt-3">
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
            )}
          </AnimatedSection>

          <AnimatedSection variant="fadeInUp" delay={0.1}>
            <div className="flex items-center gap-3">
              {paidCpcVsPrior && hasConnections ? (
              <div
                className={cn(GLASS, "group relative flex items-center gap-2.5 px-4 py-2.5 cursor-help")}
                title={`Paid CPC ${paidCpcVsPrior.down ? "down" : "up"} ${Math.abs(paidCpcVsPrior.pct).toFixed(1)}% vs the prior equal window`}
              >
                {paidCpcVsPrior.down ? (
                  <TrendingDown className="h-5 w-5 text-emerald-300" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-amber-300" />
                )}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">Paid CPC</p>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-sm font-semibold", paidCpcVsPrior.down ? "text-emerald-400" : "text-amber-400")}>
                      {paidCpcVsPrior.down ? "↓" : "↑"} {Math.abs(paidCpcVsPrior.pct).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-gray-950/95 px-3 py-1.5 text-xs text-white/80 opacity-0 shadow-xl backdrop-blur-xl transition-opacity group-hover:opacity-100">
                  vs prior window — not a market index
                </div>
              </div>
              ) : null}
              {/* Range selector */}
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              {/* Export toolbar — client-side CSV/PDF report download */}
              <ExportToolbar
                data={{
                  blendedPerf: blendedData,
                  accountSummary: accountSummary.data?.data,
                  topCampaigns: topCampaigns.data?.data,
                  range: `${days || 30}d`,
                  brandId: brandId || undefined,
                }}
              />
            </div>
          </AnimatedSection>
        </StaggerContainer>

        {/* Connect-accounts banner (dismissible) */}
        <AnimatePresence initial={false}>
          {!bannerDismissed && !loading && !hasConnections && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden"
            >
              <AnimatedSection variant="fadeInUp" delay={0.15}>
                <div className={cn(GLASS, "relative overflow-hidden p-5")}>
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
                  <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg">
                        <Plug className="h-5 w-5 text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Connect accounts to load this shop
                        </p>
                        <p className="mt-0.5 text-xs text-white/50">
                          Nothing on this desk is invented. Link Meta, Google,
                          TikTok or WooCommerce, then Sync Now.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/connections"
                        className="group flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 transition-transform hover:scale-[1.02]"
                      >
                        Connect now
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <button
                        onClick={() => setBannerDismissed(true)}
                        aria-label="Dismiss banner"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatedSection variant="fadeInUp" delay={0.08}>
          <LiveStrip
            metrics={loading || !hasConnections ? null : liveStrip}
            syncPct={syncMeta.pct}
            syncLabel={syncMeta.label}
            clock={clock}
            asOfLabel={liveAsOf}
          />
        </AnimatedSection>

        {/* Quick Actions Bar */}
        <AnimatedSection variant="fadeInUp" delay={0.15}>
          <div className={cn(GLASS, "p-4")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon, gradient }) => (
                <Link key={label} href={href} className="block">
                  <motion.span
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "group relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r px-4 py-3 text-sm font-semibold text-white shadow-lg transition-shadow hover:shadow-xl",
                      gradient,
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="relative z-10 text-xs sm:text-sm">{label}</span>
                    <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/10" />
                  </motion.span>
                </Link>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* KPI cards */}
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <AnimatedSection key={i} variant="fadeInUp" delay={i * 0.08} className="h-full">
                <SkeletonCard />
              </AnimatedSection>
            ))
          ) : showEmpty ? (
            <AnimatedSection variant="fadeInUp" className="sm:col-span-2 xl:col-span-4">
              <div className={cn(GLASS, "p-5")}>
                <EmptyState message="No data yet — connect your accounts and run your first sync to see live performance." />
              </div>
            </AnimatedSection>
          ) : (
            ([
              {
                label: "Total Spend",
                target: kpis.spend,
                prefix: symbol,
                delta: `${fmtPct(wow.spend)}%`,
                deltaPositive: wow.spend >= 0,
                icon: Wallet,
                accent: "bg-gradient-to-br from-orange-500 to-red-500",
              },
              {
                label: (merPayload?.orderCount ?? 0) > 0 ? "Store net" : "Pixel conversion value",
                target: kpis.revenue,
                prefix: symbol,
                delta: `${fmtPct(wow.revenue)}%`,
                deltaPositive: wow.revenue >= 0,
                icon: Banknote,
                accent: "bg-gradient-to-br from-emerald-500 to-teal-500",
              },
              {
                label: (merPayload?.orderCount ?? 0) > 0 ? "Store MER" : "Pixel ROAS",
                target: kpis.roas,
                suffix: "x",
                decimals: 2,
                delta: `${fmtSigned(wow.roas)}x`,
                deltaPositive: wow.roas >= 0,
                icon: Percent,
                accent: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
              },
              {
                label: merPayload?.cogsKnown ? "Profit after ads" : "Store − ads",
                target: kpis.profit,
                prefix: symbol,
                delta: `${fmtPct(wow.profit)}%`,
                deltaPositive: wow.profit >= 0,
                icon: TrendingUp,
                accent: "bg-gradient-to-br from-blue-500 to-cyan-500",
              },
            ] as const).map((card, i) => (
              <AnimatedSection
                key={card.label}
                variant="fadeInUp"
                delay={i * 0.08}
                className="h-full"
              >
                <StatCard {...card} />
              </AnimatedSection>
            ))
          )}
        </StaggerContainer>

        {!showEmpty && (
          <AnimatedSection variant="fadeInUp" delay={0.08}>
            <FiveClockStrip clocks={operatorClocks} ready={deskReady} />
          </AnimatedSection>
        )}
        {!showEmpty && merPayload?.markets ? (
          <AnimatedSection variant="fadeInUp" delay={0.085}>
            <MarketSplitStrip
              markets={merPayload.markets}
              adMarkets={merPayload.adMarkets}
              marketMode={merPayload.marketMode}
              unnamedAdSpend={merPayload.unnamedAdSpend}
            />
          </AnimatedSection>
        ) : null}
        {!showEmpty && operatorBlockers.length > 0 && (
          <AnimatedSection variant="fadeInUp" delay={0.09}>
            <OperatorBlockerBoard blockers={operatorBlockers} ready={deskReady} />
          </AnimatedSection>
        )}

        {!showEmpty && (merPayload?.orderCount ?? 0) > 0 && (
          <AnimatedSection variant="fadeInUp" delay={0.1}>
            <div className={cn(GLASS, "p-5")}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Till vs pixel</h2>
                  <p className="text-xs text-white/40">
                    Last-click from the till vs pixel vs GA4 ecommerce purchases. aMER is new-customer net / spend — not incremental ROAS.
                    Woo net is usually VAT-inclusive; Net ex VAT subtracts the tax on those orders.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/realtime" className="text-xs font-medium text-sky-300 hover:text-sky-200">
                    Realtime
                  </Link>
                  <Link href="/attribution" className="text-xs font-medium text-sky-300 hover:text-sky-200">
                    Attribution
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Store orders", value: (merPayload?.orderCount ?? 0).toLocaleString() },
                  { label: "Pixel conversions", value: (merPayload?.pixelConversions ?? 0).toFixed(0) },
                  {
                    label: "GA4 purchases",
                    value: (ga4MixData?.totals.purchases ?? 0).toLocaleString(),
                  },
                  { label: "Pixel ROAS", value: `${(merPayload?.platformROAS ?? 0).toFixed(2)}x` },
                  { label: "Store MER", value: `${(merPayload?.mer ?? 0).toFixed(2)}x` },
                  { label: "aMER", value: `${(merPayload?.amer ?? 0).toFixed(2)}x` },
                  {
                    label: "New-customer net",
                    value: `${((merPayload?.newCustomerShare ?? 0) * 100).toFixed(0)}% · ${fmtCurrency(merPayload?.newCustomerNet ?? 0)}`,
                  },
                  { label: "Net ex VAT", value: fmtCurrency(merPayload?.netExVat ?? 0) },
                  { label: "VAT in window", value: fmtCurrency(merPayload?.tax ?? 0) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/30">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-white tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
              {typeof merPayload?.breakEvenMer === "number" && merPayload.breakEvenMer > 0 && (
                <p className="mt-3 text-xs text-white/40">
                  Break-even MER at catalog GP margin is {merPayload.breakEvenMer.toFixed(1)}x.
                  Headline MER above that is not a scale signal while Direct and unpaid Google sit in the till.
                  {(merPayload.tax ?? 0) <= 0
                    ? " VAT on these Woo rows is 0, so Net ex VAT equals store net until total_tax is present."
                    : ""}
                </p>
              )}
              {mixChannels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {mixChannels.slice(0, 6).map((row) => (
                    <span
                      key={row.channel}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/70"
                    >
                      {row.label} {(row.share * 100).toFixed(0)}% · {row.orders}
                      {row.grossProfit > 0 ? ` · GP ${fmtCurrency(row.grossProfit)}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </AnimatedSection>
        )}

        {!showEmpty && insights.length > 0 && (
          <AnimatedSection variant="fadeInUp" delay={0.12}>
            <AiInsightsGrid insights={insights} />
          </AnimatedSection>
        )}

        {/* Revenue Goal Progress — hidden: no real endpoint yet */}

        {/* Multi-chart card */}
        <AnimatedSection variant="fadeInUp" delay={0.2}>
          <div className={cn(GLASS, "p-5 sm:p-6")}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Performance Analytics
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  Cross-channel trends, campaign composition &amp; spend
                  distribution
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {(
                  [
                    { id: "trends", label: "Trends", Icon: LineChartIcon },
                    { id: "campaigns", label: "Campaigns", Icon: BarChart3 },
                    { id: "platform", label: "Platforms", Icon: PieChartIcon },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setChartTab(id)}
                    className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    {chartTab === id && (
                      <motion.span
                        layoutId="chartTabPill"
                        className="absolute inset-0 rounded-lg bg-white/10"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5" />
                    <span
                      className={cn(
                        "relative z-10",
                        chartTab === id
                          ? "text-white"
                          : "text-white/50 hover:text-white/80",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* legends */}
            {chartTab === "trends" && (
              <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Spend (left axis)
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  Revenue (right axis)
                </span>
              </div>
            )}
            {chartTab === "campaigns" && (
              <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-white/50">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS.Meta }}
                  />
                  Meta
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS.Google }}
                  />
                  Google
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS.TikTok }}
                  />
                  TikTok
                </span>
              </div>
            )}

            <div className="h-80 w-full">
              {loading ? (
                <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.04]" />
              ) : showEmpty || sliced.length === 0 ? (
                <EmptyState message="No performance data yet — connect your ad accounts and run a sync to populate trends." />
              ) : chartTab === "trends" ? (
                <PerformanceChart data={sliced} />
              ) : chartTab === "campaigns" ? (
                <CampaignChart data={sliced} />
              ) : (
                <PlatformChart data={platformBreakdown} />
              )}
            </div>

            {chartTab === "platform" && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-4 text-xs text-white/40">
                <span className="font-medium uppercase tracking-widest">
                  Channels
                </span>
                {connectedChannels.map((p) => (
                  <span key={p} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[p] }}
                    />
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </AnimatedSection>

        {!showEmpty && (
          <AnimatedSection variant="fadeInUp" delay={0.18}>
            <div className={cn(GLASS, "p-5 sm:p-6")}>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">
                  Spend, pixel value &amp; pixel ROAS
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  Daily blended series for the selected range
                </p>
              </div>
              <div className="h-80 w-full">
                {loading || composedSeries.length === 0 ? (
                  <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.04]" />
                ) : (
                  <ComposedRoasChart data={composedSeries} />
                )}
              </div>
            </div>
          </AnimatedSection>
        )}

        {!showEmpty && (
          <div className="grid gap-6 lg:grid-cols-2">
            <AnimatedSection variant="fadeInUp" delay={0.2}>
              <HourlyOrWeekdayChart hourly={hourly} weekday={weekday} />
            </AnimatedSection>
            <AnimatedSection variant="fadeInUp" delay={0.22}>
              <AttributionFunnelWidget stages={funnelStages} />
            </AnimatedSection>
          </div>
        )}

        {/* Platform Performance Grid */}
        <AnimatedSection variant="fadeInUp" delay={0.22}>
          <div className={cn(GLASS, "p-5")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Platform Performance</h2>
                <p className="mt-0.5 text-xs text-white/40">Spend breakdown by channel this period</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[120px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                    <div className="mt-4 h-6 w-20 animate-pulse rounded bg-white/10" />
                  </div>
                ))
              ) : platformPerf.every((p) => p.spend === 0) ? (
                <div className="sm:col-span-2 xl:col-span-3">
                  <EmptyState message="No platform spend recorded yet — connect ad accounts and sync metrics." />
                </div>
              ) : (
                platformPerf
                  .filter((p) => {
                    if (p.spend > 0) return true;
                    if (p.name !== "Google") return false;
                    return (syncStatusQuery.data?.platforms ?? []).some(
                      (row) => row.platform.toLowerCase() === "google",
                    );
                  })
                  .map((p) => {
                  const color = PLATFORM_COLORS[p.name];
                  return (
                    <motion.div
                      key={p.name}
                      whileHover={{ y: -2 }}
                      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-300"
                      style={{ boxShadow: `0 0 0 0 ${color}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 24px -6px ${color}44`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 0 ${color}`; }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: `${color}22`, color }}
                          >
                            {p.name[0]}
                          </span>
                          <span className="text-sm font-medium text-white/80">{p.name}</span>
                        </div>
                        <div className="h-[30px] w-[50px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[...p.data]}>
                              <Line
                                type="monotone"
                                dataKey="v"
                                stroke={color}
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <span className="text-lg font-bold text-white tabular-nums">{fmtCurrency(p.spend)}</span>
                          {p.spend <= 0 && p.name === "Google" ? (
                            <p className="mt-0.5 text-[10px] text-white/40">OAuth on · no spend rows</p>
                          ) : null}
                        </div>
                        {p.spend > 0 ? (
                          <span className={cn("text-xs font-semibold tabular-nums", p.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {p.change >= 0 ? "+" : ""}{p.change.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-white/35">—</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* Email Marketing Panel */}
        <AnimatedSection variant="fadeInUp" delay={0.24}>
          <EmailMetricsPanel startDate={start} endDate={end} brandId={brandId || undefined} />
        </AnimatedSection>

        {/* Recent Activity Feed */}
        <AnimatedSection variant="fadeInUp" delay={0.27}>
          <ActivityFeed items={activityItems} />
        </AnimatedSection>

        {/* Top campaigns table */}
        <AnimatedSection variant="fadeInUp" delay={0.25}>
          <div className={cn(GLASS, "overflow-hidden")}>
            <div className="flex items-center justify-between p-5 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Top Campaigns
                </h2>
                <p className="mt-0.5 text-xs text-white/40">
                  Ranked by spend this period
                </p>
              </div>
              <Link
                href="/campaigns"
                className="flex items-center gap-1 text-xs font-medium text-white/60 transition-colors hover:text-white"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-white/5 text-[11px] uppercase tracking-widest text-white/35">
                    <th className="px-5 py-2.5 font-medium">Campaign</th>
                    <th className="px-5 py-2.5 font-medium">Platform</th>
                    <th className="px-5 py-2.5 text-right font-medium">Spend</th>
                    <th className="px-5 py-2.5 text-right font-medium">
                      Pixel revenue
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium">Pixel ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonRow key={i} columns={5} />
                      ))
                    : topCampaignsMapped.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState message="No campaigns found for this period — connect an ad account and sync metrics." />
                        </td>
                      </tr>
                    ) : topCampaignsMapped.map((c) => (
                    <tr
                      key={`${c.platform}-${c.id}`}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              c.status === "active"
                                ? "bg-emerald-400"
                                : "bg-amber-400",
                            )}
                          />
                          <div>
                            <p className="font-medium text-white">{c.name}</p>
                            <p className="text-xs text-white/40">
                              {c.status === "active" ? "Active" : "Paused"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <PlatformBadge platform={c.platform} />
                      </td>
                      <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                        {fmtCurrency(c.spend)}
                      </td>
                      <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                        {fmtCurrency(c.revenue)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-white tabular-nums">
                            {c.roas.toFixed(2)}x
                          </span>
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/5 sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min((c.roas / 4) * 100, 100)}%`,
                                backgroundColor: PLATFORM_COLORS[c.platform],
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>

        {/* Top Performing Creatives — hidden: no real endpoint yet */}

        {/* Competitor Activity Alerts — hidden: no real endpoint yet */}

        {/* Revenue Forecast Mini-Chart — hidden: no real endpoint yet */}

        {/* Quick Stats Footer — hidden: no real endpoint yet */}
      </div>
    </div>
  );
}
