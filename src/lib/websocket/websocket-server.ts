// WebSocket Server for Real-Time AI Processing
// Provides live updates during AI operations

import type { IncomingMessage } from "http";

import { WebSocketServer, WebSocket } from "ws";

import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";

import {
  channelMatchesScope,
  consumeWebSocketTicket,
  WebSocketTicketError,
  type WebSocketTicketData,
} from "./tickets";

export interface WSMessage {
  type: "ai_progress" | "ai_complete" | "ai_error" | "campaign_update" | "analytics_update";
  data: any;
  timestamp: number;
  sessionId: string;
  organizationId?: string;
}

export interface AIProgressData {
  operationType: "analysis" | "optimization" | "generation";
  campaignId?: string;
  progress: number; // 0-100
  stage: string;
  message: string;
  confidence?: number;
}

export interface ClientConnection {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  organizationId: string;
  allowedChannels: string[];
  lastPing: number;
  subscriptions: Set<string>;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTIONS_PER_ORGANIZATION = 100;

interface VerifiedRequest extends IncomingMessage {
  wsTicket?: WebSocketTicketData;
}

function getAllowedOrigins(): string[] | null {
  const raw = process.env.WS_ALLOWED_ORIGINS;
  if (!raw) return null;
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : null;
}

function isOriginAllowed(
  origin: string | undefined,
  requestHost: string | undefined,
): boolean {
  if (!origin) {
    // Non-browser clients may omit Origin. Require it in production.
    return process.env.NODE_ENV !== "production";
  }

  const allowed = getAllowedOrigins();
  if (allowed) {
    return allowed.includes(origin);
  }

  // Same-origin fallback when no explicit allowlist is configured.
  if (!requestHost) {
    return false;
  }
  try {
    return new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

function parseTicketFromUrl(req: IncomingMessage): string | null {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  return url.searchParams.get("ticket");
}

export class AIWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<string, ClientConnection> = new Map();
  private organizationConnections: Map<string, Set<string>> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(port: number = 3001) {
    this.wss = new WebSocketServer({
      port,
      clientTracking: true,
      verifyClient: async (info, cb) => {
        const req = info.req as VerifiedRequest;
        const origin = req.headers.origin;
        const requestHost = req.headers.host;

        if (!isOriginAllowed(origin, requestHost)) {
          logSecurityEvent("ws_rejected", "warn", {
            code: "disallowed_origin",
            origin,
            host: requestHost,
          });
          cb(false, 1008, "Disallowed origin");
          return;
        }

        const rawTicket = parseTicketFromUrl(req);

        try {
          const ticket = await consumeWebSocketTicket(prisma, rawTicket);
          req.wsTicket = ticket;
          cb(true);
        } catch (error) {
          logSecurityEvent("ws_rejected", "warn", {
            code: error instanceof WebSocketTicketError ? error.code : "invalid_ticket",
            origin,
            message: error instanceof Error ? error.message : "Invalid or missing ticket",
          });
          cb(false, 1008, "Invalid or missing ticket");
        }
      },
    });

    this.setupEventHandlers();
    this.startHeartbeat();

    console.log(`WebSocket server running on port ${port}`);
  }

  private setupEventHandlers(): void {
    this.wss.on("connection", (ws: WebSocket, req: VerifiedRequest) => {
      this.handleConnection(ws, req).catch((error) => {
        console.error("Unexpected WebSocket connection error:", error);
        ws.terminate();
      });
    });

    this.wss.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
  }

  private async handleConnection(
    ws: WebSocket,
    req: VerifiedRequest,
  ): Promise<void> {
    const ticket = req.wsTicket;
    if (!ticket) {
      // This should not happen because verifyClient already validated the ticket,
      // but we keep the guard as a fail-safe.
      ws.close(1008, "Invalid or missing ticket");
      return;
    }

    if ((this.userConnections.get(ticket.userId)?.size ?? 0) >= MAX_CONNECTIONS_PER_USER) {
      logSecurityEvent("ws_rejected", "warn", {
        code: "user_connection_limit",
        userId: ticket.userId,
        organizationId: ticket.organizationId,
        count: this.userConnections.get(ticket.userId)?.size ?? 0,
      });
      ws.close(1008, "Connection limit reached");
      return;
    }

    if (
      (this.organizationConnections.get(ticket.organizationId)?.size ?? 0) >=
      MAX_CONNECTIONS_PER_ORGANIZATION
    ) {
      logSecurityEvent("ws_rejected", "warn", {
        code: "organization_connection_limit",
        userId: ticket.userId,
        organizationId: ticket.organizationId,
        count: this.organizationConnections.get(ticket.organizationId)?.size ?? 0,
      });
      ws.close(1008, "Organization connection limit reached");
      return;
    }

    const sessionId = this.generateSessionId();
    const connection: ClientConnection = {
      ws,
      sessionId,
      userId: ticket.userId,
      organizationId: ticket.organizationId,
      allowedChannels: ticket.channels,
      lastPing: Date.now(),
      subscriptions: new Set(),
    };

    this.connections.set(sessionId, connection);
    this.addToOrganizationIndex(sessionId, ticket.organizationId);
    this.addToUserIndex(sessionId, ticket.userId);

    console.log(
      `WebSocket client connected: ${sessionId} user=${ticket.userId} org=${ticket.organizationId}`,
    );

    this.sendToClient(sessionId, {
      type: "ai_progress",
      data: { message: "Connected to AI processing server", stage: "connected" },
      timestamp: Date.now(),
      sessionId,
      organizationId: ticket.organizationId,
    });

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(sessionId, message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log(`🔌 WebSocket client disconnected: ${sessionId}`);
      this.removeConnection(sessionId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for ${sessionId}:`, error);
      this.removeConnection(sessionId);
    });

    ws.on("pong", () => {
      const conn = this.connections.get(sessionId);
      if (conn) {
        conn.lastPing = Date.now();
      }
    });
  }

  private addToOrganizationIndex(sessionId: string, organizationId: string): void {
    let set = this.organizationConnections.get(organizationId);
    if (!set) {
      set = new Set();
      this.organizationConnections.set(organizationId, set);
    }
    set.add(sessionId);
  }

  private addToUserIndex(sessionId: string, userId: string): void {
    let set = this.userConnections.get(userId);
    if (!set) {
      set = new Set();
      this.userConnections.set(userId, set);
    }
    set.add(sessionId);
  }

  private handleClientMessage(sessionId: string, message: any): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    switch (message.type) {
      case "subscribe":
        if (message.channel) {
          if (!channelMatchesScope(message.channel, connection.allowedChannels)) {
            logSecurityEvent("ws_rejected", "warn", {
              code: "unauthorized_channel",
              userId: connection.userId,
              organizationId: connection.organizationId,
              channel: String(message.channel),
            });
            this.sendToClient(sessionId, {
              type: "ai_error",
              data: { error: "Unauthorized channel" },
              timestamp: Date.now(),
              sessionId,
              organizationId: connection.organizationId,
            });
            break;
          }
          connection.subscriptions.add(message.channel);
          console.log(`📡 Client ${sessionId} subscribed to ${message.channel}`);
        }
        break;

      case "unsubscribe":
        if (message.channel) {
          connection.subscriptions.delete(message.channel);
          console.log(`📡 Client ${sessionId} unsubscribed from ${message.channel}`);
        }
        break;

      case "ping":
        connection.lastPing = Date.now();
        this.sendToClient(sessionId, {
          type: "ai_progress",
          data: { message: "pong" },
          timestamp: Date.now(),
          sessionId,
          organizationId: connection.organizationId,
        });
        break;
    }
  }

  private removeConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      const orgConnections = this.organizationConnections.get(connection.organizationId);
      if (orgConnections) {
        orgConnections.delete(sessionId);
        if (orgConnections.size === 0) {
          this.organizationConnections.delete(connection.organizationId);
        }
      }

      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(sessionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }
    this.connections.delete(sessionId);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.connections.forEach((connection, sessionId) => {
        if (now - connection.lastPing > HEARTBEAT_TIMEOUT_MS) {
          console.log(`💀 Removing stale connection: ${sessionId}`);
          connection.ws.terminate();
          this.removeConnection(sessionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      });
    }, HEARTBEAT_INTERVAL_MS);
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
    sessionIds.forEach((sessionId) => {
      if (this.sendToClient(sessionId, { ...message, organizationId })) {
        sent++;
      }
    });

    return sent;
  }

  public broadcastAIProgress(
    data: AIProgressData,
    organizationId?: string,
    sessionId?: string,
  ): void {
    const message: WSMessage = {
      type: "ai_progress",
      data,
      timestamp: Date.now(),
      sessionId: sessionId || "broadcast",
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

  public broadcastAIComplete(
    result: any,
    organizationId?: string,
    sessionId?: string,
  ): void {
    const message: WSMessage = {
      type: "ai_complete",
      data: result,
      timestamp: Date.now(),
      sessionId: sessionId || "broadcast",
      organizationId,
    };

    if (sessionId) {
      this.sendToClient(sessionId, message);
    } else if (organizationId) {
      this.sendToOrganization(organizationId, message);
    }
  }

  public broadcastAIError(
    error: unknown,
    organizationId?: string,
    sessionId?: string,
  ): void {
    const message: WSMessage = {
      type: "ai_error",
      data: { error: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now(),
      sessionId: sessionId || "broadcast",
      organizationId,
    };

    if (sessionId) {
      this.sendToClient(sessionId, message);
    } else if (organizationId) {
      this.sendToOrganization(organizationId, message);
    }
  }

  public broadcastCampaignUpdate(
    campaignId: string,
    updateData: any,
    organizationId: string,
  ): void {
    const message: WSMessage = {
      type: "campaign_update",
      data: { campaignId, ...updateData },
      timestamp: Date.now(),
      sessionId: "broadcast",
      organizationId,
    };

    this.sendToOrganization(organizationId, message);
  }

  public broadcastAnalyticsUpdate(analyticsData: any, organizationId: string): void {
    const message: WSMessage = {
      type: "analytics_update",
      data: analyticsData,
      timestamp: Date.now(),
      sessionId: "broadcast",
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
    console.log("🔌 Closing WebSocket server...");
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    this.wss.clients.forEach((ws) => {
      ws.terminate();
    });
    this.wss.close();
    this.connections.clear();
    this.organizationConnections.clear();
    this.userConnections.clear();
  }
}

// Singleton instance
let wsServer: AIWebSocketServer | null = null;

export function isWebSocketServerEnabled(): boolean {
  // The server is now authenticated via short-lived tickets and is safe to run
  // in every environment. This function remains so callers can decide whether
  // to start a dedicated WebSocket process without changing shape.
  return true;
}

export function getWebSocketServer(): AIWebSocketServer | null {
  if (!wsServer) {
    const port = parseInt(process.env.WS_PORT || "3001", 10);
    wsServer = new AIWebSocketServer(port);
  }
  return wsServer;
}

export function initializeWebSocketServer(): AIWebSocketServer | null {
  return getWebSocketServer();
}
