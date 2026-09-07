/**
 * Meta (Facebook) Ads adapter.
 *
 * Bridges the {@link PlatformAdapter} contract to Meta's MCP ads server,
 * mapping raw tool responses into the normalized {@link NormalizedCampaign}
 * and {@link NormalizedMetric} shapes consumed by the rest of the app.
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
import {
  ATC_ACTION_TYPES,
  CHECKOUT_ACTION_TYPES,
  LANDING_PAGE_ACTION_TYPES,
  LINK_CLICK_ACTION_TYPES,
  formatAttributionSetting,
  formatAttributionSpec,
  inferResultFromActions,
  mapMetaCampaignStatus,
  metaCentsToAmount,
  parseAction,
  parseInsightsResults,
  parseIntSafe,
  parseNumber,
  parsePurchaseCount,
  parsePurchaseValue,
  parseWebsitePurchaseValue,
  parseWebsitePurchases,
  splitDateRange,
  META_INSIGHTS_CHUNK_DAYS,
} from '@/lib/meta/actions'
import type { MetaAction } from '@/lib/meta/actions'

/** Default Meta MCP endpoint when `META_MCP_URL` is not configured. */
const DEFAULT_META_MCP_URL = 'https://mcp.facebook.com/ads'

/** Stable server id used by the shared MCP connection pool. */
const META_SERVER_ID = 'meta-ads'

/** Meta campaign as returned by the MCP `list_campaigns` tool. */
interface MetaMcpCampaign {
  id?: string | number
  name?: string
  status?: string
  effective_status?: string
  objective?: string
  daily_budget?: number | string
  lifetime_budget?: number | string
  currency?: string
  account_id?: string
  created_time?: string
  updated_time?: string
  start_time?: string
  stop_time?: string
  attribution_spec?: unknown
  attribution_setting?: string
}

/** A single Meta insights row returned by the MCP reporting tool. */
interface MetaMcpInsight {
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  ad_id?: string
  date_start?: string
  spend?: string | number
  impressions?: string | number
  clicks?: string | number
  inline_link_clicks?: string | number
  reach?: string | number
  frequency?: string | number
  actions?: MetaAction[]
  action_values?: MetaAction[]
  conversion_values?: MetaAction[]
  account_id?: string
  currency?: string
  objective?: string
  attribution_setting?: string
  results?: unknown
}

/** Map a Meta campaign status string onto the normalized enum. */
function mapStatus(raw: string | undefined, effective?: string): CampaignStatus {
  return mapMetaCampaignStatus(raw, effective)
}

/**
 * Meta Ads adapter backed by the MCP connection pool.
 */
export class MetaAdsAdapter implements PlatformAdapter {
  readonly platform = 'meta'

  private credentials: AdAccountCredentials | null = null
  private connected = false

  constructor(credentials?: AdAccountCredentials) {
    this.credentials = credentials ?? null
  }

