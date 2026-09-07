/**
 * Derive command-center widgets from org-scoped marketing data.
 * Never invent platform numbers — every insight cites the inputs it used.
 */

import { formatMoney, type ReportingCurrency } from "@/lib/currency";
import {
  missingPaidConnections,
  type WooChannel,
} from "@/lib/woo-channels";
import type { MarketMode } from "@/lib/market-desk";

export type InsightImpact = "high" | "medium";

export interface DerivedInsight {
  id: string;
  title: string;
  description: string;
  impact: InsightImpact;
  actionLabel: string;
  href: string;
}

export interface PlatformPerf {
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  ctr?: number;
}

export interface CampaignLike {
  name: string;
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks?: number;
  impressions?: number;
}

export interface FunnelStage {
  stage: string;
  value: number;
  rate: number;
  dropOff: number | null;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  href?: string;
}

export interface LiveStripMetrics {
  clicksToday: number;
  revenueToday: number;
  campaignsLive: number;
  avgCtr: number;
  clicksDelta: number;
  revenueDelta: number;
}

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** Advantage+ / ASC names — lookalikes are not the next operator move. */
export function looksLikeAdvantagePlusName(name: string | null | undefined): boolean {
  return /advantage\+|\basc\b/i.test(name ?? "");
}

export function deriveLiveStrip(args: {
  todayClicks: number;
  todayRevenue: number;
  periodClicks: number;
  periodRevenue: number;
  periodDays: number;
  campaignsLive: number;
  avgCtr: number;
}): LiveStripMetrics {
  const avgDailyClicks =
    args.periodDays > 0 ? args.periodClicks / args.periodDays : 0;
  const avgDailyRevenue =
    args.periodDays > 0 ? args.periodRevenue / args.periodDays : 0;
  return {
    clicksToday: args.todayClicks,
    revenueToday: args.todayRevenue,
    campaignsLive: args.campaignsLive,
    avgCtr: args.avgCtr,
    clicksDelta:
      avgDailyClicks > 0
        ? ((args.todayClicks - avgDailyClicks) / avgDailyClicks) * 100
        : 0,
    revenueDelta:
      avgDailyRevenue > 0
        ? ((args.todayRevenue - avgDailyRevenue) / avgDailyRevenue) * 100
        : 0,
  };
}

export function deriveInsights(
  platforms: PlatformPerf[],
  campaigns: CampaignLike[],
  totals: { ctr: number; conversions: number; spend: number } | null,
  currency: ReportingCurrency = "EUR",
): DerivedInsight[] {
  const insights: DerivedInsight[] = [];
  const funded = platforms.filter((p) => p.spend > 0);

  if (funded.length >= 2) {
    const ranked = [...funded].sort((a, b) => b.roas - a.roas);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best && worst && best.name !== worst.name && worst.roas > 0) {
      const lift = ((best.roas - worst.roas) / worst.roas) * 100;
      if (lift >= 8) {
        insights.push({
          id: "budget-shift",
          title: "Budget shift",
          description: `${best.name} pixel ROAS is ${best.roas.toFixed(2)}x vs ${worst.name} at ${worst.roas.toFixed(2)}x. Moving 15% of ${worst.name} spend toward ${best.name} is the highest-leverage reallocation in this window.`,
          impact: lift >= 20 ? "high" : "medium",
          actionLabel: "Apply",
          href: "/bidding",
        });
      }
    }
  }

  const withDelivery = campaigns.filter((c) => (c.impressions ?? 0) > 0);
  if (withDelivery.length >= 2 && totals && totals.ctr > 0) {
    const byCtr = [...withDelivery].sort((a, b) => {
      const ctrA = (a.impressions ?? 0) > 0 ? ((a.clicks ?? 0) / (a.impressions ?? 1)) * 100 : 0;
      const ctrB = (b.impressions ?? 0) > 0 ? ((b.clicks ?? 0) / (b.impressions ?? 1)) * 100 : 0;
      return ctrA - ctrB;
    });
    const weak = byCtr[0];
    if (weak) {
      const weakCtr =
        (weak.impressions ?? 0) > 0
          ? ((weak.clicks ?? 0) / (weak.impressions ?? 1)) * 100
          : 0;
      if (weakCtr < totals.ctr * 0.7) {
        insights.push({
          id: "creative-fatigue",
          title: "Creative fatigue",
          description: `"${weak.name}" CTR is ${weakCtr.toFixed(2)}% vs blended ${totals.ctr.toFixed(2)}%. Refresh the ad set before spend keeps leaking.`,
          impact: "medium",
          actionLabel: "See more",
          href: "/creative-fatigue",
        });
      }
    }
  }

  const profitable = campaigns.filter((c) => c.roas >= 3 && c.spend > 0);
  if (profitable.length > 0) {
    const top = [...profitable].sort((a, b) => b.roas - a.roas)[0];
    if (looksLikeAdvantagePlusName(top.name)) {
      insights.push({
        id: "advantage-plus-control",
        title: "Keep Advantage+ as the control",
        description: `"${top.name}" is at ${top.roas.toFixed(2)}x pixel ROAS. Lookalikes are not the next move on Advantage+. Keep this catalog as the control and ship a second format (UGC or carousel) or fix the offer vs landing.`,
        impact: "medium",
        actionLabel: "Creative fatigue",
        href: "/creative-fatigue",
      });
    } else {
      insights.push({
        id: "audience-expand",
        title: "Audience expansion",
        description: `"${top.name}" is at ${top.roas.toFixed(2)}x pixel ROAS. Test a 3% lookalike (or broader interest stack) off this winner instead of scaling the same 1% pool.`,
        impact: "medium",
        actionLabel: "Try",
        href: "/audiences",
      });
    }
  }

  if (insights.length === 0 && totals && totals.spend > 0) {
    insights.push({
      id: "ask-ai",
      title: "Ask AI for a plan",
      description: `This window has ${totals.conversions.toFixed(0)} conversions on ${formatMoney(totals.spend, currency)} spend. Open Ask AI for a budget, creative, and audience brief grounded in this org.`,
      impact: "medium",
      actionLabel: "Ask AI",
      href: "/chat",
    });
  }

  return insights.slice(0, 3);
}

