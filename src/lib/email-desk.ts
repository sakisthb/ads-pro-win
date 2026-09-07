/**
 * Email desk logic: classify BAGTOBAG-style lists, pack extra Brevo stats
 * onto DailyMetric.attributionSetting, and cite-only operator insights.
 * Never invent order revenue or mix this clock into Pixel ROAS.
 */

import { formatMoney, type ReportingCurrency } from "@/lib/currency";
import { classifyMarketName, type MarketMode } from "@/lib/market-desk";

export type EmailListDesk = "retail" | "wholesale" | "other";

export interface BrevoExtraStats {
  v: 1;
  sent: number;
  hardBounces: number;
  softBounces: number;
  unsubscriptions: number;
  complaints: number;
  appleMppOpens: number;
  subject?: string;
  tags?: string[];
  listIds?: number[];
}

export interface EmailCampaignLike {
  name: string;
  delivered: number;
  opens: number;
  clicks: number;
  date?: string;
  extra?: BrevoExtraStats | null;
}

export interface EmailDeskTotals {
  desk: EmailListDesk;
  label: string;
  campaigns: number;
  delivered: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
  minDelivered: number;
  maxDelivered: number;
  lastDelivered: number;
}

export interface EmailInsight {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium";
  href: string;
  actionLabel: string;
}

export interface EmailTillSlice {
  orders: number;
  netSales: number;
  sources: string[];
  brevoOrders?: number;
  brevoNetSales?: number;
  gmailAppOrders?: number;
  otherEmailOrders?: number;
}

export type EmailTillKind = "brevo" | "gmail-app" | "other-email";

export const EMAIL_DESK_LABEL: Record<EmailListDesk, string> = {
  retail: "Retail · ΛΙΑΝΙΚΗ",
  wholesale: "Wholesale · χονδρικη",
  other: "Other sends",
};

export function classifyEmailCampaignName(
  name: string | null | undefined,
  mode: MarketMode = "mixed",
): EmailListDesk {
  const desk = classifyMarketName(name);
  if (desk === "retail" || desk === "wholesale") return desk;
  if (mode === "retail" || mode === "wholesale") return mode;
  return "other";
}

/** Last-click UTM host → proven Brevo vs Gmail app vs other ESP. Not pixel. */
export function classifyEmailTillSource(source: string | null | undefined): EmailTillKind | null {
  const raw = (source ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "brevo" || raw === "sendinblue" || raw.includes("brevo")) return "brevo";
  if (raw.includes("android.gm") || raw.includes("mail.google")) return "gmail-app";
  if (
    raw === "omnisend" ||
    raw === "mailchimp" ||
    raw === "klaviyo" ||
    raw === "email" ||
    raw === "newsletter"
  ) {
    return "other-email";
  }
  return "other-email";
}

export function nonMppUniqueOpens(uniqueOpens: number, appleMppOpens: number): number {
  const opens = Number(uniqueOpens);
  const mpp = Number(appleMppOpens);
  if (!Number.isFinite(opens) || opens <= 0) return 0;
  if (!Number.isFinite(mpp) || mpp <= 0) return opens;
  return Math.max(0, Math.round(opens) - Math.round(mpp));
}

export function encodeBrevoExtra(extra: BrevoExtraStats): string {
  const payload: BrevoExtraStats = {
    v: 1,
    sent: Math.max(0, Math.round(extra.sent) || 0),
    hardBounces: Math.max(0, Math.round(extra.hardBounces) || 0),
    softBounces: Math.max(0, Math.round(extra.softBounces) || 0),
    unsubscriptions: Math.max(0, Math.round(extra.unsubscriptions) || 0),
    complaints: Math.max(0, Math.round(extra.complaints) || 0),
    appleMppOpens: Math.max(0, Math.round(extra.appleMppOpens) || 0),
  };
  const subject = extra.subject?.trim();
  if (subject) payload.subject = subject.slice(0, 180);
  const tags = (extra.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8);
  if (tags.length > 0) payload.tags = tags;
  const listIds = (extra.listIds ?? []).filter((id) => Number.isFinite(id)).slice(0, 12);
  if (listIds.length > 0) payload.listIds = listIds;
  return JSON.stringify(payload);
}

export function parseBrevoExtra(raw: string | null | undefined): BrevoExtraStats | null {
  if (!raw || raw[0] !== "{") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BrevoExtraStats>;
    if (parsed.v !== 1) return null;
    return {
      v: 1,
      sent: Number(parsed.sent) || 0,
      hardBounces: Number(parsed.hardBounces) || 0,
      softBounces: Number(parsed.softBounces) || 0,
      unsubscriptions: Number(parsed.unsubscriptions) || 0,
      complaints: Number(parsed.complaints) || 0,
      appleMppOpens: Number(parsed.appleMppOpens) || 0,
      subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : undefined,
      listIds: Array.isArray(parsed.listIds)
        ? parsed.listIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
        : undefined,
    };
  } catch {
    return null;
  }
}

