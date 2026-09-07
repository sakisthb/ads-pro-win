/**
 * Map last-30-day workspace metrics onto the five AI Team desks.
 * Each desk is a briefing + a link to the tool that can act — not a
 * fake agent that pretends to change bids from this page.
 */

import { formatMoney, type ReportingCurrency } from "@/lib/currency";
import { looksLikeAdvantagePlusName } from "@/lib/dashboard-insights";

export type DeskId =
  | "optimizer"
  | "creative"
  | "budget"
  | "audience"
  | "reports";

export type DeskStatus = "ready" | "watching" | "needs_data";

export interface TeamDesk {
  id: DeskId;
  name: string;
  role: string;
  status: DeskStatus;
  finding: string;
  metricLabel: string;
  metricValue: string;
  href: string;
  actionLabel: string;
  /** Sent to /chat?ask= so Saki starts from this desk's finding. */
  askPrompt: string;
}

export interface TeamTask {
  deskId: DeskId;
  agent: string;
  task: string;
  status: DeskStatus;
  href: string;
  askPrompt: string;
}

export interface TeamAccountLike {
  name: string;
  platform: string;
  totalSpend: number;
  roas: number;
}

export interface TeamCampaignLike {
  name: string;
  spend: number;
  roas: number;
  impressions: number;
  clicks: number;
  platform?: string;
}

export interface DeriveTeamDesksInput {
  currency: ReportingCurrency;
  connectedAccounts: number;
  accounts: TeamAccountLike[];
  campaigns: TeamCampaignLike[];
  wasted: {
    count: number;
    totalWastedSpend: number;
    topName?: string;
    topRoas?: number;
  };
  totals: {
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    ctr: number;
  } | null;
  alertCount: number;
  email?: {
    connected: boolean;
    delivered: number;
    uniqueOpens: number;
    clicks: number;
  } | null;
  googleAds?: {
    connected: boolean;
    spend: number;
  } | null;
}

const NAMES: Record<DeskId, { name: string; role: string }> = {
  optimizer: {
    name: "Campaign Optimizer",
    role: "Find leaking spend and open the bid desk",
  },
  creative: {
    name: "Creative Analyzer",
    role: "Catch CTR decay before frequency burns the set",
  },
  budget: {
    name: "Budget Allocator",
    role: "Shift daily budget toward the stronger platform",
  },
  audience: {
    name: "Audience Builder",
    role: "Seed lookalikes from winners, not from the whole list",
  },
  reports: {
    name: "Report Generator",
    role: "Package the window for stakeholders",
  },
};

const ASK_FOLLOWUP: Record<DeskId, string> = {
  optimizer:
    "Find wasted spend: campaigns with spend but weak pixel conversions or pixel ROAS below 1.5x. Give 3 concrete bid, pause, or creative moves. Do not treat store MER as this ROAS.",
  creative:
    "Which ads show creative fatigue (frequency up, CTR down) and what should I refresh first?",
  budget:
    "How should I reallocate budget across Meta, Google, and TikTok based on current pixel ROAS? Do not scale from store MER. Pixel, till, GA4, GSC, and email are five clocks.",
  audience:
    "Given this finding, what should I do next? Do not recommend a lookalike test for Advantage+ catalog. Prefer format, offer, or landing fixes when that is the control.",
  reports:
    "Write a one-page weekly CEO brief: spend, pixel conversion value, store MER, winners, losers, and 3 actions. Name pixel conversions vs store orders vs GA4 purchases separately. If Email desk has Brevo numbers, cite delivered/opens on their own line — never as till revenue or Pixel ROAS.",
};

function attachAsk(desk: Omit<TeamDesk, "askPrompt">): TeamDesk {
  return {
    ...desk,
    askPrompt: `You are briefing from the ${desk.name} desk.\n\nFinding: ${desk.finding}\n\n${ASK_FOLLOWUP[desk.id]}`,
  };
}

/** Combined prompt for the Team header “Ask AI for a plan” control. */
export function buildTeamPlanAsk(desks: TeamDesk[]): string {
  const lines = desks.map(
    (d) => `- ${d.name} [${d.status}]: ${d.finding}`,
  );
  return [
    "You are the AI Team lead. Here is the last-30-day briefing from every desk.",
    "",
    ...lines,
    "",
    "Write a ranked plan (max 5 moves) for the next 7 days. Name the desk, the campaign or platform, and the action. Do not claim you already changed bids on Meta, Google, or TikTok.",
  ].join("\n");
}

