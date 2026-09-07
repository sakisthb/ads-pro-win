// Marketing AI Agent — LangChain tool-calling agent for marketing analytics
// Phase 5: AI Chat with LangChain Tool Calling

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import {
  AIMessage,
  HumanMessage,
  createAgent,
  modelCallLimitMiddleware,
  type BaseMessage,
} from 'langchain'
import { createMarketingTools } from './tool-registry'

// ============================================================================
// Public types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface MarketingAgentOptions {
  organizationId: string
  brandId?: string
  provider?: 'openai' | 'anthropic'
  model?: string
}

// ============================================================================
// System prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a marketing analytics assistant for an e-commerce business. You have access to real advertising data from Meta Ads, Google Ads, and TikTok Ads, as well as actual sales data from WooCommerce.

Key principles:
- Always use actual WooCommerce sales as the source of truth for till revenue (not platform-reported conversions)
- Pixel conversions (Meta / Google Ads / TikTok DailyMetric) are not Woo orders and not GA4 ecommerce purchases. Never add the five clocks (pixel, till, GA4, Search Console, email). Scale from pixel; P&L from till; landing panic from GA4 Realtime.
- GA4 sessions are not ad clicks. GA4 pageviews are not ad impressions. GA4 never enters Pixel ROAS or Store MER. Unassigned in GA4 is a tagging hole, not a buy. Organic Search in GA4 is not Google Ads spend.
- Platform-reported conversions are useful for optimization but should not be summed across platforms (double-counting)
- MER (Marketing Efficiency Ratio) = store net sales / ad spend. Pixel ROAS is conversion value / spend. They are different numbers — never scale paid media off blended MER.
- There is no blended ROAS. Do not add pixel + till + GA4 + GSC + email. GSC clicks have €0 value. Brevo campaigns API has no order revenue. Woo last-click Google is till, not Google Ads spend. Woo last-click email is till, not email ROAS.
- Do not invent competitor auction insights, impression share, or industry CTR benchmarks. Those need Google Ads Basic Access.
- If a campaign or ad set name contains Advantage+ or ASC, do not recommend 1% or 3% lookalikes. Keep the catalog as the control. Next move is a new format (UGC or carousel) or offer vs landing on Creative Fatigue.
- This app does not write bids, pause ads, or create Meta audiences. Point the operator to Creative Fatigue, Connections, Campaign Studio, or Ads Manager. Never claim you already changed a live campaign.
- Never invent Google or TikTok numbers when those platforms are missing from tool results.
- When comparing periods, always note if there are seasonal factors
- Be concise but thorough. Use numbers and percentages.
- If data is missing or insufficient, say so clearly.
- Currency follows the user's Profile choice (Euro or US Dollar).
- Respond in the same language the user writes in (Greek or English).`

// ============================================================================
// Agent factory
// ============================================================================

export function createMarketingAgent(options: MarketingAgentOptions) {
  const { organizationId, provider = 'openai', model } = options

  // Create LLM based on provider
  const llm =
    provider === 'anthropic'
      ? new ChatAnthropic({ model: model || 'claude-sonnet-4-20250514', temperature: 0 })
      : new ChatOpenAI({ model: model || 'gpt-4o', temperature: 0 })

  // Create tools scoped to this organization
  const tools = createMarketingTools(organizationId)

  // runLimit caps model calls per invocation — the v1 equivalent of the
  // AgentExecutor maxIterations bound that previously guarded runaway loops.
  return createAgent({
    model: llm,
    tools,
    systemPrompt: SYSTEM_PROMPT,
    middleware: [modelCallLimitMiddleware({ runLimit: 10 })],
  })
}

// ============================================================================
// Chat function — single-turn or multi-turn via history
// ============================================================================

/** Coerce a v1 message content (string or content-block array) to plain text. */
function messageText(message: BaseMessage): string {
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === 'string' ? block : (block?.text ?? '')))
      .join('')
  }
  return ''
}

export async function chat(
  options: MarketingAgentOptions,
  message: string,
  history: ChatMessage[] = [],
): Promise<string> {
  try {
    const agent = createMarketingAgent(options)

    // Convert history to LangChain message instances
    const messages = [
      ...history.map((msg) =>
        msg.role === 'user'
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content),
      ),
      new HumanMessage(message),
    ]

    const result = await agent.invoke({ messages })
    const last = result.messages[result.messages.length - 1]
    if (!last) {
      return "I'm sorry, I couldn't generate a response. Please try again."
    }

    return messageText(last)
  } catch (error) {
    console.error('Marketing agent chat error:', error)
    return `I'm sorry, I encountered an error processing your request. ${
      error instanceof Error ? error.message : 'Please try again.'
    }`
  }
}
