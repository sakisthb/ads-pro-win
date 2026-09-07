/**
 * WooCommerce adapter.
 *
 * Unlike the ad-platform adapters, WooCommerce is reached via its REST API
 * (the `@woocommerce/woocommerce-rest-api` package) rather than MCP. The
 * adapter still implements {@link PlatformAdapter} so it can live behind the
 * same integration seam, and additionally exposes commerce-specific methods
 * (`getOrders`, `getProducts`, `getProductStock`).
 *
 * The `getCampaigns` / `getPerformance` members of the adapter contract are
 * not meaningful for a commerce store and return empty arrays — callers
 * should use the commerce methods instead.
 */

import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api'
import { config } from '@/lib/config'
import type {
  AdAccountCredentials,
  DateRange,
  NormalizedCampaign,
  NormalizedMetric,
  PlatformAdapter,
  WooOrder,
  WooOrderLineItem,
  WooProduct,
  WooStockStatus,
} from '@/lib/mcp/types'

/** Raw WooCommerce order shape returned by the REST API. */
interface RawWooOrder {
  id: number
  order_key?: string
  status?: string
  currency?: string
  date_created?: string
  date_paid?: string | null
  total?: string
  total_tax?: string
  customer_id?: number
  billing?: {
    first_name?: string
    last_name?: string
    email?: string
    country?: string
  }
  line_items?: Array<{
    id: number
    name?: string
    product_id?: number
    quantity?: number
    subtotal?: string
    total?: string
  }>
}

/** Raw WooCommerce product shape returned by the REST API. */
interface RawWooProduct {
  id: number
  name?: string
  slug?: string
  type?: string
  status?: string
  sku?: string
  price?: string
  regular_price?: string
  sale_price?: string
  stock_quantity?: number | null
  stock_status?: string
  categories?: Array<{ id: number; name?: string }>
  images?: Array<{ id?: number; src?: string }>
}

/** Minimal view of an axios-style response envelope. */
interface WooResponse<T> {
  data: T
}

/** Coerce a stock status string onto the normalized enum. */
function mapStockStatus(raw: string | undefined): WooStockStatus {
  switch (raw) {
    case 'instock':
      return 'instock'
    case 'outofstock':
      return 'outofstock'
    case 'onbackorder':
      return 'onbackorder'
    default:
      return 'instock'
  }
}

/**
 * WooCommerce commerce adapter backed by the REST API library.
 */
export class WooCommerceAdapter implements PlatformAdapter {
  readonly platform = 'woocommerce'

  private credentials: AdAccountCredentials | null = null
  private api: WooCommerceRestApi | null = null

  constructor(credentials?: AdAccountCredentials) {
    this.credentials = credentials ?? null
  }

  async connect(credentials: AdAccountCredentials): Promise<void> {
    this.credentials = credentials
    const url = credentials.storeUrl ?? config.woocommerce.url
    const key = credentials.apiKey ?? config.woocommerce.key
    const secret = credentials.apiSecret ?? config.woocommerce.secret

    if (!url || !key || !secret) {
      throw new Error(
        '[MCP:woocommerce] cannot connect — store url, key and secret are required. Set WOOCOMMERCE_URL/KEY/SECRET or pass credentials.',
      )
    }

    console.log(`[MCP:woocommerce] connecting to ${url}`)
    this.api = new WooCommerceRestApi({
      url,
      consumerKey: key,
      consumerSecret: secret,
      version: 'wc/v3',
      queryStringAuth: true,
    })
    console.log('[MCP:woocommerce] REST client initialized')
  }

  async disconnect(): Promise<void> {
    this.api = null
    this.credentials = null
    console.log('[MCP:woocommerce] disconnected')
  }

  isConnected(): boolean {
    return this.api !== null
  }

  /**
   * Not applicable to a commerce store — returns an empty array. Callers
   * interested in commercial activity should use {@link getOrders} instead.
   */
  async getCampaigns(): Promise<NormalizedCampaign[]> {
    console.warn('[MCP:woocommerce] getCampaigns is not supported for commerce stores')
    return []
  }

  /**
   * Not applicable to a commerce store — returns an empty array. Revenue and
   * conversion data should be derived from {@link getOrders} instead.
   */
  async getPerformance(_dateRange: DateRange): Promise<NormalizedMetric[]> {
    console.warn('[MCP:woocommerce] getPerformance is not supported for commerce stores')
    return []
  }

