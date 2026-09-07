import React from 'react'
import { render, screen, waitFor } from '@/test-utils/test-utils'
import AIAnalysisPanel from '../ai-analysis-panel'
import userEvent from '@testing-library/user-event'

const analyzeMock = jest.fn()
const useCampaignAnalysisMock = jest.fn(() => ({
  analyze: analyzeMock,
  isAnalyzing: false,
  error: null,
}))

const useAIWebSocketMock = jest.fn(() => ({
  isConnected: true,
  aiOperation: {
    isRunning: false,
    progress: 0,
    stage: 'idle',
    message: 'Ready',
  },
  error: null,
}))

jest.mock('@/hooks/use-ai-agents', () => ({
  useCampaignAnalysis: () => useCampaignAnalysisMock(),
}))

jest.mock('@/hooks/use-websocket', () => ({
  useAIWebSocket: (_organizationId?: string) => useAIWebSocketMock(),
}))

describe('AIAnalysisPanel', () => {
  const defaultProps = {
    campaignId: 'camp_123',
    organizationId: 'org_123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useCampaignAnalysisMock.mockReturnValue({
      analyze: analyzeMock,
      isAnalyzing: false,
      error: null,
    })
    useAIWebSocketMock.mockReturnValue({
      isConnected: true,
      aiOperation: {
        isRunning: false,
        progress: 0,
        stage: 'idle',
        message: 'Ready',
      },
      error: null,
    })
  })

  it('should render with default state', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('AI Campaign Analysis')).toBeInTheDocument()
    expect(screen.getByText('Get AI-powered insights and recommendations for your campaigns')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start ai analysis/i })).toBeInTheDocument()
  })

  it('should display analysis type selector', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analysis Type')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /comprehensive/i })).toBeInTheDocument()
  })

  it('should display AI provider selector', () => {
    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('AI Provider')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should trigger analysis on start button click', async () => {
    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const startButton = screen.getByRole('button', { name: /start ai analysis/i })
    await user.click(startButton)

    expect(analyzeMock).toHaveBeenCalledWith({
      campaignId: 'camp_123',
      analysisType: 'comprehensive',
      provider: 'openai',
    })
  })

  it('should show loading state during analysis', () => {
    useCampaignAnalysisMock.mockReturnValue({
      analyze: analyzeMock,
      isAnalyzing: true,
      error: null,
    })

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText(/analyzing campaign/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled()
  })

  it('should display progress during real-time analysis', () => {
    useAIWebSocketMock.mockReturnValue({
      isConnected: true,
      aiOperation: {
        isRunning: true,
        progress: 45,
        stage: 'analyzing',
        message: 'Processing campaign metrics...',
      },
      error: null,
    })

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Processing campaign metrics...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should display error state', () => {
    const errorMessage = 'Analysis failed due to insufficient data'
    useCampaignAnalysisMock.mockReturnValue({
      analyze: analyzeMock,
      isAnalyzing: false,
      error: new Error(errorMessage),
    })

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('should show WebSocket connection status', () => {
    useAIWebSocketMock.mockReturnValue({
      isConnected: false,
      aiOperation: {
        isRunning: false,
        progress: 0,
        stage: 'idle',
        message: 'Ready',
      },
      error: null,
    })

    render(<AIAnalysisPanel {...defaultProps} />)

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('should handle different analysis types correctly', async () => {
    const user = userEvent.setup()
    render(<AIAnalysisPanel {...defaultProps} />)

    const performanceTab = screen.getByRole('tab', { name: /performance/i })
    await user.click(performanceTab)

    const startButton = screen.getByRole('button', { name: /start ai analysis/i })
    await user.click(startButton)

    await waitFor(() => {
      expect(analyzeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisType: 'performance',
        })
      )
    })
  })
})
