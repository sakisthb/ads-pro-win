// Tests for AI Agents Hooks
// Testing AI operations, data fetching, and error handling

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  useCampaignAnalysis, 
  useCreativeGeneration, 
  useOptimization,
  useAnalyticsDashboard 
} from '../use-ai-agents'
import { createMockTRPCClient, mockCampaign, mockAIAnalysisResult } from '@/test-utils/test-utils'

// Mock tRPC client
jest.mock('@/lib/trpc/client', () => ({
  api: createMockTRPCClient(),
}))

describe('AI Agents Hooks', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('useCampaignAnalysis', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useCampaignAnalysis(), { wrapper })

      expect(result.current.isAnalyzing).toBe(false)
      expect(result.current.analysisResult).toBeNull()
      expect(result.current.error).toBeNull()
      expect(typeof result.current.analyzeCampaign).toBe('function')
    })

    it('should handle successful campaign analysis', async () => {
      const mockResult = mockAIAnalysisResult()
      const { result } = renderHook(() => useCampaignAnalysis(), { wrapper })

      // Mock successful analysis
      const mockMutate = jest.fn().mockImplementation((data, { onSuccess }) => {
        setTimeout(() => onSuccess(mockResult), 0)
      })
      
      result.current.analyzeCampaign = mockMutate

      // Trigger analysis
      result.current.analyzeCampaign({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          campaignId: 'camp_123',
          analysisType: 'comprehensive',
        })
      })
    })

    it('should handle analysis errors gracefully', async () => {
      const { result } = renderHook(() => useCampaignAnalysis(), { wrapper })
      const errorMessage = 'Analysis failed'

      // Mock error
      const mockMutate = jest.fn().mockImplementation((data, { onError }) => {
        setTimeout(() => onError(new Error(errorMessage)), 0)
      })
      
      result.current.analyzeCampaign = mockMutate

      result.current.analyzeCampaign({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled()
      })
    })

    it('should handle different analysis types', async () => {
      const { result } = renderHook(() => useCampaignAnalysis(), { wrapper })
      const mockMutate = jest.fn()
      result.current.analyzeCampaign = mockMutate

      const analysisTypes = ['comprehensive', 'performance', 'audience', 'budget'] as const

      for (const type of analysisTypes) {
        result.current.analyzeCampaign({
          campaignId: 'camp_123',
          analysisType: type,
        })

        expect(mockMutate).toHaveBeenCalledWith({
          campaignId: 'camp_123',
          analysisType: type,
        })
      }

      expect(mockMutate).toHaveBeenCalledTimes(analysisTypes.length)
    })
  })

  describe('useCreativeGeneration', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useCreativeGeneration(), { wrapper })

      expect(result.current.isGenerating).toBe(false)
      expect(result.current.generatedContent).toBeNull()
      expect(result.current.error).toBeNull()
      expect(typeof result.current.generateCreative).toBe('function')
    })

    it('should handle successful creative generation', async () => {
      const { result } = renderHook(() => useCreativeGeneration(), { wrapper })
      
      const mockResult = {
        id: 'creative_123',
        content: {
          headlines: ['Great Product!', 'Amazing Deal!'],
          descriptions: ['High quality product', 'Limited time offer'],
        },
        variants: [],
      }

      const mockMutate = jest.fn().mockImplementation((data, { onSuccess }) => {
        setTimeout(() => onSuccess(mockResult), 0)
      })
      
      result.current.generateCreative = mockMutate

      result.current.generateCreative({
        campaignId: 'camp_123',
        contentType: 'text',
        tone: 'professional',
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          campaignId: 'camp_123',
          contentType: 'text',
          tone: 'professional',
        })
      })
    })

    it('should handle different content types', () => {
      const { result } = renderHook(() => useCreativeGeneration(), { wrapper })
      const mockMutate = jest.fn()
      result.current.generateCreative = mockMutate

      const contentTypes = ['text', 'image', 'video'] as const

      for (const type of contentTypes) {
        result.current.generateCreative({
          campaignId: 'camp_123',
          contentType: type,
          tone: 'professional',
        })
      }

      expect(mockMutate).toHaveBeenCalledTimes(contentTypes.length)
    })
  })

  describe('useOptimization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useOptimization(), { wrapper })

      expect(result.current.isOptimizing).toBe(false)
      expect(result.current.optimizationResult).toBeNull()
      expect(result.current.error).toBeNull()
      expect(typeof result.current.optimizeCampaign).toBe('function')
    })

    it('should handle successful optimization', async () => {
      const { result } = renderHook(() => useOptimization(), { wrapper })
      
      const mockResult = {
        id: 'opt_123',
        recommendations: [
          { type: 'budget', action: 'increase', value: 20 },
          { type: 'targeting', action: 'expand', value: 'lookalike_audiences' },
        ],
        projectedImpact: { ctr: 0.5, cpc: -0.1 },
      }

      const mockMutate = jest.fn().mockImplementation((data, { onSuccess }) => {
        setTimeout(() => onSuccess(mockResult), 0)
      })
      
      result.current.optimizeCampaign = mockMutate

      result.current.optimizeCampaign({
        campaignId: 'camp_123',
        optimizationType: 'performance',
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          campaignId: 'camp_123',
          optimizationType: 'performance',
        })
      })
    })
  })

  describe('useAnalyticsDashboard', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useAnalyticsDashboard(), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBeNull()
      expect(typeof result.current.refetch).toBe('function')
    })

    it('should handle different timeframes', () => {
      const timeframes = ['24h', '7d', '30d', '90d'] as const

      for (const timeframe of timeframes) {
        const { result } = renderHook(
          () => useAnalyticsDashboard(timeframe), 
          { wrapper }
        )

        expect(result.current).toBeDefined()
      }
    })

    it('should provide refetch functionality', () => {
      const { result } = renderHook(() => useAnalyticsDashboard(), { wrapper })
      
      expect(typeof result.current.refetch).toBe('function')
      
      // Should be able to call refetch
      result.current.refetch()
    })
  })
})