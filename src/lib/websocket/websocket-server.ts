// WebSocket Server for Real-Time AI Processing
// Provides live updates during AI operations

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { verify } from 'jsonwebtoken';

export interface WSMessage {
  type: 'ai_progress' | 'ai_complete' | 'ai_error' | 'campaign_update' | 'analytics_update';
  data: any;
  timestamp: number;
  sessionId: string;
  organizationId?: string;
}

export interface AIProgressData {
  operationType: 'analysis' | 'optimization' | 'generation';
  campaignId?: string;
  progress: number; // 0-100
  stage: string;
  message: string;
  confidence?: number;
}

export interface ClientConnection {
  ws: WebSocket;
  sessionId: string;
  organizationId?: string;
  userId?: string;
  lastPing: number;
  subscriptions: Set<string>;
}

export class AIWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<string, ClientConnection> = new Map();
  private organizationConnections: Map<string, Set<string>> = new Map();
  
  constructor(port: number = 3001) {
    this.wss = new WebSocketServer({ 
      port,
      clientTracking: true,
      verifyClient: this.verifyClient.bind(this),
    });
    
    this.setupEventHandlers();
    this.startHeartbeat();
    
    console.log(`🔌 WebSocket server running on port ${port}`);
  }

  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const { query } = parse(info.req.url || '', true);
      const token = query.token as string;
      
      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        return false;
      }

      // In production, verify JWT token
      // const decoded = verify(token, process.env.JWT_SECRET!);
      
      return true;
    } catch (error) {
      console.log('❌ WebSocket connection rejected: Invalid token', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const { query } = parse(req.url || '', true);
      const sessionId = query.sessionId as string || this.generateSessionId();
      const organizationId = query.organizationId as string;
      const userId = query.userId as string;

      const connection: ClientConnection = {
        ws,
        sessionId,
        organizationId,
        userId,
        lastPing: Date.now(),
        subscriptions: new Set(),
      };

      this.connections.set(sessionId, connection);
      
      // Track organization connections
      if (organizationId) {
        if (!this.organizationConnections.has(organizationId)) {
          this.organizationConnections.set(organizationId, new Set());
        }
        this.organizationConnections.get(organizationId)!.add(sessionId);
      }

      console.log(`🔗 WebSocket client connected: ${sessionId} (org: ${organizationId})`);

      // Send welcome message
      this.sendToClient(sessionId, {
        type: 'ai_progress',
        data: { message: 'Connected to AI processing server', stage: 'connected' },
        timestamp: Date.now(),
        sessionId,
        organizationId,
      });

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(sessionId, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected: ${sessionId}`);
        this.removeConnection(sessionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${sessionId}:`, error);
        this.removeConnection(sessionId);
      });

      // Handle pong responses
      ws.on('pong', () => {
        const connection = this.connections.get(sessionId);
        if (connection) {
          connection.lastPing = Date.now();
        }
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  private handleClientMessage(sessionId: string, message: any): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          connection.subscriptions.add(message.channel);
          console.log(`📡 Client ${sessionId} subscribed to ${message.channel}`);
        }
        break;
        
      case 'unsubscribe':
        if (message.channel) {
          connection.subscriptions.delete(message.channel);
          console.log(`📡 Client ${sessionId} unsubscribed from ${message.channel}`);
        }
        break;
        
      case 'ping':
        connection.lastPing = Date.now();
        this.sendToClient(sessionId, {
          type: 'ai_progress',
          data: { message: 'pong' },
          timestamp: Date.now(),
          sessionId,
        });
        break;
    }
  }

  private removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection && connection.organizationId) {
      const orgConnections = this.organizationConnections.get(connection.organizationId);
      if (orgConnections) {
        orgConnections.delete(sessionId);
        if (orgConnections.size === 0) {
          this.organizationConnections.delete(connection.organizationId);
        }
      }
    }
    this.connections.delete(sessionId);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds
      
      this.connections.forEach((connection, sessionId) => {
        if (now - connection.lastPing > timeout) {
          console.log(`💀 Removing stale connection: ${sessionId}`);
          connection.ws.terminate();
          this.removeConnection(sessionId);
        } else {
          // Send ping
          if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.ping();
          }
        }
      });
    }, 15000); // Check every 15 seconds
  }

  private generateSessionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  public sendToClient(sessionId: string, message: WSMessage): boolean {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to ${sessionId}:`, error);
      return false;
    }
  }

  public sendToOrganization(organizationId: string, message: WSMessage): number {
    const sessionIds = this.organizationConnections.get(organizationId);
    if (!sessionIds) return 0;

    let sent = 0;
    sessionIds.forEach(sessionId => {
      if (this.sendToClient(sessionId, { ...message, organizationId })) {
        sent++;
      }
    });

    return sent;
  }

  public broadcastAIProgress(data: AIProgressData, organizationId?: string, sessionId?: string): void {
    const message: WSMessage = {
      type: 'ai_progress',
      data,
      timestamp: Date.now(),
      sessionId: sessionId || 'broadcast',
      organizationId,
    };

    if (sessionId) {
      this.sendToClient(sessionId, message);
    } else if (organizationId) {
      this.sendToOrganization(organizationId, message);
    } else {
      // Broadcast to all connections
      this.connections.forEach((_, sid) => {
        this.sendToClient(sid, message);
      });
    }
  }

  public broadcastAIComplete(result: any, organizationId?: string, sessionId?: string): void {
    const message: WSMessage = {
      type: 'ai_complete',
      data: result,
      timestamp: Date.now(),
      sessionId: sessionId || 'broadcast',
      organizationId,
    };

    if (sessionId) {
      this.sendToClient(sessionId, message);
    } else if (organizationId) {
      this.sendToOrganization(organizationId, message);
    }
  }

  public broadcastAIError(error: any, organizationId?: string, sessionId?: string): void {
    const message: WSMessage = {
      type: 'ai_error',
      data: { error: error.message || error, stack: error.stack },
      timestamp: Date.now(),
      sessionId: sessionId || 'broadcast',
      organizationId,
    };

    if (sessionId) {
      this.sendToClient(sessionId, message);
    } else if (organizationId) {
      this.sendToOrganization(organizationId, message);
    }
  }

  public broadcastCampaignUpdate(campaignId: string, updateData: any, organizationId: string): void {
    const message: WSMessage = {
      type: 'campaign_update',
      data: { campaignId, ...updateData },
      timestamp: Date.now(),
      sessionId: 'broadcast',
      organizationId,
    };

    this.sendToOrganization(organizationId, message);
  }

  public broadcastAnalyticsUpdate(analyticsData: any, organizationId: string): void {
    const message: WSMessage = {
      type: 'analytics_update',
      data: analyticsData,
      timestamp: Date.now(),
      sessionId: 'broadcast',
      organizationId,
    };

    this.sendToOrganization(organizationId, message);
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getOrganizationConnectionCount(organizationId: string): number {
    return this.organizationConnections.get(organizationId)?.size || 0;
  }

  public getConnectionStats(): {
    total: number;
    byOrganization: Record<string, number>;
    activeConnections: string[];
  } {
    const byOrganization: Record<string, number> = {};
    
    this.organizationConnections.forEach((sessionIds, orgId) => {
      byOrganization[orgId] = sessionIds.size;
    });

    return {
      total: this.connections.size,
      byOrganization,
      activeConnections: Array.from(this.connections.keys()),
    };
  }

  public close(): void {
    console.log('🔌 Closing WebSocket server...');
    this.wss.clients.forEach(ws => {
      ws.terminate();
    });
    this.wss.close();
    this.connections.clear();
    this.organizationConnections.clear();
  }
}

// Singleton instance
let wsServer: AIWebSocketServer | null = null;

export function getWebSocketServer(): AIWebSocketServer {
  if (!wsServer) {
    const port = parseInt(process.env.WS_PORT || '3001');
    wsServer = new AIWebSocketServer(port);
  }
  return wsServer;
}

export function initializeWebSocketServer(): AIWebSocketServer {
  return getWebSocketServer();
}