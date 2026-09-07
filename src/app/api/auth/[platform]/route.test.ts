import { GET as startOAuth } from "@/app/api/auth/[platform]/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";

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
    oAuthTransaction: {
      create: jest.fn(),
    },
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

const mockedGetSession = jest.mocked(getSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireOrganizationRoleForUser = jest.mocked(
  requireOrganizationRoleForUser,
);

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

function request(platform: string, query = ""): Request {
  return new Request(`http://localhost:3000/api/auth/${platform}${query}`, {
    headers: { host: "localhost:3000" },
  });
}

describe("GET /api/auth/[platform]", () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
    mockedPrisma.oAuthTransaction.create.mockResolvedValue({ id: "tx-1" } as never);
  });

  it("returns 404 for an unknown platform", async () => {
    const response = await startOAuth(request("unknown"), {
      params: Promise.resolve({ platform: "unknown" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Unknown platform "unknown".' });
    expect(mockedPrisma.oAuthTransaction.create).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await startOAuth(request("meta"), {
      params: Promise.resolve({ platform: "meta" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.oAuthTransaction.create).not.toHaveBeenCalled();
  });

  it("returns 503 when the platform is not configured", async () => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;

    const response = await startOAuth(request("meta"), {
      params: Promise.resolve({ platform: "meta" }),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/Meta Ads is not configured/);
    expect(mockedPrisma.oAuthTransaction.create).not.toHaveBeenCalled();
  });

  it("creates a transaction and redirects to Meta with an opaque state", async () => {
    const response = await startOAuth(
      request("meta", "?return=/onboarding&brand=brand-1"),
      { params: Promise.resolve({ platform: "meta" }) },
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("Location") ?? "";
    expect(location.startsWith("https://www.facebook.com/")).toBe(true);
    const url = new URL(location);
    expect(url.searchParams.get("state")).toHaveLength(64);
    expect(url.searchParams.get("code_challenge")).toBeNull();

    const createData = mockedPrisma.oAuthTransaction.create.mock.calls[0][0].data;
    expect(createData.platform).toBe("meta");
    expect(createData.userId).toBe("user-1");
    expect(createData.organizationId).toBe("org-1");
    expect(createData.brandId).toBe("brand-1");
    expect(createData.returnPath).toBe("/onboarding");
  });

  it("creates a transaction and redirects to Google Ads with PKCE", async () => {
    const response = await startOAuth(request("google-ads"), {
      params: Promise.resolve({ platform: "google-ads" }),
    });

    expect(response.status).toBe(307);
    const location = response.headers.get("Location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("state")).toHaveLength(64);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const createData = mockedPrisma.oAuthTransaction.create.mock.calls[0][0].data;
    expect(createData.platform).toBe("google-ads");
    expect(createData.pkceCodeVerifier).toBeTruthy();
  });

  it("rejects an unauthorized brand selection", async () => {
    const { OrganizationAuthorizationError } = await import(
      "@/lib/organization-authorization"
    );
    mockedRequireOrganizationRoleForUser.mockRejectedValue(
      new OrganizationAuthorizationError(403, "Brand not found"),
    );

    const response = await startOAuth(request("meta", "?brand=other-brand"), {
      params: Promise.resolve({ platform: "meta" }),
    });

    expect(response.status).toBe(403);
    expect(mockedPrisma.oAuthTransaction.create).not.toHaveBeenCalled();
  });
});
