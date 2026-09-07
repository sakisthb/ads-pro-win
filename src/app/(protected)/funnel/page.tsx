"use client";

import { useEffect, useMemo, useState } from "react";
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
  LineChart,
  Line,
  Cell,
  LabelList,
  type TooltipContentProps,
} from "recharts";
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  Lightbulb,
  Activity,
  Smartphone,
  MonitorSmartphone,
  Store,
  Globe,
  ShoppingBag,
  CreditCard,
} from "lucide-react";
import { AnimatedSection, StaggerContainer, fadeInUp } from "@/components/ui/animated-section";
import { EmptyDataState, CardSkeleton } from "@/components/ui/data-state";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { api } from "@/components/providers/trpc-provider";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { deriveFunnelActions, selectPixelFunnelStages, buildPixelLeakage } from "@/lib/dashboard-insights";
import { downloadBlob, generateMultiSectionCSV } from "@/lib/export/csv-generator";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";

// ---------------------------------------------------------------------------
// Demo-only sample decks (never shown on a live org)
// ---------------------------------------------------------------------------
const LEAKAGE_DATA = [
  { reason: "Slow page load", share: 23, color: "#EF4444" },
  { reason: "Price shock at checkout", share: 19, color: "#F97316" },
  { reason: "Complex checkout flow", share: 15, color: "#F59E0B" },
  { reason: "Unexpected shipping cost", share: 12, color: "#EAB308" },
  { reason: "Forced account creation", share: 11, color: "#84CC16" },
  { reason: "Payment method failure", share: 8, color: "#22D3EE" },
  { reason: "Other / unknown", share: 12, color: "#94A3B8" },
];

const TIME_TO_CONVERT = [
  { bucket: "0–1 days", share: 34 },
  { bucket: "2–3 days", share: 22 },
  { bucket: "4–7 days", share: 18 },
  { bucket: "8–14 days", share: 15 },
  { bucket: "15–30 days", share: 11 },
];

const TIME_COLORS = ["#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#EC4899"];

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

function pctDelta(prev: number, next: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return null;
  if (prev === 0) return next === 0 ? 0 : null;
  return ((next - prev) / Math.abs(prev)) * 100;
}

