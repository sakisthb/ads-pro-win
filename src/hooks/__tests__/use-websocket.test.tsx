// Tests for WebSocket Hooks
// Testing real-time connections, progress tracking, and error handling

import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useWebSocket, 
  useAIWebSocket, 
  useCampaignWebSocket,
  useAnalyticsWebSocket 
} from '../use-websocket'
import { createMockWebSocket } from '@/test-utils/test-utils'

// Mock WebSocket constructor
const mockWebSocketConstructor = jest.fn()
global.WebSocket = mockWebSocketConstructor as any

describe('WebSocket Hooks', () => {
  let mockWS: any

  beforeEach(() => {
    mockWS = createMockWebSocket()
    mockWebSocketConstructor.mockReturnValue(mockWS)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('useWebSocket', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      expect(result.current.connectionStatus).toBe('connecting')
      expect(result.current.lastMessage).toBeNull()
      expect(result.current.error).toBeNull()
      expect(typeof result.current.sendMessage).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
    })

    it('should connect to WebSocket server', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:8080')
      expect(result.current.connectionStatus).toBe('connecting')

      // Simulate connection
      act(() => {
        mockWS.simulateOpen()
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected')
      })
    })

    it('should handle incoming messages', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send message
      const testMessage = { type: 'test', data: 'hello world' }
      act(() => {
        mockWS.simulateMessage(testMessage)
      })

      await waitFor(() => {
        expect(result.current.lastMessage).toEqual(testMessage)
      })
    })

    it('should send messages correctly', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected')
      })

      const testMessage = { type: 'test', data: 'outgoing message' }
      
      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(mockWS.send).toHaveBeenCalledWith(JSON.stringify(testMessage))
    })

    it('should handle connection errors', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      // Simulate error
      act(() => {
        const errorEvent = new Event('error')
        if (mockWS.onerror) {
          mockWS.onerror(errorEvent)
        }
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error')
        expect(result.current.error).toBeDefined()
      })
    })

    it('should handle disconnection', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8080'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected')
      })

      // Disconnect
      act(() => {
        result.current.disconnect()
      })

      expect(mockWS.close).toHaveBeenCalled()
    })

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket('ws://localhost:8080'))

      unmount()

      expect(mockWS.close).toHaveBeenCalled()
    })
  })

  describe('useAIWebSocket', () => {
    it('should initialize with AI-specific state', () => {
      const { result } = renderHook(() => useAIWebSocket('org_123'))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.aiProgress).toBeNull()
      expect(result.current.currentOperation).toBeNull()
      expect(typeof result.current.sendAIMessage).toBe('function')
    })

    it('should handle AI progress updates', async () => {
      const { result } = renderHook(() => useAIWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send AI progress message
      const progressMessage = {
        type: 'aiProgress',
        data: {
          sessionId: 'session_123',
          operation: 'campaignAnalysis',
          progress: 50,
          stage: 'analyzing',
          details: 'Processing campaign data...',
        },
      }

      act(() => {
        mockWS.simulateMessage(progressMessage)
      })

      await waitFor(() => {
        expect(result.current.aiProgress).toEqual(progressMessage.data)
        expect(result.current.currentOperation).toBe('campaignAnalysis')
      })
    })

    it('should handle AI completion messages', async () => {
      const { result } = renderHook(() => useAIWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send completion message
      const completionMessage = {
        type: 'aiComplete',
        data: {
          sessionId: 'session_123',
          operation: 'campaignAnalysis',
          result: { insights: { performance: { score: 85 } } },
        },
      }

      act(() => {
        mockWS.simulateMessage(completionMessage)
      })

      await waitFor(() => {
        expect(result.current.currentOperation).toBeNull()
        expect(result.current.aiProgress).toBeNull()
      })
    })

    it('should handle AI errors', async () => {
      const { result } = renderHook(() => useAIWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send error message
      const errorMessage = {
        type: 'aiError',
        data: {
          sessionId: 'session_123',
          operation: 'campaignAnalysis',
          error: 'Analysis failed',
        },
      }

      act(() => {
        mockWS.simulateMessage(errorMessage)
      })

      await waitFor(() => {
        expect(result.current.currentOperation).toBeNull()
        expect(result.current.aiProgress).toBeNull()
      })
    })
  })

  describe('useCampaignWebSocket', () => {
    it('should initialize with campaign-specific state', () => {
      const { result } = renderHook(() => useCampaignWebSocket('org_123'))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.campaignUpdates).toEqual([])
      expect(typeof result.current.sendCampaignMessage).toBe('function')
    })

    it('should handle campaign update messages', async () => {
      const { result } = renderHook(() => useCampaignWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send campaign update
      const updateMessage = {
        type: 'campaignUpdate',
        data: {
          campaignId: 'camp_123',
          field: 'status',
          oldValue: 'draft',
          newValue: 'active',
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        mockWS.simulateMessage(updateMessage)
      })

      await waitFor(() => {
        expect(result.current.campaignUpdates).toHaveLength(1)
        expect(result.current.campaignUpdates[0]).toEqual(updateMessage.data)
      })
    })

    it('should limit campaign updates history', async () => {
      const { result } = renderHook(() => useCampaignWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send multiple updates
      for (let i = 0; i < 15; i++) {
        const updateMessage = {
          type: 'campaignUpdate',
          data: {
            campaignId: `camp_${i}`,
            field: 'budget',
            oldValue: 1000,
            newValue: 1200,
            timestamp: new Date().toISOString(),
          },
        }

        act(() => {
          mockWS.simulateMessage(updateMessage)
        })
      }

      await waitFor(() => {
        // Should limit to 10 most recent updates
        expect(result.current.campaignUpdates).toHaveLength(10)
      })
    })
  })

  describe('useAnalyticsWebSocket', () => {
    it('should initialize with analytics-specific state', () => {
      const { result } = renderHook(() => useAnalyticsWebSocket('org_123'))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.liveMetrics).toBeNull()
      expect(typeof result.current.sendAnalyticsMessage).toBe('function')
    })

    it('should handle real-time metrics updates', async () => {
      const { result } = renderHook(() => useAnalyticsWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send metrics update
      const metricsMessage = {
        type: 'metricsUpdate',
        data: {
          totalCampaigns: 5,
          totalSpend: 5000,
          totalImpressions: 50000,
          totalClicks: 2500,
          avgCTR: 5.0,
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        mockWS.simulateMessage(metricsMessage)
      })

      await waitFor(() => {
        expect(result.current.liveMetrics).toEqual(metricsMessage.data)
      })
    })

    it('should handle analytics event streams', async () => {
      const { result } = renderHook(() => useAnalyticsWebSocket('org_123'))

      // Connect first
      act(() => {
        mockWS.simulateOpen()
      })

      // Send analytics event
      const eventMessage = {
        type: 'analyticsEvent',
        data: {
          event: 'campaignClick',
          campaignId: 'camp_123',
          value: 1,
          timestamp: new Date().toISOString(),
        },
      }

      act(() => {
        mockWS.simulateMessage(eventMessage)
      })

      await waitFor(() => {
        expect(result.current.recentEvents).toHaveLength(1)
        expect(result.current.recentEvents[0]).toEqual(eventMessage.data)
      })
    })
  })
})