/**
 * Read-only bid desk suggestions. Nothing here writes a bid to Meta.
 */

import { looksLikeAdvantagePlusName } from "@/lib/dashboard-insights";

export type BidSuggestionTone = "amber" | "red" | "emerald";

export interface AdSetBidRow {
  adsetName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  frequency: number;
  cpc: number;
  conversions: number;
}

export function getAdSetBidSuggestion(
  adset: AdSetBidRow,
  accountAvgCpc: number,
): { label: string; tone: BidSuggestionTone; href: string } {
  const advantagePlus = looksLikeAdvantagePlusName(adset.adsetName);

  if (adset.frequency > 4) {
    return advantagePlus
      ? {
          label: "High frequency on Advantage+ — refresh creative, do not expand a lookalike",
          tone: "amber",
          href: "/creative-fatigue",
        }
      : {
          label: "High frequency — refresh creative or expand audience",
          tone: "amber",
          href: "/creative-fatigue",
        };
  }
  if (adset.ctr > 2 && adset.conversions === 0) {
    return {
      label: "Clicks without purchases — inspect offer and landing",
      tone: "amber",
      href: "/creative-fatigue",
    };
  }
  if (accountAvgCpc > 0 && adset.cpc > 1.2 * accountAvgCpc) {
    return {
      label: advantagePlus
        ? "CPC above account average — do not cut Advantage+ CBO blindly"
        : "CPC above account average — inspect bids in Ads Manager",
      tone: "red",
      href: "/creative-fatigue",
    };
  }
  if (adset.conversions > 0) {
    return advantagePlus
      ? {
          label: "Delivering — keep Advantage+ as control, add UGC/carousel sibling",
          tone: "emerald",
          href: "/creative-fatigue",
        }
      : {
          label: "Delivering — keep as control, add a UGC sibling",
          tone: "emerald",
          href: "/campaign-launcher",
        };
  }
  return { label: "Healthy — maintain", tone: "emerald", href: "/creative-fatigue" };
}
