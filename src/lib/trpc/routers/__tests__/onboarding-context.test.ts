/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn(), update: jest.fn() },
  brand: { findFirst: jest.fn(), findMany: jest.fn() },
  adAccount: { findMany: jest.fn() },
  dailyMetric: { count: jest.fn(), groupBy: jest.fn() },
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
  jest.mocked(prisma.brand.findMany).mockResolvedValue([
    { id: "brand-1", name: "Fixture one" }, { id: "brand-2", name: "Fixture two" },
  ] as never);
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue([{ id: "account-1", brandId: "brand-1", platform: "google",
    name: "Fixture Google", accountId: "1234567890", accessToken: "fixture-ciphertext", tokenExpiry: new Date("2099-01-01"),
  }] as never);
  jest.mocked(prisma.dailyMetric.count).mockResolvedValue(0);
  jest.mocked(prisma.dailyMetric.groupBy).mockResolvedValue([]);
});

it("retires legacy quick audit without reading performance, inventing dates/targets or running Sync", async () => {
  const result = await caller().getQuickAudit({ days: 14, brandId: "brand-1" });
  expect(result.audit).toMatchObject({ status: "retired", executionAllowed: false, auditUrl: "/account-audit", items: [] });
  expect(prisma.brand.findFirst).toHaveBeenCalledWith({ where: { id: "brand-1", organizationId: "org-1" }, select: { id: true } });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled();
  expect(result).not.toHaveProperty("objective");
  expect(result).not.toHaveProperty("endDate");
  expect(JSON.stringify(result)).not.toContain("Last saved other brand");
});
it("rejects a foreign legacy quick-audit brand before returning diagnostics", async () => {
  jest.mocked(prisma.brand.findFirst).mockResolvedValue(null);
  await expect(caller().getQuickAudit({ brandId: "foreign-brand" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled();
});
it("allows legacy unscoped callers only a retirement notice, not organization performance", async () => {
  expect((await caller().getQuickAudit({})).audit).toMatchObject({ status: "retired", items: [] });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled();
});
it("does not make another brand setup-complete from the legacy blob", async () => {
  const status = await caller().getStatus();
  expect(status.brands.find(b => b.id === "brand-2")).toMatchObject({ contextComplete: false, contextSource: "missing" });
  expect(status.brands.find(b => b.id === "brand-1")).toMatchObject({ contextComplete: true, contextSource: "brand" });
  expect(JSON.stringify(status.connections)).not.toContain("fixture-ciphertext");
});
it("keeps setup readiness separate from selected-account action or metric readiness", async () => {
  const status = await caller().getStatus();
  expect(status).toMatchObject({ setupReady: true, ready: false, executionAllowed: false,
    readinessScope: "organization_setup_only", hasPerformance: false });
  jest.mocked(prisma.dailyMetric.count).mockResolvedValue(999);
  expect(await caller().getStatus()).toMatchObject({ ready: false, executionAllowed: false, hasPerformance: true });
});
it("does not combine one brand connection with another brand inputs into setup readiness", async () => {
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue([{ id: "account-2", brandId: "brand-2", platform: "google",
    accessToken: "fixture-ciphertext", accountId: "1234567890",
  }] as never);
  expect(await caller().getStatus()).toMatchObject({ setupReady: false, ready: false });
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