function campaignCtr(c: TeamCampaignLike): number {
  return c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
}

export function deriveTeamDesks(input: DeriveTeamDesksInput): {
  desks: TeamDesk[];
  tasks: TeamTask[];
} {
  const currency = input.currency;
  const totals = input.totals;
  const hasSpend = (totals?.spend ?? 0) > 0;
  const funded = input.accounts.filter((a) => a.totalSpend > 0);

  const optimizer = buildOptimizer(input, hasSpend, currency);
  const creative = buildCreative(input, hasSpend);
  const budget = buildBudget(input, funded, currency);
  const audience = buildAudience(input, hasSpend);
  const reports = buildReports(input, hasSpend, currency);

  const desks = [optimizer, creative, budget, audience, reports].map(attachAsk);
  const tasks = desks.map((desk) => ({
    deskId: desk.id,
    agent: desk.name,
    task: desk.finding,
    status: desk.status,
    href: desk.href,
    askPrompt: desk.askPrompt,
  }));

  return { desks, tasks };
}

function buildOptimizer(
  input: DeriveTeamDesksInput,
  hasSpend: boolean,
  currency: ReportingCurrency,
): Omit<TeamDesk, "askPrompt"> {
  const meta = NAMES.optimizer;
  if (input.wasted.count > 0) {
    const lead = input.wasted.topName
      ? ` Worst: "${input.wasted.topName}" at ${(input.wasted.topRoas ?? 0).toFixed(2)}x.`
      : "";
    return {
      id: "optimizer",
      ...meta,
      status: "ready",
      finding: `${input.wasted.count} campaign${input.wasted.count === 1 ? "" : "s"} below 1x ROAS · ${formatMoney(input.wasted.totalWastedSpend, currency)} at risk.${lead}`,
      metricLabel: "Spend at risk",
      metricValue: formatMoney(input.wasted.totalWastedSpend, currency),
      href: "/bidding",
      actionLabel: "Open bid desk",
    };
  }
  if (hasSpend) {
    return {
      id: "optimizer",
      ...meta,
      status: "watching",
      finding:
        "No campaign in this window is below 1x ROAS. Use the bid desk for CPC outliers and frequency caps.",
      metricLabel: "Wasted spend",
      metricValue: formatMoney(0, currency),
      href: "/bidding",
      actionLabel: "Open bid desk",
    };
  }
  return {
    id: "optimizer",
    ...meta,
    status: "needs_data",
    finding:
      input.connectedAccounts === 0
        ? "Connect Meta, Google, or TikTok and run a sync so this desk can score bids."
        : "Accounts are connected but there is no spend in the last 30 days yet. Run a sync from Connections.",
    metricLabel: "Spend at risk",
    metricValue: "—",
    href: "/connections",
    actionLabel: "Connect / sync",
  };
}

function buildCreative(input: DeriveTeamDesksInput, hasSpend: boolean): Omit<TeamDesk, "askPrompt"> {
  const meta = NAMES.creative;
  const blendedCtr = input.totals?.ctr ?? 0;
  const withDelivery = input.campaigns.filter((c) => c.impressions > 0);
  const weak = [...withDelivery].sort((a, b) => campaignCtr(a) - campaignCtr(b))[0];
  const weakCtr = weak ? campaignCtr(weak) : 0;

  if (weak && blendedCtr > 0 && weakCtr < blendedCtr * 0.7) {
    return {
      id: "creative",
      ...meta,
      status: "ready",
      finding: `"${weak.name}" CTR is ${weakCtr.toFixed(2)}% vs blended ${blendedCtr.toFixed(2)}%. Score the set on Creative Fatigue before you keep spending.`,
      metricLabel: "Weak CTR",
      metricValue: `${weakCtr.toFixed(2)}%`,
      href: "/creative-fatigue",
      actionLabel: "Open fatigue desk",
    };
  }
  if (hasSpend) {
    return {
      id: "creative",
      ...meta,
      status: "watching",
      finding:
        "Blended CTR is holding. Open Creative Fatigue to score frequency, week-1 decay, and CPA inflation on live ads.",
      metricLabel: "Blended CTR",
      metricValue: `${blendedCtr.toFixed(2)}%`,
      href: "/creative-fatigue",
      actionLabel: "Open fatigue desk",
    };
  }
  return {
    id: "creative",
    ...meta,
    status: "needs_data",
    finding:
      "No delivery to score yet. After a sync, this desk flags CTR drop vs the first week of the range.",
    metricLabel: "Blended CTR",
    metricValue: "—",
    href: "/creative-fatigue",
    actionLabel: "Open fatigue desk",
  };
}

