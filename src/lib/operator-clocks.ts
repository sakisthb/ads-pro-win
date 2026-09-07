/**
 * CEO five-clock briefing and PM blocker board.
 * Pixel / till / GA4 / GSC / Brevo stay named and unmixed.
 */

import { formatMoney, type ReportingCurrency } from "@/lib/currency";
import { type TrackingWorkstreamId, trackingWorkstream } from "@/lib/tracking-ops";
import type { MarketMode } from "@/lib/market-desk";

export type OperatorClockId = "pixel" | "till" | "ga4" | "gsc" | "email";

export interface OperatorClock {
  id: OperatorClockId;
  label: string;
  href: string;
  connected: boolean;
  primary: string;
  secondary: string;
  not: string;
}

export type OperatorBlockerId = TrackingWorkstreamId | "email-quiet";

export interface OperatorBlocker {
  id: OperatorBlockerId;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  severity: "high" | "medium";
}

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Coerce Prisma/unknown totals so KPI tiles never freeze at €0 next to a live clock. */
export function asClockNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function deriveOperatorClocks(args: {
  pixelSpend: number;
  pixelConversions: number;
  pixelRoas: number;
  storeOrders: number;
  storeNet: number;
  ga4Connected: boolean;
  ga4Sessions: number;
  ga4Purchases: number;
  gscConnected: boolean;
  gscClicks: number;
  gscImpressions: number;
  emailConnected: boolean;
  emailDelivered: number;
  emailCampaigns: number;
  currency?: ReportingCurrency;
  marketMode?: MarketMode;
  retailOrders?: number;
  wholesaleOrders?: number;
}): OperatorClock[] {
  const currency = args.currency ?? "EUR";
  const money = (n: number) => formatMoney(n, currency);
  const pixelLive = args.pixelSpend > 0 || args.pixelConversions > 0;
  const tillLive = args.storeOrders > 0;
  const ga4Live = args.ga4Connected || args.ga4Sessions > 0 || args.ga4Purchases > 0;
  const emailQuiet = args.emailConnected && args.emailDelivered <= 0;
  const retailOrders = args.retailOrders ?? 0;
  const wholesaleOrders = args.wholesaleOrders ?? 0;
  const splitTill =
    (args.marketMode ?? "mixed") === "mixed" && retailOrders > 0 && wholesaleOrders > 0;

  return [
    {
      id: "pixel",
      label: "Pixel",
      href: "/campaigns",
      connected: pixelLive,
      primary: pixelLive ? money(args.pixelSpend) : "—",
      secondary: pixelLive
        ? `${fmtInt(args.pixelConversions)} conversions · ${args.pixelRoas.toFixed(2)}x ROAS`
        : "No paid-ad spend rows in this window",
      not: "not till · not GA4 · not email",
    },
    {
      id: "till",
      label: "Till",
      href: "/attribution",
      connected: tillLive,
      primary: tillLive ? money(args.storeNet) : "—",
      secondary: tillLive
        ? splitTill
          ? `${fmtInt(args.storeOrders)} paid Woo · ΛΙΑΝΙΚΗ ${fmtInt(retailOrders)} / χονδρική ${fmtInt(wholesaleOrders)}`
          : `${fmtInt(args.storeOrders)} paid Woo orders`
        : "No paid Woo orders in this window",
      not: "not Pixel ROAS · not GA4 purchases",
    },
    {
      id: "ga4",
      label: "GA4",
      href: "/seo",
      connected: ga4Live,
      primary: ga4Live ? fmtInt(args.ga4Sessions) : "—",
      secondary: ga4Live
        ? `${fmtInt(args.ga4Purchases)} ecommerce purchases · site clock`
        : "GA4 not connected on this shop",
      not: "not till · not Pixel ROAS",
    },
    {
      id: "gsc",
      label: "GSC",
      href: "/seo",
      connected: args.gscConnected,
      primary: args.gscConnected ? fmtInt(args.gscClicks) : "—",
      secondary: args.gscConnected
        ? `${fmtInt(args.gscImpressions)} impressions · €0 value · not Ads spend`
        : "Search Console not connected",
      not: "not Google Ads · not money",
    },
    {
      id: "email",
      label: "Email",
      href: "/email",
      connected: args.emailConnected,
      primary: args.emailConnected ? fmtInt(args.emailDelivered) : "—",
      secondary: emailQuiet
        ? "0 delivered in this window — not 0 influence"
        : args.emailConnected
          ? `${fmtInt(args.emailCampaigns)} sent campaigns · ESP delivered`
          : "Brevo / Omnisend not connected",
      not: "not Pixel ROAS · not till",
    },
  ];
}

