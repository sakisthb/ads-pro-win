/**
 * Collapse messy Woo UTM / Order Attribution hosts into operator channels.
 * Last-click only — never treat this as multi-touch or incremental ROAS.
 */

export const WOO_CHANNELS = [
  "google",
  "meta",
  "instagram",
  "bing",
  "email",
  "organic",
  "direct",
  "other",
] as const;

export type WooChannel = (typeof WOO_CHANNELS)[number];

export const WOO_CHANNEL_LABEL: Record<WooChannel, string> = {
  google: "Google",
  meta: "Meta",
  instagram: "Instagram",
  bing: "Bing",
  email: "Email",
  organic: "Organic",
  direct: "Direct",
  other: "Other",
};

export const WOO_CHANNEL_COLOR: Record<WooChannel, string> = {
  google: "#4285F4",
  meta: "#1877F2",
  instagram: "#E1306C",
  bing: "#00809D",
  email: "#10B981",
  organic: "#22C55E",
  direct: "#94A3B8",
  other: "#71717A",
};

export interface WooSourceRow {
  source: string;
  orders: number;
  netSales: number;
  refunds?: number;
  tax?: number;
  costOfGoods?: number;
  grossProfit?: number;
  newOrders?: number;
  newNetSales?: number;
}

export interface WooChannelRow {
  channel: WooChannel;
  label: string;
  orders: number;
  netSales: number;
  share: number;
  refunds: number;
  tax: number;
  costOfGoods: number;
  grossProfit: number;
  gpShare: number;
  newOrders: number;
  newNetSales: number;
  newShare: number;
}

function hostish(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function normalizeWooChannel(source: string | null | undefined): WooChannel {
  const raw = hostish(source ?? "");
  if (!raw || raw === "(none)" || raw === "(direct)" || raw === "direct" || raw === "typein") {
    return "direct";
  }
  if (raw === "organic") return "organic";
  if (
    raw === "google" ||
    raw.startsWith("google.") ||
    raw.includes("googleads") ||
    raw === "google_ads" ||
    raw === "adwords"
  ) {
    return "google";
  }
  if (
    raw === "fb" ||
    raw === "facebook" ||
    raw.startsWith("facebook.") ||
    raw.endsWith(".facebook.com") ||
    raw === "meta" ||
    raw.startsWith("meta-") ||
    raw === "an"
  ) {
    return "meta";
  }
  if (raw === "ig" || raw === "instagram" || raw.includes("instagram")) {
    return "instagram";
  }
  if (raw === "bing" || raw.startsWith("bing.") || raw === "msn" || raw.startsWith("msn.")) {
    return "bing";
  }
  if (
    raw === "brevo" ||
    raw === "sendinblue" ||
    raw === "omnisend" ||
    raw === "mailchimp" ||
    raw === "klaviyo" ||
    raw === "email" ||
    raw === "newsletter" ||
    raw.includes("android.gm") ||
    raw.includes("mail.google")
  ) {
    return "email";
  }
  return "other";
}

type ChannelBucket = {
  orders: number;
  netSales: number;
  refunds: number;
  tax: number;
  costOfGoods: number;
  grossProfit: number;
  newOrders: number;
  newNetSales: number;
};

function emptyBucket(): ChannelBucket {
  return {
    orders: 0,
    netSales: 0,
    refunds: 0,
    tax: 0,
    costOfGoods: 0,
    grossProfit: 0,
    newOrders: 0,
    newNetSales: 0,
  };
}

export function groupWooChannels(rows: WooSourceRow[]): WooChannelRow[] {
  const bucket = new Map<WooChannel, ChannelBucket>();
  for (const row of rows) {
    const channel = normalizeWooChannel(row.source);
    const prev = bucket.get(channel) ?? emptyBucket();
    bucket.set(channel, {
      orders: prev.orders + row.orders,
      netSales: prev.netSales + row.netSales,
      refunds: prev.refunds + (row.refunds ?? 0),
      tax: prev.tax + (row.tax ?? 0),
      costOfGoods: prev.costOfGoods + (row.costOfGoods ?? 0),
      grossProfit: prev.grossProfit + (row.grossProfit ?? 0),
      newOrders: prev.newOrders + (row.newOrders ?? 0),
      newNetSales: prev.newNetSales + (row.newNetSales ?? 0),
    });
  }
  const totals = [...bucket.values()].reduce(
    (sum, row) => ({
      net: sum.net + row.netSales,
      gp: sum.gp + row.grossProfit,
    }),
    { net: 0, gp: 0 },
  );
  return WOO_CHANNELS.filter((channel) => bucket.has(channel))
    .map((channel) => {
      const row = bucket.get(channel)!;
      return {
        channel,
        label: WOO_CHANNEL_LABEL[channel],
        orders: row.orders,
        netSales: row.netSales,
        share: totals.net > 0 ? row.netSales / totals.net : 0,
        refunds: row.refunds,
        tax: row.tax,
        costOfGoods: row.costOfGoods,
        grossProfit: row.grossProfit,
        gpShare: totals.gp > 0 ? row.grossProfit / totals.gp : 0,
        newOrders: row.newOrders,
        newNetSales: row.newNetSales,
        newShare: row.netSales > 0 ? row.newNetSales / row.netSales : 0,
      };
    })
    .sort((a, b) => b.netSales - a.netSales);
}

export function missingPaidConnections(args: {
  channels: Array<{ channel: WooChannel; orders: number; netSales: number }>;
  connectedPlatforms: string[];
}): Array<{ channel: WooChannel; href: string; orders: number; netSales: number }> {
  const connected = new Set(args.connectedPlatforms.map((p) => p.toLowerCase()));
  const missing: Array<{ channel: WooChannel; href: string; orders: number; netSales: number }> = [];
  for (const row of args.channels) {
    if (row.channel === "google" && !connected.has("google") && (row.orders >= 8 || row.netSales >= 400)) {
      missing.push({ ...row, href: "/connections" });
    }
    if (row.channel === "meta" && !connected.has("meta") && (row.orders >= 8 || row.netSales >= 400)) {
      missing.push({ ...row, href: "/connections" });
    }
    if (row.channel === "bing" && (row.orders >= 8 || row.netSales >= 400)) {
      missing.push({ ...row, href: "/connections" });
    }
  }
  return missing;
}
