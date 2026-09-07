// Tests for AI Agents Hooks
// The hooks are thin wrappers over tRPC mutations/queries; these tests verify
// the wiring: default state, argument pass-through, and error/pending surfacing.

import { renderHook, act } from '@testing-library/react'
import {
  useCampaignAnalysis,
  useCreativeGeneration,
  useCampaignOptimization,
  useAnalyticsDashboard
} from '../use-ai-agents'
import { api } from '@/lib/trpc/client'

const mockMutate = jest.fn()
const mockMutateAsync = jest.fn().mockResolvedValue({ success: true })
const mockBulkMutate = jest.fn()
const mockRefetch = jest.fn().mockResolvedValue({})

let mockIsPending = false
let mockError: Error | null = null

const mockMutationResult = () => ({
  mutate: mockMutate,
  mutateAsync: mockMutateAsync,
  isPending: mockIsPending,
  error: mockError,
  data: undefined,
})

const mockBulkMutationResult = () => ({
  mutate: mockBulkMutate,
  mutateAsync: mockBulkMutate,
  isPending: mockIsPending,
  error: mockError,
  data: undefined,
})

jest.mock('@/lib/trpc/client', () => ({
  api: {
    ai: {
      analyzeCampaign: { useMutation: jest.fn(() => mockMutationResult()) },
      bulkAnalyzeCampaigns: { useMutation: jest.fn(() => mockBulkMutationResult()) },
      generateCreative: { useMutation: jest.fn(() => mockMutationResult()) },
      optimizeCampaign: { useMutation: jest.fn(() => mockMutationResult()) },
      getAnalyticsDashboard: {
        useQuery: jest.fn(() => ({
          data: { data: { summary: { totalCampaigns: 3 } } },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        })),
      },
    },
  },
}))

describe('AI Agents Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsPending = false
    mockError = null
  })

  describe('useCampaignAnalysis', () => {
    it('exposes analysis and bulk analysis mutations with default state', () => {
      const { result } = renderHook(() => useCampaignAnalysis())

      expect(typeof result.current.analyze).toBe('function')
      expect(typeof result.current.analyzeAsync).toBe('function')
      expect(typeof result.current.bulkAnalyze).toBe('function')
      expect(typeof result.current.bulkAnalyzeAsync).toBe('function')
      expect(result.current.isAnalyzing).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('delegates analyze calls to the tRPC mutation', () => {
      const { result } = renderHook(() => useCampaignAnalysis())

      act(() => {
        result.current.analyze({ campaignId: 'camp_123', analysisType: 'comprehensive' })
      })

      expect(mockMutate).toHaveBeenCalledWith({
        campaignId: 'camp_123',
        analysisType: 'comprehensive',
      })
    })

    it('delegates bulk analysis calls to the bulk tRPC mutation', () => {
      const { result } = renderHook(() => useCampaignAnalysis())

      act(() => {
        result.current.bulkAnalyze({ campaignIds: ['camp_123', 'camp_456'] })
      })

      expect(mockBulkMutate).toHaveBeenCalledWith({ campaignIds: ['camp_123', 'camp_456'] })
    })

    it('surfaces pending state and mutation errors', () => {
      const error = new Error('Analysis failed')
      mockIsPending = true
      mockError = error

      const { result } = renderHook(() => useCampaignAnalysis())

      expect(result.current.isAnalyzing).toBe(true)
      expect(result.current.error).toBe(error)
    })
  })

  describe('useCreativeGeneration', () => {
    it('exposes generation mutation with default state', () => {
      const { result } = renderHook(() => useCreativeGeneration())

      expect(typeof result.current.generate).toBe('function')
      expect(typeof result.current.generateAsync).toBe('function')
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.data).toBeUndefined()
    })

    it('delegates generate calls to the tRPC mutation', () => {
      const { result } = renderHook(() => useCreativeGeneration())

      act(() => {
        result.current.generate({ campaignId: 'camp_123', contentType: 'text' })
      })

      expect(mockMutate).toHaveBeenCalledWith({
        campaignId: 'camp_123',
        contentType: 'text',
      })
    })

    it('surfaces pending state and generation errors', () => {
      const error = new Error('Generation failed')
      mockIsPending = true
      mockError = error

      const { result } = renderHook(() => useCreativeGeneration())

      expect(result.current.isGenerating).toBe(true)
      expect(result.current.error).toBe(error)
    })
  })

  describe('useCampaignOptimization', () => {
    it('exposes optimization mutation with default state', () => {
      const { result } = renderHook(() => useCampaignOptimization())

      expect(typeof result.current.optimize).toBe('function')
      expect(typeof result.current.optimizeAsync).toBe('function')
      expect(result.current.isOptimizing).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.data).toBeUndefined()
    })

    it('delegates optimize calls to the tRPC mutation', () => {
      const { result } = renderHook(() => useCampaignOptimization())

      act(() => {
        result.current.optimize({ campaignId: 'camp_123', optimizationType: 'performance' })
      })

      expect(mockMutate).toHaveBeenCalledWith({
        campaignId: 'camp_123',
        optimizationType: 'performance',
      })
    })

    it('surfaces pending state and optimization errors', () => {
      const error = new Error('Optimization failed')
      mockIsPending = true
      mockError = error

      const { result } = renderHook(() => useCampaignOptimization())

      expect(result.current.isOptimizing).toBe(true)
      expect(result.current.error).toBe(error)
    })
  })

  describe('useAnalyticsDashboard', () => {
    it('unwraps dashboard data from the query result', () => {
      const { result } = renderHook(() => useAnalyticsDashboard())

      expect(result.current.dashboard).toEqual({ summary: { totalCampaigns: 3 } })
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.refetch).toBe('function')
    })

    it('queries with the requested timeframe', () => {
      renderHook(() => useAnalyticsDashboard('30d'))

      const useQuery = api.ai.getAnalyticsDashboard.useQuery as unknown as jest.Mock
      expect(useQuery).toHaveBeenCalledWith(
        { timeframe: '30d' },
        expect.objectContaining({ refetchInterval: 5 * 60 * 1000 })
      )
    })

    it('supports all documented timeframes', () => {
      const timeframes = ['1d', '7d', '30d', '90d'] as const

      for (const timeframe of timeframes) {
        const { result } = renderHook(() => useAnalyticsDashboard(timeframe))
        expect(result.current).toBeDefined()
      }
    })

    it('provides refetch functionality', () => {
      const { result } = renderHook(() => useAnalyticsDashboard())

      act(() => {
        result.current.refetch()
      })

      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
