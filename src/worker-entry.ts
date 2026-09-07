/**
 * Standalone worker process entry-point.
 *
 * Boots all BullMQ sync workers and schedules, then keeps the process alive
 * until a SIGTERM / SIGINT is received, at which point it shuts down
 * gracefully so that in-flight jobs can finish.
 *
 * Usage:  node -r tsconfig-paths/register dist/worker-entry.js
 *      or tsx src/worker-entry.ts
 */

import {
  metaSyncWorker,
  googleSyncWorker,
  tiktokSyncWorker,
  wooSyncWorker,
  opencartSyncWorker,
} from '@/lib/workers/sync-processor'
import { emailSyncWorker } from '@/lib/workers/email-sync-processor'
import { alertCheckWorker } from '@/lib/workers/alert-processor'

import { setupSchedules } from '@/lib/workers/schedules'

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  console.log('[worker] Starting BullMQ sync workers…')

  // Workers are already instantiated via module-level side-effects in
  // sync-processor.ts / email-sync-processor.ts; just log their readiness.
  const workers = [metaSyncWorker, googleSyncWorker, tiktokSyncWorker, wooSyncWorker, opencartSyncWorker, emailSyncWorker, alertCheckWorker]
  for (const w of workers) {
    console.log(`[worker] ✓ ${w.name} is listening`)
  }

  // Register repeatable cron schedules (idempotent)
  await setupSchedules()
  console.log('[worker] ✓ Schedules registered')
  console.log('[worker] All workers ready — waiting for jobs')
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  console.log(`\n[worker] Received ${signal} — shutting down gracefully…`)
  const workers = [metaSyncWorker, googleSyncWorker, tiktokSyncWorker, wooSyncWorker, opencartSyncWorker, emailSyncWorker, alertCheckWorker]
  await Promise.all(workers.map((w) => w.close()))
  console.log('[worker] All workers closed. Goodbye.')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

main().catch((err) => {
  console.error('[worker] Fatal startup error:', err)
  process.exit(1)
})
