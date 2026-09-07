"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BellOff,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Minus,
  MousePointer,
  Pause,
  Play,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/use-active-org";
import { LiveOrgRealtime } from "@/components/realtime/live-org-monitor";
import { FortunePanel } from "@/components/mystery/fortune-panel";
import { useCurrency } from "@/components/providers/currency";

// ---------------------------------------------------------------------------
// Platform color system
// ---------------------------------------------------------------------------
const PLATFORMS = {
  Meta: { color: "#1877F2", label: "Meta" },
  Google: { color: "#4285F4", label: "Google" },
  TikTok: { color: "#FF0050", label: "TikTok" },
  WooCommerce: { color: "#96588A", label: "WooCommerce" },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

/** Resolve a raw platform string (e.g. "meta") to its display config. */
function platformConfig(platform: string): { color: string; label: string } {
  const byKey = (PLATFORMS as Record<string, { color: string; label: string }>)[platform];
  if (byKey) return byKey;
  const cap = platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  return (PLATFORMS as Record<string, { color: string; label: string }>)[cap] ?? {
    color: "#8b8b93",
    label: platform,
  };
}

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LiveCampaign {
  id: string;
  name: string;
  platform: PlatformKey;
  status: "active" | "paused";
  spend: number;
  budget: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  alerts: number;
}

interface StreamEvent {
  id: string;
  campaignId: string;
  campaignName: string;
  platform: PlatformKey;
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  actionRequired: boolean;
  timestamp: Date;
}

interface LiveMetric {
  id: string;
  metric: "spend" | "roas" | "ctr" | "cpc" | "conversions" | "cpm";
  campaignName: string;
  platform: PlatformKey;
  value: number;
  change: number;
  trend: "up" | "down" | "stable";
}

// ---------------------------------------------------------------------------
// Demo data — inline, presentation only
// ---------------------------------------------------------------------------
const DEMO_CAMPAIGNS: LiveCampaign[] = [
  {
    id: "cmp-001",
    name: "Q4 Retargeting — DPA",
    platform: "Meta",
    status: "active",
    spend: 4820,
    budget: 6500,
    impressions: 412000,
    clicks: 9840,
    conversions: 312,
    ctr: 2.39,
    cpc: 0.49,
    roas: 4.62,
    alerts: 1,
  },
  {
    id: "cmp-002",
    name: "Search — Brand Defense",
    platform: "Google",
    status: "active",
    spend: 3150,
    budget: 4000,
    impressions: 186000,
    clicks: 11200,
    conversions: 421,
    ctr: 6.02,
    cpc: 0.28,
    roas: 5.11,
    alerts: 0,
  },
  {
    id: "cmp-003",
    name: "Spark Ads — Creator Collab",
    platform: "TikTok",
    status: "active",
    spend: 2240,
    budget: 3000,
    impressions: 528000,
    clicks: 14780,
    conversions: 198,
    ctr: 2.8,
    cpc: 0.15,
    roas: 3.34,
    alerts: 0,
  },
  {
    id: "cmp-004",
    name: "PMax — Catalog Growth",
    platform: "Google",
    status: "active",
    spend: 3960,
    budget: 5000,
    impressions: 298000,
    clicks: 8940,
    conversions: 267,
    ctr: 3.0,
    cpc: 0.44,
    roas: 3.87,
    alerts: 2,
  },
  {
    id: "cmp-005",
    name: "WooCommerce Recovery Flow",
    platform: "WooCommerce",
    status: "active",
    spend: 890,
    budget: 1200,
    impressions: 64000,
    clicks: 3810,
    conversions: 189,
    ctr: 5.95,
    cpc: 0.23,
    roas: 6.18,
    alerts: 0,
  },
];

const DEMO_EVENTS: StreamEvent[] = [
  {
    id: "evt-001",
    campaignId: "cmp-001",
    campaignName: "Q4 Retargeting — DPA",
    platform: "Meta",
    type: "budget_threshold",
    severity: "high",
    message: "Campaign pacing at 118% of daily budget target — overspend risk detected.",
    actionRequired: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 6),
  },
  {
    id: "evt-002",
    campaignId: "cmp-004",
    campaignName: "PMax — Catalog Growth",
    platform: "Google",
    type: "asset_fatigue",
    severity: "medium",
    message: "Video asset CTR declined 22% over 7 days — rotation recommended.",
    actionRequired: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 14),
  },
  {
    id: "evt-003",
    campaignId: "cmp-003",
    campaignName: "Spark Ads — Creator Collab",
    platform: "TikTok",
    type: "conversion_burst",
    severity: "low",
    message: "Conversion rate spiked 34% in the last hour — favorable delivery window.",
    actionRequired: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 22),
  },
  {
    id: "evt-004",
    campaignId: "cmp-002",
    campaignName: "Search — Brand Defense",
    platform: "Google",
    type: "auction_pressure",
    severity: "medium",
    message: "New competitor entered branded auction — CPC up 9% this hour.",
    actionRequired: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 38),
  },
  {
    id: "evt-005",
    campaignId: "cmp-005",
    campaignName: "WooCommerce Recovery Flow",
    platform: "WooCommerce",
    type: "sync_complete",
    severity: "low",
    message: "Product catalog synchronized — 1,248 SKUs updated.",
    actionRequired: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 52),
  },
];

