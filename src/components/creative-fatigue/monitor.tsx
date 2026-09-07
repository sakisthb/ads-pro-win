"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  type TooltipContentProps,
} from "recharts";
import {
  HeartPulse,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  MousePointerClick,
  TrendingDown,
  ArrowDownRight,
  Plug,
  ArrowRight,
  Layers,
  Wallet,
  Percent,
  Activity,
  Pause,
  Sparkles,
  Filter,
  Search,
  AlertTriangle,
  Copy,
  LayoutGrid,
  Table2,
  Star,
  GitCompare,
  Bell,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/components/providers/trpc-provider";
import {
  ActionInbox,
  CadenceBar,
  CompareDialog,
  DiagnosisMixBar,
  EconomicsPanel,
  HealthPanel,
  RewritePack,
  ExportButtons,
  FatigueTable,
  Playbook,
  RefreshCalendar,
  WinnerSwaps,
  useWatchlist,
} from "@/components/creative-fatigue/operator-tools";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DIAGNOSIS_COLOR,
  DIAGNOSIS_LABEL,
  PLATFORM_COLOR,
  PLATFORM_LABEL,
  cadenceLabel,
  canonicalizeShopUrl,
  stashLaunchDraft,
  type FatigueAd,
  type FatigueDiagnosis,
  type FatigueLevel,
  type FatiguePayload,
  type FatiguePlatform,
} from "@/lib/creative-fatigue";
import { useCurrency } from "@/components/providers/currency";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: "easeOut" as const },
});

const FATIGUE_BADGE: Record<FatigueLevel, string> = {
  high: "border-red-500/30 bg-red-500/15 text-red-400",
  medium: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  low: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
};

const REC_ICON = {
  headline: RefreshCw,
  imagery: ImageIcon,
  cta: MousePointerClick,
  audience: Filter,
  diversity: Layers,
  similarity: Copy,
  hook: AlertTriangle,
  refresh: Clock,
  cpa: Wallet,
} as const;

function scoreColor(score: number) {
  return score >= 70 ? "#fb7185" : score >= 40 ? "#fbbf24" : "#34d399";
}

function Gauge({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white tabular-nums">
        {score}
      </span>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CtrTooltip({ active, payload, label }: TooltipContentProps<number, number>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-medium text-white/80">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}</span>
          <span className="ml-auto font-semibold text-white tabular-nums">{`${Number(e.value).toFixed(2)}%`}</span>
        </div>
      ))}
    </div>
  );
}

type SortKey = "spend" | "score" | "ctrDrop" | "frequency" | "daysLive" | "projected";
type GroupBy = "adset" | "campaign" | "diagnosis" | "none";
type ViewMode = "cards" | "table";

