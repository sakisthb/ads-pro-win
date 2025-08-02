// Tests for AIAnalysisPanel Component
// Testing AI analysis functionality, UI interactions, and real-time updates

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils/test-utils'
import AIAnalysisPanel from '../ai-analysis-panel'
import { mockCampaign } from '@/test-utils/test-utils'
import userEvent from '@testing-library/user-event'

// Mock the hooks
jest.mock('@/hooks/use-ai-agents', () => ({
  useCampaignAnalysis: () => ({
    analyzeCampaign: jest.fn(),
    isAnalyzing: false,
    analysisResult: null,
    error: null,
  }),
}))

jest.mock('@/hooks/use-websocket', () => ({
  useAIWebSocket: () => ({
    isConnected: true,
    aiProgress: null,
    currentOperation: null,
    sendAIMessage: jest.fn(),
  }),
}))

describe('AIAnalysisPanel', () => {
  const defaultProps = {
    campaignId: 'camp_123',
    organizationId: 'org_123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render with default state', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('AI Campaign Analysis')).toBeInTheDocument()
    expect(screen.getByText('Get AI-powered insights for your campaign performance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument()
  })

  it('should display analysis type selector', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analysis Type')).toBeInTheDocument()
    
    // Check if select trigger is present
    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toBeInTheDocument()
  })

  it('should display AI provider selector', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('AI Provider')).toBeInTheDocument()
    
    // Should have two comboboxes (analysis type and provider)
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
  })

  it('should handle analysis type selection', async () => {
    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const analysisTypeSelect = screen.getAllByRole('combobox')[0]
    
    await user.click(analysisTypeSelect)
    
    // Should open dropdown - check for options
    await waitFor(() => {
      expect(screen.getByText('Comprehensive Analysis')).toBeInTheDocument()
    })
  })

  it('should handle AI provider selection', async () => {
    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const providerSelect = screen.getAllByRole('combobox')[1]
    
    await user.click(providerSelect)
    
    await waitFor(() => {
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    })
  })

  it('should trigger analysis on start button click', async () => {
    const mockAnalyzeCampaign = jest.fn()
    
    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: mockAnalyzeCampaign,
        isAnalyzing: false,
        analysisResult: null,
        error: null,
      }),
    }))

    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const startButton = screen.getByRole('button', { name: /start analysis/i })
    
    await user.click(startButton)

    expect(mockAnalyzeCampaign).toHaveBeenCalledWith({
      campaignId: 'camp_123',
      analysisType: 'comprehensive',
      provider: 'openai',
      sessionId: expect.any(String),
    })
  })

  it('should show loading state during analysis', () => {
    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: jest.fn(),
        isAnalyzing: true,
        analysisResult: null,
        error: null,
      }),
    }))

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled()
  })

  it('should display progress during real-time analysis', () => {
    jest.doMock('@/hooks/use-websocket', () => ({
      useAIWebSocket: () => ({
        isConnected: true,
        aiProgress: {
          progress: 45,
          stage: 'analyzing',
          details: 'Processing campaign metrics...',
        },
        currentOperation: 'campaignAnalysis',
        sendAIMessage: jest.fn(),
      }),
    }))

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Processing campaign metrics...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should display analysis results', () => {
    const mockResult = {
      id: 'analysis_123',
      insights: {
        performance: {
          score: 85,
          trend: 'improving',
          recommendations: ['Increase budget for high-performing keywords'],
        },
        audience: {
          topSegments: ['Male 25-34', 'Female 35-44'],
          engagementRate: 4.2,
        },
        budget: {
          efficiency: 78,
          recommendedBudget: 1200,
          projectedReturn: 2400,
        },
      },
      confidence: 92,
    }

    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: jest.fn(),
        isAnalyzing: false,
        analysisResult: mockResult,
        error: null,
      }),
    }))

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analysis Results')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument() // Performance score
    expect(screen.getByText('92%')).toBeInTheDocument() // Confidence
    expect(screen.getByText('Increase budget for high-performing keywords')).toBeInTheDocument()
  })

  it('should display error state', () => {
    const errorMessage = 'Analysis failed due to insufficient data'

    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: jest.fn(),
        isAnalyzing: false,
        analysisResult: null,
        error: new Error(errorMessage),
      }),
    }))

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analysis Error')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument()
  })

  it('should handle retry after error', async () => {
    const mockAnalyzeCampaign = jest.fn()

    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: mockAnalyzeCampaign,
        isAnalyzing: false,
        analysisResult: null,
        error: new Error('Analysis failed'),
      }),
    }))

    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const retryButton = screen.getByRole('button', { name: /retry analysis/i })
    
    await user.click(retryButton)

    expect(mockAnalyzeCampaign).toHaveBeenCalled()
  })

  it('should show WebSocket connection status', () => {
    jest.doMock('@/hooks/use-websocket', () => ({
      useAIWebSocket: () => ({
        isConnected: false,
        aiProgress: null,
        currentOperation: null,
        sendAIMessage: jest.fn(),
      }),
    }))

    render(<AIAnalysisPanel {...defaultProps} />)

    // Should indicate offline status
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('should handle different analysis types correctly', async () => {
    const mockAnalyzeCampaign = jest.fn()

    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: mockAnalyzeCampaign,
        isAnalyzing: false,
        analysisResult: null,
        error: null,
      }),
    }))

    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    // Change analysis type to performance
    const analysisTypeSelect = screen.getAllByRole('combobox')[0]
    await user.click(analysisTypeSelect)
    
    await waitFor(() => {
      const performanceOption = screen.getByText('Performance Analysis')
      user.click(performanceOption)
    })

    const startButton = screen.getByRole('button', { name: /start analysis/i })
    await user.click(startButton)

    expect(mockAnalyzeCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisType: 'performance',
      })
    )
  })

  it('should export analysis results', async () => {
    const mockResult = {
      id: 'analysis_123',
      insights: {
        performance: { score: 85 },
        audience: { topSegments: ['Male 25-34'] },
        budget: { efficiency: 78 },
      },
      confidence: 92,
    }

    jest.doMock('@/hooks/use-ai-agents', () => ({
      useCampaignAnalysis: () => ({
        analyzeCampaign: jest.fn(),
        isAnalyzing: false,
        analysisResult: mockResult,
        error: null,
      }),
    }))

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-url')
    global.URL.revokeObjectURL = jest.fn()

    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const exportButton = screen.getByRole('button', { name: /export results/i })
    
    await user.click(exportButton)

    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })
})