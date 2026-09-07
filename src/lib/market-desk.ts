/**
 * Retail vs wholesale as operator desks.
 *
 * Shop identity comes from Brand.marketMode (or org default): mixed, retail,
 * or wholesale. Mixed shops (BAGTOBAG) classify per order and leave unnamed
 * ads unclassified. A retail-only or wholesale-only org inherits that desk
 * for guests, registered customers, and unnamed campaigns — so a future
 * single-market Woo connection does not sit in "unknown". Explicit opposite
 * signals still win, so a leak is visible. Do not divide wholesale till by
 * total Meta spend on a mixed shop.
 */

export type MarketDesk = "retail" | "wholesale" | "unknown";
export type MarketFilter = "all" | "retail" | "wholesale";
export type MarketMode = "mixed" | "retail" | "wholesale";
export type BrandMarketMode = "inherit" | MarketMode;

export const MARKET_DESKS: MarketDesk[] = ["retail", "wholesale", "unknown"];

export const MARKET_DESK_LABEL: Record<MarketDesk, string> = {
  retail: "Retail · ΛΙΑΝΙΚΗ",
  wholesale: "Wholesale · χονδρική",
  unknown: "Unclassified",
};

export const MARKET_FILTER_LABEL: Record<MarketFilter, string> = {
  all: "All desks",
  retail: "Retail · ΛΙΑΝΙΚΗ",
  wholesale: "Wholesale · χονδρική",
};

export const MARKET_MODE_LABEL: Record<BrandMarketMode, string> = {
  inherit: "Use workspace default",
  mixed: "Both · retail and wholesale",
  retail: "Retail only · ΛΙΑΝΙΚΗ",
  wholesale: "Wholesale only · χονδρική",
};

export function parseMarketMode(value: unknown): MarketMode {
  if (value === "retail" || value === "wholesale" || value === "mixed") return value;
  return "mixed";
}

export function parseBrandMarketMode(value: unknown): BrandMarketMode {
  if (value === "inherit" || value === "mixed" || value === "retail" || value === "wholesale") {
    return value;
  }
  return "inherit";
}

export function resolveMarketMode(brandMode: unknown, orgMode: unknown): MarketMode {
  const brand = parseBrandMarketMode(brandMode);
  if (brand !== "inherit") return brand;
  return parseMarketMode(orgMode);
}

/** Unclassified rows inherit the shop identity on a single-desk org. */
export function applyModeFallback(desk: MarketDesk, mode: MarketMode = "mixed"): MarketDesk {
  if (desk !== "unknown") return desk;
  if (mode === "retail" || mode === "wholesale") return mode;
  return "unknown";
}

export function defaultMarketFilter(mode: MarketMode): MarketFilter {
  return mode === "mixed" ? "all" : mode;
}

export function visibleMarketFilters(
  mode: MarketMode,
  desks?: { retail?: { orders?: number }; wholesale?: { orders?: number } },
): MarketFilter[] {
  const retailLive = (desks?.retail?.orders ?? 0) > 0;
  const wholesaleLive = (desks?.wholesale?.orders ?? 0) > 0;
  if (mode === "retail" && !wholesaleLive) return ["retail"];
  if (mode === "wholesale" && !retailLive) return ["wholesale"];
  return ["all", "retail", "wholesale"];
}

export function marketModeConflict(
  mode: MarketMode,
  desks: { retail: { orders: number; netSales: number }; wholesale: { orders: number; netSales: number } },
): { mode: MarketMode; opposite: MarketDesk; orders: number; netSales: number } | null {
  if (mode === "retail" && desks.wholesale.orders > 0) {
    return { mode, opposite: "wholesale", orders: desks.wholesale.orders, netSales: desks.wholesale.netSales };
  }
  if (mode === "wholesale" && desks.retail.orders > 0) {
    return { mode, opposite: "retail", orders: desks.retail.orders, netSales: desks.retail.netSales };
  }
  return null;
}

const WHOLESALE_NAME =
  /χονδρικ|wholesale|\bb2b\b|\bb2bking\b|corporate\s*catalogue|b2b\s*pric/;
const RETAIL_NAME = /λιανικ|retail|\bb2c\b/;
const COMPANY_SUFFIX = /\b(ae|a\.e\.|επε|ε\.π\.ε\.|ike|ι\.κ\.ε\.|oe|o\.e\.|epe|ltd|llc|gmbh|srl|sas)\b/;
const WHOLESALE_META_KEYS =
  /wholesale|wwp_|wwpp_|b2bking|b2b_role|b2b-role|customer_role|user_role/;