export function emptyEmailDeskTotals(desk: EmailListDesk): EmailDeskTotals {
  return {
    desk,
    label: EMAIL_DESK_LABEL[desk],
    campaigns: 0,
    delivered: 0,
    opens: 0,
    clicks: 0,
    openRate: 0,
    clickRate: 0,
    minDelivered: 0,
    maxDelivered: 0,
    lastDelivered: 0,
  };
}

export function rollupEmailDesks(
  campaigns: EmailCampaignLike[],
  mode: MarketMode = "mixed",
): Record<EmailListDesk, EmailDeskTotals> {
  const buckets: Record<EmailListDesk, EmailCampaignLike[]> = {
    retail: [],
    wholesale: [],
    other: [],
  };
  for (const campaign of campaigns) {
    buckets[classifyEmailCampaignName(campaign.name, mode)].push(campaign);
  }
  const out = {} as Record<EmailListDesk, EmailDeskTotals>;
  for (const desk of ["retail", "wholesale", "other"] as const) {
    const rows = [...buckets[desk]].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const delivered = rows.reduce((s, r) => s + r.delivered, 0);
    const opens = rows.reduce((s, r) => s + r.opens, 0);
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const sizes = rows.map((r) => r.delivered).filter((n) => n > 0);
    out[desk] = {
      desk,
      label: EMAIL_DESK_LABEL[desk],
      campaigns: rows.length,
      delivered,
      opens,
      clicks,
      openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
      clickRate: delivered > 0 ? (clicks / delivered) * 100 : 0,
      minDelivered: sizes.length > 0 ? Math.min(...sizes) : 0,
      maxDelivered: sizes.length > 0 ? Math.max(...sizes) : 0,
      lastDelivered: rows[rows.length - 1]?.delivered ?? 0,
    };
  }
  return out;
}

export function buildNextSendBrief(desks: Record<EmailListDesk, EmailDeskTotals>): Array<{
  desk: EmailListDesk;
  label: string;
  sends: number;
  bandMin: number;
  bandMax: number;
  lastDelivered: number;
}> {
  return (["retail", "wholesale"] as const)
    .map((desk) => desks[desk])
    .filter((row) => row.campaigns >= 2 && row.minDelivered > 0)
    .map((row) => ({
      desk: row.desk,
      label: row.label,
      sends: row.campaigns,
      bandMin: row.minDelivered,
      bandMax: row.maxDelivered,
      lastDelivered: row.lastDelivered,
    }));
}

