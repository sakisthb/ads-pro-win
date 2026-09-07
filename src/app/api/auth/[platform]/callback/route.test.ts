/** @jest-environment node */
import { GET as callbackOAuth } from "@/app/api/auth/[platform]/callback/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { consumeOAuthTransaction, OAuthTransactionError } from "@/lib/oauth/oauth-transactions";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { safeFetch, safeFetchJson } from "@/lib/safe-fetch";

jest.mock("@/lib/safe-fetch", () => ({
  safeFetch: jest.fn(),
  safeFetchJson: jest.fn(),
  safeFetchText: jest.fn(),
  SafeFetchError: class extends Error {
    readonly code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = "SafeFetchError";
    }
  },
}));

const mockedSafeFetch = jest.mocked(safeFetch);
const mockedSafeFetchJson = jest.mocked(safeFetchJson);

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
    organization: {
      findUnique: jest.fn(),
    },
    adAccount: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn((value: string) => `enc:${value}`),
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

jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "OrganizationAuthorizationError";
    }
  },
  requireOrganizationRoleForUser: jest.fn(),
  requireOwnedBrand: jest.fn(),
}));

jest.mock("@/lib/meta/actions", () => ({
  META_GRAPH_VERSION: "v18.0",
}));

jest.mock("@/lib/ga4", () => ({
  ga4PendingAccountId: (brandId: string) => `ga4-pending-${brandId}`,
  ga4StoredAccountId: (brandId: string, id: string) => `ga4-${brandId}-${id}`,
  listGa4Properties: jest.fn(),
}));

jest.mock("@/lib/gsc", () => ({
  gscPendingAccountId: (brandId: string) => `gsc-pending-${brandId}`,
  gscStoredAccountId: (brandId: string, url: string) => `gsc-${brandId}-${url}`,
  listGscSites: jest.fn(),
  preferGscSite: jest.fn(),
}));

jest.mock("@/lib/google-ads-accounts", () => ({
  googleAdsPendingAccountId: (brandId: string) => `gads-pending-${brandId}`,
  googleAdsStoredAccountId: (brandId: string, id: string, loginId?: string) =>
    `gads-${brandId}-${id}-${loginId ?? "none"}`,
  listGoogleAdsCustomers: jest.fn(),
  preferGoogleAdsCustomer: jest.fn(),
}));