/**
 * Insights that only exist once the till is synced. Pixel ROAS and store MER
 * are different numbers — never recommend scaling paid media off blended MER.
 */
export function deriveStoreInsights(args: {
  storeOrders: number;
  storeNet: number;
  pixelConversions: number;
  pixelRevenue: number;
  spend: number;
  mer: number;
  platformRoas: number;
  cogsKnown: boolean;
  grossProfit?: number;
  profitAfterAds?: number;
  amer?: number;
  newCustomerShare?: number;
  newCustomerNet?: number;
  channels: Array<{ channel: WooChannel; orders: number; netSales: number; share: number }>;
  connectedPlatforms: string[];
  currency?: ReportingCurrency;
  ga4Sessions?: number;
  ga4Purchases?: number;
  ga4UnassignedSessions?: number;
  ga4OrganicSearchSessions?: number;
  ga4OrganicSearchPurchases?: number;
  tax?: number;
  emailConnected?: boolean;
  emailDelivered?: number;
  /** Paid DailyMetric google spend. OAuth-connected with 0 is not Google Ads ROAS. */
  googleAdsSpend?: number;
  marketMode?: MarketMode;
  markets?: {
    retail: { orders: number; netSales: number };
    wholesale: { orders: number; netSales: number };
  };
}): DerivedInsight[] {
  const insights: DerivedInsight[] = [];
  const currency = args.currency ?? "EUR";
  const directShare =
    args.channels.find((c) => c.channel === "direct")?.share ?? 0;
  const metaPaid = args.channels.filter((c) => c.channel === "meta" || c.channel === "instagram");
  const metaStoreOrders = metaPaid.reduce((sum, row) => sum + row.orders, 0);
  const ga4Purchases = args.ga4Purchases ?? 0;
  const ga4Sessions = args.ga4Sessions ?? 0;
  const googleAdsConnected = args.connectedPlatforms.some((p) => p === "google");
  const googleAdsSpendLive = (args.googleAdsSpend ?? 0) > 0;

  if (
    args.storeOrders >= 20 &&
    args.pixelConversions > 0 &&
    args.storeOrders >= args.pixelConversions * 1.5
  ) {
    const ga4Bit =
      ga4Purchases > 0
        ? ` GA4 ecommerce purchases are ${ga4Purchases.toFixed(0)} — a third clock (site), not Pixel ROAS. Enhanced ecommerce closes GA4 vs till; CAPI closes pixel vs till.`
        : "";
    insights.push({
      id: "till-vs-pixel",
      title: "Till is ahead of the pixel",
      description: `The store recorded ${args.storeOrders.toFixed(0)} paid orders vs ${args.pixelConversions.toFixed(0)} pixel conversions.${ga4Bit} One CAPI stack (not two plugins). event_id = Woo order id on Pixel + CAPI. Hashed email/phone, unhashed fbp/fbc/IP/UA. Events Manager EMQ ≥ 6, aim 8+ on Purchase, dedup ≥90%.`,
      impact: "high",
      actionLabel: "Playbook",
      href: "/help",
    });
  }

  if (
    ga4Purchases > 0 &&
    args.storeOrders > 0 &&
    args.pixelConversions >= 0 &&
    (ga4Purchases !== args.storeOrders || ga4Purchases !== args.pixelConversions)
  ) {
    insights.push({
      id: "ga4-three-clocks",
      title: "Five clocks, not one ROAS",
      description: `GA4 ecommerce purchases ${ga4Purchases.toFixed(0)}, store orders ${args.storeOrders.toFixed(0)}, pixel conversions ${args.pixelConversions.toFixed(0)}. Site demand, till, and ads-claimed tickets. GSC and email are the other two clocks — not Ads spend, not Pixel ROAS. Do not add them. Close GA4 vs till with Measurement Protocol from woocommerce_payment_complete (transaction_id = order id) — thank-you JS is not enough.`,
      impact: "high",
      actionLabel: "Playbook",
      href: "/help",
    });
  }

  if (
    args.spend > 0 &&
    args.platformRoas > 0 &&
    args.mer >= args.platformRoas * 1.4 &&
    directShare >= 0.25
  ) {
    insights.push({
      id: "mer-not-causal",
      title: "Store MER is not Meta ROAS",
      description: `Store MER is ${args.mer.toFixed(1)}x while pixel ROAS is ${args.platformRoas.toFixed(1)}x. Direct is ${(directShare * 100).toFixed(0)}% of till — do not raise Advantage+ as if ${args.mer.toFixed(1)}x were incremental.`,
      impact: "high",
      actionLabel: "See mix",
      href: "/attribution",
    });
  }

  const retailTill = args.markets?.retail;
  const wholesaleTill = args.markets?.wholesale;
  if (
    (args.marketMode ?? "mixed") === "mixed" &&
    retailTill &&
    wholesaleTill &&
    retailTill.orders > 0 &&
    wholesaleTill.orders > 0
  ) {
    insights.push({
      id: "two-tills",
      title: "Retail and wholesale are two tills",
      description: `ΛΙΑΝΙΚΗ is ${retailTill.orders} orders (${formatMoney(retailTill.netSales, currency)}). χονδρική is ${wholesaleTill.orders} orders (${formatMoney(wholesaleTill.netSales, currency)}). Do not divide wholesale till by total Meta spend, and do not put unnamed Advantage+ into a desk MER.`,
      impact: "high",
      actionLabel: "Customers",
      href: "/customers",
    });
  }

  const emailTill = args.channels.find((c) => c.channel === "email");
  if (emailTill && emailTill.orders > 0) {
    insights.push({
      id: "email-till",
      title: "Email last-click is till, not ESP ROAS",
      description: `Woo last-click email is ${emailTill.orders} orders (${formatMoney(emailTill.netSales, currency)}). That is the till on Attribution — not Brevo delivered, not Pixel ROAS, and not email ROAS.`,
      impact: "medium",
      actionLabel: "Email desk",
      href: "/email",
    });
  }

  if (args.emailConnected && (args.emailDelivered ?? 0) <= 0) {
    insights.push({
      id: "email-quiet-window",
      title: "Email sends sit outside this window",
      description:
        "Brevo is connected and this range has 0 delivered campaigns. That is not 0 influence and not Pixel ROAS. Open Email desk (180 days) or widen the date picker.",
      impact: "medium",
      actionLabel: "Email desk",
      href: "/email",
    });
  }

  const googleTill = args.channels.find((c) => c.channel === "google");
  const organicSess = args.ga4OrganicSearchSessions ?? 0;
  const organicBuy = args.ga4OrganicSearchPurchases ?? 0;
  if (googleAdsConnected && !googleAdsSpendLive) {
    const tillBit =
      googleTill && googleTill.orders > 0
        ? ` Woo last-click Google is ${googleTill.orders} orders (${formatMoney(googleTill.netSales, currency)}) — till, not spend.`
        : "";
    const organicBit =
      organicSess > 0
        ? ` GA4 Organic Search is ${organicSess.toFixed(0)} sessions — site demand, not Google Ads.`
        : "";
    insights.push({
      id: "google-ads-no-spend",
      title: "Google Ads is connected, spend is empty",
      description: `OAuth is on and this window has €0 Google Ads DailyMetric.${tillBit}${organicBit} Pixel ROAS stays Meta-only until Sync Now writes google rows. If Connections says the developer token is test-only, apply for Basic Access in Ads API Center.`,
      impact: "high",
      actionLabel: "Connections",
      href: "/connections?connect=google-ads",
    });
  }

  const amer = args.amer ?? 0;
  const newShare = args.newCustomerShare ?? 0;
  if (args.spend > 0 && amer > 0 && args.mer >= amer * 1.25 && newShare > 0 && newShare < 0.75) {
    insights.push({
      id: "amer-vs-mer",
      title: "aMER is the acquisition read",
      description: `Store MER is ${args.mer.toFixed(1)}x; aMER (new-customer net / spend) is ${amer.toFixed(1)}x. ${(newShare * 100).toFixed(0)}% of till is first orders (${formatMoney(args.newCustomerNet ?? 0, currency)}). Repeats can inflate MER — do not scale Advantage+ off ${args.mer.toFixed(1)}x.`,
      impact: "high",
      actionLabel: "Attribution",
      href: "/attribution",
    });
  }

  if (!args.cogsKnown && args.storeNet > 0 && args.spend > 0) {
    insights.push({
      id: "cogs-unknown",
      title: "Store − ads is not profit",
      description: `Net sales minus spend is contribution. Cost of goods is still 0 on the catalog, so do not treat ${formatMoney(args.storeNet - args.spend, currency)} as gross profit.`,
      impact: "medium",
      actionLabel: "Customers",
      href: "/customers",
    });
  } else if (
    args.cogsKnown &&
    args.storeNet > 0 &&
    (args.grossProfit ?? 0) > 0
  ) {
    const gp = args.grossProfit ?? 0;
    const marginPct = (gp / args.storeNet) * 100;
    const afterAds = args.profitAfterAds ?? gp - args.spend;
    insights.push({
      id: "thin-margin",
      title: "Catalog margin is not MER",
      description: `Gross profit is ${formatMoney(gp, currency)} on ${formatMoney(args.storeNet, currency)} net (${marginPct.toFixed(0)}% margin). Profit after ads is ${formatMoney(afterAds, currency)} — leftover after COGS and spend, not a reason to scale Advantage+ off ${args.mer.toFixed(1)}x MER.`,
      impact: marginPct < 25 ? "high" : "medium",
      actionLabel: "Customers",
      href: "/customers",
    });
  }

  for (const gap of missingPaidConnections({
    channels: args.channels,
    connectedPlatforms: args.connectedPlatforms,
  })) {
    if (gap.channel === "bing") {
      insights.push({
        id: "connect-bing",
        title: "Microsoft Ads is not wired",
        description: `Woo last-click already has ${gap.orders} Bing orders (${formatMoney(gap.netSales, currency)}). Ads Pro cannot pull Microsoft spend yet — treat those as till tags, not as a connected ad account.`,
        impact: "high",
        actionLabel: "Attribution",
        href: "/attribution",
      });
      continue;
    }
    const name = gap.channel === "google" ? "Google Ads" : "Meta";
    insights.push({
      id: `connect-${gap.channel}`,
      title: `Connect ${name}`,
      description: `Woo last-click already has ${gap.orders} orders (${formatMoney(gap.netSales, currency)}) on ${name.replace(" Ads", "")}. Spend is missing, so MER is incomplete.`,
      impact: "high",
      actionLabel: "Connections",
      href: gap.href,
    });
  }

  if (metaStoreOrders >= 20 && args.pixelConversions > 0 && metaStoreOrders > args.pixelConversions) {
    insights.push({
      id: "meta-last-click",
      title: "Meta last-click vs pixel",
      description: `Woo attributes ${metaStoreOrders} orders to Facebook/Instagram last-click vs ${args.pixelConversions.toFixed(0)} pixel conversions. Use both; they measure different things.`,
      impact: "medium",
      actionLabel: "Attribution",
      href: "/attribution",
    });
  }

  const unassigned = args.ga4UnassignedSessions ?? 0;
  if (ga4Sessions >= 500 && unassigned >= 200 && unassigned / ga4Sessions >= 0.08) {
    insights.push({
      id: "ga4-unassigned",
      title: "GA4 Unassigned is a tagging hole",
      description: `Unassigned is ${unassigned.toFixed(0)} sessions (${((unassigned / ga4Sessions) * 100).toFixed(0)}% of GA4). Missing source/medium — stripped UTMs, payment redirects, consent pings, or MP hits without session_id. Do not bid on it.`,
      impact: "medium",
      actionLabel: "Playbook",
      href: "/help",
    });
  }

  const organicSessLate = args.ga4OrganicSearchSessions ?? 0;
  const organicBuyLate = args.ga4OrganicSearchPurchases ?? 0;
  if (!googleAdsConnected && (organicSessLate >= 500 || organicBuyLate >= 10)) {
    insights.push({
      id: "ga4-organic-not-ads",
      title: "Organic Search is not Google Ads",
      description: `GA4 Organic Search is ${organicSessLate.toFixed(0)} sessions / ${organicBuyLate.toFixed(0)} ecommerce purchases. Woo last-click Google is a UTM tag. Neither number is Google Ads spend until that account is connected.`,
      impact: "medium",
      actionLabel: "Connections",
      href: "/connections?connect=google-ads",
    });
  }

  if (args.tax === 0 && args.storeOrders >= 20 && args.storeNet > 0) {
    insights.push({
      id: "woo-tax-zero",
      title: "Woo tax is 0 — net ex VAT equals till",
      description: `REST total_tax/cart_tax is €0 on ${args.storeOrders.toFixed(0)} orders. Enable WooCommerce taxes (GR 24% if that is the catalog) and re-sync. Ads Pro will not invent ΦΠΑ.`,
      impact: "medium",
      actionLabel: "Playbook",
      href: "/help",
    });
  }

  return insights.slice(0, 9);
}

