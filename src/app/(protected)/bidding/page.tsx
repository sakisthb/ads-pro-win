"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
  PieChart, Pie, Cell, type TooltipContentProps,
} from "recharts";
import {
  Target, Euro, Zap, Smartphone, MapPin, Clock, Users,
  Gavel, TrendingDown, PieChart as PieIcon, SlidersHorizontal, ArrowUpRight,
  Link2,
} from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { WorkspaceEmptyState } from "@/components/ui/workspace-empty-state";
import { useCurrency } from "@/components/providers/currency";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { getAdSetBidSuggestion } from "@/lib/bid-suggestions";

// ---------------------------------------------------------------------------
// Hardcoded demo data — Smart Bidding
// ---------------------------------------------------------------------------
const STRATEGIES = [
  { id: "roas", name: "Target ROAS", icon: Target, color: "#34d399", headline: "4.2x", label: "target ROAS", actual: "4.6x actual", spend: "€12,480 / wk", delta: "+9.5%", up: true, active: true },
  { id: "cpa", name: "Target CPA", icon: Euro, color: "#a78bfa", headline: "€12.50", label: "target CPA", actual: "€11.80 actual", spend: "€7,640 / wk", delta: "-5.6%", up: false, active: true },
  { id: "maxconv", name: "Maximize Conversions", icon: Zap, color: "#fbbf24", headline: "3,412", label: "conv. / month", actual: "€9.90 CPA", spend: "€5,320 / wk", delta: "+18.2%", up: true, active: false },
];

const ADJUSTMENTS = [
  { id: "device", label: "Device", hint: "Mobile uplift vs desktop baseline", icon: Smartphone, value: 15 },
  { id: "location", label: "Location", hint: "DACH region premium vs rest of EU", icon: MapPin, value: 8 },
  { id: "time", label: "Time of Day", hint: "Evening peak window 18:00–23:00", icon: Clock, value: -5 },
  { id: "audience", label: "Audience", hint: "Lookalike 1–3% signal premium", icon: Users, value: 22 },
];

// [day, projected CPA €, actual CPA €] across the last 30 days
const CPA_FORECAST: Array<[string, number, number]> = [
  ["Jul 28", 14.2, 14.8], ["Jul 31", 13.9, 14.1], ["Aug 3", 13.6, 13.9],
  ["Aug 6", 13.3, 12.8], ["Aug 9", 13.0, 13.4], ["Aug 12", 12.7, 12.2],
  ["Aug 15", 12.4, 12.6], ["Aug 18", 12.1, 11.7], ["Aug 21", 11.8, 12.0],
  ["Aug 24", 11.5, 11.3], ["Aug 26", 11.3, 11.2],
];
const forecastData = CPA_FORECAST.map(([day, projected, actual]) => ({ day, projected, actual }));

const ALLOCATION = [
  { name: "Target ROAS", value: 430, color: "#34d399" },
  { name: "Target CPA", value: 260, color: "#a78bfa" },
  { name: "Maximize Conversions", value: 190, color: "#fbbf24" },
];
const allocationTotal = ALLOCATION.reduce((sum, a) => sum + a.value, 0);

// Shared fade-in-up animation
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: "easeOut" as const },
});

function CpaTooltip({ active, payload, label }: TooltipContentProps<number, number>) {
  const { formatExact } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-medium text-white/80">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">{formatExact(Number(e.value))}</span>
        </div>
      ))}
    </div>
  );
}

