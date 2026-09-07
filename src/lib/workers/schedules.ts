/**
 * BullMQ repeatable-job schedules for platform data-sync.
 *
 * Three schedule shapes are defined:
 *
 *  - Metric syncs, for every active AdAccount:
 *      - Daily full sync at 04:00 UTC.
 *      - Hourly delta sync; the processor uses a 28-day window for Meta
 *        (Insights restatement) and 1 day for other ad platforms.
 *
 *  - WooCommerce syncs, for every active Woo AdAccount:
 *      - Orders sync every 2 hours (365-day lookback, COGS + sold qty).
 *      - Products sync daily at 03:00 UTC.
 *
 *  - Email / OpenCart syncs, for every active Omnisend, Brevo or OpenCart
 *    AdAccount:
 *      - Campaign / order sync every 6 hours.
 *
 * setupSchedules is idempotent: BullMQ deduplicates repeatable jobs by
 * name + repeat-key, so calling it multiple times is safe.
 */

import {
  metaSyncQueue,
  googleSyncQueue,
  tiktokSyncQueue,
  wooSyncQueue,
  emailSyncQueue,
  opencartSyncQueue,
  alertQueue,
} from './queues'
import type { MetricSyncJobData, WooSyncJobData, OpenCartSyncJobData } from './queues'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'

// ---------------------------------------------------------------------------
// Cron patterns
// ---------------------------------------------------------------------------

/** Daily full sync at 04:00 UTC. */
const DAILY_CRON = '0 4 * * *'

/** Hourly delta sync (every hour at minute 0). */
const HOURLY_CRON = '0 * * * *'

/** WooCommerce orders sync every 2 hours. */
const WOO_ORDERS_CRON = '0 */2 * * *'

/** WooCommerce products sync daily at 03:00 UTC. */
const WOO_PRODUCTS_CRON = '0 3 * * *'

/** Email (Omnisend / Brevo) & OpenCart sync every 6 hours. */
export const SIX_HOURLY_CRON = '0 */6 * * *'

/** Budget alert check every hour at :30. */
export const ALERT_CHECK_CRON = '30 * * * *'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the correct BullMQ queue for a given ad platform. */
function getMetricQueue(platform: string) {
  switch (platform) {
    case 'meta':
      return metaSyncQueue
    case 'google':
      return googleSyncQueue
    case 'tiktok':
      return tiktokSyncQueue
    default:
      throw new Error(`[Schedules] Unknown metric platform: ${platform}`)
  }
}

/** Job name for a daily full-sync repeatable job. */
function dailyJobName(adAccountId: string): string {
  return `sync:${adAccountId}:daily`
}

/** Job name for an hourly delta-sync repeatable job. */
function hourlyJobName(adAccountId: string): string {
  return `sync:${adAccountId}:hourly`
}

/** Job name for a WooCommerce orders repeatable job. */
function wooOrdersJobName(brandId: string): string {
  return `woo:${brandId}:orders`
}

/** Job name for a WooCommerce products repeatable job. */
function wooProductsJobName(brandId: string): string {
  return `woo:${brandId}:products`
}

/** Job name for a 6-hourly email-sync repeatable job. */
function emailJobName(adAccountId: string): string {
  return `sync:${adAccountId}:sixhourly`
}

