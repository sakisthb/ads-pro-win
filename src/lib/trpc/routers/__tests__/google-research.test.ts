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
import { auditEvidenceReference } from "@/lib/audit-evidence-reference";

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
const operatorStudy = { customerId: '1111111111', title: 'Historical study <draft>', observedAt: '2026-09-17T11:00:00.000Z',
  markdown: '# Original account study\nBefore → proposed change → why.\nHypothesis, not provider-verified metrics.',
  sourceUrls: ['https://support.google.com/google-ads/answer/16260130?hl=en'], confirmOperatorSource: true as const };
describe('retained operator study', () => {
  it('preserves the complete original study with source/time labels inside the frozen report without treating it as canonical metrics', async () => {
    const record = await caller().save({ ...input, operatorStudy } as never);
    expect(record.snapshot.reportMarkdown).toContain(operatorStudy.markdown);
    expect(record.snapshot.reportMarkdown).toContain('Operator-supplied study — not provider-verified metric evidence');
    expect(record.snapshot.reportMarkdown).toContain(operatorStudy.observedAt);
    expect(record.snapshot.reportMarkdown).toContain(operatorStudy.sourceUrls[0]);
    expect(record.snapshot.reportMarkdown).toContain('Historical study &lt;draft&gt;');
    expect(record.snapshot.reportMarkdown).toContain('Verdict: blocked');
    expect(record.snapshot.executionAllowed).toBe(false);
    expect(prisma.dailyMetric.groupBy).toHaveBeenCalledTimes(2);
    const plain = await caller().save(input);
    expect(plain.snapshot.reportMarkdown).not.toContain(operatorStudy.markdown);
    expect(plain.snapshot.contentHash).not.toEqual(record.snapshot.contentHash);
    jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: record.snapshot } as never);
    const reviewed = await caller().review({ ...scope, id: record.id, revision: 0, decision: 'changes_requested', note: 'Recheck present settings', confirmResearchOnly: true });
    expect(reviewed.snapshot.reportMarkdown).toBe(record.snapshot.reportMarkdown);
    expect(reviewed.snapshot.contentHash).toBe(record.snapshot.contentHash);
  });
  it('rejects a study declared for another customer before metric reads or persistence', async () => {
    await expect(caller().save({ ...input, operatorStudy: { ...operatorStudy, customerId: '2222222222' } } as never)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
  it('rejects future observation timestamps before metric reads or persistence', async () => {
    await expect(caller().save({ ...input, operatorStudy: { ...operatorStudy, observedAt: '2026-09-18T00:00:00.000Z' } } as never)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
  it('requires explicit source acknowledgment, bounded text and HTTPS source links', async () => {
    for (const patch of [{ confirmOperatorSource: false }, { markdown: 'x'.repeat(250001) }, { markdown: ' ' }, { sourceUrls: ['javascript:alert(1)'] }, { sourceUrls: ['https://user:password@example.com/'] }]) {
      await expect(caller().save({ ...input, operatorStudy: { ...operatorStudy, ...patch } } as never)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
});
async function saved() {
  const record = await caller().save(input);
  jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: record.snapshot } as never);
  return record;
}
describe("shared frozen evidence reads", () => {
  async function reference() {
    const record = await saved();
    jest.mocked(prisma.dailyMetric.groupBy).mockClear(); jest.mocked(prisma.analysis.create).mockClear();
    return { record, ref: auditEvidenceReference(record) };
  }
  it("allows a viewer to read exactly the owned snapshot without metrics, writes or tokens", async () => {
    const { record, ref } = await reference();
    jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "viewer" } } as never);
    expect(await caller().get(ref)).toEqual(record);
    expect(prisma.analysis.findFirst).toHaveBeenCalledWith({ where: { id: record.id, organizationId: "fixture-org", type: "google_audit_research_v1" }, select: { id: true, data: true } });
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled();
    expect(prisma.analysis.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a foreign account before any snapshot lookup", async () => {
    const { ref } = await reference(); jest.mocked(prisma.analysis.findFirst).mockClear();
    jest.mocked(prisma.adAccount.findFirst).mockResolvedValue(null);
    await expect(caller().get(ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.analysis.findFirst).not.toHaveBeenCalled();
  });
  it("rejects a missing organization-owned record", async () => {
    const { ref } = await reference(); jest.mocked(prisma.analysis.findFirst).mockResolvedValue(null);
    await expect(caller().get(ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("withholds a record in another owned account scope", async () => {
    const { record, ref } = await reference();
    jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: { ...record.snapshot, scope: { ...record.snapshot.scope, adAccountId: "other-owned" } } } as never);
    await expect(caller().get(ref)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("withholds tampered, malformed and client-mismatched checksum evidence", async () => {
    const { record, ref } = await reference();
    await expect(caller().get({ ...ref, contentHash: "b".repeat(64) })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: { ...record.snapshot, reportMarkdown: "Invented performance" } } as never);
    await expect(caller().get(ref)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    jest.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: record.id, data: { arbitrary: "untrusted" } } as never);
    await expect(caller().get(ref)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("fails closed on stale revision, including before explanation", async () => {
    const { ref } = await reference();
    await expect(caller().get({ ...ref, revision: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().explain({ ...ref, revision: 1, question: "Why?" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.updateMany).not.toHaveBeenCalled();
  });
  it("explains saved research fields only and refuses client metrics / unknown proposals", async () => {
    const { record, ref } = await reference();
    const result = await caller().explain({ ...ref, question: "Why?", proposalId: record.snapshot.proposals[0].id });
    expect(result.reference).toEqual(ref); expect(result.answer).toContain(record.snapshot.proposals[0].reason);
    expect(result.executionAllowed).toBe(false);
    await expect(caller().explain({ ...ref, question: "Why?", spend: 999 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().explain({ ...ref, question: "Why?", proposalId: "other" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.dailyMetric.groupBy).not.toHaveBeenCalled(); expect(prisma.analysis.create).not.toHaveBeenCalled(); expect(prisma.analysis.updateMany).not.toHaveBeenCalled();
  });
});
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