const mockedGetSession = jest.mocked(getSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedConsumeOAuthTransaction = jest.mocked(consumeOAuthTransaction);
const mockedRequireOrganizationRoleForUser = jest.mocked(
  requireOrganizationRoleForUser,
);
const mockedEncrypt = jest.mocked(encrypt);

function authz(organizationId = "org-1") {
  return {
    organizationId,
    membership: {
      id: "membership-1",
      userId: "user-1",
      organizationId,
      role: "owner",
      isDefault: true,
    },
  };
}

function callbackRequest(
  platform: string,
  state: string,
  extra: Record<string, string> = {},
): Request {
  const params = new URLSearchParams({ state, code: "auth-code", ...extra });
  return new Request(
    `http://localhost:3000/api/auth/${platform}/callback?${params.toString()}`,
    { headers: { host: "localhost:3000" } },
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/auth/[platform]/callback", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    // getOrigin() prefers NEXT_PUBLIC_SITE_URL; drop it so the origin comes
    // from the request URL and assertions hold in any environment (CI sets it).
    delete process.env.NEXT_PUBLIC_SITE_URL;
    mockedSafeFetch.mockResolvedValue(new Response("{}", { status: 500 }));
    mockedSafeFetchJson.mockResolvedValue({});
    process.env.FACEBOOK_APP_ID = "fb-app-id";
    process.env.FACEBOOK_APP_SECRET = "fb-app-secret";
    process.env.GOOGLE_ADS_CLIENT_ID = "ga-client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "ga-client-secret";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";

    mockedGetSession.mockResolvedValue({
      userId: "user-1",
      email: "owner@example.com",
      emailVerified: true,
    });
    mockedRequireOrganizationRoleForUser.mockResolvedValue(authz());
    mockedConsumeOAuthTransaction.mockResolvedValue({
      id: "tx-1",
      platform: "meta",
      userId: "user-1",
      organizationId: "org-1",
      brandId: null,
      returnPath: "/connections",
      codeVerifier: null,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalSiteUrl !== undefined) {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  it("redirects to login when unauthenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await callbackOAuth(
      callbackRequest("meta", "valid-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("http://localhost:3000/login");
  });

  it("redirects with invalid_state when the transaction is unknown", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError("not_found", "Invalid or unknown OAuth state"),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "tampered-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toMatch(
      /error=meta&reason=invalid_state/,
    );
  });

  it("redirects with invalid_state on a replayed/consumed transaction", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError("consumed", "OAuth state has already been used"),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "replayed-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(
      /reason=invalid_state/,
    );
  });

  it("redirects with invalid_state when the transaction expired", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError("expired", "OAuth state has expired"),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "expired-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/reason=invalid_state/);
  });

  it("redirects with invalid_state on platform mismatch", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError("platform_mismatch", "OAuth platform mismatch"),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "google-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/reason=invalid_state/);
  });

  it("redirects with invalid_state on user mismatch", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError("user_mismatch", "OAuth user mismatch"),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "other-user-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/reason=invalid_state/);
  });

  it("redirects with invalid_state on organization mismatch", async () => {
    mockedConsumeOAuthTransaction.mockRejectedValue(
      new OAuthTransactionError(
        "organization_mismatch",
        "OAuth organization mismatch",
      ),
    );

    const response = await callbackOAuth(
      callbackRequest("meta", "other-org-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/reason=invalid_state/);
  });

  it("redirects on missing authorization code", async () => {
    const response = await callbackOAuth(
      new Request(
        "http://localhost:3000/api/auth/meta/callback?state=valid-state",
        { headers: { host: "localhost:3000" } },
      ),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/error=meta(?!&reason)/);
  });

  it("redirects on provider error parameter", async () => {
    const response = await callbackOAuth(
      new Request(
        "http://localhost:3000/api/auth/meta/callback?state=valid-state&error=access_denied",
        { headers: { host: "localhost:3000" } },
      ),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(/error=meta/);
    expect(mockedConsumeOAuthTransaction).not.toHaveBeenCalled();
  });

  it("completes Meta OAuth and persists encrypted tokens", async () => {
    mockedSafeFetchJson
      .mockResolvedValueOnce({ access_token: "short-token" })
      .mockResolvedValueOnce({ access_token: "long-token", expires_in: 5_184_000 })
      .mockResolvedValueOnce({
        data: [
          { id: "act_123", name: "Test Brand", account_status: 1 },
        ],
      });

    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      brands: [
        {
          id: "brand-1",
          name: "Test Brand",
          website: "https://example.com",
          adAccounts: [],
        },
      ],
    });
    mockedPrisma.adAccount.create.mockResolvedValue({
      id: "ad-account-1",
      brandId: "brand-1",
      platform: "meta",
    });
    mockedPrisma.adAccount.update.mockResolvedValue({});

    const response = await callbackOAuth(
      callbackRequest("meta", "valid-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toMatch(/connected=meta/);
    expect(mockedSafeFetchJson).toHaveBeenCalledTimes(3);
    expect(mockedEncrypt).toHaveBeenCalledWith("long-token");
    expect(mockedPrisma.adAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: "enc:long-token",
          refreshToken: null,
          isActive: true,
        }),
      }),
    );
  });

  it("passes the stored code verifier to Google token exchange", async () => {
    mockedConsumeOAuthTransaction.mockResolvedValue({
      id: "tx-2",
      platform: "google-ads",
      userId: "user-1",
      organizationId: "org-1",
      brandId: "brand-1",
      returnPath: "/connections",
      codeVerifier: "test-verifier",
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
    });

    mockedSafeFetchJson.mockResolvedValue({
      access_token: "google-access-token",
      refresh_token: "google-refresh-token",
      expires_in: 3_600,
    });

    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      brands: [
        {
          id: "brand-1",
          name: "Test Brand",
          website: "https://example.com",
          adAccounts: [],
        },
      ],
    });
    mockedPrisma.adAccount.create.mockResolvedValue({
      id: "ad-account-2",
      brandId: "brand-1",
      platform: "google",
    });
    mockedPrisma.adAccount.update.mockResolvedValue({});

    const response = await callbackOAuth(
      callbackRequest("google-ads", "valid-state"),
      { params: Promise.resolve({ platform: "google-ads" }) },
    );

    expect(response.status).toBe(307);
    const [, options] = mockedSafeFetchJson.mock.calls[0];
    expect(String(options?.body)).toContain("code_verifier=test-verifier");
    expect(mockedEncrypt).toHaveBeenCalledWith("google-access-token");
    expect(mockedEncrypt).toHaveBeenCalledWith("google-refresh-token");
  });

  it("redirects to the transaction return path on success", async () => {
    mockedConsumeOAuthTransaction.mockResolvedValue({
      id: "tx-3",
      platform: "meta",
      userId: "user-1",
      organizationId: "org-1",
      brandId: null,
      returnPath: "/onboarding",
      codeVerifier: null,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
    });

    mockedSafeFetchJson
      .mockResolvedValueOnce({ access_token: "short-token" })
      .mockResolvedValueOnce({ access_token: "long-token", expires_in: 5_184_000 })
      .mockResolvedValueOnce({
        data: [
          { id: "act_123", name: "Test Brand", account_status: 1 },
        ],
      });

    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      brands: [
        {
          id: "brand-1",
          name: "Test Brand",
          website: "https://example.com",
          adAccounts: [],
        },
      ],
    });
    mockedPrisma.adAccount.create.mockResolvedValue({
      id: "ad-account-1",
      brandId: "brand-1",
      platform: "meta",
    });
    mockedPrisma.adAccount.update.mockResolvedValue({});

    const response = await callbackOAuth(
      callbackRequest("meta", "valid-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toContain("/onboarding?connected=meta");
  });

  it("redirects with error when the organization has no brands", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      brands: [],
    });

    const response = await callbackOAuth(
      callbackRequest("meta", "valid-state"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.headers.get("Location")).toMatch(
      /error=meta$/,
    );
  });
});
