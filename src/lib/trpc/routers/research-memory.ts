import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationAdminProcedure, organizationProcedure } from "../server";
import {
  RESEARCH_MEMORY_RECORD_TYPE,
  ResearchMemoryError,
  decodeResearchMemoryRecord,
  type ResearchMemoryRecord,
} from "@/lib/research-memory";
import { importResearchMemory, storedResearchMemoryRecords } from "@/lib/research-memory-store";

const brandScope = z.object({ brandId: z.string().min(1) }).strict();
const importSchema = brandScope.extend({
  title: z.string().trim().min(3).max(200),
  sourceDoc: z.string().trim().min(1).max(500),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrls: z.array(z.string().url().max(2000)).max(50).default([]),
  markdown: z.string().min(1).max(250000).refine(value => value.trim().length > 0, "Research content is required"),
  confirmResearchOnly: z.literal(true),
}).strict();

function toTRPCError(error: ResearchMemoryError): TRPCError {
  return new TRPCError({ code: error.code === "scope" ? "NOT_FOUND" : "PRECONDITION_FAILED", message: error.message, cause: error });
}

async function ownedBrand(prisma: PrismaClient, organizationId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, organizationId }, select: { id: true, name: true } });
  if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Owned brand not found" });
  return brand;
}

async function storedRecords(prisma: PrismaClient, organizationId: string, brandId: string): Promise<ResearchMemoryRecord[]> {
  return storedResearchMemoryRecords(prisma, organizationId, brandId);
}

export const researchMemoryRouter = createTRPCRouter({
  list: organizationProcedure.input(brandScope).query(async ({ ctx, input }): Promise<ResearchMemoryRecord[]> => {
    await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
    return storedRecords(ctx.prisma, ctx.organizationId, input.brandId);
  }),
  get: organizationProcedure.input(brandScope.extend({ id: z.string().min(1) }).strict())
    .query(async ({ ctx, input }): Promise<ResearchMemoryRecord> => {
      await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
      const record = await ctx.prisma.analysis.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, type: RESEARCH_MEMORY_RECORD_TYPE },
        select: { id: true, data: true } });
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Research memory record not found" });
      try {
        return decodeResearchMemoryRecord(record, input.brandId);
      } catch (error) {
        throw error instanceof ResearchMemoryError ? toTRPCError(error) : error;
      }
    }),
  import: organizationAdminProcedure.input(importSchema).mutation(async ({ ctx, input }): Promise<ResearchMemoryRecord> => {
    await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
    const result = await importResearchMemory(ctx.prisma, ctx.organizationId, input.brandId, ctx.session.user.id, input);
    return result.record;
  }),
});
