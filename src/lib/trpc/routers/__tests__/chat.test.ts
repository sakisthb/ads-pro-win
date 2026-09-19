/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/lib/organization-authorization", () => ({ OrganizationAuthorizationError: class extends Error {},
  organizationRoles: ["owner", "admin", "member", "viewer"], requireOrganizationRoleForUser: jest.fn() }));

import { requireOrganizationRoleForUser, OrganizationAuthorizationError } from "@/lib/organization-authorization";
import { chatRouter } from "../chat";

const caller = () => chatRouter.createCaller({ session: { user: { id: "fixture-user" }, expires: "2099-01-01" }, prisma: {} });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({
    organizationId: "fixture-org",
    membership: { id: "m1", userId: "fixture-user", organizationId: "fixture-org", role: "member", isDefault: true },
  } as never);
});

describe("chat.getOrgContext", () => {
  it("resolves the active organization for a signed-in member", async () => {
    const context = await caller().getOrgContext();
    expect(context).toEqual({ organizationId: "fixture-org" });
    expect(requireOrganizationRoleForUser).toHaveBeenCalledWith("fixture-user", ["owner", "admin", "member", "viewer"]);
  });

  it("returns a null scope instead of throwing when the user has no membership", async () => {
    jest.mocked(requireOrganizationRoleForUser).mockRejectedValue(new OrganizationAuthorizationError(403, "Organization membership is required"));
    const context = await caller().getOrgContext();
    expect(context).toEqual({ organizationId: null });
  });

  it("rethrows unexpected resolution failures", async () => {
    jest.mocked(requireOrganizationRoleForUser).mockRejectedValue(new Error("database unreachable"));
    await expect(caller().getOrgContext()).rejects.toThrow("database unreachable");
  });

  it("rejects unauthenticated callers before any resolution", async () => {
    const anonymous = chatRouter.createCaller({ session: null, prisma: {} });
    await expect(anonymous.getOrgContext()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(requireOrganizationRoleForUser).not.toHaveBeenCalled();
  });
});
