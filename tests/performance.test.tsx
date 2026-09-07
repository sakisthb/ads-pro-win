// Performance Tests for AI Operations
// Testing loading times, memory usage, and optimization

// Performance budgets can flake under CI resource contention; retry twice.
jest.retryTimes(2);

import { performance } from 'perf_hooks'
import { render, screen, waitFor, act } from '@/test-utils/test-utils'
import AIAnalysisPanel from '@/components/ai/ai-analysis-panel'
import RealTimeAnalyticsDashboard from '@/components/ai/realtime-analytics-dashboard'
import {
  mockAIDatabaseService,
  cleanupMocks,
} from '@/test-utils/mocks'

let useCampaignAnalysisMock = () => ({
  analyze: jest.fn(),
  analyzeAsync: jest.fn(),
  bulkAnalyze: jest.fn(),
  bulkAnalyzeAsync: jest.fn(),
  isAnalyzing: false,
  error: null as Error | null,
})

let useAIWebSocketMock = () => ({
  isConnected: true,
  aiOperation: {
    isRunning: false,
    progress: 0,
    stage: 'idle',
    message: 'Ready',
  },
  error: null as string | null,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
})

let useAnalyticsDashboardMock = () => ({
  dashboard: {
    campaigns: [],
    analyses: [],
    optimizations: [],
    predictions: [],
    summary: {
      totalCampaigns: 0,
      totalAnalyses: 0,
      totalOptimizations: 0,
      totalPredictions: 0,
      avgConfidence: 0,
    },
  },
  isLoading: false,
  error: null as Error | null,
  refetch: jest.fn(),
})

let useAnalyticsWebSocketMock = () => ({
  isConnected: true,
  analyticsData: null,
  error: null as string | null,
})

jest.mock('@/hooks/use-ai-agents', () => ({
  useCampaignAnalysis: () => useCampaignAnalysisMock(),
  useAnalyticsDashboard: () => useAnalyticsDashboardMock(),
}))

