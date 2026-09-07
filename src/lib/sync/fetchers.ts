/**
 * Shared platform data-sync fetchers and batch persistence helpers.
 *
 * Extracted from `src/app/api/sync/[platform]/route.ts` so that both the
 * on-demand REST sync route and the BullMQ background workers reuse exactly
 * the same platform API logic and Prisma write path.
 *
 * Every fetcher normalizes its platform response into `DailyMetricInput`
 * rows (or commerce records for Woo / OpenCart). Woo orders and products
 * are upserted so a re-sync refreshes totals, UTM, stock and new/returning.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encodeBrevoExtra } from "@/lib/email-desk";
import type { DateRange, NormalizedCampaign, NormalizedMetric } from "@/lib/mcp/types";
import { safeFetch } from "@/lib/safe-fetch";
import {
  DAILY_METRIC_DATE_WINDOW,
  DAILY_METRIC_INSERT_CHUNK,
  chunkArray,
  dedupeDailyMetrics,
  toDailyMetricCreateData,
  windowSortedDates,
} from "@/lib/sync/daily-metric-rows";
import { wooRestGet } from "@/lib/woocommerce-rest";
import { classifyWooOrderMarket, type MarketMode } from "@/lib/market-desk";
import { loadShopMarketMode } from "@/lib/shop-market-mode";
import {
  classifyNewCustomers,
  costMapFromProducts,
  extractWooAttribution,
  extractWooProductCost,
  moneyFromWooOrder,
  orderCogsFromLineItems,
  profitWhenCogsUnknown,
  soldTotalsFromWooOrders,
  wooParentsNeedingVariationCosts,
} from "@/lib/woo-orders";
import { fetchMetaAccountSync, type MetaCampaignObject } from "@/lib/meta/graph";
import {
  googleAdsLoginCustomerId,
  googleAdsSearchRows,
  parseGoogleAdsCustomerId,
} from "@/lib/google-ads-accounts";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A normalized daily-metric row ready to be persisted to `DailyMetric`. */
export interface DailyMetricInput {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  campaignId?: string;
  campaignName?: string;
  reach?: number;
  frequency?: number;
  linkClicks?: number;
  landingPageViews?: number;
  addToCart?: number;
  checkouts?: number;
  websitePurchases?: number;
  websitePurchaseValue?: number;
  results?: number;
  resultType?: string | null;
  attributionSetting?: string | null;
}

export interface AdCampaignInput {
  platformCampaignId: string;
  name: string;
  status: string;
  effectiveStatus?: string | null;
  objective?: string | null;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  budgetType?: string | null;
  currency?: string;
  attributionSetting?: string | null;
  startTime?: Date | null;
  stopTime?: Date | null;
  createdTime?: Date | null;
  updatedTime?: Date | null;
}

/** Raw WooCommerce order shape returned by the Woo REST API
 *  (OpenCart orders are mapped into this shape as well). */
export interface WooOrderRaw {
  id: number;
  number: string;
  status: string;
  date_created: string;
  currency: string;
  total: string;
  total_tax: string;
  cart_tax?: string;
  shipping_tax?: string;
  shipping_total: string;
  discount_total: string;
  total_refunded?: string;
  refunds?: Array<{ total?: string }>;
  customer_id?: number;
  coupon_lines?: Array<{ code?: string }>;
  billing: {
    email?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    vat?: string;
    vat_number?: string;
  };
  line_items: Array<{
    product_id?: number;
    variation_id?: number;
    quantity: number;
    total: string;
  }>;
  meta_data?: Array<{ key?: string; value?: unknown }>;
}

/** A normalized product row ready to be persisted to `WooProduct`. */
export interface WooProductInput {
  productId: number;
  sku?: string;
  name: string;
  price: number;
  costOfGoods?: number;
  stockQty?: number;
  stockStatus?: string;
}

/** Everything an OpenCart sync produces: mapped orders, products and the
 *  daily revenue aggregation derived from the fetched orders. */
export interface OpenCartSyncResult {
  orders: WooOrderRaw[];
  products: WooProductInput[];
  metrics: DailyMetricInput[];
}

// ---------------------------------------------------------------------------
// Meta (Facebook) Marketing API
// ---------------------------------------------------------------------------

/**
 * Fetch daily campaign insights plus campaign objects for a Meta ad account.
 */
export async function fetchMetaAccountData(
  accessToken: string,
  accountId: string,
  dateRange: DateRange,
): Promise<{ metrics: DailyMetricInput[]; campaigns: AdCampaignInput[] }> {
  const { metrics, campaigns } = await fetchMetaAccountSync(accessToken, accountId, dateRange);
  return {
    metrics,
    campaigns: campaigns.map(campaignObjectToInput),
  };
}

function campaignObjectToInput(c: MetaCampaignObject): AdCampaignInput {
  return {
    platformCampaignId: c.platformCampaignId,
    name: c.name,
    status: c.status,
    effectiveStatus: c.effectiveStatus,
    objective: c.objective,
    dailyBudget: c.dailyBudget,
    lifetimeBudget: c.lifetimeBudget,
    budgetType: c.budgetType,
    attributionSetting: c.attributionSetting,
    startTime: c.startTime,
    stopTime: c.stopTime,
    createdTime: c.createdTime,
    updatedTime: c.updatedTime,
  };
}

/**
 * Fetch daily insights for a Meta ad account and normalize them into
 * `DailyMetricInput` rows.
 */
export async function fetchMetaMetrics(
  accessToken: string,
  accountId: string,
  dateRange: DateRange,
): Promise<DailyMetricInput[]> {
  const { metrics } = await fetchMetaAccountData(accessToken, accountId, dateRange);
  return metrics;
}

// ---------------------------------------------------------------------------
// Google Ads API
// ---------------------------------------------------------------------------

interface GoogleMetricRow {
  segments: { date: string };
  campaign: {
    id?: string;
    name?: string;
  };
  metrics: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: string;
    conversionsValue?: string;
  };
}

/**
 * Fetch daily CAMPAIGN-level metrics for a Google Ads customer via GAQL
 * searchStream and normalize them into `DailyMetricInput` rows.
 *
 * The caller is responsible for passing an already-refreshed access token —
 * OAuth refresh handling lives in the sync route, which re-encrypts and
 * persists new tokens before invoking this fetcher.
 */
