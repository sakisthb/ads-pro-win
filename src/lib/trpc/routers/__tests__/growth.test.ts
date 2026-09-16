/** @jest-environment node */

jest.mock("superjson", () => ({
  __esModule: true,
  default: {
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
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
    brand: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/organization-authorization", () => {
  class OrganizationAuthorizationError extends Error {
    constructor(status: 401 | 403 | 404, message: string) {
      super(message);
      this.name = "OrganizationAuthorizationError";
      this.status = status;
    }
    status: 401 | 403 | 404;
  }

  return {
    OrganizationAuthorizationError,
    organizationRoles: ["owner", "admin", "member", "viewer"],
    requireOrganizationRoleForUser: jest.fn(),
  };
});

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { growthRouter } from "@/lib/trpc/routers/growth";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireOrganizationRoleForUser = jest.mocked(
  requireOrganizationRoleForUser,
);

function membership(orgId: string) {
  return {
    organizationId: orgId,
    membership: {
      id: "membership-1",
      userId: "user-1",
      organizationId: orgId,
      role: "owner" as const,
      isDefault: true,
    },
  };
}

function createCaller() {
  return growthRouter.createCaller({
    session: { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" },
    prisma,
  });
}

describe("growth.desk router", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...env };
    mockedRequireOrganizationRoleForUser.mockResolvedValue(
      membership("org-1"),
    );
  });

  afterAll(() => {
    process.env = env;
  });

  it("keeps the Demo organization unlinked without reading a brand", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      slug: "demo",
    } as never);

    await expect(
      createCaller().desk({ brandId: "brand-1" }),
    ).resolves.toEqual({ status: "unlinked" });
    expect(mockedPrisma.brand.findFirst).not.toHaveBeenCalled();
  });

  it("fails closed in production when Growth Center origin is loopback", async () => {
    process.env.NODE_ENV = "production";
    process.env.SACOS_GROWTH_ORIGIN = "http://127.0.0.1:18806";
    process.env.SACOS_GROWTH_DESK_TOKEN = "t".repeat(32);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      slug: "kotman1979",
    } as never);
    mockedPrisma.brand.findFirst.mockResolvedValue({
      website: "https://bagtobag.com.gr",
      slug: "bagtobag",
    } as never);

    await expect(
      createCaller().desk({ brandId: "brand-1" }),
    ).resolves.toEqual({ status: "unlinked" });
  });

  it("returns BagToBag desk counts only from SACOS desk-summary", async () => {
    process.env.NODE_ENV = "production";
    process.env.SACOS_GROWTH_ORIGIN = "https://growth.example";
    process.env.SACOS_GROWTH_DESK_TOKEN = "t".repeat(32);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      slug: "kotman1979",
    } as never);
    mockedPrisma.brand.findFirst.mockResolvedValue({
      website: "https://bagtobag.com.gr",
      slug: "bagtobag",
    } as never);

    const fetchImpl = jest.fn(async (url: string) => {
      if (String(url).endsWith("/readyz")) {
        return { ok: true, json: async () => ({ status: "ready" }) };
      }
      return {
        ok: true,
        json: async () => ({
          site: "bagtobag_com_gr",
          imageIssues: 7,
          pendingDrafts: 1,
          lastAccepted: null,
        }),
      };
    });
    const previousFetch = global.fetch;
    global.fetch = fetchImpl as unknown as typeof fetch;

    try {
      const desk = await createCaller().desk({ brandId: "brand-1" });
      expect(desk).toMatchObject({
        status: "linked",
        siteId: "bagtobag_com_gr",
        hostname: "bagtobag.com.gr",
        origin: "https://growth.example",
        reachability: "reachable",
        catalogFacts: {
          imageIssues: 7,
          pendingDrafts: 1,
          lastAccepted: null,
        },
      });
      expect(desk).not.toHaveProperty("imageIssues");
    } finally {
      global.fetch = previousFetch;
    }
  });
});
