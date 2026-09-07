/**
 * Server-side OAuth transaction/state management.
 *
 * Every OAuth initiation creates a single-use, expiring transaction bound to
 * the authenticated user, organization, and allowed brand. The opaque state
 * token sent to the provider is only stored as a SHA-256 digest, so a leaked
 * database cannot be used to replay an OAuth round-trip.
 *
 * Google platforms use PKCE (S256). Meta and TikTok do not include PKCE in
 * the authorization URL because their documented flows do not require it.
 */

import { createHash, randomBytes } from "node:crypto";
import { oauthReturnPath, type OAuthPlatform } from "./platforms";
import type { PrismaClient, OAuthTransaction } from "@prisma/client";

type PrismaOAuthClient = Pick<PrismaClient, "oAuthTransaction" | "$transaction">;
type PrismaOAuthCreateClient = Pick<PrismaClient, "oAuthTransaction">;

const TRANSACTION_TTL_MS = 10 * 60 * 1000;

export interface OAuthTransactionInput {
  platform: OAuthPlatform;
  userId: string;
  organizationId: string;
  brandId?: string | null;
  returnPath?: string | null;
}

export interface OAuthTransactionInit {
  rawState: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface ResolvedOAuthTransaction {
  id: string;
  platform: OAuthPlatform;
  userId: string;
  organizationId: string;
  brandId: string | null;
  returnPath: string;
  codeVerifier: string | null;
  consumedAt: Date | null;
  expiresAt: Date;
}

export class OAuthTransactionError extends Error {
  constructor(
    readonly code:
      | "invalid_state"
      | "not_found"
      | "expired"
      | "consumed"
      | "platform_mismatch"
      | "user_mismatch"
      | "organization_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "OAuthTransactionError";
  }
}

export function supportsOAuthPKCE(platform: OAuthPlatform): boolean {
  return (
    platform === "google-ads" ||
    platform === "google-analytics" ||
    platform === "google-search-console"
  );
}

export function generateOAuthStateToken(): { raw: string; digest: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, digest: createHash("sha256").update(raw).digest("hex") };
}

function base64urlEncode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function createPKCE(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
} {
  const codeVerifier = base64urlEncode(randomBytes(32));
  const codeChallenge = base64urlEncode(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export async function createOAuthTransaction(
  prisma: PrismaOAuthCreateClient,
  input: OAuthTransactionInput,
): Promise<OAuthTransactionInit> {
  const returnPath = oauthReturnPath(input.returnPath);
  const { raw, digest } = generateOAuthStateToken();
  const usePkce = supportsOAuthPKCE(input.platform);
  const pkce = usePkce ? createPKCE() : null;

  await prisma.oAuthTransaction.create({
    data: {
      stateDigest: digest,
      platform: input.platform,
      userId: input.userId,
      organizationId: input.organizationId,
      brandId: input.brandId ?? null,
      returnPath,
      pkceCodeVerifier: pkce?.codeVerifier ?? null,
      expiresAt: new Date(Date.now() + TRANSACTION_TTL_MS),
    },
  });

  return {
    rawState: raw,
    codeChallenge: pkce?.codeChallenge,
    codeChallengeMethod: pkce?.codeChallengeMethod,
  };
}

function digestFromRawState(rawState: string): string {
  return createHash("sha256").update(rawState).digest("hex");
}

export async function consumeOAuthTransaction(
  prisma: PrismaOAuthClient,
  rawState: string,
  constraints: {
    platform: OAuthPlatform;
    userId: string;
    organizationId: string;
  },
): Promise<ResolvedOAuthTransaction> {
  const digest = digestFromRawState(rawState);

  type ConsumeResult =
    | { status: "valid"; row: OAuthTransaction }
    | { status: "consumed"; row: OAuthTransaction }
    | { status: "expired"; row: OAuthTransaction }
    | null;

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.oAuthTransaction.findUnique({
      where: { stateDigest: digest },
    });
    if (!row) return null;
    if (row.consumedAt) return { status: "consumed", row };
    if (row.expiresAt < new Date()) return { status: "expired", row };

    const updated = await tx.oAuthTransaction.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return { status: "valid", row: updated };
  });

  if (!result) {
    throw new OAuthTransactionError("not_found", "Invalid or unknown OAuth state");
  }

  if (result.status === "consumed") {
    throw new OAuthTransactionError("consumed", "OAuth state has already been used");
  }

  if (result.status === "expired") {
    throw new OAuthTransactionError("expired", "OAuth state has expired");
  }

  const transaction = result.row;

  if (transaction.platform !== constraints.platform) {
    throw new OAuthTransactionError("platform_mismatch", "OAuth platform mismatch");
  }

  if (transaction.userId !== constraints.userId) {
    throw new OAuthTransactionError("user_mismatch", "OAuth user mismatch");
  }

  if (transaction.organizationId !== constraints.organizationId) {
    throw new OAuthTransactionError(
      "organization_mismatch",
      "OAuth organization mismatch",
    );
  }

  return {
    id: transaction.id,
    platform: transaction.platform as OAuthPlatform,
    userId: transaction.userId,
    organizationId: transaction.organizationId,
    brandId: transaction.brandId,
    returnPath: transaction.returnPath,
    codeVerifier: transaction.pkceCodeVerifier,
    consumedAt: transaction.consumedAt,
    expiresAt: transaction.expiresAt,
  };
}
