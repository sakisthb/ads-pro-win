/**
 * BullMQ worker processors for platform data-sync.
 *
 * Three logical workers are defined here:
 *
 *  • **metricSyncWorker** — a set of three Worker instances (one per ad
 *    platform queue) that fetch performance metrics via the MCP adapters
 *    and upsert them into the `DailyMetric` table.
 *
 *  • **wooSyncWorker** — a single Worker instance for the `sync-woocommerce`
 *    queue that pulls orders / products through persistWooCommerceSync (COGS,
 *    sold qty) rather than a zero-cost upsert.
 *
 *  • **opencartSyncWorker** — a single Worker instance for the `sync-opencart`
 *    queue that pulls orders / products through fetchOpenCartData.
 *
 * Every job follows the same lifecycle:
 *
 * 1.  Create a `SyncJob` record (status = 'running').
 * 2.  Instantiate & connect the platform adapter.
 * 3.  Fetch data from the platform.
 * 4.  Upsert results into the appropriate Prisma table.
 * 5.  Update the `SyncJob` (status = 'completed', recordsProcessed).
 * 6.  Disconnect the adapter.
 * 7.  On error: update the `SyncJob` (status = 'failed', error message)
 *     and re-throw so BullMQ marks the job as failed.
 */

import { Worker, type Job } from 'bullmq'
import { createRedisConnection } from './redis-connection'
import type { MetricSyncJobData, WooSyncJobData, OpenCartSyncJobData } from './queues'
import type {
  AdAccountCredentials,
  DateRange,
  PlatformAdapter,
} from '@/lib/mcp/types'
import { MetaAdsAdapter } from '@/lib/mcp/adapters/meta-ads'
import { GoogleAdsAdapter } from '@/lib/mcp/adapters/google-ads'
import { TikTokAdsAdapter } from '@/lib/mcp/adapters/tiktok-ads'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import { decrypt } from '@/lib/crypto'
import { logSecurityEvent } from '@/lib/security-events'
import { defaultSyncLookbackDays } from '@/lib/meta/actions'
import { parseGoogleAdsCustomerId, isGoogleAdsAccountReady } from '@/lib/google-ads-accounts'
import {
  campaignFromNormalized,
  fetchOpenCartData,
  fetchWooProducts,
  metricFromNormalized,
  persistWooCommerceSync,
  upsertAdCampaigns,
  upsertDailyMetrics,
  upsertWooOrders,
  upsertWooProducts,
} from '@/lib/sync/fetchers'
import { costMapFromProducts } from '@/lib/woo-orders'
import type { WorkerOptions } from 'bullmq'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build `AdAccountCredentials` from a Prisma `AdAccount` record, mapping
 * the correct fields for each platform.
 */
function buildMetricCredentials(
  adAccount: { accountId: string; accessToken: string | null },
  platform: string,
): AdAccountCredentials {
  const credentials: AdAccountCredentials = {
    platform: platform as AdAccountCredentials['platform'],
    accountId:
      platform === 'google'
        ? parseGoogleAdsCustomerId(adAccount.accountId) ?? adAccount.accountId
        : adAccount.accountId,
    accessToken: adAccount.accessToken ? decrypt(adAccount.accessToken) : undefined,
  }
  // Google Ads requires the developer token; it is app-level, not per-account.
  if (platform === 'google') {
    credentials.apiKey = config.marketing.google.developerToken ?? undefined
  }
  return credentials
}

/**
 * Instantiate the correct MCP adapter for the given platform.
 */
function createMetricAdapter(
  platform: string,
  credentials: AdAccountCredentials,
): PlatformAdapter {
  switch (platform) {
    case 'meta':
      return new MetaAdsAdapter(credentials)
    case 'google':
      return new GoogleAdsAdapter(credentials)
    case 'tiktok':
      return new TikTokAdsAdapter(credentials)
    default:
      throw new Error(`[Worker:metrics] Unsupported platform: ${platform}`)
  }
}


// ---------------------------------------------------------------------------
// Processor functions
// ---------------------------------------------------------------------------

