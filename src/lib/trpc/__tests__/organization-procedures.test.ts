import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  type OrganizationMembershipAuthorization,
} from "@/lib/organization-authorization";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
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

jest.mock("superjson", () => ({
  __esModule: true,
  default: {
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
  },
}));

import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationOwnerProcedure,
} from "@/lib/trpc/server";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireOrganizationRoleForUser = jest.mocked(requireOrganizationRoleForUser);
const adminResolver = jest.fn();
const ownerResolver = jest.fn();

const router = createTRPCRouter({
  admin: organizationAdminProcedure.query(({ ctx }) => {
    adminResolver();
    return { organizationId: ctx.organizationId };
  }),
  owner: organizationOwnerProcedure.query(({ ctx }) => {
    ownerResolver();
    return { organizationId: ctx.organizationId };
  }),
});

function authorization(role: OrganizationMembershipAuthorization["membership"]["role"]) {
  return {
    organizationId: "org-1",
    membership: {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      role,
      isDefault: true,
    },
  };
}

function createCaller(session: { user: { id: string }; expires: string } | null) {
  return router.createCaller({ session, prisma });
}

describe("organization tRPC procedures", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rejects unauthenticated callers before authorization or resolver execution", async () => {
    const caller = createCaller(null);

    await expect(caller.admin()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mockedRequireOrganizationRoleForUser).not.toHaveBeenCalled();
    expect(mockedPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(adminResolver).not.toHaveBeenCalled();
  });

  it("rejects non-members before organization lookup or resolver execution", async () => {
    mockedRequireOrganizationRoleForUser.mockRejectedValue(
      new OrganizationAuthorizationError(403, "Organization membership is required"),
    );
    const caller = createCaller({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(caller.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(adminResolver).not.toHaveBeenCalled();
  });

  it.each(["member", "viewer"] as const)(
    "rejects %s callers from admin procedures before the resolver runs",
    async (role) => {
      mockedRequireOrganizationRoleForUser.mockResolvedValue(authorization(role));
      mockedPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" } as never);
      const caller = createCaller({
        user: { id: "user-1" },
        expires: "2099-01-01T00:00:00.000Z",
      });

      await expect(caller.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(adminResolver).not.toHaveBeenCalled();
    },
  );

  it("allows admins through admin procedures but not owner procedures", async () => {
    mockedRequireOrganizationRoleForUser.mockResolvedValue(authorization("admin"));
    mockedPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" } as never);
    const caller = createCaller({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(caller.admin()).resolves.toEqual({ organizationId: "org-1" });
    await expect(caller.owner()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(adminResolver).toHaveBeenCalledTimes(1);
    expect(ownerResolver).not.toHaveBeenCalled();
  });

  it("allows owners through owner-only procedures", async () => {
    mockedRequireOrganizationRoleForUser.mockResolvedValue(authorization("owner"));
    mockedPrisma.organization.findUnique.mockResolvedValue({ id: "org-1" } as never);
    const caller = createCaller({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(caller.owner()).resolves.toEqual({ organizationId: "org-1" });
    expect(ownerResolver).toHaveBeenCalledTimes(1);
  });
});
