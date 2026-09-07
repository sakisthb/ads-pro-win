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
    user: {
      findUnique: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
    },
    invitation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
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

jest.mock("@/lib/email/send-invite", () => ({
  sendInviteEmail: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { invitationsRouter } from "@/lib/trpc/routers/invitations";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireOrganizationRoleForUser = jest.mocked(
  requireOrganizationRoleForUser,
);
const mockedSendInviteEmail = jest.mocked(sendInviteEmail);

function ownerContext() {
  return {
    organizationId: "org-1",
    membership: {
      id: "membership-1",
      userId: "owner-1",
      organizationId: "org-1",
      role: "owner" as const,
      isDefault: true,
    },
  };
}

function createCaller() {
  return invitationsRouter.createCaller({
    session: { user: { id: "owner-1" }, expires: "2099-01-01T00:00:00.000Z" },
    prisma,
  });
}

describe("invitations router", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireOrganizationRoleForUser.mockResolvedValue(ownerContext());
    mockedPrisma.organization.findUnique.mockResolvedValue({
      name: "Test Org",
    } as never);
    mockedPrisma.user.findUnique.mockResolvedValue({
      fullName: "Owner",
      email: "owner@example.com",
    } as never);
    mockedSendInviteEmail.mockResolvedValue({ success: true, acceptUrl: "" });
  });

  describe("send", () => {
    it("stores a token digest and normalized email, never the raw token", async () => {
      mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockedPrisma.organizationMembership.findUnique.mockResolvedValueOnce(
        null,
      );
      mockedPrisma.invitation.findFirst.mockResolvedValueOnce(null);
      mockedPrisma.invitation.create.mockImplementation(async ({ data }) => ({
        id: "inv-1",
        ...data,
        createdAt: new Date(),
      }));

      const caller = createCaller();
      const result = await caller.send({
        email: "  New.Member@Example.COM  ",
        role: "member",
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe("new.member@example.com");

      const createData = mockedPrisma.invitation.create.mock
        .calls[0][0] as { data: { tokenDigest?: string; token?: string; email: string } };
      expect(createData.data.tokenDigest).toBeDefined();
      expect(createData.data.tokenDigest).toHaveLength(64);
      expect(createData.data.token).toBeUndefined();
      expect(createData.data.email).toBe("new.member@example.com");

      expect("acceptUrl" in result.data).toBe(false);
      expect(mockedSendInviteEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockedSendInviteEmail.mock.calls[0][0];
      expect(emailArgs.email).toBe("new.member@example.com");
      expect(emailArgs.token).toHaveLength(64);
      expect(emailArgs.token).not.toBe(createData.data.tokenDigest);
    });

    it("rejects sending when the user is already a member", async () => {
      mockedPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "existing@example.com",
      } as never);
      mockedPrisma.organizationMembership.findUnique.mockResolvedValueOnce({
        id: "membership-1",
      } as never);

      const caller = createCaller();
      await expect(
        caller.send({ email: "existing@example.com", role: "viewer" }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "User is already a member of this organization",
      });

      expect(mockedPrisma.invitation.create).not.toHaveBeenCalled();
      expect(mockedSendInviteEmail).not.toHaveBeenCalled();
    });

    it("rejects duplicate active invitations", async () => {
      mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockedPrisma.organizationMembership.findUnique.mockResolvedValueOnce(
        null,
      );
      mockedPrisma.invitation.findFirst.mockResolvedValueOnce({
        id: "inv-existing",
      } as never);

      const caller = createCaller();
      await expect(
        caller.send({ email: "pending@example.com", role: "viewer" }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "An active invitation already exists for this email",
      });

      expect(mockedPrisma.invitation.create).not.toHaveBeenCalled();
      expect(mockedSendInviteEmail).not.toHaveBeenCalled();
    });
  });
});