/**
 * Process a metric-sync job (Meta / Google / TikTok).
 *
 * Steps:
 *  1. Look up the `AdAccount` to obtain credentials.
 *  2. Create a `SyncJob` record (status = 'running').
 *  3. Build credentials, instantiate & connect the adapter.
 *  4. Fetch performance metrics via `getPerformance()`.
 *  5. Upsert each metric into `DailyMetric`.
 *  6. Mark the `SyncJob` completed and update `AdAccount.lastSyncAt`.
 *  7. On error: mark the `SyncJob` failed and re-throw.
 */
export async function processMetricSync(job: Job<MetricSyncJobData>): Promise<void> {
  const { adAccountId, platform, startDate, endDate, isDelta } = job.data

  // Fetch the ad account to get stored credentials
  const adAccount = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  })
  if (!adAccount) {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'account_not_found',
      platform,
      adAccountId,
    })
    throw new Error(`[Worker:metrics] AdAccount not found: ${adAccountId}`)
  }
  if (platform === 'google' && !isGoogleAdsAccountReady(adAccount.accountId)) {
    logSecurityEvent('queue_failure', 'info', {
      code: 'account_not_ready',
      platform,
      adAccountId,
      message: 'Google Ads customer not selected',
    })
    return
  }

  // Create SyncJob record
  const syncJob = await prisma.syncJob.create({
    data: {
      adAccountId,
      type: 'metrics',
      platform,
      status: 'running',
      startedAt: new Date(),
    },
  })

  let adapter: PlatformAdapter | null = null
  try {
    const credentials = buildMetricCredentials(adAccount, platform)
    adapter = createMetricAdapter(platform, credentials)
    await adapter.connect(credentials)

    // Calculate date range — empty values (from repeatable jobs) are
    // resolved dynamically so that cron-triggered syncs always cover
    // the expected window relative to *when the job runs*, not when it
    // was scheduled.
    const now = new Date()
    const lookback = defaultSyncLookbackDays(platform, Boolean(isDelta))
    const resolvedStartDate =
      startDate ||
      (() => {
        const d = new Date(now)
        d.setDate(d.getDate() - lookback)
        return d.toISOString().slice(0, 10)
      })()
    const resolvedEndDate = endDate || now.toISOString().slice(0, 10)

    const dateRange: DateRange = {
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    }
    const metrics = await adapter.getPerformance(dateRange)
    let recordsProcessed = await upsertDailyMetrics(
      metrics.map(metricFromNormalized),
      adAccountId,
      platform,
    )

    try {
      const campaigns = await adapter.getCampaigns()
      recordsProcessed += await upsertAdCampaigns(
        campaigns.map(campaignFromNormalized),
        adAccountId,
        platform,
        adAccount.currency,
      )
    } catch (error) {
      logSecurityEvent('queue_failure', 'warn', {
        code: 'campaign_sync_skipped',
        platform,
        adAccountId,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed,
      },
    })

    // Update the ad account's lastSyncAt
    await prisma.adAccount.update({
      where: { id: adAccountId },
      data: { lastSyncAt: new Date() },
    })

    console.log(
      `[Worker:metrics] ${platform} sync completed for ${adAccountId}: ${recordsProcessed} records`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logSecurityEvent('queue_failure', 'error', {
      code: 'sync_failed',
      platform,
      adAccountId,
      message,
    })
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: message,
      },
    })
    throw error
  } finally {
    if (adapter) {
      await adapter.disconnect().catch(() => {})
    }
  }
}

/**
 * Resolve a WooCommerce AdAccount and decrypt its credentials at process time.
 * Jobs must never carry URLs, keys, or secrets — only identifiers.
 */
