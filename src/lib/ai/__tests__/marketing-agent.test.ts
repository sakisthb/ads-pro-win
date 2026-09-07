/**
 * @jest-environment node
 */
// Smoke test: verifies the LangChain v1 agent wiring constructs without
// throwing (createAgent + modelCallLimitMiddleware + tool registry). Node env:
// jsdom lacks TextEncoder, which langsmith requires at import time.

jest.mock('@/lib/db', () => ({ prisma: {} }))

// Constructors validate key presence; runtime only builds a provider whose
// key is configured (see hasApiKeys() in the chat API route).
process.env.ANTHROPIC_API_KEY = 'test-key'
process.env.OPENAI_API_KEY = 'test-key'

afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
})

import { createMarketingAgent } from '../marketing-agent'

describe('marketing-agent (LangChain v1)', () => {
  it('constructs the agent with tools and the model-call limit middleware', () => {
    const agent = createMarketingAgent({ organizationId: 'org-test' })
    expect(agent).toBeDefined()
    expect(typeof agent.invoke).toBe('function')
  })

  it('constructs for the anthropic provider', () => {
    const agent = createMarketingAgent({
      organizationId: 'org-test',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    })
    expect(agent).toBeDefined()
  })
})