export function CreativeFatigueMonitor({
  payload,
  range,
  onRangeChange,
  isDemo,
  isLoading,
  errorMessage,
  onRefresh,
  isRefreshing,
  lastFetchedAt,
  brandId,
}: {
  payload: FatiguePayload;
  range: DateRangeValue;
  onRangeChange: (value: DateRangeValue) => void;
  isDemo: boolean;
  isLoading?: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastFetchedAt?: number;
  brandId?: string;
}) {
  const { format, formatExact } = useCurrency();
  const [platform, setPlatform] = useState<"all" | FatiguePlatform>("all");
  const [level, setLevel] = useState<"all" | FatigueLevel>("all");
  const [diagnosisFilter, setDiagnosisFilter] = useState<"all" | FatigueDiagnosis>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [groupBy, setGroupBy] = useState<GroupBy>("adset");
  const [view, setView] = useState<ViewMode>("cards");
  const [watchOnly, setWatchOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: "pause" | "reduce_budget"; ad: FatigueAd } | null>(null);
  const [headlinePreview, setHeadlinePreview] = useState<string[] | null>(null);
  const watchlist = useWatchlist();
  const searchRef = useRef<HTMLInputElement>(null);

  const openAd = useCallback((adId: string | null) => {
    setSelectedId(adId);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (adId) url.searchParams.set("ad", adId);
    else url.searchParams.delete("ad");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ad = new URLSearchParams(window.location.search).get("ad");
    if (ad) setSelectedId(ad);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") openAd(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAd]);

  const action = api.marketing.applyCreativeAction.useMutation({
    onSuccess: (res) => toast.success(res.detail),
    onError: (err) => toast.error(err.message),
  });
  const generate = api.ai.generateCreative.useMutation({
    onError: (err) => toast.error(err.message),
  });
  const utils = api.useUtils();

  const selected = payload.ads.find((a) => a.adId === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = payload.ads.filter((ad) => {
      if (platform !== "all" && ad.platform !== platform) return false;
      if (level !== "all" && ad.fatigueLevel !== level) return false;
      if (diagnosisFilter !== "all" && ad.diagnosis !== diagnosisFilter) return false;
      if (watchOnly && !watchlist.ids.has(ad.adId)) return false;
      if (!q) return true;
      return `${ad.creativeTitle} ${ad.adName} ${ad.adsetName} ${ad.campaignName}`.toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      if (sort === "score") return b.fatigueScore - a.fatigueScore;
      if (sort === "ctrDrop") return a.ctrDropPct - b.ctrDropPct;
      if (sort === "frequency") return b.frequency - a.frequency;
      if (sort === "daysLive") return b.daysLive - a.daysLive;
      if (sort === "projected") return (b.projectedCtr7d ?? -1) - (a.projectedCtr7d ?? -1);
      return b.spend - a.spend;
    });
    return rows;
  }, [payload.ads, platform, level, diagnosisFilter, query, sort, watchOnly, watchlist.ids]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [["all", filtered]] as Array<[string, FatigueAd[]]>;
    const map = new Map<string, FatigueAd[]>();
    for (const ad of filtered) {
      const key =
        groupBy === "diagnosis"
          ? ad.diagnosis
          : groupBy === "campaign"
            ? `${ad.platform}:${ad.campaignId || ad.campaignName}`
            : `${ad.platform}:${ad.adsetId || ad.adsetName}`;
      const list = map.get(key) ?? [];
      list.push(ad);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered, groupBy]);

  const compareAds = payload.ads.filter((a) => compareIds.includes(a.adId));

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function groupHeading(ads: FatigueAd[]): { title: string; subtitle: string } {
    const spend = ads.reduce((s, a) => s + a.spend, 0);
    if (groupBy === "diagnosis") {
      return {
        title: DIAGNOSIS_LABEL[ads[0].diagnosis],
        subtitle: `${ads.length} ads · ${format(spend)}`,
      };
    }
    if (groupBy === "campaign") {
      return {
        title: ads[0].campaignName || "Unassigned campaign",
        subtitle: `${PLATFORM_LABEL[ads[0].platform]} · ${ads.length} ads · ${format(spend)}`,
      };
    }
    if (groupBy === "none") {
      return { title: "All ads", subtitle: `${ads.length} ads · ${format(spend)}` };
    }
    return {
      title: ads[0].adsetName,
      subtitle: `${PLATFORM_LABEL[ads[0].platform]} · ${ads.length} ads · ${formatExact(spend)}`,
    };
  }

  const kpis = payload.kpis;
  const connected = payload.connected;
  const noneConnected = !connected && !isDemo;

  async function runAction(next: "pause" | "reduce_budget", ad: FatigueAd) {
    if (isDemo) {
      toast.message("Demo workspace — actions are not sent to ad platforms.");
      setConfirm(null);
      return;
    }
    await action.mutateAsync({
      action: next,
      adId: ad.adId,
      adsetId: ad.adsetId || undefined,
      platform: ad.platform,
      brandId: brandId || undefined,
    });
    setConfirm(null);
    await utils.marketing.getCreativeFatigue.invalidate();
  }

  async function generateHeadlines(ad: FatigueAd) {
    const result = await generate.mutateAsync({
      platform: ad.platform,
      audience: [ad.adsetName || "existing buyers"],
      goals: ["Recover CTR", "Refresh fatigued creative"],
      constraints: [
        `Replace: ${ad.creativeTitle}`,
        ad.creativeBody ? `Current body: ${ad.creativeBody}` : "",
      ].filter(Boolean),
      creativeType: "text",
    });
    const variants = [
      result.result?.content?.title,
      ...(result.result?.variants ?? []).map((v: { title?: string }) => v.title),
    ].filter(Boolean) as string[];
    setHeadlinePreview(variants.length ? variants : ["No variants returned — try again."]);
    toast.success("Headline variants ready");
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <motion.div {...fadeUp()} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                Creative intelligence
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Creative{" "}
              <span className="bg-gradient-to-r from-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
                Fatigue Monitor
              </span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Operator desk: today&apos;s inbox, refresh calendar, winner swaps, and decay scoring across Meta, Google and TikTok.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDemo && (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                {kpis.highCount} creatives need refresh
              </span>
            )}
            {payload.alertsCreated > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
                <Bell className="h-3 w-3" />
                {payload.alertsCreated} alert{payload.alertsCreated === 1 ? "" : "s"} logged today
              </span>
            )}
            <ExportButtons
              ads={filtered.length ? filtered : payload.ads}
              brief={payload.brief}
              launchDraft={payload.launchDraft}
            />
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                disabled={isRefreshing}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 text-xs text-zinc-300 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
            <DateRangePicker value={range} onChange={onRangeChange} presets={[7, 14, 30, 60, 90, 180]} />
            {lastFetchedAt ? (
              <span className="text-[11px] text-zinc-500">
                {new Date(lastFetchedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-2">
          {payload.platforms.map((p) => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                p.connected
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-zinc-500"
              }`}
              title={p.error}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLOR[p.id] }} />
              {PLATFORM_LABEL[p.id]}
              {p.connected ? ` · ${p.accountName}` : " · not connected"}
            </span>
          ))}
        </div>

        {(payload.coverage ?? []).map((row) => {
          if (row.accountSpend == null || row.accountSpend <= 0) return null;
          const pct = Math.min(100, (row.scoredSpend / row.accountSpend) * 100);
          const gap = row.accountSpend - row.scoredSpend;
          return (
            <p key={row.platform} className="text-[11px] text-zinc-500">
              Scoring {format(row.scoredSpend)} of {format(row.accountSpend)}{" "}
              {PLATFORM_LABEL[row.platform]} spend ({`${pct.toFixed(0)}%`})
              {gap > 5
                ? ` · ${format(gap)} not returned at ad level`
                : ` · ${payload.ads.filter((a) => a.platform === row.platform).length} ad${payload.ads.filter((a) => a.platform === row.platform).length === 1 ? "" : "s"}`}
            </p>
          );
        })}

        {isLoading && (
          <motion.div {...fadeUp(0.08)} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-white/10" />
            ))}
          </motion.div>
        )}

        {errorMessage && (
          <motion.div {...fadeUp(0.08)} className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300 backdrop-blur-xl">
            Failed to load creative fatigue: {errorMessage}
          </motion.div>
        )}

        {noneConnected && !isLoading && (
          <motion.div {...fadeUp(0.08)} className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10">
              <Plug className="h-6 w-6 text-rose-300" />
            </span>
            <div>
              <p className="text-base font-semibold text-white">Connect an ad platform</p>
              <p className="mt-1 max-w-md text-sm text-zinc-400">
                Link Meta, Google or TikTok from Connections to score live frequency, CTR decay and refresh cadence.
              </p>
            </div>
            <Link
              href="/connections"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-transform hover:scale-[1.02]"
            >
              Go to Connections
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}

        {connected && (
          <>
            <motion.div {...fadeUp(0.08)} className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:flex-row">
              <div className="flex items-center gap-4">
                <Gauge score={kpis.portfolioHealth} size={72} />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">Portfolio health</p>
                  <p className="text-xl font-bold text-white">
                    {kpis.portfolioHealth}
                    <span className="text-sm text-zinc-500">/100</span>
                  </p>
                  <p className="text-xs font-medium text-amber-300">
                    {kpis.highCount} high · {kpis.mediumCount} medium · {kpis.lowCount} low
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <Kpi label="Portfolio CTR" value={`${kpis.portfolioCtr.toFixed(2)}%`} hint={`${kpis.ctrChangePp >= 0 ? "+" : ""}${kpis.ctrChangePp.toFixed(2)}pp vs first week`} down={kpis.ctrChangePp < 0} />
                <Kpi
                  label="Projected 7d CTR"
                  value={kpis.projectedCtr7d == null ? "—" : `${kpis.projectedCtr7d.toFixed(2)}%`}
                  hint="Spend-weighted forecast"
                  down={kpis.projectedCtr7d != null && kpis.projectedCtr7d < kpis.portfolioCtr}
                />
                <Kpi label="Spend at risk" value={format(kpis.spendAtRisk)} hint="High-fatigue ads this period" down={kpis.spendAtRisk > 0} />
                <Kpi
                  label="CPA watch"
                  value={format(kpis.cpaWatchSpend ?? 0)}
                  hint={
                    (kpis.cpaWatchCount ?? 0) === 0
                      ? "CPA up, CTR holding"
                      : `${kpis.cpaWatchCount} ad${kpis.cpaWatchCount === 1 ? "" : "s"} · do not rotate first`
                  }
                  down={(kpis.cpaWatchSpend ?? 0) > 0}
                />
                <Kpi label="Past cadence" value={String(kpis.pastCadenceCount)} hint={`of ${kpis.adsCount} ads`} />
                <Kpi label="Avg. days live" value={kpis.avgDaysLive.toFixed(1)} hint="across scored creatives" />
              </div>
            </motion.div>

            <DiagnosisMixBar
              mix={payload.mix}
              selected={diagnosisFilter}
              onSelect={setDiagnosisFilter}
            />

            {payload.ads.some(
              (a) =>
                a.format === "video" &&
                a.avgWatchSeconds != null &&
                a.avgWatchSeconds > 0 &&
                a.avgWatchSeconds < 3,
            ) && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p>
                  Video hook is dying — at least one ad averages under 3s watch time. Rewrite the first three seconds before rotating the offer.
                </p>
              </div>
            )}

            {payload.ads.some((a) => a.diagnosis === "cpa_inflation") && (
              <div className="flex items-start gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                <p>
                  CPA is climbing while CTR holds. That is feed, landing page, or purchase-event quality — not a dead creative. Do not pause the winner to refresh it.
                </p>
              </div>
            )}

            {payload.ads.some((a) => a.catalogTemplate) &&
              payload.diversity.some((d) => !d.passing) &&
              payload.kpis.highCount === 0 && (
                <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                    <p>
                      CTR is holding on the catalog template. Do not pause it to “refresh”. The next move is a 15s UGC hook and a 3-card carousel, with this DPA as the control.
                    </p>
                  </div>
                  <Link
                    href="/campaign-launcher"
                    onClick={() => stashLaunchDraft(payload.launchDraft)}
                    className="shrink-0 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
                  >
                    Draft in launcher
                  </Link>
                </div>
              )}

            {payload.economics && payload.economics.checks.length > 0 && (
              <EconomicsPanel economics={payload.economics} />
            )}

            {payload.health && payload.health.checks.length > 0 && (
              <HealthPanel health={payload.health} />
            )}

            {payload.rewrites && payload.rewrites.length > 0 && (
              <RewritePack rewrites={payload.rewrites} />
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ActionInbox items={payload.inbox} onOpen={openAd} />
              <RefreshCalendar entries={payload.calendar} onOpen={openAd} />
              <WinnerSwaps swaps={payload.swaps} onOpen={openAd} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <motion.div {...fadeUp(0.12)} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  <h2 className="text-base font-semibold text-white">CTR decay — top fatigued ads</h2>
                </div>
                {payload.decay.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-500">Not enough daily delivery to plot decay.</p>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-3">
                      {payload.decayKeys.map((l) => (
                        <span key={l.key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </span>
                      ))}
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={payload.decay} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="day" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                          <Tooltip content={(props: any) => <CtrTooltip {...props} />} />
                          {payload.decayKeys.map((l) => (
                            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} dot={{ r: 2, fill: l.color }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </motion.div>

              <motion.div {...fadeUp(0.16)} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-fuchsia-400" />
                  <h2 className="text-base font-semibold text-white">Frequency vs CTR</h2>
                </div>
                <p className="mb-3 text-xs text-zinc-500">High frequency + holding CTR = saturation. Falling CTR at any frequency = dead creative.</p>
                {payload.scatter.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-500">No scatter points yet.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="frequency" name="Frequency" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="number" dataKey="ctr" name="CTR" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <ZAxis type="number" dataKey="spend" range={[40, 160]} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as FatiguePayload["scatter"][number];
                            return (
                              <div className="rounded-lg border border-white/10 bg-gray-950/90 px-3 py-2 text-xs">
                                <p className="font-medium text-white">{d.name}</p>
                                <p className="text-zinc-400">
                                  {d.frequency.toFixed(1)}× · {`${d.ctr.toFixed(2)}%`} CTR · {DIAGNOSIS_LABEL[d.diagnosis]}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Scatter data={payload.scatter}>
                          {payload.scatter.map((p) => (
                            <Cell key={p.adId} fill={DIAGNOSIS_COLOR[p.diagnosis]} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <motion.div {...fadeUp(0.18)} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="mb-3 text-sm font-semibold text-white">Format diversity</h2>
                {payload.diversity.length === 0 ? (
                  <p className="text-sm text-zinc-500">No formats scored.</p>
                ) : (
                  <div className="space-y-3">
                    {payload.diversity.map((row) => (
                      <div key={row.platform} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{PLATFORM_LABEL[row.platform]}</span>
                          <span className={`text-[11px] font-semibold ${row.passing ? "text-emerald-300" : "text-amber-300"}`}>
                            {row.uniqueFormats}/{row.required} formats {row.passing ? "pass" : "gap"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {Object.entries(row.formats)
                            .map(([fmt, n]) => `${fmt} ${n}`)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
              <motion.div {...fadeUp(0.2)} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="mb-3 text-sm font-semibold text-white">Andromeda lookalikes</h2>
                {payload.clusters.length === 0 ? (
                  <p className="text-sm text-zinc-500">No near-duplicate clusters — creatives look distinct.</p>
                ) : (
                  <div className="space-y-2">
                    {payload.clusters.map((c) => (
                      <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                        <p className="truncate text-sm text-white">{c.label}</p>
                        <p className="text-[11px] text-zinc-500">
                          {c.size} ads · {`${(c.similarity * 100).toFixed(0)}%`} similar
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div {...fadeUp(0.22)} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
              <Search className="ml-2 h-4 w-4 text-zinc-500" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ads, ad sets, campaigns  (/)"
                className="h-9 max-w-xs border-white/10 bg-transparent text-white"
              />
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger className="h-9 w-[130px] border-white/10 bg-transparent text-xs text-white">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
              <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
                <SelectTrigger className="h-9 w-[130px] border-white/10 bg-transparent text-xs text-white">
                  <SelectValue placeholder="Fatigue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={diagnosisFilter} onValueChange={(v) => setDiagnosisFilter(v as typeof diagnosisFilter)}>
                <SelectTrigger className="h-9 w-[160px] border-white/10 bg-transparent text-xs text-white">
                  <SelectValue placeholder="Diagnosis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All diagnoses</SelectItem>
                  <SelectItem value="creative_death">Creative death</SelectItem>
                  <SelectItem value="audience_saturation">Saturation</SelectItem>
                  <SelectItem value="always_weak">Always weak</SelectItem>
                  <SelectItem value="cpa_inflation">CPA climbing</SelectItem>
                  <SelectItem value="over_cadence">Past cadence</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-9 w-[150px] border-white/10 bg-transparent text-xs text-white">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="score">Fatigue score</SelectItem>
                  <SelectItem value="ctrDrop">CTR drop</SelectItem>
                  <SelectItem value="frequency">Frequency</SelectItem>
                  <SelectItem value="daysLive">Days live</SelectItem>
                  <SelectItem value="projected">Projected CTR</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="h-9 w-[140px] border-white/10 bg-transparent text-xs text-white">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adset">Group: ad set</SelectItem>
                  <SelectItem value="campaign">Group: campaign</SelectItem>
                  <SelectItem value="diagnosis">Group: diagnosis</SelectItem>
                  <SelectItem value="none">Ungrouped</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex rounded-lg border border-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setView("cards")}
                  className={`rounded-md px-2 py-1.5 ${view === "cards" ? "bg-white/10 text-white" : "text-zinc-500"}`}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("table")}
                  className={`rounded-md px-2 py-1.5 ${view === "table" ? "bg-white/10 text-white" : "text-zinc-500"}`}
                  aria-label="Table view"
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWatchOnly((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                  watchOnly
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    : "border-white/10 text-zinc-400"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${watchOnly ? "fill-amber-300" : ""}`} />
                Watchlist{watchlist.ids.size ? ` (${watchlist.ids.size})` : ""}
              </button>
              <button
                type="button"
                disabled={compareIds.length !== 2}
                onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 disabled:opacity-40"
              >
                <GitCompare className="h-3.5 w-3.5" />
                Compare{compareIds.length ? ` (${compareIds.length}/2)` : ""}
              </button>
              <span className="ml-auto pr-2 text-xs text-zinc-500">{filtered.length} ads</span>
            </motion.div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-14 text-center text-sm text-zinc-400">
                {watchOnly
                  ? "Watchlist is empty for these filters — star ads to pin them here."
                  : "No ads match these filters — widen the date range or clear search."}
              </div>
            ) : view === "table" ? (
              <FatigueTable
                ads={filtered}
                watching={(id) => watchlist.ids.has(id)}
                compareIds={compareIds}
                onOpen={openAd}
                onToggleWatch={watchlist.toggle}
                onToggleCompare={toggleCompare}
              />
            ) : (
              grouped.map(([key, ads], si) => {
                const heading = groupHeading(ads);
                return (
                <motion.section key={key} {...fadeUp(0.12 + si * 0.04)}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10">
                      <Layers className="h-4 w-4 text-fuchsia-300" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{heading.title}</h2>
                      <p className="text-[11px] text-zinc-500">{heading.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {ads.map((ad) => (
                      <div
                        key={ad.adId}
                        role="button"
                        tabIndex={0}
                        onClick={() => openAd(ad.adId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openAd(ad.adId);
                          }
                        }}
                        className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white/5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 ${
                          selectedId === ad.adId
                            ? "border-rose-400/50 ring-2 ring-rose-400/30"
                            : "border-white/10"
                        }`}
                      >
                        {ad.creativeImageUrl ? (
                          <img
                            src={ad.creativeImageUrl}
                            alt={ad.creativeTitle}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-24 w-full border-b border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center border-b border-white/10 bg-gradient-to-br from-rose-500/10 to-fuchsia-500/5">
                            <ImageIcon className="h-7 w-7 text-white/25" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{ad.creativeTitle}</p>
                              <p className="mt-0.5 text-[11px] text-zinc-500">
                                {PLATFORM_LABEL[ad.platform]} · {ad.format}
                                {ad.catalogTemplate ? " · catalog" : ""}
                                {ad.advantagePlus ? " · Advantage+" : ""} · {ad.daysLive}d in window · {cadenceLabel(ad)}
                              </p>
                            </div>
                            <Gauge score={ad.fatigueScore} size={44} />
                          </div>
                          <Sparkline data={ad.trend} color={scoreColor(ad.fatigueScore)} />
                          <CadenceBar ad={ad} />
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <Mini label="Freq" value={ad.frequency.toFixed(2)} icon={Activity} />
                            <Mini label="CTR" value={`${ad.ctr.toFixed(2)}%`} icon={Percent} />
                            <Mini label="Spend" value={format(ad.spend)} icon={Wallet} />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Mini
                              label="Proj. 7d"
                              value={ad.projectedCtr7d == null ? "—" : `${ad.projectedCtr7d.toFixed(2)}%`}
                              icon={TrendingDown}
                            />
                            <Mini
                              label="CPA"
                              value={ad.cpa == null ? "—" : formatExact(ad.cpa)}
                              icon={Wallet}
                            />
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                            <span className="text-[11px] text-zinc-500">
                              {`${ad.ctrDropPct.toFixed(0)}%`} CTR
                              {ad.cpaChangePct >= 25 ? ` · CPA ${ad.cpaChangePct >= 0 ? "+" : ""}${ad.cpaChangePct.toFixed(0)}%` : ""}
                              {" · "}
                              {DIAGNOSIS_LABEL[ad.diagnosis]}
                            </span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${FATIGUE_BADGE[ad.fatigueLevel]}`}>
                              {ad.fatigueLevel}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => watchlist.toggle(ad.adId)}
                              className={`rounded-md p-1 ${watchlist.ids.has(ad.adId) ? "text-amber-300" : "text-zinc-500 hover:text-white"}`}
                              aria-label="Watch"
                            >
                              <Star className={`h-3.5 w-3.5 ${watchlist.ids.has(ad.adId) ? "fill-amber-300" : ""}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCompare(ad.adId)}
                              className={`rounded-md p-1 ${compareIds.includes(ad.adId) ? "text-sky-300" : "text-zinc-500 hover:text-white"}`}
                              aria-label="Compare"
                            >
                              <GitCompare className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
                );
              })
            )}

            <motion.div {...fadeUp(0.28)} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-fuchsia-400" />
                  <h2 className="text-base font-semibold text-white">Refresh recommendations</h2>
                </div>
                <span className="text-xs text-zinc-500">Ranked by spend sitting on the problem</span>
              </div>
              {payload.recommendations.length === 0 ? (
                <p className="text-sm text-zinc-500">No refresh actions needed for this window.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {payload.recommendations.map((r) => {
                    const Icon = REC_ICON[r.kind];
                    const target = payload.ads.find((a) => a.adId === r.adIds[0]);
                    return (
                      <div key={r.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-300">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                            {r.impact}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{r.title}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{r.detail}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{r.effort}</span>
                          <div className="flex gap-2">
                            {target && (
                              <button
                                type="button"
                                onClick={() => openAd(target.adId)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                              >
                                Open
                              </button>
                            )}
                            {r.kind === "headline" && target && (
                              <button
                                type="button"
                                onClick={() => generateHeadlines(target)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                              >
                                Generate
                              </button>
                            )}
                            {(r.kind === "diversity" || r.kind === "cpa") && (
                              <Link
                                href="/campaign-launcher"
                                onClick={() => stashLaunchDraft(payload.launchDraft)}
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                              >
                                Draft in launcher
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && openAd(null)}>
        <SheetContent className="w-full overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.creativeTitle}</SheetTitle>
                <SheetDescription>
                  {PLATFORM_LABEL[selected.platform]} · {DIAGNOSIS_LABEL[selected.diagnosis]} · score {selected.fatigueScore}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4">
                {selected.creativeImageUrl && (
                  <img src={selected.creativeImageUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
                )}
                <p className="text-sm text-zinc-400">{selected.creativeBody ?? selected.adName}</p>
                {canonicalizeShopUrl(selected.destinationUrl) ? (
                  <a
                    href={canonicalizeShopUrl(selected.destinationUrl)!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
                  >
                    Open destination <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Frequency" value={selected.frequency.toFixed(2)} />
                  <Stat label="CTR" value={`${selected.ctr.toFixed(2)}%`} />
                  <Stat label="CTR vs week 1" value={`${selected.ctrDropPct.toFixed(0)}%`} />
                  <Stat label="Trailing 7d CTR" value={`${selected.recentCtr7d.toFixed(2)}%`} />
                  <Stat label="Projected CTR 7d" value={selected.projectedCtr7d == null ? "—" : `${selected.projectedCtr7d.toFixed(2)}%`} />
                  <Stat label="Days live" value={`${selected.daysLive} / ${selected.cadenceDays}`} />
                  <Stat label="Cadence" value={cadenceLabel(selected)} />
                  <Stat label="Spend" value={formatExact(selected.spend)} />
                  <Stat label="CPA" value={selected.cpa == null ? "—" : formatExact(selected.cpa)} />
                  <Stat label="Impressions" value={selected.impressions.toLocaleString()} />
                  <Stat label="CPA vs week 1" value={`${selected.cpaChangePct.toFixed(0)}%`} />
                  <Stat
                    label="CVR vs week 1"
                    value={`${(selected.cvrChangePct ?? 0) >= 0 ? "+" : ""}${(selected.cvrChangePct ?? 0).toFixed(0)}%`}
                  />
                  {selected.clicks > 0 ? (
                    <Stat
                      label="Click → purchase"
                      value={`${((selected.conversions / selected.clicks) * 100).toFixed(2)}%`}
                    />
                  ) : null}
                  {selected.landingPageViews > 0 ? (
                    <Stat label="Landing views" value={selected.landingPageViews.toLocaleString()} />
                  ) : null}
                  {selected.addToCart > 0 ? (
                    <Stat label="Add to cart" value={selected.addToCart.toLocaleString()} />
                  ) : null}
                  {selected.conversionValue > 0 ? (
                    <Stat label="Purchase value" value={formatExact(selected.conversionValue)} />
                  ) : null}
                  {selected.conversionValue > 0 && selected.spend > 0 ? (
                    <Stat label="ROAS" value={`${(selected.conversionValue / selected.spend).toFixed(2)}x`} />
                  ) : null}
                  {selected.objectAgeDays != null && selected.objectAgeDays !== selected.daysLive ? (
                    <Stat label="Ad object age" value={`${selected.objectAgeDays}d`} />
                  ) : null}
                </div>
                <CadenceBar ad={selected} />
                <Sparkline data={selected.trend} color={scoreColor(selected.fatigueScore)} />
                <Playbook ad={selected} />
                {headlinePreview && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Headline variants</p>
                    <ul className="space-y-1 text-sm text-white">
                      {headlinePreview.map((h) => (
                        <li key={h}>• {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(selected.adId);
                        toast.success("Ad id copied");
                      } catch {
                        toast.error("Could not copy ad id");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy ad id
                  </button>
                  <button
                    type="button"
                    onClick={() => watchlist.toggle(selected.adId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <Star className={`h-3.5 w-3.5 ${watchlist.ids.has(selected.adId) ? "fill-amber-300 text-amber-300" : ""}`} />
                    {watchlist.ids.has(selected.adId) ? "Watching" : "Watch"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(selected.adId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    {compareIds.includes(selected.adId) ? "In compare" : "Add to compare"}
                  </button>
                  <button
                    type="button"
                    onClick={() => generateHeadlines(selected)}
                    disabled={generate.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generate headlines
                  </button>
                  <Link
                    href="/campaign-launcher"
                    onClick={() => stashLaunchDraft(payload.launchDraft)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    Duplicate in launcher
                  </Link>
                  {selected.platform === "meta" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirm({ action: "pause", ad: selected })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-300"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause ad
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ action: "reduce_budget", ad: selected })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-300"
                      >
                        Cut ad set budget 50%
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="border-white/10 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirm?.action === "pause" ? "Pause this ad on Meta?" : "Cut this ad set daily budget in half?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>This writes to the live BAGTOBAG Meta account. {confirm?.ad.creativeTitle}</p>
                {confirm?.action === "reduce_budget" && confirm.ad.advantagePlus ? (
                  <p className="mt-2 text-amber-300">
                    Advantage+ / CBO campaigns often hold budget at the campaign, not the ad set. Meta will reject this cut if there is no ad-set daily_budget.
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-3 py-2 text-sm text-zinc-400">
              Cancel
            </button>
            <button
              type="button"
              disabled={action.isPending || !confirm}
              onClick={() => confirm && runAction(confirm.action, confirm.ad)}
              className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompareDialog
        ads={compareAds}
        open={compareOpen && compareAds.length === 2}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  down,
}: {
  label: string;
  value: string;
  hint: string;
  down?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="mt-1 flex items-center gap-1 text-base font-bold text-white">
        {value}
        {down ? <ArrowDownRight className="h-3 w-3 text-rose-300" /> : null}
      </p>
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  );
}