function buildBudget(
  input: DeriveTeamDesksInput,
  funded: TeamAccountLike[],
  currency: ReportingCurrency,
): Omit<TeamDesk, "askPrompt"> {
  const meta = NAMES.budget;
  if (funded.length >= 2) {
    const ranked = [...funded].sort((a, b) => b.roas - a.roas);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best && worst && best.name !== worst.name && worst.roas > 0) {
      const lift = ((best.roas - worst.roas) / worst.roas) * 100;
      if (lift >= 8) {
        return {
          id: "budget",
          ...meta,
          status: "ready",
          finding: `${labelPlatform(best)} is at ${best.roas.toFixed(2)}x vs ${labelPlatform(worst)} at ${worst.roas.toFixed(2)}x. Moving 15% of ${labelPlatform(worst)} daily budget toward ${labelPlatform(best)} is the highest-leverage shift in this window.`,
          metricLabel: "ROAS gap",
          metricValue: `+${lift.toFixed(0)}%`,
          href: "/cross-platform",
          actionLabel: "Rebalance mix",
        };
      }
    }
    return {
      id: "budget",
      ...meta,
      status: "watching",
      finding: `${funded.length} funded platforms are within a tight ROAS band. Check Cross-Platform if you want to move budget anyway.`,
      metricLabel: "Platforms",
      metricValue: String(funded.length),
      href: "/cross-platform",
      actionLabel: "Open mix",
    };
  }
  const only = funded[0];
  if (only) {
    const googleQuiet =
      input.googleAds?.connected && (input.googleAds.spend ?? 0) <= 0;
    return {
      id: "budget",
      ...meta,
      status: "watching",
      finding: googleQuiet
        ? `Only ${labelPlatform(only)} has spend in this window (${formatMoney(only.totalSpend, currency)}). Google Ads OAuth is on with €0 DailyMetric — Woo last-click Google is till, not a mix shift. Sync Now or apply for Basic Access.`
        : `Only ${labelPlatform(only)} has spend in this window (${formatMoney(only.totalSpend, currency)}). Connect a second platform before a mix shift is meaningful.`,
      metricLabel: "Funded platforms",
      metricValue: "1",
      href: "/connections",
      actionLabel: googleQuiet ? "Fix Google Ads sync" : "Add a platform",
    };
  }
  return {
    id: "budget",
    ...meta,
    status: "needs_data",
    finding:
      "Need spend on at least two platforms to recommend a reallocation.",
    metricLabel: "Funded platforms",
    metricValue: "0",
    href: "/connections",
    actionLabel: "Connect platforms",
  };
}

function buildAudience(input: DeriveTeamDesksInput, hasSpend: boolean): Omit<TeamDesk, "askPrompt"> {
  const meta = NAMES.audience;
  const winner = [...input.campaigns]
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.roas - a.roas)[0];

  if (winner && winner.roas >= 3) {
    const advantagePlus = looksLikeAdvantagePlusName(winner.name);
    return {
      id: "audience",
      ...meta,
      status: "ready",
      finding: advantagePlus
        ? `"${winner.name}" is at ${winner.roas.toFixed(2)}x. Keep this Advantage+ catalog as the control — lookalikes are not the next move. Ship a second format or fix the offer vs landing on Creative Fatigue.`
        : `"${winner.name}" is at ${winner.roas.toFixed(2)}x. Build a 1–3% lookalike (or a broader interest stack) from this winner instead of scaling the same pool.`,
      metricLabel: "Winner ROAS",
      metricValue: `${winner.roas.toFixed(2)}x`,
      href: advantagePlus ? "/creative-fatigue" : "/audiences",
      actionLabel: advantagePlus ? "Creative fatigue" : "Open audiences",
      role: advantagePlus
        ? "Keep Advantage+ as the control — do not invent a lookalike test"
        : meta.role,
    };
  }
  if (hasSpend) {
    return {
      id: "audience",
      ...meta,
      status: "watching",
      finding:
        "No campaign is at 3x+ yet. Use Customers and Audiences to seed exclusions and retargeting from purchasers anyway.",
      metricLabel: "Best ROAS",
      metricValue: winner ? `${winner.roas.toFixed(2)}x` : "—",
      href: "/audiences",
      actionLabel: "Open audiences",
    };
  }
  return {
    id: "audience",
    ...meta,
    status: "needs_data",
    finding:
      "Connect commerce or ads, then this desk will point lookalikes at the highest-ROAS campaign.",
    metricLabel: "Winner ROAS",
    metricValue: "—",
    href: "/customers",
    actionLabel: "Open customers",
  };
}

