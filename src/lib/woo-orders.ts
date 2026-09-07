export interface WooMetaEntry {
  key?: string;
  value?: unknown;
}

export interface WooAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  typein: "direct",
  organic: "organic",
  referral: "referral",
  admin: "admin",
  utm: "utm",
};

function metaString(entries: WooMetaEntry[] | undefined, keys: string[]): string | null {
  if (!entries?.length) return null;
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  for (const entry of entries) {
    const key = (entry.key ?? "").toLowerCase();
    if (!wanted.has(key)) continue;
    const value = entry.value;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Map Woo REST / Order Attribution meta onto source / medium / campaign. */
export function extractWooAttribution(meta: WooMetaEntry[] | undefined): WooAttribution {
  const sourceType = (metaString(meta, ["_wc_order_attribution_source_type"]) ?? "").toLowerCase();
  const utmSource = metaString(meta, ["utm_source", "_wc_order_attribution_utm_source"]);
  const utmMedium = metaString(meta, ["utm_medium", "_wc_order_attribution_utm_medium"]);
  const utmCampaign = metaString(meta, ["utm_campaign", "_wc_order_attribution_utm_campaign"]);
  const referrer = metaString(meta, ["_wc_order_attribution_referrer"]);

  let source = utmSource;
  if (!source && sourceType && sourceType !== "utm") {
    source = SOURCE_TYPE_LABEL[sourceType] ?? sourceType;
  }
  if (!source && referrer) {
    try {
      source = new URL(referrer).hostname.replace(/^www\./, "") || referrer;
    } catch {
      source = referrer;
    }
  }

  return {
    source: source ? source.slice(0, 80) : null,
    medium: utmMedium ? utmMedium.slice(0, 80) : sourceType && sourceType !== "utm" ? sourceType : null,
    campaign: utmCampaign ? utmCampaign.slice(0, 120) : null,
  };
}

export function parseWooMoney(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function refundTotalFromWooOrder(order: {
  total_refunded?: string | number;
  refunds?: Array<{ total?: string | number }>;
}): number {
  const explicit = Math.abs(parseWooMoney(order.total_refunded));
  if (explicit > 0) return explicit;
  if (!Array.isArray(order.refunds) || order.refunds.length === 0) return 0;
  return order.refunds.reduce((sum, row) => sum + Math.abs(parseWooMoney(row.total)), 0);
}

/**
 * Woo `total` is already after discounts. Net keepable sales = total − refunds.
 * Gross is the pre-discount figure when discount_total is present.
 */
/** Woo REST tax: order `total_tax`, else cart_tax + shipping_tax. Never invent a rate. */
export function taxFromWooRest(order: {
  total_tax?: string | number;
  cart_tax?: string | number;
  shipping_tax?: string | number;
}): number {
  const totalTax = parseWooMoney(order.total_tax);
  if (totalTax > 0) return totalTax;
  return parseWooMoney(order.cart_tax) + parseWooMoney(order.shipping_tax);
}

export function moneyFromWooOrder(order: {
  total?: string | number;
  discount_total?: string | number;
  shipping_total?: string | number;
  total_tax?: string | number;
  cart_tax?: string | number;
  shipping_tax?: string | number;
  total_refunded?: string | number;
  refunds?: Array<{ total?: string | number }>;
}): {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  shipping: number;
  tax: number;
} {
  const total = parseWooMoney(order.total);
  const discounts = parseWooMoney(order.discount_total);
  const refunds = refundTotalFromWooOrder(order);
  const shipping = parseWooMoney(order.shipping_total);
  const tax = taxFromWooRest(order);
  return {
    grossSales: total + discounts,
    discounts,
    refunds,
    netSales: Math.max(0, total - refunds),
    shipping,
    tax,
  };
}

/** Do not treat net sales as profit when cost of goods is unknown. */
export function profitWhenCogsUnknown(costOfGoods: number, netSales: number): {
  costOfGoods: number;
  grossProfit: number;
} {
  const cost = Number.isFinite(costOfGoods) && costOfGoods > 0 ? costOfGoods : 0;
  return {
    costOfGoods: cost,
    grossProfit: cost > 0 ? netSales - cost : 0,
  };
}

/** Common Woo cost-of-goods meta keys (Cost of Goods, ATUM, WPFactory, etc.). */
export const WOO_COST_META_KEYS = [
  "_wc_cog_cost",
  "_alg_wc_cog_cost",
  "_wc_cog_cost_variable",
  "wc_cog_cost",
  "cost_of_good",
  "cost_of_goods",
  "_cost_of_goods",
  "_cost",
  "cogs",
  "_cogs",
  "_atum_purchase_price",
  "purchase_price",
  "_purchase_price",
] as const;

function parseCostValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = /^\d+,\d{1,4}$/.test(trimmed) ? trimmed.replace(",", ".") : trimmed;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Unit cost from product/variation meta. 0 means unknown — never invent cost. */
export function extractWooProductCost(meta: WooMetaEntry[] | undefined): number {
  if (!meta?.length) return 0;
  for (const wanted of WOO_COST_META_KEYS) {
    const needle = wanted.toLowerCase();
    for (const entry of meta) {
      if ((entry.key ?? "").toLowerCase() !== needle) continue;
      const cost = parseCostValue(entry.value);
      if (cost > 0) return cost;
    }
  }
  return 0;
}

export type WooLineForCogs = {
  product_id?: number;
  variation_id?: number;
  quantity?: number;
  total?: string | number;
};

export function costMapFromProducts(
  products: Array<{ productId: number; costOfGoods?: number | null }>,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const product of products) {
    const cost = Number(product.costOfGoods);
    if (product.productId > 0 && Number.isFinite(cost) && cost > 0) {
      map.set(product.productId, cost);
    }
  }
  return map;
}

/**
 * Order COGS only when every line has a known unit cost.
 * Partial catalogs stay at 0 so we never fake gross profit.
 */
export function orderCogsFromLineItems(
  lines: WooLineForCogs[] | undefined,
  costByProductId: Map<number, number>,
): number {
  if (!lines?.length) return 0;
  let total = 0;
  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) return 0;
    const variationId = Number(line.variation_id) || 0;
    const productId = Number(line.product_id) || 0;
    const unit =
      (variationId > 0 ? costByProductId.get(variationId) : undefined) ??
      (productId > 0 ? costByProductId.get(productId) : undefined);
    if (unit == null || !(unit > 0)) return 0;
    total += unit * qty;
  }
  return total;
}

