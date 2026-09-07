import { POST as acceptInvitation } from "@/app/api/invite/accept/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInvitationTokenDigest, generateInvitationToken } from "@/lib/invitation-tokens";

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
    invitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organizationMembership: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockedGetSession = jest.mocked(getSession);
const mockedPrisma = jest.mocked(prisma, { shallow: false });

function request(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/invite/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function body(response: Response) {
  return response.json();
}

describe("POST /api/invite/accept", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback) =>
      // Run the transactional callback against the same mocked prisma client.
      (callback as (tx: typeof mockedPrisma) => Promise<unknown>)(mockedPrisma),
    );
  });

  it("rejects a missing token", async () => {
    mockedGetSession.mockResolvedValue({
      userId: "user-1",
      email: "member@example.com",
    });

    const response = await acceptInvitation(request({}));

    expect(response.status).toBe(400);
    expect(await body(response)).toEqual({
      success: false,
      error: "Invitation token is required",
    });
    expect(mockedPrisma.invitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await acceptInvitation(request({ token: "abc" }));

    expect(response.status).toBe(401);
    expect(await body(response)).toEqual({
      success: false,
      error: "Authentication required",
    });
    expect(mockedPrisma.invitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown token digest", async () => {
    mockedGetSession.mockResolvedValue({
      userId: "user-1",
      email: "member@example.com",
    });
    mockedPrisma.invitation.findUnique.mockResolvedValue(null);

    const response = await acceptInvitation(request({ token: "unknown-token" }));

    expect(response.status).toBe(404);
    expect(await body(response)).toEqual({
      success: false,
      error: "Invitation not found",
    });
  });

  it("rejects an expired invitation", async () => {
    const { raw, digest } = generateInvitationToken();
    mockedGetSession.mockResolvedValue({
      userId: "user-1",
      email: "member@example.com",
    });
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
      acceptedByUserId: null,
    } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(410);
    expect(await body(response)).toEqual({
      success: false,
      error: "Invitation has expired",
    });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invitation sent to a different email address", async () => {
    const { raw, digest } = generateInvitationToken();
    mockedGetSession.mockResolvedValue({
      userId: "user-1",
      email: "attacker@example.com",
    });
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 3600000),
      acceptedByUserId: null,
    } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(403);
    expect(await body(response)).toEqual({
      success: false,
      error: "This invitation was sent to a different email address",
    });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates membership and consumes the invitation in a transaction", async () => {
    const { raw, digest } = generateInvitationToken();
    const session = {
      userId: "user-1",
      email: "member@example.com",
    };
    mockedGetSession.mockResolvedValue(session);
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 3600000),
      acceptedByUserId: null,
    } as never);
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue(null);
    mockedPrisma.organizationMembership.create.mockResolvedValue({
      id: "membership-1",
    } as never);
    mockedPrisma.invitation.update.mockResolvedValue({ id: "inv-1" } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ success: true });
    expect(mockedPrisma.invitation.findUnique).toHaveBeenCalledWith({
      where: { tokenDigest: digest },
    });
    expect(mockedPrisma.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        userId: session.userId,
        organizationId: "org-1",
        role: "member",
      },
    });
    expect(mockedPrisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        status: "accepted",
        acceptedByUserId: session.userId,
        acceptedAt: expect.any(Date),
      }),
    });
  });

  it("is idempotent when the same user accepts again", async () => {
    const { raw, digest } = generateInvitationToken();
    const session = {
      userId: "user-1",
      email: "member@example.com",
    };
    mockedGetSession.mockResolvedValue(session);
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "accepted",
      expiresAt: new Date(Date.now() + 3600000),
      acceptedByUserId: session.userId,
    } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ success: true });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not allow a different user to replay a consumed invitation", async () => {
    const { raw, digest } = generateInvitationToken();
    mockedGetSession.mockResolvedValue({
      userId: "user-2",
      email: "other@example.com",
    });
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "accepted",
      expiresAt: new Date(Date.now() + 3600000),
      acceptedByUserId: "user-1",
    } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(410);
    expect(await body(response)).toEqual({
      success: false,
      error: "Invitation has already been used",
    });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("consumes the invitation when the user is already a member", async () => {
    const { raw, digest } = generateInvitationToken();
    const session = {
      userId: "user-1",
      email: "member@example.com",
    };
    mockedGetSession.mockResolvedValue(session);
    mockedPrisma.invitation.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "member@example.com",
      role: "member",
      organizationId: "org-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 3600000),
      acceptedByUserId: null,
    } as never);
    mockedPrisma.organizationMembership.findUnique.mockResolvedValue({
      id: "membership-1",
    } as never);
    mockedPrisma.invitation.update.mockResolvedValue({ id: "inv-1" } as never);

    const response = await acceptInvitation(request({ token: raw }));

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ success: true });
    expect(mockedPrisma.organizationMembership.create).not.toHaveBeenCalled();
    expect(mockedPrisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({ status: "accepted" }),
    });
  });
});
