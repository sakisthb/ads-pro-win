"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, AlertTriangle, ArrowRight, Banknote, BarChart3, Bell, Bot, Brain, CheckCircle, Download, Eye, Filter, Info,
  Lightbulb, MessageCircle, Mic, MousePointerClick, PieChart as PieChartIcon, Send, Settings, ShoppingCart, Sparkles, Target,
  TrendingDown, TrendingUp, User, Users, X, XCircle, Zap,
} from "lucide-react";
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
import { deriveInsights, deriveStoreInsights, type CampaignLike, type PlatformPerf } from "@/lib/dashboard-insights";
import { downloadBlob, generateMultiSectionCSV } from "@/lib/export/csv-generator";
import { buildEspEmailExportRows } from "@/lib/email-desk";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { askAi } from "@/lib/ask-ai";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";

/* ------------------------------ Demo data --------------------------------- */

const PLATFORM_COLORS: Record<string, string> = {
  Meta: "#1877F2",
  Google: "#4285F4",
  TikTok: "#FF0050",
  WooCommerce: "#96588A",
};

const KPIS = [
  { title: "Impressions", value: "1,200,000", change: 8.5, color: "from-blue-500 to-blue-700" },
  { title: "Clicks", value: "45,000", change: 5.2, color: "from-emerald-500 to-green-500" },
  { title: "CTR", value: "3.75%", change: 0.3, color: "from-violet-500 to-fuchsia-500" },
  { title: "Conversions", value: "2,300", change: 2.1, color: "from-orange-500 to-amber-500" },
  { title: "ROAS", value: "4.2×", change: 0.7, color: "from-indigo-500 to-blue-400" },
  { title: "Revenue", value: "€18,500", change: 12.3, color: "from-teal-500 to-emerald-400" },
];

const LINE_DATA = [
  { name: "Mon", Impressions: 120000, Clicks: 4000 },
  { name: "Tue", Impressions: 135000, Clicks: 4200 },
  { name: "Wed", Impressions: 110000, Clicks: 3900 },
  { name: "Thu", Impressions: 142000, Clicks: 4800 },
  { name: "Fri", Impressions: 130000, Clicks: 4100 },
  { name: "Sat", Impressions: 125000, Clicks: 4300 },
  { name: "Sun", Impressions: 140000, Clicks: 4700 },
];

const BAR_DATA = [
  { platform: "Meta", Conversions: 1200 },
  { platform: "Google", Conversions: 780 },
  { platform: "TikTok", Conversions: 460 },
  { platform: "WooCommerce", Conversions: 310 },
];

const PIE_DATA = [
  { name: "Meta", value: 45 },
  { name: "Google", value: 25 },
  { name: "TikTok", value: 20 },
  { name: "WooCommerce", value: 10 },
];

interface ChatMessage {
  id: number;
  type: "ai" | "user";
  message: string;
  timestamp: string;
}

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 1,
    type: "ai",
    message:
      "Hi! I'm Saki, your AI assistant 🚀 I can help you with analytics, optimization suggestions, or answer questions about your data. What would you like to know?",
    timestamp: "14:30",
  },
  {
    id: 2,
    type: "user",
    message: "Which platform has the best ROAS?",
    timestamp: "14:31",
  },
  {
    id: 3,
    type: "ai",
    message:
      "Great question! 😊 Based on current data, Meta has the best ROAS at 4.2×, followed by Google at 3.6×. TikTok trails at 2.1×. I'd suggest shifting ~15% of TikTok budget to Meta Advantage+ campaigns for the best lift.",
    timestamp: "14:31",
  },
];

const QUICK_ACTIONS = [
  { id: 1, text: "Which platform has the best ROAS?", icon: TrendingUp, color: "from-emerald-500 to-green-600" },
  { id: 2, text: "Suggest CTR improvements", icon: Target, color: "from-blue-500 to-blue-600" },
  { id: 3, text: "Forecast for next week", icon: Activity, color: "from-violet-500 to-purple-600" },
  { id: 4, text: "Analyze my audience", icon: Users, color: "from-orange-500 to-amber-600" },
];

