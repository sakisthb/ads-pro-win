"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import {
  Users,
  Target,
  Crown,
  AlertTriangle,
  Plus,
  RefreshCw,
  Layers,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Plug,
  ArrowRight,
  Globe,
  MapPin,
  MonitorSmartphone,
  Smartphone,
  Clock,
  LayoutGrid,
  Repeat,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  AnimatedSection,
  StaggerContainer,
  fadeInUp,
} from "@/components/ui/animated-section";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { useCurrency } from "@/components/providers/currency";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { buildAudienceOperatorRecs } from "@/lib/dashboard-insights";

// ---------------------------------------------------------------------------
// Demo data — Audience Intelligence snapshot
// ---------------------------------------------------------------------------

// Demo workspace only — never render these on a live shop.
const DEMO_SEGMENTS = [
  { name: "Lookalike Expansion", users: 2.4, unit: "M", growth: 18.2, roas: 3.8, cpa: 12.4, cvr: 2.1, icon: Users, color: "#22D3EE", note: "Seed: top 5% purchasers" },
  { name: "Retargeting Pool", users: 890, unit: "K", growth: 9.4, roas: 6.2, cpa: 8.9, cvr: 5.8, icon: Target, color: "#3B82F6", note: "30-day site engagers" },
  { name: "High-Value Customers", users: 34, unit: "K", growth: 4.1, roas: 9.4, cpa: 21.7, cvr: 8.6, icon: Crown, color: "#F59E0B", note: "LTV > €1,200" },
  { name: "At-Risk Churning", users: 12, unit: "K", growth: -12.8, roas: 2.1, cpa: 14.3, cvr: 1.2, icon: AlertTriangle, color: "#F43F5E", note: "No purchase in 90 days" },
];

const DEMO_ROAS_DATA = [
  { segment: "Lookalike", roas: 3.8, color: "#22D3EE" },
  { segment: "Retargeting", roas: 6.2, color: "#3B82F6" },
  { segment: "High-Value", roas: 9.4, color: "#F59E0B" },
  { segment: "At-Risk", roas: 2.1, color: "#F43F5E" },
];

const DEMO_OVERLAPS = [
  { pair: "Retargeting ∩ Lookalike", size: "142K", action: "Exclude from prospecting" },
  { pair: "Retargeting ∩ High-Value", size: "8.4K", action: "Promote to VIP tier" },
  { pair: "Lookalike ∩ High-Value", size: "3.1K", action: "Expand seed audience" },
  { pair: "All three segments", size: "1.2K", action: "Frequency cap 2 / week" },
];

const DEMO_SOURCES = [
  { name: "Meta", color: "#1877F2", synced: "2 min ago" },
  { name: "Google", color: "#4285F4", synced: "6 min ago" },
  { name: "TikTok", color: "#FF0050", synced: "11 min ago" },
  { name: "WooCommerce", color: "#96588A", synced: "1 min ago" },
];

/** "publisher_platform" → "Publisher Platform" style labels. Words that
 *  already carry casing (e.g. "iPhone", "Android Smartphone") are kept. */
const humanizeLabel = (l: string) =>
  l
    .split(/[\s_]+/)
    .map((w) =>
      w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w,
    )
    .join(" ");

// ---------------------------------------------------------------------------
// Live breakdown building blocks (real-organization branch)
// ---------------------------------------------------------------------------

