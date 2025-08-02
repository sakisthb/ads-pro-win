"use client";

// WebSocket React Hook for Real-Time AI Updates
// Manages WebSocket connection and real-time data updates

import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage, AIProgressData } from '@/lib/websocket/websocket-server';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WSMessage | null;
  connectionId: string | null;
}

interface UseWebSocketOptions {
  organizationId?: string;
  userId?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface AIOperationState {
  isRunning: boolean;
  progress: number;
  stage: string;
  message: string;
  operationType?: string;
  campaignId?: string;
  confidence?: number;
  error?: string;
  result?: any;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    organizationId,
    userId,
    autoConnect = true,
    reconnectAttempts = 3,
    reconnectInterval = 3000
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    connectionId: null,
  });

  const [aiOperation, setAIOperation] = useState<AIOperationState>({
    isRunning: false,
    progress: 0,
    stage: 'idle',
    message: 'Ready',
  });

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'development' 
      ? 'localhost:3001' 
      : window.location.host;
    
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    if (userId) params.set('userId', userId);
    if (sessionIdRef.current) params.set('sessionId', sessionIdRef.current);
    
    // In production, you'd get the actual auth token
    params.set('token', 'demo-token');
    
    return `${protocol}//${host}?${params.toString()}`;
  }, [organizationId, userId]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      
      setState(prev => ({
        ...prev,
        lastMessage: message,
        error: null,
      }));

      // Handle different message types
      switch (message.type) {
        case 'ai_progress':
          const progressData = message.data as AIProgressData;
          setAIOperation(prev => ({
            ...prev,
            isRunning: true,
            progress: progressData.progress || prev.progress,
            stage: progressData.stage || prev.stage,
            message: progressData.message || prev.message,
            operationType: progressData.operationType,
            campaignId: progressData.campaignId,
            confidence: progressData.confidence,
            error: undefined,
          }));
          break;

        case 'ai_complete':
          setAIOperation(prev => ({
            ...prev,
            isRunning: false,
            progress: 100,
            stage: 'completed',
            message: 'Operation completed successfully',
            result: message.data,
            error: undefined,
          }));
          break;

        case 'ai_error':
          setAIOperation(prev => ({
            ...prev,
            isRunning: false,
            stage: 'error',
            message: 'Operation failed',
            error: message.data.error,
          }));
          break;

        case 'campaign_update':
          // Handle campaign updates
          console.log('Campaign update received:', message.data);
          break;

        case 'analytics_update':
          // Handle analytics updates
          console.log('Analytics update received:', message.data);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const url = getWebSocketUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          connectionId: sessionIdRef.current,
        }));
        reconnectCountRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`🔄 Attempting reconnection ${reconnectCountRef.current}/${reconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setState(prev => ({
            ...prev,
            error: 'Failed to reconnect after maximum attempts',
          }));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false,
        }));
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isConnecting: false,
      }));
    }
  }, [getWebSocketUrl, handleMessage, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((channel: string) => {
    return sendMessage({ type: 'subscribe', channel });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    return sendMessage({ type: 'unsubscribe', channel });
  }, [sendMessage]);

  const ping = useCallback(() => {
    return sendMessage({ type: 'ping' });
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      // Generate session ID if not already set
      if (!sessionIdRef.current) {
        sessionIdRef.current = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    connectionId: state.connectionId,
    
    // AI operation state
    aiOperation,
    
    // Connection methods
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    ping,
    
    // Last message received
    lastMessage: state.lastMessage,
  };
}

// Specialized hook for AI operations
export function useAIWebSocket(organizationId?: string) {
  const ws = useWebSocket({ organizationId, autoConnect: true });
  
  useEffect(() => {
    if (ws.isConnected) {
      // Subscribe to AI operation updates
      ws.subscribe('ai_operations');
    }
  }, [ws.isConnected, ws.subscribe]);

  return {
    isConnected: ws.isConnected,
    aiOperation: ws.aiOperation,
    error: ws.error,
    subscribe: ws.subscribe,
    unsubscribe: ws.unsubscribe,
  };
}

// Hook for campaign real-time updates
export function useCampaignWebSocket(campaignId: string, organizationId?: string) {
  const ws = useWebSocket({ organizationId, autoConnect: true });
  const [campaignUpdates, setCampaignUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (ws.isConnected && campaignId) {
      ws.subscribe(`campaign_${campaignId}`);
    }
  }, [ws.isConnected, campaignId, ws.subscribe]);

  useEffect(() => {
    if (ws.lastMessage?.type === 'campaign_update' && 
        ws.lastMessage.data.campaignId === campaignId) {
      setCampaignUpdates(prev => [ws.lastMessage!.data, ...prev.slice(0, 9)]);
    }
  }, [ws.lastMessage, campaignId]);

  return {
    isConnected: ws.isConnected,
    campaignUpdates,
    error: ws.error,
  };
}

// Hook for analytics real-time updates
export function useAnalyticsWebSocket(organizationId?: string) {
  const ws = useWebSocket({ organizationId, autoConnect: true });
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    if (ws.isConnected) {
      ws.subscribe('analytics_updates');
    }
  }, [ws.isConnected, ws.subscribe]);

  useEffect(() => {
    if (ws.lastMessage?.type === 'analytics_update') {
      setAnalyticsData(ws.lastMessage.data);
    }
  }, [ws.lastMessage]);

  return {
    isConnected: ws.isConnected,
    analyticsData,
    error: ws.error,
  };
}