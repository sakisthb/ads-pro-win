/**
 * Shared type definitions for the MCP (Model Context Protocol) integration layer.
 *
 * These types provide a platform-agnostic contract that every ad-platform
 * adapter must satisfy, plus the normalized data shapes that flow through
 * the rest of the application regardless of the underlying platform API.
 */

/** A date range expressed in ISO `YYYY-MM-DD` format. */
export interface DateRange {
  /** Inclusive start date in `YYYY-MM-DD` format. */
  startDate: string
  /** Inclusive end date in `YYYY-MM-DD` format. */
  endDate: string
}

/** Supported platform identifiers for ad / commerce accounts. */
export type PlatformName = 'meta' | 'google' | 'tiktok' | 'woocommerce'

/**
 * Credentials required to connect to a given platform account.
 * Only the fields relevant to the target platform need to be populated.
 */
export interface AdAccountCredentials {
  platform: PlatformName
  accountId: string
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  apiSecret?: string
  storeUrl?: string
}

/**
 * A single row of performance data, normalized across every platform so
 * downstream consumers never need to know the source schema.
 */
export interface NormalizedMetric {
  date: string
  platform: string
  accountId: string
  campaignId: string
  campaignName?: string
  adGroupId?: string
  adId?: string
  currency: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
  reach?: number
  frequency?: number
  linkClicks?: number
  landingPageViews?: number
  addToCart?: number
  checkouts?: number
  websitePurchases?: number
  websitePurchaseValue?: number
  results?: number
  resultType?: string | null
  attributionSetting?: string | null
}

/** Lifecycle status of a campaign, mapped from platform-specific enums. */
export type CampaignStatus = 'active' | 'paused' | 'archived' | 'unknown'

/**
 * A campaign entity normalized across platforms. Optional budget fields are
 * omitted when a platform does not expose them.
 */
export interface NormalizedCampaign {
  id: string
  platform: string
  accountId: string
  name: string
  status: CampaignStatus
  dailyBudget?: number
  lifetimeBudget?: number
  currency: string
  objective?: string
  effectiveStatus?: string
  budgetType?: 'daily' | 'lifetime' | 'adset'
  attributionSetting?: string | null
  createdTime?: string
  updatedTime?: string
  startTime?: string
  stopTime?: string
}

/**
 * The contract every platform adapter must implement. Adapters translate
 * between the normalized types above and the specifics of their platform's
 * API (MCP-based or direct REST).
 */
export interface PlatformAdapter {
  /** Stable, lowercase identifier for the platform (e.g. `meta`). */
  readonly platform: string

  /** Establish a connection using the supplied credentials. */
  connect(credentials: AdAccountCredentials): Promise<void>

  /** Tear down any active connection and release resources. */
  disconnect(): Promise<void>

  /** Whether the adapter currently holds an active connection. */
  isConnected(): boolean

  /** Retrieve all campaigns for the connected account. */
  getCampaigns(): Promise<NormalizedCampaign[]>

  /** Retrieve performance metrics for the supplied date range. */
  getPerformance(dateRange: DateRange): Promise<NormalizedMetric[]>
}

/* -------------------------------------------------------------------------- */
/* WooCommerce commerce entities                                              */
/* -------------------------------------------------------------------------- */

/** A WooCommerce order line item. */
export interface WooOrderLineItem {
  id: number
  name: string
  productId: number
  quantity: number
  subtotal: string
  total: string
}

/** A normalized WooCommerce order. */
export interface WooOrder {
  id: number
  orderKey: string
  status: string
  currency: string
  dateCreated: string
  datePaid?: string
  total: string
  totalTax: string
  customerId: number
  billing: {
    firstName: string
    lastName: string
    email: string
    country: string
  }
  lineItems: WooOrderLineItem[]
}

/** Stock status reported by WooCommerce. */
export type WooStockStatus = 'instock' | 'outofstock' | 'onbackorder'

/** A normalized WooCommerce product. */
export interface WooProduct {
  id: number
  name: string
  slug: string
  type: string
  status: string
  sku?: string
  price: string
  regularPrice: string
  salePrice: string
  stockQuantity: number | null
  stockStatus: WooStockStatus
  categories: { id: number; name: string }[]
  images: { id: number; src: string }[]
}