const VAT_META_KEYS =
  /vat_number|vat-number|_vat|afm|αφμ|tax_id|tax-id|vies|billing_vat|yweu_billing/;
const WHOLESALE_ROLES =
  /wholesale|b2b|χονδρικ|wholesale_customer|b2bking/;
const RETAIL_ROLES = /retail|λιανικ|\bcustomer\b|\bsubscriber\b/;

export function classifyMarketName(value: string | null | undefined): MarketDesk {
  const n = (value ?? "").normalize("NFKC").toLowerCase();
  if (!n.trim()) return "unknown";
  if (WHOLESALE_NAME.test(n)) return "wholesale";
  if (RETAIL_NAME.test(n)) return "retail";
  return "unknown";
}

export function matchesMarketFilter(
  desk: MarketDesk | string | null | undefined,
  filter: MarketFilter | string | null | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  return desk === filter;
}

function metaEntries(
  meta: Array<{ key?: string; value?: unknown }> | undefined,
): Array<{ key: string; value: string }> {
  if (!meta?.length) return [];
  return meta
    .map((entry) => ({
      key: (entry.key ?? "").toLowerCase(),
      value: stringifyMetaValue(entry.value),
    }))
    .filter((entry) => entry.key || entry.value);
}

function stringifyMetaValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).normalize("NFKC").toLowerCase();
  }
  if (Array.isArray(value)) return value.map(stringifyMetaValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).toLowerCase();
    } catch {
      return "";
    }
  }
  return "";
}

function looksLikeCompanyName(company: string, firstName?: string, lastName?: string): boolean {
  const raw = company.normalize("NFKC").trim();
  if (raw.length < 2) return false;
  const n = raw.toLowerCase();
  if (WHOLESALE_NAME.test(n) || COMPANY_SUFFIX.test(n)) return true;
  const person = `${firstName ?? ""} ${lastName ?? ""}`.trim().toLowerCase();
  if (person && n === person) return false;
  return n.length >= 3;
}

export interface WooMarketOrderLike {
  customer_id?: number | null;
  coupon_lines?: Array<{ code?: string | null }>;
  billing?: {
    company?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    vat?: string | null;
    vat_number?: string | null;
    email?: string | null;
  };
  meta_data?: Array<{ key?: string; value?: unknown }>;
  campaign?: string | null;
  source?: string | null;
  medium?: string | null;
}

export interface MarketClassification {
  market: MarketDesk;
  reason: string;
}

/**
 * First match wins. Never uses AOV — a sample wholesale order can be smaller
 * than a retail basket.
 */
export function classifyWooOrderMarket(
  order: WooMarketOrderLike,
  wholesaleCustomerIds: Iterable<number> = [],
  mode: MarketMode = "mixed",
): MarketClassification {
  const wholesaleIds = wholesaleCustomerIds instanceof Set
    ? wholesaleCustomerIds
    : new Set(wholesaleCustomerIds);
  const customerId = Number(order.customer_id) || 0;
  const billing = order.billing ?? {};
  const company = (billing.company ?? "").trim();
  const vat = `${billing.vat ?? ""} ${billing.vat_number ?? ""}`.trim();
  const meta = metaEntries(order.meta_data);
  const coupons = (order.coupon_lines ?? [])
    .map((row) => row.code ?? "")
    .join(" ");

  for (const entry of meta) {
    const blob = `${entry.key} ${entry.value}`;
    if (WHOLESALE_META_KEYS.test(entry.key) || WHOLESALE_ROLES.test(blob)) {
      if (RETAIL_NAME.test(entry.value) && !WHOLESALE_NAME.test(entry.value)) {
        return { market: "retail", reason: "role-meta" };
      }
      if (entry.value === "0" || entry.value === "false" || entry.value === "no") continue;
      if (WHOLESALE_NAME.test(blob) || WHOLESALE_ROLES.test(blob) || /1|true|yes/.test(entry.value)) {
        return { market: "wholesale", reason: "plugin-meta" };
      }
    }
    if (VAT_META_KEYS.test(entry.key) && entry.value && entry.value !== "0") {
      return { market: "wholesale", reason: "vat-meta" };
    }
    const named = classifyMarketName(`${entry.key} ${entry.value}`);
    if (named !== "unknown") return { market: named, reason: "meta-name" };
  }

  if (customerId > 0 && wholesaleIds.has(customerId)) {
    return { market: "wholesale", reason: "customer-role" };
  }

  const couponDesk = classifyMarketName(coupons);
  if (couponDesk !== "unknown") return { market: couponDesk, reason: "coupon" };

  if (vat.length >= 5) return { market: "wholesale", reason: "billing-vat" };

  if (looksLikeCompanyName(company, billing.first_name ?? "", billing.last_name ?? "")) {
    return { market: "wholesale", reason: "billing-company" };
  }

  const named = classifyMarketName(
    [order.campaign, order.source, order.medium].filter(Boolean).join(" "),
  );
  if (named !== "unknown") return { market: named, reason: "utm" };

  if (mode === "mixed" && customerId <= 0 && !company) {
    return { market: "retail", reason: "guest" };
  }

  const inherited = applyModeFallback("unknown", mode);
  if (inherited !== "unknown") {
    return { market: inherited, reason: `mode-${mode}` };
  }

  return { market: "unknown", reason: "unknown" };
}