export function deriveOperatorBlockers(args: {
  storeOrders: number;
  pixelConversions: number;
  googleAdsConnected: boolean;
  googleAdsSpend: number;
  emailConnected: boolean;
  emailDelivered: number;
  tax: number;
  ga4Sessions: number;
  ga4Purchases: number;
  ga4UnassignedSessions: number;
}): OperatorBlocker[] {
  const out: OperatorBlocker[] = [];
  const store = args.storeOrders;
  const pixel = args.pixelConversions;
  const ga4Purchases = args.ga4Purchases;
  const sessions = args.ga4Sessions;
  const unassigned = args.ga4UnassignedSessions;

  if (store >= 20 && pixel > 0 && store >= pixel * 1.5) {
    const capi = trackingWorkstream("capi-emq");
    out.push({
      id: "capi-emq",
      title: capi.title,
      detail: `${fmtInt(store)} till orders vs ${fmtInt(pixel)} pixel conversions. ${capi.gap}`,
      href: "/help#capi-emq",
      actionLabel: "Playbook",
      severity: "high",
    });
  }

  if (args.googleAdsConnected && args.googleAdsSpend <= 0) {
    const ads = trackingWorkstream("google-ads-api");
    out.push({
      id: "google-ads-api",
      title: ads.title,
      detail: "OAuth is on and DailyMetric google spend is €0. Woo last-click Google is till, not Ads spend.",
      href: "/connections?connect=google-ads",
      actionLabel: "Connections",
      severity: "high",
    });
  }

  if (store >= 20 && ga4Purchases > 0 && store >= ga4Purchases * 1.5) {
    const mp = trackingWorkstream("ga4-mp");
    out.push({
      id: "ga4-mp",
      title: mp.title,
      detail: `${fmtInt(store)} till orders vs ${fmtInt(ga4Purchases)} GA4 purchases. ${mp.gap}`,
      href: "/help#ga4-mp",
      actionLabel: "Playbook",
      severity: "high",
    });
  }

  if (store >= 20 && args.tax <= 0) {
    const vat = trackingWorkstream("woo-vat");
    out.push({
      id: "woo-vat",
      title: vat.title,
      detail: "Woo tax on these rows is €0, so Net ex VAT equals store net. Do not invent 24% ΦΠΑ here.",
      href: "/help#woo-vat",
      actionLabel: "Playbook",
      severity: "medium",
    });
  }

  if (sessions >= 500 && unassigned >= 200 && unassigned / sessions >= 0.08) {
    const ua = trackingWorkstream("ga4-unassigned");
    out.push({
      id: "ga4-unassigned",
      title: ua.title,
      detail: `Unassigned is ${fmtInt(unassigned)} sessions (${((unassigned / sessions) * 100).toFixed(0)}% of GA4). Do not bid on it.`,
      href: "/help#ga4-unassigned",
      actionLabel: "Playbook",
      severity: "medium",
    });
  }

  if (args.emailConnected && args.emailDelivered <= 0) {
    out.push({
      id: "email-quiet",
      title: "Email window is quiet",
      detail:
        "Brevo is connected and this range has 0 delivered. That is a quiet window, not 0 influence. Widen to 180 days on Email.",
      href: "/email",
      actionLabel: "Email desk",
      severity: "medium",
    });
  }

  return out;
}

export function buildOperatorDesk(input: {
  totals?: {
    totalSpend?: unknown;
    totalConversionValue?: unknown;
    totalConversions?: unknown;
    blendedROAS?: unknown;
  } | null;
  mer?: {
    totalSpend?: unknown;
    totalAttributedRevenue?: unknown;
    pixelConversions?: unknown;
    platformROAS?: unknown;
    orderCount?: unknown;
    totalRevenue?: unknown;
    tax?: unknown;
  } | null;
  ga4?: {
    connected?: boolean;
    totals?: { sessions?: unknown; purchases?: unknown };
    channels?: Array<{ channel: string; sessions?: unknown }>;
  } | null;
  gsc?: {
    connected?: boolean;
    totals?: { clicks?: unknown; impressions?: unknown };
  } | null;
  email?: {
    connected?: boolean;
    totalSent?: unknown;
    campaignCount?: unknown;
  } | null;
  googleAdsConnected: boolean;
  googleAdsSpend: unknown;
  currency?: ReportingCurrency;
}) {
  const pixelSpend = asClockNumber(input.totals?.totalSpend) || asClockNumber(input.mer?.totalSpend);
  const pixelValue =
    asClockNumber(input.totals?.totalConversionValue) || asClockNumber(input.mer?.totalAttributedRevenue);
  const pixelConversions =
    asClockNumber(input.totals?.totalConversions) || asClockNumber(input.mer?.pixelConversions);
  const pixelRoas =
    pixelSpend > 0
      ? pixelValue / pixelSpend
      : asClockNumber(input.totals?.blendedROAS) || asClockNumber(input.mer?.platformROAS);
  const ga4Sessions = asClockNumber(input.ga4?.totals?.sessions);
  const ga4Purchases = asClockNumber(input.ga4?.totals?.purchases);
  const clocks = deriveOperatorClocks({
    pixelSpend,
    pixelConversions,
    pixelRoas,
    storeOrders: asClockNumber(input.mer?.orderCount),
    storeNet: asClockNumber(input.mer?.totalRevenue),
    ga4Connected: Boolean(input.ga4?.connected) || ga4Sessions > 0,
    ga4Sessions,
    ga4Purchases,
    gscConnected: Boolean(input.gsc?.connected),
    gscClicks: asClockNumber(input.gsc?.totals?.clicks),
    gscImpressions: asClockNumber(input.gsc?.totals?.impressions),
    emailConnected: Boolean(input.email?.connected),
    emailDelivered: asClockNumber(input.email?.totalSent),
    emailCampaigns: asClockNumber(input.email?.campaignCount),
    currency: input.currency,
  });
  const blockers = deriveOperatorBlockers({
    storeOrders: asClockNumber(input.mer?.orderCount),
    pixelConversions,
    googleAdsConnected: input.googleAdsConnected,
    googleAdsSpend: asClockNumber(input.googleAdsSpend),
    emailConnected: Boolean(input.email?.connected),
    emailDelivered: asClockNumber(input.email?.totalSent),
    tax: asClockNumber(input.mer?.tax),
    ga4Sessions,
    ga4Purchases,
    ga4UnassignedSessions: asClockNumber(
      input.ga4?.channels?.find((c) => /unassigned/i.test(c.channel))?.sessions,
    ),
  });
  return { clocks, blockers, pixelSpend, pixelValue, pixelConversions, pixelRoas };
}

/** True once every clock query has settled. Disabled queries stay `isFetched: false`. */
export function operatorDeskReady(...queries: Array<{ isFetched: boolean }>): boolean {
  return queries.length > 0 && queries.every((q) => q.isFetched);
}
