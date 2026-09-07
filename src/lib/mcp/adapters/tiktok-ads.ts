/**
 * TikTok Ads adapter.
 *
 * TikTok's MCP server exposes a very large surface (~400 tools). To keep
 * startup fast we use *progressive disclosure*: on first use we fetch only
 * the initial page of tools (≈40) and cache it; further pages can be loaded
 * on demand via {@link TikTokAdsAdapter.discoverMoreTools}. The cached tool
 * list is reused for the lifetime of the adapter instance.
 */

import { config } from '@/lib/config'
import {
  McpClientManager,
  type McpToolInfo,
  parseToolJson,
} from '@/lib/mcp/client-manager'
import type {
  AdAccountCredentials,
  CampaignStatus,
  DateRange,
  NormalizedCampaign,
  NormalizedMetric,
  PlatformAdapter,
} from '@/lib/mcp/types'

/** Default TikTok Ads MCP endpoint when `TIKTOK_MCP_URL` is not configured. */
const DEFAULT_TIKTOK_MCP_URL =
  'https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer'

/** Stable server id used by the shared MCP connection pool. */
const TIKTOK_SERVER_ID = 'tiktok-ads'

/** TikTok campaign shape returned by the MCP server. */
interface TikTokMcpCampaign {
  campaign_id?: string
  campaign_name?: string
  status?: string
  objective_type?: string
  budget?: number
  budget_type?: string
  currency?: string
  advertiser_id?: string
}

/** A single TikTok report row returned by the MCP reporting tool. */
interface TikTokMcpMetric {
  campaign_id?: string
  adgroup_id?: string
  ad_id?: string
  date?: string
  statistic?: {
    spend?: string | number
    impressions?: string | number
    clicks?: string | number
    conversion?: string | number
    conversion_value?: string | number
  }
  advertiser_id?: string
  currency?: string
}

/** Map a TikTok status onto the normalized enum. */
function mapStatus(raw: string | undefined): CampaignStatus {
  if (!raw) {
    return 'unknown'
  }
  const lower = raw.toLowerCase()
  if (lower === 'enable' || lower === 'enabled' || lower === 'active') {
    return 'active'
  }
  if (lower === 'disable' || lower === 'disabled' || lower === 'paused') {
    return 'paused'
  }
  if (lower === 'delete' || lower === 'archived') {
    return 'archived'
  }
  return 'unknown'
}

/** Coerce a value that may be a numeric string into a finite number. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/**
 * TikTok Ads adapter backed by the MCP connection pool with progressive
 * tool discovery.
 */
export class TikTokAdsAdapter implements PlatformAdapter {
  readonly platform = 'tiktok'

  private credentials: AdAccountCredentials | null = null
  private connected = false

  /** Cached first page of tools (progressive disclosure). */
  private cachedTools: McpToolInfo[] | null = null

  /** Cursor for the next page of tools, if more are available. */
  private nextCursor: string | undefined

  constructor(credentials?: AdAccountCredentials) {
    this.credentials = credentials ?? null
  }

