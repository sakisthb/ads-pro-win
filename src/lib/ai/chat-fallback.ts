/**
 * Grounded Ask AI copy when no LLM key is set.
 * Pixel conversion value is not store MER — never label it as such.
 */

import { formatMoney, type ReportingCurrency } from "@/lib/currency";

export type ChatFallbackPlatform = {
  platform: string;
  spend: number;
  revenue: number;
  clicks: number;
  conversions: number;
};

export function looksLikeLookalikeQuestion(question: string): boolean {
  return /lookalike|1\s*%\s*vs\s*3\s*%|custom audience|seed (a )?purchaser/i.test(
    question,
  );
}

export function looksLikeBlendedRoasQuestion(question: string): boolean {
  return /blended\s*roas|one\s*roas|blend(ed)?\s+(roas|mer)|add(ing)?\s+the\s+(five\s+)?clocks/i.test(
    question,
  );
}

export function looksLikeAuctionIntelQuestion(question: string): boolean {
  return /auction\s+insight|impression\s+share|competitor\s+(overlap|auction|cpc)|industry\s+benchmark/i.test(
    question,
  );
}

export function buildGroundedChatReply(args: {
  question: string;
  currency: ReportingCurrency;
  platforms: ChatFallbackPlatform[];
  storeNet: number;
  orderCount: number;
  ga4Purchases?: number;
}): string {
  const spend = args.platforms.reduce((s, p) => s + p.spend, 0);
  const pixelRevenue = args.platforms.reduce((s, p) => s + p.revenue, 0);
  const pixelConversions = args.platforms.reduce((s, p) => s + p.conversions, 0);
  const pixelRoas = spend > 0 ? pixelRevenue / spend : 0;
  const ga4Purchases = args.ga4Purchases ?? 0;
  const money = (n: number) => formatMoney(n, args.currency);

  const lines = args.platforms
    .map((g) => {
      const roas = g.spend > 0 ? g.revenue / g.spend : 0;
      return `• **${g.platform}:** ${roas.toFixed(2)}x pixel ROAS · ${money(g.spend)} spend · ${g.clicks.toLocaleString("en-US")} clicks · ${g.conversions.toFixed(0)} conv · ${money(g.revenue)} conversion value`;
    })
    .join("\n");

  const merLine =
    args.orderCount > 0 && spend > 0
      ? `Store MER: **${(args.storeNet / spend).toFixed(2)}x** on ${args.orderCount} Woo orders (${money(args.storeNet)} net). MER is till / spend — not incremental Meta ROAS. Do not scale Advantage+ off MER.`
      : "Store MER is unavailable until Woo orders sync in this window.";

  const clocksLine =
    ga4Purchases > 0 || args.orderCount > 0
      ? `\n\nFive clocks: **${args.orderCount}** store orders · **${pixelConversions.toFixed(0)}** pixel conversions · **${ga4Purchases.toFixed(0)}** GA4 ecommerce purchases. Search Console and email stay their own clocks — not Ads spend, not Pixel ROAS. Do not add them. GA4 sessions are not ad clicks. Organic Search in GA4 is not Google Ads spend.`
      : "";

  const lookalike =
    looksLikeLookalikeQuestion(args.question)
      ? "\n\nLookalikes: if the funded campaign is Advantage+ / catalog, do not test a 1–3% lookalike off it. Keep the catalog as the control and ship a new format or fix offer vs landing on Creative Fatigue."
      : "";

  const blended =
    looksLikeBlendedRoasQuestion(args.question)
      ? "\n\nThere is no blended ROAS. Pixel ROAS is not till MER, not GA4 revenue, not GSC clicks, and not Brevo delivered. Do not add the five clocks."
      : "";

  const auction =
    looksLikeAuctionIntelQuestion(args.question)
      ? "\n\nAuction insights, impression share, and competitor overlap need Google Ads Basic Access. This desk will not invent them. Woo last-click Google is till, not Ads spend."
      : "";

  return `Last 30 days of **synced paid DailyMetric** for this workspace (not sample copy, not GA4 sessions).\n\nPixel ROAS: **${pixelRoas.toFixed(2)}x** on ${money(spend)} spend and ${money(pixelRevenue)} platform conversion value.\n${merLine}${clocksLine}\n\n${lines}\n\nYou asked: "${args.question.slice(0, 200)}"\n\nAdd an OpenAI or Anthropic key for a full briefing; these figures are from your database.${lookalike}${blended}${auction}`;
}
