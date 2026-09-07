/** @jest-environment node */
import type { NextRequest } from "next/server";
import { POST as postWooCommerce } from "@/app/api/connections/woocommerce/route";
import { POST as postOpenCart } from "@/app/api/connections/opencart/route";
import { POST as postBrevo } from "@/app/api/connections/brevo/route";
import { POST as postOmnisend } from "@/app/api/connections/omnisend/route";
import { POST as postSync } from "@/app/api/sync/[platform]/route";
import { GET as startOAuth } from "@/app/api/auth/[platform]/route";
import { GET as completeOAuth } from "@/app/api/auth/[platform]/callback/route";
import { getSession } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";
import { consumeOAuthTransaction } from "@/lib/oauth/oauth-transactions";
import { testWooCommerceConnection } from "@/lib/woocommerce-rest";
import {
  fetchMetaAccountData,
  fetchGoogleMetrics,
  fetchTikTokMetrics,
  fetchOmnisendData,
  fetchBrevoData,
  persistWooCommerceSync,
  fetchOpenCartData,
  upsertDailyMetrics,
  upsertAdCampaigns,
  upsertWooOrders,
  upsertWooProducts,
  cleanupAccountLevelRows,
} from "@/lib/sync/fetchers";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
    redirect: (url: string, status = 307) =>
      new Response(null, { status, headers: { Location: url } }),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    adAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    syncJob: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

jest.mock("@/lib/oauth/oauth-transactions", () => ({
  consumeOAuthTransaction: jest.fn(),
  OAuthTransactionError: class extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "OAuthTransactionError";
    }
  },
}));

jest.mock("@/lib/organization-authorization", () => {
  const actual = jest.requireActual<typeof import("@/lib/organization-authorization")>(
    "@/lib/organization-authorization",
  );

  return {
    ...actual,
    requireOrganizationRoleForUser: jest.fn(),
    requireOwnedBrand: jest.fn(),
  };
});

jest.mock("@/lib/woocommerce-rest", () => ({
  testWooCommerceConnection: jest.fn(),
}));

jest.mock("@/lib/sync/fetchers", () => ({
  fetchMetaAccountData: jest.fn(),
  fetchGoogleMetrics: jest.fn(),
  fetchTikTokMetrics: jest.fn(),
  fetchOmnisendData: jest.fn(),
  fetchBrevoData: jest.fn(),
  persistWooCommerceSync: jest.fn(),
  fetchOpenCartData: jest.fn(),
  upsertDailyMetrics: jest.fn(),
  upsertAdCampaigns: jest.fn(),
  upsertWooOrders: jest.fn(),
  upsertWooProducts: jest.fn(),
  cleanupAccountLevelRows: jest.fn(),
}));

jest.mock("@/lib/meta/actions", () => ({
  defaultSyncLookbackDays: jest.fn(() => 30),
}));

jest.mock("@/lib/woo-orders", () => ({
  costMapFromProducts: jest.fn(),
}));

jest.mock("@/lib/ga4", () => ({
  fetchGa4Metrics: jest.fn(),
  isGa4PropertyReady: jest.fn(),
  parseGa4PropertyId: jest.fn(),
}));

jest.mock("@/lib/gsc", () => ({
  fetchGscMetrics: jest.fn(),
  isGscSiteReady: jest.fn(),
  parseGscSiteUrl: jest.fn(),
}));

jest.mock("@/lib/google-ads-accounts", () => ({
  isGoogleAdsAccountReady: jest.fn(),
}));

jest.mock("@/lib/oauth/google-refresh", () => ({
  ensureFreshGoogleAccessToken: jest.fn(),
}));

const mockedGetSession = jest.mocked(getSession);
const mockedEncrypt = jest.mocked(encrypt);
const mockedDecrypt = jest.mocked(decrypt);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireOrganizationRoleForUser = jest.mocked(requireOrganizationRoleForUser);
const mockedRequireOwnedBrand = jest.mocked(requireOwnedBrand);
const mockedConsumeOAuthTransaction = jest.mocked(consumeOAuthTransaction);
const mockedTestWooCommerceConnection = jest.mocked(testWooCommerceConnection);
const mockedFetchMetaAccountData = jest.mocked(fetchMetaAccountData);
const mockedFetchGoogleMetrics = jest.mocked(fetchGoogleMetrics);
const mockedFetchTikTokMetrics = jest.mocked(fetchTikTokMetrics);
const mockedFetchOmnisendData = jest.mocked(fetchOmnisendData);
const mockedFetchBrevoData = jest.mocked(fetchBrevoData);
const mockedPersistWooCommerceSync = jest.mocked(persistWooCommerceSync);
const mockedFetchOpenCartData = jest.mocked(fetchOpenCartData);
const mockedUpsertDailyMetrics = jest.mocked(upsertDailyMetrics);
const mockedUpsertAdCampaigns = jest.mocked(upsertAdCampaigns);
const mockedUpsertWooOrders = jest.mocked(upsertWooOrders);
const mockedUpsertWooProducts = jest.mocked(upsertWooProducts);
const mockedCleanupAccountLevelRows = jest.mocked(cleanupAccountLevelRows);

