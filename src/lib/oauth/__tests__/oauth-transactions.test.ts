import {
  createOAuthTransaction,
  consumeOAuthTransaction,
  generateOAuthStateToken,
  createPKCE,
  supportsOAuthPKCE,
  OAuthTransactionError,
} from "@/lib/oauth/oauth-transactions";
import type { OAuthTransaction } from "@prisma/client";

function createMockPrisma(
  overrides: Partial<{
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    $transaction: jest.Mock;
  }> = {},
) {
  const findUnique = overrides.findUnique ?? jest.fn();
  const create = overrides.create ?? jest.fn();
  const update =
    overrides.update ??
    jest.fn(async (args: { where: { id: string }; data: { consumedAt: Date } }) => {
      const rowResult = findUnique.mock.results[findUnique.mock.results.length - 1];
      const row = rowResult?.value instanceof Promise ? await rowResult.value : rowResult?.value;
      return { ...row, id: args.where.id, consumedAt: args.data.consumedAt };
    });
  const $transaction =
    overrides.$transaction ??
    jest.fn(async (callback) => callback({ oAuthTransaction: { findUnique, update } }));

  return {
    oAuthTransaction: { findUnique, create, update },
    $transaction,
  };
}

describe("oauth transaction helpers", () => {
  describe("generateOAuthStateToken", () => {
    it("produces a 64-character raw token and a different 64-character digest", () => {
      const { raw, digest } = generateOAuthStateToken();
      expect(raw).toHaveLength(64);
      expect(digest).toHaveLength(64);
      expect(raw).not.toBe(digest);
    });
  });

  describe("createPKCE", () => {
    it("produces S256 verifier and challenge", () => {
      const pkce = createPKCE();
      expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.codeChallengeMethod).toBe("S256");
      expect(pkce.codeVerifier).not.toBe(pkce.codeChallenge);
    });
  });

  describe("supportsOAuthPKCE", () => {
    it("returns true for Google platforms", () => {
      expect(supportsOAuthPKCE("google-ads")).toBe(true);
      expect(supportsOAuthPKCE("google-analytics")).toBe(true);
      expect(supportsOAuthPKCE("google-search-console")).toBe(true);
    });

    it("returns false for Meta and TikTok", () => {
      expect(supportsOAuthPKCE("meta")).toBe(false);
      expect(supportsOAuthPKCE("tiktok")).toBe(false);
    });
  });

  describe("createOAuthTransaction", () => {
    it("stores a digest and PKCE verifier for Google platforms", async () => {
      const prisma = createMockPrisma();
      prisma.oAuthTransaction.create.mockResolvedValue({} as never);

      const result = await createOAuthTransaction(prisma, {
        platform: "google-ads",
        userId: "user-1",
        organizationId: "org-1",
        brandId: "brand-1",
        returnPath: "/onboarding",
      });

      expect(result.rawState).toHaveLength(64);
      expect(result.codeChallenge).toBeDefined();
      expect(result.codeChallengeMethod).toBe("S256");
      const createData = prisma.oAuthTransaction.create.mock.calls[0][0].data;
      expect(createData.stateDigest).toHaveLength(64);
      expect(createData.stateDigest).not.toBe(result.rawState);
      expect(createData.platform).toBe("google-ads");
      expect(createData.userId).toBe("user-1");
      expect(createData.organizationId).toBe("org-1");
      expect(createData.brandId).toBe("brand-1");
      expect(createData.returnPath).toBe("/onboarding");
      expect(createData.pkceCodeVerifier).toBeTruthy();
      expect(createData.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("stores no PKCE verifier for Meta", async () => {
      const prisma = createMockPrisma();
      prisma.oAuthTransaction.create.mockResolvedValue({} as never);

      const result = await createOAuthTransaction(prisma, {
        platform: "meta",
        userId: "user-1",
        organizationId: "org-1",
      });

      expect(result.codeChallenge).toBeUndefined();
      const createData = prisma.oAuthTransaction.create.mock.calls[0][0].data;
      expect(createData.pkceCodeVerifier).toBeNull();
    });

    it("falls back to /connections for unknown return paths", async () => {
      const prisma = createMockPrisma();
      prisma.oAuthTransaction.create.mockResolvedValue({} as never);

      await createOAuthTransaction(prisma, {
        platform: "meta",
        userId: "user-1",
        organizationId: "org-1",
        returnPath: "https://evil.example/",
      });

      expect(prisma.oAuthTransaction.create.mock.calls[0][0].data.returnPath).toBe(
        "/connections",
      );
    });
  });

  describe("consumeOAuthTransaction", () => {
    function pendingTransaction(
      overrides: Partial<OAuthTransaction> = {},
    ): OAuthTransaction {
      return {
        id: "tx-1",
        stateDigest: "digest",
        platform: "meta",
        userId: "user-1",
        organizationId: "org-1",
        brandId: null,
        returnPath: "/connections",
        pkceCodeVerifier: null,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 600_000),
        createdAt: new Date(),
        ...overrides,
      } as OAuthTransaction;
    }

    it("consumes a valid transaction and returns its metadata", async () => {
      const row = pendingTransaction();
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, consumedAt: new Date() }),
      });

      const result = await consumeOAuthTransaction(prisma, "raw-state", {
        platform: "meta",
        userId: "user-1",
        organizationId: "org-1",
      });

      expect(result.platform).toBe("meta");
      expect(result.consumedAt).not.toBeNull();
      expect(prisma.oAuthTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tx-1" },
          data: { consumedAt: expect.any(Date) },
        }),
      );
    });

    it("rejects an unknown state", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(null),
      });

      await expect(
        consumeOAuthTransaction(prisma, "unknown", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toThrow(OAuthTransactionError);
    });

    it("rejects an already consumed state", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(
          pendingTransaction({ consumedAt: new Date() }),
        ),
      });

      await expect(
        consumeOAuthTransaction(prisma, "raw-state", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({ code: "consumed" });
    });

    it("rejects an expired state", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(
          pendingTransaction({ expiresAt: new Date(Date.now() - 1) }),
        ),
      });

      await expect(
        consumeOAuthTransaction(prisma, "raw-state", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({ code: "expired" });
    });

    it("rejects platform mismatch", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(pendingTransaction({ platform: "tiktok" })),
      });

      await expect(
        consumeOAuthTransaction(prisma, "raw-state", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({ code: "platform_mismatch" });
    });

    it("rejects user mismatch", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(pendingTransaction({ userId: "user-2" })),
      });

      await expect(
        consumeOAuthTransaction(prisma, "raw-state", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({ code: "user_mismatch" });
    });

    it("rejects organization mismatch", async () => {
      const prisma = createMockPrisma({
        findUnique: jest.fn().mockResolvedValue(
          pendingTransaction({ organizationId: "org-2" }),
        ),
      });

      await expect(
        consumeOAuthTransaction(prisma, "raw-state", {
          platform: "meta",
          userId: "user-1",
          organizationId: "org-1",
        }),
      ).rejects.toMatchObject({ code: "organization_mismatch" });
    });
  });
});