/** Parent product ids whose variation costs are still missing from the catalog map. */
export function wooParentsNeedingVariationCosts(
  orders: Array<{ line_items?: WooLineForCogs[] }>,
  costByProductId: Map<number, number>,
): number[] {
  const parents = new Set<number>();
  for (const order of orders) {
    for (const line of order.line_items ?? []) {
      const variationId = Number(line.variation_id) || 0;
      const productId = Number(line.product_id) || 0;
      if (variationId > 0 && !costByProductId.has(variationId) && productId > 0) {
        parents.add(productId);
      }
    }
  }
  return [...parents];
}

/** Statuses excluded from till / MER. Partial refunds on completed orders still count. */
export const UNPAID_WOO_STATUS_LIST = [
  "pending",
  "cancelled",
  "failed",
  "checkout-draft",
  "auto-draft",
  "refunded",
] as const;

const UNPAID_WOO_STATUSES = new Set<string>(UNPAID_WOO_STATUS_LIST);

export function isPaidWooStatus(status: string | undefined): boolean {
  return Boolean(status) && !UNPAID_WOO_STATUSES.has(status!.toLowerCase());
}

/** Units and line net from paid orders. Used to rank catalog by till, not list price. */
export function soldTotalsFromWooOrders(
  orders: Array<{ status?: string; line_items?: WooLineForCogs[] }>,
): Map<number, { qty: number; net: number; parentId: number }> {
  const map = new Map<number, { qty: number; net: number; parentId: number }>();
  for (const order of orders) {
    if (!isPaidWooStatus(order.status)) continue;
    for (const line of order.line_items ?? []) {
      const parentId = Number(line.product_id) || 0;
      const variationId = Number(line.variation_id) || 0;
      const id = variationId || parentId;
      if (id <= 0) continue;
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) continue;
      const net = parseWooMoney(line.total);
      const prev = map.get(id) ?? { qty: 0, net: 0, parentId };
      map.set(id, {
        qty: prev.qty + qty,
        net: prev.net + net,
        parentId: prev.parentId || parentId,
      });
    }
  }
  return map;
}

export type CatalogProfitInput = {
  id: string;
  productId: number;
  sku: string | null;
  name: string;
  listPrice: number;
  cost: number;
  soldQty: number;
  soldNet: number;
  stockQty: number;
  stockStatus: string;
  isAdvertised: boolean;
};

/** Rank catalog by till contribution when sold qty exists; otherwise unit markup. */
export function rankCatalogProfitability(
  products: CatalogProfitInput[],
  sortBy: "profit" | "revenue" | "margin",
) {
  const hasSold = products.some((p) => p.soldQty > 0);
  const rankedBy = hasSold ? ("sold" as const) : ("unit" as const);
  const rows = products.map((p) => {
    const cogsKnown = p.cost > 0;
    const unitProfit = cogsKnown ? p.listPrice - p.cost : 0;
    const unitMargin = cogsKnown && p.listPrice > 0 ? (unitProfit / p.listPrice) * 100 : 0;
    const contribution = cogsKnown && p.soldQty > 0 ? p.soldNet - p.cost * p.soldQty : 0;
    const soldMargin = cogsKnown && p.soldNet > 0 ? (contribution / p.soldNet) * 100 : 0;
    return {
      ...p,
      cogsKnown,
      unitProfit,
      contribution,
      rankedBy,
      revenue: p.listPrice,
      profit: hasSold ? contribution : unitProfit,
      margin: hasSold ? soldMargin : unitMargin,
    };
  });
  rows.sort((a, b) => {
    if (sortBy === "profit") {
      const anyCogs = rows.some((row) => row.cogsKnown);
      if (!anyCogs) return hasSold ? b.soldNet - a.soldNet : b.listPrice - a.listPrice;
      return b.profit - a.profit;
    }
    if (sortBy === "revenue") return hasSold ? b.soldNet - a.soldNet : b.listPrice - a.listPrice;
    return b.margin - a.margin;
  });
  return { rows, rankedBy };
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** First chronological order per email is new; later orders are returning. */
export function classifyNewCustomers<T extends { id: string; customerEmail: string | null; dateCreated: Date }>(
  orders: T[],
): { newIds: string[]; returningIds: string[] } {
  const sorted = [...orders].sort((a, b) => a.dateCreated.getTime() - b.dateCreated.getTime());
  const seen = new Set<string>();
  const newIds: string[] = [];
  const returningIds: string[] = [];
  for (const order of sorted) {
    const email = normalizeEmail(order.customerEmail);
    if (!email) continue;
    if (seen.has(email)) returningIds.push(order.id);
    else {
      seen.add(email);
      newIds.push(order.id);
    }
  }
  return { newIds, returningIds };
}
