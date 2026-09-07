/**
 * Creative fatigue scoring, clustering, and payload assembly.
 *
 * Fatigue is decay over time — not a snapshot CTR. Components:
 *   1. CTR drop vs the first week of the range (Meta/TikTok fail at >20% / 14d)
 *   2. Frequency vs objective cap (prospecting 5, retargeting 12)
 *   3. Days live vs platform refresh cadence
 *   4. CPA worsening and (for video) sub-3s average watch time
 */

import { DEFAULT_CURRENCY, formatMoney, formatMoneyExact, type ReportingCurrency } from "@/lib/currency";

export type FatiguePlatform = "meta" | "google" | "tiktok";
export type FatigueLevel = "high" | "medium" | "low";
export type FatigueDiagnosis =
  | "creative_death"
  | "audience_saturation"
  | "always_weak"
  | "cpa_inflation"
  | "over_cadence"
  | "healthy";
export type CreativeFormat =
  | "image"
  | "video"
  | "carousel"
  | "collection"
  | "search"
  | "unknown";
export type AudienceObjective = "prospecting" | "retargeting";

export const PLATFORM_CADENCE_DAYS: Record<FatiguePlatform, number> = {
  tiktok: 8,
  meta: 18,
  google: 70,
};

export const FREQUENCY_CAP: Record<AudienceObjective, number> = {
  prospecting: 5,
  retargeting: 12,
};

export const DECAY_COLORS = [
  "#f472b6",
  "#38bdf8",
  "#fb7185",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
];

export interface FatigueDailyPoint {
  date: string;
  ctr: number;
  frequency: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface FatigueAdDraft {
  adId: string;
  adName: string;
  platform: FatiguePlatform;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  creativeTitle: string;
  creativeBody: string | null;
  creativeImageUrl: string | null;
  format: CreativeFormat;
  objective: AudienceObjective;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  frequency: number;
  conversions: number;
  daysLive: number;
  avgWatchSeconds: number | null;
  accountId?: string;
  catalogTemplate?: boolean;
  advantagePlus?: boolean;
  objectAgeDays?: number;
  landingPageViews?: number;
  addToCart?: number;
  checkouts?: number;
  conversionValue?: number;
  destinationUrl?: string | null;
  daily: FatigueDailyPoint[];
}

export interface FatigueAd extends FatigueAdDraft {
  cpa: number | null;
  cadenceDays: number;
  pastCadence: boolean;
  ctrDropPct: number;
  cpaChangePct: number;
  cvrChangePct: number;
  fatigueScore: number;
  fatigueLevel: FatigueLevel;
  diagnosis: FatigueDiagnosis;
  clusterId: string | null;
  clusterSize: number;
  trend: number[];
  projectedCtr7d: number | null;
  recentCtr7d: number;
  daysUntilRefresh: number;
  landingPageViews: number;
  addToCart: number;
  checkouts: number;
  conversionValue: number;
  destinationUrl: string | null;
}

export interface FatigueKpis {
  portfolioHealth: number;
  portfolioCtr: number;
  ctrChangePp: number;
  avgDaysLive: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  spendAtRisk: number;
  pastCadenceCount: number;
  adsCount: number;
  projectedCtr7d: number | null;
  cpaWatchCount: number;
  cpaWatchSpend: number;
}

export interface FatigueRecommendation {
  id: string;
  title: string;
  detail: string;
  impact: string;
  effort: "Low effort" | "Medium effort" | "High effort";
  kind:
    | "headline"
    | "imagery"
    | "cta"
    | "audience"
    | "diversity"
    | "similarity"
    | "hook"
    | "refresh"
    | "cpa";
  adIds: string[];
}

export interface FormatDiversity {
  platform: FatiguePlatform;
  formats: Record<string, number>;
  uniqueFormats: number;
  passing: boolean;
  required: number;
}

export interface SimilarityCluster {
  id: string;
  size: number;
  adIds: string[];
  label: string;
  similarity: number;
}

export interface FatigueDecayPoint {
  day: string;
  [series: string]: string | number;
}

export interface FatigueDecayKey {
  key: string;
  name: string;
  color: string;
}

export interface FatigueScatterPoint {
  adId: string;
  name: string;
  frequency: number;
  ctr: number;
  spend: number;
  diagnosis: FatigueDiagnosis;
  platform: FatiguePlatform;
}

export interface FatiguePlatformStatus {
  id: FatiguePlatform;
  connected: boolean;
  accountName: string | null;
  error?: string;
}

export interface FatigueAdSetGroup {
  adsetId: string;
  adsetName: string;
  platform: FatiguePlatform;
  spend: number;
  adsCount: number;
}

export interface FatigueInboxItem {
  id: string;
  priority: number;
  title: string;
  why: string;
  playbook: string;
  adId: string;
  diagnosis: FatigueDiagnosis;
  spend: number;
}

export interface FatigueCalendarEntry {
  bucket: "overdue" | "today" | "soon";
  dateLabel: string;
  adId: string;
  name: string;
  platform: FatiguePlatform;
  daysUntilRefresh: number;
  spend: number;
}

export interface FatigueWinnerSwap {
  tiredAdId: string;
  tiredName: string;
  winnerAdId: string;
  winnerName: string;
  platform: FatiguePlatform;
  tiredCtr: number;
  winnerCtr: number;
  liftPct: number;
  spend: number;
}

export interface FatigueDiagnosisMix {
  diagnosis: FatigueDiagnosis;
  count: number;
  spend: number;
}

export interface FatigueCoverage {
  platform: FatiguePlatform;
  scoredSpend: number;
  accountSpend: number | null;
}

export interface FatigueLaunchDraft {
  name: string;
  description: string;
}

export const LAUNCHER_DRAFT_KEY = "campaign-launcher-from-fatigue";

export type EconomicsCheckStatus = "pass" | "warn" | "fail" | "unknown";

export interface FatigueEconomicsCheck {
  id: string;
  status: EconomicsCheckStatus;
  title: string;
  detail: string;
}

export interface FatigueFunnel {
  clicks: number;
  landingPageViews: number;
  addToCart: number;
  checkouts: number;
  purchases: number;
  spend: number;
  purchaseValue: number;
  roas: number | null;
  clickToPurchasePct: number;
  landingRatePct: number | null;
  cartRatePct: number | null;
  checkoutRatePct: number | null;
}

export interface FatigueStoreSnapshot {
  connected: boolean;
  website: string | null;
  orders: number;
  netSales: number;
  refunds: number;
  aov: number;
  aovBaseline: number;
  aovRecent: number;
  outOfStockCount: number;
  productCount: number;
}

export interface FatigueLandingSnapshot {
  url: string | null;
  fetched: boolean;
  title: string | null;
  maxDiscountPct: number | null;
  hasSaleLanguage: boolean;
  source: "html" | "catalog" | "mixed" | null;
  onSaleCount: number;
  catalogAttempted?: boolean;
}

export interface FatigueLandingProbe {
  url: string | null;
  fetched: boolean;
  title: string | null;
  text: string;
  maxDiscountPct?: number | null;
  source?: "html" | "catalog" | "mixed";
  onSaleCount?: number;
  catalogAttempted?: boolean;
}

export interface WooCatalogSignal {
  maxDiscountPct: number | null;
  onSaleCount: number;
  sampleCount: number;
  url: string | null;
  attempted: boolean;
}

export type FatigueAlertKind = "creative_fatigue" | "cpa_inflation" | "offer";

export interface FatigueAlertDraft {
  kind: FatigueAlertKind;
  adId: string;
  platform: FatiguePlatform;
  fatigueScore: number;
  title: string;
  message: string;
  href: string;
}

export interface OfferClaims {
  discounts: number[];
  maxDiscountPct: number | null;
  hasSaleLanguage: boolean;
}

export interface FatigueEconomics {
  funnel: FatigueFunnel;
  store: FatigueStoreSnapshot;
  landing: FatigueLandingSnapshot;
  cvrChangePct: number;
  pixelGapPct: number | null;
  mer: number | null;
  checks: FatigueEconomicsCheck[];
}

export type FatigueHealthGrade = "A" | "B" | "C" | "D" | "F";

export interface FatigueHealthCheck {
  id: string;
  title: string;
  status: EconomicsCheckStatus;
  detail: string;
  severity: "critical" | "high" | "medium";
}

export interface FatigueRewrite {
  id: string;
  label: string;
  headline: string;
  body: string;
  why: string;
}

export interface FatigueHealthReport {
  score: number;
  grade: FatigueHealthGrade;
  checks: FatigueHealthCheck[];
}

export interface FatiguePayload {
  connected: boolean;
  platforms: FatiguePlatformStatus[];
  ads: FatigueAd[];
  adsets: FatigueAdSetGroup[];
  kpis: FatigueKpis;
  decay: FatigueDecayPoint[];
  decayKeys: FatigueDecayKey[];
  scatter: FatigueScatterPoint[];
  diversity: FormatDiversity[];
  clusters: SimilarityCluster[];
  recommendations: FatigueRecommendation[];
  inbox: FatigueInboxItem[];
  calendar: FatigueCalendarEntry[];
  swaps: FatigueWinnerSwap[];
  mix: FatigueDiagnosisMix[];
  brief: string;
  alertsCreated: number;
  coverage: FatigueCoverage[];
  launchDraft: FatigueLaunchDraft;
  economics: FatigueEconomics;
  health: FatigueHealthReport;
  rewrites: FatigueRewrite[];
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso.slice(0, 10)}T00:00:00.000Z`);
  const b = Date.parse(`${endIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export function ctrPct(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

export function inferObjective(...labels: Array<string | null | undefined>): AudienceObjective {
  const blob = labels.filter(Boolean).join(" ");
  return /retarget|remarket|dpa|catalog|existing.?cust|purchaser|warm/i.test(blob)
    ? "retargeting"
    : "prospecting";
}

export function inferFormat(args: {
  objectType?: string | null;
  name?: string | null;
  body?: string | null;
  hasVideo?: boolean;
  googleAdType?: string | null;
}): CreativeFormat {
  const type = (args.objectType ?? "").toUpperCase();
  const google = (args.googleAdType ?? "").toUpperCase();
  const text = `${args.name ?? ""} ${args.body ?? ""}`.toLowerCase();
  if (args.hasVideo || type.includes("VIDEO") || google.includes("VIDEO")) return "video";
  if (type.includes("CAROUSEL") || /carousel/.test(text)) return "carousel";
  if (type.includes("COLLECTION") || /collection/.test(text)) return "collection";
  if (
    google.includes("SEARCH") ||
    google.includes("EXPANDED_TEXT") ||
    google.includes("RESPONSIVE_SEARCH")
  ) {
    return "search";
  }
  if (type.includes("PHOTO") || type.includes("SHARE") || google.includes("IMAGE") || google.includes("DISPLAY")) {
    return "image";
  }
  if (/ugc|unbox|reel|story/.test(text)) return "video";
  if (/static|pdp|hero/.test(text)) return "image";
  if (looksLikeCatalogCreative(args.name, args.body)) return "collection";
  return "unknown";
}

export function looksLikeLiquidTemplate(text: string | null | undefined): boolean {
  return /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/.test(text ?? "");
}

/** Strip Shopify/Meta catalog Liquid so operator UI is readable. */
export function sanitizeCreativeLabel(raw: string, fallback = "Catalog product ad"): string {
  const stripped = raw
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\{%[\s\S]*?%\}/g, " ")
    .replace(/[[\]]/g, " ")
    .replace(/[-–—|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length >= 2 ? stripped : fallback;
}

export function looksLikeCatalogCreative(
  ...labels: Array<string | null | undefined>
): boolean {
  const blob = labels.filter(Boolean).join(" ");
  return (
    looksLikeLiquidTemplate(blob) ||
    /dpa|dynamic.?product|product.?catalog|catalog.?sales|collection.?ads/i.test(blob)
  );
}

export function looksLikeUgc(...labels: Array<string | null | undefined>): boolean {
  return /ugc|unbox|testimonial|real customer|shot on|founder|no studio|voice.?over|handheld|tiktok shop/i.test(
    labels.filter(Boolean).join(" "),
  );
}

export function looksLikeAdvantagePlus(
  ...labels: Array<string | null | undefined>
): boolean {
  return /advantage\+|\basc\b/i.test(labels.filter(Boolean).join(" "));
}

const SALE_LANGUAGE =
  /\bsales?\b|\bdiscount\b|\boutlet\b|\boffs?\b|προσφορ|έκπτωσ|εκπτωσ|έκπτω|εκπτω|μειωμ|μειωσ|black\s*friday|winter\s*sales|μήνας\s+εκπτώσεων|εκπτώσεων/i;

const BOT_WALL =
  /security verification|just a moment|cf-browser-verification|attention required|enable javascript and cookies to continue|performing security verification/i;

/** Pull %-off claims and sale language from ad copy or landing HTML text. */
export function extractOfferClaims(text: string | null | undefined): OfferClaims {
  const src = text ?? "";
  const discounts: number[] = [];
  const re = /(?:^|[^\d])(\d{1,2})\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const n = Number(match[1]);
    if (n >= 5 && n <= 90) discounts.push(n);
  }
  return {
    discounts,
    maxDiscountPct: discounts.length > 0 ? Math.max(...discounts) : null,
    hasSaleLanguage: SALE_LANGUAGE.test(src) || discounts.some((n) => n >= 20),
  };
}

export function extractHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || looksLikeLiquidTemplate(raw)) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function canonicalizeShopUrl(raw: string | null | undefined): string | null {
  const url = extractHttpUrl(raw);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith("en.")) parsed.hostname = parsed.hostname.slice(3);
    if (parsed.hostname.startsWith("www.")) parsed.hostname = parsed.hostname.slice(4);
    return parsed.toString();
  } catch {
    return null;
  }
}