  async connect(credentials: AdAccountCredentials): Promise<void> {
    this.credentials = credentials
    const url = this.resolveUrl()
    console.log(`[MCP:meta] connecting to ${url}`)
    await McpClientManager.getClient(this.serverId(), url, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken ?? ''}`,
        'X-Ad-Account': credentials.accountId,
      },
    })
    this.connected = true
    console.log('[MCP:meta] connection established')
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return
    }
    await McpClientManager.disconnect(META_SERVER_ID)
    this.connected = false
    console.log('[MCP:meta] disconnected')
  }

  isConnected(): boolean {
    return this.connected && McpClientManager.has(META_SERVER_ID)
  }

  async getCampaigns(): Promise<NormalizedCampaign[]> {
    await this.ensureConnected()
    try {
      const result = await McpClientManager.callTool(
        META_SERVER_ID,
        this.resolveUrl(),
        'list_campaigns',
        {
          account_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ data?: MetaMcpCampaign[]; campaigns?: MetaMcpCampaign[] }>(result)
      if (!payload) {
        console.warn('[MCP:meta] list_campaigns returned no parseable payload')
        return []
      }

      const list = payload.data ?? payload.campaigns ?? []
      return list.map((c) => this.normalizeCampaign(c))
    } catch (error) {
      throw this.wrap('getCampaigns', error)
    }
  }

  async getPerformance(dateRange: DateRange): Promise<NormalizedMetric[]> {
    await this.ensureConnected()
    const chunks = splitDateRange(dateRange.startDate, dateRange.endDate, META_INSIGHTS_CHUNK_DAYS)
    const all: NormalizedMetric[] = []
    for (let i = 0; i < chunks.length; i += 1) {
      all.push(...(await this.getPerformanceChunk(chunks[i])))
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    return all
  }

  private async getPerformanceChunk(dateRange: DateRange): Promise<NormalizedMetric[]> {
    try {
      const result = await McpClientManager.callTool(
        META_SERVER_ID,
        this.resolveUrl(),
        'get_insights',
        {
          account_id: this.credentials?.accountId,
          access_token: this.credentials?.accessToken,
          time_range: { since: dateRange.startDate, until: dateRange.endDate },
          level: 'campaign',
          time_increment: 1,
          fields: [
            'spend',
            'impressions',
            'clicks',
            'inline_link_clicks',
            'reach',
            'frequency',
            'actions',
            'action_values',
            'campaign_id',
            'campaign_name',
            'objective',
            'attribution_setting',
            'results',
          ],
        },
        this.authHeaders(),
      )

      const payload = parseToolJson<{ data?: MetaMcpInsight[]; insights?: MetaMcpInsight[] }>(result)
      if (!payload) {
        console.warn('[MCP:meta] get_insights returned no parseable payload')
        return []
      }

      const rows = payload.data ?? payload.insights ?? []
      return rows.map((row) => this.normalizeMetric(row))
    } catch (error) {
      throw this.wrap('getPerformance', error)
    }
  }

  /* ---------------------------------------------------------------------- */

  private normalizeCampaign(c: MetaMcpCampaign): NormalizedCampaign {
    const dailyBudget = metaCentsToAmount(c.daily_budget) ?? undefined
    const lifetimeBudget = metaCentsToAmount(c.lifetime_budget) ?? undefined
    return {
      id: String(c.id ?? ''),
      platform: this.platform,
      accountId: String(c.account_id ?? this.credentials?.accountId ?? ''),
      name: c.name ?? '',
      status: mapStatus(c.status, c.effective_status),
      dailyBudget,
      lifetimeBudget,
      currency: c.currency ?? 'EUR',
      objective: c.objective,
      effectiveStatus: c.effective_status,
      budgetType: dailyBudget ? 'daily' : lifetimeBudget ? 'lifetime' : 'adset',
      attributionSetting:
        formatAttributionSetting(c.attribution_setting) ?? formatAttributionSpec(c.attribution_spec),
      createdTime: c.created_time,
      updatedTime: c.updated_time,
      startTime: c.start_time,
      stopTime: c.stop_time,
    }
  }

  private normalizeMetric(row: MetaMcpInsight): NormalizedMetric {
    const actions = row.actions
    const actionValues = row.action_values ?? row.conversion_values
    const reach = parseIntSafe(row.reach)
    const fromResults = parseInsightsResults(row.results)
    const inferred = inferResultFromActions(actions, row.objective, reach)
    const inlineLinkClicks = parseIntSafe(row.inline_link_clicks)
    const actionLinkClicks = parseAction(actions, LINK_CLICK_ACTION_TYPES)
    return {
      date: row.date_start ?? new Date().toISOString().slice(0, 10),
      platform: this.platform,
      accountId: String(row.account_id ?? this.credentials?.accountId ?? ''),
      campaignId: String(row.campaign_id ?? ''),
      campaignName: row.campaign_name,
      adGroupId: row.adset_id ? String(row.adset_id) : undefined,
      adId: row.ad_id ? String(row.ad_id) : undefined,
      currency: row.currency ?? 'EUR',
      spend: parseNumber(row.spend),
      impressions: parseIntSafe(row.impressions),
      clicks: parseIntSafe(row.clicks),
      conversions: parsePurchaseCount(actions),
      conversionValue: parsePurchaseValue(actionValues),
      reach,
      frequency: parseNumber(row.frequency),
      linkClicks: inlineLinkClicks > 0 ? inlineLinkClicks : actionLinkClicks,
      landingPageViews: parseIntSafe(parseAction(actions, LANDING_PAGE_ACTION_TYPES)),
      addToCart: parseAction(actions, ATC_ACTION_TYPES),
      checkouts: parseAction(actions, CHECKOUT_ACTION_TYPES),
      websitePurchases: parseWebsitePurchases(actions),
      websitePurchaseValue: parseWebsitePurchaseValue(actionValues),
      results: fromResults.results > 0 ? fromResults.results : inferred.results,
      resultType: fromResults.resultType ?? inferred.resultType,
      attributionSetting: formatAttributionSetting(row.attribution_setting),
    }
  }

  /** Lazily connect on first use so callers never need to await connect(). */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) {
      return
    }
    if (!this.credentials) {
      throw new Error(
        '[MCP:meta] cannot connect — no credentials provided. Call connect() with AdAccountCredentials first.',
      )
    }
    await this.connect(this.credentials)
  }

  private serverId(): string {
    return META_SERVER_ID
  }

  private resolveUrl(): string {
    return config.mcp.metaUrl ?? DEFAULT_META_MCP_URL
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials?.accessToken ?? ''}`,
      'X-Ad-Account': this.credentials?.accountId ?? '',
    }
  }

  /** Wrap an unknown error with a platform-prefixed, descriptive message. */
  private wrap(operation: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`[MCP:meta] ${operation} failed: ${message}`)
  }
}