const DEMO_METRICS: LiveMetric[] = [
  { id: "m-1", metric: "spend", campaignName: "Q4 Retargeting — DPA", platform: "Meta", value: 4820, change: 3.2, trend: "up" },
  { id: "m-2", metric: "roas", campaignName: "Search — Brand Defense", platform: "Google", value: 5.11, change: 1.4, trend: "up" },
  { id: "m-3", metric: "ctr", campaignName: "Spark Ads — Creator Collab", platform: "TikTok", value: 2.8, change: -2.1, trend: "down" },
  { id: "m-4", metric: "cpc", campaignName: "PMax — Catalog Growth", platform: "Google", value: 0.44, change: 4.8, trend: "up" },
  { id: "m-5", metric: "conversions", campaignName: "WooCommerce Recovery Flow", platform: "WooCommerce", value: 189, change: 12.3, trend: "up" },
  { id: "m-6", metric: "cpm", campaignName: "Q4 Retargeting — DPA", platform: "Meta", value: 6.4, change: -1.9, trend: "down" },
  { id: "m-7", metric: "spend", campaignName: "PMax — Catalog Growth", platform: "Google", value: 3960, change: 2.7, trend: "up" },
  { id: "m-8", metric: "roas", campaignName: "Q4 Retargeting — DPA", platform: "Meta", value: 4.62, change: 0.8, trend: "up" },
  { id: "m-9", metric: "conversions", campaignName: "Spark Ads — Creator Collab", platform: "TikTok", value: 198, change: 6.5, trend: "up" },
];

