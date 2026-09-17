/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn(), update: jest.fn() },
  brand: { findFirst: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {}, organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { onboardingRouter } from "../onboarding";
import { emptyProjectContext } from "@/lib/project-context";

const context = { ...emptyProjectContext(), targetResult: "Owner target text", constraints: "No automatic scaling", updatedAt: "2026-09-17T10:00:00Z" };
const caller = () => onboardingRouter.createCaller({ session: { user: { id: "user-1" }, expires: "2099-01-01" }, prisma });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "org-1", membership: { role: "admin" } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-1", slug: "owned-org", settings: {
    currency: "EUR", privateExtra: "do not return", brandContexts: { "brand-1": context },
    projectContext: { ...emptyProjectContext(), notes: "Last saved other brand" },
  } } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ id: "brand-1" } as never);
});

it("reads the exact owned brand context with provenance and no raw settings", async () => {
  const result = await caller().getBrandContext({ brandId: "brand-1" });
  expect(result).toEqual({ brandId: "brand-1", source: "brand", context });
  expect(prisma.brand.findFirst).toHaveBeenCalledWith({ where: { id: "brand-1", organizationId: "org-1" }, select: { id: true } });
  expect(prisma.organization.update).not.toHaveBeenCalled();
});
it("does not substitute organization legacy context when a brand has no saved input", async () => {
  expect(await caller().getBrandContext({ brandId: "brand-without-context" })).toEqual({ brandId: "brand-without-context", source: "missing", context: null });
});
it("rejects a foreign brand read without disclosing its context", async () => {
  jest.mocked(prisma.brand.findFirst).mockResolvedValue(null);
  await expect(caller().getBrandContext({ brandId: "foreign-brand" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("rejects a foreign brand save before changing organization settings", async () => {
  jest.mocked(prisma.brand.findFirst).mockResolvedValue(null);
  await expect(caller().saveContext({ brandId: "foreign-brand", objective: "sales" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.organization.update).not.toHaveBeenCalled();
});
it("preserves existing settings and other brands on an owned context save", async () => {
  await caller().saveContext({ brandId: "brand-2", objective: "leads", targetResult: " Qualified business buyers " });
  expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "org-1" }, data: { settings: expect.objectContaining({
      currency: "EUR", privateExtra: "do not return", brandContexts: expect.objectContaining({
        "brand-1": context, "brand-2": expect.objectContaining({ objective: "leads", targetResult: "Qualified business buyers" }),
      }),
    }) },
  }));
});
it("allows a viewer to read context but not persist it", async () => {
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "org-1", membership: { role: "viewer" } } as never);
  expect((await caller().getBrandContext({ brandId: "brand-1" })).source).toBe("brand");
  await expect(caller().saveContext({ brandId: "brand-1", objective: "sales" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(prisma.organization.update).not.toHaveBeenCalled();
});
