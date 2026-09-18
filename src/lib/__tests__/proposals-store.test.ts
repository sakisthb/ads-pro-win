/** @jest-environment node */
import type { PrismaClient } from "@prisma/client";
import {
  PROPOSAL_DECISION_RECORD_TYPE,
  buildProposalDecisionEntry,
  recordProposalDecision,
  storedProposalDecisions,
} from "@/lib/proposals-store";

type StoredRecord = { id: string; organizationId: string; type: string; title: string; status: string; data: unknown };
let store: StoredRecord[] = [];
let seq = 0;

function makePrisma() {
  const prisma = {
    analysis: {
      create: jest.fn(async args => {
        const rec = { id: `record-${++seq}`, ...(args.data as Omit<StoredRecord, "id">) } as StoredRecord;
        store.push(rec);
        return rec;
      }),
      findMany: jest.fn(async () => store.filter(r => r.type === PROPOSAL_DECISION_RECORD_TYPE)),
    },
  };
  return prisma as unknown as PrismaClient & { analysis: { create: jest.Mock; findMany: jest.Mock } };
}

const ORG = "fixture-org", BRAND = "fixture-brand", USER = "fixture-user";
const KEY = "p_0a1b2c3d";

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00Z"));
  store = []; seq = 0;
});
afterEach(() => jest.useRealTimers());

describe("recordProposalDecision", () => {
  it("records an approval decision under the decision record type with decidedBy and decidedAt", async () => {
    const prisma = makePrisma();
    const result = await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved" });
    expect(result.status).toBe("decided");
    expect(result.record.decision.brandId).toBe(BRAND);
    expect(result.record.decision.decidedBy).toBe(USER);
    expect(result.record.decision.decidedAt).toBe("2026-09-18T12:00:00.000Z");
    expect(prisma.analysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: ORG, type: PROPOSAL_DECISION_RECORD_TYPE, status: "proposal_decided" }),
    }));
  });

  it("is idempotent: an identical re-decision reports unchanged and skips the write", async () => {
    const prisma = makePrisma();
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved", note: "ok" });
    const again = await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved", note: "ok" });
    expect(again.status).toBe("unchanged");
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });

  it("stores a note when one is given and null otherwise", async () => {
    const prisma = makePrisma();
    const withNote = await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "rejected", note: "wait for LPV fix" });
    expect(withNote.record.decision.note).toBe("wait for LPV fix");
    const withoutNote = await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: "p_9f8e7d6c", decision: "approved" });
    expect(withoutNote.record.decision.note).toBeNull();
  });

  it("rejects an invalid decision value at the schema boundary", () => {
    expect(() => buildProposalDecisionEntry({ proposalKey: KEY, brandId: BRAND, decision: "maybe" as never, note: null, decidedBy: USER, decidedAt: "2026-09-18T12:00:00.000Z" }))
      .toThrow();
  });
});

describe("storedProposalDecisions", () => {
  it("returns the latest decision per proposal key", async () => {
    const prisma = makePrisma();
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved" });
    jest.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "rejected", note: "changed my mind" });
    const decisions = await storedProposalDecisions(prisma, ORG, BRAND);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision.decision).toBe("rejected");
    expect(decisions[0].decision.note).toBe("changed my mind");
  });

  it("keeps decisions of different keys independent", async () => {
    const prisma = makePrisma();
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved" });
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: "p_9f8e7d6c", decision: "rejected" });
    const decisions = await storedProposalDecisions(prisma, ORG, BRAND);
    expect(decisions.map(d => d.decision.proposalKey).sort()).toEqual([KEY, "p_9f8e7d6c"].sort());
  });

  it("withholds tampered records instead of half-decoding them", async () => {
    const prisma = makePrisma();
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved" });
    store[0] = { ...store[0], data: { ...(store[0].data as object), decision: "rejected" } };
    const decisions = await storedProposalDecisions(prisma, ORG, BRAND);
    expect(decisions).toHaveLength(0);
  });

  it("scopes decisions to the brand stored in the record", async () => {
    const prisma = makePrisma();
    await recordProposalDecision(prisma, ORG, BRAND, USER, { proposalKey: KEY, decision: "approved" });
    const decisions = await storedProposalDecisions(prisma, ORG, "foreign-brand");
    expect(decisions).toHaveLength(0);
  });
});
