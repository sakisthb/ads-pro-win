"use client";

// Reports — real export/report generation page.
// Task #31 (F4 Export/Reports): date range + platform + brand + format
// configuration on the left, a live WYSIWYG preview on the right, and fully
// client-side CSV/PDF generation (no server-side rendering of documents).
// Data comes from the existing org-scoped marketing tRPC queries.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarRange,
  Check,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Mail,
  MousePointerClick,
  Percent,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/components/providers/trpc-provider";
import {
  generateCSV,
  generateMultiSectionCSV,
  downloadBlob,
  type CSVSection,
} from "@/lib/export/csv-generator";
import { cn } from "@/lib/utils";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { MarketChips } from "@/components/brands/desk-filters";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
} from "@/components/ui/date-range-picker";
import { useCurrency } from "@/components/providers/currency";
import { formatMoney } from "@/lib/currency";
import { pickActiveBrandId } from "@/lib/active-brand";
import { buildEspEmailExportRows, nonMppUniqueOpens } from "@/lib/email-desk";

// ---------------------------------------------------------------------------
// Platform system (keys match the marketing router's platform enum)
// ---------------------------------------------------------------------------
type PlatformKey = "meta" | "google" | "tiktok";
const PLATFORM_KEYS: PlatformKey[] = ["meta", "google", "tiktok"];

const PLATFORM_META: Record<PlatformKey, { label: string; color: string }> = {
  meta: { label: "Meta", color: "#1877F2" },
  google: { label: "Google", color: "#4285F4" },
  tiktok: { label: "TikTok", color: "#FF0050" },
};

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Router row shapes (mirrored locally, defensive subsets)
// ---------------------------------------------------------------------------
interface BlendedTotals {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  totalReach: number;
  totalLinkClicks: number;
  totalLandingPageViews: number;
  totalAddToCart: number;
  totalCheckouts: number;
  blendedROAS: number;
  blendedCPC: number;
  blendedCPM: number;
  blendedCTR: number;
}

// ---------------------------------------------------------------------------
// Date display (ISO YYYY-MM-DD from DateRangePicker / isoDaysAgo)
// ---------------------------------------------------------------------------
function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const DATE_PRESETS = [7, 14, 30, 90, 180] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const fmtNumber = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sum per-platform totals back into blended totals (ratios recomputed). */
function mergeTotals(parts: BlendedTotals[]): BlendedTotals {
  const sum = (fn: (t: BlendedTotals) => number) =>
    parts.reduce((acc, p) => acc + fn(p), 0);
  const totalSpend = sum((t) => t.totalSpend);
  const totalImpressions = sum((t) => t.totalImpressions);
  const totalClicks = sum((t) => t.totalClicks);
  const totalConversions = sum((t) => t.totalConversions);
  const totalConversionValue = sum((t) => t.totalConversionValue);
  const totalReach = sum((t) => t.totalReach);
  const totalLinkClicks = sum((t) => t.totalLinkClicks);
  const totalLandingPageViews = sum((t) => t.totalLandingPageViews);
  const totalAddToCart = sum((t) => t.totalAddToCart);
  const totalCheckouts = sum((t) => t.totalCheckouts);
  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    totalConversionValue,
    totalReach,
    totalLinkClicks,
    totalLandingPageViews,
    totalAddToCart,
    totalCheckouts,
    blendedROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
    blendedCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
    blendedCPM:
      totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  };
}

/** Headline metrics shared by the preview and both export formats. */
function buildSummaryRows(
  totals: BlendedTotals | undefined,
  fmtCurrency: (n: number) => string,
): { label: string; value: string }[] {
  const t = totals;
  return [
    { label: "Total Spend", value: fmtCurrency(t?.totalSpend ?? 0) },
    { label: "Pixel conversion value", value: fmtCurrency(t?.totalConversionValue ?? 0) },
    { label: "Pixel ROAS", value: `${(t?.blendedROAS ?? 0).toFixed(2)}x` },
    { label: "Impressions", value: fmtNumber(t?.totalImpressions ?? 0) },
    { label: "Clicks", value: fmtNumber(t?.totalClicks ?? 0) },
    { label: "Link clicks", value: fmtNumber(t?.totalLinkClicks ?? 0) },
    { label: "Landing page views", value: fmtNumber(t?.totalLandingPageViews ?? 0) },
    { label: "Click-Through Rate", value: `${(t?.blendedCTR ?? 0).toFixed(2)}%` },
    { label: "Pixel conversions", value: fmtNumber(t?.totalConversions ?? 0) },
    { label: "Avg CPC", value: fmtCurrency(t?.blendedCPC ?? 0) },
    { label: "CPM", value: fmtCurrency(t?.blendedCPM ?? 0) },
  ];
}