export function shopOrigin(website: string | null | undefined): string | null {
  const url = canonicalizeShopUrl(website);
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function shopHostLabel(website: string | null | undefined): string {
  const origin = shopOrigin(website);
  if (!origin) return "the shop";
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return "the shop";
  }
}

export function landingUrlsToProbe(
  website: string | null | undefined,
  destinations: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    const url = canonicalizeShopUrl(value ?? null);
    if (url && !out.includes(url)) out.push(url);
  };
  for (const dest of destinations) add(dest);
  add(website);
  const origin = shopOrigin(website) ?? (out[0] ? shopOrigin(out[0]) : null);
  if (origin) add(`${origin}/`);
  return out.slice(0, 3);
}

export function wooStoreApiUrls(website: string | null | undefined): string[] {
  const origin = shopOrigin(website);
  if (!origin) return [];
  return [1, 2, 3].map(
    (page) => `${origin}/wp-json/wc/store/v1/products?on_sale=true&per_page=50&page=${page}`,
  );
}

export function parseWooStoreMinorAmount(raw: unknown, minorUnit = 2): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const minor = Math.max(0, Math.min(4, Math.floor(minorUnit)));
  if (minor > 0 && Number.isInteger(n)) return n / 10 ** minor;
  return n;
}

export function discountPctFromPrices(regular: number, sale: number): number | null {
  if (!(regular > 0) || !(sale > 0) || sale >= regular) return null;
  const pct = Math.round((1 - sale / regular) * 100);
  if (pct < 5 || pct > 90) return null;
  return pct;
}

export function emptyCatalogSignal(): WooCatalogSignal {
  return { maxDiscountPct: null, onSaleCount: 0, sampleCount: 0, url: null, attempted: false };
}

export function parseMetaCatalogMoney(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function catalogSignalFromMetaProducts(
  products: unknown,
  shopWebsite: string | null = null,
  sourceUrl: string | null = null,
): WooCatalogSignal {
  const publicUrl = shopOrigin(shopWebsite) ? `${shopOrigin(shopWebsite)}/` : sourceUrl;
  if (!Array.isArray(products) || products.length === 0) {
    return { ...emptyCatalogSignal(), attempted: true, url: publicUrl };
  }
  const allowedHost = shopOrigin(shopWebsite)
    ? new URL(shopOrigin(shopWebsite)!).hostname
    : null;
  let maxDiscountPct: number | null = null;
  let onSaleCount = 0;
  let sampleCount = 0;
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const page = canonicalizeShopUrl(typeof row.url === "string" ? row.url : null);
    if (page && allowedHost) {
      try {
        if (new URL(page).hostname !== allowedHost) continue;
      } catch {
        continue;
      }
    }
    const regular = parseMetaCatalogMoney(row.price as string | number | undefined);
    const sale = parseMetaCatalogMoney(row.sale_price as string | number | undefined);
    const pct = discountPctFromPrices(regular, sale > 0 ? sale : regular);
    sampleCount += 1;
    if (pct != null) {
      onSaleCount += 1;
      maxDiscountPct = maxDiscountPct == null ? pct : Math.max(maxDiscountPct, pct);
    }
  }
  return {
    maxDiscountPct,
    onSaleCount,
    sampleCount,
    url: publicUrl,
    attempted: true,
  };
}

export function catalogSignalFromWooProducts(
  products: unknown,
  sourceUrl: string | null = null,
): WooCatalogSignal {
  if (!Array.isArray(products) || products.length === 0) {
    return { ...emptyCatalogSignal(), attempted: true, url: sourceUrl };
  }
  let maxDiscountPct: number | null = null;
  let onSaleCount = 0;
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const prices = (row.prices ?? {}) as Record<string, unknown>;
    const minor = Number(prices.currency_minor_unit ?? 2);
    const regular = parseWooStoreMinorAmount(prices.regular_price, minor);
    const sale = parseWooStoreMinorAmount(prices.sale_price ?? prices.price, minor);
    const pct = discountPctFromPrices(regular, sale);
    if (row.on_sale === true || pct != null) onSaleCount += 1;
    if (pct != null) {
      maxDiscountPct = maxDiscountPct == null ? pct : Math.max(maxDiscountPct, pct);
    }
  }
  return {
    maxDiscountPct,
    onSaleCount,
    sampleCount: products.length,
    url: sourceUrl,
    attempted: true,
  };
}

export function mergeCatalogSignals(parts: WooCatalogSignal[]): WooCatalogSignal {
  return parts.reduce<WooCatalogSignal>((acc, part) => {
    const attempted = acc.attempted || part.attempted || part.sampleCount > 0;
    const url = acc.url ?? part.url;
    if (part.sampleCount <= 0) {
      return { ...acc, attempted, url };
    }
    const maxDiscountPct =
      acc.maxDiscountPct == null
        ? part.maxDiscountPct
        : part.maxDiscountPct == null
          ? acc.maxDiscountPct
          : Math.max(acc.maxDiscountPct, part.maxDiscountPct);
    return {
      maxDiscountPct,
      onSaleCount: acc.onSaleCount + part.onSaleCount,
      sampleCount: acc.sampleCount + part.sampleCount,
      url,
      attempted,
    };
  }, emptyCatalogSignal());
}

export function mergeLandingWithCatalog(
  probe: FatigueLandingProbe,
  catalog: WooCatalogSignal,
): FatigueLandingProbe {
  if (catalog.sampleCount <= 0 && catalog.maxDiscountPct == null) {
    return {
      ...probe,
      catalogAttempted: Boolean(catalog.attempted || probe.catalogAttempted),
    };
  }
  const catalogText =
    catalog.maxDiscountPct != null
      ? `SALE −${catalog.maxDiscountPct}% OFF. ${catalog.onSaleCount} products on sale.`
      : catalog.onSaleCount > 0
        ? `Sale. ${catalog.onSaleCount} products on sale.`
        : "";
  const htmlMax = extractOfferClaims(probe.text).maxDiscountPct;
  const maxDiscountPct = [htmlMax, catalog.maxDiscountPct, probe.maxDiscountPct]
    .filter((n): n is number => n != null)
    .reduce<number | null>((best, n) => (best == null ? n : Math.max(best, n)), null);
  const htmlOk = probe.fetched && !looksLikeBotWall(probe.text);
  let publicUrl = htmlOk ? probe.url : probe.url;
  if (!htmlOk && catalog.url) {
    try {
      const api = new URL(canonicalizeShopUrl(catalog.url) ?? catalog.url);
      publicUrl = api.pathname.includes("/wp-json/") || api.hostname.includes("facebook.com")
        ? `${api.origin}/`
        : api.toString();
      publicUrl = canonicalizeShopUrl(publicUrl) ?? publicUrl;
      if (api.hostname.includes("facebook.com") && probe.url) {
        publicUrl = canonicalizeShopUrl(probe.url) ?? probe.url;
      }
    } catch {
      publicUrl = canonicalizeShopUrl(catalog.url) ?? catalog.url;
    }
  }
  publicUrl = canonicalizeShopUrl(publicUrl) ?? publicUrl;
  return {
    url: publicUrl,
    fetched: htmlOk || catalog.sampleCount > 0,
    title: htmlOk
      ? probe.title
      : catalog.sampleCount > 0
        ? "Live catalog sale prices"
        : probe.title,
    text: [probe.text, catalogText].filter(Boolean).join("\n"),
    maxDiscountPct,
    source: htmlOk && catalog.sampleCount > 0 ? "mixed" : catalog.sampleCount > 0 ? "catalog" : "html",
    onSaleCount: catalog.onSaleCount,
    catalogAttempted: true,
  };
}

export function looksLikeBotWall(text: string | null | undefined): boolean {
  return BOT_WALL.test(text ?? "");
}

export function emptyLandingProbe(): FatigueLandingProbe {
  return { url: null, fetched: false, title: null, text: "" };
}

export function emptyLandingSnapshot(): FatigueLandingSnapshot {
  return {
    url: null,
    fetched: false,
    title: null,
    maxDiscountPct: null,
    hasSaleLanguage: false,
    source: null,
    onSaleCount: 0,
    catalogAttempted: false,
  };
}

export function summarizeLanding(probe: FatigueLandingProbe): FatigueLandingSnapshot {
  const claims = extractOfferClaims(probe.text);
  const catalogish = (probe.onSaleCount ?? 0) > 0 || (probe.maxDiscountPct != null && probe.maxDiscountPct >= 5);
  const htmlOk = probe.fetched && !looksLikeBotWall(probe.text);
  return {
    url: probe.url,
    fetched: htmlOk || catalogish || (probe.fetched && (probe.source === "catalog" || probe.source === "mixed")),
    title: probe.title,
    maxDiscountPct: probe.maxDiscountPct ?? claims.maxDiscountPct,
    hasSaleLanguage: claims.hasSaleLanguage || catalogish,
    source: probe.source ?? (htmlOk ? "html" : catalogish ? "catalog" : null),
    onSaleCount: probe.onSaleCount ?? 0,
    catalogAttempted: Boolean(probe.catalogAttempted),
  };
}

function adOfferCopy(ads: FatigueAd[]): string {
  const preferred = ads.filter(
    (a) => a.diagnosis === "cpa_inflation" || a.cpaChangePct >= 25,
  );
  const source = (preferred.length > 0 ? preferred : ads.slice(0, 3)).slice(0, 4);
  return source
    .map((a) => [a.creativeBody, a.creativeTitle, a.adName].filter(Boolean).join(" "))
    .join("\n");
}

