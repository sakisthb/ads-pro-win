import { createHash, randomBytes } from "crypto";

import type { PrismaClient } from "@prisma/client";

export interface WebSocketTicketInput {
  userId: string;
  organizationId: string;
  channels: string[];
  expiresInMs?: number;
}

export interface WebSocketTicketData {
  id: string;
  tokenDigest: string;
  userId: string;
  organizationId: string;
  channels: string[];
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export class WebSocketTicketError extends Error {
  constructor(
    readonly code: "invalid_ticket" | "not_found" | "expired" | "consumed",
    message: string,
  ) {
    super(message);
    this.name = "WebSocketTicketError";
  }
}

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_MS = 60_000;
const MAX_CHANNELS = 16;
const CHANNEL_PATTERN = /^[a-zA-Z0-9_*-]+$/;

export function generateWebSocketTicketToken(): { raw: string; digest: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  const digest = createHash("sha256").update(raw).digest("base64url");
  return { raw, digest };
}

export function isChannelPatternValid(channel: string): boolean {
  return CHANNEL_PATTERN.test(channel);
}

export function normalizeChannelScope(channels: string[]): string[] {
  const normalized = Array.from(new Set(channels.filter(isChannelPatternValid)));
  return normalized.slice(0, MAX_CHANNELS);
}

export function channelMatchesScope(channel: string, scope: string[]): boolean {
  return scope.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(
        `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
      );
      return regex.test(channel);
    }
    return pattern === channel;
  });
}

export async function createWebSocketTicket(
  prisma: PrismaClient,
  input: WebSocketTicketInput,
): Promise<{ ticket: WebSocketTicketData; rawToken: string }> {
  const channels = normalizeChannelScope(input.channels);
  if (channels.length === 0) {
    throw new Error("At least one valid channel pattern is required");
  }

  const { raw, digest } = generateWebSocketTicketToken();
  const expiresAt = new Date(Date.now() + (input.expiresInMs ?? DEFAULT_EXPIRY_MS));

  const ticket = await prisma.webSocketTicket.create({
    data: {
      tokenDigest: digest,
      userId: input.userId,
      organizationId: input.organizationId,
      channels,
      expiresAt,
    },
  });

  return { ticket, rawToken: raw };
}

export async function consumeWebSocketTicket(
  prisma: PrismaClient,
  rawToken: string | undefined | null,
): Promise<WebSocketTicketData> {
  if (!rawToken || rawToken.length < 10) {
    throw new WebSocketTicketError("invalid_ticket", "Invalid ticket");
  }

  const digest = createHash("sha256").update(rawToken).digest("base64url");

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.webSocketTicket.findUnique({
      where: { tokenDigest: digest },
    });

    if (!row) {
      return { status: "not_found" as const };
    }

    if (row.consumedAt) {
      return { status: "consumed" as const, ticket: row };
    }

    if (row.expiresAt < new Date()) {
      return { status: "expired" as const, ticket: row };
    }

    const updated = await tx.webSocketTicket.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    return { status: "valid" as const, ticket: updated };
  });

  switch (result.status) {
    case "not_found":
      throw new WebSocketTicketError("not_found", "Invalid ticket");
    case "consumed":
      throw new WebSocketTicketError("consumed", "Ticket already used");
    case "expired":
      throw new WebSocketTicketError("expired", "Ticket expired");
    case "valid":
      return result.ticket;
  }
}