function priorWindow(range: DateRangeValue): DateRangeValue | null {
  if (!range.startDate || !range.endDate) return null;
  const start = parseISO(range.startDate);
  const end = parseISO(range.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = differenceInCalendarDays(end, start) + 1;
  if (days < 1) return null;
  const priorEnd = subDays(start, 1);
  const priorStart = subDays(priorEnd, days - 1);
  return {
    startDate: format(priorStart, "yyyy-MM-dd"),
    endDate: format(priorEnd, "yyyy-MM-dd"),
  };
}

function rate(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

function humanizeLabel(label: string): string {
  return label
    .split(/[\s_]+/)
    .map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type DeviceBucket = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type HourlyBucket = {
  hour: string;
  spend: number;
  impressions: number;
  clicks?: number;
  conversions?: number;
};

function PercentTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">{label}</p>
      {payload.map((e) => (
        <div key={String(e.dataKey)} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-white/50">{e.name}:</span>
          <span className="font-semibold text-white">{`${Number(e.value).toFixed(1)}%`}</span>
        </div>
      ))}
    </div>
  );
}

function DeliveryTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as {
    impressions?: number;
    spend?: number;
    clicks?: number;
    conversions?: number;
    ctr?: number;
    cvr?: number;
  } | undefined;
  const lines: { name: string; value: string; color?: string }[] = [
    { name: "Impressions", value: fmtNum(row?.impressions ?? Number(payload[0]?.value) ?? 0), color: payload[0]?.color },
  ];
  if ((row?.clicks ?? 0) > 0) lines.push({ name: "Clicks", value: fmtNum(row!.clicks!) });
  if ((row?.ctr ?? 0) > 0) lines.push({ name: "CTR", value: `${(row!.ctr ?? 0).toFixed(2)}%` });
  if ((row?.conversions ?? 0) > 0) lines.push({ name: "Pixel purchases", value: fmtNum(row!.conversions!) });
  if ((row?.cvr ?? 0) > 0) lines.push({ name: "Click → purchase", value: `${(row!.cvr ?? 0).toFixed(2)}%` });
  if ((row?.spend ?? 0) > 0) lines.push({ name: "Spend", value: row!.spend!.toFixed(2) });
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-white/80">{label}</p>
      {lines.map((e) => (
        <div key={e.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color ?? "#22D3EE" }} />
          <span className="text-white/50">{e.name}:</span>
          <span className="font-semibold text-white">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

function DeviceMiniTable({
  title,
  hint,
  rows,
  money,
  variant,
}: {
  title: string;
  hint: string;
  rows: DeviceBucket[];
  money: (n: number) => string;
  variant: "platform" | "device";
}) {
  const Icon = variant === "platform" ? MonitorSmartphone : Smartphone;
  const iconClass = variant === "platform" ? "text-blue-400" : "text-violet-400";
  const showCvr = rows.some((r) => r.conversions > 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          <h2 className="text-sm font-semibold text-white/80">{title}</h2>
        </div>
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
              <th className="px-4 py-2 font-medium">Device</th>
              <th className="px-4 py-2 text-right font-medium">Impr.</th>
              <th className="px-4 py-2 text-right font-medium">Clicks</th>
              <th className="px-4 py-2 text-right font-medium">CTR</th>
              {showCvr && <th className="px-4 py-2 text-right font-medium">Purch.</th>}
              {showCvr && <th className="px-4 py-2 text-right font-medium">CVR</th>}
              <th className="px-4 py-2 text-right font-medium">Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-white/5">
                <td className="px-4 py-2.5 font-medium text-white">{humanizeLabel(row.label)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{fmtNum(row.clicks)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{`${rate(row.clicks, row.impressions).toFixed(2)}%`}</td>
                {showCvr && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{fmtNum(row.conversions)}</td>
                )}
                {showCvr && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{`${rate(row.conversions, row.clicks).toFixed(2)}%`}</td>
                )}
                <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{money(row.spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-[11px] text-white/30">vs prior</span>;
  }
  const favorable = invert ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${favorable ? "text-emerald-400" : "text-rose-400"}`}>
      <Icon className="h-3 w-3" />
      {`${value >= 0 ? "+" : ""}${value.toFixed(1)}%`} vs prior
    </span>
  );
}

type CampaignRow = {
  campaignId?: string;
  campaignName?: string;
  platform?: string;
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  totalConversions?: number;
  totalConversionValue?: number;
  totalLandingPageViews?: number;
  totalAddToCart?: number;
  totalCheckouts?: number;
  totalReach?: number;
  resultType?: string | null;
  roas?: number;
  ctr?: number;
  cpc?: number;
};

export default function FunnelPage() {
  const { isDemo, isLoading: orgLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { format, formatExact, currency } = useCurrency();
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));

  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });
  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);
  const rangeValid = dateRange.startDate !== "" && dateRange.endDate !== "";
  const prior = useMemo(() => (rangeValid ? priorWindow(dateRange) : null), [dateRange, rangeValid]);
  const liveReady = rangeValid && !orgLoading && shopReady;

  const perfQuery = api.marketing.getBlendedPerformance.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const compareQuery = api.marketing.comparePeriods.useQuery(
    {
      period1Start: prior?.startDate ?? "",
      period1End: prior?.endDate ?? "",
      period2Start: dateRange.startDate,
      period2End: dateRange.endDate,
      ...shopQuery,
    },
    { enabled: liveReady && !!prior, retry: false, refetchOnWindowFocus: false },
  );
  const campaignQuery = api.marketing.getCampaignPerformance.useQuery(
    { limit: 20, startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const audienceQuery = api.marketing.getAudienceBreakdown.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    {
      enabled: liveReady && !isDemo,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60_000,
    },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady, retry: false, refetchOnWindowFocus: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo, retry: false, refetchOnWindowFocus: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo, retry: false, refetchOnWindowFocus: false },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: liveReady && !isDemo, retry: false, refetchOnWindowFocus: false },
  );
  const syncStatus = api.syncStatus.getStatus.useQuery(brandId ? { brandId } : {}, {
    enabled: liveReady && !isDemo,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const accountQuery = api.marketing.getAccountSummary.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: liveReady && !isDemo, retry: false, refetchOnWindowFocus: false },
  );

  const totals = perfQuery.data?.data?.totals;
  const timeseries = perfQuery.data?.data?.timeseries ?? [];
  const campaigns: CampaignRow[] = campaignQuery.data?.data?.campaigns ?? [];
  const priorTotals = compareQuery.data?.data?.period1;

  const impressions = totals?.totalImpressions ?? 0;
  const clicks = totals?.totalClicks ?? 0;
  const conversions = totals?.totalConversions ?? 0;
  const spend = totals?.totalSpend ?? 0;
  const revenue = totals?.totalConversionValue ?? 0;
  const ctr = totals?.blendedCTR ?? rate(clicks, impressions);
  const cvr = rate(conversions, clicks);
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = totals?.blendedROAS ?? (spend > 0 ? revenue / spend : 0);
  const cpc = totals?.blendedCPC ?? (clicks > 0 ? spend / clicks : 0);

  const priorCtr = priorTotals?.blendedCTR ?? 0;
  const priorCvr = rate(priorTotals?.totalConversions ?? 0, priorTotals?.totalClicks ?? 0);
  const priorCpa =
    (priorTotals?.totalConversions ?? 0) > 0
      ? (priorTotals?.totalSpend ?? 0) / (priorTotals?.totalConversions ?? 1)
      : 0;
  const priorRoas = priorTotals?.blendedROAS ?? 0;
  const priorSpend = priorTotals?.totalSpend ?? 0;

  const stages = useMemo(() => {
    const pixel = selectPixelFunnelStages({
      landingPageViews:
        audienceQuery.data?.pixelEvents?.landingPageViews ||
        totals?.totalLandingPageViews,
      addToCart: audienceQuery.data?.pixelEvents?.addToCart || totals?.totalAddToCart,
      checkouts: audienceQuery.data?.pixelEvents?.checkouts || totals?.totalCheckouts,
    });
    const pixelMeta = {
      landing: {
        name: "Landing views",
        hint: "Meta pixel — not unique sessions",
        icon: Globe,
        color: "#22D3EE",
      },
      atc: {
        name: "Add to cart",
        hint: "Meta pixel",
        icon: ShoppingBag,
        color: "#F59E0B",
      },
      checkout: {
        name: "Checkout",
        hint: "Meta pixel initiate checkout",
        icon: CreditCard,
        color: "#F97316",
      },
    } as const;
    const rows = [
      {
        key: "impressions",
        name: "Impressions",
        hint: "Ad delivery",
        icon: Eye,
        volume: impressions,
        color: "#3B82F6",
      },
      {
        key: "clicks",
        name: "Clicks",
        hint: "Link clicks",
        icon: MousePointerClick,
        volume: clicks,
        color: "#8B5CF6",
      },
      ...pixel.map((p) => ({
        key: p.key,
        volume: p.volume,
        ...pixelMeta[p.key],
      })),
      {
        key: "purchases",
        name: "Pixel purchases",
        hint: "Ad account conversions — not till, not GA4",
        icon: ShoppingCart,
        volume: conversions,
        color: "#EC4899",
      },
    ];
    return rows.map((row, idx) => {
      const next = rows[idx + 1];
      const continueRate = next && row.volume > 0 ? rate(next.volume, row.volume) : null;
      const dropped = next && row.volume > next.volume ? row.volume - next.volume : 0;
      const overflow = next != null && row.volume > 0 && next.volume > row.volume;
      return {
        ...row,
        width: impressions > 0 ? Math.min(100, Math.max(14, (row.volume / impressions) * 100)) : 14,
        continueRate,
        dropped,
        overflow,
      };
    });
  }, [impressions, clicks, conversions, audienceQuery.data?.pixelEvents, totals]);

  const pixelLeakage = useMemo(() => buildPixelLeakage(stages), [stages]);

  const lastSynced = timeseries.length > 0 ? timeseries[timeseries.length - 1]?.date : null;

  const extraConvIfPriorCvr =
    clicks > 0 && priorCvr > cvr + 0.05 ? (clicks * (priorCvr - cvr)) / 100 : 0;

  const trendPoints = useMemo(
    () =>
      timeseries.map((d: { date: string; totalImpressions?: number; totalClicks?: number; totalConversions?: number }) => ({
        date: String(d.date).slice(5),
        ctr: rate(d.totalClicks ?? 0, d.totalImpressions ?? 0),
        cvr: rate(d.totalConversions ?? 0, d.totalClicks ?? 0),
      })),
    [timeseries],
  );

  const rankedCampaigns = useMemo(() => {
    return [...campaigns]
      .map((c) => {
        const impr = Number(c.totalImpressions ?? 0);
        const cl = Number(c.totalClicks ?? 0);
        const conv = Number(c.totalConversions ?? 0);
        return {
          ...c,
          ctr: Number(c.ctr ?? rate(cl, impr)),
          cvr: rate(conv, cl),
          spend: Number(c.totalSpend ?? 0),
          roas: Number(c.roas ?? 0),
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [campaigns]);

  const bestCampaign = rankedCampaigns[0]
    ? { name: rankedCampaigns[0].campaignName ?? "Campaign", roas: rankedCampaigns[0].roas, cvr: rankedCampaigns[0].cvr }
    : undefined;

  const actions = deriveFunnelActions({
    ctr,
    cvr,
    spend,
    conversions,
    campaignCount: rankedCampaigns.filter((c) => c.spend > 0).length,
    bestCampaign,
    clicks,
    landingPageViews:
      audienceQuery.data?.pixelEvents?.landingPageViews ||
      totals?.totalLandingPageViews,
  });

  const devicePlatforms: DeviceBucket[] = audienceQuery.data?.devicePlatforms ?? [];
  const impressionDevices: DeviceBucket[] = (audienceQuery.data?.impressionDevices ?? []).slice(0, 8);
  const hourly: HourlyBucket[] = audienceQuery.data?.hourly ?? [];
  const hourlyPoints = hourly.map((h) => ({
    hour: `${h.hour}:00`,
    impressions: h.impressions,
    spend: h.spend,
    ctr: rate(h.clicks ?? 0, h.impressions),
    cvr: rate(h.conversions ?? 0, h.clicks ?? 0),
    clicks: h.clicks ?? 0,
    conversions: h.conversions ?? 0,
  }));
  const hourlyHasClicks = hourlyPoints.some((h) => h.clicks > 0);
  const hourlyHasPurchases = hourlyPoints.some((h) => h.conversions > 0);
  const mer = merQuery.data?.data;
  const storeOrders = mer?.orderCount ?? 0;
  const ga4Purchases = ga4Mix.data?.data?.totals.purchases ?? 0;
  const liveAccounts = accountQuery.data?.data?.accounts ?? [];
  const operatorDesk = buildOperatorDesk({
    totals,
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
  const pixelEvents = audienceQuery.data?.pixelEvents;
  const pixelStages = selectPixelFunnelStages(pixelEvents ?? {});

  const hasData = impressions > 0 || clicks > 0;
  const isLoading = orgLoading || !rangeValid || !shopReady || perfQuery.isLoading;

  const exportCsv = () => {
    const blob = generateMultiSectionCSV([
      {
        title: `Ad delivery funnel ${dateRange.startDate} → ${dateRange.endDate}`,
        headers: ["Metric", "Value"],
        rows: [
          ["Impressions", impressions],
          ["Clicks", clicks],
          ["Pixel purchases", conversions],
          ["CTR %", Number(ctr.toFixed(4))],
          ["Click-to-purchase %", Number(cvr.toFixed(4))],
          ["Spend", Number(spend.toFixed(2))],
          ["Pixel conversion value", Number(revenue.toFixed(2))],
          ["Pixel ROAS", Number(roas.toFixed(4))],
          ["CPA", Number(cpa.toFixed(4))],
          ["CPC", Number(cpc.toFixed(4))],
        ],
      },
      {
        title: "Campaign mini-funnels",
        headers: ["Campaign", "Platform", "Impressions", "Clicks", "CTR %", "Pixel purchases", "CVR %", "Spend", "Pixel ROAS"],
        rows: rankedCampaigns.map((c) => [
          c.campaignName ?? "",
          c.platform ?? "",
          Number(c.totalImpressions ?? 0),
          Number(c.totalClicks ?? 0),
          Number(c.ctr.toFixed(4)),
          Number(c.totalConversions ?? 0),
          Number(c.cvr.toFixed(4)),
          Number(c.spend.toFixed(2)),
          Number(c.roas.toFixed(4)),
        ]),
      },
      {
        title: "Daily CTR and click-to-purchase",
        headers: ["Date", "CTR %", "Click-to-purchase %"],
        rows: trendPoints.map((p, i) => [timeseries[i]?.date ?? p.date, Number(p.ctr.toFixed(4)), Number(p.cvr.toFixed(4))]),
      },
      ...(pixelStages.length > 0
        ? [
            {
              title: "Meta pixel events (not site sessions)",
              headers: ["Event", "Count"],
              rows: [
                ["Landing page views", pixelEvents?.landingPageViews ?? 0],
                ["Add to cart", pixelEvents?.addToCart ?? 0],
                ["Initiate checkout", pixelEvents?.checkouts ?? 0],
                ["Pixel purchases", conversions],
              ],
            },
          ]
        : []),
      ...(devicePlatforms.length > 0
        ? [
            {
              title: "Device platforms",
              headers: ["Device", "Impressions", "Clicks", "CTR %", "Pixel purchases", "CVR %", "Spend"],
              rows: devicePlatforms.map((d) => [
                d.label,
                d.impressions,
                d.clicks,
                Number(rate(d.clicks, d.impressions).toFixed(4)),
                d.conversions,
                Number(rate(d.conversions, d.clicks).toFixed(4)),
                Number(d.spend.toFixed(2)),
              ]),
            },
          ]
        : []),
      ...(hourlyPoints.length > 0
        ? [
            {
              title: "Hourly delivery (advertiser timezone)",
              headers: ["Hour", "Impressions", "Clicks", "CTR %", "Pixel purchases", "Spend"],
              rows: hourlyPoints.map((h) => [
                h.hour,
                h.impressions,
                h.clicks,
                Number(h.ctr.toFixed(4)),
                h.conversions,
                Number(h.spend.toFixed(2)),
              ]),
            },
          ]
        : []),
      ...(storeOrders > 0 || ga4Purchases > 0
        ? [
            {
              title: "Five clocks — not added",
              headers: ["Metric", "Value"],
              rows: [
                ["Store orders", storeOrders],
                ["Pixel purchases", conversions],
                ["GA4 ecommerce purchases", ga4Purchases],
                ["GSC clicks (not Ads spend)", gscQuery.data?.totals.clicks ?? 0],
                ["GSC impressions", gscQuery.data?.totals.impressions ?? 0],
                ["Email delivered (not Pixel ROAS)", emailMetrics.data?.data?.totalSent ?? 0],
                ["Store net sales", Number((mer?.totalRevenue ?? 0).toFixed(2))],
                ["Pixel conversion value", Number(revenue.toFixed(2))],
                ["Store MER (store / spend)", Number((mer?.trueROAS ?? 0).toFixed(4))],
                ["Pixel ROAS", Number(roas.toFixed(4))],
              ],
            },
          ]
        : []),
    ]);
    downloadBlob(blob, `funnel-${dateRange.startDate}-${dateRange.endDate}.csv`);
  };

  const kpis = [
    { label: "CTR", value: `${ctr.toFixed(2)}%`, delta: pctDelta(priorCtr, ctr), hint: "Clicks / impressions" },
    { label: "Click → pixel", value: `${cvr.toFixed(2)}%`, delta: pctDelta(priorCvr, cvr), hint: "Pixel conversions / clicks" },
    { label: "CPA", value: conversions > 0 ? formatExact(cpa) : "—", delta: pctDelta(priorCpa, cpa), hint: "Spend / pixel purchases", invertDelta: true },
    { label: "Pixel ROAS", value: `${roas.toFixed(2)}x`, delta: pctDelta(priorRoas, roas), hint: "Pixel conversion value / spend" },
    { label: "Spend", value: format(spend), delta: pctDelta(priorSpend, spend), hint: "Not split by stage" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Funnel Analysis
              </span>
            </h1>
            <p className="text-sm text-white/40">
              Ad delivery path from paid DailyMetric — impressions, clicks, pixel purchases. Not till, not GA4, not a site session funnel. Five clocks — do not add them.
            </p>
            <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
            {lastSynced && (
              <p className="text-[11px] text-white/35">
                Window {dateRange.startDate} → {dateRange.endDate}
                {" · "}last synced day in range {lastSynced}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={rangeValid ? dateRange : { startDate: isoDaysAgo(30), endDate: todayIso() }} onChange={setDateRange} />
            <button
              type="button"
              onClick={exportCsv}
              disabled={!hasData}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Ask AI
            </Link>
          </div>
        </div>
      </AnimatedSection>

      {!isDemo && (
        <>
          <FiveClockStrip
            clocks={operatorDesk.clocks}
            caption="Pixel bars below are ad delivery. Till, GA4, GSC, and email stay named."
            ready={deskReady}
          />
          <OperatorBlockerBoard blockers={operatorDesk.blockers} ready={deskReady} />
        </>
      )}

      {isLoading ? (
        <CardSkeleton count={5} />
      ) : !hasData ? (
        <EmptyDataState
          title="No funnel data in this window"
          description="Connect an ad account and sync DailyMetric rows, or pick a range that includes delivery."
        />
      ) : (
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.label}
              variants={fadeInUp}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{kpi.value}</p>
              <div className="mt-2">
                <Delta value={kpi.delta} invert={"invertDelta" in kpi && kpi.invertDelta} />
              </div>
              <p className="mt-2 text-[11px] text-white/35">{kpi.hint}</p>
            </motion.div>
          ))}
        </StaggerContainer>
      )}

      {hasData && !isLoading && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white/80">Ad delivery funnel</h2>
            </div>
            <p className="mb-6 text-xs text-white/40">
              Spend sits on the whole path — it is not allocated to a TOFU or BOFU campaign unless you actually run those.
              {stages.some((s) => s.key === "landing" || s.key === "atc" || s.key === "checkout")
                ? " Landing, cart, and checkout are Meta pixel events attributed to this ad account — not GA sessions."
                : ""}
            </p>
            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const next = stages[idx + 1];
                return (
                  <div key={stage.key} className="space-y-2">
                    <div
                      className="flex items-center justify-between rounded-xl px-4 py-3 ring-1 ring-white/5"
                      style={{
                        width: `${stage.width}%`,
                        minWidth: "12rem",
                        background: `linear-gradient(135deg, ${stage.color}28, ${stage.color}0d)`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${stage.color}30` }}>
                          <Icon className="h-4 w-4" style={{ color: stage.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{stage.name}</p>
                          <p className="text-[10px] text-white/40">{stage.hint}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-white">
                        {stage.volume > 0 ? fmtNum(stage.volume) : "—"}
                      </p>
                    </div>
                    {next && stage.continueRate != null && (
                      <div className="flex flex-wrap items-center gap-2 pl-2 text-[11px]">
                        <ArrowRight className="h-3 w-3 text-white/25" />
                        {stage.overflow ? (
                          <span className="font-semibold text-cyan-300">
                            {`${stage.continueRate.toFixed(0)}%`} of previous — view-through or event multi-fire
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold text-blue-300">{`${stage.continueRate.toFixed(2)}%`} continue</span>
                            <span className="text-white/35">
                              {fmtNum(stage.dropped)} did not reach {next.name.toLowerCase()}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {extraConvIfPriorCvr >= 0.5 && (
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                If click-to-purchase had matched the prior window ({`${priorCvr.toFixed(2)}%`} vs {`${cvr.toFixed(2)}%`} now),
                this range would have about {fmtNum(Math.round(extraConvIfPriorCvr))} extra pixel purchases. Scenario only —
                not recoverable cash.
              </p>
            )}
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white/80">CTR and click-to-purchase</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">Daily rates from the same DailyMetric window. Empty days are omitted.</p>
            {trendPoints.length < 2 ? (
              <p className="py-8 text-center text-sm text-white/40">Need at least two synced days in this window for a trend.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendPoints} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={(props: TooltipContentProps<number, string>) => <PercentTooltip {...props} />} />
                    <Line type="monotone" dataKey="ctr" name="CTR" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cvr" name="Click → purchase" stroke="#c084fc" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && (devicePlatforms.length > 0 || impressionDevices.length > 0) && (
        <div className={`grid gap-4 ${devicePlatforms.length > 0 && impressionDevices.length > 0 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {devicePlatforms.length > 0 && (
            <DeviceMiniTable
              title="Device platforms"
              hint="Mobile app vs web vs desktop from Meta for this window. CTR is clicks / impressions."
              rows={devicePlatforms}
              money={format}
              variant="platform"
            />
          )}
          {impressionDevices.length > 0 && (
            <DeviceMiniTable
              title="Impression devices"
              hint="Where the ads actually rendered. Purchase columns appear only if Meta returned actions."
              rows={impressionDevices}
              money={format}
              variant="device"
            />
          )}
        </div>
      )}

      {hasData && !isLoading && hourlyPoints.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white/80">Hour of day</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              {hourlyHasPurchases
                ? "Meta advertiser-timezone delivery plus pixel purchases when Graph returned actions."
                : hourlyHasClicks
                  ? "Meta advertiser-timezone impressions and clicks. Not a conversion clock — purchases were not on this breakdown."
                  : "Meta advertiser-timezone impressions and spend. Clicks were not on this breakdown."}
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPoints} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={(props: TooltipContentProps<number, string>) => <DeliveryTooltip {...props} />} />
                  <Bar dataKey="impressions" name="Impressions" fill="#22D3EE" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && (
        <AnimatedSection>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-sm font-semibold text-white/80">Campaign mini-funnels</h2>
              <p className="mt-1 text-xs text-white/40">Same date window as the hero KPIs. One row per synced campaign.</p>
            </div>
            {rankedCampaigns.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-white/40">No campaign-level DailyMetric rows in this window.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
                      <th className="px-4 py-3 font-medium">Campaign</th>
                      <th className="px-4 py-3 font-medium">Platform</th>
                      <th className="px-4 py-3 text-right font-medium">Impr.</th>
                      <th className="px-4 py-3 text-right font-medium">Clicks</th>
                      <th className="px-4 py-3 text-right font-medium">CTR</th>
                      <th className="px-4 py-3 text-right font-medium">Purch.</th>
                      <th className="px-4 py-3 text-right font-medium">CVR</th>
                      <th className="px-4 py-3 text-right font-medium">Spend</th>
                      <th className="px-4 py-3 text-right font-medium">Pixel ROAS</th>
                      <th className="px-4 py-3 text-right font-medium">Ask</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedCampaigns.map((c) => (
                      <tr key={`${c.platform}-${c.campaignId || c.campaignName}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="max-w-[220px] truncate px-4 py-3 font-medium text-white">{c.campaignName}</td>
                        <td className="px-4 py-3 capitalize text-white/60">{c.platform}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{fmtNum(Number(c.totalImpressions ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{fmtNum(Number(c.totalClicks ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{`${c.ctr.toFixed(2)}%`}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{fmtNum(Number(c.totalConversions ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{`${c.cvr.toFixed(2)}%`}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{format(c.spend)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-400">{`${c.roas.toFixed(2)}x`}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href="/chat" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">
                            AI
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && !isDemo && (storeOrders > 0 || ga4Purchases > 0) && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white/80">Till MER vs pixel ROAS</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Same window as the funnel. Store MER is till / spend. Pixel ROAS is conversion value / spend. Do not treat them as one number.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Store net sales</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">{format(mer?.totalRevenue ?? 0)}</p>
                <p className="mt-1 text-[11px] text-white/35">
                  Store MER {`${(mer?.mer ?? mer?.trueROAS ?? 0).toFixed(2)}x`}
                  {typeof mer?.amer === "number" ? ` · aMER ${mer.amer.toFixed(2)}x` : ""}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Pixel value</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">{format(revenue)}</p>
                <p className="mt-1 text-[11px] text-white/35">Pixel ROAS {`${roas.toFixed(2)}x`}</p>
              </div>
            </div>
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && actions.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white/80">What to do next</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">Grounded in this window’s CTR, click-to-purchase, and campaign ROAS — not sample CRO copy.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {actions.map((insight) => (
                <div key={insight.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{insight.title}</p>
                    <Link href={insight.href} className="shrink-0 text-[11px] font-semibold text-violet-300 hover:text-violet-200">
                      {insight.actionLabel}
                    </Link>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && !isDemo && pixelLeakage.length > 0 && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white/80">Leakage from this window</h2>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Share of drop-off between Meta stages. Not page-speed or checkout UX — we do not have those events live.
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pixelLeakage} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis
                    type="category"
                    dataKey="reason"
                    width={175}
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={(props: TooltipContentProps<number, string>) => <PercentTooltip {...props} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="share" name="Share of drop-off" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {pixelLeakage.map((d) => (
                      <Cell key={d.reason} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="share"
                      position="right"
                      formatter={(value: unknown) => `${Number(value)}%`}
                      style={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>
      )}

      {hasData && !isLoading && !isDemo && (
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white/80">Time-to-convert</h2>
            </div>
            <p className="text-sm text-white/50">
              Live DailyMetric rows have no first-touch timestamp, so a time-to-convert histogram would be invented. Offer and landing leaks are on Creative Fatigue.
            </p>
            <Link href="/creative-fatigue" className="mt-3 inline-block text-xs font-semibold text-violet-300 hover:text-violet-200">
              Open Creative Fatigue
            </Link>
          </div>
        </AnimatedSection>
      )}

      {isDemo && (
        <>
          <AnimatedSection>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white/80">Leakage Analysis</h2>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Sample
                </span>
              </div>
              <p className="mb-5 text-xs text-white/40">
                Demo-only. Live workspaces do not have page-speed or checkout events, so this chart is hidden there.
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={LEAKAGE_DATA} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, 26]} />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={175}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={(props: TooltipContentProps<number, string>) => <PercentTooltip {...props} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="share" name="Share of drop-off" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {LEAKAGE_DATA.map((d) => (
                        <Cell key={d.reason} fill={d.color} />
                      ))}
                      <LabelList
                        dataKey="share"
                        position="right"
                        formatter={(value: unknown) => `${Number(value)}%`}
                        style={{ fill: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white/80">Time-to-Convert Distribution</h2>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Sample
                </span>
              </div>
              <p className="mb-5 text-xs text-white/40">
                Demo-only. No first-touch timestamp exists on live DailyMetric rows.
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TIME_TO_CONVERT} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={(props: TooltipContentProps<number, string>) => <PercentTooltip {...props} />} />
                    <Bar dataKey="share" name="Share of conversions" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {TIME_TO_CONVERT.map((d, i) => (
                        <Cell key={d.bucket} fill={TIME_COLORS[i % TIME_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AnimatedSection>
        </>
      )}
    </div>
  );
}
