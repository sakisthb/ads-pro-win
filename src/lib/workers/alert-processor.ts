/**
 * BullMQ worker processor for budget alert evaluation.
 *
 * Runs on the `alerts-budget` queue. For each active AlertRule in the DB:
 *
 *  1. Sums today's spend from `DailyMetric` rows whose `adAccountId` belongs
 *     to the rule's organization (optionally filtered by brand / platform).
 *  2. If the sum exceeds `thresholdAmount` and the rule has not already fired
 *     today, creates a `Notification` (type = 'alert') and stamps
 *     `lastTriggeredAt` on the rule so it won't re-fire until tomorrow.
 */

import { Worker, type Job } from 'bullmq'
import { createRedisConnection } from './redis-connection'
import { prisma } from '@/lib/db'
import { currencyFromSettings, formatMoneyExact } from '@/lib/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertCheckJobData {
  /** Marker field so BullMQ can distinguish this payload. */
  type: 'check'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the start-of-day (midnight UTC) for the given date.
 */
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Evaluate a single AlertRule: aggregate today's spend for the matching
 * ad-account set, compare against the threshold, and create a Notification
 * if the threshold is breached and the rule hasn't already fired today.
 */
async function evaluateRule(
  rule: {
    id: string
    organizationId: string
    brandId: string | null
    platform: string | null
    thresholdAmount: { toNumber: () => number } | number | string
    period: string
    lastTriggeredAt: Date | null
  },
  today: Date,
): Promise<void> {
  const todayStart = startOfDayUTC(today)

  // Skip if already triggered today
  if (rule.lastTriggeredAt && rule.lastTriggeredAt >= todayStart) {
    return
  }

  // Build the ad-account filter for this rule's scope
  const accountFilter: Record<string, unknown> = {
    organizationId: rule.organizationId,
  }
  if (rule.brandId) accountFilter.brandId = rule.brandId
  if (rule.platform) accountFilter.platform = rule.platform

  // Resolve ad-account IDs that belong to this rule's scope
  const accounts = await prisma.adAccount.findMany({
    where: accountFilter,
    select: { id: true },
  })

  if (accounts.length === 0) return

  const accountIds = accounts.map((a) => a.id)

  // Aggregate today's spend across matching DailyMetric rows
  const result = await prisma.dailyMetric.aggregate({
    where: {
      date: todayStart,
      adAccountId: { in: accountIds },
    },
    _sum: { spend: true },
  })

  const totalSpend = result._sum.spend ? Number(result._sum.spend) : 0
  const threshold = Number(rule.thresholdAmount)

  if (totalSpend <= threshold) return

  const org = await prisma.organization.findUnique({
    where: { id: rule.organizationId },
    select: { settings: true },
  })
  const currency = currencyFromSettings(org?.settings)
  const spendLabel = formatMoneyExact(totalSpend, currency)
  const thresholdLabel = formatMoneyExact(threshold, currency)

  // Build a human-readable scope label
  const scopeParts: string[] = []
  if (rule.platform) scopeParts.push(rule.platform)
  if (rule.brandId) scopeParts.push(`brand ${rule.brandId}`)
  const scopeLabel = scopeParts.length > 0 ? ` for ${scopeParts.join(' / ')}` : ''

  // Create notification
  await prisma.notification.create({
    data: {
      organizationId: rule.organizationId,
      type: 'alert',
      title: 'Budget Alert',
      message: `Daily spend ${spendLabel} exceeded threshold ${thresholdLabel}${scopeLabel}`,
      isRead: false,
      data: {
        ruleId: rule.id,
        spend: totalSpend,
        threshold,
      },
    },
  })

  // Stamp lastTriggeredAt so we don't re-fire today
  await prisma.alertRule.update({
    where: { id: rule.id },
    data: { lastTriggeredAt: new Date() },
  })

  console.log(
    `[Worker:alerts] Rule ${rule.id} triggered: spend ${spendLabel} > threshold ${thresholdLabel}`,
  )
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

async function processAlertCheck(_job: Job<AlertCheckJobData>): Promise<void> {
  const today = new Date()

  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  })

  let evaluated = 0
  for (const rule of rules) {
    try {
      await evaluateRule(rule, today)
      evaluated++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Worker:alerts] Failed to evaluate rule ${rule.id}: ${msg}`)
    }
  }

  console.log(`[Worker:alerts] Evaluated ${evaluated}/${rules.length} active rule(s)`)
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

const connection = createRedisConnection()

export const alertCheckWorker = new Worker<AlertCheckJobData>(
  'alerts-budget',
  processAlertCheck,
  { connection, concurrency: 1 },
)
