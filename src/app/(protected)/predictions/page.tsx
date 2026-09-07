"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
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
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  Gauge,
  Globe,
  Lightbulb,
  Rocket,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { WorkspaceEmptyState } from "@/components/ui/workspace-empty-state";
import { deriveInsights, type CampaignLike, type PlatformPerf } from "@/lib/dashboard-insights";
import { useCurrency } from "@/components/providers/currency";
import Link from "next/link";
import { DIAGNOSIS_LABEL, type FatiguePayload } from "@/lib/creative-fatigue";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";

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

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CampaignPrediction {
  id: string;
  campaign: string;
  platform: PlatformKey;
  title: string;
  description: string;
  prediction: string;
  recommendation: string;
  impact: "critical" | "high" | "medium" | "low";
  confidence: number;
  expectedImprovement: string;
  timeframe: string;
  estimatedRevenue: number;
  estimatedSavings: number;
  actionRequired: boolean;
}

interface PlatformPrediction {
  id: string;
  platform: PlatformKey;
  title: string;
  prediction: string;
  recommendation: string;
  marketInsight: string;
  confidence: number;
  impact: "critical" | "high" | "medium" | "low";
}

interface CreativeInsight {
  id: string;
  name: string;
  platform: PlatformKey;
  ctr: number;
  cpm: number;
  conversions: number;
  fatigueLevel: number;
  urgency: "critical" | "high" | "medium";
  prediction: string;
  recommendation: string;
  suggestedActions: string[];
}

interface AudienceInsight {
  id: string;
  name: string;
  platform: PlatformKey;
  size: number;
  potentialReach: number;
  expectedCPA: number;
  confidence: number;
  insight: string;
  recommendation: string;
}

interface ExpertRecommendation {
  id: string;
  category: "Strategic" | "Technical" | "Creative";
  title: string;
  insight: string;
  recommendation: string;
  expectedImpact: string;
  priority: "critical" | "high" | "medium";
  action: string;
}

interface MarketIntel {
  id: string;
  title: string;
  insight: string;
  recommendation: string;
  urgency: "high" | "medium";
}

// ---------------------------------------------------------------------------
// Demo data — inline, presentation only
// ---------------------------------------------------------------------------
const DEMO_CAMPAIGN_PREDICTIONS: CampaignPrediction[] = [
  {
    id: "cp-1",
    campaign: "Q4 Retargeting — Dynamic Product",
    platform: "Meta",
    title: "Retargeting frequency approaching fatigue threshold",
    description:
      "Your retargeting audience has seen the core creative 6.2 times on average over the last 14 days — beyond the 4.5x optimal band.",
    prediction:
      "CTR is projected to drop 18-24% within 7 days while CPM rises as Meta's delivery model discounts fatigued creatives.",
    recommendation:
      "Rotate in 3 fresh variants and move 20% of budget to a 30-day exclusion window before frequency crosses 7x.",
    impact: "critical",
    confidence: 91,
    expectedImprovement: "+22% CTR retention",
    timeframe: "Next 7 days",
    estimatedRevenue: 8400,
    estimatedSavings: 2100,
    actionRequired: true,
  },
  {
    id: "cp-2",
    campaign: "Search — Brand Defense",
    platform: "Google",
    title: "Auction pressure rising on branded terms",
    description:
      "Two competitors began bidding on your branded keywords this week, lifting average CPC by 14%.",
    prediction:
      "CPC inflation will continue for 10-14 days. Quality Score should absorb most of the increase if ad relevance stays above 8.",
    recommendation:
      "Increase branded bids by 10% to defend position 1.1-1.3 and add competitor-conquest negatives to stop leakage.",
    impact: "high",
    confidence: 87,
    expectedImprovement: "-31% wasted spend",
    timeframe: "Next 14 days",
    estimatedRevenue: 5200,
    estimatedSavings: 3600,
    actionRequired: true,
  },
  {
    id: "cp-3",
    campaign: "Spark Ads — Creator Collab",
    platform: "TikTok",
    title: "Scaling window opening for creator content",
    description:
      "The top creator video is outperforming account benchmarks on hook rate (38% vs 24% average).",
    prediction:
      "A 35-45% budget increase can be absorbed without CPA degradation for roughly 9 days before saturation begins.",
    recommendation:
      "Scale budget from €800 to €1,150/day in two steps (20% each, 48h apart) and hold creative constant.",
    impact: "high",
    confidence: 84,
    expectedImprovement: "+28% conversions",
    timeframe: "Next 9 days",
    estimatedRevenue: 11900,
    estimatedSavings: 0,
    actionRequired: true,
  },
  {
    id: "cp-4",
    campaign: "Shopping — Catalog Feed",
    platform: "Google",
    title: "Feed quality score drifting downward",
    description:
      "12% of products are missing GTINs and 4% have stale titles older than 90 days.",
    prediction:
      "Impression share on Shopping will erode 5-8 points as the feed loses the quality auction edge to complete listings.",
    recommendation:
      "Backfill missing GTINs and regenerate titles from the WooCommerce product attributes before the weekend traffic peak.",
    impact: "medium",
    confidence: 78,
    expectedImprovement: "+6% impression share",
    timeframe: "Next 21 days",
    estimatedRevenue: 3100,
    estimatedSavings: 900,
    actionRequired: false,
  },
];

