/**
 * Google Ads adapter (read-only).
 *
 * All read operations (`getCampaigns`, `getPerformance`) are served through
 * the Google Ads MCP server. Any attempt to mutate state throws an explicit
 * error directing callers to the direct Google Ads API, per the read-only
 * contract of this adapter.
 */

import { config } from '@/lib/config'
import {
  McpClientManager,
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

/** Default Google Ads MCP endpoint when `GOOGLE_MCP_URL` is not configured. */
const DEFAULT_GOOGLE_MCP_URL = 'https://mcp.google.com/ads'

/** Stable server id used by the shared MCP connection pool. */
const GOOGLE_SERVER_ID = 'google-ads'

/** Standard message surfaced when a caller attempts a mutation. */
const READ_ONLY_MESSAGE =
  'Google Ads MCP is read-only. Use direct API for mutations.'

/** Google Ads campaign shape returned by the MCP server. */
interface GoogleMcpCampaign {
  id?: string | number
  name?: string
  status?: string
  advertising_channel_type?: string
  budget_amount_micros?: string | number
  start_date?: string
  currency?: string
  account_id?: string
}

/** A single Google Ads metrics row returned by the MCP reporting tool. */
interface GoogleMcpMetric {
  campaign_id?: string
  ad_group_id?: string
  ad_id?: string
  date?: string
  impressions?: string | number
  clicks?: string | number
  conversions?: string | number
  cost_micros?: string | number
  conversions_value?: string | number
  account_id?: string
  currency?: string
}

/** Map a Google Ads status onto the normalized enum. */
function mapStatus(raw: string | undefined): CampaignStatus {
  if (!raw) {
    return 'unknown'
  }
  const lower = raw.toLowerCase()
  if (lower === 'enabled' || lower === 'active') {
    return 'active'
  }
  if (lower === 'paused') {
    return 'paused'
  }
  if (lower === 'removed' || lower === 'archived') {
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
 * Read-only Google Ads adapter backed by the MCP connection pool. Mutations
 * are intentionally unsupported and throw {@link READ_ONLY_MESSAGE}.
 */
export class GoogleAdsAdapter implements PlatformAdapter {
  readonly platform = 'google'

  private credentials: AdAccountCredentials | null = null
  private connected = false

  constructor(credentials?: AdAccountCredentials) {
    this.credentials = credentials ?? null
  }

  async connect(credentials: AdAccountCredentials): Promise<void> {
    this.credentials = credentials
    const url = this.resolveUrl()
    console.log(`[MCP:google] connecting to ${url}`)
    await McpClientManager.getClient(this.serverId(), url, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken ?? ''}`,
        'X-Developer-Token': credentials.apiKey ?? '',
        'X-Customer-Id': credentials.accountId,
      },
    })
    this.connected = true
    console.log('[MCP:google] connection established')
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return
    }
    await McpClientManager.disconnect(GOOGLE_SERVER_ID)
    this.connected = false
    console.log('[MCP:google] disconnected')
  }

  isConnected(): boolean {
    return this.connected && McpClientManager.has(GOOGLE_SERVER_ID)
  }

  async getCampaigns(): Promise<NormalizedCampaign[]> {
    await this.ensureConnected()
    try {
      const result = await McpClientManager.callTool(
        GOOGLE_SERVER_ID,
        this.resolveUrl(),
        'list_campaigns',
        {
          customer_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
          developer_token: this.credentials?.apiKey,
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ results?: GoogleMcpCampaign[]; campaigns?: GoogleMcpCampaign[] }>(result)
      if (!payload) {
        console.warn('[MCP:google] list_campaigns returned no parseable payload')
        return []
      }

      const list = payload.results ?? payload.campaigns ?? []
      return list.map((c) => this.normalizeCampaign(c))
    } catch (error) {
      throw this.wrap('getCampaigns', error)
    }
  }

  async getPerformance(dateRange: DateRange): Promise<NormalizedMetric[]> {
    await this.ensureConnected()
    try {
      const result = await McpClientManager.callTool(
        GOOGLE_SERVER_ID,
        this.resolveUrl(),
        'get_performance',
        {
          customer_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
          developer_token: this.credentials?.apiKey,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ results?: GoogleMcpMetric[]; metrics?: GoogleMcpMetric[] }>(result)
      if (!payload) {
        console.warn('[MCP:google] get_performance returned no parseable payload')
        return []
      }

      const rows = payload.results ?? payload.metrics ?? []
      return rows.map((row) => this.normalizeMetric(row))
    } catch (error) {
      throw this.wrap('getPerformance', error)
    }
  }

  /* ----------------------------- Mutation guards ----------------------------- */

  /**
   * @throws Always — Google Ads MCP is read-only.
   */
  async createCampaign(): Promise<never> {
    throw new Error(`[MCP:google] ${READ_ONLY_MESSAGE}`)
  }

  /**
   * @throws Always — Google Ads MCP is read-only.
   */
  async updateCampaign(): Promise<never> {
    throw new Error(`[MCP:google] ${READ_ONLY_MESSAGE}`)
  }

  /**
   * @throws Always — Google Ads MCP is read-only.
   */
  async deleteCampaign(): Promise<never> {
    throw new Error(`[MCP:google] ${READ_ONLY_MESSAGE}`)
  }

  /* ---------------------------------------------------------------------- */

  private normalizeCampaign(c: GoogleMcpCampaign): NormalizedCampaign {
    return {
      id: String(c.id ?? ''),
      platform: this.platform,
      accountId: String(c.account_id ?? this.credentials?.accountId ?? ''),
      name: c.name ?? '',
      status: mapStatus(c.status),
      dailyBudget:
        c.budget_amount_micros !== undefined
          ? toNumber(c.budget_amount_micros) / 1_000_000
          : undefined,
      currency: c.currency ?? 'USD',
    }
  }

  private normalizeMetric(row: GoogleMcpMetric): NormalizedMetric {
    return {
      date: row.date ?? new Date().toISOString().slice(0, 10),
      platform: this.platform,
      accountId: String(row.account_id ?? this.credentials?.accountId ?? ''),
      campaignId: String(row.campaign_id ?? ''),
      adGroupId: row.ad_group_id ? String(row.ad_group_id) : undefined,
      adId: row.ad_id ? String(row.ad_id) : undefined,
      currency: row.currency ?? 'USD',
      spend: toNumber(row.cost_micros) / 1_000_000,
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      conversions: toNumber(row.conversions),
      conversionValue: toNumber(row.conversions_value),
    }
  }

  /** Lazily connect on first use so callers never need to await connect(). */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) {
      return
    }
    if (!this.credentials) {
      throw new Error(
        '[MCP:google] cannot connect — no credentials provided. Call connect() with AdAccountCredentials first.',
      )
    }
    await this.connect(this.credentials)
  }

  private serverId(): string {
    return GOOGLE_SERVER_ID
  }

  private resolveUrl(): string {
    return config.mcp.googleUrl ?? DEFAULT_GOOGLE_MCP_URL
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials?.accessToken ?? ''}`,
      'X-Developer-Token': this.credentials?.apiKey ?? '',
      'X-Customer-Id': this.credentials?.accountId ?? '',
    }
  }

  /** Wrap an unknown error with a platform-prefixed, descriptive message. */
  private wrap(operation: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`[MCP:google] ${operation} failed: ${message}`)
  }
}