const AI_INSIGHTS = [
  {
    id: 1,
    type: "insight",
    title: "CTR Optimization Opportunity",
    description: "Instagram Reels placements have a 40% lower CTR than Feed. A/B test new ad copy variants this week.",
    impact: "high",
    confidence: 92,
    icon: TrendingUp,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: 2,
    type: "alert",
    title: "Budget Alert",
    description: "TikTok daily budget will be exhausted in ~2 days at current pace. Increase or reallocate to sustain delivery.",
    impact: "medium",
    confidence: 88,
    icon: AlertTriangle,
    color: "from-orange-500 to-amber-600",
  },
  {
    id: 3,
    type: "prediction",
    title: "Revenue Forecast",
    description: "Based on current trends we project a 15% revenue increase next week. Confidence is rising daily.",
    impact: "high",
    confidence: 85,
    icon: Target,
    color: "from-emerald-500 to-green-600",
  },
  {
    id: 4,
    type: "optimization",
    title: "Audience Targeting",
    description: "The 25-34 age group delivers 3× better ROAS. Recommend concentrating spend on this segment.",
    impact: "medium",
    confidence: 78,
    icon: Lightbulb,
    color: "from-violet-500 to-purple-600",
  },
];

const AI_FILTERS = [
  { id: 1, title: "High-performing campaigns", description: "Show only campaigns with CTR > 3%", confidence: 95, icon: TrendingUp, color: "from-emerald-500 to-green-600" },
  { id: 2, title: "Budget optimization", description: "Campaigns with ROAS < 2.5 to fix", confidence: 88, icon: Target, color: "from-orange-500 to-amber-600" },
  { id: 3, title: "Emerging trends", description: "Platforms growing > 10% WoW", confidence: 82, icon: Activity, color: "from-blue-500 to-blue-600" },
  { id: 4, title: "Audience insights", description: "Top segment: ages 25-34, EU", confidence: 90, icon: Users, color: "from-violet-500 to-purple-600" },
];

const PREDICTIONS = [
  { metric: "Revenue", current: "€18,500", predicted: "€22,500", confidence: 85, factors: ["Seasonal increase", "Campaign optimization", "Audience growth"] },
  { metric: "CTR", current: "3.75%", predicted: "4.20%", confidence: 78, factors: ["Ad copy improvements", "Targeting refinement"] },
  { metric: "ROAS", current: "4.2×", predicted: "4.8×", confidence: 82, factors: ["Budget reallocation", "Performance optimization"] },
  { metric: "Conversions", current: "2,300", predicted: "2,800", confidence: 75, factors: ["Landing page improvements", "Funnel optimization"] },
];

const ANOMALIES = [
  { id: 1, type: "spike", metric: "CTR", value: "8.5%", normal: "3.2%", severity: "high", description: "Unusual CTR spike on Instagram Reels", timestamp: "2 hours ago", icon: TrendingUp, color: "from-emerald-500 to-green-600" },
  { id: 2, type: "drop", metric: "Conversions", value: "150", normal: "450", severity: "medium", description: "Conversion drop on TikTok Spark Ads", timestamp: "4 hours ago", icon: TrendingDown, color: "from-red-500 to-rose-600" },
  { id: 3, type: "pattern", metric: "Budget", value: "€2,500", normal: "€1,800", severity: "low", description: "Unusual budget consumption pattern", timestamp: "6 hours ago", icon: AlertTriangle, color: "from-orange-500 to-amber-600" },
];

const NOTIFICATIONS = [
  { id: 1, type: "success", title: "CTR milestone reached!", message: "CTR hit 4.2% — a new record for your account.", priority: "high", timestamp: "2 minutes ago", icon: TrendingUp },
  { id: 2, type: "warning", title: "Budget alert", message: "TikTok budget will run out in ~6 hours.", priority: "medium", timestamp: "15 minutes ago", icon: AlertTriangle },
  { id: 3, type: "info", title: "New audience segment", message: "Detected a high-value audience: ages 25-34, EU.", priority: "low", timestamp: "1 hour ago", icon: Target },
  { id: 4, type: "alert", title: "Performance drop", message: "Instagram CTR decreased by 12% overnight.", priority: "high", timestamp: "2 hours ago", icon: TrendingDown },
  { id: 5, type: "success", title: "New conversion record!", message: "Conversions crossed 2,500 today!", priority: "high", timestamp: "5 minutes ago", icon: CheckCircle },
  { id: 6, type: "info", title: "AI insight", message: "Saki found rising engagement in Facebook Stories.", priority: "medium", timestamp: "10 minutes ago", icon: Sparkles },
  { id: 7, type: "warning", title: "Low ROAS warning", message: "Campaign “Spring Sale” is below 2.0 ROAS.", priority: "medium", timestamp: "20 minutes ago", icon: AlertTriangle },
  { id: 8, type: "error", title: "Export failed", message: "CSV export failed. Please try again.", priority: "high", timestamp: "30 minutes ago", icon: XCircle },
];

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(24,24,27,0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "12px",
};