/**
 * Funnel-specific next actions. Never recommends a TOFU/BOFU budget split
 * when there is only one campaign — that would invent a funnel we do not have.
 */
export function deriveFunnelActions(args: {
  ctr: number;
  cvr: number;
  spend: number;
  conversions: number;
  campaignCount: number;
  bestCampaign?: { name: string; roas: number; cvr: number };
  currency?: ReportingCurrency;
  clicks?: number;
  landingPageViews?: number;
}): DerivedInsight[] {
  const insights: DerivedInsight[] = [];
  const { ctr, cvr, spend, conversions, campaignCount, bestCampaign } = args;

  if (spend > 0 && ctr >= 2 && cvr < 2) {
    insights.push({
      id: "landing-cvr",
      title: "Clicks are cheap — purchases are not",
      description: `CTR is ${ctr.toFixed(2)}% but only ${cvr.toFixed(2)}% of clicks convert. Check the offer, landing match, and purchase event before adding more spend.`,
      impact: "high",
      actionLabel: "Creative fatigue",
      href: "/creative-fatigue",
    });
  } else if (spend > 0 && ctr > 0 && ctr < 1) {
    insights.push({
      id: "weak-ctr",
      title: "Impression-to-click is the leak",
      description: `CTR is ${ctr.toFixed(2)}%. Refresh the creative (or the first three seconds of video) before touching budget.`,
      impact: "high",
      actionLabel: "Creative fatigue",
      href: "/creative-fatigue",
    });
  }

  const clicks = args.clicks ?? 0;
  const landing = args.landingPageViews ?? 0;
  if (clicks > 20 && landing > 0 && landing < clicks * 0.5) {
    insights.push({
      id: "pixel-gap",
      title: "Clicks are not becoming landing views",
      description: `Meta recorded ${landing.toFixed(0)} landing page views vs ${clicks.toFixed(0)} clicks. That is a pixel or destination gap — not a TOFU/BOFU budget problem.`,
      impact: "high",
      actionLabel: "Connections",
      href: "/connections",
    });
  }

  if (bestCampaign && bestCampaign.roas >= 3) {
    const advantagePlus = looksLikeAdvantagePlusName(bestCampaign.name);
    const single = campaignCount <= 1;
    if (advantagePlus) {
      insights.push({
        id: "scale-winner",
        title: "Winner is the whole funnel",
        description: `"${bestCampaign.name}" is ${bestCampaign.roas.toFixed(2)}x — there is no separate TOFU budget to steal from. Keep this Advantage+ campaign as the control. Ship a new format or fix the offer vs landing — do not test a lookalike off a catalog Meta already optimizes.`,
        impact: "medium",
        actionLabel: "Creative fatigue",
        href: "/creative-fatigue",
      });
    } else {
      insights.push({
        id: "scale-winner",
        title: single ? "Winner is the whole funnel" : "Scale the converting campaign",
        description: single
          ? `"${bestCampaign.name}" is ${bestCampaign.roas.toFixed(2)}x — there is no separate TOFU budget to steal from. Test a broader audience off this winner, or a new creative in the same campaign.`
          : `"${bestCampaign.name}" converts at ${bestCampaign.cvr.toFixed(2)}% of clicks and ${bestCampaign.roas.toFixed(2)}x pixel ROAS. Shift prospecting toward this pattern rather than inventing a new funnel stage.`,
        impact: "medium",
        actionLabel: "Audiences",
        href: "/audiences",
      });
    }
  }

  if (insights.length === 0 && spend > 0) {
    insights.push({
      id: "ask-ai-funnel",
      title: "Ask AI about this path",
      description: `${conversions.toFixed(0)} purchases on ${formatMoney(spend, args.currency)} spend. Ask AI for a CTR vs conversion brief grounded in this window.`,
      impact: "medium",
      actionLabel: "Ask AI",
      href: "/chat",
    });
  }

  return insights.slice(0, 3);
}

