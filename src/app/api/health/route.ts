import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import IORedis from 'ioredis'
import { logSecurityEvent } from '@/lib/security-events'

export const dynamic = 'force-dynamic'

/**
 * Cheap liveness probe. Returns 200 as long as the Node process is responding.
 * Kubernetes / load balancers use this to know when to restart the container.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const probe = searchParams.get('probe')

  if (probe === 'live') {
    return NextResponse.json({ status: 'ok', uptime: process.uptime() })
  }

  let db = false
  let redis = false

  // --- DB check ---
  try {
    await prisma.$queryRaw`SELECT 1`
    db = true
  } catch (err) {
    logSecurityEvent('readiness_failure', 'error', {
      code: 'db_unavailable',
      dependency: 'db',
      message: err instanceof Error ? err.message : String(err),
    })
  }

  // --- Redis check ---
  try {
    const client = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
      lazyConnect: true,
    })
    await client.connect()
    const pong = await client.ping()
    redis = pong === 'PONG'
    await client.quit()
  } catch (err) {
    logSecurityEvent('readiness_failure', 'error', {
      code: 'redis_unavailable',
      dependency: 'redis',
      message: err instanceof Error ? err.message : String(err),
    })
  }

  // --- Migration status (observability only; does not gate readiness) ---
  let migrations: { failed: number } | { status: 'unavailable' } = { status: 'unavailable' }
  if (db) {
    try {
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM _prisma_migrations
        WHERE finished_at IS NULL AND rolled_back_at IS NULL
      `
      const failed = Number(rows[0]?.count ?? 0)
      migrations = { failed }
      if (failed > 0) {
        logSecurityEvent('migration_status', 'error', {
          code: 'failed_migrations',
          count: failed,
        })
      }
    } catch {
      // Databases provisioned via db push have no _prisma_migrations table.
      migrations = { status: 'unavailable' }
    }
  }

  const allOk = db && redis
  const body = {
    status: allOk ? 'ok' : 'error',
    db,
    redis,
    migrations,
    uptime: process.uptime(),
  }

  return NextResponse.json(body, { status: allOk ? 200 : 503 })
}