  async connect(credentials: AdAccountCredentials): Promise<void> {
    this.credentials = credentials
    const url = this.resolveUrl()
    console.log(`[MCP:tiktok] connecting to ${url}`)
    await McpClientManager.getClient(this.serverId(), url, {
      headers: {
        'Access-Token': credentials.accessToken ?? '',
        'X-Advertiser-Id': credentials.accountId,
      },
    })
    this.connected = true
    console.log('[MCP:tiktok] connection established')
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return
    }
    await McpClientManager.disconnect(TIKTOK_SERVER_ID)
    this.connected = false
    this.cachedTools = null
    this.nextCursor = undefined
    console.log('[MCP:tiktok] disconnected')
  }

  isConnected(): boolean {
    return this.connected && McpClientManager.has(TIKTOK_SERVER_ID)
  }

  /**
   * Discover the initial page of TikTok MCP tools (≈40). Subsequent calls
   * return the cached list without re-issuing `listTools`.
   */
  async discoverTools(): Promise<McpToolInfo[]> {
    if (this.cachedTools) {
      return this.cachedTools
    }
    await this.ensureConnected()
    try {
      const { tools, nextCursor } = await McpClientManager.listTools(
        TIKTOK_SERVER_ID,
        this.resolveUrl(),
        this.authHeaders(),
      )
      this.cachedTools = tools
      this.nextCursor = nextCursor
      console.log(
        `[MCP:tiktok] discovered ${tools.length} tools${nextCursor ? ' (more available)' : ''}`,
      )
      return tools
    } catch (error) {
      throw this.wrap('discoverTools', error)
    }
  }

  /**
   * Load the next page of tools and append them to the cache. Returns the
   * newly discovered tools (empty if there is nothing more to load).
   */
  async discoverMoreTools(): Promise<McpToolInfo[]> {
    if (!this.nextCursor) {
      return []
    }
    await this.ensureConnected()
    try {
      const { tools, nextCursor } = await McpClientManager.listTools(
        TIKTOK_SERVER_ID,
        this.resolveUrl(),
        this.authHeaders(),
      )
      if (!this.cachedTools) {
        this.cachedTools = []
      }
      this.cachedTools = [...this.cachedTools, ...tools]
      this.nextCursor = nextCursor
      console.log(`[MCP:tiktok] loaded ${tools.length} additional tools`)
      return tools
    } catch (error) {
      throw this.wrap('discoverMoreTools', error)
    }
  }

  /** Whether a tool with the given name is present in the cached set. */
  hasTool(name: string): boolean {
    return !!this.cachedTools?.some((t) => t.name === name)
  }

  async getCampaigns(): Promise<NormalizedCampaign[]> {
    await this.ensureConnected()
    try {
      const result = await McpClientManager.callTool(
        TIKTOK_SERVER_ID,
        this.resolveUrl(),
        'list_campaigns',
        {
          advertiser_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ campaigns?: TikTokMcpCampaign[]; data?: TikTokMcpCampaign[] }>(result)
      if (!payload) {
        console.warn('[MCP:tiktok] list_campaigns returned no parseable payload')
        return []
      }

      const list = payload.campaigns ?? payload.data ?? []
      return list.map((c) => this.normalizeCampaign(c))
    } catch (error) {
      throw this.wrap('getCampaigns', error)
    }
  }

  async getPerformance(dateRange: DateRange): Promise<NormalizedMetric[]> {
    await this.ensureConnected()
    try {
      const result = await McpClientManager.callTool(
        TIKTOK_SERVER_ID,
        this.resolveUrl(),
        'get_report',
        {
          advertiser_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          level: 'campaign',
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ data?: TikTokMcpMetric[]; report?: TikTokMcpMetric[] }>(result)
      if (!payload) {
        console.warn('[MCP:tiktok] get_report returned no parseable payload')
        return []
      }

      const rows = payload.data ?? payload.report ?? []
      return rows.map((row) => this.normalizeMetric(row))
    } catch (error) {
      throw this.wrap('getPerformance', error)
    }
  }

  /* ---------------------------------------------------------------------- */

  private normalizeCampaign(c: TikTokMcpCampaign): NormalizedCampaign {
    const isDaily = c.budget_type?.toLowerCase() === 'daily'
    return {
      id: String(c.campaign_id ?? ''),
      platform: this.platform,
      accountId: String(c.advertiser_id ?? this.credentials?.accountId ?? ''),
      name: c.campaign_name ?? '',
      status: mapStatus(c.status),
      dailyBudget: isDaily && c.budget !== undefined ? toNumber(c.budget) : undefined,
      lifetimeBudget: !isDaily && c.budget !== undefined ? toNumber(c.budget) : undefined,
      currency: c.currency ?? 'USD',
    }
  }

  private normalizeMetric(row: TikTokMcpMetric): NormalizedMetric {
    const stat = row.statistic ?? {}
    return {
      date: row.date ?? new Date().toISOString().slice(0, 10),
      platform: this.platform,
      accountId: String(row.advertiser_id ?? this.credentials?.accountId ?? ''),
      campaignId: String(row.campaign_id ?? ''),
      adGroupId: row.adgroup_id ? String(row.adgroup_id) : undefined,
      adId: row.ad_id ? String(row.ad_id) : undefined,
      currency: row.currency ?? 'USD',
      spend: toNumber(stat.spend),
      impressions: toNumber(stat.impressions),
      clicks: toNumber(stat.clicks),
      conversions: toNumber(stat.conversion),
      conversionValue: toNumber(stat.conversion_value),
    }
  }

  /** Lazily connect on first use so callers never need to await connect(). */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) {
      return
    }
    if (!this.credentials) {
      throw new Error(
        '[MCP:tiktok] cannot connect — no credentials provided. Call connect() with AdAccountCredentials first.',
      )
    }
    await this.connect(this.credentials)
  }

  private serverId(): string {
    return TIKTOK_SERVER_ID
  }

  private resolveUrl(): string {
    return config.mcp.tiktokUrl ?? DEFAULT_TIKTOK_MCP_URL
  }

  private authHeaders(): Record<string, string> {
    return {
      'Access-Token': this.credentials?.accessToken ?? '',
      'X-Advertiser-Id': this.credentials?.accountId ?? '',
    }
  }

  /** Wrap an unknown error with a platform-prefixed, descriptive message. */
  private wrap(operation: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`[MCP:tiktok] ${operation} failed: ${message}`)
  }
}