const DEMO_PLATFORM_PREDICTIONS: PlatformPrediction[] = [
  {
    id: "pp-1",
    platform: "Meta",
    title: "Advantage+ audience rollout tightening",
    prediction:
      "Meta is progressively limiting manual interest targeting precision in favor of Andromeda-driven broad delivery for new ad sets.",
    recommendation:
      "Launch one broad-delivery test ad set per account now to build learning history before the enforcement window.",
    marketInsight:
      "Accounts with 60+ days of broad delivery history show 19% lower CPA during platform transitions.",
    confidence: 88,
    impact: "high",
  },
  {
    id: "pp-2",
    platform: "Google",
    title: "Performance Max asset scoring becomes decisive",
    prediction:
      "Asset strength ratings will directly gate budget distribution inside PMax campaigns as Google tightens automation controls.",
    recommendation:
      "Audit every PMax asset group — anything rated 'Poor' should be replaced before the next learning cycle resets.",
    marketInsight:
      "Advertisers who lifted all assets to 'Good' or better saw a 14% average cost-per-conversion improvement.",
    confidence: 82,
    impact: "high",
  },
  {
    id: "pp-3",
    platform: "TikTok",
    title: "Q4 CPM escalation begins earlier this year",
    prediction:
      "TikTok CPMs are trending +9% week-over-week — three weeks ahead of last year's seasonal ramp.",
    recommendation:
      "Front-load prospecting budget into the next 2 weeks and pre-negotiate seasonal inventory with your rep.",
    marketInsight:
      "Early movers locked 22% cheaper CPMs than advertisers who waited for the October rush.",
    confidence: 76,
    impact: "medium",
  },
  {
    id: "pp-4",
    platform: "WooCommerce",
    title: "First-party data integration edge",
    prediction:
      "WooCommerce stores syncing server-side purchase events are seeing materially better attribution fidelity as signal loss accelerates.",
    recommendation:
      "Connect the WooCommerce purchase pipeline to Conversions API with hashed customer identifiers.",
    marketInsight:
      "Stores with server-side events recover roughly 30% of conversions lost to browser tracking restrictions.",
    confidence: 85,
    impact: "medium",
  },
];

const DEMO_BUDGET_OPTIMIZATION = {
  currentBudget: 42000,
  recommendedBudget: 46500,
  totalExpectedLift: 23,
  confidence: 89,
  reallocation: [
    {
      platform: "Meta" as PlatformKey,
      currentSpend: 18000,
      recommendedSpend: 20400,
      expectedROAS: 4.6,
      reasoning:
        "Retargeting efficiency holding above 4.5x with room before frequency caps bind. Incremental spend routes to the winning DPA structure.",
    },
    {
      platform: "Google" as PlatformKey,
      currentSpend: 14000,
      recommendedSpend: 13300,
      expectedROAS: 3.9,
      reasoning:
        "Brand defense needs the extra 10% bid headroom, but Discovery prospecting is saturated — trim it to fund the search defense.",
    },
    {
      platform: "TikTok" as PlatformKey,
      currentSpend: 7000,
      recommendedSpend: 9800,
      expectedROAS: 3.4,
      reasoning:
        "Creator collab is in its prime scaling window with hook rates 58% above account average. Highest marginal return per euro.",
    },
    {
      platform: "WooCommerce" as PlatformKey,
      currentSpend: 3000,
      recommendedSpend: 3000,
      expectedROAS: 6.2,
      reasoning:
        "Owned-channel retargeting is maxed at current inventory volume. Growth requires catalog expansion, not budget.",
    },
  ],
};

const DEMO_CREATIVE_INSIGHTS: CreativeInsight[] = [
  {
    id: "ci-1",
    name: "UGC Testimonial — 30s vertical",
    platform: "Meta",
    ctr: 1.9,
    cpm: 6.4,
    conversions: 214,
    fatigueLevel: 78,
    urgency: "critical",
    prediction:
      "Hook rate declined from 3.4% to 1.9% over 3 weeks. The creative is 7-10 days from performance collapse.",
    recommendation: "Retire within 5 days and rotate in the two UGC variants currently in testing.",
    suggestedActions: [
      "Duplicate winning post-mortem structure into new hook",
      "Swap opening 3 seconds with kitchen-scene footage",
      "Reduce frequency cap to 2 impressions / 7 days",
    ],
  },
  {
    id: "ci-2",
    name: "Product Carousel — Lifestyle",
    platform: "TikTok",
    ctr: 2.8,
    cpm: 4.1,
    conversions: 176,
    fatigueLevel: 42,
    urgency: "high",
    prediction:
      "Card 2 has a 61% swipe-through drop. Reordering cards could lift completed views by roughly a third.",
    recommendation: "A/B test moving the demonstration card to position 1.",
    suggestedActions: [
      "Reorder cards by engagement-weighted rank",
      "Add price anchor overlay to card 1",
      "Test 15s sound-off captions variant",
    ],
  },
  {
    id: "ci-3",
    name: "Search RSA — Benefit-led",
    platform: "Google",
    ctr: 6.7,
    cpm: 11.2,
    conversions: 341,
    fatigueLevel: 22,
    urgency: "medium",
    prediction:
      "Ad strength is 'Excellent' but headline combination #3 is monopolizing 71% of auctions, hiding stronger variants.",
    recommendation: "Pin a second headline rotation and refresh the weakest description asset.",
    suggestedActions: [
      "Unpin headline 1 to allow combination testing",
      "Replace description 3 with urgency framing",
      "Add seasonal sitelink extension",
    ],
  },
];

const DEMO_AUDIENCE_INSIGHTS: AudienceInsight[] = [
  {
    id: "ai-1",
    name: "Lookalike 3% — Purchasers 180d",
    platform: "Meta",
    size: 420000,
    potentialReach: 1260000,
    expectedCPA: 14.2,
    confidence: 92,
    insight:
      "This cohort converts 2.3x better than broad targeting but has only absorbed 38% of its addressable reach.",
    recommendation: "Increase daily budget allocation from 22% to 30% of Meta spend.",
  },
  {
    id: "ai-2",
    name: "Cart Abandoners 14d",
    platform: "WooCommerce",
    size: 18600,
    potentialReach: 18600,
    expectedCPA: 6.8,
    confidence: 96,
    insight:
      "Highest-intent segment in the account — 41% add-to-cart recovery when reached within 24 hours.",
    recommendation: "Tighten the dynamic retargeting window from 14 to 7 days to concentrate frequency.",
  },
  {
    id: "ai-3",
    name: "Engaged Video Viewers 75%+",
    platform: "TikTok",
    size: 310000,
    potentialReach: 310000,
    expectedCPA: 11.5,
    confidence: 81,
    insight:
      "Warm viewers who completed 75% of creator content convert 1.8x better than cold Spark Ads traffic.",
    recommendation: "Build a retargeting ad set on this engagement signal before the Q4 CPM ramp.",
  },
  {
    id: "ai-4",
    name: "In-market: Home & Garden",
    platform: "Google",
    size: 2400000,
    potentialReach: 5800000,
    expectedCPA: 17.3,
    confidence: 74,
    insight:
      "Seasonal in-market surge detected — segment volume up 34% month-over-month with stable CPC.",
    recommendation: "Add as a dedicated observation audience on the prospecting campaign.",
  },
];