export async function fetchGoogleMetrics(
  accessToken: string,
  customerId: string,
  dateRange: DateRange,
): Promise<DailyMetricInput[]> {
  const { startDate, endDate } = dateRange;
  const cid = parseGoogleAdsCustomerId(customerId);
  if (!cid) {
    throw new Error("Pick a Google Ads account on Connections before syncing.");
  }

  const gaqlQuery = `
    SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
  `.trim();

  const rows = await googleAdsSearchRows<GoogleMetricRow>(
    accessToken,
    cid,
    gaqlQuery,
    googleAdsLoginCustomerId(customerId),
  );

  return rows.map((r) => ({
    date: r.segments.date,
    spend: (parseInt(r.metrics.costMicros ?? "0", 10) || 0) / 1_000_000,
    impressions: parseInt(r.metrics.impressions ?? "0", 10),
    clicks: parseInt(r.metrics.clicks ?? "0", 10),
    conversions: parseFloat(r.metrics.conversions ?? "0"),
    conversionValue: parseFloat(r.metrics.conversionsValue ?? "0"),
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
  }));
}

// ---------------------------------------------------------------------------
// TikTok Business API
// ---------------------------------------------------------------------------

interface TikTokRow {
  dimensions: { stat_time_day: string };
  metrics: {
    spend?: string;
    impression?: string;
    click?: string;
    conversion?: string;
    conversion_value?: string;
  };
}

/**
 * Fetch daily metrics for a TikTok advertiser and normalize them into
 * `DailyMetricInput` rows.
 */
export async function fetchTikTokMetrics(
  accessToken: string,
  advertiserId: string,
  dateRange: DateRange,
): Promise<DailyMetricInput[]> {
  const { startDate, endDate } = dateRange;
  const url = new URL(
    "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
  );
  // BASIC reports accept a single `advertiser_id` (not the legacy
  // `advertiser_ids` array used by AUDIENCE reports).
  url.searchParams.set("advertiser_id", advertiserId);
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set(
    "dimensions",
    JSON.stringify(["stat_time_day"]),
  );
  url.searchParams.set(
    "metrics",
    JSON.stringify(["spend", "impression", "click", "conversion", "conversion_value"]),
  );
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("page_size", "1000");

  const res = await safeFetch(url.toString(), {
    headers: { "Access-Token": accessToken },
    timeoutMs: 20_000,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikTok API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`TikTok API error (code ${data.code}): ${data.message}`);
  }

  const rows = (data.data?.list ?? []) as TikTokRow[];
  return rows.map((r) => ({
    date: r.dimensions.stat_time_day,
    spend: parseFloat(r.metrics.spend ?? "0"),
    impressions: parseInt(r.metrics.impression ?? "0", 10),
    clicks: parseInt(r.metrics.click ?? "0", 10),
    conversions: parseFloat(r.metrics.conversion ?? "0"),
    conversionValue: parseFloat(r.metrics.conversion_value ?? "0"),
  }));
}

// ---------------------------------------------------------------------------
// WooCommerce REST API
// ---------------------------------------------------------------------------

const WOO_PAGE_SIZE = 100;
const WOO_MAX_ORDER_PAGES = 50;
const WOO_MAX_PRODUCT_PAGES = 200;

/**
 * Fetch all WooCommerce orders created inside the given date range
 * (paginated) and return them in their raw Woo shape.
 */
