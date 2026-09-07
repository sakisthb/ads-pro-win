// src/app/api/chat/route.ts — Streaming SSE endpoint for AI Chat
// Uses the LangChain marketing agent when API keys are present;
// otherwise streams last-30d DailyMetric totals for this workspace.

import { NextRequest, NextResponse } from 'next/server'
import { chat, type ChatMessage } from '@/lib/ai/marketing-agent'
import { getActiveOrgId } from '@/lib/active-org'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { currencyFromSettings } from '@/lib/currency'
import { buildGroundedChatReply } from '@/lib/ai/chat-fallback'
import { dailyMetricPlatformWhere, SITE_ANALYTICS_PLATFORM } from '@/lib/paid-ad-metrics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Encode a single SSE chunk: `data: <json>\n\n` */
function sseChunk(payload: Record<string, unknown>) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/** Terminal SSE chunk the client recognises as end-of-stream. */
function sseDone() {
  return encoder.encode(`data: [DONE]\n\n`)
}

// ---------------------------------------------------------------------------
// Fallback stream — last-30d DailyMetric for this org when no LLM key is set
// ---------------------------------------------------------------------------

async function groundedFallback(organizationId: string, question: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  const currency = currencyFromSettings(org?.settings)
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 86_400_000)
  const [grouped, brands, ga4Agg] = await Promise.all([
    prisma.dailyMetric.groupBy({
      by: ['platform'],
      where: {
        date: { gte: start, lte: end },
        adAccount: { brand: { organizationId } },
        ...dailyMetricPlatformWhere(),
      },
      _sum: {
        spend: true,
        conversionValue: true,
        clicks: true,
        impressions: true,
        conversions: true,
      },
    }),
    prisma.brand.findMany({
      where: { organizationId },
      select: { id: true },
    }),
    prisma.dailyMetric.aggregate({
      where: {
        date: { gte: start, lte: end },
        adAccount: { brand: { organizationId } },
        platform: SITE_ANALYTICS_PLATFORM,
      },
      _sum: { websitePurchases: true },
    }),
  ])

  const store = await prisma.wooOrder.aggregate({
    where: {
      dateCreated: { gte: start, lte: end },
      brandId: { in: brands.map((b) => b.id) },
      status: { notIn: ['pending', 'cancelled', 'failed', 'checkout-draft', 'auto-draft'] },
    },
    _sum: { netSales: true },
    _count: { id: true },
  })

  if (grouped.length === 0 && (store._count.id ?? 0) === 0) {
    return `No synced paid DailyMetric rows for the last 30 days in this workspace. Connect an ad account, run a sync, then ask again.\n\nYou asked: "${question.slice(0, 180)}"`
  }

  return buildGroundedChatReply({
    question,
    currency,
    platforms: grouped.map((g) => ({
      platform: g.platform,
      spend: toNum(g._sum.spend),
      revenue: toNum(g._sum.conversionValue),
      clicks: g._sum.clicks ?? 0,
      conversions: toNum(g._sum.conversions),
    })),
    storeNet: toNum(store._sum.netSales),
    orderCount: store._count.id ?? 0,
    ga4Purchases: toNum(ga4Agg._sum.websitePurchases),
  })
}

async function* mockStream(text: string) {
  // Split into small word-clusters for natural typing feel
  const words = text.split(' ')
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + 2).join(' ') // 2 words at a time
    i += 2
    yield chunk + (i < words.length ? ' ' : '')
    // Simulate variable typing speed (faster for short words)
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 22))
  }
}

function hasApiKeys(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
}

// ---------------------------------------------------------------------------
// POST /api/chat
// Body: { message: string; history?: ChatMessage[] }
// Auth: Requires valid Supabase session. Organization is resolved server-side
//       from the active-org cookie (when the user is a member) or the users
//       table — never trust the client for this.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Auth gate — require a valid Supabase session
    // -----------------------------------------------------------------------
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // -----------------------------------------------------------------------
    // 2. Resolve organization — honor the active-org cookie when the user
    //    is a member, else fall back to users.organizationId (same as tRPC).
    // -----------------------------------------------------------------------
    const userId = session.userId
    const activeOrgId = await getActiveOrgId()
    let organizationId: string | null = null

    if (activeOrgId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: activeOrgId } },
        select: { organizationId: true },
      })
      if (membership) organizationId = membership.organizationId
    }

    if (!organizationId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      })
      organizationId = dbUser?.organizationId ?? null
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'User has no organization. Please complete onboarding first.' },
        { status: 403 },
      )
    }

    // -----------------------------------------------------------------------
    // 3. Parse request body
    // -----------------------------------------------------------------------
    const body = await req.json()
    const message: string = body.message ?? ''
    const history: ChatMessage[] = body.history ?? []

    if (!message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // -----------------------------------------------------------------------
    // Path A — Real LLM via LangChain marketing agent
    // -----------------------------------------------------------------------
    if (hasApiKeys()) {
      // We stream the final answer ourselves by chunking the full response.
      // (LangChain AgentExecutor doesn't natively token-stream, so we
      //  await the full answer then chunk it for a smooth UX.)
      const answer = await chat(
        { organizationId },
        message,
        history,
      )

      const stream = new ReadableStream({
        async start(controller) {
          const words = answer.split(' ')
          for (let i = 0; i < words.length; i += 2) {
            const chunk = words.slice(i, i + 2).join(' ')
            controller.enqueue(sseChunk({ content: chunk + (i + 2 < words.length ? ' ' : '') }))
            await new Promise((r) => setTimeout(r, 15))
          }
          controller.enqueue(sseDone())
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // -----------------------------------------------------------------------
    // Path B — Grounded DailyMetric summary (no LLM key)
    // -----------------------------------------------------------------------
    const mockText = await groundedFallback(organizationId, message)

    const stream = new ReadableStream({
      async start(controller) {
        for await (const token of mockStream(mockText)) {
          controller.enqueue(sseChunk({ content: token }))
        }
        controller.enqueue(sseDone())
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