export type PixelFunnelKey = "landing" | "atc" | "checkout";

/** Extra Meta pixel stages. Omit zeros — we do not invent a site journey. */
export function selectPixelFunnelStages(events: {
  landingPageViews?: number;
  addToCart?: number;
  checkouts?: number;
}): Array<{ key: PixelFunnelKey; volume: number }> {
  const stages: Array<{ key: PixelFunnelKey; volume: number }> = [];
  const landing = events.landingPageViews ?? 0;
  const atc = events.addToCart ?? 0;
  const checkout = events.checkouts ?? 0;
  if (landing > 0) stages.push({ key: "landing", volume: landing });
  if (atc > 0) stages.push({ key: "atc", volume: atc });
  if (checkout > 0) stages.push({ key: "checkout", volume: checkout });
  return stages;
}

export function deriveFunnel(args: {
  impressions: number;
  clicks: number;
  conversions: number;
}): FunnelStage[] {
  const { impressions, clicks, conversions } = args;
  const stages = [
    { stage: "Awareness", value: impressions },
    { stage: "Interest", value: clicks },
    { stage: "Pixel purchase", value: conversions },
  ];
  return stages.map((s, i) => {
    const prev = i === 0 ? s.value : stages[i - 1].value;
    const next = stages[i + 1];
    return {
      stage: s.stage,
      value: s.value,
      rate: impressions > 0 ? (s.value / impressions) * 100 : 0,
      dropOff:
        next && prev > 0 ? (1 - next.value / prev) * 100 : null,
    };
  });
}