export async function fetchWooOrders(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  dateRange: DateRange,
): Promise<WooOrderRaw[]> {
  const { startDate, endDate } = dateRange;
  const allOrders: WooOrderRaw[] = [];
  let page = 1;

  while (page <= WOO_MAX_ORDER_PAGES) {
    const result = await wooRestGet({
      storeUrl,
      path: "orders",
      consumerKey,
      consumerSecret,
      searchParams: {
        after: `${startDate}T00:00:00`,
        before: `${endDate}T23:59:59`,
        per_page: String(WOO_PAGE_SIZE),
        status: "any",
        page: String(page),
        order: "asc",
        // Omit `_fields` and `orderby`. BAGTOBAG Cloudflare custom rules
        // blocked/challenged `orderby=date`; neither param is required.
      },
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    const orders = result.json as WooOrderRaw[];
    if (!Array.isArray(orders) || orders.length === 0) break;
    allOrders.push(...orders);
    if (orders.length < WOO_PAGE_SIZE) break;
    if (page === WOO_MAX_ORDER_PAGES) {
      throw new Error(
        `WooCommerce order sync reached its safety limit (${WOO_MAX_ORDER_PAGES * WOO_PAGE_SIZE} records). Narrow the date range and retry.`,
      );
    }
    page++;
    await new Promise((r) => setTimeout(r, 120));
  }

  return allOrders;
}

const WOO_WHOLESALE_ROLES = [
  "wholesale_customer",
  "wholesale",
  "b2b_customer",
  "b2bking_b2b",
] as const;

/** Best-effort wholesale customer ids. A missing role endpoint is not a sync failure. */
export async function fetchWooWholesaleCustomerIds(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<Set<number>> {
  const ids = new Set<number>();
  for (const role of WOO_WHOLESALE_ROLES) {
    let page = 1;
    while (page <= 10) {
      const result = await wooRestGet({
        storeUrl,
        path: "customers",
        consumerKey,
        consumerSecret,
        searchParams: {
          role,
          per_page: "100",
          page: String(page),
        },
      });
      if (!result.ok || !Array.isArray(result.json)) break;
      const rows = result.json as Array<{ id?: number }>;
      if (rows.length === 0) break;
      for (const row of rows) {
        const id = Number(row.id) || 0;
        if (id > 0) ids.add(id);
      }
      if (rows.length < 100) break;
      page += 1;
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  return ids;
}

interface RawWooProduct {
  id: number;
  name?: string;
  sku?: string;
  price?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  meta_data?: Array<{ key?: string; value?: unknown }>;
}

const WOO_MAX_VARIATION_PARENTS = 200;

/** Paginated product catalog (price + stock) for the connected store. */
export async function fetchWooProducts(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<WooProductInput[]> {
  const products: WooProductInput[] = [];
  let page = 1;

  while (page <= WOO_MAX_PRODUCT_PAGES) {
    const result = await wooRestGet({
      storeUrl,
      path: "products",
      consumerKey,
      consumerSecret,
      searchParams: {
        per_page: String(WOO_PAGE_SIZE),
        status: "any",
        page: String(page),
      },
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    const rows = result.json as RawWooProduct[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const p of rows) {
      if (!p?.id) continue;
      const costOfGoods = extractWooProductCost(p.meta_data);
      products.push({
        productId: p.id,
        sku: p.sku || undefined,
        name: p.name ?? `Product ${p.id}`,
        price: parseFloat(p.price ?? "0") || 0,
        ...(costOfGoods > 0 ? { costOfGoods } : {}),
        stockQty: p.stock_quantity ?? 0,
        stockStatus: p.stock_status ?? "instock",
      });
    }
    if (rows.length < WOO_PAGE_SIZE) break;
    if (page === WOO_MAX_PRODUCT_PAGES) {
      throw new Error(
        `WooCommerce product sync reached its safety limit (${WOO_MAX_PRODUCT_PAGES * WOO_PAGE_SIZE} records).`,
      );
    }
    page++;
    await new Promise((r) => setTimeout(r, 120));
  }

  return products;
}

/**
 * Variation unit costs are not on the parent product list. Fetch only parents
 * that appear on orders with a variation_id still missing from the cost map.
 * Failures are skipped so a 404 parent cannot abort the whole Woo sync.
 */
export async function fetchWooVariationCostRows(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  parentIds: number[],
): Promise<WooProductInput[]> {
  const extra: WooProductInput[] = [];
  const unique = [...new Set(parentIds.filter((id) => id > 0))].slice(
    0,
    WOO_MAX_VARIATION_PARENTS,
  );

  for (const parentId of unique) {
    let page = 1;
    while (page <= 5) {
      const result = await wooRestGet({
        storeUrl,
        path: `products/${parentId}/variations`,
        consumerKey,
        consumerSecret,
        searchParams: {
          per_page: "100",
          page: String(page),
        },
      });
      if (!result.ok) break;
      const rows = result.json as RawWooProduct[];
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const variation of rows) {
        if (!variation?.id) continue;
        const costOfGoods = extractWooProductCost(variation.meta_data);
        extra.push({
          productId: variation.id,
          sku: variation.sku || undefined,
          name: variation.name ?? `Variation ${variation.id}`,
          price: parseFloat(variation.price ?? "0") || 0,
          ...(costOfGoods > 0 ? { costOfGoods } : {}),
          stockQty: variation.stock_quantity ?? 0,
          stockStatus: variation.stock_status ?? "instock",
        });
      }
      if (rows.length < 100) break;
      page += 1;
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  return extra;
}

/** Fetch catalog + orders, persist products first so order COGS can use costs. */
export async function persistWooCommerceSync(args: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  brandId: string;
  dateRange: DateRange;
}): Promise<{ orderCount: number; productCount: number }> {
  const [orders, wholesaleCustomerIds] = await Promise.all([
    fetchWooOrders(
      args.storeUrl,
      args.consumerKey,
      args.consumerSecret,
      args.dateRange,
    ),
    fetchWooWholesaleCustomerIds(
      args.storeUrl,
      args.consumerKey,
      args.consumerSecret,
    ),
  ]);
  const products = await fetchWooProducts(
    args.storeUrl,
    args.consumerKey,
    args.consumerSecret,
  );
  let costMap = costMapFromProducts(products);
  const parents = wooParentsNeedingVariationCosts(orders, costMap);
  const variations =
    parents.length > 0
      ? await fetchWooVariationCostRows(
          args.storeUrl,
          args.consumerKey,
          args.consumerSecret,
          parents,
        )
      : [];
  const catalog = [...products, ...variations];
  costMap = costMapFromProducts(catalog);
  const productCount = await upsertWooProducts(catalog, args.brandId);
  const orderCount = await upsertWooOrders(
    orders,
    args.brandId,
    costMap,
    wholesaleCustomerIds,
  );
  await prisma.adAccount.updateMany({
    where: { brandId: args.brandId, platform: "woocommerce" },
    data: { lastSyncAt: new Date() },
  });
  return { orderCount, productCount };
}

// ---------------------------------------------------------------------------
// OpenCart 3.x REST API (read-only)
// ---------------------------------------------------------------------------

/** OpenCart 3.x `api/login` response. */
interface OpenCartLoginResponse {
  api_token?: string;
  success?: string;
  error?: string;
}

/** Raw order row returned by `api/sale/order`. Field set varies by version;
 *  missing fields fall back to sensible defaults during mapping. */
interface OpenCartOrderRaw {
  order_id?: number | string;
  invoice_no?: string;
  order_number?: string;
  order_status?: string;
  status?: string;
  date_added?: string;
  date_modified?: string;
  currency_code?: string;
  currency?: string;
  total?: string | number;
  tax?: string | number;
  shipping?: string | number;
  discount?: string | number;
  email?: string;
  customer?: string;
  products?: number | string;
  totals?: Array<{ title: string; value: string | number }>;
}

/** Raw product row returned by `api/catalog/product`. */
interface OpenCartProductRaw {
  product_id?: number | string;
  sku?: string;
  model?: string;
  name?: string;
  price?: string | number;
  cost?: string | number;
  quantity?: number | string;
  stock_status?: string;
  status?: string;
}

/** Parse an OpenCart money value which may be a number, a plain decimal
 *  string, or a currency-formatted string like "$1,234.00". */
function parseOpenCartMoney(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Login to OpenCart and return the api_token used for subsequent GET calls. */
async function openCartLogin(
  storeUrl: string,
  username: string,
  apiKey: string,
): Promise<string> {
  const base = storeUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/index.php`);
  url.searchParams.set("route", "api/login");

  const res = await safeFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, key: apiKey }).toString(),
    timeoutMs: 20_000,
  });

  const data = (await res.json().catch(() => ({}))) as OpenCartLoginResponse;
  if (!res.ok || !data.api_token) {
    throw new Error(
      `OpenCart login failed (${res.status}): ${data.error ?? "No api_token returned"}`,
    );
  }
  return data.api_token;
}

/** GET helper that appends the api_token to every OpenCart request. */
async function openCartGet<T>(
  storeUrl: string,
  route: string,
  apiToken: string,
  extraParams: Record<string, string> = {},
): Promise<T> {
  const base = storeUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/index.php`);
  url.searchParams.set("route", route);
  url.searchParams.set("api_token", apiToken);
  for (const [k, v] of Object.entries(extraParams)) {
    url.searchParams.set(k, v);
  }
  const res = await safeFetch(url.toString(), { timeoutMs: 20_000 });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenCart API error (${res.status}) [${route}]: ${body}`);
  }
  return (await res.json()) as T;
}

/** Normalise the OpenCart order list payload into an array. The list endpoint
 *  may return a bare array or an object with `orders`/`data`/`order`. */
function asOpenCartOrderArray(payload: unknown): OpenCartOrderRaw[] {
  if (Array.isArray(payload)) return payload as OpenCartOrderRaw[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const inner =
      (obj.orders as OpenCartOrderRaw[] | undefined) ??
      (obj.data as OpenCartOrderRaw[] | undefined) ??
      (obj.order as OpenCartOrderRaw[] | undefined);
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

async function fetchOpenCartOrders(
  storeUrl: string,
  apiToken: string,
  startDate: string,
  endDate: string,
): Promise<OpenCartOrderRaw[]> {
  const all: OpenCartOrderRaw[] = [];
  let page = 1;
  const limit = 100;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:59:59Z`);

  while (true) {
    const payload = await openCartGet<unknown>(
      storeUrl,
      "api/sale/order",
      apiToken,
      { page: String(page), limit: String(limit) },
    );
    const rows = asOpenCartOrderArray(payload);
    if (!rows.length) break;
    for (const r of rows) {
      const created = r.date_added
        ? new Date(r.date_added.replace(" ", "T"))
        : null;
      if (created && created >= start && created <= end) {
        all.push(r);
      }
    }
    if (rows.length < limit) break;
    page++;
    if (page > 200) break; // guard against runaway pagination
  }
  return all;
}

function asOpenCartProductArray(payload: unknown): OpenCartProductRaw[] {
  if (Array.isArray(payload)) return payload as OpenCartProductRaw[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const inner =
      (obj.products as OpenCartProductRaw[] | undefined) ??
      (obj.data as OpenCartProductRaw[] | undefined);
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

async function fetchOpenCartProducts(
  storeUrl: string,
  apiToken: string,
): Promise<OpenCartProductRaw[]> {
  const all: OpenCartProductRaw[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const payload = await openCartGet<unknown>(
      storeUrl,
      "api/catalog/product",
      apiToken,
      { page: String(page), limit: String(limit) },
    );
    const rows = asOpenCartProductArray(payload);
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < limit) break;
    page++;
    if (page > 200) break; // guard against runaway pagination
  }
  return all;
}

/** Map an OpenCart order into the WooCommerce order shape so the existing
 *  `upsertWooOrders` helper can persist it unchanged (reuses the WooOrder
 *  table). Missing OpenCart fields fall back to safe defaults. */
function mapOpenCartOrderToWoo(o: OpenCartOrderRaw): WooOrderRaw {
  const id = Number(o.order_id ?? 0) || 0;
  const number = String(o.invoice_no || o.order_number || (o.order_id ?? id));
  const status = o.order_status || o.status || "unknown";
  const dateCreated = o.date_added
    ? o.date_added.replace(" ", "T")
    : new Date().toISOString();
  const currency = o.currency_code || o.currency || "EUR";
  const total = parseOpenCartMoney(o.total);

  // Some OpenCart builds expose a totals breakdown (title/value pairs such
  // as "Sub-Total", "Shipping", "Tax", "Total"); fall back to those when the
  // flat fields are absent.
  const findTotal = (title: RegExp): number => {
    const t = (o.totals ?? []).find((x) => title.test(x.title));
    return t ? parseOpenCartMoney(t.value) : 0;
  };
  const tax = parseOpenCartMoney(o.tax) || findTotal(/^tax/i);
  const shipping = parseOpenCartMoney(o.shipping) || findTotal(/^shipping/i);
  const discount = parseOpenCartMoney(o.discount) || findTotal(/coupon|discount/i);
  const itemCount = Math.max(1, Number(o.products ?? 1) || 1);

  return {
    id,
    number,
    status,
    date_created: dateCreated,
    currency,
    total: String(total),
    total_tax: String(tax),
    shipping_total: String(shipping),
    discount_total: String(discount),
    billing: { email: o.email },
    line_items: [{ quantity: itemCount, total: String(total) }],
    meta_data: [],
  };
}

/**
 * Run a full read-only OpenCart sync for one store.
 *
 * Credential mapping (matches what the connections route stores):
 *  - `accessToken`  → OpenCart API username
 *  - `refreshToken` → OpenCart API key
 *  - `accountId`    → store base URL
 *
 * Logs in to obtain a fresh `api_token`, fetches orders (filtered to the
 * date range) and products, maps them to the WooCommerce shapes, and
 * aggregates order revenue into daily metric rows.
 */
export async function fetchOpenCartData(
  accessToken: string,
  refreshToken: string,
  accountId: string,
  dateRange: DateRange,
): Promise<OpenCartSyncResult> {
  const storeUrl = accountId;
  const username = accessToken;
  const apiKey = refreshToken;

  // 1. Login to obtain a fresh api_token
  const apiToken = await openCartLogin(storeUrl, username, apiKey);

  // 2. Fetch orders + products (read-only GETs)
  const ocOrders = await fetchOpenCartOrders(storeUrl, apiToken, dateRange.startDate, dateRange.endDate);
  const ocProducts = await fetchOpenCartProducts(storeUrl, apiToken);

  // 3. Map orders → WooOrderRaw (reuses the WooOrder table)
  const orders = ocOrders.map(mapOpenCartOrderToWoo);

  // 4. Map products → WooProduct rows
  const products: WooProductInput[] = ocProducts.map((p) => ({
    productId: Number(p.product_id ?? 0) || 0,
    sku: p.sku || p.model || undefined,
    name: p.name ?? `OpenCart Product ${p.product_id ?? ""}`,
    price: parseOpenCartMoney(p.price),
    costOfGoods: parseOpenCartMoney(p.cost),
    stockQty: Number(p.quantity ?? 0) || 0,
    stockStatus:
      p.stock_status ?? (p.status === "Disabled" ? "outofstock" : "instock"),
  }));

  // 5. Aggregate order revenue into daily metrics (platform "opencart")
  const daily = new Map<string, DailyMetricInput>();
  for (const o of orders) {
    const day = o.date_created.slice(0, 10);
    if (!day) continue;
    const entry =
      daily.get(day) ??
      { date: day, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 };
    entry.conversions += 1;
    const netSales =
      (parseFloat(o.total) || 0) - (parseFloat(o.discount_total) || 0);
    entry.conversionValue += netSales;
    daily.set(day, entry);
  }

  return { orders, products, metrics: Array.from(daily.values()) };
}

// ---------------------------------------------------------------------------
// Omnisend Email Marketing API
// ---------------------------------------------------------------------------

interface OmnisendCampaign {
  id: string;
  name?: string;
  status?: string;
  sentAt?: string;
  stats?: {
    sentCount?: number;
    openCount?: number;
    clickCount?: number;
    ordersCount?: number;
    revenue?: number;
  };
}

interface OmnisendCampaignResponse {
  campaigns?: OmnisendCampaign[];
}

/**
 * Fetch Omnisend campaigns sent inside the date range and aggregate their
 * stats into daily `DailyMetricInput` rows.
 *
 * Mapping: impressions = emails sent, clicks = email clicks,
 * conversions = orders from email, spend = 0 (email has no ad spend).
 */
export async function fetchOmnisendData(
  accessToken: string,
  dateRange: DateRange,
): Promise<DailyMetricInput[]> {
  const { startDate, endDate } = dateRange;
  const url = new URL("https://api.omnisend.com/v3/campaigns");
  url.searchParams.set("limit", "1000");

  const res = await safeFetch(url.toString(), {
    headers: { "X-API-Key": accessToken },
    timeoutMs: 20_000,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Omnisend API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as OmnisendCampaignResponse;
  const campaigns = data.campaigns ?? [];

  // Filter sent campaigns whose send date falls within the requested range,
  // then aggregate their stats by day.
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:59:59Z`);

  const daily = new Map<string, DailyMetricInput>();

  for (const c of campaigns) {
    if (!c.sentAt) continue;
    const sentDate = new Date(c.sentAt);
    if (sentDate < start || sentDate > end) continue;

    const day = sentDate.toISOString().slice(0, 10);
    const entry =
      daily.get(day) ??
      { date: day, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 };

    entry.impressions += c.stats?.sentCount ?? 0;
    entry.clicks += c.stats?.clickCount ?? 0;
    entry.conversions += c.stats?.ordersCount ?? 0;
    entry.conversionValue += c.stats?.revenue ?? 0;
    // entry.spend stays 0 (email has no ad spend)
    daily.set(day, entry);
  }

  return Array.from(daily.values());
}

// ---------------------------------------------------------------------------
// Brevo (Sendinblue) Email Marketing API
// ---------------------------------------------------------------------------

interface BrevoStatBlock {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicks?: number;
  uniqueClicks?: number;
  uniqueViews?: number;
  viewed?: number;
  clickers?: number;
  hardBounces?: number;
  softBounces?: number;
  unsubscriptions?: number;
  complaints?: number;
  appleMppOpens?: number;
  listId?: number;
}

interface BrevoCampaign {
  id?: number | string;
  name?: string;
  status?: string;
  type?: string;
  sentDate?: string;
  scheduledAt?: string;
  createdAt?: string;
  subject?: string;
  tags?: string[];
  recipients?: { lists?: number[] };
  statistics?: {
    sent?: number;
    delivered?: number;
    opened?: number;
    clicks?: number;
    uniqueClicks?: number;
    uniqueViews?: number;
    viewed?: number;
    campaignStats?: BrevoStatBlock[];
    globalStats?: BrevoStatBlock;
  };
}

interface BrevoCampaignResponse {
  count?: number;
  campaigns?: BrevoCampaign[];
}

/**
 * Brevo emailCampaigns startDate/endDate must be UTC ISO-8601, not YYYY-MM-DD.
 * YYYY-MM-DD returns 400 invalid_parameter "Invalid date-time filter".
 * End-of-day UTC for "today" is still in the future and returns
 * "End date should not be greater than current date".
 */
export function brevoCampaignDateParams(
  startDate: string,
  endDate: string,
  now = new Date(),
): {
  startDate: string;
  endDate: string;
} {
  const start = startDate.includes("T") ? startDate : `${startDate}T00:00:00.000Z`;
  const rawEnd = endDate.includes("T") ? endDate : `${endDate}T23:59:59.999Z`;
  const endMs = Date.parse(rawEnd);
  const end = Number.isFinite(endMs) && endMs > now.getTime() ? now.toISOString() : rawEnd;
  return { startDate: start, endDate: end };
}

export function firstPositiveBrevoCount(...values: Array<number | undefined>): number {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function sumBrevoCampaignStats(rows: BrevoStatBlock[] | undefined): BrevoStatBlock {
  const out: Required<
    Pick<
      BrevoStatBlock,
      | "sent"
      | "delivered"
      | "uniqueClicks"
      | "clickers"
      | "uniqueViews"
      | "viewed"
      | "opened"
      | "hardBounces"
      | "softBounces"
      | "unsubscriptions"
      | "complaints"
      | "appleMppOpens"
    >
  > = {
    sent: 0,
    delivered: 0,
    uniqueClicks: 0,
    clickers: 0,
    uniqueViews: 0,
    viewed: 0,
    opened: 0,
    hardBounces: 0,
    softBounces: 0,
    unsubscriptions: 0,
    complaints: 0,
    appleMppOpens: 0,
  };
  for (const row of rows ?? []) {
    out.sent += Number(row.sent) || 0;
    out.delivered += Number(row.delivered) || 0;
    out.uniqueClicks += Number(row.uniqueClicks) || 0;
    out.clickers += Number(row.clickers) || 0;
    out.uniqueViews += Number(row.uniqueViews) || 0;
    out.viewed += Number(row.viewed) || 0;
    out.opened += Number(row.opened) || 0;
    out.hardBounces += Number(row.hardBounces) || 0;
    out.softBounces += Number(row.softBounces) || 0;
    out.unsubscriptions += Number(row.unsubscriptions) || 0;
    out.complaints += Number(row.complaints) || 0;
    out.appleMppOpens += Number(row.appleMppOpens) || 0;
  }
  return out;
}

export function brevoCampaignStats(campaign: BrevoCampaign): {
  sent: number;
  delivered: number;
  clicks: number;
  opened: number;
  hardBounces: number;
  softBounces: number;
  unsubscriptions: number;
  complaints: number;
  appleMppOpens: number;
} {
  const global = campaign.statistics?.globalStats ?? {};
  const lists = sumBrevoCampaignStats(campaign.statistics?.campaignStats);
  const flat = campaign.statistics ?? {};
  const sent = firstPositiveBrevoCount(global.sent, lists.sent, flat.sent);
  const delivered = firstPositiveBrevoCount(global.delivered, lists.delivered, flat.delivered, sent);
  const clicks = firstPositiveBrevoCount(
    global.uniqueClicks,
    global.clickers,
    lists.uniqueClicks,
    lists.clickers,
    flat.uniqueClicks,
    flat.clicks,
  );
  const opened = firstPositiveBrevoCount(
    global.uniqueViews,
    global.viewed,
    global.opened,
    lists.uniqueViews,
    lists.viewed,
    lists.opened,
    flat.uniqueViews,
    flat.opened,
  );
  return {
    sent,
    delivered,
    clicks,
    opened,
    hardBounces: firstPositiveBrevoCount(global.hardBounces, lists.hardBounces),
    softBounces: firstPositiveBrevoCount(global.softBounces, lists.softBounces),
    unsubscriptions: firstPositiveBrevoCount(global.unsubscriptions, lists.unsubscriptions),
    complaints: firstPositiveBrevoCount(global.complaints, lists.complaints),
    appleMppOpens: firstPositiveBrevoCount(global.appleMppOpens, lists.appleMppOpens),
  };
}

export function mapBrevoCampaignsToMetrics(
  campaigns: BrevoCampaign[],
  dateRange: DateRange,
): DailyMetricInput[] {
  const start = new Date(`${dateRange.startDate}T00:00:00Z`);
  const end = new Date(`${dateRange.endDate}T23:59:59Z`);
  const rows: DailyMetricInput[] = [];
  for (const campaign of campaigns) {
    const sentRaw = campaign.sentDate || campaign.scheduledAt;
    if (!sentRaw) continue;
    const sentAt = new Date(sentRaw);
    if (Number.isNaN(sentAt.getTime()) || sentAt < start || sentAt > end) continue;
    const stats = brevoCampaignStats(campaign);
    const delivered = stats.delivered || stats.sent;
    if (delivered <= 0 && stats.clicks <= 0 && stats.opened <= 0) continue;
    const listIds = [
      ...new Set(
        [
          ...(campaign.recipients?.lists ?? []),
          ...(campaign.statistics?.campaignStats ?? []).map((row) => row.listId),
        ].filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
      ),
    ];
    rows.push({
      date: sentAt.toISOString().slice(0, 10),
      spend: 0,
      impressions: delivered,
      clicks: stats.clicks,
      conversions: 0,
      conversionValue: 0,
      campaignId: String(campaign.id ?? ""),
      campaignName: campaign.name?.trim() || `Brevo ${campaign.id ?? "campaign"}`,
      reach: stats.opened,
      linkClicks: stats.clicks,
      landingPageViews: stats.sent || delivered,
      frequency: stats.appleMppOpens,
      results: stats.opened,
      resultType: "brevo_email",
      attributionSetting: encodeBrevoExtra({
        v: 1,
        sent: stats.sent || delivered,
        hardBounces: stats.hardBounces,
        softBounces: stats.softBounces,
        unsubscriptions: stats.unsubscriptions,
        complaints: stats.complaints,
        appleMppOpens: stats.appleMppOpens,
        subject: campaign.subject,
        tags: campaign.tags,
        listIds,
      }),
    });
  }
  return rows;
}

export function countSentBrevoArchive(
  campaigns: Array<{
    sentDate?: string;
    scheduledAt?: string;
    statistics?: BrevoCampaign["statistics"];
  }>,
): number {
  let n = 0;
  for (const campaign of campaigns) {
    const sentRaw = campaign.sentDate || campaign.scheduledAt;
    if (!sentRaw) continue;
    const stats = brevoCampaignStats(campaign);
    if ((stats.delivered || stats.sent) > 0) n += 1;
  }
  return n;
}

async function listBrevoCampaigns(
  accessToken: string,
  dateFilter: { startDate: string; endDate: string } | null,
): Promise<BrevoCampaign[]> {
  const collected: BrevoCampaign[] = [];
  for (let offset = 0; offset < 1_000; offset += 50) {
    const url = new URL("https://api.brevo.com/v3/emailCampaigns");
    url.searchParams.set("status", "sent");
    url.searchParams.set("statistics", "globalStats");
    url.searchParams.set("excludeHtmlContent", "true");
    url.searchParams.set("limit", "50");
    url.searchParams.set("offset", String(offset));
    if (dateFilter) {
      url.searchParams.set("startDate", dateFilter.startDate);
      url.searchParams.set("endDate", dateFilter.endDate);
    }
    const res = await safeFetch(url.toString(), {
      headers: { "api-key": accessToken },
      timeoutMs: 20_000,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API error (${res.status}): ${body}`);
    }
    const data = (await res.json()) as BrevoCampaignResponse;
    const page = data.campaigns ?? [];
    collected.push(...page);
    if (page.length < 50) break;
  }
  return collected;
}

export async function countBrevoSentArchive(accessToken: string): Promise<number> {
  const campaigns = await listBrevoCampaigns(accessToken, null);
  return countSentBrevoArchive(campaigns);
}

/**
 * Fetch every sent Brevo classic through endDate as campaign-day DailyMetric
 * rows. The operator desk still windows by date; older rows are an archive,
 * not a KPI mix. conversionValue stays 0 — Brevo has no order revenue here.
 */
export async function fetchBrevoData(
  accessToken: string,
  dateRange: DateRange,
): Promise<DailyMetricInput[]> {
  const campaigns = await listBrevoCampaigns(accessToken, null);
  const rows = mapBrevoCampaignsToMetrics(campaigns, {
    startDate: "2015-01-01",
    endDate: dateRange.endDate,
  });
  if (campaigns.length > 0 && rows.length === 0) {
    console.warn(
      `[brevo] listed ${campaigns.length} campaigns but mapped 0 DailyMetric rows through ${dateRange.endDate}`,
    );
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Batch persistence helpers
// ---------------------------------------------------------------------------

async function withSerializableRetry<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code !== "P2034") throw error;
    }
  }
  throw lastError;
}

/**
 * Persist daily metrics for one ad account.
 *
 * Dates present in this batch are replaced so a re-sync restates Meta's
 * 28-day attribution window. Each date window is delete+insert in one
 * transaction so a failed insert cannot wipe history that already landed.
 */
export async function upsertDailyMetrics(
  metrics: DailyMetricInput[],
  adAccountId: string,
  platform: string,
): Promise<number> {
  if (metrics.length === 0) return 0;

  const unique = dedupeDailyMetrics(metrics);
  const byDate = new Map<string, DailyMetricInput[]>();
  for (const row of unique) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  let written = 0;
  for (const dateWindow of windowSortedDates([...byDate.keys()], DAILY_METRIC_DATE_WINDOW)) {
    const rows = dateWindow.flatMap((date) => byDate.get(date) ?? []);
    const data = rows.map((row) => toDailyMetricCreateData(row, adAccountId, platform));
    const dateObjs = dateWindow.map((date) => new Date(date));

    await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await tx.dailyMetric.deleteMany({
            where: { adAccountId, platform, date: { in: dateObjs } },
          });
          for (const chunk of chunkArray(data, DAILY_METRIC_INSERT_CHUNK)) {
            await tx.dailyMetric.createMany({ data: chunk });
          }
        },
        {
          maxWait: 10_000,
          timeout: 30_000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
    written += data.length;
  }

  return written;
}

export function campaignFromNormalized(campaign: NormalizedCampaign): AdCampaignInput {
  return {
    platformCampaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    effectiveStatus: campaign.effectiveStatus ?? null,
    objective: campaign.objective ?? null,
    dailyBudget: campaign.dailyBudget ?? null,
    lifetimeBudget: campaign.lifetimeBudget ?? null,
    budgetType: campaign.budgetType ?? null,
    currency: campaign.currency,
    attributionSetting: campaign.attributionSetting ?? null,
    startTime: campaign.startTime ? new Date(campaign.startTime) : null,
    stopTime: campaign.stopTime ? new Date(campaign.stopTime) : null,
    createdTime: campaign.createdTime ? new Date(campaign.createdTime) : null,
    updatedTime: campaign.updatedTime ? new Date(campaign.updatedTime) : null,
  };
}

export function metricFromNormalized(metric: NormalizedMetric): DailyMetricInput {
  return {
    date: metric.date,
    spend: metric.spend,
    impressions: metric.impressions,
    clicks: metric.clicks,
    conversions: metric.conversions,
    conversionValue: metric.conversionValue,
    campaignId: metric.campaignId,
    campaignName: metric.campaignName,
    reach: metric.reach,
    frequency: metric.frequency,
    linkClicks: metric.linkClicks,
    landingPageViews: metric.landingPageViews,
    addToCart: metric.addToCart,
    checkouts: metric.checkouts,
    websitePurchases: metric.websitePurchases,
    websitePurchaseValue: metric.websitePurchaseValue,
    results: metric.results,
    resultType: metric.resultType,
    attributionSetting: metric.attributionSetting,
  };
}

export async function upsertAdCampaigns(
  campaigns: AdCampaignInput[],
  adAccountId: string,
  platform: string,
  currency = "EUR",
): Promise<number> {
  if (campaigns.length === 0) return 0;
  let count = 0;
  for (const campaign of campaigns) {
    if (!campaign.platformCampaignId) continue;
    await prisma.adCampaign.upsert({
      where: {
        adAccountId_platformCampaignId: {
          adAccountId,
          platformCampaignId: campaign.platformCampaignId,
        },
      },
      create: {
        adAccountId,
        platform,
        platformCampaignId: campaign.platformCampaignId,
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effectiveStatus ?? null,
        objective: campaign.objective ?? null,
        dailyBudget: campaign.dailyBudget,
        lifetimeBudget: campaign.lifetimeBudget,
        budgetType: campaign.budgetType ?? null,
        currency: campaign.currency ?? currency,
        attributionSetting: campaign.attributionSetting ?? null,
        startTime: campaign.startTime ?? null,
        stopTime: campaign.stopTime ?? null,
        createdTime: campaign.createdTime ?? null,
        updatedTime: campaign.updatedTime ?? null,
        lastSyncedAt: new Date(),
      },
      update: {
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effectiveStatus ?? null,
        objective: campaign.objective ?? null,
        dailyBudget: campaign.dailyBudget,
        lifetimeBudget: campaign.lifetimeBudget,
        budgetType: campaign.budgetType ?? null,
        currency: campaign.currency ?? currency,
        attributionSetting: campaign.attributionSetting ?? null,
        startTime: campaign.startTime ?? null,
        stopTime: campaign.stopTime ?? null,
        createdTime: campaign.createdTime ?? null,
        updatedTime: campaign.updatedTime ?? null,
        lastSyncedAt: new Date(),
      },
    });
    count += 1;
  }
  return count;
}

/**
 * Delete legacy account-level DailyMetric rows (empty `campaignId`) for one
 * ad account + platform.
 *
 * Called after a successful campaign-level sync so the same spend is not
 * counted twice — once in the legacy account-aggregated row and again in
 * the per-campaign rows.
 *
 * Returns the number of deleted rows.
 */
export async function cleanupAccountLevelRows(
  adAccountId: string,
  platform: string,
): Promise<number> {
  const result = await prisma.dailyMetric.deleteMany({
    where: { adAccountId, platform, campaignId: "" },
  });
  return result.count;
}

/**
 * Upsert WooCommerce / OpenCart orders for one brand. Existing rows are
 * updated (status, totals, UTM, email) so a re-sync is not a no-op.
 * New vs returning is computed after write from first-seen email.
 */
export async function upsertWooOrders(
  orders: WooOrderRaw[],
  brandId: string,
  costByProductId: Map<number, number> = new Map(),
  wholesaleCustomerIds: Iterable<number> = [],
): Promise<number> {
  if (orders.length === 0) return 0;

  const wholesaleIds = wholesaleCustomerIds instanceof Set
    ? wholesaleCustomerIds
    : new Set(wholesaleCustomerIds);

  let marketMode: MarketMode = "mixed";
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { organizationId: true, organization: { select: { settings: true } } },
    });
    if (brand) {
      marketMode = await loadShopMarketMode({
        prisma,
        organizationId: brand.organizationId,
        organizationSettings: brand.organization.settings,
        brandId,
      });
    }
  } catch (error) {
    console.warn("[woo] market mode lookup failed; classifying as mixed", error);
  }

  const rows = orders.map((order) => {
    const money = moneyFromWooOrder(order);
    const estimatedCogs = orderCogsFromLineItems(order.line_items, costByProductId);
    const profit = profitWhenCogsUnknown(estimatedCogs, money.netSales);
    const utm = extractWooAttribution(order.meta_data);
    const classified = classifyWooOrderMarket(
      {
        customer_id: order.customer_id,
        coupon_lines: order.coupon_lines,
        billing: order.billing,
        meta_data: order.meta_data,
        campaign: utm.campaign,
        source: utm.source,
        medium: utm.medium,
      },
      wholesaleIds,
      marketMode,
    );
    return {
      brandId,
      orderId: order.id,
      orderNumber: order.number,
      status: order.status,
      dateCreated: new Date(order.date_created),
      currency: order.currency || "EUR",
      grossSales: money.grossSales,
      discounts: money.discounts,
      refunds: money.refunds,
      netSales: money.netSales,
      shipping: money.shipping,
      tax: money.tax,
      costOfGoods: profit.costOfGoods,
      grossProfit: profit.grossProfit,
      customerEmail: order.billing?.email?.trim() || null,
      source: utm.source,
      medium: utm.medium,
      campaign: utm.campaign,
      market: classified.market,
    };
  });

  let written = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    await Promise.all(
      chunk.map((row) =>
        prisma.wooOrder.upsert({
          where: { brandId_orderId: { brandId: row.brandId, orderId: row.orderId } },
          create: row,
          update: {
            orderNumber: row.orderNumber,
            status: row.status,
            dateCreated: row.dateCreated,
            currency: row.currency,
            grossSales: row.grossSales,
            discounts: row.discounts,
            refunds: row.refunds,
            netSales: row.netSales,
            shipping: row.shipping,
            tax: row.tax,
            costOfGoods: row.costOfGoods,
            grossProfit: row.grossProfit,
            customerEmail: row.customerEmail,
            source: row.source,
            medium: row.medium,
            campaign: row.campaign,
            market: row.market,
          },
        }),
      ),
    );
    written += chunk.length;
  }

  await markNewCustomers(brandId);
  await persistWooSoldTotals(brandId, soldTotalsFromWooOrders(orders));
  return written;
}

/** Reset then write units / line net from the orders in this sync window. */
export async function persistWooSoldTotals(
  brandId: string,
  totals: Map<number, { qty: number; net: number; parentId?: number }>,
): Promise<void> {
  await prisma.wooProduct.updateMany({
    where: { brandId },
    data: { soldQty: 0, soldNet: 0 },
  });
  const leftover = new Map<number, { qty: number; net: number }>();
  const entries = [...totals.entries()];
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const results = await Promise.all(
      chunk.map(([productId, row]) =>
        prisma.wooProduct.updateMany({
          where: { brandId, productId },
          data: { soldQty: row.qty, soldNet: row.net },
        }).then((res) => ({ productId, row, count: res.count })),
      ),
    );
    for (const result of results) {
      if (result.count > 0) continue;
      const parentId = result.row.parentId ?? 0;
      if (parentId <= 0 || parentId === result.productId) continue;
      const prev = leftover.get(parentId) ?? { qty: 0, net: 0 };
      leftover.set(parentId, { qty: prev.qty + result.row.qty, net: prev.net + result.row.net });
    }
  }
  const leftovers = [...leftover.entries()];
  for (let i = 0; i < leftovers.length; i += 50) {
    const chunk = leftovers.slice(i, i + 50);
    await Promise.all(
      chunk.map(([productId, row]) =>
        prisma.wooProduct.updateMany({
          where: { brandId, productId },
          data: { soldQty: { increment: row.qty }, soldNet: { increment: row.net } },
        }),
      ),
    );
  }
}