/** Job name for a 6-hourly OpenCart repeatable job. */
function opencartJobName(adAccountId: string): string {
  return `opencart:${adAccountId}:sixhourly`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set up repeatable sync schedules for all active ad accounts and WooCommerce
 * brands.  Should be called once during application startup.
 *
 * Idempotent: BullMQ deduplicates repeatable jobs by name + repeat-key.
 */
export async function setupSchedules(): Promise<void> {
  // ---- Ad platform metric syncs ----
  if (config.features.mcpEnabled) {
    const accounts = await prisma.adAccount.findMany({
      where: { isActive: true },
    })

    for (const account of accounts) {
      if (account.platform !== 'meta' && account.platform !== 'google' && account.platform !== 'tiktok') {
        continue
      }
      try {
        await addAccountToSchedule(account.id, account.platform)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(
          `[Schedules] Failed to schedule ${account.platform}/${account.id}: ${msg}`,
        )
      }
    }

    console.log(
      `[Schedules] Metric sync schedules set up for ${accounts.length} ad account(s)`,
    )
  } else {
    console.log('[Schedules] MCP feature flag is disabled — skipping metric schedules')
  }

  // ---- WooCommerce commerce syncs (per saved AdAccount, never env-for-all-brands) ----
  const wooAccounts = await prisma.adAccount.findMany({
    where: { isActive: true, platform: 'woocommerce' },
  })

  let wooScheduled = 0
  for (const account of wooAccounts) {
    if (!account.accessToken || !account.refreshToken || !account.accountId) {
      console.warn(
        `[Schedules] Skipping WooCommerce ${account.id} — missing store URL or tokens`,
      )
      continue
    }
    try {
      await addWooSchedules(account.brandId, account.id)
      wooScheduled += 1
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(
        `[Schedules] Failed to schedule WooCommerce/${account.brandId}: ${msg}`,
      )
    }
  }

  if (config.features.woocommerceEnabled) {
    console.log(
      '[Schedules] WOOCOMMERCE_ENABLED is set but ignored for workers — UI Connections keys are used per brand so one store cannot overwrite another',
    )
  }

  console.log(
    `[Schedules] WooCommerce sync schedules set up for ${wooScheduled} account(s)`,
  )

  // ---- Email (Omnisend / Brevo) & OpenCart 6-hourly syncs ----
  const emailAccounts = await prisma.adAccount.findMany({
    where: {
      isActive: true,
      platform: { in: ['omnisend', 'brevo', 'opencart', 'google-analytics', 'google-search-console'] },
    },
  })

  for (const account of emailAccounts) {
    try {
      await addEmailSyncSchedule(account.brandId, account.platform, account.id)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(
        `[Schedules] Failed to schedule ${account.platform}/${account.id}: ${msg}`,
      )
    }
  }

  console.log(
    `[Schedules] Email/OpenCart 6h sync schedules set up for ${emailAccounts.length} account(s)`,
  )

  // ---- Budget alert hourly check ----
  await setupAlertSchedule()
  console.log('[Schedules] Budget alert check schedule registered')
}

/**
 * Add daily + hourly repeatable sync jobs for a newly connected ad account.
 */
export async function addAccountToSchedule(
  adAccountId: string,
  platform: string,
): Promise<void> {
  const queue = getMetricQueue(platform)

  // Daily full sync — empty dates let the processor calculate the platform
  // lookback (Meta: 18 months / 28-day delta restatement).
  const dailyData: MetricSyncJobData = {
    adAccountId,
    platform: platform as MetricSyncJobData['platform'],
    startDate: '',
    endDate: '',
    isDelta: false,
  }

  await queue.upsertJobScheduler(dailyJobName(adAccountId), { pattern: DAILY_CRON }, {
    name: dailyJobName(adAccountId),
    data: dailyData,
  })

  // Hourly delta sync — Meta restates 28 days; other platforms use 1 day.
  const hourlyData: MetricSyncJobData = {
    adAccountId,
    platform: platform as MetricSyncJobData['platform'],
    startDate: '',
    endDate: '',
    isDelta: true,
  }

  await queue.upsertJobScheduler(hourlyJobName(adAccountId), { pattern: HOURLY_CRON }, {
    name: hourlyJobName(adAccountId),
    data: hourlyData,
  })

  console.log(
    `[Schedules] Added ${platform} sync schedule for account ${adAccountId}`,
  )
}

/**
 * Remove daily + hourly repeatable sync jobs when an ad account is
 * disconnected or deactivated.
 */
export async function removeAccountFromSchedule(
  adAccountId: string,
  platform: string,
): Promise<void> {
  const queue = getMetricQueue(platform)

  await queue.removeJobScheduler(dailyJobName(adAccountId))
  await queue.removeJobScheduler(hourlyJobName(adAccountId))

  console.log(
    `[Schedules] Removed ${platform} sync schedule for account ${adAccountId}`,
  )
}

// ---------------------------------------------------------------------------
// Budget alert schedule
// ---------------------------------------------------------------------------

/**
 * Register the hourly budget-alert evaluation job.
 * Idempotent: BullMQ deduplicates by name + repeat-key.
 */
async function setupAlertSchedule(): Promise<void> {
  await alertQueue.upsertJobScheduler(
    'alerts-budget:hourly',
    { pattern: ALERT_CHECK_CRON },
    {
      name: 'alerts-budget:hourly',
      data: { type: 'check' as const },
    },
  )
}

// ---------------------------------------------------------------------------
// Email (Omnisend / Brevo) & OpenCart schedule helpers
// ---------------------------------------------------------------------------

/**
 * Add a 6-hourly repeatable sync job for an email (Omnisend / Brevo) or
 * OpenCart ad account.
 *
 * - omnisend / brevo jobs go to the `sync-email` queue and are processed by
 *   `email-sync-processor.ts`; credentials are looked up at processing time,
 *   so the job payload only carries identifiers.
 * - opencart jobs go to the `sync-opencart` queue with `adAccountId` only.
 *   Decrypt tokens at process time — never put REST keys in Redis.
 */
export async function addEmailSyncSchedule(
  brandId: string,
  platform: string,
  adAccountId: string,
): Promise<void> {
  if (platform === 'omnisend' || platform === 'brevo') {
    const data: MetricSyncJobData = {
      adAccountId,
      brandId,
      platform: platform as MetricSyncJobData['platform'],
      startDate: '',
      endDate: '',
    }

    await emailSyncQueue.upsertJobScheduler(emailJobName(adAccountId), { pattern: SIX_HOURLY_CRON }, {
      name: emailJobName(adAccountId),
      data,
    })
  } else if (platform === 'google-analytics' || platform === 'google-search-console') {
    const data: MetricSyncJobData = {
      adAccountId,
      brandId,
      platform: platform as MetricSyncJobData['platform'],
      startDate: '',
      endDate: '',
    }

    await emailSyncQueue.upsertJobScheduler(emailJobName(adAccountId), { pattern: SIX_HOURLY_CRON }, {
      name: emailJobName(adAccountId),
      data,
    })
  } else if (platform === 'opencart') {
    const data: OpenCartSyncJobData = {
      brandId,
      adAccountId,
      type: 'orders',
    }

    await opencartSyncQueue.upsertJobScheduler(opencartJobName(adAccountId), { pattern: SIX_HOURLY_CRON }, {
      name: opencartJobName(adAccountId),
      data,
    })
  } else {
    throw new Error(`[Schedules] Unsupported email-sync platform: ${platform}`)
  }

  console.log(
    `[Schedules] Added ${platform} 6h sync schedule for account ${adAccountId}`,
  )
}

/**
 * Queue an immediate (one-off) email sync for an Omnisend / Brevo account.
 *
 * Uses BullMQ jobId deduplication keyed by account + day, so calling this
 * multiple times for the same account within one calendar day enqueues the
 * job only once.
 */
export async function triggerEmailSyncNow(
  adAccountId: string,
  platform: 'omnisend' | 'brevo',
  brandId?: string,
): Promise<void> {
  const data: MetricSyncJobData = {
    adAccountId,
    brandId,
    platform,
    startDate: '',
    endDate: '',
  }

  await emailSyncQueue.add(`sync:${adAccountId}`, data, {
    jobId: `sync:${adAccountId}:${new Date().toISOString().slice(0, 10)}`,
  })

  console.log(
    `[Schedules] Queued immediate ${platform} sync for account ${adAccountId}`,
  )
}

// ---------------------------------------------------------------------------
// WooCommerce schedule helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Add orders + products repeatable jobs for a single WooCommerce brand.
 */
async function addWooSchedules(brandId: string, adAccountId: string): Promise<void> {
  const ordersData: WooSyncJobData = {
    brandId,
    adAccountId,
    type: 'orders',
  }

  await wooSyncQueue.upsertJobScheduler(wooOrdersJobName(brandId), { pattern: WOO_ORDERS_CRON }, {
    name: wooOrdersJobName(brandId),
    data: ordersData,
  })

  const productsData: WooSyncJobData = {
    brandId,
    adAccountId,
    type: 'products',
  }

  await wooSyncQueue.upsertJobScheduler(wooProductsJobName(brandId), { pattern: WOO_PRODUCTS_CRON }, {
    name: wooProductsJobName(brandId),
    data: productsData,
  })

  console.log(`[Schedules] Added WooCommerce sync schedule for brand ${brandId}`)
}

/**
 * Remove orders + products repeatable jobs for a single WooCommerce brand.
 */
export async function removeWooSchedules(brandId: string): Promise<void> {
  await wooSyncQueue.removeJobScheduler(wooOrdersJobName(brandId))
  await wooSyncQueue.removeJobScheduler(wooProductsJobName(brandId))

  console.log(`[Schedules] Removed WooCommerce sync schedule for brand ${brandId}`)
}

/**
 * Remove the 6-hourly repeatable job for a single OpenCart account.
 */
export async function removeOpenCartSchedules(adAccountId: string): Promise<void> {
  await opencartSyncQueue.removeJobScheduler(opencartJobName(adAccountId))

  console.log(`[Schedules] Removed OpenCart sync schedule for account ${adAccountId}`)
}
