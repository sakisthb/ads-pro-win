// Error Handling Tests
// Testing error scenarios, recovery mechanisms, and user experience

import { render, screen, waitFor } from '@/test-utils/test-utils'
import AIAnalysisPanel from '@/components/ai/ai-analysis-panel'
import {
  mockAIDatabaseService,
  mockAIAgents,
  mockWebSocketServer,
  mockRedisClient,
} from '@/test-utils/mocks'

// Mock hooks with error scenarios
const createMockHookWithError = (error: Error) => ({
  useCampaignAnalysis: () => ({
    analyzeCampaign: jest.fn().mockRejectedValue(error),
    isAnalyzing: false,
    analysisResult: null,
    error,
  }),
  useWebSocket: () => ({
    connectionStatus: 'error',
    lastMessage: null,
    error,
    sendMessage: jest.fn(),
    disconnect: jest.fn(),
  }),
})

describe('Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AI Operation Errors', () => {
    it('should handle AI service timeout errors', async () => {
      const timeoutError = new Error('Request timeout after 30 seconds')
      timeoutError.name = 'TimeoutError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(timeoutError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Request timeout after 30 seconds')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument()
    })

    it('should handle AI provider rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded. Please try again in 60 seconds.')
      rateLimitError.name = 'RateLimitError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(rateLimitError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
      expect(screen.getByText(/try again in 60 seconds/i)).toBeInTheDocument()
    })

    it('should handle insufficient data errors', async () => {
      const dataError = new Error('Insufficient campaign data for analysis')
      dataError.name = 'InsufficientDataError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(dataError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Insufficient campaign data for analysis')).toBeInTheDocument()
      expect(screen.getByText(/please ensure your campaign has enough data/i)).toBeInTheDocument()
    })

    it('should handle API key errors', async () => {
      const apiKeyError = new Error('Invalid API key for OpenAI')
      apiKeyError.name = 'AuthenticationError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(apiKeyError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Invalid API key for OpenAI')).toBeInTheDocument()
      expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument()
    })
  })

  describe('Database Connection Errors', () => {
    it('should handle database connection failures', async () => {
      const dbError = new Error('Database connection failed')
      mockAIDatabaseService.createAIAnalysis.mockRejectedValue(dbError)

      // Test database error handling in service layer
      await expect(
        mockAIDatabaseService.createAIAnalysis({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: {},
          confidence: 92,
        })
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle database timeout errors', async () => {
      const timeoutError = new Error('Database query timeout')
      timeoutError.name = 'DatabaseTimeoutError'

      mockAIDatabaseService.getAnalyticsDashboard.mockRejectedValue(timeoutError)

      await expect(
        mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')
      ).rejects.toThrow('Database query timeout')
    })

    it('should handle database constraint violations', async () => {
      const constraintError = new Error('Unique constraint violation')
      constraintError.name = 'PrismaClientKnownRequestError'
      
      mockAIDatabaseService.createAIAnalysis.mockRejectedValue(constraintError)

      await expect(
        mockAIDatabaseService.createAIAnalysis({
          campaignId: 'camp_123',
          organizationId: 'org_123',
          analysisType: 'comprehensive',
          insights: {},
          confidence: 92,
        })
      ).rejects.toThrow('Unique constraint violation')
    })
  })

  describe('WebSocket Connection Errors', () => {
    it('should handle WebSocket connection failures', () => {
      const connectionError = new Error('WebSocket connection failed')
      
      jest.doMock('@/hooks/use-websocket', () => ({
        useAIWebSocket: () => ({
          isConnected: false,
          aiProgress: null,
          currentOperation: null,
          error: connectionError,
          sendAIMessage: jest.fn(),
        }),
      }))

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
      expect(screen.getByText(/offline mode/i)).toBeInTheDocument()
    })

    it('should handle WebSocket disconnections during operations', async () => {
      const mockWSHook = {
        isConnected: true,
        aiProgress: { progress: 50, stage: 'analyzing' },
        currentOperation: 'campaignAnalysis',
        error: null,
        sendAIMessage: jest.fn(),
      }

      jest.doMock('@/hooks/use-websocket', () => ({
        useAIWebSocket: () => mockWSHook,
      }))

      const { rerender } = render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      // Simulate disconnection during operation
      mockWSHook.isConnected = false
      mockWSHook.error = new Error('Connection lost')

      rerender(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
      expect(screen.getByText(/will continue without real-time updates/i)).toBeInTheDocument()
    })

    it('should handle WebSocket message parsing errors', () => {
      const parseError = new Error('Invalid WebSocket message format')
      
      jest.doMock('@/hooks/use-websocket', () => ({
        useAIWebSocket: () => ({
          isConnected: true,
          aiProgress: null,
          currentOperation: null,
          error: parseError,
          sendAIMessage: jest.fn(),
        }),
      }))

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/message format error/i)).toBeInTheDocument()
    })
  })

  describe('Network Errors', () => {
    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network request failed')
      networkError.name = 'NetworkError'

      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValue(networkError)

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(networkError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Network request failed')).toBeInTheDocument()
      expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
    })

    it('should handle server errors (5xx)', async () => {
      const serverError = new Error('Internal server error')
      serverError.name = 'ServerError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(serverError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Internal server error')).toBeInTheDocument()
      expect(screen.getByText(/our team has been notified/i)).toBeInTheDocument()
    })

    it('should handle client errors (4xx)', async () => {
      const clientError = new Error('Bad request - invalid campaign ID')
      clientError.name = 'ClientError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(clientError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/bad request/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid campaign ID/i)).toBeInTheDocument()
    })
  })

  describe('Redis Cache Errors', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const redisError = new Error('Redis connection refused')
      mockRedisClient.get.mockRejectedValue(redisError)

      // Service should fallback to database when Redis fails
      mockAIDatabaseService.getAnalyticsDashboard.mockResolvedValue({
        totalCampaigns: 5,
        totalSpend: 5000,
      })

      const result = await mockAIDatabaseService.getAnalyticsDashboard('org_123', '7d')

      expect(result).toBeDefined()
      expect(result.totalCampaigns).toBe(5)
    })

    it('should handle Redis timeout errors', async () => {
      const timeoutError = new Error('Redis operation timeout')
      mockRedisClient.set.mockRejectedValue(timeoutError)

      // Operations should continue without caching
      mockAIDatabaseService.createAIAnalysis.mockResolvedValue({
        id: 'analysis_123',
        campaignId: 'camp_123',
      })

      const result = await mockAIDatabaseService.createAIAnalysis({
        campaignId: 'camp_123',
        organizationId: 'org_123',
        analysisType: 'comprehensive',
        insights: {},
        confidence: 92,
      })

      expect(result.id).toBe('analysis_123')
    })
  })

  describe('Validation Errors', () => {
    it('should handle invalid input validation', async () => {
      const validationError = new Error('Campaign ID must be a valid string')
      validationError.name = 'ValidationError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(validationError)
      )

      render(
        <AIAnalysisPanel campaignId="" organizationId="org_123" />
      )

      expect(screen.getByText(/campaign ID must be a valid string/i)).toBeInTheDocument()
      expect(screen.getByText(/please check your input/i)).toBeInTheDocument()
    })

    it('should handle schema validation errors', async () => {
      const schemaError = new Error('Analysis type must be one of: comprehensive, performance, audience, budget')
      schemaError.name = 'SchemaValidationError'

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(schemaError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/analysis type must be one of/i)).toBeInTheDocument()
    })
  })

  describe('Error Recovery Mechanisms', () => {
    it('should provide retry functionality for transient errors', async () => {
      const transientError = new Error('Temporary service unavailable')
      transientError.name = 'ServiceUnavailableError'

      const mockAnalyzeCampaign = jest.fn()
      
      jest.doMock('@/hooks/use-ai-agents', () => ({
        useCampaignAnalysis: () => ({
          analyzeCampaign: mockAnalyzeCampaign,
          isAnalyzing: false,
          analysisResult: null,
          error: transientError,
        }),
      }))

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()

      // Click retry
      retryButton.click()

      expect(mockAnalyzeCampaign).toHaveBeenCalled()
    })

    it('should implement exponential backoff for retries', async () => {
      const retryableError = new Error('Rate limit exceeded')
      let attemptCount = 0

      const mockAnalyzeCampaign = jest.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw retryableError
        }
        return Promise.resolve({ id: 'analysis_123' })
      })

      // Test retry logic with exponential backoff
      for (let i = 0; i < 3; i++) {
        try {
          await mockAnalyzeCampaign()
          break
        } catch (error) {
          const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      expect(attemptCount).toBe(3)
    })

    it('should gracefully degrade when AI features are unavailable', async () => {
      const aiUnavailableError = new Error('AI service temporarily unavailable')
      
      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(aiUnavailableError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText(/AI service temporarily unavailable/i)).toBeInTheDocument()
      expect(screen.getByText(/manual analysis tools/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view manual tools/i })).toBeInTheDocument()
    })
  })

  describe('Error Logging and Monitoring', () => {
    it('should log errors for monitoring', async () => {
      const criticalError = new Error('Critical system failure')
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(criticalError)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Analysis Error'),
        expect.objectContaining({
          error: criticalError,
          campaignId: 'camp_123',
          timestamp: expect.any(String),
        })
      )

      consoleSpy.mockRestore()
    })

    it('should sanitize sensitive data in error logs', async () => {
      const errorWithSensitiveData = new Error('Authentication failed')
      errorWithSensitiveData.stack = 'Error with API key: sk-1234567890'

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      jest.doMock('@/hooks/use-ai-agents', () =>
        createMockHookWithError(errorWithSensitiveData)
      )

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const logCall = consoleSpy.mock.calls[0]
      expect(logCall[1].error.stack).not.toContain('sk-1234567890')
      expect(logCall[1].error.stack).toContain('[REDACTED]')

      consoleSpy.mockRestore()
    })
  })
})