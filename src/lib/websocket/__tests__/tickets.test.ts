import {
  channelMatchesScope,
  consumeWebSocketTicket,
  createWebSocketTicket,
  generateWebSocketTicketToken,
  isChannelPatternValid,
  normalizeChannelScope,
  WebSocketTicketError,
} from "../tickets";

const mockedPrisma = {
  webSocketTicket: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as Parameters<typeof createWebSocketTicket>[0];

describe("WebSocket ticket primitives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates unique raw tokens and SHA-256 digests", () => {
    const a = generateWebSocketTicketToken();
    const b = generateWebSocketTicketToken();

    expect(a.raw).not.toBe(b.raw);
    expect(a.digest).not.toBe(b.digest);
    expect(a.digest).not.toBe(a.raw);
    expect(a.digest).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("validates channel patterns and normalizes scope", () => {
    expect(isChannelPatternValid("ai_operations")).toBe(true);
    expect(isChannelPatternValid("campaign_*")).toBe(true);
    expect(isChannelPatternValid("channel with spaces")).toBe(false);
    expect(isChannelPatternValid("channel/../path")).toBe(false);

    expect(normalizeChannelScope(["ai_operations", "campaign_*", "bad channel", "ai_operations"]))
      .toEqual(["ai_operations", "campaign_*"]);
    expect(normalizeChannelScope(Array.from({ length: 20 }, (_, i) => `channel-${i}`))).toHaveLength(16);
  });

  it("matches literal and wildcard channel patterns", () => {
    const scope = ["ai_operations", "analytics_updates", "campaign_*"];

    expect(channelMatchesScope("ai_operations", scope)).toBe(true);
    expect(channelMatchesScope("campaign_123", scope)).toBe(true);
    expect(channelMatchesScope("campaign_", scope)).toBe(true);
    expect(channelMatchesScope("other_channel", scope)).toBe(false);
  });

  it("creates a ticket with the given channel scope and expiry", async () => {
    const createMock = jest.fn().mockResolvedValue({
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations"],
      consumedAt: null,
      expiresAt: new Date("2030-01-01"),
      createdAt: new Date(),
    });
    (mockedPrisma.webSocketTicket.create as jest.Mock) = createMock;

    const result = await createWebSocketTicket(mockedPrisma, {
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations"],
      expiresInMs: 120_000,
    });

    expect(result.rawToken).toBeDefined();
    expect(result.ticket.userId).toBe("user-1");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          organizationId: "org-1",
          channels: ["ai_operations"],
        }),
      }),
    );
  });

  it("rejects creation when no valid channels remain", async () => {
    await expect(
      createWebSocketTicket(mockedPrisma, {
        userId: "user-1",
        organizationId: "org-1",
        channels: ["bad channel"],
      }),
    ).rejects.toThrow("At least one valid channel pattern is required");
  });

  it("consumes a valid ticket exactly once", async () => {
    const ticketRow = {
      id: "ticket-1",
      tokenDigest: "digest",
      userId: "user-1",
      organizationId: "org-1",
      channels: ["ai_operations"],
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };

    const txMock = jest.fn().mockImplementation(async (callback: any) => {
      return callback({
        webSocketTicket: {
          findUnique: jest.fn().mockResolvedValue(ticketRow),
          update: jest.fn().mockResolvedValue({ ...ticketRow, consumedAt: new Date() }),
        },
      });
    });
    (mockedPrisma.$transaction as jest.Mock) = txMock;

    const { raw } = generateWebSocketTicketToken();
    const ticket = await consumeWebSocketTicket(mockedPrisma, raw);

    expect(ticket.userId).toBe("user-1");
    expect(txMock).toHaveBeenCalledTimes(1);
  });

  it("rejects missing or malformed tickets", async () => {
    await expect(consumeWebSocketTicket(mockedPrisma, "")).rejects.toBeInstanceOf(
      WebSocketTicketError,
    );
    await expect(consumeWebSocketTicket(mockedPrisma, null)).rejects.toMatchObject({
      code: "invalid_ticket",
    });
  });

  it("rejects consumed, expired, and unknown tickets", async () => {
    const makeTxMock = (overrides: Partial<typeof ticketRow>) => {
      const ticketRow = {
        id: "ticket-1",
        tokenDigest: "digest",
        userId: "user-1",
        organizationId: "org-1",
        channels: ["ai_operations"],
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        ...overrides,
      };
      return jest.fn().mockImplementation(async (callback: any) => {
        return callback({
          webSocketTicket: {
            findUnique: jest.fn().mockResolvedValue(ticketRow),
            update: jest.fn().mockResolvedValue({ ...ticketRow, consumedAt: new Date() }),
          },
        });
      });
    };

    const rawToken = generateWebSocketTicketToken().raw;

    (mockedPrisma.$transaction as jest.Mock) = makeTxMock({ consumedAt: new Date() });
    await expect(consumeWebSocketTicket(mockedPrisma, rawToken)).rejects.toMatchObject({
      code: "consumed",
    });

    (mockedPrisma.$transaction as jest.Mock) = makeTxMock({
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(consumeWebSocketTicket(mockedPrisma, rawToken)).rejects.toMatchObject({
      code: "expired",
    });

    (mockedPrisma.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback: any) => {
      return callback({
        webSocketTicket: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      });
    });
    await expect(consumeWebSocketTicket(mockedPrisma, rawToken)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