  /* ----------------------------- Commerce API ----------------------------- */

  /** Retrieve orders within the supplied date range (by `date_created`). */
  async getOrders(dateRange: DateRange): Promise<WooOrder[]> {
    const api = await this.ensureConnected()
    try {
      const response = (await api.get('orders', {
        after: `${dateRange.startDate}T00:00:00`,
        before: `${dateRange.endDate}T23:59:59`,
        per_page: 100,
      })) as WooResponse<RawWooOrder[]>
      const orders = response.data ?? []
      return orders.map((o) => this.normalizeOrder(o))
    } catch (error) {
      throw this.wrap('getOrders', error)
    }
  }

  /** Retrieve all products (paginated, up to a reasonable ceiling). */
  async getProducts(): Promise<WooProduct[]> {
    const api = await this.ensureConnected()
    try {
      const response = (await api.get('products', {
        per_page: 100,
      })) as WooResponse<RawWooProduct[]>
      const products = response.data ?? []
      return products.map((p) => this.normalizeProduct(p))
    } catch (error) {
      throw this.wrap('getProducts', error)
    }
  }

  /** Return the stock quantity for a single product. */
  async getProductStock(productId: string): Promise<number> {
    const api = await this.ensureConnected()
    try {
      const response = (await api.get(`products/${productId}`)) as WooResponse<RawWooProduct>
      const product = response.data
      if (!product) {
        return 0
      }
      return product.stock_quantity ?? 0
    } catch (error) {
      throw this.wrap('getProductStock', error)
    }
  }

  /* ---------------------------------------------------------------------- */

  private normalizeOrder(o: RawWooOrder): WooOrder {
    const lineItems: WooOrderLineItem[] = (o.line_items ?? []).map((li) => ({
      id: li.id,
      name: li.name ?? '',
      productId: li.product_id ?? 0,
      quantity: li.quantity ?? 0,
      subtotal: li.subtotal ?? '0',
      total: li.total ?? '0',
    }))

    return {
      id: o.id,
      orderKey: o.order_key ?? '',
      status: o.status ?? 'unknown',
      currency: o.currency ?? 'USD',
      dateCreated: o.date_created ?? new Date().toISOString(),
      datePaid: o.date_paid ?? undefined,
      total: o.total ?? '0',
      totalTax: o.total_tax ?? '0',
      customerId: o.customer_id ?? 0,
      billing: {
        firstName: o.billing?.first_name ?? '',
        lastName: o.billing?.last_name ?? '',
        email: o.billing?.email ?? '',
        country: o.billing?.country ?? '',
      },
      lineItems,
    }
  }

  private normalizeProduct(p: RawWooProduct): WooProduct {
    return {
      id: p.id,
      name: p.name ?? '',
      slug: p.slug ?? '',
      type: p.type ?? 'simple',
      status: p.status ?? 'publish',
      sku: p.sku,
      price: p.price ?? '',
      regularPrice: p.regular_price ?? '',
      salePrice: p.sale_price ?? '',
      stockQuantity: p.stock_quantity ?? null,
      stockStatus: mapStockStatus(p.stock_status),
      categories: (p.categories ?? []).map((c) => ({ id: c.id, name: c.name ?? '' })),
      images: (p.images ?? []).map((i) => ({ id: i.id ?? 0, src: i.src ?? '' })),
    }
  }

  /** Lazily connect on first use so callers never need to await connect(). */
  private async ensureConnected(): Promise<WooCommerceRestApi> {
    if (this.api) {
      return this.api
    }
    if (!this.credentials) {
      throw new Error(
        '[MCP:woocommerce] cannot connect — no credentials provided. Call connect() with AdAccountCredentials first.',
      )
    }
    await this.connect(this.credentials)
    // `connect` populates `this.api`; assert non-null for the compiler.
    if (!this.api) {
      throw new Error('[MCP:woocommerce] failed to initialize REST client')
    }
    return this.api
  }

  /** Wrap an unknown error with a platform-prefixed, descriptive message. */
  private wrap(operation: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`[MCP:woocommerce] ${operation} failed: ${message}`)
  }
}
