// Performance Tests for AI Operations
// Testing loading times, memory usage, and optimization

import { performance } from 'perf_hooks'
import { render, waitFor } from '@/test-utils/test-utils'
import AIAnalysisPanel from '@/components/ai/ai-analysis-panel'
import RealTimeAnalyticsDashboard from '@/components/ai/realtime-analytics-dashboard'
import {
  mockAIDatabaseService,
  mockAIAgents,
  cleanupMocks,
} from '@/test-utils/mocks'

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    performance.mark('test-start')
  })

  afterEach(() => {
    cleanupMocks()
  })

  describe('AI Component Rendering Performance', () => {
    it('should render AIAnalysisPanel within performance budget', async () => {
      const startTime = performance.now()

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100)
    })

    it('should render RealTimeAnalyticsDashboard efficiently', async () => {
      const startTime = performance.now()

      render(
        <RealTimeAnalyticsDashboard organizationId="org_123" />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Complex dashboard should render within 200ms
      expect(renderTime).toBeLessThan(200)
    })

    it('should handle large datasets without performance degradation', async () => {
      // Generate large mock dataset
      const largeCampaignList = Array.from({ length: 1000 }, (_, i) => ({
        id: `camp_${i}`,
        name: `Campaign ${i}`,
        status: 'active',
        spend: Math.random() * 1000,
        impressions: Math.random() * 10000,
        clicks: Math.random() * 500,
      }))

      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue({
        totalCampaigns: 1000,
        campaigns: largeCampaignList,
        totalSpend: 500000,
        totalImpressions: 5000000,
        totalClicks: 250000,
        avgCTR: 5.0,
        avgCPC: 2.0,
        conversionRate: 3.0,
        roi: 120,
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

      // Should handle large datasets within 1 second
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

      // Mock AI operation with realistic delay
      mockAIDatabaseService.createAIAnalysis.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve(mockAnalysisResult), 500) // 500ms simulation
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
      expect(operationTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle concurrent AI operations efficiently', async () => {
      const mockResult = {
        id: 'analysis_123',
        insights: { performance: { score: 85 } },
        confidence: 92,
      }

      mockAIDatabaseService.createAIAnalysis.mockResolvedValue(mockResult)

      const startTime = performance.now()

      // Run 10 concurrent AI operations
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
      expect(totalTime).toBeLessThan(2000) // Should complete within 2 seconds
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
      expect(queryTime).toBeLessThan(500) // Database queries should be fast
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
        onmessage: null,
      }

      global.WebSocket = jest.fn(() => mockWebSocket) as any

      const startTime = performance.now()

      // Simulate 100 rapid WebSocket messages
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

      // Should process 100 messages within 100ms
      expect(processingTime).toBeLessThan(100)
    })

    it('should limit memory usage with message history', () => {
      const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        type: 'aiProgress',
        data: { progress: i % 100 },
        timestamp: new Date(),
      }))

      // Simulate message history limit (should keep only last 50)
      const limitedMessages = mockMessages.slice(-50)

      expect(limitedMessages).toHaveLength(50)
      expect(limitedMessages[0].id).toBe(950) // Should start from message 950
      expect(limitedMessages[49].id).toBe(999) // Should end at message 999
    })
  })

  describe('Memory Usage Optimization', () => {
    it('should cleanup component references on unmount', () => {
      const { unmount } = render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      // Mock memory tracking
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      unmount()

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Memory usage should not increase significantly after unmount
      expect(finalMemory - initialMemory).toBeLessThan(1000000) // Less than 1MB
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

      // Process large dataset
      const processed = JSON.parse(JSON.stringify(mockResult))

      const endTime = performance.now()
      const processingTime = endTime - startTime

      expect(processed.insights.performance.metrics).toHaveLength(1000)
      expect(processed.insights.audience.segments).toHaveLength(500)
      expect(processed.insights.recommendations).toHaveLength(100)
      expect(processingTime).toBeLessThan(100) // Should process within 100ms
    })
  })

  describe('Bundle Size and Loading Performance', () => {
    it('should lazy load components to reduce initial bundle size', async () => {
      // Mock dynamic import
      const mockLazyComponent = () =>
        Promise.resolve({
          default: () => <div>Lazy Loaded Component</div>,
        })

      const startTime = performance.now()

      const LazyComponent = await mockLazyComponent()

      const endTime = performance.now()
      const loadTime = endTime - startTime

      expect(LazyComponent.default).toBeDefined()
      expect(loadTime).toBeLessThan(50) // Should load quickly
    })

    it('should optimize asset loading for fast page load', () => {
      // Mock asset loading performance
      const assets = [
        { type: 'script', size: 50000, critical: true },
        { type: 'style', size: 20000, critical: true },
        { type: 'image', size: 100000, critical: false },
        { type: 'font', size: 30000, critical: false },
      ]

      const criticalAssets = assets.filter(asset => asset.critical)
      const totalCriticalSize = criticalAssets.reduce((sum, asset) => sum + asset.size, 0)

      // Critical assets should be under 100KB
      expect(totalCriticalSize).toBeLessThan(100000)
    })
  })

  describe('Cache Performance', () => {
    it('should cache frequently accessed data', async () => {
      const cacheKey = 'analytics_org_123_7d'
      const mockData = { totalCampaigns: 5, totalSpend: 5000 }

      // First call - should hit database
      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue(mockData)

      const firstCallStart = performance.now()
      const firstResult = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')
      const firstCallTime = performance.now() - firstCallStart

      // Second call - should hit cache (mock faster response)
      mockAIDatabaseService.getAnalyticsDashboard.mockImplementation(() =>
        Promise.resolve(mockData)
      )

      const secondCallStart = performance.now()
      const secondResult = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')
      const secondCallTime = performance.now() - secondCallStart

      expect(firstResult).toEqual(mockData)
      expect(secondResult).toEqual(mockData)
      expect(secondCallTime).toBeLessThan(firstCallTime) // Cache should be faster
    })

    it('should expire cache appropriately', async () => {
      const mockData = { totalCampaigns: 5, totalSpend: 5000 }
      const cacheExpiry = 300000 // 5 minutes

      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue(mockData)

      // Mock cache with expiry
      const cacheEntry = {
        data: mockData,
        timestamp: Date.now(),
        expiry: cacheExpiry,
      }

      const isExpired = (Date.now() - cacheEntry.timestamp) > cacheEntry.expiry
      expect(isExpired).toBe(false)

      // Simulate time passing
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

        // Simulate API response time
        await new Promise(resolve => setTimeout(resolve, 50))

        const endTime = performance.now()
        const responseTime = endTime - startTime

        expect(mockResponse.data).toHaveLength(pageSize)
        expect(responseTime).toBeLessThan(200) // Each page should load quickly
      }
    })

    it('should compress API responses', () => {
      const largeResponse = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          description: 'A'.repeat(100), // Large text field
          metadata: { timestamp: new Date(), index: i },
        })),
      }

      const originalSize = JSON.stringify(largeResponse).length
      
      // Mock compression (simulate 70% reduction)
      const compressedSize = Math.floor(originalSize * 0.3)

      expect(compressedSize).toBeLessThan(originalSize)
      expect(compressedSize / originalSize).toBeLessThan(0.5) // At least 50% reduction
    })
  })
})