export function resolveStoredMarket(
  args: {
    market?: string | null;
    campaign?: string | null;
    source?: string | null;
    medium?: string | null;
  },
  mode: MarketMode = "mixed",
): MarketDesk {
  if (args.market === "retail" || args.market === "wholesale") return args.market;
  const named = classifyMarketName(
    [args.campaign, args.source, args.medium].filter(Boolean).join(" "),
  );
  return applyModeFallback(named, mode);
}

export function adDeskForName(name: string | null | undefined, mode: MarketMode = "mixed"): MarketDesk {
  return applyModeFallback(classifyMarketName(name), mode);
}

export interface MarketTillSlice {
  market: MarketDesk;
  label: string;
  orders: number;
  netSales: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  tax: number;
  shipping: number;
  costOfGoods: number;
  grossProfit: number;
  newOrders: number;
  newCustomerNet: number;
  avgOrderValue: number;
}

export function emptyMarketTill(market: MarketDesk): MarketTillSlice {
  return {
    market,
    label: MARKET_DESK_LABEL[market],
    orders: 0,
    netSales: 0,
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    tax: 0,
    shipping: 0,
    costOfGoods: 0,
    grossProfit: 0,
    newOrders: 0,
    newCustomerNet: 0,
    avgOrderValue: 0,
  };
}

export function finalizeMarketTill(slice: MarketTillSlice): MarketTillSlice {
  return {
    ...slice,
    avgOrderValue: slice.orders > 0 ? slice.netSales / slice.orders : 0,
  };
}

export interface MarketSalesRow {
  market?: string | null;
  campaign?: string | null;
  source?: string | null;
  medium?: string | null;
  orders: number;
  netSales: number;
  grossSales?: number;
  discounts?: number;
  refunds?: number;
  tax?: number;
  shipping?: number;
  costOfGoods?: number;
  grossProfit?: number;
  newOrders?: number;
  newCustomerNet?: number;
}

export function rollupMarketTill(
  rows: MarketSalesRow[],
  mode: MarketMode = "mixed",
): Record<MarketDesk, MarketTillSlice> {
  const out: Record<MarketDesk, MarketTillSlice> = {
    retail: emptyMarketTill("retail"),
    wholesale: emptyMarketTill("wholesale"),
    unknown: emptyMarketTill("unknown"),
  };
  for (const row of rows) {
    const desk = resolveStoredMarket(row, mode);
    const bucket = out[desk];
    bucket.orders += row.orders;
    bucket.netSales += row.netSales;
    bucket.grossSales += row.grossSales ?? 0;
    bucket.discounts += row.discounts ?? 0;
    bucket.refunds += row.refunds ?? 0;
    bucket.tax += row.tax ?? 0;
    bucket.shipping += row.shipping ?? 0;
    bucket.costOfGoods += row.costOfGoods ?? 0;
    bucket.grossProfit += row.grossProfit ?? 0;
    bucket.newOrders += row.newOrders ?? 0;
    bucket.newCustomerNet += row.newCustomerNet ?? 0;
  }
  return {
    retail: finalizeMarketTill(out.retail),
    wholesale: finalizeMarketTill(out.wholesale),
    unknown: finalizeMarketTill(out.unknown),
  };
}

