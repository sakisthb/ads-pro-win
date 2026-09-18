/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findFirst: jest.fn() },
  analysis: { create: jest.fn(), findMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({ OrganizationAuthorizationError: class extends Error {},
  organizationRoles: ["owner", "admin", "member", "viewer"], requireOrganizationRoleForUser: jest.fn() }));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { proposalsRouter } from "../proposals";

type StoredRecord = { id: string; organizationId: string; type: string; title: string; status: string; data: unknown };
let store: StoredRecord[] = [];
let seq = 0;

const caller = () => proposalsRouter.createCaller({ session: { user: { id: "fixture-user" }, expires: "2099-01-01" }, prisma });
const brandScope = { brandId: "fixture-brand" };
const KEY = "p_0a1b2c3d";

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00Z"));
  store = []; seq = 0;
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "admin" } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "fixture-org", settings: null } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ id: "fixture-brand", name: "BagToBag" } as never);
  jest.mocked(prisma.analysis.create).mockImplementation(async args => {
    const rec = { id: `record-${++seq}`, ...(args.data as Omit<StoredRecord, "id">) } as StoredRecord;
    store.push(rec); return rec;
  });
  jest.mocked(prisma.analysis.findMany).mockImplementation(async () => store.filter(r => r.type === "operator_proposal_decision_v1"));
});
afterEach(() => jest.useRealTimers());

describe("proposals decide", () => {
  it("records an approval decision inside the owned brand", async () => {
    const record = await caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" });
    expect(record.decision.proposalKey).toBe(KEY);
    expect(record.decision.decision).toBe("approved");
    expect(record.decision.brandId).toBe("fixture-brand");
    expect(record.decision.decidedBy).toBe("fixture-user");
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });

  it("records an optional note with the decision", async () => {
    const record = await caller().decide({ ...brandScope, proposalKey: KEY, decision: "rejected", note: "needs LPV fix first" });
    expect(record.decision.note).toBe("needs LPV fix first");
  });

  it("is idempotent for an identical re-decision", async () => {
    await caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" });
    await caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" });
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });

  it("withholds decisions for a brand outside the organization", async () => {
    jest.mocked(prisma.brand.findFirst).mockResolvedValue(null as never);
    await expect(caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.analysis.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed proposal key at the input boundary", async () => {
    await expect(caller().decide({ ...brandScope, proposalKey: "not-a-key", decision: "approved" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
});

describe("proposals decisions read", () => {
  it("lists the latest decision per key for the brand scope", async () => {
    await caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" });
    jest.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    await caller().decide({ ...brandScope, proposalKey: KEY, decision: "rejected" });
    const decisions = await caller().decisions(brandScope);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision.decision).toBe("rejected");
  });

  it("lists nothing for a brand outside the organization", async () => {
    jest.mocked(prisma.brand.findFirst).mockResolvedValue(null as never);
    await expect(caller().decisions(brandScope)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("proposals authorization", () => {
  it("requires an organization admin role for decide", async () => {
    jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "member" } } as never);
    await expect(caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.analysis.create).not.toHaveBeenCalled();
  });

  it("allows any organization member to read decisions", async () => {
    await caller().decide({ ...brandScope, proposalKey: KEY, decision: "approved" });
    jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "member" } } as never);
    const decisions = await caller().decisions(brandScope);
    expect(decisions).toHaveLength(1);
  });
});