function buildEspEmailSection(email: {
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  extras?: { present: boolean; appleMppOpens: number } | null;
  desks?: {
    retail?: { delivered: number };
    wholesale?: { delivered: number };
  } | null;
}): CSVSection {
  return {
    title: "ESP email (not till, not pixel)",
    headers: ["Metric", "Value"],
    rows: buildEspEmailExportRows({
      delivered: email.totalSent,
      uniqueOpens: email.totalOpens,
      clicks: email.totalClicks,
      extrasPresent: Boolean(email.extras?.present),
      appleMppOpens: email.extras?.appleMppOpens ?? 0,
      retailDelivered: email.desks?.retail?.delivered ?? 0,
      wholesaleDelivered: email.desks?.wholesale?.delivered ?? 0,
    }),
  };
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------
function PlatformChip({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform.toLowerCase() as PlatformKey];
  const color = meta?.color ?? "#71717a";
  const label = meta?.label ?? platform;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
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
      {label}
    </span>
  );
}

function PreviewStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className={cn(GLASS, "flex items-center gap-3 p-4")}>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-lg",
          accent,
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
          {label}
        </p>
        <p className="mt-0.5 truncate text-base font-bold text-white tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ step, title }: { step: string; title: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
      <span className="text-blue-400/80">{step}</span>
      <span className="mx-1.5 text-white/20">·</span>
      {title}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  // NOTE(rules-of-hooks): every hook below must run unconditionally, so the
  // org-loading early-return lives at the BOTTOM of this component (just
  // before the render section) and the data queries are instead gated through
  // their `enabled` flags.
  const { org, isLoading: orgLoading } = useActiveOrg();
  const { market, setMarket, visible } = useActiveMarket();
  const { currency } = useCurrency();
  const fmtCurrency = (n: number) =>
    formatMoney(n, currency, { maximumFractionDigits: n >= 100 ? 0 : 2 });

  // -- Configuration state ----------------------------------------------------
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [platforms, setPlatforms] = useState<Record<PlatformKey, boolean>>({
    meta: true,
    google: true,
    tiktok: true,
  });
  const [brandId, setBrandId] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Dates are set post-mount so SSR and client HTML always match.
  useEffect(() => {
    setStartDate(isoDaysAgo(30));
    setEndDate(todayIso());
  }, []);

  // -- Derived configuration ---------------------------------------------------
  // True once the active org has resolved — data queries stay disabled until
  // then (queries are org-scoped and work for demo and real orgs alike).
  const orgReady = !orgLoading;
  const datesValid =
    startDate !== "" && endDate !== "" && startDate <= endDate;
  const selectedKeys = PLATFORM_KEYS.filter((p) => platforms[p]);
  const allSelected = selectedKeys.length === PLATFORM_KEYS.length;
  const canGenerate = datesValid && selectedKeys.length > 0;
  const brandFilter = brandId || undefined;
  const shopQuery = withMarketQuery(brandFilter, market);

  // -- tRPC queries (org-scoped; disabled until the form is valid) -------------
  const blendedAll = api.marketing.getBlendedPerformance.useQuery(
    { startDate, endDate, platform: "all", ...shopQuery },
    { enabled: orgReady && datesValid && allSelected },
  );
  const blendedMeta = api.marketing.getBlendedPerformance.useQuery(
    { startDate, endDate, platform: "meta", ...shopQuery },
    { enabled: orgReady && datesValid && !allSelected && platforms.meta },
  );
  const blendedGoogle = api.marketing.getBlendedPerformance.useQuery(
    { startDate, endDate, platform: "google", ...shopQuery },
    { enabled: orgReady && datesValid && !allSelected && platforms.google },
  );
  const blendedTikTok = api.marketing.getBlendedPerformance.useQuery(
    { startDate, endDate, platform: "tiktok", ...shopQuery },
    { enabled: orgReady && datesValid && !allSelected && platforms.tiktok },
  );
  const accountSummary = api.marketing.getAccountSummary.useQuery(
    { startDate, endDate, ...shopQuery },
    { enabled: orgReady && datesValid },
  );
  const topCampaigns = api.marketing.getTopCampaigns.useQuery(
    { startDate, endDate, metric: "spend", limit: 10, ...shopQuery },
    { enabled: orgReady && datesValid },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate, endDate, ...shopQuery },
    { enabled: orgReady && datesValid },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate, endDate, ...shopQuery },
    { enabled: orgReady && datesValid },
  );
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate, endDate, platform: "all", ...shopQuery },
    { enabled: orgReady && datesValid },
  );
  const brands = api.brands.list.useQuery(undefined, { enabled: orgReady });

  useEffect(() => {
    if (brandId || !brands.data?.length) return;
    const preferred = pickActiveBrandId(brands.data, null, null);
    if (preferred) setBrandId(preferred);
  }, [brandId, brands.data]);

  // Org name comes straight from useActiveOrg (no extra getCurrent round-trip).
  const orgName = org?.name ?? "Ads Pro";
  const brandName =
    brands.data?.find((b) => b.id === brandId)?.name ?? undefined;

  // -- Preview data (mirrors exactly what the export contains) ------------------
  const blendedTotals = useMemo<BlendedTotals | undefined>(() => {
    if (!datesValid) return undefined;
    if (allSelected) return blendedAll.data?.data?.totals;
    const parts = [
      blendedMeta.data?.data?.totals,
      blendedGoogle.data?.data?.totals,
      blendedTikTok.data?.data?.totals,
    ].filter((t): t is BlendedTotals => !!t);
    return parts.length ? mergeTotals(parts) : undefined;
  }, [
    datesValid,
    allSelected,
    blendedAll.data,
    blendedMeta.data,
    blendedGoogle.data,
    blendedTikTok.data,
  ]);

  const platformFilter = useMemo(() => {
    if (allSelected) return () => true;
    const set = new Set(selectedKeys);
    return (platform: string) => set.has(platform.toLowerCase() as PlatformKey);
  }, [allSelected, selectedKeys]);

  const accounts = useMemo(
    () =>
      (accountSummary.data?.data?.accounts ?? []).filter((a) =>
        platformFilter(a.platform),
      ),
    [accountSummary.data, platformFilter],
  );

  const campaigns = useMemo(
    () =>
      (topCampaigns.data?.data?.campaigns ?? []).filter((c) =>
        platformFilter(c.platform),
      ),
    [topCampaigns.data, platformFilter],
  );

  const loading =
    !datesValid ||
    (allSelected ? blendedAll.isLoading : selectedKeys.length === 0) ||
    (allSelected
      ? false
      : selectedKeys.some((k) =>
          k === "meta"
            ? blendedMeta.isLoading
            : k === "google"
              ? blendedGoogle.isLoading
              : blendedTikTok.isLoading,
        )) ||
    accountSummary.isLoading ||
    topCampaigns.isLoading;

  const error =
    datesValid &&
    ((allSelected
      ? blendedAll.isError
      : selectedKeys.some((k) =>
          k === "meta"
            ? blendedMeta.isError
            : k === "google"
              ? blendedGoogle.isError
              : blendedTikTok.isError,
        )) ||
      accountSummary.isError);

  const hasData =
    accounts.length > 0 ||
    campaigns.length > 0 ||
    (blendedTotals?.totalSpend ?? 0) > 0 ||
    (blendedTotals?.totalImpressions ?? 0) > 0;

  const platformLabel = allSelected
    ? "All platforms"
    : selectedKeys.map((k) => PLATFORM_META[k].label).join(", ");
  const rangeLabel = datesValid
    ? `${fmtDate(startDate)} – ${fmtDate(endDate)}`
    : "Set a date range";

  // -- Export helpers ------------------------------------------------------------
  const activeQueries = useMemo(() => {
    if (!allSelected) {
      return selectedKeys.map(
        (k) =>
          ({
            meta: blendedMeta,
            google: blendedGoogle,
            tiktok: blendedTikTok,
          })[k],
      );
    }
    return [blendedAll];
  }, [allSelected, selectedKeys, blendedAll, blendedMeta, blendedGoogle, blendedTikTok]);

  const buildExportSummary = (totals?: BlendedTotals) => [
    { label: "Platforms", value: platformLabel },
    ...(brandName ? [{ label: "Brand", value: brandName }] : []),
    { label: "Date Range", value: rangeLabel },
    ...buildSummaryRows(totals, fmtCurrency),
  ];

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setDownloaded(false);
    try {
      // Refetch the active queries so the export always reflects fresh data
      // (refetch results are used directly — not the stale render closure).
      const [totalsParts, accRes, campRes, merRes, ga4Res, emailRes] = await Promise.all([
        Promise.all(
          activeQueries.map(async (q) => (await q.refetch()).data?.data?.totals),
        ),
        accountSummary.refetch(),
        topCampaigns.refetch(),
        merQuery.refetch(),
        ga4Mix.refetch(),
        emailMetrics.refetch(),
      ]);

      const freshTotalsParts = totalsParts.filter(
        (t): t is BlendedTotals => !!t,
      );
      const freshTotals = freshTotalsParts.length
        ? mergeTotals(freshTotalsParts)
        : undefined;
      const freshAccounts = (accRes.data?.data?.accounts ?? []).filter((a) =>
        platformFilter(a.platform),
      );
      const freshCampaigns = (campRes.data?.data?.campaigns ?? []).filter((c) =>
        platformFilter(c.platform),
      );
      const email = emailRes.data?.data;
      const emailSection =
        email && (email.connected || email.totalSent > 0)
          ? buildEspEmailSection(email)
          : null;

      const summary = buildExportSummary(freshTotals);
      const platformSuffix = allSelected
        ? "all-platforms"
        : selectedKeys.join("-");
      const brandSuffix = brandName
        ? `-${brandName.toLowerCase().replace(/\s+/g, "-")}`
        : "";
      const baseName = `report-${platformSuffix}${brandSuffix}-${startDate}_to_${endDate}`;

      if (format === "csv") {
        const sections: CSVSection[] = [
          {
            title: "Summary",
            headers: ["Metric", "Value"],
            rows: summary.map((s) => [s.label, s.value]),
          },
        ];
        if (freshAccounts.length > 0) {
          sections.push({
            title: "Account Performance",
            headers: ["Account", "Platform", "Spend", "Pixel conversion value", "Pixel ROAS"],
            rows: freshAccounts.map((a) => [
              a.name,
              a.platform,
              round2(a.totalSpend),
              round2(a.totalConversionValue),
              round2(a.roas),
            ]),
          });
        }
        if (freshCampaigns.length > 0) {
          sections.push({
            title: "Top Campaigns",
            headers: ["Campaign", "Platform", "Spend", "Pixel conversion value", "Pixel ROAS"],
            rows: freshCampaigns.map((c) => [
              c.campaignName,
              c.platform,
              round2(c.totalSpend),
              round2(c.totalConversionValue),
              round2(c.roas),
            ]),
          });
        }
        const mer = merRes.data?.data;
        if (mer) {
          sections.push({
            title: "Till vs pixel",
            headers: ["Metric", "Value"],
            rows: [
              ["Store orders", mer.orderCount],
              ["Store net sales", round2(mer.totalRevenue)],
              ["Pixel conversions", mer.pixelConversions],
              ["Pixel conversion value", round2(mer.totalAttributedRevenue)],
              ["GA4 ecommerce purchases", round2(ga4Res.data?.data?.totals.purchases ?? 0)],
              ["GA4 sessions", ga4Res.data?.data?.totals.sessions ?? 0],
              ["GA4 revenue", round2(ga4Res.data?.data?.totals.revenue ?? 0)],
              ["Store MER", round2(mer.mer)],
              ["aMER", round2(mer.amer)],
              ["New-customer net", round2(mer.newCustomerNet)],
              ["Net ex VAT", round2(mer.netExVat)],
              ["VAT in window", round2(mer.tax)],
              ["Refunds", round2(mer.refunds)],
              ["Pixel ROAS", round2(mer.platformROAS)],
            ],
          });
          if (mer.markets) {
            sections.push({
              title: "Retail vs wholesale till",
              headers: ["Desk", "Orders", "Net sales", "Named ad spend"],
              rows: [
                ["Retail · ΛΙΑΝΙΚΗ", mer.markets.retail.orders, round2(mer.markets.retail.netSales), round2(mer.adMarkets?.retail.spend ?? 0)],
                ["Wholesale · χονδρική", mer.markets.wholesale.orders, round2(mer.markets.wholesale.netSales), round2(mer.adMarkets?.wholesale.spend ?? 0)],
                ["Unclassified", mer.markets.unknown.orders, round2(mer.markets.unknown.netSales), round2(mer.adMarkets?.unknown.spend ?? 0)],
              ],
            });
          }
        }
        if (emailSection) {
          sections.push(emailSection);
        }
        const blob =
          sections.length === 1
            ? generateCSV(sections[0].headers, sections[0].rows)
            : generateMultiSectionCSV(sections);
        downloadBlob(blob, `${baseName}.csv`);
      } else {
        // Lazy import: keeps jsPDF out of the SSR bundle / initial payload.
        const { generatePDFReport } = await import(
          "@/lib/export/pdf-generator"
        );
        const blob = generatePDFReport({
          title: "Performance Report",
          dateRange: rangeLabel,
          orgName,
          summary,
          tableHeaders: ["Account", "Platform", "Spend", "Pixel conversion value", "Pixel ROAS"],
          tableRows: freshAccounts.map((a) => [
            a.name,
            a.platform,
            fmtCurrency(a.totalSpend),
            fmtCurrency(a.totalConversionValue),
            `${a.roas.toFixed(2)}x`,
          ]),
          sections: [
            ...(freshCampaigns.length > 0
              ? [
                  {
                    title: "Top Campaigns",
                    tableHeaders: [
                      "Campaign",
                      "Platform",
                      "Spend",
                      "Pixel conversion value",
                      "Pixel ROAS",
                    ],
                    tableRows: freshCampaigns.map(
                      (c) =>
                        [
                          c.campaignName,
                          c.platform,
                          fmtCurrency(c.totalSpend),
                          fmtCurrency(c.totalConversionValue),
                          `${c.roas.toFixed(2)}x`,
                        ] as (string | number)[],
                    ),
                  },
                ]
              : []),
            ...(merRes.data?.data
              ? [
                  {
                    title: "Till vs pixel",
                    tableHeaders: ["Metric", "Value"],
                    tableRows: [
                      ["Store orders", merRes.data.data.orderCount],
                      ["Store net sales", fmtCurrency(merRes.data.data.totalRevenue)],
                      ["Pixel conversions", merRes.data.data.pixelConversions],
                      ["GA4 ecommerce purchases", ga4Res.data?.data?.totals.purchases ?? 0],
                      ["Store MER", `${merRes.data.data.mer.toFixed(2)}x`],
                      ["aMER", `${(merRes.data.data.amer ?? 0).toFixed(2)}x`],
                      ["New-customer net", fmtCurrency(merRes.data.data.newCustomerNet ?? 0)],
                      ["Net ex VAT", fmtCurrency(merRes.data.data.netExVat ?? 0)],
                      ["Pixel ROAS", `${merRes.data.data.platformROAS.toFixed(2)}x`],
                    ] as (string | number)[][],
                  },
                ]
              : []),
            ...(emailSection
              ? [
                  {
                    title: emailSection.title,
                    tableHeaders: emailSection.headers,
                    tableRows: emailSection.rows,
                  },
                ]
              : []),
          ],
        });
        downloadBlob(blob, `${baseName}.pdf`);
      }

      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 4000);
    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const applyPreset = (days: number) => {
    setStartDate(isoDaysAgo(days));
    setEndDate(todayIso());
  };

  const presetActive = (days: number) =>
    startDate === isoDaysAgo(days) && endDate === todayIso();

  const hint = !datesValid
    ? "End date must be on or after the start date."
    : selectedKeys.length === 0
      ? "Select at least one platform."
      : null;

  // -- Org gate (must stay below every hook — see the note at the top) -------
  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
            <FileText className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-xs font-semibold text-blue-300">Reporting Hub</span>
          </div>
          <h1 className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Reports
          </h1>
          <p className="text-sm text-zinc-400">
            Generate cross-platform performance reports as branded PDF documents or
            spreadsheets — built live from your synced data.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <DateRangePicker
            value={{ startDate, endDate }}
            onChange={(v) => {
              setStartDate(v.startDate);
              setEndDate(v.endDate);
            }}
          />
          <div className={cn(GLASS, "flex items-center gap-2.5 px-4 py-2.5")}>
            <Sparkles className="h-4 w-4 text-blue-300" />
            <p className="text-xs text-white/60">
              100% client-side generation — your data never leaves the browser
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        {/* ------------------------- Configuration card ------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={cn(GLASS, "space-y-7 p-6 lg:sticky lg:top-6")}
        >
          {/* Date range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-blue-400" />
              <SectionLabel step="01" title="Date range" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyPreset(days)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    presetActive(days)
                      ? "border-blue-500/50 bg-blue-500/20 text-blue-200"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {days}d
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-blue-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-blue-500/50"
                />
              </label>
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />
              <SectionLabel step="02" title="Platforms" />
            </div>
            <div className="space-y-2">
              {PLATFORM_KEYS.map((key) => {
                const meta = PLATFORM_META[key];
                const checked = platforms[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() =>
                      setPlatforms((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      checked
                        ? "border-blue-500/40 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        checked
                          ? "border-blue-400 bg-blue-500"
                          : "border-white/20 bg-white/5",
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-sm font-medium text-white/80">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <SectionLabel step="03" title="Shop" />
            </div>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-blue-500/50"
            >
              <option value="">All shops (mixes desks)</option>
              {(brands.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <MarketChips value={market} options={visible} onSelect={setMarket} />
          </div>

          {/* Format */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-amber-400" />
              <SectionLabel step="04" title="Format" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                aria-pressed={format === "pdf"}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-4 py-4 transition-colors",
                  format === "pdf"
                    ? "border-blue-500/50 bg-blue-500/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <FileText
                  className={cn(
                    "h-5 w-5",
                    format === "pdf" ? "text-blue-300" : "text-zinc-500",
                  )}
                />
                <span className="text-sm font-semibold text-white">PDF</span>
                <span className="text-[10px] text-zinc-500">Branded document</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                aria-pressed={format === "csv"}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-4 py-4 transition-colors",
                  format === "csv"
                    ? "border-emerald-500/50 bg-emerald-500/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <FileSpreadsheet
                  className={cn(
                    "h-5 w-5",
                    format === "csv" ? "text-emerald-300" : "text-zinc-500",
                  )}
                />
                <span className="text-sm font-semibold text-white">CSV</span>
                <span className="text-[10px] text-zinc-500">Spreadsheet</span>
              </button>
            </div>
          </div>

          {/* Generate */}
          <div className="space-y-2.5 border-t border-white/10 pt-5">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className={cn(
                "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500",
                (!canGenerate || generating) && "opacity-60",
              )}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : downloaded ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {generating
                ? "Generating report…"
                : downloaded
                  ? "Report downloaded"
                  : "Generate Report"}
            </Button>
            {hint && <p className="text-xs text-amber-300/80">{hint}</p>}
            {downloaded && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Your {format.toUpperCase()} report has been downloaded.
              </p>
            )}
          </div>
        </motion.div>

        {/* ---------------------------- Live preview ---------------------------- */}
        <div className="space-y-6">
          {/* Preview header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07, duration: 0.5 }}
            className={cn(GLASS, "p-5")}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                  <Eye className="h-5 w-5 text-white" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">Report Preview</h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    Pixel cards are ad-account conversions. Store orders and GA4 purchases are other clocks — do not add them.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  <CalendarRange className="h-3 w-3 text-white/40" />
                  {rangeLabel}
                </span>
                {allSelected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    All platforms
                  </span>
                ) : (
                  selectedKeys.map((k) => (
                    <PlatformChip key={k} platform={k} />
                  ))
                )}
                {brandName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    <Building2 className="h-3 w-3" />
                    {brandName}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(GLASS, "h-[76px] animate-pulse p-4")}
                />
              ))
            ) : (
              <>
                <PreviewStat
                  label="Total Spend"
                  value={fmtCurrency(blendedTotals?.totalSpend ?? 0)}
                  icon={Wallet}
                  accent="bg-gradient-to-br from-orange-500 to-red-500"
                />
                <PreviewStat
                  label="Pixel conversion value"
                  value={fmtCurrency(blendedTotals?.totalConversionValue ?? 0)}
                  icon={Banknote}
                  accent="bg-gradient-to-br from-emerald-500 to-teal-500"
                />
                <PreviewStat
                  label="Pixel ROAS"
                  value={`${(blendedTotals?.blendedROAS ?? 0).toFixed(2)}x`}
                  icon={Percent}
                  accent="bg-gradient-to-br from-violet-500 to-fuchsia-500"
                />
                <PreviewStat
                  label="Pixel conversions"
                  value={fmtNumber(blendedTotals?.totalConversions ?? 0)}
                  icon={Target}
                  accent="bg-gradient-to-br from-blue-500 to-cyan-500"
                />
                <PreviewStat
                  label="Impressions"
                  value={fmtNumber(blendedTotals?.totalImpressions ?? 0)}
                  icon={Eye}
                  accent="bg-gradient-to-br from-indigo-500 to-blue-500"
                />
                <PreviewStat
                  label="Clicks"
                  value={fmtNumber(blendedTotals?.totalClicks ?? 0)}
                  icon={MousePointerClick}
                  accent="bg-gradient-to-br from-sky-500 to-indigo-500"
                />
                <PreviewStat
                  label="CTR"
                  value={`${(blendedTotals?.blendedCTR ?? 0).toFixed(2)}%`}
                  icon={Zap}
                  accent="bg-gradient-to-br from-amber-500 to-orange-500"
                />
                <PreviewStat
                  label="Avg CPC"
                  value={fmtCurrency(blendedTotals?.blendedCPC ?? 0)}
                  icon={Coins}
                  accent="bg-gradient-to-br from-rose-500 to-pink-500"
                />
                <PreviewStat
                  label="MER (till / spend)"
                  value={`${(merQuery.data?.data?.mer ?? 0).toFixed(2)}x`}
                  icon={Building2}
                  accent="bg-gradient-to-br from-teal-500 to-emerald-500"
                />
                <PreviewStat
                  label="Store orders"
                  value={fmtNumber(merQuery.data?.data?.orderCount ?? 0)}
                  icon={Layers}
                  accent="bg-gradient-to-br from-cyan-500 to-blue-500"
                />
                <PreviewStat
                  label="GA4 purchases"
                  value={fmtNumber(ga4Mix.data?.data?.totals.purchases ?? 0)}
                  icon={Sparkles}
                  accent="bg-gradient-to-br from-lime-500 to-emerald-500"
                />
              </>
            )}
          </div>

          {/* Error state */}
          {!loading && error && (
            <div className={cn(GLASS, "p-5")}>
              <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                <span className="text-sm text-rose-400">
                  Failed to load report data. Check your connection and adjust the
                  filters, then try again.
                </span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !hasData && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className={cn(GLASS, "p-5")}
            >
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Sparkles className="h-5 w-5 text-white/40" />
                </span>
                <p className="max-w-sm text-sm text-white/55">
                  No data for this selection yet — connect your ad accounts and run
                  a sync, or widen the date range.
                </p>
                <Link
                  href="/connections"
                  className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-950 transition-transform hover:scale-[1.02]"
                >
                  Connect your accounts
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* Account performance table */}
          {!loading && !error && hasData && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className={cn(GLASS, "overflow-hidden")}
            >
              <div className="flex items-center justify-between p-5 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Account Performance
                  </h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    Per ad account, filtered by your platform selection
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
                  {accounts.length} account{accounts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-white/5 text-[11px] uppercase tracking-widest text-white/35">
                      <th className="px-5 py-2.5 font-medium">Account</th>
                      <th className="px-5 py-2.5 font-medium">Platform</th>
                      <th className="px-5 py-2.5 text-right font-medium">Spend</th>
                      <th className="px-5 py-2.5 text-right font-medium">Pixel conversion value</th>
                      <th className="px-5 py-2.5 text-right font-medium">Pixel ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-sm text-white/40">
                          No accounts match the selected platforms in this period.
                        </td>
                      </tr>
                    ) : (
                      accounts.map((a) => (
                        <tr
                          key={`${a.platform}-${a.name}`}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-3 font-medium text-white">
                            {a.name}
                          </td>
                          <td className="px-5 py-3">
                            <PlatformChip platform={a.platform} />
                          </td>
                          <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                            {fmtCurrency(a.totalSpend)}
                          </td>
                          <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                            {fmtCurrency(a.totalConversionValue)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-white tabular-nums">
                            {a.roas.toFixed(2)}x
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Top campaigns table */}
          {!loading && !error && hasData && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.17, duration: 0.5 }}
              className={cn(GLASS, "overflow-hidden")}
            >
              <div className="flex items-center justify-between p-5 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Top Campaigns
                  </h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    Ranked by spend in this period
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
                  {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-white/5 text-[11px] uppercase tracking-widest text-white/35">
                      <th className="px-5 py-2.5 font-medium">Campaign</th>
                      <th className="px-5 py-2.5 font-medium">Platform</th>
                      <th className="px-5 py-2.5 text-right font-medium">Spend</th>
                      <th className="px-5 py-2.5 text-right font-medium">Pixel conversion value</th>
                      <th className="px-5 py-2.5 text-right font-medium">Pixel ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-6 text-center text-sm text-white/40">
                          No campaigns match the selected platforms in this period.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((c) => (
                        <tr
                          key={`${c.platform}-${c.campaignId}-${c.campaignName}`}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="max-w-[280px] truncate px-5 py-3 font-medium text-white">
                            {c.campaignName}
                          </td>
                          <td className="px-5 py-3">
                            <PlatformChip platform={c.platform} />
                          </td>
                          <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                            {fmtCurrency(c.totalSpend)}
                          </td>
                          <td className="px-5 py-3 text-right text-white/80 tabular-nums">
                            {fmtCurrency(c.totalConversionValue)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-white tabular-nums">
                            {c.roas.toFixed(2)}x
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {emailMetrics.data?.data &&
            (emailMetrics.data.data.connected || emailMetrics.data.data.totalSent > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className={cn(GLASS, "p-5")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">ESP email (not till, not pixel)</h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    Brevo / Omnisend campaigns API. Export includes this as a separate CSV/PDF section.
                    It is not added to spend or Pixel ROAS.
                  </p>
                </div>
                <Mail className="h-4 w-4 shrink-0 text-teal-300" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PreviewStat
                  label="Delivered"
                  value={fmtNumber(emailMetrics.data.data.totalSent)}
                  icon={Mail}
                  accent="bg-gradient-to-br from-teal-500 to-emerald-500"
                />
                <PreviewStat
                  label="Unique opens"
                  value={fmtNumber(emailMetrics.data.data.totalOpens)}
                  icon={Eye}
                  accent="bg-gradient-to-br from-cyan-500 to-teal-500"
                />
                <PreviewStat
                  label="Clicks"
                  value={fmtNumber(emailMetrics.data.data.totalClicks)}
                  icon={MousePointerClick}
                  accent="bg-gradient-to-br from-violet-500 to-fuchsia-500"
                />
                <PreviewStat
                  label="After Apple MPP"
                  value={
                    emailMetrics.data.data.extras?.present &&
                    emailMetrics.data.data.extras.appleMppOpens > 0
                      ? fmtNumber(
                          nonMppUniqueOpens(
                            emailMetrics.data.data.totalOpens,
                            emailMetrics.data.data.extras.appleMppOpens,
                          ),
                        )
                      : "—"
                  }
                  icon={Sparkles}
                  accent="bg-gradient-to-br from-amber-500 to-orange-500"
                />
              </div>
              <p className="mt-3 text-[11px] text-white/35">
                After Apple MPP is uniqueViews minus appleMppOpens — not proven human opens, and not Woo
                conversions. Woo last-click email stays on Attribution.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