/** Message-match: ad discount/sale claims vs the landing page the click actually hits. */
export function scoreOfferMatch(
  adCopy: string,
  landing: FatigueLandingSnapshot,
  landingText = "",
): FatigueEconomicsCheck | null {
  const ad = extractOfferClaims(adCopy);
  if (!ad.hasSaleLanguage && (ad.maxDiscountPct == null || ad.maxDiscountPct < 20)) {
    return null;
  }
  const adMax = ad.maxDiscountPct;
  const land = landing.fetched ? extractOfferClaims(landingText || "") : extractOfferClaims("");
  const landMax = landing.fetched ? (landing.maxDiscountPct ?? land.maxDiscountPct) : null;
  const landSale = landing.fetched
    ? landing.hasSaleLanguage || land.hasSaleLanguage
    : false;

  if (!landing.fetched) {
    if (adMax != null && adMax >= 30) {
      const catalogUnread = Boolean(landing.catalogAttempted);
      return {
        id: "offer",
        status: "warn",
        title: catalogUnread
          ? "Could not read live sale prices"
          : "Confirm the live sale matches the ad",
        detail: catalogUnread
          ? `Ad promises −${adMax}%. HTML is blocked and the Meta catalog returned no ${shopHostLabel(landing.url)} prices (missing catalog permission, empty product set, or products without a shop URL). Confirm the live discount on ${landing.url ?? "the brand site"} before rotating creative.`
          : landing.url
            ? `Ad promises −${adMax}%. Could not read ${landing.url} (bot protection). Open it and check that discount is actually live — message match is the #1 post-click CPA killer.`
            : `Ad promises −${adMax}%. No destination URL to verify. Check Ads Manager and the brand website.`,
      };
    }
    return {
      id: "offer",
      status: "unknown",
      title: "Could not read the landing page",
      detail: landing.url
        ? `Tried ${landing.url}. Open it and confirm the live sale matches the ad.`
        : "No destination URL on the ad and no brand website to probe.",
    };
  }

  if (adMax != null && adMax >= 30 && (landMax == null || adMax - landMax >= 15) && !landSale) {
    return {
      id: "offer",
      status: "fail",
      title: "Ad sale does not match the landing page",
      detail: `Ad promises −${adMax}% / sale language. ${landing.url ?? "The landing"} has no matching discount merchandising. That leak looks like rising CPA.`,
    };
  }
  if (adMax != null && landMax != null && adMax - landMax >= 15) {
    return {
      id: "offer",
      status: "fail",
      title: "Ad over-claims the live discount",
      detail:
        landing.source === "catalog" || landing.source === "mixed"
          ? `Ad says −${adMax}%. Live catalog sale prices top out at −${landMax}% (${landing.onSaleCount} on-sale SKUs). Shoppers bounce when the PDP does not match the promise.`
          : `Ad says −${adMax}%. Landing shows up to −${landMax}%. Shoppers bounce when the PDP does not match the promise.`,
    };
  }
  if (ad.hasSaleLanguage && !landSale) {
    return {
      id: "offer",
      status: "fail",
      title: "Sale ad lands on a non-sale page",
      detail: `${landing.url ?? "The landing"} reads as a company or wholesale page, not the promo the ad sold. Point catalog traffic at the sale URL or rewrite the body.`,
    };
  }
  if (adMax != null && landMax != null && Math.abs(adMax - landMax) < 15) {
    return {
      id: "offer",
      status: "pass",
      title: "Offer matches the landing page",
      detail: `Ad −${adMax}% vs landing −${landMax}%.`,
    };
  }
  if (ad.hasSaleLanguage && landSale) {
    return {
      id: "offer",
      status: "pass",
      title: "Landing has sale merchandising",
      detail: landing.url ? `Sale language found on ${landing.url}.` : "Sale language found on the landing page.",
    };
  }
  return null;
}

function withOfferInbox(
  inbox: FatigueInboxItem[],
  ads: FatigueAd[],
  economics: FatigueEconomics,
): FatigueInboxItem[] {
  const offer = economics.checks.find(
    (c) => c.id === "offer" && (c.status === "fail" || c.status === "warn"),
  );
  if (!offer) return inbox;
  const hot =
    ads.find((a) => a.diagnosis === "cpa_inflation") ??
    ads.find((a) => a.cpaChangePct >= 25) ??
    ads[0];
  if (!hot) return inbox;
  const item: FatigueInboxItem = {
    id: `inbox-offer-${hot.adId}`,
    priority: Number.MAX_SAFE_INTEGER,
    title: offer.title,
    why: offer.detail,
    playbook:
      "Rewrite the ad to the live sale depth, or send catalog traffic to the sale URL. Message match is the #1 post-click CPA killer.",
    adId: hot.adId,
    diagnosis: hot.diagnosis,
    spend: hot.spend,
  };
  return [item, ...inbox.filter((row) => row.id !== item.id)].slice(0, 6);
}

function fatigueAlertHref(adId: string): string {
  return `/creative-fatigue?ad=${encodeURIComponent(adId)}`;
}

/** Daily notification drafts for the fatigue desk (persisted by the marketing router). */
export function buildFatigueAlertDrafts(
  ads: FatigueAd[],
  currency: ReportingCurrency,
  economics?: Pick<FatigueEconomics, "checks"> | null,
): FatigueAlertDraft[] {
  const drafts: FatigueAlertDraft[] = [];
  const offer = economics?.checks.find(
    (c) => c.id === "offer" && (c.status === "fail" || c.status === "warn"),
  );

  const hot = ads.filter((a) => a.fatigueLevel === "high" && a.spend >= 5).slice(0, 5);
  for (const ad of hot) {
    const drop = ad.ctrDropPct <= -20;
    const freqCap = ad.objective === "retargeting" ? 12 : 5;
    if (!drop && ad.frequency <= freqCap && !ad.pastCadence) continue;
    drafts.push({
      kind: "creative_fatigue",
      adId: ad.adId,
      platform: ad.platform,
      fatigueScore: ad.fatigueScore,
      title: "Creative fatigue",
      message: `${ad.creativeTitle || ad.adName} is ${ad.fatigueLevel} fatigue (${ad.diagnosis.replace(/_/g, " ")}). CTR ${ad.ctrDropPct.toFixed(0)}% vs first week · ${formatMoneyExact(ad.spend, currency)} spend.`,
      href: fatigueAlertHref(ad.adId),
    });
  }

  const cpaAds = ads.filter((a) => a.diagnosis === "cpa_inflation" && a.spend >= 5).slice(0, 3);
  for (const ad of cpaAds) {
    drafts.push({
      kind: "cpa_inflation",
      adId: ad.adId,
      platform: ad.platform,
      fatigueScore: ad.fatigueScore,
      title: "CPA climbing while CTR holds",
      message: offer
        ? `${ad.creativeTitle || ad.adName} CPA is +${ad.cpaChangePct.toFixed(0)}% vs week 1. ${offer.detail}`
        : `${ad.creativeTitle || ad.adName} CPA is +${ad.cpaChangePct.toFixed(0)}% vs week 1. Inspect feed, landing page, or purchase event before rotating creative · ${formatMoneyExact(ad.spend, currency)} spend.`,
      href: fatigueAlertHref(ad.adId),
    });
  }

  if (offer) {
    const target =
      ads.find((a) => a.diagnosis === "cpa_inflation" && a.spend >= 5) ??
      ads.find((a) => a.cpaChangePct >= 25 && a.spend >= 5) ??
      ads.find((a) => a.spend >= 5);
    if (target) {
      drafts.push({
        kind: "offer",
        adId: target.adId,
        platform: target.platform,
        fatigueScore: target.fatigueScore,
        title: offer.title,
        message: offer.detail,
        href: fatigueAlertHref(target.adId),
      });
    }
  }

  return drafts;
}

/** Days from first delivering insight to the window end — used for catalog objects. */
export function deliverySpanDays(daily: FatigueDailyPoint[], endIso: string): number {
  const withDelivery = daily
    .filter((p) => p.impressions > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (withDelivery.length === 0) return 1;
  return daysBetween(withDelivery[0].date, endIso);
}

export function windowCtr(
  points: FatigueDailyPoint[],
  fromEnd: boolean,
  windowDays = 7,
): number {
  const withDelivery = points.filter((p) => p.impressions > 0);
  if (withDelivery.length === 0) return 0;
  const size = Math.max(1, Math.min(windowDays, Math.ceil(withDelivery.length / 2)));
  const slice = fromEnd ? withDelivery.slice(-size) : withDelivery.slice(0, size);
  const impressions = slice.reduce((s, p) => s + p.impressions, 0);
  const clicks = slice.reduce((s, p) => s + p.clicks, 0);
  return ctrPct(clicks, impressions);
}

export function windowCpa(
  points: FatigueDailyPoint[],
  fromEnd: boolean,
  windowDays = 7,
): number | null {
  const withDelivery = points.filter((p) => p.impressions > 0);
  if (withDelivery.length === 0) return null;
  const size = Math.max(1, Math.min(windowDays, Math.ceil(withDelivery.length / 2)));
  const slice = fromEnd ? withDelivery.slice(-size) : withDelivery.slice(0, size);
  const spend = slice.reduce((s, p) => s + p.spend, 0);
  const conversions = slice.reduce((s, p) => s + p.conversions, 0);
  if (conversions <= 0) return null;
  return spend / conversions;
}

export function windowCvr(
  points: FatigueDailyPoint[],
  fromEnd: boolean,
  windowDays = 7,
): number | null {
  const withDelivery = points.filter((p) => p.impressions > 0);
  if (withDelivery.length === 0) return null;
  const size = Math.max(1, Math.min(windowDays, Math.ceil(withDelivery.length / 2)));
  const slice = fromEnd ? withDelivery.slice(-size) : withDelivery.slice(0, size);
  const clicks = slice.reduce((s, p) => s + p.clicks, 0);
  const conversions = slice.reduce((s, p) => s + p.conversions, 0);
  if (clicks <= 0) return null;
  return (conversions / clicks) * 100;
}

export function pctChange(prev: number, next: number): number {
  if (prev === 0) return next === 0 ? 0 : 100;
  return ((next - prev) / Math.abs(prev)) * 100;
}

export function tokenizeCreative(title: string, body?: string | null): Set<string> {
  const raw = `${title} ${body ?? ""}`.toLowerCase().replace(/[^a-z0-9\s]+/g, " ");
  return new Set(raw.split(/\s+/).filter((w) => w.length > 2));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function clusterSimilarCreatives(
  ads: Array<{ adId: string; creativeTitle: string; creativeBody: string | null }>,
  threshold = 0.6,
): SimilarityCluster[] {
  const parent = ads.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const tokens = ads.map((ad) => tokenizeCreative(ad.creativeTitle, ad.creativeBody));

  for (let i = 0; i < ads.length; i += 1) {
    for (let j = i + 1; j < ads.length; j += 1) {
      if (jaccard(tokens[i], tokens[j]) >= threshold) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[b] = a;
      }
    }
  }

  const groups = new Map<number, number[]>();
  ads.forEach((_, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(i);
    groups.set(root, list);
  });

  const clusters: SimilarityCluster[] = [];
  let n = 1;
  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    let simSum = 0;
    let pairs = 0;
    for (let a = 0; a < indexes.length; a += 1) {
      for (let b = a + 1; b < indexes.length; b += 1) {
        simSum += jaccard(tokens[indexes[a]], tokens[indexes[b]]);
        pairs += 1;
      }
    }
    const first = ads[indexes[0]];
    clusters.push({
      id: `cluster-${n}`,
      size: indexes.length,
      adIds: indexes.map((i) => ads[i].adId),
      label: first.creativeTitle || first.adId,
      similarity: pairs > 0 ? simSum / pairs : 1,
    });
    n += 1;
  }
  return clusters.sort((a, b) => b.size - a.size);
}

export function scoreFatigue(input: {
  ctr: number;
  ctrDropPct: number;
  frequency: number;
  objective: AudienceObjective;
  daysLive: number;
  platform: FatiguePlatform;
  cpaChangePct: number;
  avgWatchSeconds: number | null;
  cadenceExempt?: boolean;
}): { score: number; level: FatigueLevel; diagnosis: FatigueDiagnosis } {
  const decline = Math.max(0, -input.ctrDropPct);
  const ctrDecay = Math.min(45, (decline / 20) * 30);

  const cap = FREQUENCY_CAP[input.objective];
  const freqOver = Math.max(0, input.frequency - cap);
  const frequency = freqOver === 0 ? 0 : Math.min(30, (freqOver / cap) * 30);

  const recommended = PLATFORM_CADENCE_DAYS[input.platform];
  const daysOver = Math.max(0, input.daysLive - recommended);
  const cadence = input.cadenceExempt
    ? 0
    : daysOver === 0
      ? 0
      : Math.min(25, (daysOver / recommended) * 25);

  const cpaWorse = Math.max(0, input.cpaChangePct);
  const cpa = cpaWorse <= 0 ? 0 : Math.min(20, (cpaWorse / 25) * 15);

  const hook =
    input.avgWatchSeconds != null && input.avgWatchSeconds > 0 && input.avgWatchSeconds < 3
      ? 8
      : 0;

  const score = Math.min(100, Math.round(ctrDecay + frequency + cadence + cpa + hook));
  const level: FatigueLevel = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  let diagnosis: FatigueDiagnosis = "healthy";
  if (decline >= 15 && input.frequency <= cap * 1.15) {
    diagnosis = "creative_death";
  } else if (input.frequency > cap && decline < 10) {
    diagnosis = "audience_saturation";
  } else if (
    !input.cadenceExempt &&
    input.daysLive > recommended &&
    decline < 10 &&
    input.frequency <= cap
  ) {
    diagnosis = "over_cadence";
  } else if (input.ctr < 0.8 && decline < 10) {
    diagnosis = "always_weak";
  } else if (input.cpaChangePct >= 25 && decline < 15) {
    diagnosis = "cpa_inflation";
  } else if (decline >= 15) {
    diagnosis = "creative_death";
  } else if (score < 40) {
    diagnosis = "healthy";
  } else if (frequency >= ctrDecay) {
    diagnosis = "audience_saturation";
  } else {
    diagnosis = "creative_death";
  }

  return { score, level, diagnosis };
}