function StrategyToggle({ on, color, onToggle }: { on: boolean; color: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-300"
      style={{ backgroundColor: on ? color : "rgba(255,255,255,0.08)" }}
    >
      <span
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: on ? 26 : 4 }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Real organizations: live ad set performance + rule-based bid suggestions
// ---------------------------------------------------------------------------
const SUGGESTION_STYLES: Record<"amber" | "red" | "emerald", string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

export default function BiddingPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { formatExact: formatMoney, format, formatExact, formatAxis, symbol } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(STRATEGIES.map((s) => [s.id, s.active]))
  );
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    Object.fromEntries(ADJUSTMENTS.map((a) => [a.id, a.value]))
  );

  const adsetRange = useIsoDateRange(30);
  const datesValid = adsetRange.startDate !== "";

  const adsetQuery = api.marketing.getAdSetPerformance.useQuery(
    { ...adsetRange, ...shopQuery },
    {
      enabled: !isLoading && !isDemo && datesValid && shopReady,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const adsetData = adsetQuery.data;
  const accountAvgCpc = useMemo(() => {
    const rows = adsetData?.adsets ?? [];
    const totalClicks = rows.reduce((sum, a) => sum + a.clicks, 0);
    const totalSpend = rows.reduce((sum, a) => sum + a.spend, 0);
    return totalClicks > 0 ? totalSpend / totalClicks : 0;
  }, [adsetData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    const adsets = adsetData?.adsets ?? [];
    const connected = adsetData?.connected ?? false;

    return (
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <motion.div {...fadeUp()} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Ad-set desk</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Smart <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Bidding</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Ad set performance and rule-based suggestions — last 30 days ({adsetRange.startDate} → {adsetRange.endDate}).
              This desk does not write bids. Advantage+ campaign budget cannot take a 50% ad-set cut. Conversions here are pixel purchases.
            </p>
            <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
          </div>
          {connected && adsets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                Account avg CPC: {formatMoney(accountAvgCpc)}
              </span>
              <Link href="/creative-fatigue" className="text-xs text-sky-300 hover:underline">Creative Fatigue</Link>
            </div>
          )}
        </motion.div>

        {adsetQuery.isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          </div>
        ) : adsetQuery.isError ? (
          <motion.div {...fadeUp(0.1)} className="border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl rounded-2xl">
            <p className="font-semibold text-white">Failed to load ad set performance</p>
            <p className="mt-1 text-sm text-zinc-400">Please try again later.</p>
          </motion.div>
        ) : !adsetQuery.isEnabled || (adsetQuery.isPending && adsetQuery.fetchStatus === "idle") ? (
          // Query disabled (dates not ready or org still resolving).
          <WorkspaceEmptyState pageName="bidding" />
        ) : !connected ? (
          // No Meta account connected for this organization.
          <motion.div {...fadeUp(0.1)} className="border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl rounded-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
              <Link2 className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-4 text-lg font-semibold text-white">Connect a Meta ad account</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
              Ad set-level bid suggestions need a connected Meta account. Connect one to see live spend, CPC, CTR,
              frequency and conversion data here.
            </p>
            <Link
              href="/connections"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-emerald-500 hover:to-teal-500"
            >
              Go to Connections
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </motion.div>
        ) : adsets.length === 0 ? (
          <motion.div {...fadeUp(0.1)} className="border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl rounded-2xl">
            <p className="font-semibold text-white">No ad set data for the last 30 days</p>
            <p className="mt-1 text-sm text-zinc-400">Your connected account has no delivery in this window.</p>
          </motion.div>
        ) : (
          // Ad set table with per-row rule-based suggestions.
          <motion.div {...fadeUp(0.1)} className="overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-zinc-500">
                    <th className="px-5 py-3.5 font-semibold">Ad set</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Spend</th>
                    <th className="px-4 py-3.5 text-right font-semibold">CPC</th>
                    <th className="px-4 py-3.5 text-right font-semibold">CTR</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Freq.</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Pixel conv.</th>
                    <th className="px-5 py-3.5 font-semibold">Suggestion</th>
                    <th className="px-5 py-3.5 font-semibold">Next</th>
                  </tr>
                </thead>
                <tbody>
                  {adsets.map((adset) => {
                    const suggestion = getAdSetBidSuggestion(adset, accountAvgCpc);
                    return (
                      <tr key={adset.adsetId} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                        <td className="max-w-[240px] truncate px-5 py-3.5 font-medium text-white">{adset.adsetName}</td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-white">{formatMoney(adset.spend)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-300">{formatMoney(adset.cpc)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-300">{adset.ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-300">{adset.frequency.toFixed(1)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-zinc-300">{adset.conversions.toLocaleString("en-US")}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium leading-tight ${SUGGESTION_STYLES[suggestion.tone]}`}>
                            {suggestion.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={suggestion.href} className="text-[11px] font-semibold text-sky-300 hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-80 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <motion.div {...fadeUp()} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">AI bid engine</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Smart <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Bidding</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Strategy control, bid adjustments and 30-day CPA forecasting.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Auto-optimizing · recalculated 12 min ago
          </span>
        </motion.div>

        {/* Bid strategy cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STRATEGIES.map((s, i) => {
            const Icon = s.icon;
            const on = enabled[s.id];
            return (
              <motion.div
                key={s.id}
                {...fadeUp(0.08 + i * 0.08)}
                className="relative overflow-hidden border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}1f`, color: s.color }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex flex-col items-end gap-1.5">
                    <StrategyToggle on={on} color={s.color} onToggle={() => setEnabled((p) => ({ ...p, [s.id]: !p[s.id] }))} />
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${on ? "text-emerald-300" : "text-zinc-500"}`}>
                      {on ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{s.name}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-white">{s.headline.replaceAll("€", symbol)}</span>
                  <span className="text-xs text-zinc-400">{s.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-xs">
                  <div>
                    <p className="text-zinc-500">Actual</p>
                    <p className="mt-0.5 font-semibold text-white">{s.actual.replaceAll("€", symbol)}</p>
                  </div>
                  <div><p className="text-zinc-500">Spend</p><p className="mt-0.5 font-semibold text-white">{s.spend.replaceAll("€", symbol)}</p></div>
                  <div>
                    <p className="text-zinc-500">Trend</p>
                    <p className="mt-0.5 flex items-center gap-1 font-semibold" style={{ color: s.color }}>
                      <ArrowUpRight className={`h-3 w-3 ${s.up ? "" : "rotate-90"}`} />{s.delta}
                    </p>
                  </div>
                </div>
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: s.color }} />
              </motion.div>
            );
          })}
        </div>

        {/* Forecast + allocation */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <motion.div {...fadeUp(0.3)} className="border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Performance Forecast</h2>
              </div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">CPA · 30 days</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} domain={[10, 16]} tickFormatter={(v: number) => formatAxis(v)} />
                  <Tooltip content={(props: any) => <CpaTooltip {...props} />} />
                  <ReferenceLine y={12.5} stroke="#fbbf24" strokeDasharray="6 4" label={{ value: `Target ${formatExact(12.5)}`, fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
                  <Line type="monotone" dataKey="projected" name="Projected CPA" stroke="#34d399" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual CPA" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 2.5, fill: "#a78bfa" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.38)} className="border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-violet-400" />
                <h2 className="text-base font-semibold text-white">Budget Allocation</h2>
              </div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-zinc-300">{format(allocationTotal)}/day</span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ALLOCATION} dataKey="value" nameKey="name" innerRadius={48} outerRadius={66} paddingAngle={4} strokeWidth={0}>
                    {ALLOCATION.map((a) => (<Cell key={a.name} fill={a.color} />))}
                  </Pie>
                  <Tooltip content={(props: any) => <CpaTooltip {...props} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-2">
              {ALLOCATION.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-zinc-400">{a.name}</span>
                  <span className="ml-auto font-semibold text-white tabular-nums">{format(a.value)}</span>
                  <span className="w-10 text-right text-zinc-500 tabular-nums">{Math.round((a.value / allocationTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bid adjustments */}
        <motion.div {...fadeUp(0.46)} className="border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Bid Adjustments</h2>
            </div>
            <span className="text-xs text-zinc-500">Applies to all AI-bid campaigns</span>
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
            {ADJUSTMENTS.map((a) => {
              const Icon = a.icon;
              const v = adjustments[a.id];
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-zinc-400" />
                      <span className="font-medium text-white">{a.label}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                        v >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
                      }`}
                    >
                      {v > 0 ? "+" : ""}{v}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={5}
                    value={v}
                    aria-label={`${a.label} bid adjustment`}
                    onChange={(e) => setAdjustments((p) => ({ ...p, [a.id]: Number(e.target.value) }))}
                    className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400"
                  />
                  <p className="mt-2 text-xs text-zinc-500">{a.hint}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