async function markNewCustomers(brandId: string): Promise<void> {
  const orders = await prisma.wooOrder.findMany({
    where: { brandId, customerEmail: { not: null } },
    select: { id: true, customerEmail: true, dateCreated: true },
  });
  const { newIds, returningIds } = classifyNewCustomers(orders);
  for (let i = 0; i < newIds.length; i += 200) {
    await prisma.wooOrder.updateMany({
      where: { id: { in: newIds.slice(i, i + 200) } },
      data: { isNewCustomer: true },
    });
  }
  for (let i = 0; i < returningIds.length; i += 200) {
    await prisma.wooOrder.updateMany({
      where: { id: { in: returningIds.slice(i, i + 200) } },
      data: { isNewCustomer: false },
    });
  }
}

/**
 * Upsert catalog rows so stock and price refresh on every sync.
 */
export async function upsertWooProducts(
  products: WooProductInput[],
  brandId: string,
): Promise<number> {
  if (products.length === 0) return 0;

  let written = 0;
  for (let i = 0; i < products.length; i += 25) {
    const chunk = products.slice(i, i + 25);
    await Promise.all(
      chunk.map((p) =>
        prisma.wooProduct.upsert({
          where: { brandId_productId: { brandId, productId: p.productId } },
          create: {
            brandId,
            productId: p.productId,
            sku: p.sku ?? null,
            name: p.name,
            price: p.price,
            costOfGoods: p.costOfGoods ?? 0,
            stockQty: p.stockQty ?? 0,
            stockStatus: p.stockStatus ?? "instock",
            isAdvertised: false,
            lastSyncAt: new Date(),
          },
          update: {
            sku: p.sku ?? null,
            name: p.name,
            price: p.price,
            ...(p.costOfGoods != null && p.costOfGoods > 0 ? { costOfGoods: p.costOfGoods } : {}),
            stockQty: p.stockQty ?? 0,
            stockStatus: p.stockStatus ?? "instock",
            lastSyncAt: new Date(),
          },
        }),
      ),
    );
    written += chunk.length;
  }
  return written;
}