export function pickMarketTill(
  desks: Record<MarketDesk, MarketTillSlice>,
  filter: MarketFilter,
): MarketTillSlice {
  if (filter === "retail") return desks.retail;
  if (filter === "wholesale") return desks.wholesale;
  const blended = emptyMarketTill("unknown");
  blended.label = MARKET_FILTER_LABEL.all;
  for (const desk of MARKET_DESKS) {
    const row = desks[desk];
    blended.orders += row.orders;
    blended.netSales += row.netSales;
    blended.grossSales += row.grossSales;
    blended.discounts += row.discounts;
    blended.refunds += row.refunds;
    blended.tax += row.tax;
    blended.shipping += row.shipping;
    blended.costOfGoods += row.costOfGoods;
    blended.grossProfit += row.grossProfit;
    blended.newOrders += row.newOrders;
    blended.newCustomerNet += row.newCustomerNet;
  }
  return finalizeMarketTill(blended);
}

export interface MarketAdSlice {
  market: MarketDesk;
  label: string;
  spend: number;
  conversions: number;
  conversionValue: number;
  clicks: number;
  impressions: number;
  campaigns: number;
}

export function emptyMarketAd(market: MarketDesk): MarketAdSlice {
  return {
    market,
    label: MARKET_DESK_LABEL[market],
    spend: 0,
    conversions: 0,
    conversionValue: 0,
    clicks: 0,
    impressions: 0,
    campaigns: 0,
  };
}

export function splitNamedAdSpend(
  rows: Array<{
    name?: string | null;
    spend?: number;
    conversions?: number;
    conversionValue?: number;
    clicks?: number;
    impressions?: number;
  }>,
  mode: MarketMode = "mixed",
): Record<MarketDesk, MarketAdSlice> {
  const out: Record<MarketDesk, MarketAdSlice> = {
    retail: emptyMarketAd("retail"),
    wholesale: emptyMarketAd("wholesale"),
    unknown: emptyMarketAd("unknown"),
  };
  for (const row of rows) {
    const desk = adDeskForName(row.name, mode);
    const bucket = out[desk];
    bucket.spend += row.spend ?? 0;
    bucket.conversions += row.conversions ?? 0;
    bucket.conversionValue += row.conversionValue ?? 0;
    bucket.clicks += row.clicks ?? 0;
    bucket.impressions += row.impressions ?? 0;
    bucket.campaigns += 1;
  }
  return out;
}

export function namedAdSpendForFilter(
  desks: Record<MarketDesk, MarketAdSlice>,
  filter: MarketFilter,
): { spend: number; conversions: number; conversionValue: number; clicks: number; impressions: number; unnamedSpend: number } {
  const unnamed = desks.unknown.spend;
  if (filter === "retail") {
    return {
      spend: desks.retail.spend,
      conversions: desks.retail.conversions,
      conversionValue: desks.retail.conversionValue,
      clicks: desks.retail.clicks,
      impressions: desks.retail.impressions,
      unnamedSpend: unnamed,
    };
  }
  if (filter === "wholesale") {
    return {
      spend: desks.wholesale.spend,
      conversions: desks.wholesale.conversions,
      conversionValue: desks.wholesale.conversionValue,
      clicks: desks.wholesale.clicks,
      impressions: desks.wholesale.impressions,
      unnamedSpend: unnamed,
    };
  }
  return {
    spend: desks.retail.spend + desks.wholesale.spend + desks.unknown.spend,
    conversions: desks.retail.conversions + desks.wholesale.conversions + desks.unknown.conversions,
    conversionValue:
      desks.retail.conversionValue + desks.wholesale.conversionValue + desks.unknown.conversionValue,
    clicks: desks.retail.clicks + desks.wholesale.clicks + desks.unknown.clicks,
    impressions: desks.retail.impressions + desks.wholesale.impressions + desks.unknown.impressions,
    unnamedSpend: unnamed,
  };
}

export const MARKET_FILTER_SCHEMA = ["all", "retail", "wholesale"] as const;
export const MARKET_MODE_SCHEMA = ["mixed", "retail", "wholesale"] as const;
export const BRAND_MARKET_MODE_SCHEMA = ["inherit", "mixed", "retail", "wholesale"] as const;
