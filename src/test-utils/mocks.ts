// Mock definitions for Ads Pro Enterprise tests
// Centralized mocks for consistent testing

import { jest } from '@jest/globals'

// Mock AI Database Service
export const mockAIDatabaseService = {
  createAIAnalysis: jest.fn().mockResolvedValue({
    id: 'analysis_123',
    campaignId: 'camp_123',
    insights: { performance: { score: 85 } },
    confidence: 92,
  }),
  createCreativeGeneration: jest.fn().mockResolvedValue({
    id: 'creative_123',
    campaignId: 'camp_123',
    content: { headlines: ['Test Headline'], descriptions: ['Test Description'] },
    variants: [],
  }),
  createOptimization: jest.fn().mockResolvedValue({
    id: 'opt_123',
    campaignId: 'camp_123',
    recommendations: [{ type: 'budget', action: 'increase', value: 20 }],
    projectedImpact: { ctr: 0.5, cpc: -0.1 },
  }),
  updateAIAnalysis: jest.fn(),
  getAIAnalysesByCampaign: jest.fn().mockResolvedValue([]),
  getAnalyticsDashboard: jest.fn().mockResolvedValue({
    totalCampaigns: 5,
    totalSpend: 5000,
    totalImpressions: 50000,
    totalClicks: 2500,
    avgCTR: 5.0,
    avgCPC: 2.0,
    conversionRate: 3.0,
    roi: 120,
  }),
  cleanupOldAnalyses: jest.fn(),
}

// Mock AI Agents
export const mockAIAgents = {
  createCampaignAnalysisAgent: jest.fn().mockReturnValue({
    analyze: jest.fn().mockResolvedValue({
      insights: {
        performance: { score: 85, trend: 'improving' },
        audience: { topSegments: ['Male 25-34'] },
        budget: { efficiency: 78 },
      },
      confidence: 92,
    }),
  }),
  createCreativeGenerationAgent: jest.fn().mockReturnValue({
    generate: jest.fn().mockResolvedValue({
      content: {
        headlines: ['AI-Generated Headline'],
        descriptions: ['AI-Generated Description'],
      },
      variants: [],
    }),
  }),
  createOptimizationAgent: jest.fn().mockReturnValue({
    optimize: jest.fn().mockResolvedValue({
      recommendations: [
        { type: 'budget', action: 'increase', value: 20 },
        { type: 'targeting', action: 'expand', value: 'lookalike_audiences' },
      ],
      projectedImpact: { ctr: 0.5, cpc: -0.1, conversions: 10 },
    }),
  }),
}

// Mock WebSocket Server
export const mockWebSocketServer = {
  broadcast: jest.fn(),
  sendToOrganization: jest.fn(),
  sendProgress: jest.fn(),
  getConnections: jest.fn().mockReturnValue([]),
}

// Mock Prisma Client
export const mockPrismaClient = {
  campaign: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  aIAnalysis: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  },
  creativeGeneration: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  optimization: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}

// Mock tRPC Context
export const mockTRPCContext = {
  userId: 'user_123',
  organizationId: 'org_123',
  user: {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
  organization: {
    id: 'org_123',
    name: 'Test Organization',
    plan: 'professional',
  },
  db: mockPrismaClient,
}

// Mock Redis Client
export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
}

// Mock External APIs
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                insights: { performance: { score: 85 } },
                confidence: 92,
              }),
            },
          },
        ],
      }),
    },
  },
}

export const mockAnthropic = {
  messages: {
    create: jest.fn().mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            insights: { performance: { score: 90 } },
            confidence: 95,
          }),
        },
      ],
    }),
  },
}

// Environment variables for testing
export const testEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_mock',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  OPENAI_API_KEY: 'sk-test-openai-key',
  ANTHROPIC_API_KEY: 'sk-test-anthropic-key',
  REDIS_URL: 'redis://localhost:6379',
}

// Helper to set up environment
export const setupTestEnvironment = () => {
  Object.entries(testEnvVars).forEach(([key, value]) => {
    process.env[key] = value
  })
}

// Mock fetch for API tests
export const setupFetchMock = () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/api/trpc')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: { data: {} } }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  }) as jest.Mock
}

// Cleanup function for tests
export const cleanupMocks = () => {
  jest.clearAllMocks()
  
  // Reset environment
  Object.keys(testEnvVars).forEach(key => {
    delete process.env[key]
  })
}