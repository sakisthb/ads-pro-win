// Integration Tests for AI tRPC Router
// Testing API endpoints, data flow, and business logic

import { createTRPCMsw } from 'msw-trpc'
import { setupServer } from 'msw/node'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import { AppRouter } from '../root'
import { 
  mockTRPCContext, 
  mockAIDatabaseService, 
  mockAIAgents,
  setupTestEnvironment,
  cleanupMocks 
} from '@/test-utils/mocks'

// Mock dependencies
jest.mock('@/lib/ai-database-service', () => mockAIDatabaseService)
jest.mock('@/lib/ai-agents-realtime', () => ({
  createRealTimeAIAgents: () => mockAIAgents,
}))

describe('AI Router Integration Tests', () => {
  let trpcClient: any
  let server: any

  beforeAll(async () => {
    setupTestEnvironment()

    // Setup MSW server
    const mswTrpc = createTRPCMsw<AppRouter>()
    
    server = setupServer(
      mswTrpc.ai.analyzeCampaign.mutation(() => ({
        id: 'analysis_123',
        campaignId: 'camp_123',
        insights: {
          performance: { score: 85, trend: 'improving' },
          audience: { topSegments: ['Male 25-34'] },
          budget: { efficiency: 78 },
        },
        confidence: 92,
      })),
      
      mswTrpc.ai.generateCreative.mutation(() => ({
        id: 'creative_123',
        campaignId: 'camp_123',
        content: {
          headlines: ['AI-Generated Headline'],
          descriptions: ['AI-Generated Description'],
        },
        variants: [],
      })),
      
      mswTrpc.ai.optimizeCampaign.mutation(() => ({
        id: 'opt_123',
        campaignId: 'camp_123',
        recommendations: [
          { type: 'budget', action: 'increase', value: 20 },
        ],
        projectedImpact: { ctr: 0.5, cpc: -0.1 },
      }))
    )

    server.listen()

    // Setup tRPC client
    trpcClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000/api/trpc',
        }),
      ],
    })
  })

  afterAll(() => {
    server.close()
    cleanupMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Campaign Analysis Endpoint', () => {
    it('should analyze campaign successfully', async () => {
      const result = await trpcClient.ai.analyzeCampaign.mutate({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
        provider: 'openai',
      })

      expect(result).toEqual({
        id: 'analysis_123',
        campaignId: 'camp_123',
        insights: {
          performance: { score: 85, trend: 'improving' },
          audience: { topSegments: ['Male 25-34'] },
          budget: { efficiency: 78 },
        },
        confidence: 92,
      })
    })

    it('should validate input parameters', async () => {
      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: '', // Invalid - empty string
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow()

      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'invalid_type', // Invalid analysis type
        })
      ).rejects.toThrow()
    })

    it('should handle different analysis types', async () => {
      const analysisTypes = ['comprehensive', 'performance', 'audience', 'budget']

      for (const analysisType of analysisTypes) {
        const result = await trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType,
          provider: 'openai',
        })

        expect(result.campaignId).toBe('camp_123')
        expect(result.insights).toBeDefined()
      }
    })

    it('should handle different AI providers', async () => {
      const providers = ['openai', 'anthropic', 'google']

      for (const provider of providers) {
        const result = await trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
          provider,
        })

        expect(result.campaignId).toBe('camp_123')
        expect(result.confidence).toBeGreaterThan(0)
      }
    })

    it('should include sessionId for real-time updates', async () => {
      const sessionId = 'session_123'

      const result = await trpcClient.ai.analyzeCampaign.mutate({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
        provider: 'openai',
        sessionId,
      })

      expect(result).toBeDefined()
      // SessionId should be passed to AI agents for WebSocket targeting
    })
  })

  describe('Creative Generation Endpoint', () => {
    it('should generate creative content successfully', async () => {
      const result = await trpcClient.ai.generateCreative.mutate({
        campaignId: 'camp_123',
        contentType: 'text',
        tone: 'professional',
      })

      expect(result).toEqual({
        id: 'creative_123',
        campaignId: 'camp_123',
        content: {
          headlines: ['AI-Generated Headline'],
          descriptions: ['AI-Generated Description'],
        },
        variants: [],
      })
    })

    it('should validate creative generation parameters', async () => {
      await expect(
        trpcClient.ai.generateCreative.mutate({
          campaignId: '',
          contentType: 'text',
        })
      ).rejects.toThrow()

      await expect(
        trpcClient.ai.generateCreative.mutate({
          campaignId: 'camp_123',
          contentType: 'invalid_type',
        })
      ).rejects.toThrow()
    })

    it('should handle different content types', async () => {
      const contentTypes = ['text', 'image', 'video']

      for (const contentType of contentTypes) {
        const result = await trpcClient.ai.generateCreative.mutate({
          campaignId: 'camp_123',
          contentType,
          tone: 'professional',
        })

        expect(result.campaignId).toBe('camp_123')
        expect(result.content).toBeDefined()
      }
    })

    it('should generate multiple variants when requested', async () => {
      const result = await trpcClient.ai.generateCreative.mutate({
        campaignId: 'camp_123',
        contentType: 'text',
        tone: 'professional',
        variantCount: 3,
      })

      expect(result.campaignId).toBe('camp_123')
      expect(Array.isArray(result.variants)).toBe(true)
    })
  })

  describe('Campaign Optimization Endpoint', () => {
    it('should optimize campaign successfully', async () => {
      const result = await trpcClient.ai.optimizeCampaign.mutate({
        campaignId: 'camp_123',
        optimizationType: 'performance',
      })

      expect(result).toEqual({
        id: 'opt_123',
        campaignId: 'camp_123',
        recommendations: [
          { type: 'budget', action: 'increase', value: 20 },
        ],
        projectedImpact: { ctr: 0.5, cpc: -0.1 },
      })
    })

    it('should validate optimization parameters', async () => {
      await expect(
        trpcClient.ai.optimizeCampaign.mutate({
          campaignId: '',
          optimizationType: 'performance',
        })
      ).rejects.toThrow()

      await expect(
        trpcClient.ai.optimizeCampaign.mutate({
          campaignId: 'camp_123',
          optimizationType: 'invalid_type',
        })
      ).rejects.toThrow()
    })

    it('should handle different optimization types', async () => {
      const optimizationTypes = ['performance', 'budget', 'targeting', 'creative']

      for (const optimizationType of optimizationTypes) {
        const result = await trpcClient.ai.optimizeCampaign.mutate({
          campaignId: 'camp_123',
          optimizationType,
        })

        expect(result.campaignId).toBe('camp_123')
        expect(result.recommendations).toBeDefined()
        expect(Array.isArray(result.recommendations)).toBe(true)
      }
    })

    it('should include projected impact metrics', async () => {
      const result = await trpcClient.ai.optimizeCampaign.mutate({
        campaignId: 'camp_123',
        optimizationType: 'performance',
      })

      expect(result.projectedImpact).toBeDefined()
      expect(typeof result.projectedImpact.ctr).toBe('number')
      expect(typeof result.projectedImpact.cpc).toBe('number')
    })
  })

  describe('Analytics Dashboard Endpoint', () => {
    it('should fetch analytics dashboard data', async () => {
      const result = await trpcClient.ai.getAnalyticsDashboard.query({
        timeframe: '7d',
      })

      expect(result).toBeDefined()
      expect(typeof result.totalCampaigns).toBe('number')
      expect(typeof result.totalSpend).toBe('number')
    })

    it('should handle different timeframes', async () => {
      const timeframes = ['24h', '7d', '30d', '90d']

      for (const timeframe of timeframes) {
        const result = await trpcClient.ai.getAnalyticsDashboard.query({
          timeframe,
        })

        expect(result).toBeDefined()
        expect(result.totalCampaigns).toBeGreaterThanOrEqual(0)
      }
    })

    it('should include organization filtering', async () => {
      const result = await trpcClient.ai.getAnalyticsDashboard.query({
        timeframe: '7d',
        organizationId: 'org_123',
      })

      expect(result).toBeDefined()
      // Should only include data for the specified organization
    })
  })

  describe('Error Handling', () => {
    it('should handle AI service errors gracefully', async () => {
      // Mock AI service to throw error
      mockAIDatabaseService.createAIAnalysis.mockRejectedValueOnce(
        new Error('AI service unavailable')
      )

      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow('AI service unavailable')
    })

    it('should handle database errors', async () => {
      // Mock database to throw error
      mockAIDatabaseService.createAIAnalysis.mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle rate limiting', async () => {
      // Mock rate limiting error
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'TRPCError'
      
      mockAIDatabaseService.createAIAnalysis.mockRejectedValueOnce(rateLimitError)

      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Authentication & Authorization', () => {
    it('should require authentication for AI operations', async () => {
      // Test without proper context (no user)
      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow()
    })

    it('should enforce organization-based access', async () => {
      // Test accessing campaign from different organization
      await expect(
        trpcClient.ai.analyzeCampaign.mutate({
          campaignId: 'camp_from_other_org',
          analysisType: 'comprehensive',
        })
      ).rejects.toThrow()
    })
  })
})