/* ------------------------------ Subcomponents ----------------------------- */

function KpiCard({ kpi, index }: { kpi: (typeof KPIS)[number]; index: number }) {
  const { symbol } = useCurrency();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Card className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:border-white/20">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className={`rounded-2xl bg-gradient-to-br ${kpi.color} p-3 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              <TrendingUp className="h-3 w-3" /> +{kpi.change}%
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-400">{kpi.title}</p>
          <p className="mt-1 text-3xl font-bold text-white">{kpi.value.replaceAll("€", symbol)}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function AnalyticsStudioPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { formatExact, format, symbol, currency } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  const [platform, setPlatform] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-08-20");
  const [dateTo, setDateTo] = useState("2026-08-26");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; description?: string } | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });

  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);

  const datesValid = dateRange.startDate !== "" && dateRange.endDate !== "";
  const liveEnabled = !isLoading && !isDemo && datesValid && shopReady;

  const blendedQuery = api.marketing.getBlendedPerformance.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const accountsQuery = api.marketing.getAccountSummary.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const campaignsQuery = api.marketing.getTopCampaigns.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, metric: "spend", limit: 8, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const mixQuery = api.commerce.getOrderSourceMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(
    brandId ? { brandId } : {},
    { enabled: shopReady && !isDemo, retry: false, refetchOnWindowFocus: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveEnabled, retry: false, refetchOnWindowFocus: false },
  );

  const liveInsights = useMemo(() => {
    const accounts = accountsQuery.data?.data?.accounts ?? [];
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
    const totals = blendedQuery.data?.data?.totals;
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
  }, [accountsQuery.data, campaignsQuery.data, blendedQuery.data, merQuery.data, ga4Mix.data, mixQuery.data, emailMetrics.data, syncStatus.data, currency]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    const totals = blendedQuery.data?.data?.totals;
    const timeseries = blendedQuery.data?.data?.timeseries ?? [];
    const accounts = accountsQuery.data?.data?.accounts ?? [];
    const campaigns = campaignsQuery.data?.data?.campaigns ?? [];
    const chartData = timeseries.map((d) => ({
      name: d.date.slice(5),
      Spend: Number(d.totalSpend.toFixed(2)),
      Impressions: d.totalImpressions,
      Clicks: d.totalClicks,
    }));
    const mixData = accounts.map((account) => ({
      name: account.name || account.platform,
      value: Number(account.totalSpend.toFixed(2)),
      fill: PLATFORM_COLORS[account.platform.charAt(0).toUpperCase() + account.platform.slice(1)] ?? "#71717a",
    })).filter((row) => row.value > 0);

    const mer = merQuery.data?.data;
    const ga4Purchases = ga4Mix.data?.data?.totals.purchases ?? 0;
    const accountsForDesk = accountsQuery.data?.data?.accounts ?? [];
    const { clocks, blockers } = buildOperatorDesk({
      totals,
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
    const realKpis = [
      { title: "Spend", value: formatExact(totals?.totalSpend ?? 0), icon: Banknote, color: "from-amber-500 to-orange-500" },
      { title: "Impressions", value: (totals?.totalImpressions ?? 0).toLocaleString("en-US"), icon: Eye, color: "from-blue-500 to-blue-700" },
      { title: "Clicks", value: (totals?.totalClicks ?? 0).toLocaleString("en-US"), icon: MousePointerClick, color: "from-emerald-500 to-green-500" },
      { title: "Pixel conversions", value: (totals?.totalConversions ?? 0).toLocaleString("en-US"), icon: ShoppingCart, color: "from-orange-500 to-amber-500" },
      { title: "Pixel conversion value", value: formatExact(totals?.totalConversionValue ?? 0), icon: TrendingUp, color: "from-teal-500 to-emerald-400" },
      { title: "Pixel ROAS", value: `${(totals?.blendedROAS ?? 0).toFixed(2)}×`, icon: Zap, color: "from-indigo-500 to-blue-400" },
    ];

    const exportLive = () => {
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
      downloadBlob(
        blob,
        `analytics-studio-${dateRange.startDate}-${dateRange.endDate}.csv`,
      );
    };

    const askStudio = () => {
      askAi(
        `Analytics Studio ${dateRange.startDate} to ${dateRange.endDate}: spend ${formatExact(totals?.totalSpend ?? 0)}, pixel ROAS ${(totals?.blendedROAS ?? 0).toFixed(2)}×, ${totals?.totalConversions ?? 0} pixel conversions, ${mer?.orderCount ?? 0} store orders, ${ga4Purchases} GA4 ecommerce purchases, CTR ${(totals?.blendedCTR ?? 0).toFixed(2)}%. Five clocks — do not add them. GA4 sessions are not ad clicks. GSC clicks are not Ads spend. Do not invent Google or TikTok if they are not in the mix. Do not treat store MER as this pixel ROAS.`,
      );
    };

    return (
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h1 className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              Analytics Studio
            </h1>
            <p className="mt-1 text-lg text-zinc-400">
              Paid DailyMetric for this shop. Pixel conversions are not till and not GA4. Five clocks — do not add them. Saki chat stays on Demo.
            </p>
            <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {datesValid ? (
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            ) : (
              <span className="h-10 w-48 animate-pulse rounded-xl bg-white/10" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportLive}
              disabled={!timeseries.length}
              className="rounded-xl border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={askStudio}
              disabled={!totals}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Ask AI
            </Button>
          </div>
        </motion.div>

        <FiveClockStrip clocks={clocks} ready={deskReady} />
        <OperatorBlockerBoard blockers={blockers} ready={deskReady} />

        {!datesValid || blendedQuery.isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : timeseries.length === 0 ? (
          <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <BarChart3 className="h-10 w-10 text-zinc-600" />
              <p className="font-medium text-white">No synced data in this range yet</p>
              <p className="text-sm text-zinc-400">
                Run a sync from <Link href="/connections" className="font-semibold text-zinc-200 underline-offset-2 hover:underline">Connections</Link> to populate your analytics.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {realKpis.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <motion.div
                    key={kpi.title}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                  >
                    <Card className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:border-white/20">
                      <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div className={`rounded-2xl bg-gradient-to-br ${kpi.color} p-3 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <p className="text-sm font-medium text-zinc-400">{kpi.title}</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-white">{kpi.value}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                      <BarChart3 className="h-5 w-5 text-blue-400" /> Spend per day
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">Blended daily spend ({symbol})</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} minTickGap={24} />
                        <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="Spend" stroke="#F59E0B" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.26 }}>
                <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                      <BarChart3 className="h-5 w-5 text-violet-400" /> Impressions & clicks
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">Daily in the selected window</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} minTickGap={24} />
                        <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                        <Line type="monotone" dataKey="Impressions" stroke="#1877F2" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="Clicks" stroke="#10B981" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <PieChartIcon className="h-5 w-5 text-emerald-400" /> Spend mix
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Synced accounts in this window — missing Google/TikTok are not invented
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {mixData.length === 0 ? (
                    <p className="py-16 text-center text-sm text-zinc-500">No account spend in this range</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                          {mixData.map((row) => (
                            <Cell key={row.name} fill={row.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <Lightbulb className="h-5 w-5 text-amber-400" /> Operator insights
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Derived from this window — not a fake Saki transcript
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {liveInsights.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">Need more than one funded platform or campaign to rank a move.</p>
                  ) : (
                    liveInsights.map((insight) => (
                      <div key={insight.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-white">{insight.title}</p>
                          <Badge variant="outline" className="border-white/10 text-zinc-400">{insight.impact}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{insight.description}</p>
                        {insight.id === "ask-ai" ? (
                          <Button size="sm" variant="outline" onClick={askStudio} className="mt-3 border-white/15 bg-transparent text-zinc-200">
                            {insight.actionLabel}
                          </Button>
                        ) : (
                          <Link
                            href={insight.href}
                            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-300 hover:text-blue-200"
                          >
                            {insight.actionLabel} <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    ))
                  )}
                  <div className="flex flex-wrap gap-3 pt-1 text-sm">
                    <Link href="/creative-fatigue" className="text-amber-300 hover:text-amber-200">Creative Fatigue</Link>
                    <Link href="/email" className="text-teal-300 hover:text-teal-200">Email desk</Link>
                    <Link href="/reports" className="text-zinc-300 hover:text-white">Reports CSV/PDF</Link>
                    <Link href="/chat" className="text-zinc-300 hover:text-white">Chat</Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white">Top campaigns by spend</CardTitle>
                <CardDescription className="text-xs text-zinc-500">From DailyMetric in this window</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {campaigns.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">No campaign rows yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-zinc-500">
                      <tr>
                        <th className="pb-2 font-medium">Campaign</th>
                        <th className="pb-2 font-medium">Platform</th>
                        <th className="pb-2 font-medium">Spend</th>
                        <th className="pb-2 font-medium">Clicks</th>
                        <th className="pb-2 font-medium">Conv.</th>
                        <th className="pb-2 font-medium">Pixel ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr key={c.campaignId} className="border-t border-white/10">
                          <td className="py-2.5 text-white">{c.campaignName}</td>
                          <td className="py-2.5 capitalize text-zinc-400">{c.platform}</td>
                          <td className="py-2.5 tabular-nums text-zinc-200">{formatExact(c.totalSpend)}</td>
                          <td className="py-2.5 tabular-nums text-zinc-200">{c.totalClicks.toLocaleString("en-US")}</td>
                          <td className="py-2.5 tabular-nums text-zinc-200">{c.totalConversions.toLocaleString("en-US")}</td>
                          <td className="py-2.5 tabular-nums text-zinc-200">{c.roas.toFixed(2)}×</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  const notify = (message: string, description?: string) => {
    setToast({ message, description });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleExport = () => {
    notify("Export started…", "Analytics data will download as CSV.");
    window.setTimeout(() => {
      const csv =
        "Date,Platform,Impressions,Clicks,CTR,Conversions\n" +
        LINE_DATA.map(
          (item) =>
            `${item.name},Meta,${item.Impressions},${item.Clicks},${((item.Clicks / item.Impressions) * 100).toFixed(2)},${Math.floor(item.Clicks * 0.05)}`
        ).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-studio-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Export complete!", "The file has downloaded to your computer.");
    }, 1800);
  };

  const handleSendMessage = (preset?: string) => {
    const text = (preset ?? chatMessage).trim();
    if (!text) return;
    const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const userMessage: ChatMessage = { id: chatHistory.length + 1, type: "user", message: text, timestamp: now };
    setChatHistory((prev) => [...prev, userMessage]);
    setChatMessage("");
    setIsTyping(true);
    window.setTimeout(() => {
      const response: ChatMessage = {
        id: userMessage.id + 1,
        type: "ai",
        message: `Great question about "${text}"! 📊 Analyzing your cross-platform data… Meta leads ROAS at 4.2× with ${format(7400)} spend this month. I recommend reallocating 15% of TikTok budget to Meta Advantage+ — projected +${format(1900)} revenue next week. Want me to draft that reallocation plan?`,
        timestamp: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      };
      setChatHistory((prev) => [...prev, response]);
      setIsTyping(false);
    }, 1800);
  };

  const handleVoiceInput = () => {
    setIsListening(true);
    window.setTimeout(() => {
      setChatMessage("Which platform has the best ROAS?");
      setIsListening(false);
    }, 1500);
  };

  const handleExportChat = () => {
    const text = chatHistory.map((msg) => `${msg.type === "user" ? "You" : "Saki"}: ${msg.message}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saki-chat-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Chat exported!", "Conversation saved as a text file.");
  };

  const highPriorityCount = NOTIFICATIONS.filter((n) => n.priority === "high").length;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Demo workspace · sample StyleVault KPIs and Saki chat. Live BAGTOBAG Analytics Studio is DailyMetric plus five clocks.
      </div>
      {/* Inline toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-blue-500/30 bg-zinc-900/90 px-4 py-3 text-blue-300 shadow-2xl backdrop-blur-xl"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" /> {toast.message}
          </p>
          {toast.description && <p className="mt-1 text-xs text-zinc-400">{toast.description}</p>}
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Analytics Studio
          </h1>
          <p className="mt-1 text-lg text-zinc-400">AI-powered analytics & insights across every platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline" size="sm"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-xl border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            <Bell className="mr-2 h-4 w-4" /> Notifications
            <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 w-5 justify-center p-0 text-xs">
              {highPriorityCount}
            </Badge>
          </Button>
          <Button
            size="sm"
            onClick={() => setChatOpen(true)}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-400 hover:to-pink-400"
          >
            <MessageCircle className="mr-2 h-4 w-4" /> Ask Saki
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main column */}
        <div className="space-y-8">
          {/* Filters & actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:flex-row md:items-end md:justify-between"
          >
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="date-from" className="mb-1 block text-xs font-semibold text-zinc-400">From</label>
                <Input
                  id="date-from" type="date" value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40 border-white/10 bg-white/5 text-zinc-200"
                />
              </div>
              <div>
                <label htmlFor="date-to" className="mb-1 block text-xs font-semibold text-zinc-400">To</label>
                <Input
                  id="date-to" type="date" value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40 border-white/10 bg-white/5 text-zinc-200"
                />
              </div>
              <div>
                <label htmlFor="platform-select" className="mb-1 block text-xs font-semibold text-zinc-400">Platform</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform-select" className="w-44 border-white/10 bg-white/5 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-900/95 backdrop-blur-xl">
                    <SelectItem value="all">All platforms</SelectItem>
                    <SelectItem value="meta">Meta Ads</SelectItem>
                    <SelectItem value="google">Google Ads</SelectItem>
                    <SelectItem value="tiktok">TikTok Ads</SelectItem>
                    <SelectItem value="woocommerce">WooCommerce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" onClick={handleExport}
                className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button
                onClick={() => notify("Dashboard settings", "Widget layout editor is part of the full product.")}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:from-violet-400 hover:to-pink-400"
              >
                <Settings className="mr-2 h-4 w-4" /> Dashboard settings
              </Button>
            </div>
          </motion.div>

          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {KPIS.map((kpi, index) => (
              <KpiCard key={kpi.title} kpi={kpi} index={index} />
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <BarChart3 className="h-5 w-5 text-blue-400" /> Impressions & clicks
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Daily, last 7 days</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={LINE_DATA} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                      <Line type="monotone" dataKey="Impressions" stroke="#1877F2" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="Clicks" stroke="#10B981" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.26 }}>
              <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <BarChart3 className="h-5 w-5 text-violet-400" /> Conversions by platform
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">This week</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={BAR_DATA} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="platform" stroke="#71717a" fontSize={12} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="Conversions" radius={[8, 8, 0, 0]}>
                        {BAR_DATA.map((entry) => (
                          <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.32 }} className="lg:col-span-2 2xl:col-span-1">
              <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <PieChartIcon className="h-5 w-5 text-amber-400" /> Budget distribution
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Share of monthly spend</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={PIE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} label={({ name }) => name} labelLine={false}>
                        {PIE_DATA.map((entry) => (
                          <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* AI-powered filters */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.36 }}>
            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2 shadow-lg">
                  <Filter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI-powered filters by Saki</h2>
                  <p className="text-sm text-zinc-400">One-click smart segments generated from your data.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {AI_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <div key={filter.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
                      <div className={`w-fit rounded-xl bg-gradient-to-br ${filter.color} p-2 shadow-lg`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <p className="font-semibold text-white">{filter.title}</p>
                      <p className="text-xs text-zinc-400">{filter.description}</p>
                      <Badge variant="outline" className="w-fit border-white/15 bg-white/5 text-zinc-300">
                        Confidence: {filter.confidence}%
                      </Badge>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => notify("Filter applied", `${filter.title} · confidence ${filter.confidence}%`)}
                        className="mt-1 rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                      >
                        Apply filter
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Performance predictions */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.42 }}>
            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-white/5 to-blue-500/10 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 p-2 shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Performance predictions</h2>
                  <p className="text-sm text-zinc-400">ML forecast for the next 7 days.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {PREDICTIONS.map((prediction) => (
                  <div key={prediction.metric} className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-white">{prediction.metric}</span>
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        <TrendingUp className="mr-1 h-3 w-3" /> Rising
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">Current: <b className="text-zinc-200">{prediction.current.replaceAll("€", symbol)}</b></p>
                    <p className="text-xs text-emerald-300">Predicted: <b>{prediction.predicted.replaceAll("€", symbol)}</b></p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${prediction.confidence}%` }} />
                    </div>
                    <p className="text-xs text-zinc-500">Confidence {prediction.confidence}%</p>
                    <p className="text-xs text-zinc-500">{prediction.factors.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Custom AI widgets */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.48 }}>
            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-pink-500/10 via-white/5 to-amber-500/10 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-pink-500 to-amber-500 p-2 shadow-lg">
                  <PieChartIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Custom AI widgets</h2>
                  <p className="text-sm text-zinc-400">Drag-and-drop widgets for your personalized studio.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: BarChart3, title: "AI KPI Widget", description: "Customizable KPI with live AI insight", color: "text-blue-400" },
                  { icon: PieChartIcon, title: "AI Pie Widget", description: "AI-driven budget distribution view", color: "text-pink-400" },
                  { icon: Sparkles, title: "AI Alert Widget", description: "Automatic alerts surfaced by Saki", color: "text-amber-400" },
                  { icon: Lightbulb, title: "AI Idea Widget", description: "Fresh optimization ideas every morning", color: "text-violet-400" },
                ].map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <div key={widget.title} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition-all hover:bg-white/10">
                      <Icon className={`mb-1 h-8 w-8 ${widget.color}`} />
                      <p className="font-semibold text-white">{widget.title}</p>
                      <p className="text-xs text-zinc-400">{widget.description}</p>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => notify("Widget customization", `${widget.title} editor opens in the full product.`)}
                        className="mt-1 rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                      >
                        Customize
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Anomaly detection */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.54 }}>
            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-red-500/10 via-white/5 to-orange-500/10 p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-red-500 to-orange-500 p-2 shadow-lg">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Data anomaly detection</h2>
                  <p className="text-sm text-zinc-400">Statistical outliers flagged automatically, 24/7.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {ANOMALIES.map((anomaly) => {
                  const Icon = anomaly.icon;
                  return (
                    <div key={anomaly.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className={`w-fit rounded-xl bg-gradient-to-br ${anomaly.color} p-2 shadow-lg`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <p className="font-semibold capitalize text-white">
                        {anomaly.metric} {anomaly.type}
                      </p>
                      <p className="text-xs text-zinc-400">{anomaly.description}</p>
                      <p className="text-xs text-zinc-400">
                        Value: <b className="text-zinc-200">{anomaly.value.replaceAll("€", symbol)}</b>{" "}
                        <span className="text-zinc-500">(normal {anomaly.normal.replaceAll("€", symbol)})</span>
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          anomaly.severity === "high"
                            ? "w-fit border-red-500/30 bg-red-500/10 text-red-300"
                            : anomaly.severity === "medium"
                              ? "w-fit border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "w-fit border-white/15 bg-white/5 text-zinc-400"
                        }
                      >
                        Severity: {anomaly.severity}
                      </Badge>
                      <p className="text-xs text-zinc-500">{anomaly.timestamp}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* AI Insights sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
          className="space-y-6"
        >
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 p-2 shadow-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI Insights</h3>
                <p className="text-xs text-zinc-400">Recommendations & predictions</p>
              </div>
            </div>

            <div className="space-y-4">
              {AI_INSIGHTS.map((insight, index) => (
                <div key={insight.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-xl bg-gradient-to-br ${insight.color} p-2 shadow-lg`}>
                      <insight.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                        <Badge variant="outline" className={insight.impact === "high" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}>
                          {insight.impact} impact
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{insight.description}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Brain className="h-3 w-3" /> Confidence {insight.confidence}%
                      </p>
                    </div>
                  </div>

                  {expandedInsight === insight.id && (
                    <div className="mt-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-blue-200">
                        <Info className="h-3.5 w-3.5" /> Why does Saki recommend this?
                      </p>
                      <p className="mt-1 text-xs text-blue-200/80">
                        Saki analyzed {insight.confidence}% of your historical data and found patterns
                        matching similar high-performers. The recommendation uses machine learning
                        trained on cross-platform signals.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => notify("Recommendation applied", `${insight.title} is being applied to your campaigns.`)}
                      className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-xs text-white hover:from-emerald-400 hover:to-green-500"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" /> Apply
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => notify("Recommendation dismissed", `${insight.title} moved to review later.`)}
                      className="rounded-lg border-white/15 text-zinc-400 hover:bg-white/10"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                      className="rounded-lg text-zinc-400 hover:bg-white/10"
                      aria-label="More information"
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </div>
                  {index < AI_INSIGHTS.length - 1 && <div className="mt-4 h-px bg-white/5" />}
                </div>
              ))}
            </div>
          </Card>

          {/* Predictive analytics */}
          <Card className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-xl shadow-indigo-500/20">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold">Predictive Analytics</h4>
                <p className="text-xs text-indigo-100">Next week</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-indigo-100">Forecasted revenue</span>
                <span className="font-bold">{format(22500)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-100">Probability</span>
                <span className="font-bold">85%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-100">Upside case</span>
                <span className="font-bold">{format(26800)}</span>
              </div>
            </div>
            <Button
              size="sm" variant="secondary"
              onClick={() => notify("Loading detailed forecast", "Includes per-platform and audience breakdowns.")}
              className="mt-4 w-full rounded-xl bg-white/20 text-white hover:bg-white/30"
            >
              View details
            </Button>
          </Card>
        </motion.aside>
      </div>

      {/* Notifications dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-lg border-white/10 bg-zinc-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 p-2 shadow-lg">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-xl font-bold text-transparent">
                Smart Notifications
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {NOTIFICATIONS.map((notification) => {
              const Icon = notification.icon;
              const gradient =
                notification.type === "success" ? "from-emerald-500 to-green-600"
                : notification.type === "warning" ? "from-orange-500 to-amber-500"
                : notification.type === "error" || notification.type === "alert" ? "from-red-500 to-rose-600"
                : "from-blue-500 to-violet-500";
              return (
                <div key={notification.id} className={`flex items-center gap-4 rounded-2xl bg-gradient-to-r ${gradient} p-4 text-white shadow-lg`}>
                  <div className="shrink-0 rounded-xl bg-white/20 p-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{notification.title}</p>
                      {notification.priority === "high" && (
                        <Badge className="border-0 bg-white/25 text-xs text-white">High</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm opacity-90">{notification.message}</p>
                    <p className="mt-1 text-xs opacity-70">{notification.timestamp}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Saki AI chat dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="flex h-[85vh] max-w-3xl flex-col border-violet-500/20 bg-gradient-to-br from-zinc-900 to-violet-950/40 p-0 backdrop-blur-xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-violet-500/20 p-6 pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 p-2 shadow-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-white">Saki AI Assistant</div>
                <div className="text-xs text-zinc-400">Ready to help with your analytics 🚀</div>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm" onClick={handleExportChat}
                className="rounded-lg text-zinc-400 hover:bg-violet-500/10 hover:text-white"
                aria-label="Export chat"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="sm" onClick={() => setChatOpen(false)}
                className="rounded-lg text-zinc-400 hover:bg-violet-500/10 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-md items-start gap-3 ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`rounded-full p-2 shadow-lg ${msg.type === "user" ? "bg-blue-500" : "bg-gradient-to-br from-violet-500 to-pink-500"}`}>
                    {msg.type === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                  </div>
                  <div className={`rounded-2xl p-4 shadow-md ${msg.type === "user" ? "bg-blue-600 text-white" : "border border-violet-500/20 bg-white/5 text-zinc-100"}`}>
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p className={`mt-2 text-xs ${msg.type === "user" ? "text-blue-100" : "text-zinc-500"}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-2 shadow-lg">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="rounded-2xl border border-violet-500/20 bg-white/5 p-4 shadow-md">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "0.1s" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "0.2s" }} />
                      </div>
                      <span className="text-sm text-zinc-400">Saki is typing…</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {chatHistory.length <= 3 && (
              <div className="mt-2">
                <p className="mb-3 text-center text-sm text-zinc-500">💡 Try a quick question:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.id} size="sm" variant="outline"
                        onClick={() => handleSendMessage(action.text)}
                        className="h-auto rounded-xl border-violet-500/20 p-3 text-xs text-zinc-300 hover:bg-violet-500/10"
                      >
                        <Icon className="mr-1.5 h-3 w-3" /> {action.text}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-violet-500/20 bg-white/5 p-6 pt-4">
            <div className="flex gap-3">
              <Button
                size="sm" variant="outline" onClick={handleVoiceInput} disabled={isListening}
                className={`rounded-xl border-violet-500/20 ${isListening ? "animate-pulse bg-red-500/10" : "text-zinc-300 hover:bg-violet-500/10"}`}
                aria-label="Voice input"
              >
                <Mic className={`h-4 w-4 ${isListening ? "text-red-400" : "text-violet-400"}`} />
              </Button>
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask Saki about analytics, insights, or anything else…"
                disabled={isListening}
                className="flex-1 border-violet-500/20 bg-white/5 text-zinc-100 placeholder:text-zinc-500"
              />
              <Button
                size="sm" onClick={() => handleSendMessage()}
                disabled={isListening || !chatMessage.trim()}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg hover:from-violet-400 hover:to-pink-400"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {isListening && (
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-red-400">
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                🎤 Listening… speak now!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
