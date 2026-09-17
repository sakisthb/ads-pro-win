/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  adAccount: { findFirst: jest.fn() }, dailyMetric: { groupBy: jest.fn(), findMany: jest.fn() }, adCampaign: { findMany: jest.fn() },
  analysis: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({ OrganizationAuthorizationError: class extends Error {},
  organizationRoles: ["owner", "admin", "member", "viewer"], requireOrganizationRoleForUser: jest.fn() }));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { googleResearchRouter } from "../google-research";

const scope = { brandId: "fixture-brand", adAccountId: "fixture-account" };
const input = { ...scope, market: "all" as const, goal: "sales" as const,
  window: { startDate: "2026-08-18", endDate: "2026-09-16" }, comparison: { mode: "previous" as const }, acknowledgeResearchOnly: true as const };
const caller = () => googleResearchRouter.createCaller({ session: { user: { id: "fixture-user" }, expires: "2099-01-01" }, prisma });
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-17T12:00:00Z"));
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "admin" } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "fixture-org", settings: null } as never);
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({ id: "fixture-account", accountId: "1111111111", name: "Fixture Google", platform: "google", brand: { name: "Fixture shop" } } as never);
  jest.mocked(prisma.brand.findUnique).mockResolvedValue({ id: "fixture-brand", organizationId: "fixture-org" } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ marketMode: "mixed" } as never);
  jest.mocked(prisma.brand.findMany).mockResolvedValue([]);
  jest.mocked(prisma.dailyMetric.groupBy).mockResolvedValue([]);
  jest.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);
  jest.mocked(prisma.adCampaign.findMany).mockResolvedValue([]);
  jest.mocked(prisma.analysis.create).mockImplementation(async args => ({ id: "fixture-snapshot", ...args.data }) as never);
  jest.mocked(prisma.analysis.updateMany).mockResolvedValue({ count: 1 });
  jest.mocked(prisma.analysis.findMany).mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());
async function saved() {
  const record = await caller().save(input);
  jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: record.snapshot } as never);
  return record;
}
it("generates immutable evidence from owned server reads, not client metric values", async () => {
  const record = await saved();
  expect(record.snapshot).toMatchObject({ schemaVersion: 1, scope: { ...scope, platform: "google", market: "all", goal: "sales" },
    revision: 0, reviewStatus: "pending", executionAllowed: false, createdBy: "fixture-user", createdAt: "2026-09-17T12:00:00.000Z" });
  expect(record.snapshot.reportMarkdown).toContain("Verdict: blocked");
  expect(record.snapshot.proposals.every(p => !p.executionAllowed)).toBe(true);
  expect(prisma.analysis.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "fixture-org", type: "google_audit_research_v1" }) }));
  expect(prisma.dailyMetric.groupBy).toHaveBeenCalledTimes(2);
  await expect(caller().save({ ...input, spend: 999 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("rejects a foreign or non-Google account before generating or saving evidence", async () => {
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue(null);
  await expect(caller().save(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
});
it("uses the canonical Google customer ID rather than an internal account wrapper in the saved scope and report",async()=>{
  jest.mocked(prisma.adAccount.findFirst).mockResolvedValue({id:"fixture-account",accountId:"gadsacct:fixture-brand:1111111111",name:"Fixture Google",brand:{name:"Fixture shop"}} as never);
  const record=await saved();
  expect(record.snapshot.scope.providerAccountId).toBe("1111111111");
  expect(record.snapshot.reportMarkdown).not.toContain("gadsacct:");
});
it("validates completed periods before data reads and requires the explicit research-only acknowledgment", async () => {
  await expect(caller().save({ ...input, window: { startDate: "2026-09-17", endDate: "2026-09-17" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(caller().save({ ...input, acknowledgeResearchOnly: false } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
});
it("allows viewer history reads but prevents viewer save and review mutations", async () => {
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "viewer" } } as never);
  expect(await caller().history(scope)).toEqual([]);
  await expect(caller().save(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller().review({ ...scope, id: "fixture-snapshot", revision: 0, decision: "accepted_research", note: "", confirmResearchOnly: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("records plan acceptance with actor and timestamp without granting execution permission", async () => {
  const record = await saved();
  const reviewed = await caller().review({ ...scope, id: record.id, revision: 0, decision: "accepted_research", note: "Research first", confirmResearchOnly: true });
  expect(reviewed.snapshot).toMatchObject({ revision: 1, reviewStatus: "accepted_research", executionAllowed: false,
    contentHash: record.snapshot.contentHash, reportMarkdown: record.snapshot.reportMarkdown,
    reviews: [{ actorId: "fixture-user", at: "2026-09-17T12:00:00.000Z", decision: "accepted_research", note: "Research first", revision: 1 }] });
  expect(prisma.analysis.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "fixture-org", type: "google_audit_research_v1", data: { path: ["revision"], equals: 0 } }) }));
});
it("requires a reason for requested changes and appends subsequent decisions instead of erasing history", async () => {
  const record = await saved();
  await expect(caller().review({ ...scope, id: record.id, revision: 0, decision: "changes_requested", note: "", confirmResearchOnly: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const first = await caller().review({ ...scope, id: record.id, revision: 0, decision: "changes_requested", note: "Review Wholesale separately", confirmResearchOnly: true });
  jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: first.id, data: first.snapshot } as never);
  const second = await caller().review({ ...scope, id: first.id, revision: 1, decision: "rejected", note: "Need new dates", confirmResearchOnly: true });
  expect(second.snapshot.reviews).toHaveLength(2); expect(second.snapshot.reviews[0].note).toBe("Review Wholesale separately");
});
it("fails closed on a stale review revision or a concurrent update", async () => {
  const record = await saved();
  await expect(caller().review({ ...scope, id: record.id, revision: 1, decision: "rejected", note: "", confirmResearchOnly: true })).rejects.toMatchObject({ code: "CONFLICT" });
  jest.mocked(prisma.analysis.updateMany).mockResolvedValue({ count: 0 });
  await expect(caller().review({ ...scope, id: record.id, revision: 0, decision: "rejected", note: "", confirmResearchOnly: true })).rejects.toMatchObject({ code: "CONFLICT" });
});
it("does not disclose or review a snapshot belonging to a different owned brand/account", async () => {
  const record = await saved();
  jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: { ...record.snapshot, scope: { ...record.snapshot.scope, adAccountId: "other-owned-account" } } } as never);
  await expect(caller().review({ ...scope, id: record.id, revision: 0, decision: "rejected", note: "", confirmResearchOnly: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(prisma.analysis.updateMany).not.toHaveBeenCalled();
});
it("withholds tampered evidence rather than presenting it as an immutable report", async () => {
  const record = await saved();
  jest.mocked(prisma.analysis.findMany).mockResolvedValue([{ id: record.id, data: { ...record.snapshot, reportMarkdown: "Invented winner" } }] as never);
  await expect(caller().history(scope)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
});
