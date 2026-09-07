/**
 * BullMQ queue definitions for platform data-sync.
 *
 * Six queues are created, one per platform, so that each can be scaled
 * independently and monitored separately in the BullMQ dashboard.
 */

import { Queue, type QueueOptions } from 'bullmq'
import { createRedisConnection } from './redis-connection'

const connection = createRedisConnection()

/**
 * Shared queue defaults:
 *  - 3 retry attempts with exponential backoff
 *  - capped completed/failed retention to prevent unbounded Redis growth
 */
const DEFAULT_QUEUE_OPTS: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 250 },
  },
}

export const metaSyncQueue = new Queue('sync-meta', DEFAULT_QUEUE_OPTS)
export const googleSyncQueue = new Queue('sync-google', DEFAULT_QUEUE_OPTS)
export const tiktokSyncQueue = new Queue('sync-tiktok', DEFAULT_QUEUE_OPTS)
export const wooSyncQueue = new Queue('sync-woocommerce', DEFAULT_QUEUE_OPTS)
export const emailSyncQueue = new Queue<MetricSyncJobData>('sync-email', {
  connection: createRedisConnection(),
  defaultJobOptions: DEFAULT_QUEUE_OPTS.defaultJobOptions,
})
export const opencartSyncQueue = new Queue<OpenCartSyncJobData>('sync-opencart', {
  connection: createRedisConnection(),
  defaultJobOptions: DEFAULT_QUEUE_OPTS.defaultJobOptions,
})
export const alertQueue = new Queue('alerts-budget', {
  connection: createRedisConnection(),
  defaultJobOptions: DEFAULT_QUEUE_OPTS.defaultJobOptions,
})

// ---------------------------------------------------------------------------
// Job data contracts
// ---------------------------------------------------------------------------

/**
 * Payload for metric-sync jobs (Meta / Google / TikTok, plus the
 * Omnisend / Brevo email platforms served by the `sync-email` queue).
 */
export interface MetricSyncJobData {
  adAccountId: string
  /** Present on email-platform jobs so SyncJob rows can be attributed to a
   *  brand without an extra DB lookup. */
  brandId?: string
  platform: 'meta' | 'google' | 'tiktok' | 'omnisend' | 'brevo' | 'google-analytics' | 'google-search-console'
  startDate: string // YYYY-MM-DD
  endDate: string //   YYYY-MM-DD
  isDelta?: boolean
}

/**
 * Payload for WooCommerce commerce-sync jobs (orders / products).
 *
 * Jobs carry only identifiers and date parameters. Store URL, consumer key,
 * and consumer secret are loaded from the encrypted AdAccount record at
 * process time and decrypted immediately before the provider call.
 */
export interface WooSyncJobData {
  brandId: string
  /** Woo AdAccount id — worker decrypts tokens at process time. */
  adAccountId: string
  type: 'orders' | 'products'
  startDate?: string
  endDate?: string
}

/**
 * Payload for OpenCart commerce-sync jobs.
 *
 * Jobs carry only identifiers and date parameters. Store URL, API username,
 * and API key are loaded from the encrypted AdAccount record at process time.
 */
export interface OpenCartSyncJobData {
  brandId: string
  /** OpenCart AdAccount id — worker decrypts tokens at process time. */
  adAccountId: string
  type: 'orders'
  startDate?: string
  endDate?: string
}