async function loadWooAccount(adAccountId: string) {
  const account = await prisma.adAccount.findUnique({ where: { id: adAccountId } })
  if (!account) {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'account_not_found',
      platform: 'woocommerce',
      adAccountId,
    })
    throw new Error(`[Worker:woo] AdAccount not found: ${adAccountId}`)
  }
  if (account.platform !== 'woocommerce') {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'platform_mismatch',
      platform: 'woocommerce',
      adAccountId,
    })
    throw new Error(`[Worker:woo] AdAccount ${adAccountId} is not a WooCommerce account`)
  }
  if (account.isActive !== true || !account.accessToken || !account.refreshToken || !account.accountId) {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'account_inactive',
      platform: 'woocommerce',
      adAccountId,
    })
    throw new Error(`[Worker:woo] AdAccount ${adAccountId} is missing store URL or tokens`)
  }
  return {
    brandId: account.brandId,
    storeUrl: account.accountId,
    consumerKey: decrypt(account.accessToken),
    consumerSecret: decrypt(account.refreshToken),
  }
}

/**
 * Process a WooCommerce sync job (orders or products).
 *
 * Orders jobs reuse persistWooCommerceSync (COGS, sold qty, lastSyncAt).
 * Products jobs refresh catalog cost/stock without resetting sold totals.
 */
export async function processWooSync(job: Job<WooSyncJobData>): Promise<void> {
  const { adAccountId, type, startDate, endDate } = job.data

  const { brandId, storeUrl, consumerKey, consumerSecret } = await loadWooAccount(adAccountId)

  // Create SyncJob record
  const syncJob = await prisma.syncJob.create({
    data: {
      brandId,
      type,
      platform: 'woocommerce',
      status: 'running',
      startedAt: new Date(),
    },
  })

  try {
    let recordsProcessed = 0

    if (type === 'orders') {
      // Same 365-day window as UI sync. A 30-day worker window would
      // reset soldQty to a partial till.
      const now = new Date()
      const lookback = defaultSyncLookbackDays('woocommerce', false)
      const fallbackStart = new Date(now)
      fallbackStart.setDate(fallbackStart.getDate() - lookback)
      const dateRange: DateRange = {
        startDate: startDate || fallbackStart.toISOString().slice(0, 10),
        endDate: endDate || now.toISOString().slice(0, 10),
      }
      const result = await persistWooCommerceSync({
        storeUrl,
        consumerKey,
        consumerSecret,
        brandId,
        dateRange,
      })
      recordsProcessed = result.orderCount + result.productCount
    } else {
      const products = await fetchWooProducts(storeUrl, consumerKey, consumerSecret)
      recordsProcessed = await upsertWooProducts(products, brandId)
    }

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed,
      },
    })
    console.log(
      `[Worker:woo] ${type} sync completed for ${brandId}: ${recordsProcessed} records`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logSecurityEvent('queue_failure', 'error', {
      code: 'sync_failed',
      platform: 'woocommerce',
      adAccountId,
      message,
    })
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: message,
      },
    })
    throw error
  }
}

/**
 * Resolve an OpenCart AdAccount and decrypt its credentials at process time.
 * Jobs must never carry URLs, keys, or secrets — only identifiers.
 */
async function loadOpenCartAccount(adAccountId: string) {
  const account = await prisma.adAccount.findUnique({ where: { id: adAccountId } })
  if (!account) {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'account_not_found',
      platform: 'opencart',
      adAccountId,
    })
    throw new Error(`[Worker:opencart] AdAccount not found: ${adAccountId}`)
  }
  if (account.platform !== 'opencart') {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'platform_mismatch',
      platform: 'opencart',
      adAccountId,
    })
    throw new Error(`[Worker:opencart] AdAccount ${adAccountId} is not an OpenCart account`)
  }
  if (account.isActive !== true || !account.accessToken || !account.refreshToken || !account.accountId) {
    logSecurityEvent('queue_failure', 'warn', {
      code: 'account_inactive',
      platform: 'opencart',
      adAccountId,
    })
    throw new Error(`[Worker:opencart] AdAccount ${adAccountId} is inactive or missing store URL or tokens`)
  }
  return {
    brandId: account.brandId,
    storeUrl: account.accountId,
    username: decrypt(account.accessToken),
    apiKey: decrypt(account.refreshToken),
  }
}

/**
 * Process an OpenCart sync job (orders only).
 *
 * Credentials are loaded from the AdAccount record and decrypted immediately
 * before the provider call. The job payload carries only identifiers.
 */
