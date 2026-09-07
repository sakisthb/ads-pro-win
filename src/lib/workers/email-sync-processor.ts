/**
 * BullMQ worker processor for email-platform syncs (Omnisend / Brevo).
 *
 * **emailSyncWorker** — a Worker instance for the `sync-email` queue that
 * pulls campaign statistics from the Omnisend / Brevo APIs and upserts them
 * into the `DailyMetric` table (email sends → impressions, email clicks →
 * clicks, orders → conversions; spend stays 0 for email platforms).
 *
 * Every job follows the same lifecycle as `sync-processor.ts`:
 *
 * 1. Look up the `AdAccount` to obtain the stored (encrypted) credentials.
 * 2. Create a `SyncJob` record (status = 'running').
 * 3. Decrypt the access token and resolve the date range (empty values from
 *    repeatable jobs fall back to a 30-day window ending today).
 * 4. Fetch campaign data via the shared `@/lib/sync/fetchers` module.
 * 5. Batch-upsert results into `DailyMetric` via `createMany`.
 * 6. Update the `SyncJob` (status = 'completed', recordsProcessed) and the
 *    `AdAccount.lastSyncAt`.
 * 7. On error: update the `SyncJob` (status = 'failed', error message) and
 *    re-throw so BullMQ marks the job as failed.
 */

import { Worker, type Job } from 'bullmq'
import { createRedisConnection } from './redis-connection'
import type { MetricSyncJobData } from './queues'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import {
  fetchOmnisendData,
  fetchBrevoData,
  upsertDailyMetrics,
  type DailyMetricInput,
} from '@/lib/sync/fetchers'
import { fetchGa4Metrics, isGa4PropertyReady, parseGa4PropertyId } from '@/lib/ga4'
import { fetchGscMetrics, isGscSiteReady, parseGscSiteUrl } from '@/lib/gsc'
import { ensureFreshGoogleAccessToken } from '@/lib/oauth/google-refresh'
import { defaultSyncLookbackDays } from '@/lib/meta/actions'

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Process an email-sync job (Omnisend / Brevo).
 *
 * Job payload: `{ adAccountId, brandId?, platform, startDate, endDate }`.
 * `startDate` / `endDate` may be empty strings when the job was produced by
 * a repeatable schedule — the processor then syncs the last 30 days relative
 * to *when the job runs*, not when it was scheduled.
 */
async function processEmailSync(job: Job<MetricSyncJobData>): Promise<void> {
  const { adAccountId, platform, startDate, endDate } = job.data

  // Fetch the ad account to get stored credentials
  const adAccount = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  })
  if (!adAccount) {
    throw new Error(`[Worker:email] AdAccount not found: ${adAccountId}`)
  }
  if (!adAccount.accessToken) {
    throw new Error(
      `[Worker:email] No access token stored for account ${adAccountId}`,
    )
  }

  if (platform === 'google-analytics' && !isGa4PropertyReady(adAccount.accountId)) {
    console.warn(
      `[Worker:email] Skipping Google Analytics ${adAccountId} — GA4 property not selected`,
    )
    return
  }
  if (platform === 'google-search-console' && !isGscSiteReady(adAccount.accountId)) {
    console.warn(
      `[Worker:email] Skipping Search Console ${adAccountId} — site not selected`,
    )
    return
  }

  // Create SyncJob record
  const syncJob = await prisma.syncJob.create({
    data: {
      adAccountId,
      brandId: adAccount.brandId,
      type: 'metrics',
      platform,
      status: 'running',
      startedAt: new Date(),
    },
  })

  try {
    const accessToken = decrypt(adAccount.accessToken)

    // Calculate date range — empty values (from repeatable jobs) are
    // resolved dynamically so cron-triggered syncs always cover the
    // expected window relative to *when the job runs*.
    const now = new Date()
    const fallbackStart = new Date(now)
    fallbackStart.setDate(fallbackStart.getDate() - defaultSyncLookbackDays(platform, false))
    const resolvedStartDate = startDate || fallbackStart.toISOString().slice(0, 10)
    const resolvedEndDate = endDate || now.toISOString().slice(0, 10)

    const dateRange = {
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    }

    // Fetch campaign stats via the shared fetchers module
    let metrics: DailyMetricInput[]
    if (platform === 'omnisend') {
      metrics = await fetchOmnisendData(accessToken, dateRange)
    } else if (platform === 'brevo') {
      metrics = await fetchBrevoData(accessToken, dateRange)
    } else if (platform === 'google-analytics') {
      const gaToken = await ensureFreshGoogleAccessToken(
        {
          id: adAccount.id,
          accessToken: adAccount.accessToken,
          refreshToken: adAccount.refreshToken,
          tokenExpiry: adAccount.tokenExpiry,
        },
        'analytics',
      )
      const propertyId = parseGa4PropertyId(adAccount.accountId)
      if (!propertyId) {
        throw new Error('GA4 property not selected')
      }
      metrics = await fetchGa4Metrics(gaToken, propertyId, dateRange)
    } else if (platform === 'google-search-console') {
      const gscToken = await ensureFreshGoogleAccessToken(
        {
          id: adAccount.id,
          accessToken: adAccount.accessToken,
          refreshToken: adAccount.refreshToken,
          tokenExpiry: adAccount.tokenExpiry,
        },
        'analytics',
      )
      const siteUrl = parseGscSiteUrl(adAccount.accountId)
      if (!siteUrl) {
        throw new Error('Search Console site not selected')
      }
      metrics = await fetchGscMetrics(gscToken, siteUrl, dateRange)
    } else {
      throw new Error(`[Worker:email] Unsupported platform: ${platform}`)
    }

    // Batch-upsert the daily metrics
    const recordsProcessed = await upsertDailyMetrics(metrics, adAccountId, platform)

    // Mark SyncJob as completed
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
      `[Worker:email] ${platform} sync completed for ${adAccountId}: ${recordsProcessed} records`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[Worker:email] ${platform} sync failed for ${adAccountId}: ${message}`,
    )
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
// Worker instance
// ---------------------------------------------------------------------------

const connection = createRedisConnection()

/** Max concurrent jobs per queue (rate limiting). */
const CONCURRENCY = 3

/**
 * Email-sync worker — processes Omnisend / Brevo jobs from the `sync-email`
 * queue with a concurrency of 3.
 */
export const emailSyncWorker = new Worker<MetricSyncJobData>(
  'sync-email',
  processEmailSync,
  { connection, concurrency: CONCURRENCY },
)
