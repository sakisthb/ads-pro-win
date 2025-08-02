// Database Integration Tests for AI Database Service
// Testing database operations, data persistence, and business logic

import {
  createAIAnalysis,
  createCreativeGeneration,
  createOptimization,
  updateAIAnalysis,
  getAIAnalysesByCampaign,
  getAnalyticsDashboard,
  cleanupOldAnalyses,
} from '../ai-database-service'
import { mockPrismaClient, setupTestEnvironment, cleanupMocks } from '@/test-utils/mocks'

// Mock Prisma client
jest.mock('../db', () => ({
  __esModule: true,
  default: mockPrismaClient,
}))

describe('AI Database Service Integration Tests', () => {
  beforeAll(() => {
    setupTestEnvironment()
  })

  afterAll(() => {
    cleanupMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AI Analysis Operations', () => {
    it('should create AI analysis successfully', async () => {
      const mockAnalysis = {
        id: 'analysis_123',
        campaignId: 'camp_123',
        organizationId: 'org_123',
        analysisType: 'comprehensive',
        insights: {
          performance: { score: 85, trend: 'improving' },
          audience: { topSegments: ['Male 25-34'] },
          budget: { efficiency: 78 },
        },
        confidence: 92,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaClient.aIAnalysis.create.mockResolvedValue(mockAnalysis)

      const result = await createAIAnalysis({
        campaignId: 'camp_123',
        organizationId: 'org_123',
        analysisType: 'comprehensive',
        insights: mockAnalysis.insights,
        confidence: 92,
      })

      expect(mockPrismaClient.aIAnalysis.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: mockAnalysis.insights,
          confidence: 92,
          status: 'completed',
        },
      })

      expect(result).toEqual(mockAnalysis)
    })

    it('should update AI analysis progress', async () => {
      const updatedAnalysis = {
        id: 'analysis_123',
        campaignId: 'camp_123',
        organizationId: 'org_123',
        status: 'in_progress',
        progress: 50,
        updatedAt: new Date(),
      }

      mockPrismaClient.aIAnalysis.update.mockResolvedValue(updatedAnalysis)

      const result = await updateAIAnalysis('analysis_123', {
        status: 'in_progress',
        progress: 50,
      })

      expect(mockPrismaClient.aIAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'analysis_123' },
        data: {
          status: 'in_progress',
          progress: 50,
          updatedAt: expect.any(Date),
        },
      })

      expect(result).toEqual(updatedAnalysis)
    })

    it('should get analyses by campaign', async () => {
      const mockAnalyses = [
        {
          id: 'analysis_1',
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
          confidence: 92,
          createdAt: new Date(),
        },
        {
          id: 'analysis_2',
          campaignId: 'camp_123',
          analysisType: 'performance',
          confidence: 88,
          createdAt: new Date(),
        },
      ]

      mockPrismaClient.aIAnalysis.findMany.mockResolvedValue(mockAnalyses)

      const result = await getAIAnalysesByCampaign('camp_123')

      expect(mockPrismaClient.aIAnalysis.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp_123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      expect(result).toEqual(mockAnalyses)
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockPrismaClient.aIAnalysis.create.mockRejectedValue(dbError)

      await expect(
        createAIAnalysis({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: { performance: { score: 85 } },
          confidence: 92,
        })
      ).rejects.toThrow('Database connection failed')
    })
  })

  describe('Creative Generation Operations', () => {
    it('should create creative generation record', async () => {
      const mockCreative = {
        id: 'creative_123',
        campaignId: 'camp_123',
        organizationId: 'org_123',
        contentType: 'text',
        content: {
          headlines: ['Great Product!'],
          descriptions: ['Amazing quality'],
        },
        variants: [],
        createdAt: new Date(),
      }

      mockPrismaClient.creativeGeneration.create.mockResolvedValue(mockCreative)

      const result = await createCreativeGeneration({
        campaignId: 'camp_123',
        organizationId: 'org_123',
        contentType: 'text',
        content: mockCreative.content,
        variants: [],
      })

      expect(mockPrismaClient.creativeGeneration.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'camp_123',
          organizationId: 'org_123',
          contentType: 'text',
          content: mockCreative.content,
          variants: [],
          status: 'completed',
        },
      })

      expect(result).toEqual(mockCreative)
    })

    it('should handle different content types', async () => {
      const contentTypes = ['text', 'image', 'video']

      for (const contentType of contentTypes) {
        const mockCreative = {
          id: `creative_${contentType}`,
          campaignId: 'camp_123',
          organizationId: 'org_123',
          contentType,
          content: {},
          variants: [],
        }

        mockPrismaClient.creativeGeneration.create.mockResolvedValue(mockCreative)

        const result = await createCreativeGeneration({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          contentType,
          content: {},
          variants: [],
        })

        expect(result.contentType).toBe(contentType)
      }
    })
  })

  describe('Optimization Operations', () => {
    it('should create optimization record', async () => {
      const mockOptimization = {
        id: 'opt_123',
        campaignId: 'camp_123',
        organizationId: 'org_123',
        optimizationType: 'performance',
        recommendations: [
          { type: 'budget', action: 'increase', value: 20 },
        ],
        projectedImpact: { ctr: 0.5, cpc: -0.1 },
        createdAt: new Date(),
      }

      mockPrismaClient.optimization.create.mockResolvedValue(mockOptimization)

      const result = await createOptimization({
        campaignId: 'camp_123',
        organizationId: 'org_123',
        optimizationType: 'performance',
        recommendations: mockOptimization.recommendations,
        projectedImpact: mockOptimization.projectedImpact,
      })

      expect(mockPrismaClient.optimization.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'camp_123',
          organizationId: 'org_123',
          optimizationType: 'performance',
          recommendations: mockOptimization.recommendations,
          projectedImpact: mockOptimization.projectedImpact,
          status: 'pending',
        },
      })

      expect(result).toEqual(mockOptimization)
    })

    it('should handle different optimization types', async () => {
      const optimizationTypes = ['performance', 'budget', 'targeting', 'creative']

      for (const optimizationType of optimizationTypes) {
        const mockOptimization = {
          id: `opt_${optimizationType}`,
          campaignId: 'camp_123',
          organizationId: 'org_123',
          optimizationType,
          recommendations: [],
          projectedImpact: {},
        }

        mockPrismaClient.optimization.create.mockResolvedValue(mockOptimization)

        const result = await createOptimization({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          optimizationType,
          recommendations: [],
          projectedImpact: {},
        })

        expect(result.optimizationType).toBe(optimizationType)
      }
    })
  })

  describe('Analytics Dashboard Operations', () => {
    it('should calculate analytics dashboard metrics', async () => {
      // Mock campaign data
      const mockCampaigns = [
        {
          id: 'camp_1',
          status: 'active',
          budget: 1000,
          spend: 450,
          impressions: 15000,
          clicks: 750,
          conversions: 45,
        },
        {
          id: 'camp_2',
          status: 'active',
          budget: 2000,
          spend: 890,
          impressions: 28000,
          clicks: 1400,
          conversions: 84,
        },
      ]

      mockPrismaClient.campaign.findMany.mockResolvedValue(mockCampaigns)

      const result = await getAnalyticsDashboard('org_123', '7d')

      expect(mockPrismaClient.campaign.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_123',
          createdAt: {
            gte: expect.any(Date), // Should be 7 days ago
          },
        },
      })

      expect(result).toEqual({
        totalCampaigns: 2,
        totalSpend: 1340,
        totalImpressions: 43000,
        totalClicks: 2150,
        avgCTR: 5.0,
        avgCPC: expect.any(Number),
        conversionRate: expect.any(Number),
        roi: expect.any(Number),
      })
    })

    it('should handle different timeframes', async () => {
      const timeframes = ['24h', '7d', '30d', '90d']

      for (const timeframe of timeframes) {
        mockPrismaClient.campaign.findMany.mockResolvedValue([])

        const result = await getAnalyticsDashboard('org_123', timeframe)

        expect(result).toBeDefined()
        expect(typeof result.totalCampaigns).toBe('number')
      }
    })

    it('should calculate metrics correctly with zero values', async () => {
      mockPrismaClient.campaign.findMany.mockResolvedValue([])

      const result = await getAnalyticsDashboard('org_123', '7d')

      expect(result).toEqual({
        totalCampaigns: 0,
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        avgCTR: 0,
        avgCPC: 0,
        conversionRate: 0,
        roi: 0,
      })
    })
  })

  describe('Data Cleanup Operations', () => {
    it('should cleanup old analyses', async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30)

      mockPrismaClient.aIAnalysis.deleteMany.mockResolvedValue({ count: 15 })

      const result = await cleanupOldAnalyses(30)

      expect(mockPrismaClient.aIAnalysis.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
          status: 'completed',
        },
      })

      expect(result).toEqual({ deletedCount: 15 })
    })

    it('should handle cleanup with different retention periods', async () => {
      const retentionPeriods = [7, 30, 90]

      for (const days of retentionPeriods) {
        mockPrismaClient.aIAnalysis.deleteMany.mockResolvedValue({ count: 5 })

        const result = await cleanupOldAnalyses(days)

        expect(result.deletedCount).toBe(5)
      }
    })
  })

  describe('Data Validation', () => {
    it('should validate required fields for AI analysis', async () => {
      await expect(
        createAIAnalysis({
          campaignId: '',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: {},
          confidence: 92,
        })
      ).rejects.toThrow()
    })

    it('should validate confidence score range', async () => {
      await expect(
        createAIAnalysis({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: {},
          confidence: 150, // Invalid - over 100
        })
      ).rejects.toThrow()

      await expect(
        createAIAnalysis({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: {},
          confidence: -10, // Invalid - negative
        })
      ).rejects.toThrow()
    })

    it('should validate organization access', async () => {
      // Test accessing data from different organization
      await expect(
        getAIAnalysesByCampaign('camp_from_other_org')
      ).rejects.toThrow()
    })
  })

  describe('Performance & Bulk Operations', () => {
    it('should handle bulk analysis creation', async () => {
      const analyses = Array.from({ length: 10 }, (_, i) => ({
        campaignId: `camp_${i}`,
        organizationId: 'org_123',
        analysisType: 'comprehensive' as const,
        insights: { performance: { score: 80 + i } },
        confidence: 90 + i,
      }))

      mockPrismaClient.aIAnalysis.createMany = jest.fn().mockResolvedValue({ count: 10 })

      // Test bulk creation functionality
      const promises = analyses.map(analysis => createAIAnalysis(analysis))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
    })

    it('should handle pagination for large datasets', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `analysis_${i}`,
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
        confidence: 90,
        createdAt: new Date(),
      }))

      mockPrismaClient.aIAnalysis.findMany.mockResolvedValue(
        largeDataset.slice(0, 10)
      )

      const result = await getAIAnalysesByCampaign('camp_123')

      // Should limit to 10 results by default
      expect(result).toHaveLength(10)
      expect(mockPrismaClient.aIAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })
  })
})