const authorization = {
  organizationId: "org-1",
  membership: {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    role: "admin" as const,
    isDefault: true,
  },
};

const originalFetch = global.fetch;
const mockedFetch = jest.fn();

function request(body: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function expectNoSensitiveActivity() {
  expect(mockedFetch).not.toHaveBeenCalled();
  expect(mockedEncrypt).not.toHaveBeenCalled();
  expect(mockedDecrypt).not.toHaveBeenCalled();
  expect(mockedPrisma.adAccount.findFirst).not.toHaveBeenCalled();
  expect(mockedPrisma.adAccount.update).not.toHaveBeenCalled();
  expect(mockedPrisma.adAccount.create).not.toHaveBeenCalled();
  expect(mockedPrisma.syncJob.create).not.toHaveBeenCalled();
  expect(mockedPrisma.syncJob.update).not.toHaveBeenCalled();
}

function expectNoSyncProviderActivity() {
  expect(mockedFetchMetaAccountData).not.toHaveBeenCalled();
  expect(mockedFetchGoogleMetrics).not.toHaveBeenCalled();
  expect(mockedFetchTikTokMetrics).not.toHaveBeenCalled();
  expect(mockedFetchOmnisendData).not.toHaveBeenCalled();
  expect(mockedFetchBrevoData).not.toHaveBeenCalled();
  expect(mockedPersistWooCommerceSync).not.toHaveBeenCalled();
  expect(mockedFetchOpenCartData).not.toHaveBeenCalled();
  expect(mockedUpsertDailyMetrics).not.toHaveBeenCalled();
  expect(mockedUpsertAdCampaigns).not.toHaveBeenCalled();
  expect(mockedUpsertWooOrders).not.toHaveBeenCalled();
  expect(mockedUpsertWooProducts).not.toHaveBeenCalled();
  expect(mockedCleanupAccountLevelRows).not.toHaveBeenCalled();
}

const protectedRoutes: Array<[string, () => Promise<Response>]> = [
  [
    "WooCommerce connection",
    () =>
      postWooCommerce(
        request({
          brandId: "other-org-brand",
          storeUrl: "https://store.example.com",
          consumerKey: "consumer-key",
          consumerSecret: "consumer-secret",
        }),
      ),
  ],
  [
    "OpenCart connection",
    () =>
      postOpenCart(
        request({
          brandId: "other-org-brand",
          storeUrl: "https://store.example.com",
          username: "api-user",
          apiKey: "api-key",
        }),
      ),
  ],
  [
    "Brevo connection",
    () => postBrevo(request({ brandId: "other-org-brand", apiKey: "brevo-api-key" })),
  ],
  [
    "Omnisend connection",
    () => postOmnisend(request({ brandId: "other-org-brand", apiKey: "omnisend-api-key" })),
  ],
  [
    "sync",
    () =>
      postSync(request({ brandId: "other-org-brand" }), {
        params: Promise.resolve({ platform: "woocommerce" }),
      }),
  ],
];

describe("connection and sync authorization boundaries", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockedFetch;
    mockedGetSession.mockResolvedValue({ userId: "user-1" });
    mockedRequireOrganizationRoleForUser.mockResolvedValue(authorization);
    mockedRequireOwnedBrand.mockRejectedValue(
      new OrganizationAuthorizationError(404, "Brand not found"),
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("rejects unauthenticated OAuth initiation before creating a provider redirect", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await startOAuth(new Request("http://localhost/api/auth/meta"), {
      params: Promise.resolve({ platform: "meta" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockedRequireOrganizationRoleForUser).not.toHaveBeenCalled();
    expectNoSensitiveActivity();
  });

  it("rejects member OAuth initiation before creating a provider redirect", async () => {
    mockedRequireOrganizationRoleForUser.mockRejectedValue(
      new OrganizationAuthorizationError(403, "Insufficient organization permissions"),
    );

    const response = await startOAuth(new Request("http://localhost/api/auth/meta"), {
      params: Promise.resolve({ platform: "meta" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Insufficient organization permissions" });
    expect(mockedRequireOwnedBrand).not.toHaveBeenCalled();
    expectNoSensitiveActivity();
  });

  it("rejects a cross-organization OAuth initiation before creating a provider redirect", async () => {
    mockedRequireOwnedBrand.mockRejectedValue(
      new OrganizationAuthorizationError(404, "Brand not found"),
    );

    const response = await startOAuth(
      new Request("http://localhost/api/auth/meta?brand=other-org-brand"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Brand not found" });
    expectNoSensitiveActivity();
  });

  it("rejects an unauthenticated OAuth callback before code exchange", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await completeOAuth(
      new Request("http://localhost/api/auth/meta/callback?code=provider-code&state=meta"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(mockedRequireOrganizationRoleForUser).not.toHaveBeenCalled();
    expectNoSensitiveActivity();
    expectNoSyncProviderActivity();
  });

  it("rejects member OAuth callbacks before code exchange", async () => {
    mockedRequireOrganizationRoleForUser.mockRejectedValue(
      new OrganizationAuthorizationError(403, "Insufficient organization permissions"),
    );

    const response = await completeOAuth(
      new Request("http://localhost/api/auth/meta/callback?code=provider-code&state=meta"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("reason=authorization");
    expect(mockedRequireOwnedBrand).not.toHaveBeenCalled();
    expectNoSensitiveActivity();
    expectNoSyncProviderActivity();
  });

  it("rejects cross-organization OAuth callbacks before code exchange", async () => {
    mockedRequireOwnedBrand.mockRejectedValue(
      new OrganizationAuthorizationError(404, "Brand not found"),
    );
    mockedConsumeOAuthTransaction.mockResolvedValue({
      id: "tx-cross-org",
      platform: "meta",
      userId: "user-1",
      organizationId: "org-1",
      brandId: "other-org-brand",
      returnPath: "/connections",
      codeVerifier: null,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
    });

    const response = await completeOAuth(
      new Request(
        "http://localhost/api/auth/meta/callback?code=provider-code&state=opaque-transaction-state",
      ),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("reason=authorization");
    expectNoSensitiveActivity();
    expectNoSyncProviderActivity();
  });

  for (const [name, invoke] of protectedRoutes) {
    it(`rejects unauthenticated ${name} requests before sensitive activity`, async () => {
      mockedGetSession.mockResolvedValue(null);

      const response = await invoke();

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ success: false, error: "Unauthorized" });
      expect(mockedRequireOrganizationRoleForUser).not.toHaveBeenCalled();
      expect(mockedRequireOwnedBrand).not.toHaveBeenCalled();
      expectNoSensitiveActivity();
      expectNoSyncProviderActivity();
    });

    it(`rejects member ${name} requests before tenant access`, async () => {
      mockedRequireOrganizationRoleForUser.mockRejectedValue(
        new OrganizationAuthorizationError(403, "Insufficient organization permissions"),
      );

      const response = await invoke();

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        success: false,
        error: "Insufficient organization permissions",
      });
      expect(mockedRequireOwnedBrand).not.toHaveBeenCalled();
      expectNoSensitiveActivity();
      expectNoSyncProviderActivity();
    });
  }

  it("rejects a cross-organization WooCommerce connection before provider access", async () => {
    const response = await postWooCommerce(
      request({
        brandId: "other-org-brand",
        storeUrl: "https://store.example.com",
        consumerKey: "consumer-key",
        consumerSecret: "consumer-secret",
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Brand not found" });
    expect(mockedTestWooCommerceConnection).not.toHaveBeenCalled();
    expectNoSensitiveActivity();
  });

  it("rejects a cross-organization OpenCart connection before provider access", async () => {
    const response = await postOpenCart(
      request({
        brandId: "other-org-brand",
        storeUrl: "https://store.example.com",
        username: "api-user",
        apiKey: "api-key",
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Brand not found" });
    expectNoSensitiveActivity();
  });

  it("rejects a cross-organization Brevo connection before provider access", async () => {
    const response = await postBrevo(
      request({ brandId: "other-org-brand", apiKey: "brevo-api-key" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Brand not found" });
    expectNoSensitiveActivity();
  });

  it("rejects a cross-organization Omnisend connection before provider access", async () => {
    const response = await postOmnisend(
      request({ brandId: "other-org-brand", apiKey: "omnisend-api-key" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Brand not found" });
    expectNoSensitiveActivity();
  });

  it("rejects a cross-organization sync before credentials, accounts, or providers", async () => {
    const response = await postSync(
      request({ brandId: "other-org-brand" }),
      { params: Promise.resolve({ platform: "woocommerce" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Brand not found" });
    expectNoSensitiveActivity();
    expectNoSyncProviderActivity();
  });
});