function buildReports(
  input: DeriveTeamDesksInput,
  hasSpend: boolean,
  currency: ReportingCurrency,
): Omit<TeamDesk, "askPrompt"> {
  const meta = NAMES.reports;
  const alerts =
    input.alertCount > 0
      ? ` ${input.alertCount} budget alert${input.alertCount === 1 ? "" : "s"} fired in this workspace.`
      : "";
  if (hasSpend && input.totals) {
    const email = input.email;
    const emailBit = email?.connected
      ? email.delivered > 0
        ? ` ESP email: ${email.delivered.toLocaleString("en-US")} delivered / ${email.uniqueOpens.toLocaleString("en-US")} unique opens — a separate clock from pixel conversion value. Reports exports it on its own sheet.`
        : " Brevo is connected; 0 sent campaigns in this 30-day brief. Email desk defaults to 180 days."
      : "";
    const google = input.googleAds;
    const googleBit =
      google?.connected && google.spend <= 0
        ? " Google Ads OAuth is on; 0 spend rows in this window. Pixel ROAS is Meta-only. Woo last-click Google is till."
        : "";
    return {
      id: "reports",
      ...meta,
      status: "ready",
      finding: `Last 30 days: ${formatMoney(input.totals.spend, currency)} spend · ${input.totals.roas.toFixed(2)}x pixel ROAS · ${input.totals.conversions.toFixed(0)} pixel conversions.${alerts}${emailBit}${googleBit} Export from Reports.`,
      metricLabel: "Pixel ROAS",
      metricValue: `${input.totals.roas.toFixed(2)}x`,
      href: "/reports",
      actionLabel: "Open reports",
    };
  }
  return {
    id: "reports",
    ...meta,
    status: "needs_data",
    finding:
      "Nothing to export until DailyMetric rows exist. Sync an ad account, then generate the stakeholder pack here.",
    metricLabel: "Pixel ROAS",
    metricValue: "—",
    href: "/reports",
    actionLabel: "Open reports",
  };
}

function labelPlatform(account: TeamAccountLike): string {
  const platform = account.platform
    ? account.platform.charAt(0).toUpperCase() + account.platform.slice(1)
    : "";
  if (account.name && account.name !== "Unknown account") return account.name;
  return platform || account.name;
}

/** Sample briefing used by the Demo workspace so the desks are still clickable. */
export function demoTeamDeskInput(
  currency: ReportingCurrency,
): DeriveTeamDesksInput {
  return {
    currency,
    connectedAccounts: 3,
    accounts: [
      { name: "Meta", platform: "meta", totalSpend: 7400, roas: 4.2 },
      { name: "Google", platform: "google", totalSpend: 5200, roas: 3.1 },
      { name: "TikTok", platform: "tiktok", totalSpend: 3100, roas: 1.9 },
    ],
    campaigns: [
      {
        name: "Meta retargeting — DPA",
        spend: 4200,
        roas: 4.7,
        impressions: 180000,
        clicks: 7200,
        platform: "meta",
      },
      {
        name: "Spark Ads — Prospecting",
        spend: 2480,
        roas: 0.72,
        impressions: 420000,
        clicks: 4200,
        platform: "tiktok",
      },
    ],
    wasted: {
      count: 3,
      totalWastedSpend: 2480,
      topName: "Spark Ads — Prospecting",
      topRoas: 0.72,
    },
    totals: {
      spend: 15700,
      revenue: 52400,
      roas: 3.34,
      conversions: 1840,
      ctr: 2.1,
    },
    alertCount: 2,
  };
}