export function projectCtr(daily: FatigueDailyPoint[], daysAhead = 7): number | null {
  const pts = daily.filter((p) => p.impressions > 0);
  if (pts.length < 3) return null;
  const window = pts.slice(-Math.min(14, pts.length));
  const n = window.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  window.forEach((p, i) => {
    sumX += i;
    sumY += p.ctr;
    sumXY += i * p.ctr;
    sumXX += i * i;
  });
  const trailingSlice = window.slice(-Math.min(7, n));
  const trailing = ctrPct(
    trailingSlice.reduce((s, p) => s + p.clicks, 0),
    trailingSlice.reduce((s, p) => s + p.impressions, 0),
  );
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return Number(trailing.toFixed(2));
  const slope = (n * sumXY - sumX * sumY) / denom;
  const raw = trailing + slope * daysAhead;
  const ceiling = trailing + Math.min(2, Math.max(0.25, Math.abs(trailing) * 0.25));
  return Number(Math.max(0, Math.min(raw, ceiling)).toFixed(2));
}

export function scoreDrafts(drafts: FatigueAdDraft[]): FatigueAd[] {
  const clusters = clusterSimilarCreatives(drafts);
  const clusterByAd = new Map<string, SimilarityCluster>();
  for (const cluster of clusters) {
    for (const id of cluster.adIds) clusterByAd.set(id, cluster);
  }

  return drafts.map((draft) => {
    const catalogTemplate =
      draft.catalogTemplate ??
      looksLikeCatalogCreative(
        draft.creativeTitle,
        draft.adName,
        draft.campaignName,
        draft.adsetName,
      );
    const advantagePlus =
      draft.advantagePlus ?? looksLikeAdvantagePlus(draft.campaignName, draft.adsetName);
    const creativeTitle = looksLikeLiquidTemplate(draft.creativeTitle)
      ? sanitizeCreativeLabel(draft.creativeTitle, sanitizeCreativeLabel(draft.adName))
      : draft.creativeTitle;
    const adName = looksLikeLiquidTemplate(draft.adName)
      ? sanitizeCreativeLabel(draft.adName, creativeTitle)
      : draft.adName;
    const sortedDaily = [...draft.daily].sort((a, b) => a.date.localeCompare(b.date));
    const lastDay = sortedDaily[sortedDaily.length - 1]?.date;
    const objectAgeDays = draft.objectAgeDays ?? draft.daysLive;
    let daysLive = draft.daysLive;
    if (catalogTemplate && lastDay) {
      const span = deliverySpanDays(sortedDaily, lastDay);
      if (daysLive > span + 7) daysLive = span;
    }
    const avgWatchSeconds = draft.format === "video" ? draft.avgWatchSeconds : null;
    const cadenceExempt = catalogTemplate;
    const baselineCtr = windowCtr(sortedDaily, false);
    const recentCtr = windowCtr(sortedDaily, true);
    const ctrDropPct =
      sortedDaily.length >= 2 ? pctChange(baselineCtr, recentCtr) : 0;
    const baselineCpa = windowCpa(sortedDaily, false);
    const recentCpa = windowCpa(sortedDaily, true);
    const cpaChangePct =
      baselineCpa != null && recentCpa != null ? pctChange(baselineCpa, recentCpa) : 0;
    const baselineCvr = windowCvr(sortedDaily, false);
    const recentCvr = windowCvr(sortedDaily, true);
    const cvrChangePct =
      baselineCvr != null && recentCvr != null ? pctChange(baselineCvr, recentCvr) : 0;
    const cadenceDays = PLATFORM_CADENCE_DAYS[draft.platform];
    const { score, level, diagnosis } = scoreFatigue({
      ctr: draft.ctr,
      ctrDropPct,
      frequency: draft.frequency,
      objective: draft.objective,
      daysLive,
      platform: draft.platform,
      cpaChangePct,
      avgWatchSeconds,
      cadenceExempt,
    });
    const cluster = clusterByAd.get(draft.adId) ?? null;
    return {
      ...draft,
      creativeTitle,
      adName,
      daysLive,
      avgWatchSeconds,
      catalogTemplate,
      advantagePlus,
      objectAgeDays,
      daily: sortedDaily,
      cpa: draft.conversions > 0 ? draft.spend / draft.conversions : null,
      cadenceDays,
      pastCadence: !cadenceExempt && daysLive > cadenceDays,
      ctrDropPct,
      cpaChangePct,
      cvrChangePct,
      fatigueScore: score,
      fatigueLevel: level,
      diagnosis,
      clusterId: cluster?.id ?? null,
      clusterSize: cluster?.size ?? 1,
      trend: sortedDaily.map((p) => p.ctr),
      projectedCtr7d: projectCtr(sortedDaily, 7),
      recentCtr7d: recentCtr,
      daysUntilRefresh: cadenceExempt ? 99 : cadenceDays - daysLive,
      landingPageViews: draft.landingPageViews ?? 0,
      addToCart: draft.addToCart ?? 0,
      checkouts: draft.checkouts ?? 0,
      conversionValue: draft.conversionValue ?? 0,
      destinationUrl: draft.destinationUrl ?? null,
    };
  });
}

export function buildKpis(ads: FatigueAd[]): FatigueKpis {
  const adsCount = ads.length;
  if (adsCount === 0) {
    return {
      portfolioHealth: 100,
      portfolioCtr: 0,
      ctrChangePp: 0,
      avgDaysLive: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      spendAtRisk: 0,
      pastCadenceCount: 0,
      adsCount: 0,
      projectedCtr7d: null,
      cpaWatchCount: 0,
      cpaWatchSpend: 0,
    };
  }
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const clicks = ads.reduce((s, a) => s + a.clicks, 0);
  const weightedScore =
    totalSpend > 0
      ? ads.reduce((s, a) => s + a.fatigueScore * a.spend, 0) / totalSpend
      : ads.reduce((s, a) => s + a.fatigueScore, 0) / adsCount;
  const high = ads.filter((a) => a.fatigueLevel === "high");
  const cpaWatch = ads.filter((a) => a.diagnosis === "cpa_inflation");
  const windowTotals = (fromEnd: boolean) => {
    let windowImpressions = 0;
    let windowClicks = 0;
    for (const ad of ads) {
      const pts = ad.daily.filter((p) => p.impressions > 0);
      if (pts.length === 0) continue;
      const size = Math.max(1, Math.min(7, Math.ceil(pts.length / 2)));
      const slice = fromEnd ? pts.slice(-size) : pts.slice(0, size);
      windowImpressions += slice.reduce((n, p) => n + p.impressions, 0);
      windowClicks += slice.reduce((n, p) => n + p.clicks, 0);
    }
    return ctrPct(windowClicks, windowImpressions);
  };
  const baselineCtr = windowTotals(false);
  const recentCtr = windowTotals(true);
  const withProjection = ads.filter((a) => a.projectedCtr7d != null);
  const projectionSpend = withProjection.reduce((s, a) => s + a.spend, 0);

  return {
    portfolioHealth: Math.max(0, Math.min(100, Math.round(100 - weightedScore))),
    portfolioCtr: ctrPct(clicks, impressions),
    ctrChangePp: recentCtr - baselineCtr,
    avgDaysLive: ads.reduce((s, a) => s + a.daysLive, 0) / adsCount,
    highCount: high.length,
    mediumCount: ads.filter((a) => a.fatigueLevel === "medium").length,
    lowCount: ads.filter((a) => a.fatigueLevel === "low").length,
    spendAtRisk: high.reduce((s, a) => s + a.spend, 0),
    pastCadenceCount: ads.filter((a) => a.pastCadence).length,
    adsCount,
    projectedCtr7d:
      projectionSpend > 0
        ? withProjection.reduce((s, a) => s + (a.projectedCtr7d ?? 0) * a.spend, 0) /
          projectionSpend
        : null,
    cpaWatchCount: cpaWatch.length,
    cpaWatchSpend: cpaWatch.reduce((s, a) => s + a.spend, 0),
  };
}

export function buildDiversity(ads: FatigueAd[]): FormatDiversity[] {
  const required: Record<FatiguePlatform, number> = { meta: 3, tiktok: 1, google: 2 };
  const platforms = new Set(ads.map((a) => a.platform));
  return [...platforms].map((platform) => {
    const subset = ads.filter((a) => a.platform === platform);
    const formats: Record<string, number> = {};
    for (const ad of subset) {
      formats[ad.format] = (formats[ad.format] ?? 0) + 1;
    }
    const uniqueFormats = Object.keys(formats).filter((k) => k !== "unknown").length;
    const need = required[platform];
    return {
      platform,
      formats,
      uniqueFormats,
      required: need,
      passing: uniqueFormats >= need,
    };
  });
}

const VOLUME_MIN: Record<FatiguePlatform, number> = { meta: 5, tiktok: 6, google: 3 };

export function emptyHealthReport(): FatigueHealthReport {
  return { score: 0, grade: "F", checks: [] };
}