export async function processOpenCartSync(job: Job<OpenCartSyncJobData>): Promise<void> {
  const { adAccountId, startDate, endDate } = job.data

  const { brandId, storeUrl, username, apiKey } = await loadOpenCartAccount(adAccountId)

  // Create SyncJob record
  const syncJob = await prisma.syncJob.create({
    data: {
      adAccountId,
      brandId,
      type: 'orders_products',
      platform: 'opencart',
      status: 'running',
      startedAt: new Date(),
    },
  })

  try {
    const now = new Date()
    const lookback = defaultSyncLookbackDays('opencart', false)
    const fallbackStart = new Date(now)
    fallbackStart.setDate(fallbackStart.getDate() - lookback)
    const dateRange: DateRange = {
      startDate: startDate || fallbackStart.toISOString().slice(0, 10),
      endDate: endDate || now.toISOString().slice(0, 10),
    }

    const result = await fetchOpenCartData(username, apiKey, storeUrl, dateRange)

    // Persist products first so order COGS can use catalog costs when present.
    const productCount = await upsertWooProducts(result.products, brandId)
    const orderCount = await upsertWooOrders(
      result.orders,
      brandId,
      costMapFromProducts(result.products),
    )

    // Aggregate order revenue into DailyMetric (platform "opencart")
    await upsertDailyMetrics(result.metrics, adAccountId, 'opencart')

    const recordsProcessed = orderCount + productCount

    const completedAt = new Date()
    await prisma.$transaction([
      prisma.adAccount.update({
        where: { id: adAccountId },
        data: { lastSyncAt: completedAt },
      }),
      prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'completed',
          completedAt,
          recordsProcessed,
        },
      }),
    ])

    console.log(
      `[Worker:opencart] orders sync completed for ${adAccountId}: ${recordsProcessed} records`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logSecurityEvent('queue_failure', 'error', {
      code: 'sync_failed',
      platform: 'opencart',
      adAccountId,
      message,
    })
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: message,
      },
    })
    throw error
  }
}

// ---------------------------------------------------------------------------
// Worker instances
// ---------------------------------------------------------------------------

const connection = createRedisConnection()

/** Max concurrent jobs per queue (rate limiting). */
const CONCURRENCY = 3

/**
 * Shared worker safety controls:
 *  - bounded retry attempts with exponential backoff
 *  - capped completed/failed job retention to prevent unbounded Redis growth
 *  - stalled-job tolerance matching the retry budget
 */
const DEFAULT_WORKER_OPTS: WorkerOptions = {
  connection,
  concurrency: CONCURRENCY,
  autorun: true,
  maxStalledCount: 3,
  stalledInterval: 30_000,
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 250 },
}

/**
 * Metric-sync workers — one per ad platform queue. Each uses the same
 * `processMetricSync` processor with a concurrency of 3.
 */
export const metaSyncWorker = new Worker<MetricSyncJobData>(
  'sync-meta',
  processMetricSync,
  DEFAULT_WORKER_OPTS,
)

export const googleSyncWorker = new Worker<MetricSyncJobData>(
  'sync-google',
  processMetricSync,
  DEFAULT_WORKER_OPTS,
)

export const tiktokSyncWorker = new Worker<MetricSyncJobData>(
  'sync-tiktok',
  processMetricSync,
  DEFAULT_WORKER_OPTS,
)

/**
 * WooCommerce-sync worker — processes both `orders` and `products` jobs
 * from the `sync-woocommerce` queue with a concurrency of 3.
 */
export const wooSyncWorker = new Worker<WooSyncJobData>(
  'sync-woocommerce',
  processWooSync,
  DEFAULT_WORKER_OPTS,
)

/**
 * OpenCart-sync worker — processes `orders` jobs from the `sync-opencart`
 * queue with a concurrency of 3.
 */
export const opencartSyncWorker = new Worker<OpenCartSyncJobData>(
  'sync-opencart',
  processOpenCartSync,
  DEFAULT_WORKER_OPTS,
)
