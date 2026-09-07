"use client";

import Link from "next/link";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  Activity,
  ArrowRight,
  Brain,
  Clock,
  MousePointer,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { useCurrency } from "@/components/providers/currency";
import {
  type ActivityItem,
  type DerivedInsight,
  type FunnelStage,
  type LiveStripMetrics,
} from "@/lib/dashboard-insights";

const GLASS =
  "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

function MiniTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { format: fmtEuro } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      {label && <p className="mb-1.5 font-medium text-white/70">{label}</p>}
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/50">{entry.name}:</span>
          <span className="ml-auto font-semibold text-white tabular-nums">
            {entry.name === "Pixel ROAS"
              ? `${Number(entry.value).toFixed(2)}x`
              : entry.name === "Spend" || entry.name === "Pixel value"
                ? fmtEuro(Number(entry.value))
                : Number(entry.value).toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LiveStrip({
  metrics,
  syncPct,
  syncLabel,
  clock,
  asOfLabel,
}: {
  metrics: LiveStripMetrics | null;
  syncPct: number;
  syncLabel: string;
  clock: string;
  asOfLabel: string;
}) {
  const { symbol } = useCurrency();
  const dayWord = asOfLabel === "today" ? "today" : asOfLabel;
  const cells = [
    {
      label: asOfLabel === "today" ? "Clicks today" : `Clicks ${dayWord}`,
      value: metrics?.clicksToday ?? null,
      delta: metrics ? metrics.clicksDelta : null,
      icon: MousePointer,
    },
    {
      label: asOfLabel === "today" ? "Pixel value today" : `Pixel value ${dayWord}`,
      value: metrics?.revenueToday ?? null,
      delta: metrics ? metrics.revenueDelta : null,
      icon: Wallet,
      money: true,
    },
    {
      label: "Campaigns live",
      value: metrics?.campaignsLive ?? null,
      delta: null as number | null,
      icon: Target,
    },
    {
      label: "Avg CTR",
      value: metrics?.avgCtr ?? null,
      delta: null as number | null,
      icon: Activity,
      pct: true,
    },
  ];

  return (
    <div className={cn(GLASS, "p-4 sm:p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-widest text-emerald-300">
            Live analytics
          </span>
          <Clock className="h-3.5 w-3.5 text-emerald-400/80" />
          <span className="text-[11px] tabular-nums text-white/60">{clock}</span>
        </div>
        <p className="text-xs text-white/40">
          {asOfLabel === "today"
            ? "Today vs average day in the selected range"
            : `Latest synced day (${asOfLabel}) vs average day in the selected range`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <div
              key={cell.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-white/40">
                  {cell.label}
                </p>
                <Icon className="h-3.5 w-3.5 text-white/35" />
              </div>
              <p className="mt-1.5 text-xl font-bold text-white tabular-nums">
                {cell.value == null ? (
                  "—"
                ) : cell.money ? (
                  <AnimatedCounter target={cell.value} prefix={symbol} />
                ) : cell.pct ? (
                  <AnimatedCounter target={cell.value} suffix="%" decimals={2} />
                ) : (
                  <AnimatedCounter target={cell.value} />
                )}
              </p>
              {cell.delta != null && (
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    cell.delta >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {cell.delta >= 0 ? "+" : ""}
                  {cell.delta.toFixed(1)}% vs period avg
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/40">
          <span>Data sync</span>
          <span className="tabular-nums">{syncPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, syncPct))}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-white/35">{syncLabel}</p>
      </div>
    </div>
  );
}

export function AiInsightsGrid({ insights }: { insights: DerivedInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className={cn(GLASS, "p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">AI Insights</h2>
            <p className="text-xs text-white/40">
              Generated from this org&apos;s blended performance — not sample copy
            </p>
          </div>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white"
        >
          Ask AI
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn(
              "flex flex-col rounded-xl border p-4",
              insight.impact === "high"
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-blue-500/20 bg-blue-500/5",
            )}
          >
            <div className="mb-3 flex items-start gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  insight.impact === "high" ? "bg-emerald-500" : "bg-blue-500",
                )}
              >
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  {insight.description}
                </p>
              </div>
            </div>
            <Link
              href={insight.href}
              className={cn(
                "mt-auto inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white",
                insight.impact === "high"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-blue-600 hover:bg-blue-500",
              )}
            >
              {insight.actionLabel}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComposedRoasChart({
  data,
}: {
  data: Array<{ date: string; spend: number; revenue: number; roas: number }>;
}) {
  const { formatAxis: fmtAxis } = useCurrency();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="revFillHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          yAxisId="money"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtAxis}
        />
        <YAxis
          yAxisId="roas"
          orientation="right"
          tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(1)}x`}
        />
        <Tooltip content={(props: any) => <MiniTooltip {...props} />} />
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="revenue"
          name="Pixel value"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#revFillHome)"
        />
        <Area
          yAxisId="money"
          type="monotone"
          dataKey="spend"
          name="Spend"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="none"
        />
        <Line
          yAxisId="roas"
          type="monotone"
          dataKey="roas"
          name="Pixel ROAS"
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HourlyOrWeekdayChart({
  hourly,
  weekday,
}: {
  hourly: Array<{ hour: string; spend: number; impressions: number }>;
  weekday: Array<{ label: string; conversions: number; impressions: number }>;
}) {
  const useHourly = hourly.length > 0;
  const data = useHourly
    ? hourly.map((h) => ({
        label: `${h.hour}:00`,
        impressions: h.impressions,
        spend: h.spend,
      }))
    : weekday.map((d) => ({
        label: d.label,
        impressions: d.impressions,
        conversions: d.conversions,
      }));

  return (
    <div className={cn(GLASS, "p-5")}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">
          {useHourly ? "24h delivery pattern" : "Weekday conversion pattern"}
        </h2>
        <p className="mt-0.5 text-xs text-white/40">
          {useHourly
            ? "Meta hourly impressions and spend for the selected range"
            : "Aggregated from daily metrics — connect Meta for true hour-of-day"}
        </p>
      </div>
      <div className="h-64">
        {data.every((d) => !("impressions" in d) || d.impressions === 0) ? (
          <p className="flex h-full items-center justify-center text-sm text-white/40">
            No delivery pattern yet for this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={(props: any) => <MiniTooltip {...props} />} />
              <Bar
                dataKey="impressions"
                name="Impressions"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
              {!useHourly && (
                <Bar
                  dataKey="conversions"
                  name="Pixel conversions"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function AttributionFunnelWidget({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className={cn(GLASS, "p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Attribution funnel</h2>
          <p className="mt-0.5 text-xs text-white/40">
            Impressions → clicks → pixel conversions. Not till, not GA4.
          </p>
        </div>
        <Link
          href="/funnel"
          className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white"
        >
          Full funnel
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {stages.map((s) => (
          <div key={s.stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-white/70">{s.stage}</span>
              <span className="tabular-nums text-white/50">
                {s.value.toLocaleString("en-US")}
                {s.dropOff != null ? (
                  <span className="ml-2 text-rose-400">
                    −{s.dropOff.toFixed(0)}% drop
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500"
                style={{ width: `${Math.max(6, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className={cn(GLASS, "overflow-hidden p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Recent activity</h2>
        <Link
          href="/connections"
          className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white"
        >
          Sync status
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <RefreshCw className="h-4 w-4 text-white/40" />
          </span>
          <p className="max-w-sm text-sm text-white/50">
            Activity appears after the first sync — campaign spend and sync jobs show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                >
                  <span>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-white/40">{item.detail}</p>
                  </span>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/25" />
                </Link>
              ) : (
                <div className="px-3 py-2.5">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-white/40">{item.detail}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