function healthGrade(score: number): FatigueHealthGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** CR-01…CR-10 creative quality audit used by the fatigue desk and predictions. */
export function buildCreativeHealth(
  ads: FatigueAd[],
  diversity: FormatDiversity[],
  clusters: SimilarityCluster[],
  economics: FatigueEconomics,
): FatigueHealthReport {
  if (ads.length === 0) return emptyHealthReport();
  const checks: FatigueHealthCheck[] = [];
  let score = 100;

  for (const row of diversity) {
    if (row.passing) {
      checks.push({
        id: `CR-01-${row.platform}`,
        title: `Format diversity (${row.platform})`,
        status: "pass",
        severity: "high",
        detail: `${row.uniqueFormats} live formats (need ${row.required}).`,
      });
    } else {
      score -= 25;
      checks.push({
        id: `CR-01-${row.platform}`,
        title: `Format diversity (${row.platform})`,
        status: "fail",
        severity: "high",
        detail: `${row.uniqueFormats} format${row.uniqueFormats === 1 ? "" : "s"} live; need ${row.required}. Keep the catalog and add UGC + carousel.`,
      });
    }
  }

  const byAdset = new Map<string, FatigueAd[]>();
  for (const ad of ads) {
    const key = `${ad.platform}:${ad.adsetId || ad.adsetName}`;
    const list = byAdset.get(key) ?? [];
    list.push(ad);
    byAdset.set(key, list);
  }
  const thinSets = [...byAdset.values()].filter((group) => {
    const min = VOLUME_MIN[group[0].platform];
    return group.length < min;
  });
  if (thinSets.length === 0) {
    checks.push({
      id: "CR-02",
      title: "Creative volume",
      status: "pass",
      severity: "high",
      detail: "Every delivering ad set meets the platform minimum.",
    });
  } else {
    score -= 15;
    const sample = thinSets[0];
    const min = VOLUME_MIN[sample[0].platform];
    checks.push({
      id: "CR-02",
      title: "Creative volume",
      status: "fail",
      severity: "high",
      detail: `${sample[0].adsetName} has ${sample.length} ad${sample.length === 1 ? "" : "s"} (need ${min}). Add siblings — do not pause a winner to fake volume.`,
    });
  }

  const rotting = ads.filter((a) => a.fatigueLevel === "high" && a.diagnosis !== "cpa_inflation");
  if (rotting.length === 0) {
    checks.push({
      id: "CR-03",
      title: "Fatigue / CTR decay",
      status: ads.some((a) => a.diagnosis === "cpa_inflation") ? "warn" : "pass",
      severity: "critical",
      detail: ads.some((a) => a.diagnosis === "cpa_inflation")
        ? "CTR is holding. CPA climbing is post-click — not a dead creative."
        : "No high-fatigue CTR collapse in this window.",
    });
  } else {
    score -= 25;
    checks.push({
      id: "CR-03",
      title: "Fatigue / CTR decay",
      status: "fail",
      severity: "critical",
      detail: `${rotting.length} ad${rotting.length === 1 ? "" : "s"} dropped CTR past the refresh line.`,
    });
  }

  const overdue = ads.filter((a) => a.pastCadence && !a.catalogTemplate);
  if (overdue.length === 0) {
    checks.push({
      id: "CR-04",
      title: "Refresh cadence",
      status: "pass",
      severity: "high",
      detail: ads.some((a) => a.catalogTemplate)
        ? "Catalog templates are cadence-exempt; object age is not days-in-market."
        : "Creatives are inside the platform refresh window.",
    });
  } else {
    score -= 15;
    checks.push({
      id: "CR-04",
      title: "Refresh cadence",
      status: "fail",
      severity: "high",
      detail: `${overdue.length} non-catalog ad${overdue.length === 1 ? "" : "s"} past the recommended refresh cycle.`,
    });
  }

  const longCopy = ads.filter((a) => {
    if (a.catalogTemplate || looksLikeLiquidTemplate(a.creativeTitle)) return false;
    const headline = a.creativeTitle?.length ?? 0;
    const body = a.creativeBody?.length ?? 0;
    return headline > 40 || body > 125;
  });
  const offer = economics.checks.find((c) => c.id === "offer");
  if (offer?.status === "fail") {
    score -= 15;
    checks.push({
      id: "CR-05",
      title: "Offer / copy compliance",
      status: "fail",
      severity: "critical",
      detail: offer.detail,
    });
  } else if (longCopy.length > 0) {
    score -= 8;
    checks.push({
      id: "CR-05",
      title: "Offer / copy compliance",
      status: "warn",
      severity: "high",
      detail: `${longCopy.length} ad${longCopy.length === 1 ? "" : "s"} exceed Meta headline (40) or primary text (125) limits.`,
    });
  } else {
    checks.push({
      id: "CR-05",
      title: "Offer / copy compliance",
      status: offer?.status === "warn" ? "warn" : "pass",
      severity: "high",
      detail: offer?.detail ?? "Headlines and primary text are inside platform limits.",
    });
  }

  const deadHooks = ads.filter(
    (a) => a.format === "video" && a.avgWatchSeconds != null && a.avgWatchSeconds > 0 && a.avgWatchSeconds < 3,
  );
  if (deadHooks.length > 0) {
    score -= 10;
    checks.push({
      id: "CR-06",
      title: "Hook quality",
      status: "fail",
      severity: "high",
      detail: `${deadHooks.length} video${deadHooks.length === 1 ? "" : "s"} average under 3s watch — rewrite the first three seconds.`,
    });
  } else {
    checks.push({
      id: "CR-06",
      title: "Hook quality",
      status: ads.some((a) => a.format === "video") ? "pass" : "warn",
      severity: "high",
      detail: ads.some((a) => a.format === "video")
        ? "Video watch time is above the 3s hook floor."
        : "No video in the mix — the first three seconds of a UGC cut is the missing hook.",
    });
  }

  const ugcCount = ads.filter((a) =>
    looksLikeUgc(a.adName, a.creativeTitle, a.creativeBody, a.campaignName),
  ).length;
  const metaSpend = ads.filter((a) => a.platform === "meta").reduce((s, a) => s + a.spend, 0);
  if (metaSpend > 0 && ugcCount === 0) {
    score -= 8;
    checks.push({
      id: "CR-07",
      title: "UGC ratio",
      status: "fail",
      severity: "medium",
      detail: "Zero UGC / testimonial ads on Meta. Catalog statics need a handheld sibling.",
    });
  } else {
    checks.push({
      id: "CR-07",
      title: "UGC ratio",
      status: "pass",
      severity: "medium",
      detail: ugcCount > 0 ? `${ugcCount} UGC-style ad${ugcCount === 1 ? "" : "s"} in the mix.` : "No Meta spend in this window.",
    });
  }

  const heavyCluster = clusters.find((c) => c.size >= 3 && c.similarity >= 0.6);
  if (heavyCluster) {
    score -= 10;
    checks.push({
      id: "CR-10",
      title: "Andromeda diversity",
      status: "fail",
      severity: "high",
      detail: `${heavyCluster.size} near-duplicate creatives (“${heavyCluster.label}”). Meta will suppress iterative variations.`,
    });
  } else {
    checks.push({
      id: "CR-10",
      title: "Andromeda diversity",
      status: "pass",
      severity: "high",
      detail:
        clusters.length === 0
          ? "Too few creatives to cluster — volume is the constraint, not sameness."
          : "No 3+ cluster of near-identical concepts.",
    });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return { score: clamped, grade: healthGrade(clamped), checks };
}

export function buildOfferRewrites(
  ads: FatigueAd[],
  landing: FatigueLandingSnapshot,
): FatigueRewrite[] {
  if (ads.length === 0) return [];
  const claims = extractOfferClaims(adOfferCopy(ads));
  const depth = landing.maxDiscountPct;
  const host = shopHostLabel(landing.url);
  const bagtobag = /bagtobag/i.test(host);
  const rewrites: FatigueRewrite[] = [];
  if (claims.hasSaleLanguage || (claims.maxDiscountPct != null && claims.maxDiscountPct >= 20)) {
    rewrites.push({
      id: "honest-sale",
      label: "Honest sale body",
      headline:
        depth != null
          ? bagtobag
            ? `Έως −${depth}%`
            : `Up to −${depth}%`
          : bagtobag
            ? "Live τιμές"
            : "Live prices",
      body:
        depth != null
          ? bagtobag
            ? `Χειμερινές εκπτώσεις έως −${depth}% στα δερμάτινα BAGTOBAG. Δες τις live τιμές στο ${host}.`
            : `Sale up to −${depth}%. Confirm live prices on ${host} before the click.`
          : bagtobag
            ? `Εποχικές τιμές στα δερμάτινα BAGTOBAG — επιβεβαίωσε την έκπτωση στο ${host} πριν το κλικ.`
            : `Seasonal prices — confirm the live discount on ${host} before the click.`,
      why:
        claims.maxDiscountPct != null
          ? `Ad claims −${claims.maxDiscountPct}%${depth != null ? ` vs live −${depth}%` : " vs an unverified live sale"}.`
          : "Sale language on the ad does not match the landing.",
    });
    rewrites.push({
      id: "no-percent",
      label: "Quality angle (no %)",
      headline: bagtobag ? "Δερμάτινα, κάθε μέρα" : "Quality, no fake %",
      body: bagtobag
        ? `Τσάντες και αξεσουάρ BAGTOBAG. Δες τη συλλογή στο ${host} — χωρίς έκπτωση που το site δεν δείχνει.`
        : `Shop the collection on ${host} — no discount the landing page does not show.`,
      why: "If the click hits the wholesale homepage, stop promising a sale the page does not merchandize.",
    });
  }
  if (ads.some((a) => a.catalogTemplate) || ads.some((a) => a.format === "image" && a.platform === "meta")) {
    rewrites.push({
      id: "ugc-script",
      label: "15s UGC hook",
      headline: "Product in use, first 3s",
      body: `0–3s: hands packing a bag, street noise, no logo. 3–8s: one hero SKU + live price only. 8–15s: tap to shop ${host}. Never put −80% on-screen unless the PDP matches.`,
      why: "Image-only Meta needs a distinct handheld concept — keep the catalog as control.",
    });
    rewrites.push({
      id: "carousel",
      label: "3-card carousel",
      headline: "Bestsellers, not clones",
      body: "Card 1: hero tote in use. Card 2: leather detail + live price. Card 3: gift / occasion. Each card a different SKU — Andromeda punishes color-swap catalogs.",
      why: "A second format next to DPA is the production move, not a pause.",
    });
  }
  return rewrites.slice(0, 4);
}

export function buildDecaySeries(
  ads: FatigueAd[],
  maxSeries = 4,
): { decay: FatigueDecayPoint[]; decayKeys: FatigueDecayKey[] } {
  const ranked = [...ads]
    .filter((a) => a.daily.length >= 2)
    .sort((a, b) => b.fatigueScore * b.spend - a.fatigueScore * a.spend)
    .slice(0, maxSeries);
  const dates = new Set<string>();
  for (const ad of ranked) for (const p of ad.daily) dates.add(p.date);
  const sortedDates = [...dates].sort();
  const decayKeys: FatigueDecayKey[] = ranked.map((ad, i) => ({
    key: `s${i}`,
    name: ad.creativeTitle || ad.adName,
    color: DECAY_COLORS[i % DECAY_COLORS.length],
  }));
  const decay: FatigueDecayPoint[] = sortedDates.map((date) => {
    const row: FatigueDecayPoint = { day: date };
    ranked.forEach((ad, i) => {
      const point = ad.daily.find((p) => p.date === date);
      row[`s${i}`] = point ? Number(point.ctr.toFixed(2)) : 0;
    });
    return row;
  });
  return { decay, decayKeys };
}

export function buildScatter(ads: FatigueAd[]): FatigueScatterPoint[] {
  return ads.map((ad) => ({
    adId: ad.adId,
    name: ad.creativeTitle || ad.adName,
    frequency: Number(ad.frequency.toFixed(2)),
    ctr: Number(ad.ctr.toFixed(2)),
    spend: ad.spend,
    diagnosis: ad.diagnosis,
    platform: ad.platform,
  }));
}

export function buildAdSets(ads: FatigueAd[]): FatigueAdSetGroup[] {
  const map = new Map<string, FatigueAdSetGroup>();
  for (const ad of ads) {
    const key = `${ad.platform}:${ad.adsetId || "unassigned"}`;
    const entry = map.get(key) ?? {
      adsetId: ad.adsetId,
      adsetName: ad.adsetName || "Unassigned",
      platform: ad.platform,
      spend: 0,
      adsCount: 0,
    };
    entry.spend += ad.spend;
    entry.adsCount += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}

function money(n: number, currency: ReportingCurrency = DEFAULT_CURRENCY): string {
  return formatMoney(n, currency, { maximumFractionDigits: 0 });
}

export function buildRecommendations(
  ads: FatigueAd[],
  diversity: FormatDiversity[],
  clusters: SimilarityCluster[],
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): FatigueRecommendation[] {
  const recs: FatigueRecommendation[] = [];
  const impactSpend = (subset: FatigueAd[]) => subset.reduce((s, a) => s + a.spend, 0);

  const dying = ads
    .filter((a) => a.diagnosis === "creative_death" || (a.ctrDropPct <= -20 && a.fatigueLevel !== "low"))
    .sort((a, b) => b.spend - a.spend);
  if (dying.length > 0) {
    recs.push({
      id: "headline",
      kind: "headline",
      title: "Rotate headlines on decaying ads",
      detail: `${dying.length} ad${dying.length === 1 ? "" : "s"} lost CTR vs the first week. Start with ${dying[0].creativeTitle || dying[0].adName}.`,
      impact: `${money(impactSpend(dying), currency)} at risk`,
      effort: "Low effort",
      adIds: dying.slice(0, 5).map((a) => a.adId),
    });
  }

  const saturated = ads
    .filter((a) => a.diagnosis === "audience_saturation")
    .sort((a, b) => b.frequency - a.frequency);
  if (saturated.length > 0) {
    recs.push({
      id: "audience",
      kind: "audience",
      title: "Expand audience or cap frequency",
      detail: `${saturated[0].creativeTitle || saturated[0].adName} is at ${saturated[0].frequency.toFixed(1)}× frequency with CTR still holding — this is saturation, not a dead creative.`,
      impact: `${money(impactSpend(saturated), currency)} exposed`,
      effort: "Medium effort",
      adIds: saturated.slice(0, 5).map((a) => a.adId),
    });
  }

  const stale = ads.filter((a) => a.pastCadence).sort((a, b) => b.daysLive - a.daysLive);
  if (stale.length > 0) {
    recs.push({
      id: "refresh",
      kind: "refresh",
      title: "Refresh ads past platform cadence",
      detail: `${stale[0].creativeTitle || stale[0].adName} has been live ${stale[0].daysLive} days (recommended ${stale[0].cadenceDays} on ${stale[0].platform}).`,
      impact: `${stale.length} ad${stale.length === 1 ? "" : "s"} overdue`,
      effort: "Medium effort",
      adIds: stale.slice(0, 5).map((a) => a.adId),
    });
  }

  const imagery = dying.filter((a) => a.format === "image" || a.format === "unknown");
  if (imagery.length > 0) {
    recs.push({
      id: "imagery",
      kind: "imagery",
      title: "Replace static imagery",
      detail: "Statics show the steepest decay. Swap in UGC or a new product angle rather than a color tweak.",
      impact: `${money(impactSpend(imagery), currency)} on statics`,
      effort: "Medium effort",
      adIds: imagery.slice(0, 4).map((a) => a.adId),
    });
  }

  const ctaAds = dying.slice(0, 3);
  if (ctaAds.length > 0) {
    recs.push({
      id: "cta",
      kind: "cta",
      title: "Test a new CTA",
      detail: "Pair the headline rotation with a harder CTA on the highest-spend decaying ads.",
      impact: "Low-lift CTR test",
      effort: "Low effort",
      adIds: ctaAds.map((a) => a.adId),
    });
  }

  for (const row of diversity) {
    if (!row.passing) {
      const catalogOnPlatform = ads.some((a) => a.platform === row.platform && a.catalogTemplate);
      recs.push({
        id: `diversity-${row.platform}`,
        kind: "diversity",
        title: catalogOnPlatform
          ? "Keep the catalog. Add UGC and a carousel."
          : `Add formats on ${row.platform}`,
        detail: catalogOnPlatform
          ? `${PLATFORM_LABEL[row.platform]} is delivering on one catalog static. Ship a 15s UGC hook, a 3-card carousel of bestsellers, and keep this DPA as the control — do not pause a winner to “refresh” it.`
          : `${row.platform} is running ${row.uniqueFormats} distinct format${row.uniqueFormats === 1 ? "" : "s"}; ${row.required}+ is the bar. Fatigue is often “we only run statics”.`,
        impact: catalogOnPlatform ? `${money(impactSpend(ads.filter((a) => a.platform === row.platform)), currency)} on one format` : "Format mix",
        effort: "High effort",
        adIds: ads.filter((a) => a.platform === row.platform).slice(0, 3).map((a) => a.adId),
      });
    }
  }

  const similar = clusters.filter((c) => c.size >= 2 && c.similarity >= 0.6);
  if (similar.length > 0) {
    const top = similar[0];
    recs.push({
      id: "andromeda",
      kind: "similarity",
      title: "Break Andromeda lookalikes",
      detail: `${top.size} creatives cluster at ${(top.similarity * 100).toFixed(0)}% similarity (“${top.label}”). Meta suppresses near-duplicates — ship a new concept, not a recolor.`,
      impact: `${top.size} near-duplicates`,
      effort: "High effort",
      adIds: top.adIds,
    });
  }

  const weakHooks = ads
    .filter(
      (a) =>
        a.format === "video" &&
        a.avgWatchSeconds != null &&
        a.avgWatchSeconds > 0 &&
        a.avgWatchSeconds < 3,
    )
    .sort((a, b) => (a.avgWatchSeconds ?? 99) - (b.avgWatchSeconds ?? 99));
  if (weakHooks.length > 0) {
    recs.push({
      id: "hook",
      kind: "hook",
      title: "Rewrite the first 3 seconds",
      detail: `${weakHooks[0].creativeTitle || weakHooks[0].adName} averages ${weakHooks[0].avgWatchSeconds?.toFixed(1)}s watch time. The hook is dead — not the offer.`,
      impact: `${weakHooks.length} weak hook${weakHooks.length === 1 ? "" : "s"}`,
      effort: "Medium effort",
      adIds: weakHooks.slice(0, 4).map((a) => a.adId),
    });
  }

  const risingCpa = ads
    .filter((a) => a.cpaChangePct >= 25 && a.ctrDropPct > -15)
    .sort((a, b) => b.cpaChangePct * b.spend - a.cpaChangePct * a.spend);
  if (risingCpa.length > 0) {
    recs.push({
      id: "cpa",
      kind: "cpa",
      title: "CPA is climbing while CTR holds",
      detail: `${risingCpa[0].creativeTitle || risingCpa[0].adName} CPA is ${risingCpa[0].cpaChangePct.toFixed(0)}% vs the first week. That is usually feed, landing page, or purchase-event quality — not a dead creative.`,
      impact: `${money(impactSpend(risingCpa), currency)} exposed`,
      effort: "Medium effort",
      adIds: risingCpa.slice(0, 4).map((a) => a.adId),
    });
  }

  return recs.slice(0, 6);
}

export const DIAGNOSIS_PLAYBOOK: Record<
  FatigueDiagnosis,
  { headline: string; steps: string[] }
> = {
  creative_death: {
    headline: "The ad is dying — not the audience.",
    steps: [
      "Ship a new concept (hook, offer, or format) — not a recolor.",
      "Rotate 3 headlines and one harder CTA this week.",
      "Pause the worst variant once the replacement is in review.",
    ],
  },
  audience_saturation: {
    headline: "People have seen it enough. CTR is still holding.",
    steps: [
      "Raise the frequency cap or exclude converters from prospecting.",
      "Expand lookalikes / broaden targeting before killing the creative.",
      "Keep the winner as a retargeting asset.",
    ],
  },
  always_weak: {
    headline: "This creative never earned its keep.",
    steps: [
      "Do not iterate — replace the angle.",
      "Borrow structure from the highest-CTR ad on the same platform.",
      "Cut spend until a new asset is live.",
    ],
  },
  cpa_inflation: {
    headline: "Clicks are cheap. Purchases got expensive.",
    steps: [
      "Do not pause or rotate this creative — CTR is holding.",
      "Match the ad offer to the live PDP (discount depth, sale URL). Then check feed vs price, stock, and purchase-event quality.",
      "Ship UGC or a carousel as a sibling test and keep this ad as the control.",
    ],
  },
  over_cadence: {
    headline: "Still working, but past the refresh window.",
    steps: [
      "Queue a sibling creative now so you are not forced into a scramble.",
      "Keep this live until the replacement exits learning.",
      "On TikTok, treat 7–10 days as a hard cycle.",
    ],
  },
  healthy: {
    headline: "Leave it alone — scale or duplicate.",
    steps: [
      "Do not refresh a winner just because it is old if CTR is stable.",
      "Duplicate into a new ad set only if frequency is still under cap.",
      "Use it as the control against new tests.",
    ],
  },
};

export function buildActionInbox(
  ads: FatigueAd[],
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): FatigueInboxItem[] {
  return [...ads]
    .filter(
      (a) =>
        a.fatigueLevel !== "low" ||
        a.pastCadence ||
        a.ctrDropPct <= -20 ||
        a.cpaChangePct >= 25 ||
        a.diagnosis === "cpa_inflation",
    )
    .map((a) => {
      const cpaHot = a.diagnosis === "cpa_inflation" || (a.cpaChangePct >= 25 && a.ctrDropPct > -15);
      return {
        id: `inbox-${a.adId}`,
        priority: a.spend * Math.max(a.fatigueScore / 100, cpaHot ? 0.4 : 0),
        title: a.creativeTitle || a.adName,
        why: cpaHot
          ? `CPA +${a.cpaChangePct.toFixed(0)}% vs week 1 · CTR still holding · ${money(a.spend, currency)} spend`
          : `${DIAGNOSIS_LABEL[a.diagnosis]} · ${a.ctrDropPct.toFixed(0)}% CTR vs week 1 · ${money(a.spend, currency)} spend`,
        playbook: DIAGNOSIS_PLAYBOOK[a.diagnosis].headline,
        adId: a.adId,
        diagnosis: a.diagnosis,
        spend: a.spend,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

export function buildRefreshCalendar(ads: FatigueAd[]): FatigueCalendarEntry[] {
  return [...ads]
    .filter((a) => !a.catalogTemplate)
    .map((a) => {
      const days = a.daysUntilRefresh;
      const bucket: FatigueCalendarEntry["bucket"] =
        days < 0 ? "overdue" : days <= 1 ? "today" : "soon";
      const dateLabel =
        days < 0
          ? `${Math.abs(days)}d overdue`
          : days === 0
            ? "Due today"
            : `In ${days}d`;
      return {
        bucket,
        dateLabel,
        adId: a.adId,
        name: a.creativeTitle || a.adName,
        platform: a.platform,
        daysUntilRefresh: days,
        spend: a.spend,
      };
    })
    .filter((e) => e.daysUntilRefresh <= 14)
    .sort((a, b) => a.daysUntilRefresh - b.daysUntilRefresh)
    .slice(0, 12);
}

export function buildWinnerSwaps(ads: FatigueAd[]): FatigueWinnerSwap[] {
  const winners = ads.filter(
    (a) =>
      a.diagnosis === "healthy" ||
      (a.fatigueLevel === "low" && a.ctr >= 1.5 && a.diagnosis !== "cpa_inflation"),
  );
  const tired = ads.filter(
    (a) => a.diagnosis === "creative_death" || a.diagnosis === "always_weak",
  );
  const swaps: FatigueWinnerSwap[] = [];
  for (const t of tired.sort((a, b) => b.spend - a.spend)) {
    const winner = winners
      .filter((w) => w.platform === t.platform && w.adId !== t.adId && w.ctr > t.ctr * 1.25)
      .sort((a, b) => b.ctr - a.ctr)[0];
    if (!winner) continue;
    swaps.push({
      tiredAdId: t.adId,
      tiredName: t.creativeTitle || t.adName,
      winnerAdId: winner.adId,
      winnerName: winner.creativeTitle || winner.adName,
      platform: t.platform,
      tiredCtr: t.ctr,
      winnerCtr: winner.ctr,
      liftPct: t.ctr > 0 ? ((winner.ctr - t.ctr) / t.ctr) * 100 : 0,
      spend: t.spend,
    });
    if (swaps.length >= 4) break;
  }
  return swaps;
}

export function buildProductionBrief(
  ads: FatigueAd[],
  kpis: FatigueKpis,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): string {
  const hot = ads.filter((a) => a.fatigueLevel === "high").slice(0, 5);
  const economics = ads.filter((a) => a.diagnosis === "cpa_inflation").slice(0, 3);
  const catalog = ads.filter((a) => a.catalogTemplate);
  const lines = [
    `# Creative refresh brief`,
    ``,
    `Portfolio health ${kpis.portfolioHealth}/100 · CTR ${kpis.portfolioCtr.toFixed(2)}% · spend at risk ${money(kpis.spendAtRisk, currency)} · CPA watch ${money(kpis.cpaWatchSpend, currency)}`,
    ``,
  ];
  if (hot.length === 0) {
    if (catalog.length > 0) {
      lines.push(`No high-fatigue ads. Catalog CTR is holding — keep it as the control.`);
      lines.push(`Produce next: 15s UGC (first 3 seconds = product in use) and a 3-card carousel of bestsellers.`);
    } else {
      lines.push(`No high-fatigue ads in this window. Keep the current rotation.`);
    }
  } else {
    lines.push(`## Produce next`);
    hot.forEach((a, i) => {
      const play = DIAGNOSIS_PLAYBOOK[a.diagnosis];
      lines.push(
        `${i + 1}. **${a.creativeTitle || a.adName}** (${PLATFORM_LABEL[a.platform]} · ${a.format})`,
        `   - Diagnosis: ${DIAGNOSIS_LABEL[a.diagnosis]} · score ${a.fatigueScore} · ${a.ctrDropPct.toFixed(0)}% CTR vs week 1`,
        `   - ${play.headline}`,
        `   - ${play.steps[0]}`,
        ``,
      );
    });
  }
  if (economics.length > 0) {
    lines.push(
      ``,
      `## CPA watch — do not rotate first`,
      ...economics.map(
        (a) =>
          `- ${a.creativeTitle || a.adName}: CPA ${a.cpaChangePct.toFixed(0)}% vs week 1 while CTR holds. Check feed / PDP / purchase event. Keep as control.`,
      ),
    );
  }
  return lines.join("\n");
}

export function buildLaunchDraft(
  ads: FatigueAd[],
  kpis: FatigueKpis,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): FatigueLaunchDraft {
  const catalog = ads.some((a) => a.catalogTemplate);
  const cpa = ads.some((a) => a.diagnosis === "cpa_inflation");
  const name = catalog
    ? "UGC + carousel — catalog control"
    : cpa
      ? "Sibling test — CPA watch control"
      : "Creative refresh from fatigue desk";
  return { name, description: buildProductionBrief(ads, kpis, currency) };
}

export function stashLaunchDraft(draft: FatigueLaunchDraft): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LAUNCHER_DRAFT_KEY, JSON.stringify(draft));
}

export function consumeLaunchDraft(): FatigueLaunchDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAUNCHER_DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(LAUNCHER_DRAFT_KEY);
    const parsed = JSON.parse(raw) as FatigueLaunchDraft;
    if (typeof parsed?.name !== "string" || typeof parsed?.description !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function fatigueCsv(ads: FatigueAd[]): string {
  const header = [
    "ad_id",
    "name",
    "platform",
    "campaign",
    "adset",
    "format",
    "diagnosis",
    "score",
    "level",
    "ctr",
    "ctr_drop_pct",
    "cpa",
    "cpa_change_pct",
    "cvr_change_pct",
    "conversion_value",
    "frequency",
    "spend",
    "impressions",
    "days_live",
    "days_until_refresh",
    "projected_ctr_7d",
  ];
  const rows = ads.map((a) =>
    [
      a.adId,
      `"${(a.creativeTitle || a.adName).replace(/"/g, '""')}"`,
      a.platform,
      `"${a.campaignName.replace(/"/g, '""')}"`,
      `"${a.adsetName.replace(/"/g, '""')}"`,
      a.format,
      a.diagnosis,
      a.fatigueScore,
      a.fatigueLevel,
      a.ctr.toFixed(2),
      a.ctrDropPct.toFixed(1),
      a.cpa == null ? "" : a.cpa.toFixed(2),
      a.cpaChangePct.toFixed(1),
      a.cvrChangePct.toFixed(1),
      a.conversionValue.toFixed(2),
      a.frequency.toFixed(2),
      a.spend.toFixed(2),
      a.impressions,
      a.daysLive,
      a.daysUntilRefresh,
      a.projectedCtr7d ?? "",
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function adsManagerUrl(ad: FatigueAd): string | null {
  if (ad.platform === "meta") {
    const params = new URLSearchParams({ selected_ad_ids: ad.adId });
    if (ad.accountId) params.set("act", ad.accountId.replace(/^act_/i, ""));
    return `https://adsmanager.facebook.com/adsmanager/manage/ads?${params.toString()}`;
  }
  if (ad.platform === "google") {
    return "https://ads.google.com/aw/ads";
  }
  if (ad.platform === "tiktok") {
    return "https://ads.tiktok.com/i18n/perf/campaign";
  }
  return null;
}

export function cadenceLabel(
  ad: Pick<FatigueAd, "daysUntilRefresh" | "catalogTemplate">,
): string {
  if (ad.catalogTemplate) return "Catalog template";
  if (ad.daysUntilRefresh < 0) return `${Math.abs(ad.daysUntilRefresh)}d overdue`;
  if (ad.daysUntilRefresh === 0) return "Due today";
  return `${ad.daysUntilRefresh}d to refresh`;
}

export function cadenceProgress(
  ad: Pick<FatigueAd, "daysLive" | "cadenceDays" | "catalogTemplate">,
): number {
  if (ad.catalogTemplate) return 0;
  return Math.min(100, (ad.daysLive / Math.max(1, ad.cadenceDays)) * 100);
}

export function buildDiagnosisMix(ads: FatigueAd[]): FatigueDiagnosisMix[] {
  const order: FatigueDiagnosis[] = [
    "creative_death",
    "audience_saturation",
    "always_weak",
    "cpa_inflation",
    "over_cadence",
    "healthy",
  ];
  return order
    .map((diagnosis) => {
      const rows = ads.filter((a) => a.diagnosis === diagnosis);
      return {
        diagnosis,
        count: rows.length,
        spend: rows.reduce((s, a) => s + a.spend, 0),
      };
    })
    .filter((row) => row.count > 0);
}

export function emptyStoreSnapshot(): FatigueStoreSnapshot {
  return {
    connected: false,
    website: null,
    orders: 0,
    netSales: 0,
    refunds: 0,
    aov: 0,
    aovBaseline: 0,
    aovRecent: 0,
    outOfStockCount: 0,
    productCount: 0,
  };
}

export function buildEconomics(
  ads: FatigueAd[],
  store: FatigueStoreSnapshot = emptyStoreSnapshot(),
  currency: ReportingCurrency = DEFAULT_CURRENCY,
  landingProbe: FatigueLandingProbe = emptyLandingProbe(),
): FatigueEconomics {
  const clicks = ads.reduce((s, a) => s + a.clicks, 0);
  const purchases = ads.reduce((s, a) => s + a.conversions, 0);
  const landingPageViews = ads.reduce((s, a) => s + a.landingPageViews, 0);
  const addToCart = ads.reduce((s, a) => s + a.addToCart, 0);
  const checkouts = ads.reduce((s, a) => s + a.checkouts, 0);
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const purchaseValue = ads.reduce((s, a) => s + a.conversionValue, 0);
  const landing = summarizeLanding(landingProbe);
  const funnel: FatigueFunnel = {
    clicks,
    landingPageViews,
    addToCart,
    checkouts,
    purchases,
    spend,
    purchaseValue,
    roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
    clickToPurchasePct: clicks > 0 ? (purchases / clicks) * 100 : 0,
    landingRatePct: clicks > 0 && landingPageViews > 0 ? (landingPageViews / clicks) * 100 : null,
    cartRatePct: clicks > 0 && addToCart > 0 ? (addToCart / clicks) * 100 : null,
    checkoutRatePct: clicks > 0 && checkouts > 0 ? (checkouts / clicks) * 100 : null,
  };

  const baselineParts: FatigueDailyPoint[] = [];
  const recentParts: FatigueDailyPoint[] = [];
  for (const ad of ads) {
    const pts = ad.daily.filter((p) => p.impressions > 0);
    if (pts.length === 0) continue;
    const size = Math.max(1, Math.min(7, Math.ceil(pts.length / 2)));
    baselineParts.push(...pts.slice(0, size));
    recentParts.push(...pts.slice(-size));
  }
  const sumCvr = (rows: FatigueDailyPoint[]) => {
    const c = rows.reduce((s, p) => s + p.clicks, 0);
    const v = rows.reduce((s, p) => s + p.conversions, 0);
    return c > 0 ? (v / c) * 100 : null;
  };
  const baselineCvr = sumCvr(baselineParts);
  const recentCvr = sumCvr(recentParts);
  const cvrChangePct =
    baselineCvr != null && recentCvr != null ? pctChange(baselineCvr, recentCvr) : 0;

  const spendWeightedCtrDrop =
    ads.reduce((s, a) => s + a.spend, 0) > 0
      ? ads.reduce((s, a) => s + a.ctrDropPct * a.spend, 0) / ads.reduce((s, a) => s + a.spend, 0)
      : 0;
  const cpaHot = ads.some((a) => a.diagnosis === "cpa_inflation" || a.cpaChangePct >= 25);
  const catalog = ads.some((a) => a.catalogTemplate);

  const pixelGapPct =
    store.connected && store.orders > 0 ? ((purchases - store.orders) / store.orders) * 100 : null;
  const aovChangePct =
    store.aovBaseline > 0 ? pctChange(store.aovBaseline, store.aovRecent) : 0;
  const refundRatePct = store.netSales + store.refunds > 0
    ? (store.refunds / (store.netSales + store.refunds)) * 100
    : 0;
  const mer =
    spend > 0 && store.connected && store.netSales > 0 ? store.netSales / spend : null;
  const advantagePlus = ads.some((ad) => ad.advantagePlus);

  const checks: FatigueEconomicsCheck[] = [];

  if (cpaHot && spendWeightedCtrDrop > -15 && cvrChangePct <= -25) {
    checks.push({
      id: "cvr",
      status: "fail",
      title: "Post-click conversion dropped",
      detail: `Click-to-purchase is ${cvrChangePct.toFixed(0)}% vs week 1 while CTR holds. The leak is after the click — PDP, offer, checkout, or purchase event.`,
    });
  } else if (cvrChangePct <= -15) {
    checks.push({
      id: "cvr",
      status: "warn",
      title: "Conversion rate is sliding",
      detail: `Click-to-purchase ${cvrChangePct.toFixed(0)}% vs week 1 (${(recentCvr ?? 0).toFixed(2)}% now).`,
    });
  } else if (clicks > 0) {
    checks.push({
      id: "cvr",
      status: "pass",
      title: "Post-click CVR is stable",
      detail: `Click-to-purchase ${funnel.clickToPurchasePct.toFixed(2)}% this window.`,
    });
  }

  if (!store.connected) {
    checks.push({
      id: "pixel",
      status: "unknown",
      title: "Store orders not synced",
      detail: "Connect WooCommerce to compare Meta purchases against real orders. A pixel/CAPI gap looks exactly like rising CPA.",
    });
  } else if (pixelGapPct != null) {
    if (pixelGapPct <= -25) {
      checks.push({
        id: "pixel",
        status: "fail",
        title: "Meta under-reports purchases vs the store",
        detail: `Meta counted ${purchases.toFixed(0)} purchases vs ${store.orders} WooCommerce orders (${pixelGapPct.toFixed(0)}%). Fix CAPI / event match before rotating creative.`,
      });
    } else if (pixelGapPct >= 25) {
      checks.push({
        id: "pixel",
        status: "warn",
        title: "Meta over-counts vs the store",
        detail: `Meta counted ${purchases.toFixed(0)} vs ${store.orders} store orders (+${pixelGapPct.toFixed(0)}%). Check duplicate Pixel+CAPI events or view-through credit.`,
      });
    } else {
      checks.push({
        id: "pixel",
        status: "pass",
        title: "Pixel matches store orders",
        detail: `Meta ${purchases.toFixed(0)} vs Woo ${store.orders} (${pixelGapPct >= 0 ? "+" : ""}${pixelGapPct.toFixed(0)}%).`,
      });
    }
  }

  if (
    mer != null &&
    funnel.roas != null &&
    mer >= funnel.roas * 1.4 &&
    store.orders > purchases * 1.3
  ) {
    checks.push({
      id: "mer",
      status: "warn",
      title: "Store MER is not this campaign's ROAS",
      detail: `Till MER is ${mer.toFixed(1)}x vs pixel ${funnel.roas.toFixed(1)}x on these ads${advantagePlus ? " (Advantage+)" : ""}. Refresh from frequency and CTR, not from blended MER.`,
    });
  }

  if (store.connected && store.aovBaseline > 0 && aovChangePct <= -15 && cpaHot) {
    checks.push({
      id: "aov",
      status: "warn",
      title: "AOV fell while CPA rose",
      detail: `Store AOV ${aovChangePct.toFixed(0)}% vs the first half of the window (${money(store.aovRecent, currency)} now). Mix, discount, or shipping — not a dead catalog.`,
    });
  }

  if (store.connected && refundRatePct >= 8) {
    checks.push({
      id: "refunds",
      status: "warn",
      title: "Refunds are eating reported CPA",
      detail: `Refunds are ${refundRatePct.toFixed(0)}% of gross. Meta still counts the original purchase.`,
    });
  }

  if (catalog && store.outOfStockCount > 0) {
    checks.push({
      id: "stock",
      status: "warn",
      title: "Catalog is advertising empty SKUs",
      detail: `${store.outOfStockCount} of ${store.productCount} products are out of stock. DPA will still click through — conversion dies on the PDP.`,
    });
  }

  if (funnel.landingRatePct != null && funnel.landingRatePct < 70) {
    checks.push({
      id: "landing",
      status: "warn",
      title: "Landing-page view rate is low",
      detail: `Only ${funnel.landingRatePct.toFixed(0)}% of clicks become a landing-page view. Slow PDP, interstitial, or URL mismatch.`,
    });
  }

  const offer = scoreOfferMatch(adOfferCopy(ads), landing, landingProbe.text);
  if (offer) {
    const existingLanding = checks.findIndex((c) => c.id === "landing");
    if (offer.status === "fail" && existingLanding >= 0) {
      checks.splice(existingLanding, 1);
    }
    checks.unshift(offer);
  }

  return { funnel, store, landing, cvrChangePct, pixelGapPct, mer, checks };
}

function appendEconomicsBrief(brief: string, economics: FatigueEconomics, health?: FatigueHealthReport): string {
  const hot = economics.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const healthFails = health?.checks.filter((c) => c.status === "fail" || c.status === "warn") ?? [];
  const parts = [brief];
  if (health && health.checks.length > 0) {
    parts.push("", `## Creative health — ${health.grade} (${health.score}/100)`, ...healthFails.map((c) => `- ${c.title}: ${c.detail}`));
  }
  if (hot.length > 0) {
    parts.push("", "## Economics — inspect before rotating", ...hot.map((c) => `- ${c.title}: ${c.detail}`));
  }
  return parts.join("\n");
}

export function assembleFatiguePayload(
  ads: FatigueAd[],
  platforms: FatiguePlatformStatus[],
  alertsCreated = 0,
  coverage: FatigueCoverage[] = [],
  currency: ReportingCurrency = DEFAULT_CURRENCY,
  store: FatigueStoreSnapshot = emptyStoreSnapshot(),
  landingProbe: FatigueLandingProbe = emptyLandingProbe(),
): FatiguePayload {
  const diversity = buildDiversity(ads);
  const clusters = clusterSimilarCreatives(ads);
  const { decay, decayKeys } = buildDecaySeries(ads);
  const sorted = [...ads].sort((a, b) => b.spend - a.spend);
  const kpis = buildKpis(sorted);
  const economics = buildEconomics(sorted, store, currency, landingProbe);
  const health = buildCreativeHealth(sorted, diversity, clusters, economics);
  const rewrites = buildOfferRewrites(sorted, economics.landing);
  return {
    connected: platforms.some((p) => p.connected),
    platforms,
    ads: sorted,
    adsets: buildAdSets(sorted),
    kpis,
    decay,
    decayKeys,
    scatter: buildScatter(sorted),
    diversity,
    clusters,
    recommendations: buildRecommendations(sorted, diversity, clusters, currency),
    inbox: withOfferInbox(buildActionInbox(sorted, currency), sorted, economics),
    calendar: buildRefreshCalendar(sorted),
    swaps: buildWinnerSwaps(sorted),
    mix: buildDiagnosisMix(sorted),
    brief: appendEconomicsBrief(buildProductionBrief(sorted, kpis, currency), economics, health),
    alertsCreated,
    coverage,
    launchDraft: buildLaunchDraft(sorted, kpis, currency),
    economics,
    health,
    rewrites,
  };
}

export function emptyFatiguePayload(
  platforms: FatiguePlatformStatus[],
): FatiguePayload {
  return assembleFatiguePayload([], platforms, 0);
}

function demoCpaDaily(): FatigueDailyPoint[] {
  const start = Date.parse("2026-07-30T00:00:00.000Z");
  const conversions = [8, 8, 7, 7, 6, 3, 3, 2, 2, 2];
  return conversions.map((conv, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const impressions = 18_000;
    const ctr = 5.59;
    const clicks = Math.round((impressions * ctr) / 100);
    return {
      date,
      ctr,
      frequency: 3.1 + i * 0.04,
      spend: 68,
      impressions,
      clicks,
      conversions: conv,
    };
  });
}

function demoDaily(ctr: number[]): FatigueDailyPoint[] {
  const start = Date.parse("2026-07-30T00:00:00.000Z");
  return ctr.map((value, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const impressions = 80_000 - i * 2_000;
    const clicks = Math.round((impressions * value) / 100);
    return {
      date,
      ctr: value,
      frequency: 1.2 + i * 0.25,
      spend: 40 + i * 3,
      impressions,
      clicks,
      conversions: Math.max(0, Math.round(clicks / 80)),
    };
  });
}

/** Showcase payload used when the active org is the Demo workspace. */
export function buildDemoFatiguePayload(): FatiguePayload {
  const drafts: FatigueAdDraft[] = [
    {
      adId: "c1",
      adName: "Summer Hero 15s",
      platform: "meta",
      campaignId: "camp-meta",
      campaignName: "Prospecting DACH",
      adsetId: "as1",
      adsetName: "Lookalike 1% · DACH",
      creativeTitle: "Summer Hero 15s",
      creativeBody: "Heat-ready silhouettes. Shop the drop.",
      creativeImageUrl: null,
      format: "video",
      objective: "prospecting",
      spend: 1840,
      impressions: 4_200_000,
      reach: 820_000,
      clicks: 47_040,
      ctr: 1.12,
      frequency: 5.12,
      conversions: 210,
      daysLive: 38,
      avgWatchSeconds: 4.2,
      daily: demoDaily([2.9, 2.7, 2.5, 2.3, 2.0, 1.7, 1.5, 1.3, 1.2, 1.12]),
    },
    {
      adId: "c2",
      adName: "UGC Unboxing",
      platform: "tiktok",
      campaignId: "camp-tt",
      campaignName: "TikTok Spark",
      adsetId: "as2",
      adsetName: "Spark · Broad 18–34",
      creativeTitle: "UGC Unboxing",
      creativeBody: "Real unboxing, no studio lights.",
      creativeImageUrl: null,
      format: "video",
      objective: "prospecting",
      spend: 1260,
      impressions: 6_800_000,
      reach: 2_100_000,
      clicks: 111_520,
      ctr: 1.64,
      frequency: 3.24,
      conversions: 188,
      daysLive: 29,
      avgWatchSeconds: 2.4,
      daily: demoDaily([2.4, 2.35, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.65, 1.64]),
    },
    {
      adId: "c3",
      adName: "Static −20% Off",
      platform: "meta",
      campaignId: "camp-meta",
      campaignName: "Prospecting DACH",
      adsetId: "as1",
      adsetName: "Lookalike 1% · DACH",
      creativeTitle: "Static −20% Off",
      creativeBody: "20% off sitewide. Shop the drop.",
      creativeImageUrl: null,
      format: "image",
      objective: "prospecting",
      spend: 980,
      impressions: 3_100_000,
      reach: 510_000,
      clicks: 17_980,
      ctr: 0.58,
      frequency: 6.08,
      conversions: 64,
      daysLive: 44,
      avgWatchSeconds: null,
      daily: demoDaily([1.8, 1.6, 1.45, 1.3, 1.15, 1.0, 0.9, 0.75, 0.65, 0.58]),
    },
    {
      adId: "c4",
      adName: "Carousel Lookbook",
      platform: "meta",
      campaignId: "camp-meta",
      campaignName: "Prospecting DACH",
      adsetId: "as3",
      adsetName: "Interest · Athleisure",
      creativeTitle: "Carousel Lookbook",
      creativeBody: "Four looks. One checkout.",
      creativeImageUrl: null,
      format: "carousel",
      objective: "prospecting",
      spend: 640,
      impressions: 2_700_000,
      reach: 1_100_000,
      clicks: 46_170,
      ctr: 1.71,
      frequency: 2.45,
      conversions: 92,
      daysLive: 21,
      avgWatchSeconds: null,
      daily: demoDaily([2.1, 2.08, 2.02, 2.0, 1.95, 1.9, 1.85, 1.8, 1.75, 1.71]),
    },
    {
      adId: "c5",
      adName: "Founder Story 30s",
      platform: "tiktok",
      campaignId: "camp-tt",
      campaignName: "TikTok Spark",
      adsetId: "as2",
      adsetName: "Spark · Broad 18–34",
      creativeTitle: "Founder Story 30s",
      creativeBody: "Why we started. Why it matters.",
      creativeImageUrl: null,
      format: "video",
      objective: "prospecting",
      spend: 410,
      impressions: 1_900_000,
      reach: 740_000,
      clicks: 26_980,
      ctr: 1.42,
      frequency: 2.57,
      conversions: 41,
      daysLive: 17,
      avgWatchSeconds: 5.1,
      daily: demoDaily([1.82, 1.78, 1.72, 1.66, 1.6, 1.56, 1.52, 1.48, 1.45, 1.42]),
    },
    {
      adId: "c6",
      adName: "PDP Hero Static",
      platform: "google",
      campaignId: "camp-g",
      campaignName: "PMax Fashion",
      adsetId: "as4",
      adsetName: "Asset group · PDP",
      creativeTitle: "PDP Hero Static",
      creativeBody: "Free shipping over €50.",
      creativeImageUrl: null,
      format: "image",
      objective: "prospecting",
      spend: 290,
      impressions: 1_100_000,
      reach: 0,
      clicks: 21_340,
      ctr: 1.94,
      frequency: 0,
      conversions: 38,
      daysLive: 12,
      avgWatchSeconds: null,
      daily: demoDaily([2.1, 2.1, 2.08, 2.06, 2.04, 2.02, 2.0, 1.98, 1.96, 1.94]),
    },
    {
      adId: "c7",
      adName: "Influencer Collab",
      platform: "tiktok",
      campaignId: "camp-tt",
      campaignName: "TikTok Spark",
      adsetId: "as5",
      adsetName: "Spark Ads · Creators",
      creativeTitle: "Influencer Collab",
      creativeBody: "Worn on a Tuesday. Shot on a phone.",
      creativeImageUrl: null,
      format: "video",
      objective: "prospecting",
      spend: 180,
      impressions: 840_000,
      reach: 390_000,
      clicks: 19_824,
      ctr: 2.36,
      frequency: 2.15,
      conversions: 29,
      daysLive: 8,
      avgWatchSeconds: 6.8,
      daily: demoDaily([2.48, 2.47, 2.45, 2.44, 2.42, 2.4, 2.39, 2.38, 2.37, 2.36]),
    },
    {
      adId: "c8",
      adName: "New Arrival Teaser",
      platform: "meta",
      campaignId: "camp-meta-rt",
      campaignName: "Retargeting 30d",
      adsetId: "as6",
      adsetName: "Site visitors 30d",
      creativeTitle: "New Arrival Teaser",
      creativeBody: "You left it in the bag. Finish checkout.",
      creativeImageUrl: null,
      format: "image",
      objective: "retargeting",
      spend: 120,
      impressions: 310_000,
      reach: 24_000,
      clicks: 8_742,
      ctr: 2.82,
      frequency: 12.9,
      conversions: 22,
      daysLive: 4,
      avgWatchSeconds: null,
      daily: demoDaily([2.88, 2.87, 2.86, 2.85, 2.85, 2.84, 2.84, 2.83, 2.83, 2.82]),
    },
    {
      adId: "c9",
      adName: "Advantage+ Catalog",
      platform: "meta",
      campaignId: "camp-meta-asc",
      campaignName: "Advantage+ PUR // Catalog",
      adsetId: "as7",
      adsetName: "Advantage+ catalog",
      creativeTitle: "[ {{product.current_price strip_zeros}} ] - {{product.name}}",
      creativeBody: "Μήνας Εκπτώσεων & -80% OFF",
      creativeImageUrl: null,
      format: "image",
      objective: "prospecting",
      spend: 680,
      impressions: 180_000,
      reach: 52_000,
      clicks: 10_062,
      ctr: 5.59,
      frequency: 3.46,
      conversions: 34,
      daysLive: 30,
      avgWatchSeconds: null,
      catalogTemplate: true,
      advantagePlus: true,
      landingPageViews: 9_200,
      addToCart: 210,
      checkouts: 58,
      conversionValue: 2_040,
      daily: demoCpaDaily(),
    },
  ];

  const ads = scoreDrafts(drafts);
  return assembleFatiguePayload(
    ads,
    [
      { id: "meta", connected: true, accountName: "StyleVault Meta Ads" },
      { id: "google", connected: true, accountName: "StyleVault Google Ads" },
      { id: "tiktok", connected: true, accountName: "StyleVault TikTok Ads" },
    ],
    0,
    [],
    DEFAULT_CURRENCY,
    {
      connected: true,
      website: "https://stylevault.example",
      orders: 92,
      netSales: 8_740,
      refunds: 210,
      aov: 95,
      aovBaseline: 118,
      aovRecent: 88,
      outOfStockCount: 3,
      productCount: 24,
    },
    {
      url: "https://stylevault.example",
      fetched: true,
      title: "StyleVault — About",
      text: "We are a fashion wholesale company founded in 2008. Register for B2B. Company profile and timeline.",
    },
  );
}

export const DIAGNOSIS_LABEL: Record<FatigueDiagnosis, string> = {
  creative_death: "Creative death",
  audience_saturation: "Audience saturation",
  always_weak: "Always weak",
  cpa_inflation: "CPA climbing",
  over_cadence: "Past cadence",
  healthy: "Healthy",
};

export const DIAGNOSIS_COLOR: Record<FatigueDiagnosis, string> = {
  creative_death: "#fb7185",
  audience_saturation: "#fbbf24",
  always_weak: "#a1a1aa",
  cpa_inflation: "#fb923c",
  over_cadence: "#e879f9",
  healthy: "#34d399",
};

export const PLATFORM_LABEL: Record<FatiguePlatform, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

export const PLATFORM_COLOR: Record<FatiguePlatform, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#FF0050",
};
