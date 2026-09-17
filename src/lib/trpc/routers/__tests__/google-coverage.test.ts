/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (value: unknown) => value, deserialize: (value: unknown) => value } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { organization: { findUnique: jest.fn() }, adAccount: { findFirst: jest.fn() }, syncJob: { findMany: jest.fn() } } }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {}, organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn().mockResolvedValue({ organizationId: "org-1", membership: { role: "viewer" } }),
}));
import { prisma } from "@/lib/db";
import { syncStatusRouter } from "@/lib/trpc/routers/sync-status";
const caller = (authenticated = true) => syncStatusRouter.createCaller({ session: authenticated ? { user: { id: "user-1" }, expires: "2099-01-01" } : null, prisma });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-1" } as never);
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({ id: "acc-1" } as never);
  jest.mocked(prisma.syncJob.findMany).mockResolvedValue([{ id: "legacy-run", status: "completed", coverageReceipt: null }] as never);
});
it("reads only owned Google account runs and keeps legacy success unverified", async () => {
  const result = await caller().getGoogleCoverage({ adAccountId: "acc-1" });
  expect(prisma.adAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "acc-1", platform: "google", brand: { organizationId: "org-1" } } }));
  expect(prisma.syncJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { adAccountId: "acc-1", platform: "google", type: "metrics" }, take: 10 }));
  expect(result).toEqual({ availability: "available", jobs: [{ id: "legacy-run", status: "completed", coverageReceipt: null }] });
});
it("refuses anonymous access before any account query", async () => {
  await expect(caller(false).getGoogleCoverage({ adAccountId: "acc-1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(prisma.adAccount.findFirst).not.toHaveBeenCalled();
});
it("refuses inaccessible accounts before reading receipts", async () => {
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValueOnce(null);
  await expect(caller().getGoogleCoverage({ adAccountId: "other-account" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.syncJob.findMany).not.toHaveBeenCalled();
});
it("reports missing receipt migration without fabricating legacy coverage", async () => {
  jest.mocked(prisma.syncJob.findMany).mockRejectedValueOnce({ code: "P2021", meta: { table: "public.SyncCoverageReceipt" } });
  expect(await caller().getGoogleCoverage({ adAccountId: "acc-1" })).toEqual({ availability: "migration_required", jobs: [] });
});
it("does not disguise unrelated database failures as a missing migration", async () => {
  jest.mocked(prisma.syncJob.findMany).mockRejectedValueOnce({ code: "P2021", meta: { table: "public.SyncJob" } });
  await expect(caller().getGoogleCoverage({ adAccountId: "acc-1" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Coverage receipts could not be loaded" });
});