const DEMO_EXPERT_RECOMMENDATIONS: ExpertRecommendation[] = [
  {
    id: "er-1",
    category: "Strategic",
    title: "Consolidate the Q4 flight around two hero offers",
    insight:
      "Historical account data shows conversion rates spike 26% when message variety drops during high-CPM windows — focus beats breadth in Q4.",
    recommendation:
      "Cut the 5 secondary offers and concentrate spend on the two highest-margin hero products across all four platforms.",
    expectedImpact: "+26% conversion rate, -12% blended CPA",
    priority: "high",
    action: "Restructure campaigns before Nov 1",
  },
  {
    id: "er-2",
    category: "Technical",
    title: "Unify conversion tracking across all platforms",
    insight:
      "Meta, Google, and TikTok currently claim overlapping credit for 31% of purchases. Deduplicated signal would sharpen every downstream optimization.",
    recommendation:
      "Route all purchase events through the server-side pipeline keyed on hashed order IDs, then recalibrate platform attribution.",
    expectedImpact: "31% attribution overlap eliminated",
    priority: "critical",
    action: "Ship CAPI + server-side GTM this sprint",
  },
  {
    id: "er-3",
    category: "Creative",
    title: "Build a creative velocity engine before Q4",
    insight:
      "Top-quartile advertisers refresh creative every 9 days in Q4 versus your current 21-day cycle. Fatigue is the largest preventable CPA drag.",
    recommendation:
      "Stand up a 3-variant-per-week production cadence with modular hooks, bodies, and CTAs from the winning UGC library.",
    expectedImpact: "+19% sustained CTR through Q4",
    priority: "high",
    action: "Approve the creative sprint brief",
  },
];

