"use client";

// ExportToolbar — compact CSV/PDF export actions for the dashboard header.
// Task #31 (F4 Export/Reports). Generation is fully client-side: CSV via the
// csv-generator helpers, PDF via a lazily-imported jsPDF bundle.

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { api } from "@/components/providers/trpc-provider";
import { useCurrency } from "@/components/providers/currency";
import { formatMoney } from "@/lib/currency";
import {
  generateCSV,
  generateMultiSectionCSV,
  downloadBlob,
  type CSVSection,
} from "@/lib/export/csv-generator";
import { buildEspEmailExportRows } from "@/lib/email-desk";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Router row shapes (mirrored locally — keep defensive/optional so the
// toolbar renders gracefully while queries are loading or empty).
// ---------------------------------------------------------------------------
interface BlendedTotals {
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  totalConversions?: number;
  totalConversionValue?: number;
  totalLinkClicks?: number;
  totalLandingPageViews?: number;
  blendedROAS?: number;
  blendedCPC?: number;
  blendedCPM?: number;
  blendedCTR?: number;
}

interface BlendedPerfData {
  startDate?: string;
  endDate?: string;
  totals?: BlendedTotals;
}

interface AccountRow {
  name: string;
  platform: string;
  totalSpend: number;
  totalConversionValue: number;
  roas: number;
}

interface CampaignRow {
  campaignName: string;
  platform: string;
  totalSpend: number;
  totalConversionValue: number;
  roas: number;
}

export interface ExportToolbarData {
  blendedPerf?: BlendedPerfData;
  accountSummary?: { accounts?: AccountRow[] };
  topCampaigns?: { campaigns?: CampaignRow[] };
  range: string;
  brandId?: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const fmtNumber = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Headline metrics rendered at the top of both export formats. */
function buildSummary(
  totals: BlendedTotals | undefined,
  fmtCurrency: (n: number) => string,
): { label: string; value: string }[] {
  const t = totals;
  return [
    { label: "Total Spend", value: fmtCurrency(t?.totalSpend ?? 0) },
    { label: "Total Revenue", value: fmtCurrency(t?.totalConversionValue ?? 0) },
    { label: "Pixel ROAS", value: `${(t?.blendedROAS ?? 0).toFixed(2)}x` },
    { label: "Impressions", value: fmtNumber(t?.totalImpressions ?? 0) },
    { label: "Clicks", value: fmtNumber(t?.totalClicks ?? 0) },
    { label: "Link clicks", value: fmtNumber(t?.totalLinkClicks ?? 0) },
    { label: "Landing page views", value: fmtNumber(t?.totalLandingPageViews ?? 0) },
    { label: "CTR", value: `${(t?.blendedCTR ?? 0).toFixed(2)}%` },
    { label: "Conversions", value: fmtNumber(t?.totalConversions ?? 0) },
    { label: "Avg CPC", value: fmtCurrency(t?.blendedCPC ?? 0) },
    { label: "CPM", value: fmtCurrency(t?.blendedCPM ?? 0) },
  ];
}

// ---------------------------------------------------------------------------
// ExportToolbar
// ---------------------------------------------------------------------------
export function ExportToolbar({ data }: { data: ExportToolbarData }) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const { currency } = useCurrency();
  const fmtCurrency = (n: number) =>
    formatMoney(n, currency, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  // Org name for the PDF header (cached by React Query — same key the org
  // switcher uses). Falls back silently when no org is active.
  const orgQuery = api.organizations.getCurrent.useQuery();
  const orgName = orgQuery.data?.name ?? "Ads Pro";
  const emailStart = data.blendedPerf?.startDate ?? "";
  const emailEnd = data.blendedPerf?.endDate ?? "";
  const emailQuery = api.emailCampaigns.getEmailMetrics.useQuery(
    {
      startDate: emailStart,
      endDate: emailEnd,
      platform: "all",
      brandId: data.brandId,
    },
    { enabled: Boolean(emailStart && emailEnd) },
  );
  const email = emailQuery.data?.data;

  const accounts = useMemo(
    () => data.accountSummary?.accounts ?? [],
    [data.accountSummary],
  );
  const campaigns = useMemo(
    () => data.topCampaigns?.campaigns ?? [],
    [data.topCampaigns],
  );

  const hasData =
    accounts.length > 0 ||
    campaigns.length > 0 ||
    (data.blendedPerf?.totals?.totalSpend ?? 0) > 0 ||
    (data.blendedPerf?.totals?.totalImpressions ?? 0) > 0;

  const rangeDays = data.range.replace("d", "");
  const dateRange =
    data.blendedPerf?.startDate && data.blendedPerf?.endDate
      ? `${fmtDate(data.blendedPerf.startDate)} – ${fmtDate(
          data.blendedPerf.endDate,
        )} (last ${rangeDays} days)`
      : `Last ${rangeDays} days`;

  const baseFilename = `ads-report-${data.range}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const handleExportCSV = () => {
    setBusy("csv");
    try {
      const sections: CSVSection[] = [
        {
          title: "Summary",
          headers: ["Metric", "Value"],
          rows: buildSummary(data.blendedPerf?.totals, fmtCurrency).map((s) => [
            s.label,
            s.value,
          ]),
        },
      ];

      if (accounts.length > 0) {
        sections.push({
          title: "Account Performance",
          headers: ["Account", "Platform", "Spend", "Pixel revenue", "Pixel ROAS"],
          rows: accounts.map((a) => [
            a.name,
            a.platform,
            round2(a.totalSpend),
            round2(a.totalConversionValue),
            round2(a.roas),
          ]),
        });
      }

      if (campaigns.length > 0) {
        sections.push({
          title: "Top Campaigns",
          headers: ["Campaign", "Platform", "Spend", "Pixel revenue", "Pixel ROAS"],
          rows: campaigns.map((c) => [
            c.campaignName,
            c.platform,
            round2(c.totalSpend),
            round2(c.totalConversionValue),
            round2(c.roas),
          ]),
        });
      }

      if (email?.connected) {
        sections.push({
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
        });
      }

      const blob =
        sections.length === 1
          ? generateCSV(sections[0].headers, sections[0].rows)
          : generateMultiSectionCSV(sections);
      downloadBlob(blob, `${baseFilename}.csv`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportPDF = async () => {
    setBusy("pdf");
    try {
      // Lazy import: keeps jsPDF out of the SSR bundle / initial payload.
      const { generatePDFReport } = await import(
        "@/lib/export/pdf-generator"
      );
      const blob = generatePDFReport({
        title: "Performance Report",
        dateRange,
        orgName,
        summary: buildSummary(data.blendedPerf?.totals, fmtCurrency),
        tableHeaders: ["Account", "Platform", "Spend", "Pixel revenue", "Pixel ROAS"],
        tableRows: accounts.map((a) => [
          a.name,
          a.platform,
          fmtCurrency(a.totalSpend),
          fmtCurrency(a.totalConversionValue),
          `${a.roas.toFixed(2)}x`,
        ]),
        sections: [
          ...(campaigns.length > 0
            ? [
                {
                  title: "Top Campaigns",
                  tableHeaders: [
                    "Campaign",
                    "Platform",
                    "Spend",
                    "Pixel revenue",
                    "Pixel ROAS",
                  ],
                  tableRows: campaigns.map((c) => [
                    c.campaignName,
                    c.platform,
                    fmtCurrency(c.totalSpend),
                    fmtCurrency(c.totalConversionValue),
                    `${c.roas.toFixed(2)}x`,
                  ]),
                },
              ]
            : []),
          ...(email?.connected
            ? [
                {
                  title: "ESP email (not till, not pixel)",
                  tableHeaders: ["Metric", "Value"],
                  tableRows: buildEspEmailExportRows({
                    delivered: email.totalSent,
                    uniqueOpens: email.totalOpens,
                    clicks: email.totalClicks,
                    extrasPresent: Boolean(email.extras?.present),
                    appleMppOpens: email.extras?.appleMppOpens ?? 0,
                    retailDelivered: email.desks?.retail?.delivered ?? 0,
                    wholesaleDelivered: email.desks?.wholesale?.delivered ?? 0,
                  }),
                },
              ]
            : []),
        ],
      });
      downloadBlob(blob, `${baseFilename}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  const buttonClass = (label: "csv" | "pdf") =>
    cn(
      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
      "text-white/70 hover:bg-white/10 hover:text-white",
      "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
      busy !== null && busy !== label && "opacity-50",
    );

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-xl",
      )}
      role="toolbar"
      aria-label="Export dashboard data"
    >
      <button
        type="button"
        onClick={handleExportCSV}
        disabled={!hasData || busy !== null}
        className={buttonClass("csv")}
        title={
          hasData
            ? "Download the current dashboard data as CSV"
            : "No data to export yet"
        }
      >
        {busy === "csv" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={!hasData || busy !== null}
        className={buttonClass("pdf")}
        title={
          hasData
            ? "Download a branded PDF report for this period"
            : "No data to export yet"
        }
      >
        {busy === "pdf" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        Export PDF
      </button>
    </div>
  );
}