interface BreakdownBucket {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface HourlyBucket {
  hour: string;
  spend: number;
  impressions: number;
}

/** One age × gender combination cell from the live Meta breakdown. */
interface AgeGenderRow {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
}

/** One frequency_value bucket ("1", "6-10", "21+") with its unique users. */
interface FrequencyReachRow {
  bucket: string;
  reach: number;
}

/** Horizontal bar-list card: label + spend share % bar + spend € + impressions.
 *  Share is computed against the sum of the (already top-N sliced) items. */
function BreakdownBarCard({
  title,
  subtitle,
  icon: Icon,
  items,
  barClass = "bg-gradient-to-r from-cyan-400 to-blue-500",
  accentClass = "text-cyan-300",
  iconClass = "text-cyan-400",
  formatLabel,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: BreakdownBucket[];
  barClass?: string;
  accentClass?: string;
  iconClass?: string;
  formatLabel?: (label: string) => string;
}) {
  const { formatExact } = useCurrency();
  const totalSpend = items.reduce((s, i) => s + i.spend, 0);
  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
      </div>
      <p className="mb-5 text-xs text-zinc-400">{subtitle}</p>
      <div className="space-y-3.5">
        {items.map((item) => {
          const share = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;
          const label = formatLabel ? formatLabel(item.label) : item.label;
          return (
            <div key={item.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-white">{label}</span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {formatExact(item.spend)} · <span className={`font-semibold ${accentClass}`}>{share.toFixed(1)}%</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(share, 1)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`h-full rounded-full ${barClass}`}
                />
              </div>
              <p className="mt-1 text-[10px] tabular-nums text-zinc-500">
                {item.impressions.toLocaleString()} impressions
                {item.clicks > 0 && <> · {item.clicks.toLocaleString()} clicks</>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Hourly chart: XAxis labels are plain "HH" strings, sparse via interval. */
function HourlyChart({
  data,
  dataKey,
  title,
  color,
  formatValue,
}: {
  data: HourlyBucket[];
  dataKey: "impressions" | "spend";
  title: string;
  color: string;
  formatValue: (v: number) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">{title}</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="hour"
              interval={3}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                dataKey === "impressions" && v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload, label }: TooltipContentProps<number, string>) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-white/10 bg-gray-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
                    <p className="mb-1 font-medium text-white/80">{label}:00 – {label}:59</p>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-white/50">{title}</span>
                      <span className="ml-auto font-semibold tabular-nums text-white">
                        {formatValue(Number(payload[0]?.value))}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey={dataKey} fill={color} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Demographics matrix: rows = age buckets (sorted by numeric start),
 *  columns = genders. Cell shading intensity scales with the cell's share of
 *  the max cell spend (opacity 0.1–0.6); the top cell gets a subtle ring. A
 *  side column summarizes total reach + average frequency per age row. */
function DemographicsMatrix({ rows }: { rows: AgeGenderRow[] }) {
  const { formatExact } = useCurrency();
  const ageStart = (age: string) => {
    const match = /^(\d+)/.exec(age);
    return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const ages = [...new Set(rows.map((r) => r.age))].sort(
    (a, b) => ageStart(a) - ageStart(b),
  );
  const genders = [...new Set(rows.map((r) => r.gender))].sort();
  const cellMap = new Map(rows.map((r) => [`${r.age}-${r.gender}`, r]));
  const maxCellSpend = rows.reduce((m, r) => Math.max(m, r.spend), 0);
  const maxCellKey = rows.reduce<{ key: string; spend: number }>(
    (best, r) =>
      r.spend > best.spend ? { key: `${r.age}-${r.gender}`, spend: r.spend } : best,
    { key: "", spend: -1 },
  ).key;

  // Per-age summary: total reach across genders + blended average frequency
  // (impressions / reach) across the row's cells.
  const summaryByAge = new Map(
    ages.map((age) => {
      const cells = rows.filter((r) => r.age === age);
      const reach = cells.reduce((s, c) => s + c.reach, 0);
      const impressions = cells.reduce((s, c) => s + c.impressions, 0);
      return [age, { reach, avgFrequency: reach > 0 ? impressions / reach : 0 }];
    }),
  );

  const gridCols = `72px repeat(${genders.length}, minmax(0, 1fr)) 132px`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="mb-1 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white/80">Demographics: Age × Gender</h2>
      </div>
      <p className="mb-5 text-xs text-zinc-400">
        Spend intensity by age and gender — shading scales with the top cell
      </p>

      {/* Header row */}
      <div className="grid gap-2 pb-2" style={{ gridTemplateColumns: gridCols }}>
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">Age</span>
        {genders.map((g) => (
          <span
            key={g}
            className="text-center text-[10px] font-medium uppercase tracking-wider capitalize text-white/30"
          >
            {g}
          </span>
        ))}
        <span className="text-right text-[10px] font-medium uppercase tracking-wider text-white/30">
          Reach · Freq
        </span>
      </div>

      {/* Matrix rows */}
      <div className="space-y-2">
        {ages.map((age) => {
          const summary = summaryByAge.get(age) ?? { reach: 0, avgFrequency: 0 };
          return (
            <div
              key={age}
              className="grid items-stretch gap-2"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span className="flex items-center text-xs font-semibold tabular-nums text-white">
                {age}
              </span>
              {genders.map((gender) => {
                const key = `${age}-${gender}`;
                const cell = cellMap.get(key);
                const isMax = key === maxCellKey;
                // Opacity 0.1–0.6 proportional to the cell's share of max spend.
                const intensity =
                  cell && maxCellSpend > 0
                    ? 0.1 + 0.5 * (cell.spend / maxCellSpend)
                    : 0;
                return (
                  <div
                    key={key}
                    className={`flex flex-col items-center justify-center rounded-xl px-3 py-2.5 ${
                      isMax
                        ? "border border-cyan-300/50 ring-1 ring-cyan-300/40"
                        : "border border-transparent"
                    }`}
                    style={
                      cell
                        ? { backgroundColor: `rgba(34, 211, 238, ${intensity.toFixed(3)})` }
                        : undefined
                    }
                  >
                    {cell ? (
                      <>
                        <span className="text-sm font-bold tabular-nums text-white">
                          {formatExact(cell.spend)}
                        </span>
                        <span className="text-[9px] tabular-nums text-white/50">
                          {cell.reach.toLocaleString()} reach
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-col items-end justify-center rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                <span className="text-xs font-semibold tabular-nums text-white">
                  {summary.reach.toLocaleString()}
                </span>
                <span className="text-[9px] tabular-nums text-zinc-400">
                  {summary.avgFrequency.toFixed(1)}× avg freq
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-zinc-500">
        Shading scales with each cell&apos;s share of the top age × gender cell — the outlined cell is your strongest demographic.
      </p>
    </div>
  );
}

/** Frequency distribution: horizontal bars of unique users per frequency
 *  bucket ("1×", "2×", … "21+×"), sorted by numeric bucket start, with a
 *  one-line insight about the share that saw ads only once. */
function FrequencyDistribution({ buckets }: { buckets: FrequencyReachRow[] }) {
  const totalReach = buckets.reduce((s, b) => s + b.reach, 0);
  const onceReach = buckets.find((b) => b.bucket === "1")?.reach ?? 0;
  const onceShare = totalReach > 0 ? (onceReach / totalReach) * 100 : 0;

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="mb-1 flex items-center gap-2">
        <Repeat className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-white/80">Frequency Distribution</h2>
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        Unique users by how many times they saw your ads
      </p>

      {onceShare > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-200">
          <Sparkles className="h-3 w-3 shrink-0 text-cyan-300" />
          <span>
            <span className="font-bold tabular-nums">{onceShare.toFixed(0)}%</span> of
            your audience saw ads only once
          </span>
        </div>
      )}

      <div className="space-y-3.5">
        {buckets.map((b) => {
          const share = totalReach > 0 ? (b.reach / totalReach) * 100 : 0;
          return (
            <div key={b.bucket}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold tabular-nums text-white">{b.bucket}×</span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {b.reach.toLocaleString()} users ·{" "}
                  <span className="font-semibold text-blue-300">{share.toFixed(1)}%</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(share, 1)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AudiencesPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { formatExact: fmtEuro, symbol } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  // -- Date range state (default: last 30 days; set post-mount so the SSR
  //    HTML never embeds a client-computed date).
  const [range, setRange] = useState<DateRangeValue>({
    startDate: "",
    endDate: "",
  });
  useEffect(() => {
    setRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);
  const rangeValid = range.startDate !== "" && range.endDate !== "";

  // -- Live Meta audience breakdown (hooks-first; gated via `enabled`).
  const breakdown = api.marketing.getAudienceBreakdown.useQuery(
    { ...range, ...shopQuery },
    {
      enabled: !isLoading && !isDemo && rangeValid && shopReady,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const connectionsQuery = api.connections.list.useQuery(
    {},
    { enabled: !isLoading && !isDemo, retry: false },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Real organizations — live Meta audience breakdown
  // -------------------------------------------------------------------------
  if (!isDemo) {
    const data = breakdown.data;
    const ages = data?.ages ?? [];
    const genders = data?.genders ?? [];
    const totalAgeSpend = ages.reduce((s, a) => s + a.spend, 0);
    const totalGenderSpend = genders.reduce((s, g) => s + g.spend, 0);
    // Top-N slices live in the UI layer (backend returns full lists).
    const countries = (data?.countries ?? []).slice(0, 10);
    const regions = (data?.regions ?? []).slice(0, 10);
    const platforms = (data?.platforms ?? []).slice(0, 10);
    const devicePlatforms = (data?.devicePlatforms ?? []).slice(0, 10);
    const impressionDevices = (data?.impressionDevices ?? []).slice(0, 8);
    const hourly = data?.hourly ?? [];
    const ageGender = data?.ageGender ?? [];
    const frequencyReach = data?.frequencyReach ?? [];
    const platformDevice = data?.platformDevice ?? [];
    const showData = breakdown.isSuccess && data?.connected === true;
    const wooConnected = (connectionsQuery.data?.connections ?? []).some(
      (c) => c.platform === "woocommerce" && c.isConnected,
    );
    const operatorRecs = buildAudienceOperatorRecs({
      countries: data?.countries ?? [],
      ages,
      frequencyReach,
      wooConnected,
    });
    const act = (data?.accountId ?? "").replace(/^act_/i, "");
    const adsManagerAudiences = act
      ? `https://adsmanager.facebook.com/adsmanager/manage/audiences?act=${act}`
      : "https://adsmanager.facebook.com/adsmanager/manage/audiences";

    return (
      <div className="relative">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl space-y-6 px-1">
          {/* Header + date range picker */}
          <AnimatedSection>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Meta audience insights</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Audience Intelligence</span>
                </h1>
                <p className="text-sm text-zinc-400">
                  Meta delivery split for this shop — pixel purchases, not till orders, not GA4.
                </p>
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
              <div className="flex items-center justify-end">
                <DateRangePicker value={range} onChange={setRange} />
              </div>
            </div>
          </AnimatedSection>

          {/* Loading */}
          {(!shopReady || breakdown.isLoading) && (
            <AnimatedSection>
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-white/10" />
                ))}
              </div>
            </AnimatedSection>
          )}

          {/* Error */}
          {breakdown.isError && (
            <AnimatedSection>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300 backdrop-blur-xl">
                Failed to load the audience breakdown:{" "}
                {breakdown.error?.message ?? "unknown error"}. Check your Meta
                connection and try again.
              </div>
            </AnimatedSection>
          )}

          {/* Not connected → point to Connections */}
          {breakdown.isSuccess && data?.connected === false && (
            <AnimatedSection>
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur-xl">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                  <Plug className="h-6 w-6 text-cyan-300" />
                </span>
                <div>
                  <p className="text-base font-semibold text-white">Connect Meta Ads from Connections</p>
                  <p className="mt-1 max-w-md text-sm text-zinc-400">
                    Link your Meta ad account to unlock live age &amp; gender
                    audience breakdowns for the selected period.
                  </p>
                </div>
                <Link
                  href="/connections"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02]"
                >
                  Go to Connections
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AnimatedSection>
          )}

          {/* Connected but no spend in range */}
          {showData && ages.length === 0 && genders.length === 0 && (
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-zinc-400 backdrop-blur-xl">
                No Meta delivery data for this period — widen the date range or
                run a sync from Connections.
              </div>
            </AnimatedSection>
          )}

          {/* Age distribution + gender split */}
          {showData && (ages.length > 0 || genders.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Age distribution — horizontal bars, spend share % */}
              <AnimatedSection className="lg:col-span-7">
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="mb-1 flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <h2 className="text-sm font-semibold text-white/80">Age Distribution</h2>
                  </div>
                  <p className="mb-5 text-xs text-zinc-400">Spend share by age group for the selected period</p>
                  <div className="space-y-3.5">
                    {ages.map((a) => {
                      const share = totalAgeSpend > 0 ? (a.spend / totalAgeSpend) * 100 : 0;
                      return (
                        <div key={a.label}>
                          <div className="mb-1 flex items-baseline justify-between text-xs">
                            <span className="font-semibold text-white">{a.label}</span>
                            <span className="tabular-nums text-zinc-400">
                              {fmtEuro(a.spend)} · <span className="font-semibold text-cyan-300">{share.toFixed(1)}%</span>
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(share, 1)}%` }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                            />
                          </div>
                          <p className="mt-1 text-[10px] tabular-nums text-zinc-500">
                            {a.impressions.toLocaleString()} impressions · {a.clicks.toLocaleString()} clicks · {a.conversions.toLocaleString()} pixel purchases
                          </p>
                          {(a.reach > 0 || a.frequency > 0) && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {a.reach > 0 && (
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium tabular-nums text-zinc-400">
                                  {a.reach.toLocaleString()} reach
                                </span>
                              )}
                              {a.frequency > 0 && (
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium tabular-nums text-zinc-400">
                                  {a.frequency.toFixed(1)}× avg freq
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AnimatedSection>

              {/* Gender split cards */}
              <AnimatedSection className="lg:col-span-5" delay={0.1}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="mb-1 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white/80">Gender Split</h2>
                  </div>
                  <p className="mb-5 text-xs text-zinc-400">Where the budget lands across genders</p>
                  <div className="space-y-3">
                    {genders.map((g) => {
                      const share = totalGenderSpend > 0 ? (g.spend / totalGenderSpend) * 100 : 0;
                      const ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0;
                      return (
                        <div key={g.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold capitalize text-white">{g.label}</span>
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-cyan-300">
                              {share.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">Spend</p>
                              <p className="text-xs font-semibold tabular-nums text-white">{fmtEuro(g.spend)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">CTR</p>
                              <p className="text-xs font-semibold tabular-nums text-white">{ctr.toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">Impressions</p>
                              <p className="text-xs font-semibold tabular-nums text-white">{g.impressions.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">Pixel purchases</p>
                              <p className="text-xs font-semibold tabular-nums text-white">{g.conversions.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">Reach</p>
                              <p className="text-xs font-semibold tabular-nums text-white">
                                {g.reach > 0 ? g.reach.toLocaleString() : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wider text-white/30">Avg freq.</p>
                              <p className="text-xs font-semibold tabular-nums text-white">
                                {g.frequency > 0 ? `${g.frequency.toFixed(1)}×` : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {genders.length === 0 && (
                      <p className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-xs text-zinc-500">
                        No gender breakdown available for this period.
                      </p>
                    )}
                  </div>
                </div>
              </AnimatedSection>
            </div>
          )}

          {/* Geography — countries & regions */}
          {showData && (countries.length > 0 || regions.length > 0) && (
            <AnimatedSection delay={0.15}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {countries.length > 0 && (
                  <BreakdownBarCard
                    title="Countries"
                    subtitle="Where spend is delivered, top 10 by spend"
                    icon={Globe}
                    items={countries}
                  />
                )}
                {regions.length > 0 && (
                  <BreakdownBarCard
                    title="Regions"
                    subtitle="Sub-country delivery, top 10 by spend"
                    icon={MapPin}
                    iconClass="text-blue-400"
                    accentClass="text-blue-300"
                    barClass="bg-gradient-to-r from-blue-400 to-indigo-500"
                    items={regions}
                  />
                )}
              </div>
            </AnimatedSection>
          )}

          {/* Platforms & devices */}
          {showData &&
            (platforms.length > 0 ||
              devicePlatforms.length > 0 ||
              impressionDevices.length > 0) && (
              <AnimatedSection delay={0.2}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {platforms.length > 0 && (
                    <BreakdownBarCard
                      title="Platforms"
                      subtitle="Publisher platform spend split"
                      icon={Layers}
                      items={platforms}
                      formatLabel={humanizeLabel}
                    />
                  )}
                  {devicePlatforms.length > 0 && (
                    <BreakdownBarCard
                      title="Device Platforms"
                      subtitle="Mobile app vs web vs desktop"
                      icon={MonitorSmartphone}
                      iconClass="text-blue-400"
                      accentClass="text-blue-300"
                      barClass="bg-gradient-to-r from-blue-400 to-indigo-500"
                      items={devicePlatforms}
                      formatLabel={humanizeLabel}
                    />
                  )}
                  {impressionDevices.length > 0 && (
                    <BreakdownBarCard
                      title="Impression Devices"
                      subtitle="Top 8 devices serving impressions"
                      icon={Smartphone}
                      iconClass="text-violet-400"
                      accentClass="text-violet-300"
                      barClass="bg-gradient-to-r from-violet-400 to-fuchsia-500"
                      items={impressionDevices}
                      formatLabel={humanizeLabel}
                    />
                  )}
                </div>
              </AnimatedSection>
            )}

          {/* Peak hours — impressions & spend by hour */}
          {showData && hourly.length > 0 && (
            <AnimatedSection delay={0.25}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white/80">Peak Hours</h2>
                </div>
                <p className="mb-5 text-xs text-zinc-400">
                  Delivery by hour of day (advertiser time zone) — schedule around the peaks
                </p>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <HourlyChart
                    data={hourly}
                    dataKey="impressions"
                    title="Impressions by hour"
                    color="#22D3EE"
                    formatValue={(v) => v.toLocaleString()}
                  />
                  <HourlyChart
                    data={hourly}
                    dataKey="spend"
                    title="Spend by hour"
                    color="#3B82F6"
                    formatValue={(v) => fmtEuro(v)}
                  />
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Demographics matrix — age × gender spend intensity */}
          {showData && ageGender.length > 0 && (
            <AnimatedSection delay={0.3}>
              <DemographicsMatrix rows={ageGender} />
            </AnimatedSection>
          )}

          {/* Frequency distribution + platform × device combos */}
          {showData && (frequencyReach.length > 0 || platformDevice.length > 0) && (
            <AnimatedSection delay={0.35}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {frequencyReach.length > 0 && (
                  <FrequencyDistribution buckets={frequencyReach} />
                )}
                {platformDevice.length > 0 && (
                  <BreakdownBarCard
                    title="Platform × Device Combos"
                    subtitle="Where spend lands across publisher platform and device, top 8"
                    icon={Boxes}
                    iconClass="text-amber-400"
                    accentClass="text-amber-300"
                    barClass="bg-gradient-to-r from-amber-400 to-orange-500"
                    items={platformDevice.slice(0, 8).map((c) => ({
                      label: `${humanizeLabel(c.platform)} · ${humanizeLabel(c.device)}`,
                      spend: c.spend,
                      impressions: c.impressions,
                      clicks: 0,
                      conversions: 0,
                    }))}
                  />
                )}
              </div>
            </AnimatedSection>
          )}

          {showData && operatorRecs.length > 0 && (
            <AnimatedSection delay={0.4}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white/80">Operator actions</h2>
                </div>
                <p className="mb-4 text-xs text-zinc-400">
                  Advice only — this desk does not create, exclude, or lookalike audiences on Meta.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {operatorRecs.map((rec) => (
                    <div key={rec.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{rec.title}</p>
                        <Link href={rec.href} className="shrink-0 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">
                          {rec.actionLabel}
                        </Link>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">{rec.description}</p>
                    </div>
                  ))}
                </div>
                <a
                  href={adsManagerAudiences}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"
                >
                  Open Meta Ads Manager audiences
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Demo workspace · 2.4M Lookalike Expansion is sample theater. Live BAGTOBAG Audiences is Meta spend breakdown only.
        </div>
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Cross-platform audience intelligence</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Audience Intelligence</span>
              </h1>
              <p className="text-sm text-zinc-400">Demo theater — 2.4M lookalikes are sample, not BAGTOBAG Meta audiences.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 backdrop-blur-xl transition-colors hover:border-white/20 hover:text-white">
                <RefreshCw className="h-4 w-4" />
                Sync
              </button>
              <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02]">
                <Plus className="h-4 w-4" />
                Create Segment
              </button>
            </div>
          </div>
        </AnimatedSection>

        {/* Segment cards */}
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            return (
              <motion.div key={seg.name} variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-white/20">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${seg.color}20` }}>
                    <Icon className="h-5 w-5" style={{ color: seg.color }} />
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${seg.growth >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {seg.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(seg.growth)}%
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{seg.name}</h3>
                <p className="text-[10px] text-white/30">{seg.note.replaceAll("€", symbol)}</p>
                <p className="mt-3 text-2xl font-bold text-white">
                  <AnimatedCounter target={seg.users} decimals={seg.unit === "M" ? 1 : 0} suffix={seg.unit} className="tabular-nums" />
                  <span className="ml-1.5 text-xs font-medium text-white/40">users</span>
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">ROAS</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{seg.roas.toFixed(1)}x</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">CPA</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{fmtEuro(seg.cpa)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">CVR</p>
                    <p className="text-xs font-semibold text-white tabular-nums">{seg.cvr.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: seg.color }} />
              </motion.div>
            );
          })}
        </StaggerContainer>

        {/* Overlap analysis + insights */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnimatedSection className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white/80">Overlap Analysis</h2>
              </div>
              <p className="text-xs text-zinc-400">Where segments intersect — dedupe spend before scaling</p>
              <div className="relative mx-auto mt-6 aspect-square w-full max-w-[330px]">
                <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="absolute left-0 top-0 h-44 w-44 rounded-full border border-cyan-400/50 bg-cyan-400/10 mix-blend-screen" />
                <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.25 }} className="absolute right-0 top-0 h-44 w-44 rounded-full border border-blue-500/50 bg-blue-500/10 mix-blend-screen" />
                <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.4 }} className="absolute bottom-0 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-400/10 mix-blend-screen" />
                <span className="absolute left-1 top-16 w-20 text-center text-[11px] font-bold text-cyan-300">2.4M<span className="block text-[9px] font-normal text-white/40">Lookalike</span></span>
                <span className="absolute right-1 top-16 w-20 text-center text-[11px] font-bold text-blue-300">890K<span className="block text-[9px] font-normal text-white/40">Retargeting</span></span>
                <span className="absolute bottom-4 left-1/2 w-20 -translate-x-1/2 text-center text-[11px] font-bold text-amber-300">34K<span className="block text-[9px] font-normal text-white/40">High-Value</span></span>
                <span className="absolute left-1/2 top-[40%] w-16 -translate-x-1/2 text-center text-[10px] font-bold text-white/85">1.2K<span className="block text-[8px] font-normal text-white/40">all three</span></span>
              </div>
            </div>
          </AnimatedSection>
          <AnimatedSection className="lg:col-span-5" delay={0.1}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white/80">Overlap Insights</h2>
              </div>
              <div className="space-y-3">
                {DEMO_OVERLAPS.map((o) => (
                  <div key={o.pair} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/10">
                    <div>
                      <p className="text-xs font-semibold text-white">{o.pair}</p>
                      <p className="text-[10px] text-zinc-400">{o.action}</p>
                    </div>
                    <span className="text-sm font-bold text-cyan-300 tabular-nums">{o.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Segment performance — ROAS */}
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white/80">Segment Performance — ROAS</h2>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Return on ad spend by segment, last 30 days</p>
              </div>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold text-cyan-300">LAST 30 DAYS</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DEMO_ROAS_DATA} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="segment" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}x`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload, label }: TooltipContentProps<number, string>) => {
                      if (!active || !payload?.length) return null;
                      const color = DEMO_ROAS_DATA.find((d) => d.segment === label)?.color ?? "#22D3EE";
                      return (
                        <div className="rounded-lg border border-white/10 bg-gray-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
                          <p className="mb-1 font-medium text-white/80">{label}</p>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-white/50">ROAS</span>
                            <span className="ml-auto font-semibold text-white tabular-nums">{Number(payload[0]?.value).toFixed(1)}x</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={5.4} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" label={{ value: "Blended 5.4x", position: "insideTopRight", fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                  <Bar dataKey="roas" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {DEMO_ROAS_DATA.map((d) => (
                      <Cell key={d.segment} fill={d.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>

        {/* Sync sources */}
        <AnimatedSection>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <span className="text-xs font-medium text-white/50">Sync sources</span>
            <div className="flex flex-wrap gap-3">
              {DEMO_SOURCES.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs font-semibold text-white">{s.name}</span>
                  <span className="text-[10px] text-zinc-400">{s.synced}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