export function weekdayPattern(
  timeseries: Array<{ date: string; conversions: number; impressions: number }>,
): Array<{ label: string; conversions: number; impressions: number }> {
  const buckets = new Map<
    string,
    { conversions: number; impressions: number }
  >();
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const row of timeseries) {
    const d = new Date(`${row.date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) continue;
    const label = names[d.getUTCDay()] ?? "—";
    const prev = buckets.get(label) ?? { conversions: 0, impressions: 0 };
    buckets.set(label, {
      conversions: prev.conversions + row.conversions,
      impressions: prev.impressions + row.impressions,
    });
  }
  return names.map((label) => ({
    label,
    conversions: buckets.get(label)?.conversions ?? 0,
    impressions: buckets.get(label)?.impressions ?? 0,
  }));
}

export function deriveActivity(args: {
  campaigns: CampaignLike[];
  syncEvents: Array<{
    platform: string;
    status: string | null;
    at: Date | string | null;
    records?: number | null;
    accountName?: string;
  }>;
  currency?: ReportingCurrency;
}): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const job of args.syncEvents.slice(0, 4)) {
    const when = job.at ? formatRelative(job.at) : "recently";
    const status = (job.status ?? "completed").toLowerCase();
    items.push({
      id: `sync-${job.platform}-${when}`,
      title: `${capitalize(job.platform)} sync ${status}`,
      detail: [
        job.accountName,
        job.records != null ? `${job.records} rows` : null,
        when,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/connections",
    });
  }

  for (const c of args.campaigns.slice(0, 4)) {
    items.push({
      id: `camp-${c.name}`,
      title: c.name,
      detail: `${capitalize(c.platform)} · ${formatMoney(c.spend, args.currency)} spend · ${c.roas.toFixed(2)}x pixel ROAS`,
      href: "/campaigns",
    });
  }

  return items.slice(0, 6);
}

export function syncHealth(args: {
  accounts: Array<{ lastSyncAt: Date | string | null; isActive?: boolean }>;
}): { pct: number; label: string } {
  const active = args.accounts.filter((a) => a.isActive !== false);
  const pool = active.length ? active : args.accounts;
  if (pool.length === 0) return { pct: 0, label: "No ad accounts yet" };
  const synced = pool.filter((a) => a.lastSyncAt).length;
  const pct = Math.round((synced / pool.length) * 100);
  return {
    pct,
    label:
      pct === 100
        ? "All connected accounts have synced"
        : `${synced} of ${pool.length} accounts synced`,
  };
}

function formatRelative(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "recently";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type PixelLeakRow = {
  reason: string;
  share: number;
  color: string;
};

const LEAK_LABEL: Record<string, string> = {
  impressions: "Did not click",
  clicks: "Clicks without the next pixel",
  landing: "Viewed, no add-to-cart",
  atc: "Cart without checkout",
  checkout: "Checkout without purchase",
  purchases: "Purchases",
};

const LEAK_COLORS = ["#EF4444", "#F97316", "#F59E0B", "#EAB308", "#22D3EE", "#94A3B8"];

/** Share of drop-off between consecutive pixel/ad stages. Overflow (view-through) is skipped. */
export function buildPixelLeakage(
  stages: Array<{ key: string; name: string; dropped: number; overflow: boolean }>,
): PixelLeakRow[] {
  const drops = stages.filter((s) => s.dropped > 0 && !s.overflow);
  const total = drops.reduce((sum, row) => sum + row.dropped, 0);
  if (total <= 0) return [];
  return drops
    .map((row, i) => ({
      reason: LEAK_LABEL[row.key] ?? `${row.name} drop-off`,
      share: Math.round((row.dropped / total) * 100),
      color: LEAK_COLORS[i % LEAK_COLORS.length],
    }))
    .filter((row) => row.share > 0);
}

export function buildAudienceOperatorRecs(args: {
  countries: Array<{ label: string; spend: number }>;
  ages: Array<{ label: string; spend: number }>;
  frequencyReach: Array<{ bucket: string; reach: number }>;
  wooConnected?: boolean;
}): DerivedInsight[] {
  const recs: DerivedInsight[] = [];
  const countrySpend = args.countries.reduce((s, c) => s + c.spend, 0);
  const top = args.countries[0];
  if (top && countrySpend > 0 && top.spend / countrySpend >= 0.7) {
    recs.push({
      id: "geo-concentrate",
      title: `Spend is concentrated in ${top.label}`,
      description: `${Math.round((top.spend / countrySpend) * 100)}% of Meta spend is this country. Exclude overlap in Ads Manager — this desk does not write audiences.`,
      impact: "medium",
      actionLabel: "Ads Manager note",
      href: "/creative-fatigue",
    });
  }

  const ageSpend = args.ages.reduce((s, a) => s + a.spend, 0);
  const topAge = args.ages[0];
  if (topAge && ageSpend > 0 && topAge.spend / ageSpend >= 0.55) {
    recs.push({
      id: "age-concentrate",
      title: `Age ${topAge.label} takes most spend`,
      description: `${Math.round((topAge.spend / ageSpend) * 100)}% of spend. Tighten or exclude in Ads Manager after you confirm Creative Fatigue is not the leak.`,
      impact: "medium",
      actionLabel: "Creative Fatigue",
      href: "/creative-fatigue",
    });
  }

  const totalReach = args.frequencyReach.reduce((s, b) => s + b.reach, 0);
  const highReach = args.frequencyReach
    .filter((b) => {
      const start = parseInt(/^(\d+)/.exec(b.bucket)?.[1] ?? "0", 10);
      return start >= 7;
    })
    .reduce((s, b) => s + b.reach, 0);
  if (totalReach > 0 && highReach / totalReach >= 0.25) {
    recs.push({
      id: "high-frequency",
      title: "Frequency is stacking",
      description: `${Math.round((highReach / totalReach) * 100)}% of reach is in 7+ frequency buckets. Refresh creative before excluding people.`,
      impact: "high",
      actionLabel: "Creative Fatigue",
      href: "/creative-fatigue",
    });
  }

  recs.push({
    id: args.wooConnected ? "lookalike-ads-manager" : "woo-seed",
    title: args.wooConnected
      ? "Purchaser lookalike lives in Ads Manager"
      : "Woo purchaser seed is missing",
    description: args.wooConnected
      ? "Export or sync purchaser emails into a Meta custom audience in Ads Manager. This workspace does not create lookalikes silently."
      : "Connect WooCommerce and sync orders to seed a purchaser audience. Do not invent a lookalike here.",
    impact: "medium",
    actionLabel: args.wooConnected ? "Customers" : "Connect Woo",
    href: args.wooConnected ? "/customers" : "/connections?connect=woocommerce",
  });

  return recs.slice(0, 4);
}

export function buildAttributionHonestyRecs(args: {
  platforms: string[];
  orderCount: number;
  pixelConversions: number;
  mer: number;
  amer?: number;
  ga4Purchases?: number;
  emailOrders?: number;
  emailNet?: number;
  currency?: ReportingCurrency;
}): DerivedInsight[] {
  const recs: DerivedInsight[] = [];
  const platforms = [...new Set(args.platforms.map((p) => p.toLowerCase()))];
  if (platforms.length <= 1) {
    recs.push({
      id: "need-mix",
      title: "Only one paid channel is connected",
      description:
        "Last-click mix and MER still work. Multi-touch journeys need Google or TikTok plus path data we do not store. Connect another platform — do not treat the model picker as credit.",
      impact: "high",
      actionLabel: "Connections",
      href: "/connections",
    });
  }
  if (args.orderCount === 0) {
    recs.push({
      id: "need-woo",
      title: "Till is empty",
      description:
        "Pixel conversions without Woo orders cannot produce MER or last-click mix. Connect WooCommerce, then Sync Now.",
      impact: "high",
      actionLabel: "Connect Woo",
      href: "/connections?connect=woocommerce",
    });
  }
  if ((args.amer ?? 0) > 0 && args.mer > 0) {
    recs.push({
      id: "amer-read",
      title: "aMER sits next to MER — they are not interchangeable",
      description: `Store MER is ${args.mer.toFixed(2)}x; aMER (new-customer net / spend) is ${args.amer!.toFixed(2)}x. Channel GP and refunds are last-click, not incremental.`,
      impact: "high",
      actionLabel: "Customers",
      href: "/customers",
    });
  }
  if ((args.ga4Purchases ?? 0) > 0 && args.orderCount > 0) {
    recs.push({
      id: "three-clocks",
      title: "GA4 purchases are not pixel conversions",
      description: `GA4 ecommerce purchases ${args.ga4Purchases!.toFixed(0)}, store orders ${args.orderCount.toFixed(0)}, pixel ${args.pixelConversions.toFixed(0)}. Site demand, till, and ads-claimed tickets. Do not add them into one ROAS.`,
      impact: "high",
      actionLabel: "Playbook",
      href: "/help",
    });
  }
  if ((args.emailOrders ?? 0) > 0) {
    recs.push({
      id: "email-till",
      title: "Email last-click is till, not Brevo ROAS",
      description: `Woo last-click email is ${args.emailOrders} orders${
        typeof args.emailNet === "number" ? ` (${formatMoney(args.emailNet, args.currency ?? "EUR")})` : ""
      }. Open the Email desk for ESP delivered/opens. Do not add those orders into Pixel ROAS.`,
      impact: "medium",
      actionLabel: "Email desk",
      href: "/email",
    });
  }
  recs.push({
    id: "offer-leak",
    title: "Offer / landing mismatch is not an attribution model",
    description:
      "If ads claim a sale the homepage does not show, credit will look wrong even on last-click. Inspect Creative Fatigue before reallocating budget.",
    impact: "high",
    actionLabel: "Creative Fatigue",
    href: "/creative-fatigue",
  });
  recs.push({
    id: "no-mta",
    title: "Journeys need path data we do not store",
    description: `MER is ${args.mer.toFixed(2)}x and the pixel recorded ${args.pixelConversions.toFixed(0)} purchases. First-touch / linear / data-driven tabs do not change these numbers. Pixel vs till is a CAPI / EMQ job in Events Manager.`,
    impact: "medium",
    actionLabel: "Help",
    href: "/help",
  });
  return recs.slice(0, 6);
}

export function buildMissingPlatformRecs(
  connectedPlatforms: string[],
  spendByPlatform?: Partial<Record<"google" | "tiktok", number>>,
): DerivedInsight[] {
  const connected = new Set(connectedPlatforms.map((p) => p.toLowerCase()));
  const recs: DerivedInsight[] = [];
  for (const platform of ["google", "tiktok"] as const) {
    const spend = spendByPlatform?.[platform];
    const spendKnown = spendByPlatform != null && spend !== undefined;
    const spendLive = (spend ?? 0) > 0;
    if (platform === "google" && connected.has("google") && spendKnown && !spendLive) {
      recs.push({
        id: "google-ads-no-spend",
        title: "Google Ads has no spend rows",
        description:
          "OAuth is connected and DailyMetric google is €0. Woo last-click Google is till. Pixel ROAS stays Meta-only until Sync Now writes rows. A test-only developer token needs Basic Access in Ads API Center.",
        impact: "high",
        actionLabel: "Connections",
        href: "/connections?connect=google-ads",
      });
      continue;
    }
    if (connected.has(platform) && (!spendKnown || spendLive)) continue;
    recs.push({
      id: `connect-${platform}`,
      title: platform === "google" ? "Google Ads is not connected" : "TikTok Ads is not connected",
      description:
        "Cross-platform correlation needs two paid channels with daily conversions. Connect OAuth from Connections — this desk will not invent a matrix.",
      impact: "medium",
      actionLabel: "Connect",
      href: platform === "google" ? "/connections?connect=google-ads" : `/connections?connect=${platform}`,
    });
  }
  const googleFunded = connected.has("google") && (spendByPlatform?.google ?? 0) > 0;
  const tiktokFunded = connected.has("tiktok") && (spendByPlatform?.tiktok ?? 0) > 0;
  const twoFunded =
    spendByPlatform != null
      ? googleFunded && tiktokFunded
      : recs.length === 0 && connected.size >= 2;
  if (recs.length === 0 && twoFunded) {
    recs.push({
      id: "mix-live",
      title: "Head-to-head is live for connected accounts",
      description: "Pearson correlation still needs aligned daily conversion series across channels — not shown until those series exist.",
      impact: "medium",
      actionLabel: "Reports",
      href: "/reports",
    });
  }
  return recs;
}

export { fmtPct };
