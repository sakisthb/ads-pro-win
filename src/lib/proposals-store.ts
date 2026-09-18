import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProposalDecision } from "@/lib/proposals";

// Approval-flow persistence for study-derived proposals. Decisions live in the
// org-scoped Analysis table under their own record type; brand scope is pinned in
// the record and verified on every read, and tampered records are withheld. A
// decision records an operator choice only — it never triggers a provider write;
// execution stays behind the audited desks (ADR 0002 / ADR 0003).

export const PROPOSAL_DECISION_RECORD_TYPE = "operator_proposal_decision_v1";

const decisionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("operator_proposal_decision"),
  proposalKey: z.string().regex(/^p_[a-f0-9]{8}$/),
  brandId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).nullable(),
  decidedBy: z.string().min(1),
  decidedAt: z.string().datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type ProposalDecisionEntry = z.infer<typeof decisionSchema>;
export type ProposalDecisionRecord = { id: string; decision: ProposalDecisionEntry };
export type ProposalDecisionInput = { proposalKey: string; decision: ProposalDecision; note?: string | null };

export type RecordProposalDecisionResult =
  | { status: "decided"; record: ProposalDecisionRecord }
  | { status: "unchanged"; record: ProposalDecisionRecord };

export function proposalDecisionContentHash(entry: Omit<ProposalDecisionEntry, "contentHash">): string {
  return createHash("sha256").update(JSON.stringify({
    schemaVersion: entry.schemaVersion, kind: entry.kind, proposalKey: entry.proposalKey,
    brandId: entry.brandId, decision: entry.decision, note: entry.note,
    decidedBy: entry.decidedBy, decidedAt: entry.decidedAt,
  })).digest("hex");
}

export function buildProposalDecisionEntry(input: ProposalDecisionInput & { brandId: string; decidedBy: string; decidedAt: string }): ProposalDecisionEntry {
  const entry = decisionSchema.omit({ contentHash: true }).parse({
    ...input, note: input.note ?? null, schemaVersion: 1, kind: "operator_proposal_decision",
  });
  return { ...entry, contentHash: proposalDecisionContentHash(entry) };
}

export function decodeProposalDecisionRecord(record: { id: string; data: unknown }, brandId: string): ProposalDecisionRecord {
  const parsed = decisionSchema.safeParse(record.data);
  if (!parsed.success) throw new Error("Unsupported proposal decision record; decision withheld");
  const decision = parsed.data;
  if (decision.brandId !== brandId) throw new Error("Proposal decision not found in this brand scope");
  if (proposalDecisionContentHash(decision) !== decision.contentHash) throw new Error("Proposal decision integrity check failed; decision withheld");
  return { id: record.id, decision };
}

function sameDecision(record: ProposalDecisionRecord, input: ProposalDecisionInput): boolean {
  return record.decision.proposalKey === input.proposalKey && record.decision.decision === input.decision &&
    (record.decision.note ?? null) === (input.note ?? null);
}

export async function recordProposalDecision(
  prisma: PrismaClient,
  organizationId: string,
  brandId: string,
  decidedBy: string,
  input: ProposalDecisionInput,
): Promise<RecordProposalDecisionResult> {
  const existing = await storedProposalDecisions(prisma, organizationId, brandId);
  const latest = existing.find(d => d.decision.proposalKey === input.proposalKey);
  if (latest && sameDecision(latest, input)) return { status: "unchanged", record: latest };
  const entry = buildProposalDecisionEntry({
    proposalKey: input.proposalKey, decision: input.decision, note: input.note ?? null,
    brandId, decidedBy, decidedAt: new Date().toISOString(),
  });
  const record = await prisma.analysis.create({
    data: { organizationId, type: PROPOSAL_DECISION_RECORD_TYPE, title: `Proposal decision ${input.proposalKey} ${input.decision}`,
      status: "proposal_decided", data: entry as Prisma.InputJsonValue },
    select: { id: true, data: true },
  });
  return { status: "decided", record: decodeProposalDecisionRecord(record, brandId) };
}

export async function storedProposalDecisions(prisma: PrismaClient, organizationId: string, brandId: string): Promise<ProposalDecisionRecord[]> {
  const records = await prisma.analysis.findMany({
    where: { organizationId, type: PROPOSAL_DECISION_RECORD_TYPE, AND: [{ data: { path: ["brandId"], equals: brandId } }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 500, select: { id: true, data: true },
  });
  const byKey = new Map<string, ProposalDecisionRecord>();
  for (const record of records) {
    try {
      const decoded = decodeProposalDecisionRecord(record, brandId);
      const current = byKey.get(decoded.decision.proposalKey);
      if (!current || current.decision.decidedAt < decoded.decision.decidedAt) byKey.set(decoded.decision.proposalKey, decoded);
    } catch {
      // Tampered records are withheld, never half-decoded into the list.
    }
  }
  return [...byKey.values()];
}