export function uniqueListIds(campaigns: Array<{ extra?: { listIds?: number[] } | null }>): number[] {
  const ids = new Set<number>();
  for (const campaign of campaigns) {
    for (const id of campaign.extra?.listIds ?? []) {
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export function rollupEmailListIds(campaigns: EmailCampaignLike[]): Array<{
  listId: number;
  delivered: number;
  campaigns: number;
  desks: EmailListDesk[];
  multiListSends: number;
}> {
  const map = new Map<
    number,
    { delivered: number; campaigns: number; desks: Set<EmailListDesk>; multiListSends: number }
  >();
  for (const campaign of campaigns) {
    const ids = [...new Set((campaign.extra?.listIds ?? []).filter((id) => Number.isFinite(id) && id > 0))];
    if (ids.length === 0) continue;
    const desk = classifyEmailCampaignName(campaign.name);
    const multi = ids.length > 1 ? 1 : 0;
    for (const id of ids) {
      const row = map.get(id) ?? {
        delivered: 0,
        campaigns: 0,
        desks: new Set<EmailListDesk>(),
        multiListSends: 0,
      };
      row.delivered += campaign.delivered;
      row.campaigns += 1;
      row.desks.add(desk);
      row.multiListSends += multi;
      map.set(id, row);
    }
  }
  return [...map.entries()]
    .map(([listId, row]) => ({
      listId,
      delivered: row.delivered,
      campaigns: row.campaigns,
      desks: (["retail", "wholesale", "other"] as const).filter((desk) => row.desks.has(desk)),
      multiListSends: row.multiListSends,
    }))
    .sort((a, b) => b.delivered - a.delivered || a.listId - b.listId);
}

export function sumBrevoExtras(campaigns: EmailCampaignLike[]): {
  present: boolean;
  sent: number;
  hardBounces: number;
  softBounces: number;
  unsubscriptions: number;
  complaints: number;
  appleMppOpens: number;
} {
  let present = false;
  const sum = {
    sent: 0,
    hardBounces: 0,
    softBounces: 0,
    unsubscriptions: 0,
    complaints: 0,
    appleMppOpens: 0,
  };
  for (const campaign of campaigns) {
    if (!campaign.extra) continue;
    present = true;
    sum.sent += campaign.extra.sent;
    sum.hardBounces += campaign.extra.hardBounces;
    sum.softBounces += campaign.extra.softBounces;
    sum.unsubscriptions += campaign.extra.unsubscriptions;
    sum.complaints += campaign.extra.complaints;
    sum.appleMppOpens += campaign.extra.appleMppOpens;
  }
  return { present, ...sum };
}

function cadenceDays(dates: string[]): { spanDays: number; everyDays: number } | null {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (unique.length < 2) return null;
  const first = Date.parse(`${unique[0]}T00:00:00Z`);
  const last = Date.parse(`${unique[unique.length - 1]}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return null;
  const spanDays = Math.max(1, Math.round((last - first) / 86_400_000));
  return { spanDays, everyDays: spanDays / (unique.length - 1) };
}

export function deriveEmailInsights(args: {
  campaigns: EmailCampaignLike[];
  desks: Record<EmailListDesk, EmailDeskTotals>;
  extras: ReturnType<typeof sumBrevoExtras>;
  till: EmailTillSlice | null;
  currency?: ReportingCurrency;
  archiveCampaignCount?: number;
}): EmailInsight[] {
  const insights: EmailInsight[] = [];
  const { desks, extras, till, campaigns } = args;
  const currency = args.currency ?? "EUR";
  const fmt = (n: number) => n.toLocaleString("en-US");
  const retail = desks.retail;
  const wholesale = desks.wholesale;

  if (retail.delivered > 0 && wholesale.delivered > 0) {
    insights.push({
      id: "two-markets",
      title: "Two lists, two businesses",
      description: `${retail.label} delivered ${fmt(retail.delivered)} across ${retail.campaigns} sends (${retail.openRate.toFixed(1)}% unique open). ${wholesale.label} delivered ${fmt(wholesale.delivered)} across ${wholesale.campaigns} sends (${wholesale.openRate.toFixed(1)}% unique open). Do not blend those rates for the next send.`,
      impact: "high",
      href: "/email",
      actionLabel: "Split on this desk",
    });
  }

  insights.push({
    id: "list-growth-unknown",
    title: "Send size is not list growth",
    description: extras.present
      ? `${fmt(extras.unsubscriptions)} unsubs and ${fmt(extras.hardBounces)} hard bounces are ESP hygiene. DailyMetric stores delivered-per-send, not subscriber count. Do not read list growth from the retail band.`
      : "DailyMetric stores delivered-per-send, not subscriber count. Brevo contacts are a different clock and are not synced. Unsubs appear after extra fields land on Connections Sync Now.",
    impact: "medium",
    href: "/email",
    actionLabel: "Stay on send size",
  });

  if (retail.campaigns >= 3 && retail.minDelivered > 0) {
    insights.push({
      id: "retail-run-rate",
      title: "Retail list is a run-rate, not growth",
      description: `ΛΙΑΝΙΚΗ delivered stayed between ${fmt(retail.minDelivered)} and ${fmt(retail.maxDelivered)}. Last send ${fmt(retail.lastDelivered)}. Next retail send should land in that band unless they add subscribers — not a forecast of Woo orders.`,
      impact: "medium",
      href: "/email",
      actionLabel: "Read the band",
    });
  }

  if (!extras.present) {
    insights.push({
      id: "human-opens-unknown",
      title: "Human opens are not proven yet",
      description:
        "Unique opens are Brevo uniqueViews. appleMppOpens, bounces, and unsubs are in the API but not on these rows. Sync Now on Connections to store them. Do not call the open rate human opens until Apple MPP is on the row.",
      impact: "high",
      href: "/connections#brevo",
      actionLabel: "Sync extra fields",
    });
  } else if (extras.appleMppOpens > 0) {
    const leftover = nonMppUniqueOpens(
      campaigns.reduce((s, c) => s + c.opens, 0),
      extras.appleMppOpens,
    );
    insights.push({
      id: "apple-mpp",
      title: "Apple MPP is inside unique opens",
      description: `Brevo reported ${fmt(extras.appleMppOpens)} Apple MPP auto-opens in this window. ${fmt(leftover)} uniqueViews remain after subtracting MPP — still not proven human opens, and not Woo conversions.`,
      impact: "medium",
      href: "/email",
      actionLabel: "See health row",
    });
  } else {
    insights.push({
      id: "apple-mpp-zero",
      title: "Apple MPP came back 0",
      description:
        "appleMppOpens is stored and is 0 on these campaigns. Unique opens can still include privacy-protection artefacts Brevo does not split. Still not a Woo conversion.",
      impact: "medium",
      href: "/email",
      actionLabel: "Keep the caveat",
    });
  }

  const cadence = cadenceDays(campaigns.map((c) => c.date ?? "").filter(Boolean));
  if (cadence && campaigns.length >= 8) {
    insights.push({
      id: "cadence-bursty",
      title: "Cadence is send-day bursts",
      description: `${campaigns.length} sent campaigns over ${cadence.spanDays} days ≈ one every ${cadence.everyDays.toFixed(1)} days. The chart is send days, not a drip of daily opens. Average clicks/day is the wrong shape.`,
      impact: "medium",
      href: "/email",
      actionLabel: "Read the chart",
    });
  }

  if (
    typeof args.archiveCampaignCount === "number" &&
    args.archiveCampaignCount > campaigns.length
  ) {
    insights.push({
      id: "email-archive",
      title: "Older sends are an archive",
      description: `${fmt(args.archiveCampaignCount)} sent campaigns exist in the ESP history. This window shows ${fmt(campaigns.length)}. Do not mix older delivered into this week's opens, clicks, or Woo last-click.`,
      impact: "medium",
      href: "/email",
      actionLabel: "Stay on this window",
    });
  }

  if (till && till.orders > 0) {
    const brevoN = till.brevoOrders ?? 0;
    const gmailN = till.gmailAppOrders ?? 0;
    const gmailBit =
      gmailN > 0
        ? ` ${gmailN} of those are Gmail-app last-click — not proven utm_source=Brevo.`
        : "";
    const brevoBit =
      brevoN > 0 ? ` ${brevoN} have a Brevo UTM.` : " None of the sources are a proven Brevo UTM.";
    insights.push({
      id: "till-separate",
      title: "Woo last-click email is a different clock",
      description: `${till.orders} paid Woo orders (${formatMoney(till.netSales, currency)}) last-click to ${till.sources.slice(0, 4).join(", ") || "email"}.${brevoBit}${gmailBit} That is till on Attribution. Do not add it to Pixel ROAS or to Brevo delivered.`,
      impact: "high",
      href: "/attribution",
      actionLabel: "Open Attribution",
    });
  } else {
    insights.push({
      id: "no-esp-money",
      title: "Brevo still has no order money",
      description:
        "conversionValue on these rows is 0 because the campaigns API does not send Woo totals. If utm_source=Brevo is missing on the shop, last-click email on Attribution stays empty — that is a tracking gap, not €0 of influence.",
      impact: "medium",
      href: "/attribution",
      actionLabel: "Check Woo UTMs",
    });
  }

  if (extras.present) {
    const wounds = extras.hardBounces + extras.softBounces + extras.unsubscriptions + extras.complaints;
    if (wounds > 0) {
      insights.push({
        id: "list-health",
        title: "List health is on the ESP, not the till",
        description: `${fmt(extras.hardBounces)} hard bounces, ${fmt(extras.softBounces)} soft, ${fmt(extras.unsubscriptions)} unsubs, ${fmt(extras.complaints)} complaints. That is ESP hygiene. It is not MER.`,
        impact: "medium",
        href: "/email",
        actionLabel: "See health row",
      });
    }
  }

  return insights.slice(0, 8);
}

export function buildEspEmailExportRows(args: {
  delivered: number;
  uniqueOpens: number;
  clicks: number;
  extrasPresent: boolean;
  appleMppOpens: number;
  retailDelivered: number;
  wholesaleDelivered: number;
}): Array<[string, string | number]> {
  const leftover = nonMppUniqueOpens(args.uniqueOpens, args.appleMppOpens);
  const rows: Array<[string, string | number]> = [
    ["Clock", "ESP campaigns API — not till, not Pixel ROAS, not email ROAS"],
    ["Delivered", args.delivered],
    ["Unique opens", args.uniqueOpens],
    ["Clicks", args.clicks],
    ["Retail delivered", args.retailDelivered],
    ["Wholesale delivered", args.wholesaleDelivered],
  ];
  if (args.extrasPresent) {
    rows.push(["Apple MPP opens", args.appleMppOpens]);
    rows.push(["Unique opens minus Apple MPP (not proven human)", leftover]);
  } else {
    rows.push(["Apple MPP", "Not stored on these rows — Sync Now on Connections"]);
  }
  return rows;
}