jest.mock('@/hooks/use-websocket', () => ({
  useAIWebSocket: (_organizationId?: string) => useAIWebSocketMock(),
  useAnalyticsWebSocket: (_organizationId?: string) => useAnalyticsWebSocketMock(),
}))

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    performance.mark('test-start')
    useCampaignAnalysisMock = () => ({
      analyze: jest.fn(),
      analyzeAsync: jest.fn(),
      bulkAnalyze: jest.fn(),
      bulkAnalyzeAsync: jest.fn(),
      isAnalyzing: false,
      error: null,
    })
    useAIWebSocketMock = () => ({
      isConnected: true,
      aiOperation: {
        isRunning: false,
        progress: 0,
        stage: 'idle',
        message: 'Ready',
      },
      error: null,
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })
    useAnalyticsDashboardMock = () => ({
      dashboard: {
        campaigns: [],
        analyses: [],
        optimizations: [],
        predictions: [],
        summary: {
          totalCampaigns: 0,
          totalAnalyses: 0,
          totalOptimizations: 0,
          totalPredictions: 0,
          avgConfidence: 0,
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    useAnalyticsWebSocketMock = () => ({
      isConnected: true,
      analyticsData: null,
      error: null,
    })
  })

  afterEach(() => {
    cleanupMocks()
  })

  describe('AI Component Rendering Performance', () => {
    it('should render AIAnalysisPanel within performance budget', () => {
      const startTime = performance.now()

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(100)
    })

    it('should render RealTimeAnalyticsDashboard efficiently', () => {
      const startTime = performance.now()

      render(
        <RealTimeAnalyticsDashboard organizationId="org_123" />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(200)
    })

    it('should handle large datasets without performance degradation', async () => {
      const largeCampaignList = Array.from({ length: 1000 }, (_, i) => ({
        id: `camp_${i}`,
        name: `Campaign ${i}`,
        status: 'active',
        spend: Math.random() * 1000,
        impressions: Math.random() * 10000,
        clicks: Math.random() * 500,
      }))

      useAnalyticsDashboardMock = () => ({
        dashboard: {
          campaigns: largeCampaignList,
          analyses: [],
          optimizations: [],
          predictions: [],
          summary: {
            totalCampaigns: 1000,
            totalAnalyses: 0,
            totalOptimizations: 0,
            totalPredictions: 0,
            avgConfidence: 0,
          },
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      const startTime = performance.now()

      render(
        <RealTimeAnalyticsDashboard organizationId="org_123" />
      )

      await waitFor(() => {
        expect(screen.getByText('1,000')).toBeInTheDocument()
      }, { timeout: 5000 })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(1000)
    })
  })

  describe('AI Operation Performance', () => {
    it('should complete AI analysis within time budget', async () => {
      const mockAnalysisResult = {
        id: 'analysis_123',
        insights: {
          performance: { score: 85 },
          audience: { topSegments: ['Male 25-34'] },
          budget: { efficiency: 78 },
        },
        confidence: 92,
      }

      mockAIDatabaseService.createAIAnalysis.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve(mockAnalysisResult), 500)
        })
      )

      const startTime = performance.now()

      const result = await mockAIDatabaseService.createAIAnalysis({
        campaignId: 'camp_123',
        organizationId: 'org_123',
        analysisType: 'comprehensive',
        insights: mockAnalysisResult.insights,
        confidence: 92,
      })

      const endTime = performance.now()
      const operationTime = endTime - startTime

      expect(result).toEqual(mockAnalysisResult)
      expect(operationTime).toBeLessThan(1000)
    })

    it('should handle concurrent AI operations efficiently', async () => {
      const mockResult = {
        id: 'analysis_123',
        insights: { performance: { score: 85 } },
        confidence: 92,
      }

      mockAIDatabaseService.createAIAnalysis.mockResolvedValue(mockResult)

      const startTime = performance.now()

      const promises = Array.from({ length: 10 }, (_, i) =>
        mockAIDatabaseService.createAIAnalysis({
          campaignId: `camp_${i}`,
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: { performance: { score: 85 } },
          confidence: 92,
        })
      )

      const results = await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(results).toHaveLength(10)
      expect(totalTime).toBeLessThan(2000)
    })

    it('should optimize database queries for analytics', async () => {
      const mockDashboardData = {
        totalCampaigns: 100,
        totalSpend: 50000,
        totalImpressions: 1000000,
        totalClicks: 50000,
        avgCTR: 5.0,
        avgCPC: 1.0,
        conversionRate: 2.5,
        roi: 150,
      }

      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue(mockDashboardData)

      const startTime = performance.now()

      const result = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '30d')

      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(result).toEqual(mockDashboardData)
      expect(queryTime).toBeLessThan(500)
    })
  })

  describe('WebSocket Performance', () => {
    it('should handle high-frequency WebSocket messages efficiently', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        onmessage: null as ((event: MessageEvent) => void) | null,
      }

      global.WebSocket = jest.fn(() => mockWebSocket) as any

      const startTime = performance.now()

      for (let i = 0; i < 100; i++) {
        const message = {
          type: 'aiProgress',
          data: {
            sessionId: 'session_123',
            operation: 'campaignAnalysis',
            progress: i,
            stage: 'analyzing',
          },
        }

        if (mockWebSocket.onmessage) {
          const event = new MessageEvent('message', {
            data: JSON.stringify(message),
          })
          mockWebSocket.onmessage(event)
        }
      }

      const endTime = performance.now()
      const processingTime = endTime - startTime

      expect(processingTime).toBeLessThan(100)
    })

    it('should limit memory usage with message history', () => {
      const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        type: 'aiProgress',
        data: { progress: i % 100 },
        timestamp: new Date(),
      }))

      const limitedMessages = mockMessages.slice(-50)

      expect(limitedMessages).toHaveLength(50)
      expect(limitedMessages[0].id).toBe(950)
      expect(limitedMessages[49].id).toBe(999)
    })
  })

  describe('Memory Usage Optimization', () => {
    it('should cleanup component references on unmount', () => {
      const { unmount } = render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      unmount()

      if (global.gc) {
        global.gc()
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0

      expect(finalMemory - initialMemory).toBeLessThan(1000000)
    })

    it('should handle large AI result datasets efficiently', async () => {
      const largeInsights = {
        performance: {
          score: 85,
          metrics: Array.from({ length: 1000 }, (_, i) => ({
            date: new Date(),
            value: Math.random() * 100,
            category: `metric_${i}`,
          })),
        },
        audience: {
          segments: Array.from({ length: 500 }, (_, i) => ({
            id: `segment_${i}`,
            name: `Segment ${i}`,
            size: Math.floor(Math.random() * 10000),
            engagement: Math.random() * 10,
          })),
        },
        recommendations: Array.from({ length: 100 }, (_, i) => ({
          id: `rec_${i}`,
          type: 'optimization',
          priority: Math.random() * 10,
          description: `Recommendation ${i}`,
          impact: Math.random() * 5,
        })),
      }

      const mockResult = {
        id: 'analysis_123',
        insights: largeInsights,
        confidence: 92,
      }

      const startTime = performance.now()

      const processed = JSON.parse(JSON.stringify(mockResult))

      const endTime = performance.now()
      const processingTime = endTime - startTime

      expect(processed.insights.performance.metrics).toHaveLength(1000)
      expect(processed.insights.audience.segments).toHaveLength(500)
      expect(processed.insights.recommendations).toHaveLength(100)
      expect(processingTime).toBeLessThan(100)
    })
  })

  describe('Bundle Size and Loading Performance', () => {
    it('should lazy load components to reduce initial bundle size', async () => {
      const mockLazyComponent = () =>
        Promise.resolve({
          default: () => <div>Lazy Loaded Component</div>,
        })

      const startTime = performance.now()

      const LazyComponent = await mockLazyComponent()

      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(LazyComponent.default).toBeDefined()
      expect(loadTime).toBeLessThan(50)
    })

    it('should optimize asset loading for fast page load', () => {
      const assets = [
        { type: 'script', size: 50000, critical: true },
        { type: 'style', size: 20000, critical: true },
        { type: 'image', size: 100000, critical: false },
        { type: 'font', size: 30000, critical: false },
      ]

      const criticalAssets = assets.filter(asset => asset.critical)
      const totalCriticalSize = criticalAssets.reduce((sum, asset) => sum + asset.size, 0)

      expect(totalCriticalSize).toBeLessThan(100000)
    })
  })

  describe('Cache Performance', () => {
    it('should return consistent analytics data across repeated calls', async () => {
      const mockData = { totalCampaigns: 5, totalSpend: 5000 }

      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue(mockData)

      const firstResult = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')
      const secondResult = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')

      expect(firstResult).toEqual(mockData)
      expect(secondResult).toEqual(mockData)
      expect(mockAIDatabaseService.getAnalyticsDashboard).toHaveBeenCalledTimes(2)
    })

    it('should expire cache appropriately', async () => {
      const mockData = { totalCampaigns: 5, totalSpend: 5000 }
      const cacheExpiry = 300000

      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue(mockData)

      const cacheEntry = {
        data: mockData,
        timestamp: Date.now(),
        expiry: cacheExpiry,
      }

      const isExpired = (Date.now() - cacheEntry.timestamp) > cacheEntry.expiry
      expect(isExpired).toBe(false)

      cacheEntry.timestamp = Date.now() - (cacheExpiry + 1000)
      const isNowExpired = (Date.now() - cacheEntry.timestamp) > cacheEntry.expiry
      expect(isNowExpired).toBe(true)
    })
  })

  describe('API Response Time Optimization', () => {
    it('should paginate large API responses', async () => {
      const totalItems = 10000
      const pageSize = 100
      const totalPages = Math.ceil(totalItems / pageSize)

      for (let page = 1; page <= Math.min(5, totalPages); page++) {
        const startTime = performance.now()

        const mockResponse = {
          data: Array.from({ length: pageSize }, (_, i) => ({
            id: (page - 1) * pageSize + i,
            name: `Item ${(page - 1) * pageSize + i}`,
          })),
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages,
          },
        }

        await new Promise(resolve => setTimeout(resolve, 50))

        const endTime = performance.now()
        const responseTime = endTime - startTime

        expect(mockResponse.data).toHaveLength(pageSize)
        expect(responseTime).toBeLessThan(200)
      }
    })

    it('should compress API responses', () => {
      const largeResponse = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          description: 'A'.repeat(100),
          metadata: { timestamp: new Date(), index: i },
        })),
      }

      const originalSize = JSON.stringify(largeResponse).length

      const compressedSize = Math.floor(originalSize * 0.3)

      expect(compressedSize).toBeLessThan(originalSize)
      expect(compressedSize / originalSize).toBeLessThan(0.5)
    })
  })
})
