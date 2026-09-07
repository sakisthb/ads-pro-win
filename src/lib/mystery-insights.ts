/**
 * Playful Mystery AI readings grounded in synced campaign metrics.
 * Messages always cite the numbers they used — never invent ROAS or spend.
 */

import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatMoneyExact,
  type ReportingCurrency,
} from "@/lib/currency";
import { looksLikeAdvantagePlusName } from "@/lib/dashboard-insights";

export type MysteryMode = "fortune" | "tarot" | "crystal" | "creative" | "spy";

export interface MysteryCampaign {
  name: string;
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface MysteryCard {
  name: string;
  meaning: string;
}

export interface MysteryReading {
  mode: MysteryMode;
  title: string;
  message: string;
  cited: string;
  tone: "success" | "warning" | "danger" | "info";
  cards?: MysteryCard[];
}

export function aggregateCampaigns(campaigns: MysteryCampaign[]): MysteryCampaign {
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const revenue = campaigns.reduce((a, c) => a + c.revenue, 0);
  const clicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const impressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const conversions = campaigns.reduce((a, c) => a + c.conversions, 0);
  return {
    name: "All campaigns",
    platform: "blended",
    spend,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    clicks,
    impressions,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
  };
}

export function resolveSubject(
  campaigns: MysteryCampaign[],
  selectedName: string,
): MysteryCampaign | null {
  if (campaigns.length === 0) return null;
  if (selectedName === "all") return aggregateCampaigns(campaigns);
  return campaigns.find((c) => c.name === selectedName) ?? aggregateCampaigns(campaigns);
}

function citedLine(c: MysteryCampaign, currency: ReportingCurrency = DEFAULT_CURRENCY): string {
  const roas = c.roas.toFixed(2);
  const ctr = c.ctr.toFixed(2);
  const spend = formatMoney(c.spend, currency, { maximumFractionDigits: 0 });
  return `${c.name} · ${spend} spend · ${roas}x pixel ROAS · ${ctr}% CTR · ${c.conversions.toFixed(0)} pixel conv`;
}

function fortuneFor(c: MysteryCampaign, currency: ReportingCurrency = DEFAULT_CURRENCY): MysteryReading {
  if (c.spend <= 0) {
    return {
      mode: "fortune",
      title: "Quiet ledger",
      message: `${c.name} has no spend in this window, so there is nothing to scale or pause.`,
      cited: citedLine(c, currency),
      tone: "info",
    };
  }
  if (c.roas >= 4) {
    const advantagePlus = looksLikeAdvantagePlusName(c.name);
    return {
      mode: "fortune",
      title: advantagePlus ? "Keep the catalog" : "Scale the winner",
      message: advantagePlus
        ? `${c.name} is returning ${c.roas.toFixed(2)}x. Keep this Advantage+ catalog as the control. Do not pause it for a lookalike test — ship a new format or fix the offer vs landing.`
        : `${c.name} is returning ${c.roas.toFixed(2)}x. Protect budget here before spreading it into weaker rows.`,
      cited: citedLine(c, currency),
      tone: "success",
    };
  }
  if (c.roas >= 2) {
    return {
      mode: "fortune",
      title: "Hold and tighten",
      message: `${c.name} is profitable at ${c.roas.toFixed(2)}x. Trim waste on high CPC before adding spend.`,
      cited: citedLine(c, currency),
      tone: "info",
    };
  }
  if (c.conversions <= 0) {
    return {
      mode: "fortune",
      title: "Spend without proof",
      message: `${c.name} spent without pixel conversions in this window. Pause or rebuild the offer before adding budget.`,
      cited: citedLine(c, currency),
      tone: "danger",
    };
  }
  return {
    mode: "fortune",
    title: "Below break-even",
    message: `${c.name} is at ${c.roas.toFixed(2)}x. Cut the weakest ad sets or move budget to a higher-ROAS campaign.`,
    cited: citedLine(c, currency),
    tone: "warning",
  };
}

function tarotFor(c: MysteryCampaign, currency: ReportingCurrency = DEFAULT_CURRENCY): MysteryReading {
  const cards: MysteryCard[] = [];
  if (c.roas >= 3) {
    cards.push({ name: "The Sun", meaning: `ROAS ${c.roas.toFixed(2)}x — keep this row funded` });
  } else if (c.roas < 1 && c.spend > 0) {
    cards.push({ name: "The Tower", meaning: `ROAS ${c.roas.toFixed(2)}x on paid spend — structure is breaking` });
  } else {
    cards.push({ name: "Temperance", meaning: `ROAS ${c.roas.toFixed(2)}x — mixed, not a crisis` });
  }

  if (c.ctr >= 2) {
    cards.push({ name: "The Magician", meaning: `CTR ${c.ctr.toFixed(2)}% — creative is still landing` });
  } else if (c.impressions > 0) {
    cards.push({ name: "The Moon", meaning: `CTR ${c.ctr.toFixed(2)}% — message or audience mismatch` });
  } else {
    cards.push({ name: "The Hermit", meaning: "No impressions yet — nothing to read" });
  }

  if (c.conversions <= 0 && c.spend > 0) {
    cards.push({ name: "Death", meaning: "Spend with zero pixel conversions — end this setup or rebuild" });
  } else if (c.cpc > 2) {
    cards.push({ name: "The Emperor", meaning: `CPC ${formatMoneyExact(c.cpc, currency)} — bids or quality need a rule` });
  } else {
    cards.push({ name: "Wheel of Fortune", meaning: `${c.conversions.toFixed(0)} pixel conversions — cycle is producing` });
  }

  const tone =
    cards.some((card) => card.name === "The Tower" || card.name === "Death")
      ? "danger"
      : cards.some((card) => card.name === "The Sun")
        ? "success"
        : "info";

  return {
    mode: "tarot",
    title: "Three-card pull",
    message: `${c.name}: ${cards.map((card) => card.name).join(" · ")}.`,
    cited: citedLine(c, currency),
    tone,
    cards,
  };
}

function crystalFor(c: MysteryCampaign, currency: ReportingCurrency = DEFAULT_CURRENCY): MysteryReading {
  if (c.spend <= 0) {
    return {
      mode: "crystal",
      title: "Fog",
      message: "No spend in the window — the next period will look the same until a campaign runs.",
      cited: citedLine(c, currency),
      tone: "info",
    };
  }
  if (c.roas >= 3 && c.ctr >= 1.5) {
    return {
      mode: "crystal",
      title: "Clear path",
      message: `If ${c.name} holds ${c.roas.toFixed(2)}x and ${c.ctr.toFixed(2)}% CTR, the next days favor more budget — not a new concept.`,
      cited: citedLine(c, currency),
      tone: "success",
    };
  }
  if (c.ctr < 1) {
    return {
      mode: "crystal",
      title: "Creative weather",
      message: `CTR is ${c.ctr.toFixed(2)}%. Outlook stays weak until a new hook or audience is in market.`,
      cited: citedLine(c, currency),
      tone: "warning",
    };
  }
  return {
    mode: "crystal",
    title: "Mixed horizon",
    message: `${c.name} is at ${c.roas.toFixed(2)}x. Next period follows this mix unless you cut the lagging platform.`,
    cited: citedLine(c, currency),
    tone: "info",
  };
}

function creativeFor(c: MysteryCampaign, currency: ReportingCurrency = DEFAULT_CURRENCY): MysteryReading {
  if (c.impressions <= 0) {
    return {
      mode: "creative",
      title: "No delivery",
      message: `${c.name} has no impressions — there is no ad to diagnose.`,
      cited: citedLine(c, currency),
      tone: "info",
    };
  }
  if (c.ctr >= 2.5) {
    return {
      mode: "creative",
      title: "Keep the hook",
      message: `${c.ctr.toFixed(2)}% CTR is doing the job. Iterate the winning angle; do not replace it with a guess.`,
      cited: citedLine(c, currency),
      tone: "success",
    };
  }
  if (c.ctr < 1) {
    return {
      mode: "creative",
      title: "Refresh the first 3 seconds",
      message: `${c.ctr.toFixed(2)}% CTR on ${c.impressions.toLocaleString("en-US")} impressions. Ship a new hook before adding budget.`,
      cited: citedLine(c, currency),
      tone: "warning",
    };
  }
  return {
    mode: "creative",
    title: "Test, don't overhaul",
    message: `${c.ctr.toFixed(2)}% CTR is average. Split one new creative against the current winner and kill the loser.`,
    cited: citedLine(c, currency),
    tone: "info",
  };
}

function spyFor(
  campaigns: MysteryCampaign[],
  subject: MysteryCampaign,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): MysteryReading {
  const byPlatform = new Map<string, { spend: number; revenue: number }>();
  for (const row of campaigns) {
    const prev = byPlatform.get(row.platform) ?? { spend: 0, revenue: 0 };
    byPlatform.set(row.platform, {
      spend: prev.spend + row.spend,
      revenue: prev.revenue + row.revenue,
    });
  }
  const ranked = [...byPlatform.entries()]
    .map(([platform, v]) => ({
      platform,
      spend: v.spend,
      roas: v.spend > 0 ? v.revenue / v.spend : 0,
    }))
    .sort((a, b) => b.roas - a.roas);

  if (ranked.length === 0) {
    return {
      mode: "spy",
      title: "No platforms",
      message: "Connect an ad account to compare channel mix.",
      cited: citedLine(subject, currency),
      tone: "info",
    };
  }

  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  const same = ranked.length === 1;

  return {
    mode: "spy",
    title: same ? "Single-channel account" : "Channel mix",
    message: same
      ? `Only ${best.platform} is in this window at ${best.roas.toFixed(2)}x pixel ROAS. There is no second platform to steal from.`
      : `Strongest: ${best.platform} at ${best.roas.toFixed(2)}x pixel ROAS. Weakest: ${worst.platform} at ${worst.roas.toFixed(2)}x. Shift budget toward the stronger pixel ROAS, not the louder spend.`,
    cited: ranked
      .map((r) => `${r.platform} ${r.roas.toFixed(2)}x / ${formatMoney(r.spend, currency)}`)
      .join(" · "),
    tone: same ? "info" : best.roas > worst.roas * 1.5 ? "success" : "info",
  };
}

export function readMystery(
  mode: MysteryMode,
  campaigns: MysteryCampaign[],
  selectedName: string,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): MysteryReading {
  const subject = resolveSubject(campaigns, selectedName);
  if (!subject) {
    return {
      mode,
      title: "No campaigns synced",
      message: "Mystery AI reads your DailyMetric rows. Connect Meta / Google / TikTok and sync before asking.",
      cited: "0 campaigns in range",
      tone: "info",
    };
  }
  switch (mode) {
    case "fortune":
      return fortuneFor(subject, currency);
    case "tarot":
      return tarotFor(subject, currency);
    case "crystal":
      return crystalFor(subject, currency);
    case "creative":
      return creativeFor(subject, currency);
    case "spy":
      return spyFor(campaigns, subject, currency);
  }
}
