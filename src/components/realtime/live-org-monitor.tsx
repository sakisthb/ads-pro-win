"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Globe,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FortunePanel } from "@/components/mystery/fortune-panel";
import { api } from "@/components/providers/trpc-provider";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { deriveActivity } from "@/lib/dashboard-insights";
import type { MysteryCampaign } from "@/lib/mystery-insights";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/providers/currency";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { collapseGa4BreakdownByShortLabel } from "@/lib/ga4-shared";

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

const PLATFORM_COLOR: Record<string, string> = {
  meta: "#1877F2",
  facebook: "#1877F2",
  google: "#4285F4",
  tiktok: "#FF0050",
};

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function mapPlatform(raw: string): string {
  const key = raw.toLowerCase();
  if (key === "facebook" || key === "meta" || key === "instagram") return "Meta";
  if (key === "google") return "Google Ads";
  if (key === "tiktok") return "TikTok";
  return raw;
}

function toMystery(rows: Array<{
  campaignName: string;
  platform: string;
  totalSpend: number;
  totalConversionValue: number;
  roas: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  cpc: number;
}>): MysteryCampaign[] {
  return rows.map((r) => {
    const impressions = r.totalImpressions ?? 0;
    const clicks = r.totalClicks ?? 0;
    return {
      name: r.campaignName || "Unknown campaign",
      platform: mapPlatform(String(r.platform ?? "")),
      spend: r.totalSpend ?? 0,
      revenue: r.totalConversionValue ?? 0,
      roas: Number.isFinite(r.roas) ? r.roas : 0,
      clicks,
      impressions,
      conversions: r.totalConversions ?? 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: r.cpc ?? 0,
    };
  });
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; activeUsers: number }>;
}) {
  return (
    <div className={cn(GLASS, "p-4")}>
      <p className="text-[11px] uppercase tracking-wider text-white/40">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">None in the last 30 minutes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <li key={`${title}-${index}-${row.label}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-white/80">{row.label}</span>
              <span className="tabular-nums text-white">{row.activeUsers}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LiveOrgRealtime() {
  const [streaming, setStreaming] = useState(true);
  const [mountedAt] = useState(() => Date.now());
  const [uptime, setUptime] = useState("00:00");
  const [ticks, setTicks] = useState(0);
  const range = useIsoDateRange(30);
  const datesValid = range.startDate !== "";
  const { formatExact, currency } = useCurrency();
  const { brandId, selected, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && Boolean(brandId);

  const snapshotQuery = api.marketing.getTodaySnapshot.useQuery(shopQuery, {
    refetchInterval: streaming ? 15_000 : false,
    refetchOnWindowFocus: false,
    enabled: shopReady,
  });
  const ga4Realtime = api.marketing.getGa4Realtime.useQuery(shopQuery, {
    refetchInterval: streaming ? 45_000 : false,
    refetchOnWindowFocus: false,
    enabled: shopReady,
  });
  const blended = api.marketing.getBlendedPerformance.useQuery(
    { startDate: range.startDate, endDate: range.endDate, ...shopQuery },
    { enabled: datesValid && shopReady },
  );
  const top = api.marketing.getTopCampaigns.useQuery(
    {
      startDate: range.startDate,
      endDate: range.endDate,
      metric: "spend",
      limit: 10,
      ...shopQuery,
    },
    { enabled: datesValid && shopReady },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: range.startDate, endDate: range.endDate, ...shopQuery },
    { enabled: datesValid && shopReady },
  );
  const wooMix = api.commerce.getOrderSourceMix.useQuery(
    { startDate: range.startDate, endDate: range.endDate, ...shopQuery },
    { enabled: datesValid && shopReady },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: range.startDate, endDate: range.endDate, ...shopQuery },
    { enabled: datesValid && shopReady },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery({});

  useEffect(() => {
    if (snapshotQuery.dataUpdatedAt || ga4Realtime.dataUpdatedAt) setTicks((n) => n + 1);
  }, [snapshotQuery.dataUpdatedAt, ga4Realtime.dataUpdatedAt]);

  useEffect(() => {
    if (!streaming) return;
    const id = window.setInterval(() => {
      const sec = Math.floor((Date.now() - mountedAt) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      setUptime(`${mm}:${ss}`);
    }, 1000);
    return () => window.clearInterval(id);
  }, [streaming, mountedAt]);

  const platforms = snapshotQuery.data?.data?.platforms ?? [];
  const asOf = snapshotQuery.data?.data?.date;
  const isToday = snapshotQuery.data?.data?.isToday !== false;
  const lastUpdated =
    snapshotQuery.dataUpdatedAt > 0 ? new Date(snapshotQuery.dataUpdatedAt) : null;
  const ga4Updated =
    ga4Realtime.dataUpdatedAt > 0 ? new Date(ga4Realtime.dataUpdatedAt) : null;

  const campaigns = top.data?.data?.campaigns ?? [];
  const mysteryCampaigns = useMemo(
    () =>
      toMystery(
        campaigns.map((r) => ({
          campaignName: r.campaignName,
          platform: r.platform,
          totalSpend: r.totalSpend,
          totalConversionValue: r.totalConversionValue,
          roas: r.roas,
          totalClicks: r.totalClicks,
          totalImpressions: r.totalImpressions,
          totalConversions: r.totalConversions,
          cpc: r.cpc ?? 0,
        })),
      ),
    [campaigns],
  );
  const totalSpend = campaigns.reduce((a, c) => a + (c.totalSpend ?? 0), 0) || 1;

  const roasSeries = (blended.data?.data?.timeseries ?? []).slice(-14).map((d) => ({
    date: d.date.slice(5),
    roas: Number((d.blendedROAS ?? 0).toFixed(2)),
  }));

  const activity = useMemo(() => {
    const syncEvents = (syncStatus.data?.platforms ?? []).flatMap((p) =>
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
      campaigns: mysteryCampaigns.map((c) => ({
        name: c.name,
        platform: c.platform,
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
      })),
      syncEvents,
      currency,
    });
  }, [syncStatus.data, mysteryCampaigns, currency]);

  const ga4 = ga4Realtime.data;
  const mer = merQuery.data?.data;
  const ga4Channels = ga4Mix.data?.data?.channels ?? [];
  const ga4Totals = ga4Mix.data?.data?.totals;
  const wooChannels = wooMix.data?.data?.channels ?? [];

  const refreshAll = () => {
    void snapshotQuery.refetch();
    void ga4Realtime.refetch();
    void ga4Mix.refetch();
    void merQuery.refetch();
    void wooMix.refetch();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Real-Time Analytics
            </h1>
            <Badge
              className={cn(
                "border",
                streaming
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/15 bg-white/5 text-zinc-400",
              )}
            >
              {streaming ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
              {streaming ? "Two clocks polling" : "Paused"}
            </Badge>
            {selected?.name ? (
              <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                {selected.name}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-zinc-400">
            Site now is GA4 Realtime (last ~30 minutes). Ads today is paid DailyMetric.
            Settled GA4 sessions are not live visitors. Pixel ROAS is not till.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={snapshotQuery.isFetching || ga4Realtime.isFetching}
            className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                (snapshotQuery.isFetching || ga4Realtime.isFetching) && "animate-spin",
              )}
            />
            Refresh now
          </Button>
          <Button
            onClick={() => setStreaming((v) => !v)}
            className={
              streaming
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }
          >
            {streaming ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Stop stream
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start stream
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={cn(GLASS, "grid gap-3 p-4 sm:grid-cols-4")}>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40">Site clock</p>
          <p className="mt-1 text-sm font-medium text-white">GA4 Realtime · 45s</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40">Ads clock</p>
          <p className="mt-1 text-sm font-medium text-white">
            Paid DailyMetric · 15s{asOf ? ` · ${asOf}` : ""}
            {isToday ? "" : " (latest day)"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40">Uptime</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-white">{uptime}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/40">Last ticks</p>
          <p className="mt-1 text-sm tabular-nums text-white">
            {ticks} · site {ga4Updated ? formatTime(ga4Updated) : "—"} · ads{" "}
            {lastUpdated ? formatTime(lastUpdated) : "—"}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Site now</h2>
            <p className="text-xs text-white/45">
              Active users in the last ~30 minutes. Not unique visitors on Earth. Not checkouts.
              {ga4?.status === "ok" && ga4.propertyName
                ? ` Property: ${ga4.propertyName}${ga4.propertyId ? ` (${ga4.propertyId})` : ""}.`
                : ""}
            </p>
          </div>
          <Link href="/connections" className="text-xs text-white/50 underline-offset-2 hover:text-white hover:underline">
            Connections
          </Link>
        </div>
        {brandsLoading || !brandId || ga4Realtime.isLoading ? (
          <div className={cn(GLASS, "flex min-h-[12rem] items-center justify-center")}>
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          </div>
        ) : ga4?.status !== "ok" ? (
          <div className={cn(GLASS, "p-8 text-sm text-zinc-400")}>
            {ga4?.message ?? "Connect Google Analytics to see who is on the shop now."}{" "}
            <Link href="/connections" className="text-white underline-offset-2 hover:underline">
              Open Connections
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className={cn(GLASS, "p-4")}>
                <p className="text-[11px] uppercase tracking-wider text-white/40">Active users</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {ga4.totals.activeUsers.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-[11px] text-white/35">Last ~30 min</p>
              </div>
              <div className={cn(GLASS, "p-4")}>
                <p className="text-[11px] uppercase tracking-wider text-white/40">Views</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {ga4.totals.screenPageViews.toLocaleString("en-US")}
                </p>
              </div>
              <div className={cn(GLASS, "p-4")}>
                <p className="text-[11px] uppercase tracking-wider text-white/40">Events</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {ga4.totals.eventCount.toLocaleString("en-US")}
                </p>
              </div>
              <div className={cn(GLASS, "p-4")}>
                <p className="text-[11px] uppercase tracking-wider text-white/40">Key events</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {ga4.totals.keyEvents.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-[11px] text-white/35">Not Meta purchases</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <BreakdownList title="Country" rows={ga4.countries} />
              <BreakdownList title="Device" rows={ga4.devices} />
              <BreakdownList title="Page" rows={collapseGa4BreakdownByShortLabel(ga4.pages)} />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Three lenses · last 30 days</h2>
          <p className="text-xs text-white/45">
            Settled GA4 sessions, Woo last-click till, and paid-ad pixel. Different models — do not add them
            into one ROAS. Organic Search here is not Google Ads spend.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className={cn(GLASS, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-orange-300" />
              <h3 className="font-semibold text-white">GA4 site</h3>
            </div>
            <p className="text-xs text-white/40">
              {ga4Totals
                ? `${ga4Totals.sessions.toLocaleString("en-US")} sessions · ${ga4Totals.purchases.toLocaleString("en-US")} ecommerce purchases · ${formatExact(ga4Totals.revenue)} GA4 revenue`
                : "Sync Google Analytics to load channel days."}
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
              {ga4Channels.slice(0, 8).map((row) => (
                <li key={row.channel} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-white/80">{row.channel}</span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-white/55">
                    {row.sessions.toLocaleString("en-US")} sess · {row.purchases.toLocaleString("en-US")} buy
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={cn(GLASS, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-white">Woo last-click</h3>
            </div>
            <p className="text-xs text-white/40">
              {mer
                ? `${mer.orderCount.toLocaleString("en-US")} paid orders · ${formatExact(mer.totalRevenue)} store net`
                : "Sync WooCommerce to load till mix."}
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
              {wooChannels.map((row) => (
                <li key={row.channel} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-white/80">{row.label}</span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-white/55">
                    {row.orders} · {formatExact(row.netSales)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={cn(GLASS, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <h3 className="font-semibold text-white">Paid ads pixel</h3>
            </div>
            <p className="text-xs text-white/40">
              Meta / Google Ads / TikTok DailyMetric only. GA4 sessions are excluded.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500">Ad spend</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">
                  {formatExact(mer?.totalSpend ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500">Pixel conversions</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">
                  {(mer?.pixelConversions ?? 0).toLocaleString("en-US")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500">Pixel ROAS</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">
                  {(mer?.platformROAS ?? 0).toFixed(2)}x
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500">Store MER</p>
                <p className="mt-0.5 font-semibold tabular-nums text-white">
                  {(mer?.mer ?? 0).toFixed(2)}x
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 md:grid-cols-4">
          {[
            { value: "overview", label: "Ads today" },
            { value: "campaigns", label: "Campaign Monitor" },
            { value: "events", label: "Event Stream" },
            { value: "mystery", label: "Mystery AI" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white md:text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {brandsLoading || !brandId || snapshotQuery.isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
            </div>
          ) : platforms.length === 0 ? (
            <div className={cn(GLASS, "p-12 text-center text-sm text-zinc-400")}>
              No paid-ad DailyMetric rows for this shop yet. Sync Meta from{" "}
              <Link href="/connections" className="text-white underline-offset-2 hover:underline">
                Connections
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {platforms.map((p, i) => {
                const key = String(p.platform ?? i);
                const color = PLATFORM_COLOR[key.toLowerCase()] ?? "#8b8b93";
                const records =
                  typeof p.records === "number" ? p.records : (p.records as { _all?: number })?._all ?? 0;
                return (
                  <div key={key} className={cn(GLASS, "relative overflow-hidden p-6")}>
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-white">{mapPlatform(key)}</h3>
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                        {records} records
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-zinc-500">Spend</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                          {formatExact(Number(p.totalSpend ?? 0))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-zinc-500">Pixel conversions</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                          {Number(p.totalConversions ?? 0).toLocaleString("en-US")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-zinc-500">Impressions</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                          {Number(p.totalImpressions ?? 0).toLocaleString("en-US")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-zinc-500">Clicks</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                          {Number(p.totalClicks ?? 0).toLocaleString("en-US")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Daily pixel ROAS</h3>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                Last {roasSeries.length} days · paid ads only
              </Badge>
            </div>
            {roasSeries.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">No timeseries yet.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={roasSeries}>
                    <defs>
                      <linearGradient id="liveRoasFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v.toFixed(1)}x`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(24,24,27,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)}x`, "Pixel ROAS"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="roas"
                      stroke="#34d399"
                      strokeWidth={2}
                      fill="url(#liveRoasFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className={cn(GLASS, "p-12 text-center text-sm text-zinc-400")}>
                No paid campaign rows in the last 30 days.
              </div>
            ) : (
              campaigns.map((c) => {
                const share = ((c.totalSpend ?? 0) / totalSpend) * 100;
                const ctr =
                  (c.totalImpressions ?? 0) > 0
                    ? ((c.totalClicks ?? 0) / (c.totalImpressions ?? 1)) * 100
                    : 0;
                return (
                  <div key={`${c.campaignId}-${c.platform}`} className={cn(GLASS, "p-4")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{c.campaignName}</p>
                        <p className="text-xs text-white/40">{mapPlatform(String(c.platform))}</p>
                      </div>
                      <p className="text-sm tabular-nums text-white">{c.roas.toFixed(2)}x pixel ROAS</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/55">
                      <span>{formatExact(c.totalSpend ?? 0)} spend</span>
                      <span>{ctr.toFixed(2)}% CTR</span>
                      <span>{formatExact(c.cpc ?? 0)} CPC</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400/80"
                        style={{ width: `${Math.min(100, share)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-white/35">{share.toFixed(0)}% of window spend</p>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div className={cn(GLASS, "divide-y divide-white/5")}>
            {activity.length === 0 ? (
              <p className="p-10 text-center text-sm text-zinc-500">No sync jobs or campaigns yet.</p>
            ) : (
              activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? "/connections"}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-white/[0.03]"
                >
                  <Activity className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-sm text-white">{item.title}</p>
                    <p className="text-xs text-white/40">{item.detail}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="mystery">
          <div className={cn(GLASS, "p-5")}>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-white">Mystery AI</h3>
            </div>
            <FortunePanel campaigns={mysteryCampaigns} loading={top.isLoading} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
