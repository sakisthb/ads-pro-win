import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationAdminProcedure, organizationProcedure } from "../server";
import { recordProposalDecision, storedProposalDecisions, type ProposalDecisionRecord } from "@/lib/proposals-store";

const brandScope = z.object({ brandId: z.string().min(1) }).strict();
const decideSchema = brandScope.extend({
  proposalKey: z.string().regex(/^p_[a-f0-9]{8}$/),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).nullable().optional(),
}).strict();

async function ownedBrand(prisma: PrismaClient, organizationId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, organizationId }, select: { id: true, name: true } });
  if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Owned brand not found" });
  return brand;
}

// Approval flow for study-derived proposals. Read is open to any org member;
// deciding requires an org admin role. A decision is an operator record only —
// it never executes a provider write (Meta writes stay behind the audited
// meta-ops desk per ADR 0002; Google stays read-only per ADR 0003).
export const proposalsRouter = createTRPCRouter({
  decisions: organizationProcedure.input(brandScope).query(async ({ ctx, input }): Promise<ProposalDecisionRecord[]> => {
    await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
    return storedProposalDecisions(ctx.prisma, ctx.organizationId, input.brandId);
  }),
  decide: organizationAdminProcedure.input(decideSchema).mutation(async ({ ctx, input }): Promise<ProposalDecisionRecord> => {
    await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
    const result = await recordProposalDecision(ctx.prisma, ctx.organizationId, input.brandId, ctx.session.user.id, input);
    return result.record;
  }),
});