const EVENT_POOL: Omit<StreamEvent, "id" | "timestamp">[] = [
  {
    campaignId: "cmp-001",
    campaignName: "Q4 Retargeting — DPA",
    platform: "Meta",
    type: "conversion_burst",
    severity: "low",
    message: "Purchase event batch received — 14 conversions in the last 5 minutes.",
    actionRequired: false,
  },
  {
    campaignId: "cmp-003",
    campaignName: "Spark Ads — Creator Collab",
    platform: "TikTok",
    type: "cpc_drop",
    severity: "low",
    message: "CPC improved 11% — delivery efficiency gaining as the hour progresses.",
    actionRequired: false,
  },
  {
    campaignId: "cmp-004",
    campaignName: "PMax — Catalog Growth",
    platform: "Google",
    type: "budget_threshold",
    severity: "high",
    message: "Pacing alert: 85% of daily budget consumed with 6 hours remaining.",
    actionRequired: true,
  },
  {
    campaignId: "cmp-002",
    campaignName: "Search — Brand Defense",
    platform: "Google",
    type: "quality_score",
    severity: "medium",
    message: "Ad relevance dipped below 8 on two keywords — Quality Score at risk.",
    actionRequired: false,
  },
  {
    campaignId: "cmp-001",
    campaignName: "Q4 Retargeting — DPA",
    platform: "Meta",
    type: "frequency_cap",
    severity: "medium",
    message: "Average frequency crossed 5.0 — audience fatigue threshold approaching.",
    actionRequired: false,
  },
  {
    campaignId: "cmp-005",
    campaignName: "WooCommerce Recovery Flow",
    platform: "WooCommerce",
    type: "sync_complete",
    severity: "low",
    message: "Server-side event flush complete — attribution gap closed.",
    actionRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function jitter(base: number, amount: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * amount);
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  paused: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
};

const SEVERITY_STYLES: Record<string, { border: string; badge: string }> = {
  high: { border: "border-l-red-500 bg-red-500/10", badge: "border-red-500/30 bg-red-500/10 text-red-300" },
  medium: { border: "border-l-yellow-500 bg-yellow-500/10", badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300" },
  low: { border: "border-l-emerald-500 bg-emerald-500/10", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-emerald-400" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-zinc-400" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RealTimePage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { format: formatEuro, formatExact } = useCurrency();

  const [campaigns, setCampaigns] = useState<LiveCampaign[]>(DEMO_CAMPAIGNS);
  const [events, setEvents] = useState<StreamEvent[]>(DEMO_EVENTS);
  const [metrics, setMetrics] = useState<LiveMetric[]>(DEMO_METRICS);
  const [isStreaming, setIsStreaming] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [roasHistory, setRoasHistory] = useState<{ time: string; roas: number }[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      time: new Date(Date.now() - (11 - i) * 5000).toLocaleTimeString("en-US", {
        hour12: false,
        minute: "2-digit",
        second: "2-digit",
      }),
      roas: Number(jitter(4.1, 0.12).toFixed(2)),
    })),
  );
  const eventCounter = useRef(100);
  const alertsRef = useRef(alertsEnabled);
  alertsRef.current = alertsEnabled;

  // Simulated live stream — ticks every 2.5s while streaming is enabled.
  useEffect(() => {
    if (!isStreaming || !isDemo) return;
    const interval = setInterval(() => {
      setLastUpdate(new Date());

      // Advance campaigns
      setCampaigns((prev) =>
        prev.map((c) =>
          c.status === "active"
            ? {
                ...c,
                spend: c.spend + jitter(14, 0.6),
                impressions: c.impressions + Math.round(jitter(340, 0.5)),
                clicks: c.clicks + Math.round(jitter(11, 0.6)),
                conversions: c.conversions + (Math.random() > 0.55 ? 1 : 0),
                roas: Number(jitter(c.roas, 0.03).toFixed(2)),
                ctr: Number(jitter(c.ctr, 0.04).toFixed(2)),
                cpc: Number(jitter(c.cpc, 0.05).toFixed(2)),
              }
            : c,
        ),
      );

      // Push a ROAS data point
      setRoasHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString("en-US", { hour12: false, minute: "2-digit", second: "2-digit" }),
            roas: Number(jitter(4.1, 0.1).toFixed(2)),
          },
        ];
        return next.slice(-24);
      });

      // Advance live metrics
      setMetrics((prev) =>
        prev.map((m) => {
          const change = Number(jitter(m.change, 0.3).toFixed(1));
          return {
            ...m,
            value: Number(jitter(m.value, 0.02).toFixed(m.metric === "conversions" ? 0 : 2)),
            change,
            trend: change > 0.5 ? "up" : change < -0.5 ? "down" : "stable",
          };
        }),
      );

      // Occasionally emit a new event
      if (Math.random() > 0.6) {
        const template = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
        eventCounter.current += 1;
        setEvents((prev) =>
          [{ ...template, id: `evt-${eventCounter.current}`, timestamp: new Date() }, ...prev].slice(0, 20),
        );
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isStreaming, isDemo]);

  const chartData = useMemo(() => roasHistory, [roasHistory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    return <LiveOrgRealtime />;
  }

  /* demo-only simulated stream below — live orgs use LiveOrgRealtime */
  const toggleStreaming = () => setIsStreaming((prev) => !prev);


  const toggleCampaign = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "paused" : "active" } : c)),
    );
  };

  const increaseBudget = (id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, budget: c.budget + 500 } : c)));
  };

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const avgROAS = campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length;
  const activeAlerts = campaigns.reduce((sum, c) => sum + c.alerts, 0);

  const statCards = [
    {
      label: "Total Ad Spend",
      value: formatEuro(totalSpend),
      sub: "Real-time tracking",
      icon: DollarSign,
      accent: "from-blue-500/20 to-cyan-500/10",
      iconColor: "text-blue-400",
    },
    {
      label: "Live Conversions",
      value: Math.round(totalConversions).toLocaleString("en-US"),
      sub: isStreaming ? "Streaming live" : "Stream paused",
      icon: ShoppingCart,
      accent: "from-emerald-500/20 to-green-500/10",
      iconColor: "text-emerald-400",
    },
    {
      label: "Average ROAS",
      value: `${avgROAS.toFixed(2)}x`,
      sub: "Live calculation",
      icon: TrendingUp,
      accent: "from-violet-500/20 to-purple-500/10",
      iconColor: "text-violet-400",
    },
    {
      label: "Active Alerts",
      value: String(activeAlerts),
      sub: activeAlerts > 0 ? "Action required" : "All systems normal",
      icon: AlertTriangle,
      accent: "from-red-500/20 to-orange-500/10",
      iconColor: "text-red-400",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Demo workspace · simulated Q4 Retargeting stream. Live BAGTOBAG Realtime is the org monitor, not this theater.
      </div>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Real-Time Analytics
            </h1>
            <Badge
              className={cn(
                "border",
                isStreaming
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300",
              )}
            >
              {isStreaming ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
              {isStreaming ? "Stream Connected" : "Stream Disconnected"}
            </Badge>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Last update {formatTime(lastUpdate)}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400">
            Live campaign monitoring with streaming metrics, event feeds, and instant anomaly detection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAlertsEnabled((prev) => !prev)}
            className={cn(
              "border-white/15 bg-transparent",
              alertsEnabled ? "text-emerald-300 hover:bg-emerald-500/10" : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {alertsEnabled ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
            Alerts {alertsEnabled ? "On" : "Off"}
          </Button>
          <Button
            onClick={toggleStreaming}
            className={
              isStreaming
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500"
            }
          >
            {isStreaming ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Stop Stream
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Stream
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 * i, duration: 0.5 }}
            className={cn(GLASS, "relative overflow-hidden p-6")}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", stat.accent)} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">{stat.value}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                  {stat.label === "Live Conversions" && isStreaming && (
                    <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
                  )}
                  {stat.sub}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 md:grid-cols-5">
          {[
            { value: "overview", label: "Live Overview" },
            { value: "campaigns", label: "Campaign Monitor" },
            { value: "events", label: "Event Stream" },
            { value: "metrics", label: "Live Metrics" },
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

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Live ROAS chart */}
            <div className={cn(GLASS, "p-6")}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-semibold text-white">Real-Time ROAS Tracking</h3>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                  {isStreaming ? "Updating every 2.5s" : "Paused"}
                </Badge>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="roasFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={[3, 5.5]}
                      tickFormatter={(v: number) => `${v.toFixed(1)}x`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(24,24,27,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}x`, "Blended ROAS"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="roas"
                      stroke="#34d399"
                      strokeWidth={2}
                      fill="url(#roasFill)"
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Last {chartData.length} updates</span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  Account blended average
                </span>
              </div>
            </div>

            {/* Live campaign status */}
            <div className={cn(GLASS, "p-6")}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Live Campaign Status</h3>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                  {campaigns.filter((c) => c.status === "active").length} active
                </Badge>
              </div>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{
                          backgroundColor: `${PLATFORMS[campaign.platform].color}2e`,
                          border: `1px solid ${PLATFORMS[campaign.platform].color}59`,
                        }}
                      >
                        {PLATFORMS[campaign.platform].label.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-medium text-white">{campaign.name}</h4>
                        <p className="text-xs text-zinc-500">
                          {formatEuro(campaign.spend)} / {formatEuro(campaign.budget)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={cn("border", STATUS_STYLES[campaign.status])}>{campaign.status}</Badge>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold tabular-nums",
                          campaign.roas >= 4
                            ? "text-emerald-400"
                            : campaign.roas >= 2.5
                              ? "text-blue-400"
                              : "text-red-400",
                        )}
                      >
                        {campaign.roas.toFixed(2)}x ROAS
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent events */}
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Recent Events</h3>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                {events.length} in buffer
              </Badge>
            </div>
            <div className="space-y-3">
              {events.slice(0, 4).map((event) => {
                const severity = SEVERITY_STYLES[event.severity];
                return (
                  <div key={event.id} className={cn("rounded-xl border border-white/10 border-l-2 p-3", severity.border)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PLATFORMS[event.platform].color }}
                        />
                        <span className="text-sm font-medium text-white">{event.message}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("border", severity.badge)}>{event.severity}</Badge>
                        <span className="text-xs tabular-nums text-zinc-500">{formatTime(event.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Campaign monitor */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.map((campaign, index) => {
            const budgetUtilization = (campaign.spend / campaign.budget) * 100;
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index, duration: 0.4 }}
                className={cn(GLASS, "p-6")}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{
                        backgroundColor: `${PLATFORMS[campaign.platform].color}2e`,
                        border: `1px solid ${PLATFORMS[campaign.platform].color}59`,
                      }}
                    >
                      {PLATFORMS[campaign.platform].label.slice(0, 2)}
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{campaign.name}</h3>
                      <p className="text-xs text-zinc-500">
                        ID {campaign.id} · {PLATFORMS[campaign.platform].label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("border", STATUS_STYLES[campaign.status])}>{campaign.status}</Badge>
                    {campaign.alerts > 0 && (
                      <Badge className="border-red-500/30 bg-red-500/10 text-red-300">
                        {campaign.alerts} alert{campaign.alerts > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { label: "Spend", value: formatEuro(campaign.spend) },
                    { label: "Impressions", value: campaign.impressions.toLocaleString("en-US") },
                    { label: "Clicks", value: campaign.clicks.toLocaleString("en-US") },
                    { label: "Conversions", value: String(campaign.conversions) },
                    { label: "CTR", value: `${campaign.ctr.toFixed(2)}%` },
                    { label: "CPC", value: formatExact(campaign.cpc) },
                    {
                      label: "ROAS",
                      value: `${campaign.roas.toFixed(2)}x`,
                      highlight:
                        campaign.roas >= 4
                          ? "text-emerald-400"
                          : campaign.roas >= 2.5
                            ? "text-blue-400"
                            : "text-red-400",
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="text-center">
                      <p className="text-xs text-zinc-500">{metric.label}</p>
                      <p
                        className={cn(
                          "font-semibold tabular-nums text-white",
                          "highlight" in metric && metric.highlight,
                        )}
                      >
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Budget progress */}
                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-zinc-400">Budget utilization</span>
                    <span className="font-semibold tabular-nums text-white">
                      {budgetUtilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        budgetUtilization > 90
                          ? "bg-gradient-to-r from-red-500 to-orange-400"
                          : budgetUtilization > 75
                            ? "bg-gradient-to-r from-yellow-500 to-amber-400"
                            : "bg-gradient-to-r from-emerald-500 to-teal-400",
                      )}
                      style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatEuro(campaign.spend)} of {formatEuro(campaign.budget)} daily budget
                  </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleCampaign(campaign.id)}
                    className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                  >
                    {campaign.status === "active" ? (
                      <>
                        <Pause className="mr-1 h-3 w-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-3 w-3" /> Resume
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => increaseBudget(campaign.id)}
                    className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                  >
                    <TrendingUp className="mr-1 h-3 w-3" /> +{formatEuro(500)} Budget
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> View Details
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* Event stream */}
        <TabsContent value="events" className="space-y-6">
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-white">Real-Time Event Stream</h3>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "border-white/10 bg-white/5 text-zinc-300",
                  isStreaming && "border-emerald-500/30 text-emerald-300",
                )}
              >
                {isStreaming ? (
                  <>
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </>
                ) : (
                  "Paused"
                )}
              </Badge>
            </div>

            <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {events.map((event) => {
                  const severity = SEVERITY_STYLES[event.severity];
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className={cn("rounded-xl border border-white/10 border-l-2 p-4", severity.border)}
                    >
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                            style={{
                              backgroundColor: `${PLATFORMS[event.platform].color}33`,
                              border: `1px solid ${PLATFORMS[event.platform].color}66`,
                            }}
                          >
                            {PLATFORMS[event.platform].label}
                          </span>
                          <div>
                            <h4 className="text-sm font-medium text-white">
                              {event.type.replace(/_/g, " ").toUpperCase()}
                            </h4>
                            <p className="text-xs text-zinc-500">{event.campaignName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("border", severity.badge)}>{event.severity}</Badge>
                          <span className="text-xs tabular-nums text-zinc-500">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300">{event.message}</p>
                      {event.actionRequired && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Immediate action required on this event
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {events.length === 0 && (
                <div className="py-12 text-center">
                  <Activity className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
                  <h3 className="mb-1 text-lg font-medium text-white">No events yet</h3>
                  <p className="text-sm text-zinc-500">
                    {isStreaming ? "Waiting for real-time events…" : "Start streaming to see live events"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Live metrics */}
        <TabsContent value="metrics" className="space-y-6">
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointer className="h-5 w-5 text-fuchsia-400" />
                <h3 className="font-semibold text-white">Live Metrics Dashboard</h3>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                {isStreaming ? "Auto-refreshing" : "Frozen"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PLATFORMS[metric.platform].color }}
                      />
                      <span className="text-sm font-medium text-white">{metric.metric.toUpperCase()}</span>
                    </div>
                    <TrendIcon trend={metric.trend} />
                  </div>
                  <div className="text-xl font-bold tabular-nums text-white">
                    {metric.metric === "spend"
                      ? formatEuro(metric.value)
                      : metric.metric === "cpc" || metric.metric === "cpm"
                        ? formatExact(metric.value)
                        : metric.metric === "roas"
                          ? `${metric.value.toFixed(2)}x`
                          : metric.metric === "ctr"
                            ? `${metric.value.toFixed(2)}%`
                            : Math.round(metric.value).toLocaleString("en-US")}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="truncate text-zinc-500">{metric.campaignName}</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        metric.change > 0
                          ? metric.metric === "cpc" || metric.metric === "cpm"
                            ? "text-red-400"
                            : "text-emerald-400"
                          : metric.change < 0
                            ? metric.metric === "cpc" || metric.metric === "cpm"
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-zinc-400",
                      )}
                    >
                      {metric.change > 0 ? "+" : ""}
                      {metric.change}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(GLASS, "flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5">
                <RefreshCw className={cn("h-5 w-5 text-blue-400", isStreaming && "animate-spin")} />
              </div>
              <div>
                <div className="font-semibold text-white">Streaming Engine</div>
                <p className="text-sm text-zinc-400">
                  {isStreaming
                    ? `Polling 4 platform APIs — last tick ${formatTime(lastUpdate)}`
                    : "Stream stopped — press Start Stream to resume live polling"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <CheckCircle className={cn("h-4 w-4", isStreaming ? "text-emerald-400" : "text-zinc-600")} />
              Kafka-compatible pipeline · Redis-backed state
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mystery">
          <div className={cn(GLASS, "p-5")}>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-white">Mystery AI</h3>
            </div>
            <p className="mb-4 text-xs text-white/40">
              Demo workspace — readings use the simulated campaign stream on this page.
            </p>
            <FortunePanel
              campaigns={campaigns.map((c) => ({
                name: c.name,
                platform: c.platform,
                spend: c.spend,
                revenue: c.spend * c.roas,
                roas: c.roas,
                clicks: c.clicks,
                impressions: c.impressions,
                conversions: c.conversions,
                ctr: c.ctr,
                cpc: c.cpc,
              }))}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
