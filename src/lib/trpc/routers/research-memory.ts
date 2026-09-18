import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationAdminProcedure, organizationProcedure } from "../server";
import {
  RESEARCH_MEMORY_RECORD_TYPE,
  ResearchMemoryError,
  buildResearchMemoryEntry,
  decodeResearchMemoryRecord,
  type ResearchMemoryRecord,
} from "@/lib/research-memory";

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
  const records = await prisma.analysis.findMany({
    where: { organizationId, type: RESEARCH_MEMORY_RECORD_TYPE, AND: [{ data: { path: ["brandId"], equals: brandId } }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, data: true },
  });
  const decoded: ResearchMemoryRecord[] = [];
  for (const record of records) {
    try {
      decoded.push(decodeResearchMemoryRecord(record, brandId));
    } catch {
      // Tampered records are withheld, never half-decoded into the list.
    }
  }
  return decoded;
}

function sameImportedContent(record: ResearchMemoryRecord, input: z.infer<typeof importSchema>): boolean {
  const entry = record.entry;
  return entry.title === input.title && entry.sourceDoc === input.sourceDoc && entry.sourceDate === input.sourceDate &&
    JSON.stringify(entry.sourceUrls) === JSON.stringify(input.sourceUrls) && entry.markdown === input.markdown;
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
    const existing = (await storedRecords(ctx.prisma, ctx.organizationId, input.brandId))
      .filter(record => record.entry.sourceDoc === input.sourceDoc)
      .sort((a, b) => b.entry.version - a.entry.version);
    const latest = existing[0];
    if (latest && sameImportedContent(latest, input)) return latest;
    const entry = buildResearchMemoryEntry({
      title: input.title, sourceDoc: input.sourceDoc, sourceDate: input.sourceDate, sourceUrls: input.sourceUrls,
      importedAt: new Date().toISOString(), importedBy: ctx.session.user.id, brandId: input.brandId,
      markdown: input.markdown, version: latest ? latest.entry.version + 1 : 1, supersedesId: latest?.id ?? null,
    });
    const record = await ctx.prisma.analysis.create({ data: { organizationId: ctx.organizationId, type: RESEARCH_MEMORY_RECORD_TYPE,
      title: entry.title, status: "research_imported", data: entry as Prisma.InputJsonValue }, select: { id: true, data: true } });
    return decodeResearchMemoryRecord(record, input.brandId);
  }),
});
