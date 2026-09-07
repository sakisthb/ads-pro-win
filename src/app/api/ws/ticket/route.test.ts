import { POST as issueTicket } from "./route";
import { getSession } from "@/lib/auth";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
} from "@/lib/organization-authorization";
import { createWebSocketTicket } from "@/lib/websocket/tickets";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: { webSocketTicket: {} },
}));

jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {
    constructor(
      readonly status: 401 | 403 | 404,
      message: string,
    ) {
      super(message);
    }
  },
  organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn(),
}));

jest.mock("@/lib/websocket/tickets", () => ({
  createWebSocketTicket: jest.fn(),
}));

const mockedGetSession = jest.mocked(getSession);
const mockedRequireRole = jest.mocked(requireOrganizationRoleForUser);
const mockedCreateTicket = jest.mocked(createWebSocketTicket);

describe("POST /api/ws/ticket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function request() {
    return new Request("http://localhost/api/ws/ticket", { method: "POST" });
  }

  it("rejects unauthenticated callers", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await issueTicket(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockedCreateTicket).not.toHaveBeenCalled();
  });

  it("rejects callers without organization membership", async () => {
    mockedGetSession.mockResolvedValue({ userId: "user-1" });
    mockedRequireRole.mockRejectedValue(
      new OrganizationAuthorizationError(403, "Organization membership is required"),
    );

    const response = await issueTicket(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Organization membership is required",
    });
    expect(mockedCreateTicket).not.toHaveBeenCalled();
  });

  it("issues a ticket bound to the active user and organization", async () => {
    mockedGetSession.mockResolvedValue({ userId: "user-1" });
    mockedRequireRole.mockResolvedValue({
      organizationId: "org-1",
      membership: {
        id: "mem-1",
        userId: "user-1",
        organizationId: "org-1",
        role: "member",
        isDefault: true,
      },
    });
    mockedCreateTicket.mockResolvedValue({
      ticket: {
        id: "ticket-1",
        tokenDigest: "digest",
        userId: "user-1",
        organizationId: "org-1",
        channels: ["ai_operations", "analytics_updates", "campaign_*"],
        consumedAt: null,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        createdAt: new Date(),
      },
      rawToken: "raw-token",
    });

    const response = await issueTicket(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBe("raw-token");
    expect(body.expiresAt).toBe("2030-01-01T00:00:00.000Z");
    expect(mockedCreateTicket).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        organizationId: "org-1",
        channels: ["ai_operations", "analytics_updates", "campaign_*"],
      }),
    );
  });
});
