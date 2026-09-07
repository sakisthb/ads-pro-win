/**
 * @jest-environment node
 */

import WebSocket from "ws";

import {
  AIWebSocketServer,
  isWebSocketServerEnabled,
} from "../websocket/websocket-server";
import { consumeWebSocketTicket } from "../websocket/tickets";

jest.mock("@/lib/db", () => ({
  prisma: {},
}));

jest.mock("../websocket/tickets", () => ({
  consumeWebSocketTicket: jest.fn(),
  channelMatchesScope: jest.requireActual("../websocket/tickets").channelMatchesScope,
  WebSocketTicketError: jest.requireActual("../websocket/tickets").WebSocketTicketError,
}));

const mockedConsumeTicket = jest.mocked(consumeWebSocketTicket);

describe("WebSocket ticket-authenticated server", () => {
  let server: AIWebSocketServer;
  let port: number;

  beforeEach(() => {
    jest.clearAllMocks();
    port = 10000 + Math.floor(Math.random() * 10000);
  });

  afterEach((done) => {
    if (server) {
      server.close();
    }
    // Give the server socket time to release the port.
    setTimeout(done, 50);
  });

  it("is enabled in every environment after ticket authentication", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(isWebSocketServerEnabled()).toBe(true);
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("does not serialize error stacks to clients", () => {
    const sendToClient = jest.fn();
    const serverInstance = { sendToClient } as unknown as AIWebSocketServer;

    AIWebSocketServer.prototype.broadcastAIError.call(
      serverInstance,
      new Error("provider request failed"),
      undefined,
      "session-id",
    );

    const [, message] = sendToClient.mock.calls[0];
    expect(message.data).toEqual({ error: "provider request failed" });
    expect(message.data).not.toHaveProperty("stack");
  });

  it("accepts a connection when a valid ticket is presented", (done) => {
    mockedConsumeTicket.mockResolvedValue({
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations", "campaign_*"],
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    server = new AIWebSocketServer(port);

    const client = new WebSocket(`ws://localhost:${port}?ticket=valid-token`, {
      origin: `http://localhost:${port}`,
    });

    client.on("open", () => {
      expect(server.getConnectionCount()).toBe(1);
      expect(server.getOrganizationConnectionCount("org-1")).toBe(1);
      client.close();
      done();
    });

    client.on("error", (err) => done(err));
  });

  it("rejects a connection with an invalid ticket", (done) => {
    mockedConsumeTicket.mockRejectedValue(new Error("Invalid or missing ticket"));

    server = new AIWebSocketServer(port);

    const client = new WebSocket(`ws://localhost:${port}?ticket=bad-token`, {
      origin: `http://localhost:${port}`,
    });

    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      client.terminate();
      done(err);
    };

    client.on("open", () => {
      finish(new Error("Connection should not have opened"));
    });

    client.on("close", () => {
      expect(server.getConnectionCount()).toBe(0);
      finish();
    });

    client.on("error", () => {
      // Expected when the server rejects the WebSocket upgrade.
    });
  });

  it("rejects a connection with a disallowed origin", (done) => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    mockedConsumeTicket.mockResolvedValue({
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations"],
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    server = new AIWebSocketServer(port);

    const client = new WebSocket(`ws://localhost:${port}?ticket=valid-token`, {
      origin: "https://attacker.example.com",
    });

    let finished = false;
    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      process.env.NODE_ENV = originalNodeEnv;
      client.terminate();
      done(err);
    };

    client.on("open", () => {
      finish(new Error("Connection should not have opened"));
    });

    client.on("close", () => {
      expect(server.getConnectionCount()).toBe(0);
      finish();
    });

    client.on("error", () => {
      // Expected when the server rejects the WebSocket upgrade.
    });
  });

  it("rejects subscriptions outside the ticket channel scope", (done) => {
    mockedConsumeTicket.mockResolvedValue({
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations"],
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    server = new AIWebSocketServer(port);

    const client = new WebSocket(`ws://localhost:${port}?ticket=valid-token`, {
      origin: `http://localhost:${port}`,
    });

    client.on("open", () => {
      client.send(JSON.stringify({ type: "subscribe", channel: "analytics_updates" }));
    });

    client.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "ai_error") {
        expect(message.data).toEqual({ error: "Unauthorized channel" });
        client.close();
        done();
      }
    });

    client.on("error", (err) => done(err));
  });

  it("allows subscriptions within the ticket channel scope", (done) => {
    mockedConsumeTicket.mockResolvedValue({
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations", "campaign_*"],
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    server = new AIWebSocketServer(port);

    const client = new WebSocket(`ws://localhost:${port}?ticket=valid-token`, {
      origin: `http://localhost:${port}`,
    });

    client.on("open", () => {
      client.send(JSON.stringify({ type: "subscribe", channel: "campaign_123" }));
      client.send(JSON.stringify({ type: "ping" }));
    });

    client.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "ai_progress" && message.data?.message === "pong") {
        client.close();
        done();
      }
    });

    client.on("error", (err) => done(err));
  });
});