const DEMO_MARKET_INTELLIGENCE: MarketIntel[] = [
  {
    id: "mi-1",
    title: "Category CPCs climbing ahead of schedule",
    insight:
      "Home & garden CPCs are up 11% month-over-month — the seasonal auction is heating up three weeks earlier than last year.",
    recommendation: "Lock in current rates by front-loading 60% of November budget into the first two weeks.",
    urgency: "high",
  },
  {
    id: "mi-2",
    title: "Competitor slashing Meta prospecting",
    insight:
      "Your closest competitor cut Meta prospecting frequency by half and pivoted to retargeting-only — a defensive posture that opens the prospecting auction.",
    recommendation: "Increase prospecting share by 15% while their presence is reduced.",
    urgency: "medium",
  },
  {
    id: "mi-3",
    title: "TikTok shopping tab gaining traction in your vertical",
    insight:
      "Product discovery sessions in your category are up 47% quarter-over-quarter on TikTok Shop surfaces.",
    recommendation: "Test a catalog-synced Spark Ads variant targeting the shopping tab placement.",
    urgency: "medium",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const IMPACT_STYLES: Record<string, { badge: string; dot: string; icon: typeof Zap; iconColor: string }> = {
  critical: {
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
    dot: "bg-red-400",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
  high: {
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    dot: "bg-orange-400",
    icon: Zap,
    iconColor: "text-orange-400",
  },
  medium: {
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
    icon: Clock,
    iconColor: "text-yellow-400",
  },
  low: {
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    icon: CheckCircle,
    iconColor: "text-blue-400",
  },
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Real-data forecasting (client-side, from marketing.getPredictionBasis)
// ---------------------------------------------------------------------------

/** A single point on the historical + projected trend chart. */
interface ForecastChartPoint {
  date: string;
  spend?: number;
  revenue?: number;
  spendMA?: number;
  revenueMA?: number;
  projSpend?: number;
  projRevenue?: number;
}

interface ForecastResult {
  dataPoints: number;
  confidence: number;
  points: ForecastChartPoint[];
  projSpend7: number;
  projSpend30: number;
  projRevenue7: number;
  projRevenue30: number;
  projRoas7: number;
  projRoas30: number;
}

/** Trailing moving average with a partial window at the start of the series. */
function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

/** Drop trailing days with no spend and no conversion value. */
function trimTrailingEmpty(
  days: Array<{ date: string; spend: number; conversionValue: number }>,
) {
  let end = days.length;
  while (end > 0 && days[end - 1].spend <= 0 && days[end - 1].conversionValue <= 0) {
    end -= 1;
  }
  return days.slice(0, end);
}

const emptyForecast = (): ForecastResult => ({
  dataPoints: 0,
  confidence: 0,
  points: [],
  projSpend7: 0,
  projSpend30: 0,
  projRevenue7: 0,
  projRevenue30: 0,
  projRoas7: 0,
  projRoas30: 0,
});

/**
 * Forecast from sparse DailyMetric days.
 * KPIs use a 30-calendar-day run rate (total / 30) so empty days and OLS
 * collapse-to-zero do not invent 0x or 50x ROAS.
 */
function buildForecast(daysInput: Array<{ date: string; spend: number; conversionValue: number }>): ForecastResult {
  const days = trimTrailingEmpty(daysInput);
  const n = days.length;
  if (n === 0) return emptyForecast();

  const spends = days.map((d) => d.spend);
  const revenues = days.map((d) => d.conversionValue);
  const spendMA = movingAverage(spends);
  const revenueMA = movingAverage(revenues);

  const lastDate = new Date(`${days[n - 1].date}T00:00:00.000Z`);
  // Same inclusive window as DateRangePicker 30d / isoDaysAgo(30) → today.
  const windowStart = new Date(lastDate.getTime() - 30 * 86_400_000);
  const last30 = days.filter((d) => new Date(`${d.date}T00:00:00.000Z`) >= windowStart);
  const spend30 = last30.reduce((a, d) => a + d.spend, 0);
  const revenue30 = last30.reduce((a, d) => a + d.conversionValue, 0);
  const spendRun = spend30 / 30;
  const revenueRun = revenue30 / 30;
  const roas = spend30 > 0 ? revenue30 / spend30 : 0;

  const points: ForecastChartPoint[] = days.map((d, i) => ({
    date: d.date.slice(5),
    spend: d.spend,
    revenue: d.conversionValue,
    spendMA: spendMA[i],
    revenueMA: revenueMA[i],
  }));

  const lastPoint = points[points.length - 1];
  lastPoint.projSpend = lastPoint.spend;
  lastPoint.projRevenue = lastPoint.revenue;

  for (let i = 1; i <= 30; i++) {
    const date = new Date(lastDate.getTime() + i * 86_400_000);
    points.push({
      date: date.toISOString().slice(5, 10),
      projSpend: spendRun,
      projRevenue: revenueRun,
    });
  }

  return {
    dataPoints: n,
    confidence: Math.min(95, Math.round((n / 90) * 100)),
    points,
    projSpend7: spendRun * 7,
    projSpend30: spendRun * 30,
    projRevenue7: revenueRun * 7,
    projRevenue30: revenueRun * 30,
    projRoas7: roas,
    projRoas30: roas,
  };
}

type LiveCampaignRow = {
  campaignId?: string;
  campaignName?: string;
  platform?: string;
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  totalConversions?: number;
  totalConversionValue?: number;
  roas?: number;
};

function LiveCampaignOutlook({ rows }: { rows: LiveCampaignRow[] }) {
  const { format: formatEuro, currency } = useCurrency();
  const campaigns: Array<CampaignLike & { id: string }> = rows.map((r, index) => ({
    id: r.campaignId || `${r.platform ?? "meta"}:${r.campaignName ?? "campaign"}:${index}`,
    name: r.campaignName ?? "Campaign",
    platform: r.platform ?? "Meta",
    spend: Number(r.totalSpend ?? 0),
    revenue: Number(r.totalConversionValue ?? 0),
    roas: Number(r.roas ?? 0),
    clicks: Number(r.totalClicks ?? 0),
    impressions: Number(r.totalImpressions ?? 0),
  }));
  const byPlatform = new Map<string, PlatformPerf>();
  for (const c of campaigns) {
    const key = c.platform || "Other";
    const cur = byPlatform.get(key) ?? { name: key, spend: 0, revenue: 0, roas: 0 };
    cur.spend += c.spend;
    cur.revenue += c.revenue;
    byPlatform.set(key, cur);
  }
  const platforms = [...byPlatform.values()].map((p) => ({
    ...p,
    roas: p.spend > 0 ? p.revenue / p.spend : 0,
  }));
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const clicks = campaigns.reduce((a, c) => a + (c.clicks ?? 0), 0);
  const impressions = campaigns.reduce((a, c) => a + (c.impressions ?? 0), 0);
  const conversions = rows.reduce((a, r) => a + Number(r.totalConversions ?? 0), 0);
  const insights = deriveInsights(platforms, campaigns, {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    conversions,
    spend,
  }, currency);
  const ranked = [...campaigns].sort((a, b) => b.roas - a.roas).slice(0, 5);

  if (campaigns.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={cn(GLASS, "p-6")}>
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <h3 className="font-semibold text-white">What to do next</h3>
        </div>
        <p className="mb-4 text-xs text-white/40">
          Grounded in synced campaign pixel ROAS — not the Demo prediction deck.
        </p>
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <Link
                  href={insight.href}
                  className="text-[11px] font-semibold text-violet-300 hover:text-violet-200"
                >
                  {insight.actionLabel}
                </Link>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{insight.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={cn(GLASS, "p-6")}>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-400" />
          <h3 className="font-semibold text-white">Campaign outlook</h3>
        </div>
        <div className="space-y-2">
          {ranked.map((c) => (
            <div
              key={`${c.platform}-${c.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{c.name}</p>
                <p className="text-[11px] text-white/40">
                  {c.platform} · {formatEuro(c.spend)} spend
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-400">
                {c.roas.toFixed(2)}x pixel
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveCreativeOutlook({ payload }: { payload?: FatiguePayload }) {
  const { format } = useCurrency();
  if (!payload?.ads.length || !payload.health) return null;
  const fails = payload.health.checks.filter((c) => c.status === "fail" || c.status === "warn").slice(0, 4);
  const ads = payload.ads.slice(0, 5);
  return (
    <div className={cn(GLASS, "p-6")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="font-semibold text-white">Creative outlook · 30d</h3>
        </div>
        <Link href="/creative-fatigue" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">
          Open Creative Fatigue
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 font-semibold text-white">
          Health {payload.health.grade} · {payload.health.score}/100
        </span>
        <span>Proj. 7d CTR {payload.kpis.projectedCtr7d == null ? "—" : `${payload.kpis.projectedCtr7d.toFixed(2)}%`}</span>
        <span>CPA watch {format(payload.kpis.cpaWatchSpend)}</span>
      </div>
      {fails.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {fails.map((c) => (
            <li key={c.id} className="text-[12px] text-zinc-400">
              <span className={c.status === "fail" ? "text-rose-300" : "text-amber-300"}>{c.title}:</span> {c.detail}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {ads.map((ad) => (
          <Link
            key={ad.adId}
            href={`/creative-fatigue?ad=${encodeURIComponent(ad.adId)}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:border-white/20"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{ad.creativeTitle || ad.adName}</p>
              <p className="text-[11px] text-white/40">
                {DIAGNOSIS_LABEL[ad.diagnosis]} · {format(ad.spend)} · CPA {ad.cpaChangePct >= 0 ? "+" : ""}
                {ad.cpaChangePct.toFixed(0)}%
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-zinc-300">
              {ad.projectedCtr7d == null ? `${ad.ctr.toFixed(2)}% CTR` : `Proj. ${ad.projectedCtr7d.toFixed(2)}%`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PredictionsPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { format: formatEuro, formatExact, formatAxis, symbol, currency } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  const [isGenerating, setIsGenerating] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [implemented, setImplemented] = useState<Set<string>>(new Set());

  // Simulated AI generation pass — all data is inline demo data.
  useEffect(() => {
    const t = setTimeout(() => {
      setIsGenerating(false);
      setRevealed(true);
      setLastUpdated(new Date());
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  const revenueByPrediction = useMemo(
    () =>
      DEMO_CAMPAIGN_PREDICTIONS.map((p) => ({
        name: p.platform,
        revenue: p.estimatedRevenue,
        color: PLATFORMS[p.platform].color,
      })),
    [],
  );

  const budgetChartData = useMemo(
    () =>
      DEMO_BUDGET_OPTIMIZATION.reallocation.map((r) => ({
        name: PLATFORMS[r.platform].label,
        current: r.currentSpend,
        recommended: r.recommendedSpend,
      })),
    [],
  );

  const allocationPie = useMemo(
    () =>
      DEMO_BUDGET_OPTIMIZATION.reallocation.map((r) => ({
        name: PLATFORMS[r.platform].label,
        value: r.recommendedSpend,
        color: PLATFORMS[r.platform].color,
      })),
    [],
  );

  // -------------------------------------------------------------------------
  // Real organizations: forecast computed client-side from the last 90 days
  // of synced daily metrics. Hooks called unconditionally (hooks-first) and
  // gated via `enabled`.
  // -------------------------------------------------------------------------
  const basisRange = useIsoDateRange(90);
  const datesValid = basisRange.startDate !== "";
  const fatigueRange = useIsoDateRange(30);

  const basisQuery = api.marketing.getPredictionBasis.useQuery(
    { ...basisRange, ...shopQuery },
    {
      enabled: !isLoading && !isDemo && datesValid && shopReady,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const liveCampaignsQuery = api.marketing.getCampaignPerformance.useQuery(
    { limit: 20, ...shopQuery },
    { enabled: !isLoading && !isDemo && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const fatigueQuery = api.marketing.getCreativeFatigue.useQuery(
    { ...fatigueRange, ...shopQuery },
    {
      enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    {
      startDate: fatigueRange.startDate,
      endDate: fatigueRange.endDate,
      ...shopQuery,
    },
    { enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    {
      startDate: fatigueRange.startDate,
      endDate: fatigueRange.endDate,
      ...shopQuery,
    },
    { enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    {
      startDate: fatigueRange.startDate,
      endDate: fatigueRange.endDate,
      ...shopQuery,
    },
    { enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    {
      startDate: fatigueRange.startDate,
      endDate: fatigueRange.endDate,
      platform: "all",
      ...shopQuery,
    },
    { enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(
    brandId ? { brandId } : {},
    { enabled: !isLoading && !isDemo && shopReady, retry: false, refetchOnWindowFocus: false },
  );
  const liveAccountsQuery = api.marketing.getAccountSummary.useQuery(
    {
      startDate: fatigueRange.startDate,
      endDate: fatigueRange.endDate,
      ...shopQuery,
    },
    { enabled: !isLoading && !isDemo && fatigueRange.startDate !== "" && shopReady, retry: false, refetchOnWindowFocus: false },
  );

  const basisData = basisQuery.data;
  const forecast = useMemo(
    () => (basisData && basisData.length > 0 ? buildForecast(basisData) : null),
    [basisData],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    const mer = merQuery.data?.data;
    const liveAccounts = liveAccountsQuery.data?.data?.accounts ?? [];
    const { clocks, blockers } = buildOperatorDesk({
      mer,
      ga4: ga4Mix.data?.data,
      gsc: gscQuery.data,
      email: emailMetrics.data?.data,
      googleAdsConnected: mergeConnectedPaidPlatforms(
        (syncStatus.data?.platforms ?? []).map((p) => p.platform),
        liveAccounts.map((a) => a.platform),
      ).includes("google"),
      googleAdsSpend: sumAccountSpendForPlatform(liveAccounts, "google"),
      currency,
    });
    const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailMetrics);
    const forecastKpis = forecast
      ? [
          { label: "Projected Spend · 7d", value: formatEuro(Math.round(forecast.projSpend7)), icon: DollarSign, iconColor: "text-violet-400", accent: "from-violet-500/20 to-blue-500/20" },
          { label: "Projected pixel value · 7d", value: formatEuro(Math.round(forecast.projRevenue7)), icon: TrendingUp, iconColor: "text-emerald-400", accent: "from-emerald-500/20 to-green-500/20" },
          { label: "Projected pixel ROAS · 7d", value: `${forecast.projRoas7.toFixed(2)}x`, icon: Target, iconColor: "text-blue-400", accent: "from-blue-500/20 to-cyan-500/20" },
          { label: "Projected Spend · 30d", value: formatEuro(Math.round(forecast.projSpend30)), icon: DollarSign, iconColor: "text-violet-400", accent: "from-violet-500/20 to-blue-500/20" },
          { label: "Projected pixel value · 30d", value: formatEuro(Math.round(forecast.projRevenue30)), icon: TrendingUp, iconColor: "text-emerald-400", accent: "from-emerald-500/20 to-green-500/20" },
          { label: "Projected pixel ROAS · 30d", value: `${forecast.projRoas30.toFixed(2)}x`, icon: Target, iconColor: "text-blue-400", accent: "from-blue-500/20 to-cyan-500/20" },
        ]
      : [];

    return (
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span className="text-xs font-semibold text-violet-300">Pixel run-rate outlook</span>
            </div>
            <h1 className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              AI Predictions
            </h1>
            <p className="text-sm text-zinc-400">
              Last 30 days of synced spend and pixel conversion value, extended as a daily run rate — not till, not GA4, not Brevo delivered, not a fitted model
              {basisRange ? ` (${basisRange.startDate} → ${basisRange.endDate})` : ""}
            </p>
            <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
          </div>
          {forecast && (
            <div className={cn(GLASS, "flex w-fit items-center gap-3 px-4 py-2.5")}>
              <Gauge className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">History</span>
              <span className="text-sm font-bold text-white">{forecast.dataPoints}/90 days</span>
            </div>
          )}
        </div>

        <FiveClockStrip
          clocks={clocks}
          caption="Last 30 days. Run-rate below is pixel conversion value only — not till, not GA4, not Brevo delivered."
          ready={deskReady}
        />
        <OperatorBlockerBoard blockers={blockers} ready={deskReady} />

        {(!shopReady || basisQuery.isLoading) ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400" />
          </div>
        ) : basisQuery.isError ? (
          <div className={cn(GLASS, "p-10 text-center")}>
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
            <p className="mt-3 font-semibold text-white">Failed to load prediction basis</p>
            <p className="mt-1 text-sm text-zinc-400">Please try again later.</p>
          </div>
        ) : !basisQuery.isEnabled || (basisQuery.isPending && basisQuery.fetchStatus === "idle") ? (
          // Query disabled (no active organization resolved) — nothing to forecast.
          <WorkspaceEmptyState pageName="AI predictions" />
        ) : !forecast || forecast.dataPoints < 5 ? (
          <div className={cn(GLASS, "p-10 text-center")}>
            <Brain className="mx-auto h-8 w-8 text-violet-400" />
            <p className="mt-3 font-semibold text-white">Not enough history yet — sync more days</p>
            <p className="mt-1 text-sm text-zinc-400">
              At least 5 days of synced performance data is needed to build a forecast.
            </p>
          </div>
        ) : (
          <>
            {/* Forecast KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {forecastKpis.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.5 }}
                  className={cn(GLASS, "relative overflow-hidden p-6")}
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", stat.accent)} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{stat.label}</p>
                      <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Historical trend + dashed projection */}
            <div className={cn(GLASS, "p-6")}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                  <h3 className="font-semibold text-white">Spend &amp; pixel value — 90d history + 30d run-rate</h3>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-violet-400" /> Spend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Pixel value
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-violet-300" /> Projected spend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-300" /> Projected pixel value
                  </span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#71717a"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.ceil(forecast.points.length / 12)}
                    />
                    <YAxis
                      stroke="#71717a"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatAxis(v)}
                    />
                    <Tooltip
                      contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                      formatter={(value: number, key: string) => {
                        const labels: Record<string, string> = {
                          spend: "Spend",
                          spendMA: "Spend (7-day avg)",
                          revenue: "Pixel value",
                          revenueMA: "Pixel value (7-day avg)",
                          projSpend: "Projected spend",
                          projRevenue: "Projected pixel value",
                        };
                        return [formatEuro(Math.round(value)), labels[key] ?? key];
                      }}
                    />
                    <Line type="monotone" dataKey="spend" stroke="#a78bfa" strokeWidth={1.25} strokeOpacity={0.45} dot={false} />
                    <Line type="monotone" dataKey="spendMA" stroke="#a78bfa" strokeWidth={2.25} dot={false} name="Spend (7-day avg)" />
                    <Line type="monotone" dataKey="revenueMA" stroke="#34d399" strokeWidth={2.25} dot={false} name="Pixel value (7-day avg)" />
                    <Line type="monotone" dataKey="projSpend" stroke="#c4b5fd" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="projRevenue" stroke="#6ee7b7" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Projections use the last 30 calendar days of synced spend and pixel conversion value as a daily run rate
                (not a fitted model). History is {forecast.dataPoints}/90 synced days — that is coverage, not accuracy.
              </p>
            </div>

            <LiveCampaignOutlook
              rows={liveCampaignsQuery.data?.data?.campaigns ?? []}
            />
            <LiveCreativeOutlook payload={fatigueQuery.data} />
          </>
        )}
      </div>
    );
  }

  const refreshPredictions = () => {
    setIsGenerating(true);
    setRevealed(false);
    setImplemented(new Set());
    setTimeout(() => {
      setIsGenerating(false);
      setRevealed(true);
      setLastUpdated(new Date());
    }, 1800);
  };

  const toggleImplemented = (id: string) => {
    setImplemented((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalActive =
    DEMO_CAMPAIGN_PREDICTIONS.length + DEMO_PLATFORM_PREDICTIONS.length + DEMO_EXPERT_RECOMMENDATIONS.length;
  const criticalCount = DEMO_CAMPAIGN_PREDICTIONS.filter((p) => p.impact === "critical").length;
  const potentialRevenue = DEMO_CAMPAIGN_PREDICTIONS.reduce((s, p) => s + p.estimatedRevenue, 0);
  const avgConfidence = Math.round(
    DEMO_CAMPAIGN_PREDICTIONS.reduce((s, p) => s + p.confidence, 0) / DEMO_CAMPAIGN_PREDICTIONS.length,
  );

  const stats = [
    { label: "Active Predictions", value: String(totalActive), icon: Brain, accent: "from-violet-500/20 to-blue-500/20", iconColor: "text-violet-400" },
    { label: "Critical Actions", value: String(criticalCount), icon: AlertTriangle, accent: "from-red-500/20 to-orange-500/20", iconColor: "text-red-400" },
    { label: "Potential Revenue", value: formatEuro(potentialRevenue), icon: DollarSign, accent: "from-emerald-500/20 to-green-500/20", iconColor: "text-emerald-400" },
    { label: "AI Confidence", value: `${avgConfidence}%`, icon: Gauge, accent: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Demo workspace · +22% CTR retention and budget-AI theater. Live BAGTOBAG Predictions is pixel run-rate only.
      </div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-xs font-semibold text-violet-300">Predictive Intelligence Engine</span>
          </div>
          <h1 className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            AI Predictions &amp; Expert Insights
          </h1>
          <p className="text-sm text-zinc-400">
            Forecasts and recommendations modeled on 15+ years of media buying patterns
            {isGenerating ? "" : ` — updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
            . Demo theater only — not BAGTOBAG pixel run-rate.
          </p>
        </div>
        <Button
          onClick={refreshPredictions}
          disabled={isGenerating}
          className="bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
        >
          {isGenerating ? (
            <>
              <Gauge className="mr-2 h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Refresh Predictions
            </>
          )}
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08 * i, duration: 0.5 }}
            className={cn(GLASS, "relative overflow-hidden p-6")}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", stat.accent)} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 md:grid-cols-5">
          {[
            { value: "campaigns", label: "Campaigns" },
            { value: "platforms", label: "Platforms" },
            { value: "budget", label: "Budget AI" },
            { value: "creative", label: "Creatives" },
            { value: "expert", label: "Expert AI" },
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

        {/* Campaign predictions */}
        <TabsContent value="campaigns" className="space-y-6">
          {/* Revenue impact chart */}
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold text-white">Projected Revenue by Prediction</h3>
              </div>
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                {formatEuro(potentialRevenue)} total
              </Badge>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPrediction}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatAxis(v)} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                    formatter={(value: number) => [formatEuro(value), "Projected revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {revenueByPrediction.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            {DEMO_CAMPAIGN_PREDICTIONS.map((prediction, index) => {
              const style = IMPACT_STYLES[prediction.impact];
              const ImpactIcon = style.icon;
              const isDone = implemented.has(prediction.id);
              return (
                <motion.div
                  key={prediction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={revealed ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.06 * index, duration: 0.5 }}
                  className={cn(GLASS, "p-6")}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <ImpactIcon className={cn("h-4 w-4", style.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{prediction.title}</h3>
                        <Badge className={cn("border", style.badge)}>{prediction.impact.toUpperCase()}</Badge>
                        {prediction.actionRequired && !isDone && (
                          <Badge className="border-red-500/40 bg-red-500/20 text-red-300">ACTION REQUIRED</Badge>
                        )}
                        {isDone && (
                          <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                            <CheckCircle className="mr-1 h-3 w-3" /> IMPLEMENTED
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="ml-auto border-white/10 bg-white/5 text-zinc-300"
                        >
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: PLATFORMS[prediction.platform].color }}
                          />
                          {prediction.campaign}
                        </Badge>
                      </div>

                      <p className="text-sm text-zinc-400">{prediction.description}</p>

                      <div className="space-y-2">
                        <div className="rounded-xl border-l-2 border-violet-500 bg-violet-500/10 p-3">
                          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
                            AI Prediction
                          </div>
                          <p className="text-sm text-zinc-200">{prediction.prediction}</p>
                        </div>
                        <div className="rounded-xl border-l-2 border-emerald-500 bg-emerald-500/10 p-3">
                          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                            Expert Recommendation
                          </div>
                          <p className="text-sm text-zinc-200">{prediction.recommendation.replaceAll("€", symbol)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-zinc-500">Confidence</div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <ConfidenceBar value={prediction.confidence} />
                            <span className="font-semibold text-white">{prediction.confidence}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Expected Impact</div>
                          <div className="mt-1 font-semibold text-emerald-400">{prediction.expectedImprovement}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Timeframe</div>
                          <div className="mt-1 font-semibold text-white">{prediction.timeframe}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                        <Button
                          size="sm"
                          onClick={() => toggleImplemented(prediction.id)}
                          className={
                            isDone
                              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              : "bg-emerald-600 text-white hover:bg-emerald-500"
                          }
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          {isDone ? "Implemented" : "Implement Now"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                        >
                          Dismiss
                        </Button>
                        {prediction.estimatedRevenue > 0 && (
                          <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                            +{formatEuro(prediction.estimatedRevenue)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Platform predictions */}
        <TabsContent value="platforms" className="space-y-4">
          {DEMO_PLATFORM_PREDICTIONS.map((prediction, index) => {
            const platform = PLATFORMS[prediction.platform];
            const style = IMPACT_STYLES[prediction.impact];
            return (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={revealed ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.06 * index, duration: 0.5 }}
                className={cn(GLASS, "p-6")}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: `${platform.color}33`, border: `1px solid ${platform.color}66` }}
                  >
                    {platform.label.slice(0, 2)}
                  </div>
                  <h3 className="font-semibold text-white">{prediction.title}</h3>
                  <Badge className={cn("border", style.badge)}>{prediction.impact.toUpperCase()}</Badge>
                  <Badge className="ml-auto border-white/10 bg-white/5 text-zinc-300">
                    Confidence {prediction.confidence}%
                  </Badge>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border-l-2 border-yellow-500 bg-yellow-500/10 p-3">
                    <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-yellow-300">
                      Market Intelligence
                    </div>
                    <p className="text-sm text-zinc-200">{prediction.prediction}</p>
                  </div>
                  <div className="rounded-xl border-l-2 border-blue-500 bg-blue-500/10 p-3">
                    <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-300">
                      Strategic Recommendation
                    </div>
                    <p className="text-sm text-zinc-200">{prediction.recommendation.replaceAll("€", symbol)}</p>
                  </div>
                  <div className="rounded-xl border-l-2 border-purple-500 bg-purple-500/10 p-3">
                    <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-purple-300">
                      Expert Insight
                    </div>
                    <p className="text-sm text-zinc-200">{prediction.marketInsight}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* Budget optimization */}
        <TabsContent value="budget" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className={cn(GLASS, "p-6")}>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Current Budget</p>
              <p className="mt-2 text-3xl font-bold text-white">{formatEuro(DEMO_BUDGET_OPTIMIZATION.currentBudget)}</p>
              <p className="mt-1 text-xs text-zinc-500">Monthly, across all platforms</p>
            </div>
            <div className={cn(GLASS, "relative overflow-hidden p-6")}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-green-500/5" />
              <div className="relative">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Recommended Budget</p>
                <p className="mt-2 text-3xl font-bold text-emerald-300">
                  {formatEuro(DEMO_BUDGET_OPTIMIZATION.recommendedBudget)}
                </p>
                <p className="mt-1 text-xs text-emerald-400">
                  +{DEMO_BUDGET_OPTIMIZATION.totalExpectedLift}% expected performance lift
                </p>
              </div>
            </div>
          </div>

          {/* Current vs recommended chart */}
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Smart Budget Reallocation</h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-white/25" /> Current
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Recommended
                </span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatAxis(v)} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                    formatter={(value: number, key: string) => [formatEuro(value), key === "current" ? "Current" : "Recommended"]}
                  />
                  <Bar dataKey="current" fill="rgba(255,255,255,0.25)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="recommended" fill="#34d399" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reallocation details */}
          <div className="grid gap-4 md:grid-cols-2">
            {DEMO_BUDGET_OPTIMIZATION.reallocation.map((r) => {
              const delta = Math.round(((r.recommendedSpend - r.currentSpend) / r.currentSpend) * 100);
              return (
                <div key={r.platform} className={cn(GLASS, "p-6")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: PLATFORMS[r.platform].color }}
                      />
                      <h4 className="font-semibold text-white">{PLATFORMS[r.platform].label}</h4>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                      Expected ROAS: {r.expectedROAS}x
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Current</span>
                      <span className="font-semibold text-white">{formatEuro(r.currentSpend)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Recommended</span>
                      <span className="font-semibold text-emerald-300">
                        {formatEuro(r.recommendedSpend)}
                        <span className={cn("ml-2 text-xs", delta >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {delta >= 0 ? "+" : ""}
                          {delta}%
                        </span>
                      </span>
                    </div>
                    <p className="pt-2 text-xs leading-relaxed text-zinc-400">
                      <span className="font-semibold text-zinc-300">Reasoning: </span>
                      {r.reasoning}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cn(GLASS, "flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between")}>
            <div>
              <div className="font-semibold text-white">AI Confidence Level</div>
              <p className="text-sm text-zinc-400">Based on historical performance and market trends</p>
            </div>
            <div className="flex items-center gap-3">
              <ConfidenceBar value={DEMO_BUDGET_OPTIMIZATION.confidence} />
              <span className="font-bold text-white">{DEMO_BUDGET_OPTIMIZATION.confidence}%</span>
            </div>
          </div>
        </TabsContent>

        {/* Creative insights */}
        <TabsContent value="creative" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Creative performance */}
            <Card className={cn(GLASS, "border-white/10 bg-white/5 p-0")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Eye className="h-5 w-5 text-violet-400" />
                  Creative Performance AI
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Creative fatigue analysis and optimization opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {DEMO_CREATIVE_INSIGHTS.map((insight) => {
                  const urgencyStyle =
                    insight.urgency === "critical"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : insight.urgency === "high"
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
                  return (
                    <div key={insight.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PLATFORMS[insight.platform].color }}
                          />
                          <h4 className="font-medium text-white">{insight.name}</h4>
                        </div>
                        <Badge className={cn("border", urgencyStyle)}>{insight.urgency.toUpperCase()}</Badge>
                      </div>

                      <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-zinc-500">CTR</div>
                          <div className="font-semibold text-white">{insight.ctr}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">CPM</div>
                          <div className="font-semibold text-white">{formatExact(insight.cpm)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Conversions</div>
                          <div className="font-semibold text-white">{insight.conversions}</div>
                        </div>
                      </div>

                      {/* Fatigue meter */}
                      <div className="mb-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-zinc-500">Fatigue level</span>
                          <span className={cn("font-semibold", insight.fatigueLevel > 60 ? "text-red-400" : "text-zinc-300")}>
                            {insight.fatigueLevel}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              insight.fatigueLevel > 60
                                ? "bg-gradient-to-r from-red-500 to-orange-400"
                                : "bg-gradient-to-r from-emerald-500 to-teal-400",
                            )}
                            style={{ width: `${insight.fatigueLevel}%` }}
                          />
                        </div>
                      </div>

                      <p className="mb-1.5 text-sm text-zinc-300">{insight.prediction}</p>
                      <p className="mb-3 text-sm font-medium text-emerald-400">{insight.recommendation.replaceAll("€", symbol)}</p>
                      <div>
                        <div className="mb-1 text-xs text-zinc-500">Suggested actions:</div>
                        {insight.suggestedActions.map((action) => (
                          <div key={action} className="flex items-start gap-1.5 text-xs text-zinc-400">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Audience insights */}
            <div className="space-y-6">
              <Card className={cn(GLASS, "border-white/10 bg-white/5 p-0")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Users className="h-5 w-5 text-cyan-400" />
                    Audience Intelligence
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    AI-driven audience opportunities and expansion insights
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {DEMO_AUDIENCE_INSIGHTS.map((insight) => (
                    <div key={insight.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PLATFORMS[insight.platform].color }}
                          />
                          <h4 className="font-medium text-white">{insight.name}</h4>
                        </div>
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                          {insight.confidence}% confidence
                        </Badge>
                      </div>
                      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-zinc-500">Current size</div>
                          <div className="font-semibold text-white">{insight.size.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Potential reach</div>
                          <div className="font-semibold text-cyan-300">{insight.potentialReach.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Expected CPA</div>
                          <div className="font-semibold text-white">{formatExact(insight.expectedCPA)}</div>
                        </div>
                      </div>
                      <p className="mb-1.5 text-sm text-zinc-300">{insight.insight}</p>
                      <p className="text-sm font-medium text-blue-400">{insight.recommendation.replaceAll("€", symbol)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Allocation donut */}
              <div className={cn(GLASS, "p-6")}>
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-5 w-5 text-fuchsia-400" />
                  <h3 className="font-semibold text-white">Recommended Spend Mix</h3>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {allocationPie.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                        formatter={(value: number, name: string) => [formatEuro(value), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Expert AI */}
        <TabsContent value="expert" className="space-y-6">
          {DEMO_EXPERT_RECOMMENDATIONS.map((rec, index) => {
            const priorityStyle =
              rec.priority === "critical"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : rec.priority === "high"
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-300";
            const CategoryIcon = rec.category === "Strategic" ? Target : rec.category === "Technical" ? Zap : Lightbulb;
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={revealed ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.06 * index, duration: 0.5 }}
                className={cn(GLASS, "relative overflow-hidden p-6")}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-blue-500/10" />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <CategoryIcon className="h-4 w-4 text-violet-300" />
                    </div>
                    <h3 className="font-semibold text-white">{rec.title}</h3>
                    <Badge className={cn("border", priorityStyle)}>{rec.priority.toUpperCase()} PRIORITY</Badge>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                      {rec.category}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="rounded-xl border-l-2 border-purple-500 bg-purple-500/10 p-3">
                      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-purple-300">
                        Expert Insight
                      </div>
                      <p className="text-sm text-zinc-200">{rec.insight}</p>
                    </div>
                    <div className="rounded-xl border-l-2 border-emerald-500 bg-emerald-500/10 p-3">
                      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        Recommendation
                      </div>
                      <p className="text-sm text-zinc-200">{rec.recommendation.replaceAll("€", symbol)}</p>
                    </div>
                    <div className="rounded-xl border-l-2 border-blue-500 bg-blue-500/10 p-3">
                      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-300">
                        Expected Impact
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">{rec.expectedImpact}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-300">
                      <Clock className="h-4 w-4" />
                      {rec.action}
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
                    >
                      <Rocket className="mr-1 h-3.5 w-3.5" />
                      Implement
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Market intelligence */}
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              <h3 className="font-semibold text-white">Market Intelligence &amp; Competitive Analysis</h3>
              <Badge variant="outline" className="ml-auto border-white/10 bg-white/5 text-zinc-300">
                <Globe className="mr-1 h-3 w-3" /> Live signals
              </Badge>
            </div>
            <div className="space-y-3">
              {DEMO_MARKET_INTELLIGENCE.map((intel) => (
                <div key={intel.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">{intel.title}</h4>
                    <Badge
                      className={
                        intel.urgency === "high"
                          ? "border-red-500/30 bg-red-500/10 text-red-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      }
                    >
                      {intel.urgency.toUpperCase()} URGENCY
                    </Badge>
                  </div>
                  <p className="mb-1.5 text-sm text-zinc-300">{intel.insight}</p>
                  <p className="flex items-start gap-1.5 text-sm font-medium text-blue-400">
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
                    {intel.recommendation.replaceAll("€", symbol)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(GLASS, "flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2.5">
                <Star className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Senior Media Buyer Mode</div>
                <p className="text-sm text-zinc-400">
                  Recommendations distilled from patterns across 2,400+ managed accounts
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              View Full Playbook
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
