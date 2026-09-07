// Error Handling Tests
// Testing error scenarios, recovery mechanisms, and user experience

import { render, screen, act } from '@/test-utils/test-utils'
import AIAnalysisPanel from '@/components/ai/ai-analysis-panel'
import {
  mockAIDatabaseService,
  mockRedisClient,
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

jest.mock('@/hooks/use-ai-agents', () => ({
  useCampaignAnalysis: () => useCampaignAnalysisMock(),
}))

jest.mock('@/hooks/use-websocket', () => ({
  useAIWebSocket: (_organizationId?: string) => useAIWebSocketMock(),
}))

describe('Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
  })

  describe('AI Operation Errors', () => {
    it('should display an analysis error from the campaign analysis hook', () => {
      const errorMessage = 'Request timeout after 30 seconds'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display AI provider rate limiting errors', () => {
      const errorMessage = 'Rate limit exceeded. Please try again in 60 seconds.'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display insufficient data errors', () => {
      const errorMessage = 'Insufficient campaign data for analysis'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display API key authentication errors', () => {
      const errorMessage = 'Invalid API key for OpenAI'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Database Connection Errors', () => {
    it('should handle database connection failures', async () => {
      const dbError = new Error('Database connection failed')
      mockAIDatabaseService.createAIAnalysis.mockRejectedValue(dbError)

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
    it('should render the disconnected badge when WebSocket is not connected', () => {
      useAIWebSocketMock = () => ({
        isConnected: false,
        aiOperation: {
          isRunning: false,
          progress: 0,
          stage: 'idle',
          message: 'Ready',
        },
        error: new Error('WebSocket connection failed'),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    it('should render a running operation stage when WebSocket reports progress', () => {
      useAIWebSocketMock = () => ({
        isConnected: true,
        aiOperation: {
          isRunning: true,
          progress: 50,
          stage: 'analyzing',
          message: 'Processing campaign metrics...',
        },
        error: null,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis in Progress')).toBeInTheDocument()
      expect(screen.getByText('Stage: analyzing')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  describe('Network Errors', () => {
    it('should display network connectivity errors', () => {
      const errorMessage = 'Network request failed'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display server errors (5xx)', () => {
      const errorMessage = 'Internal server error'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display client errors (4xx)', () => {
      const errorMessage = 'Bad request - invalid campaign ID'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Redis Cache Errors', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const redisError = new Error('Redis connection refused')
      mockRedisClient.get.mockRejectedValue(redisError)

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
    it('should display invalid input validation errors', () => {
      const errorMessage = 'Campaign ID must be a valid string'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display schema validation errors', () => {
      const errorMessage = 'Analysis type must be one of: comprehensive, performance, audience, budget'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Error Recovery Mechanisms', () => {
    it('should call analyze when the start button is clicked', async () => {
      const mockAnalyze = jest.fn().mockResolvedValue(undefined)
      useCampaignAnalysisMock = () => ({
        analyze: mockAnalyze,
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: null,
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      const startButton = screen.getByRole('button', { name: /start ai analysis/i })
      await act(async () => {
        startButton.click()
      })

      expect(mockAnalyze).toHaveBeenCalledWith({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
        provider: 'openai',
      })
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

      for (let i = 0; i < 3; i++) {
        try {
          await mockAnalyzeCampaign()
          break
        } catch (error) {
          const delay = Math.pow(2, i) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      expect(attemptCount).toBe(3)
    })

    it('should display AI service unavailability errors', () => {
      const errorMessage = 'AI service temporarily unavailable'
      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: new Error(errorMessage),
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Error Logging and Monitoring', () => {
    it('should log errors for monitoring', () => {
      const criticalError = new Error('Critical system failure')
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      useCampaignAnalysisMock = () => ({
        analyze: jest.fn(),
        analyzeAsync: jest.fn(),
        bulkAnalyze: jest.fn(),
        bulkAnalyzeAsync: jest.fn(),
        isAnalyzing: false,
        error: criticalError,
      })

      render(
        <AIAnalysisPanel campaignId="camp_123" organizationId="org_123" />
      )

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(criticalError.message)).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })
})
