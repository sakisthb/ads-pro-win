import {
  OrganizationAuthorizationError,
  requireOrganizationRole,
  requireOwnedBrand,
} from "@/lib/organization-authorization";
import { getActiveOrgId } from "@/lib/active-org";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/active-org", () => ({
  getActiveOrgId: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    organizationMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    brand: {
      findFirst: jest.fn(),
    },
  },
}));

const mockedGetActiveOrgId = jest.mocked(getActiveOrgId);
const mockedGetSession = jest.mocked(getSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

const membership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  role: "admin",
  isDefault: true,
};

describe("organization authorization", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGetSession.mockResolvedValue({ userId: "user-1" });
    mockedGetActiveOrgId.mockResolvedValue("org-1");
  });

  it("rejects unauthenticated callers before querying membership", async () => {
    mockedGetSession.mockResolvedValue(null);

    await expect(requireOrganizationRole(["admin", "owner"])).rejects.toMatchObject({
      status: 401,
      message: "Unauthorized",
    });
    expect(mockedPrisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it("denies unrecognized membership roles", async () => {
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue({
      ...membership,
      role: "operator",
    });

    await expect(requireOrganizationRole(["admin", "owner"])).rejects.toMatchObject({
      status: 403,
      message: "Organization role is not recognized",
    });
  });

  it("denies members from admin-only operations", async () => {
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue({
      ...membership,
      role: "member",
    });

    await expect(requireOrganizationRole(["admin", "owner"])).rejects.toMatchObject({
      status: 403,
      message: "Insufficient organization permissions",
    });
  });

  it("only resolves brands in the authorized organization", async () => {
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue(membership);
    mockedPrisma.brand.findFirst.mockResolvedValue(null);
    const authorization = await requireOrganizationRole(["admin", "owner"]);

    await expect(requireOwnedBrand(authorization, "other-org-brand")).rejects.toBeInstanceOf(
      OrganizationAuthorizationError,
    );
    expect(mockedPrisma.brand.findFirst).toHaveBeenCalledWith({
      where: { id: "other-org-brand", organizationId: "org-1" },
    });
  });

  it("returns an owned brand for an authorized admin", async () => {
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue(membership);
    mockedPrisma.brand.findFirst.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      name: "Owned brand",
      slug: "owned-brand",
    });
    const authorization = await requireOrganizationRole(["admin", "owner"]);

    await expect(requireOwnedBrand(authorization, "brand-1")).resolves.toMatchObject({
      id: "brand-1",
      organizationId: "org-1",
    });
  });
});
