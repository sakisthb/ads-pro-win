import type { Prisma, PrismaClient } from "@prisma/client";
import {
  RESEARCH_MEMORY_RECORD_TYPE,
  buildResearchMemoryEntry,
  decodeResearchMemoryRecord,
  type ResearchMemoryRecord,
} from "@/lib/research-memory";

// Persistence core shared by the tRPC router and the release-time import
// script, so scripted imports can never drift from in-app import behavior.
// Authorization (org role, owned brand) stays in the router; this module
// assumes the caller already enforced it.

export interface ResearchMemoryImportInput {
  title: string;
  sourceDoc: string;
  sourceDate: string;
  sourceUrls: string[];
  markdown: string;
}

export type ResearchMemoryImportResult =
  | { status: "imported"; record: ResearchMemoryRecord }
  | { status: "unchanged"; record: ResearchMemoryRecord };

export async function storedResearchMemoryRecords(prisma: PrismaClient, organizationId: string, brandId: string): Promise<ResearchMemoryRecord[]> {
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

function sameImportedContent(record: ResearchMemoryRecord, input: ResearchMemoryImportInput): boolean {
  const entry = record.entry;
  return entry.title === input.title && entry.sourceDoc === input.sourceDoc && entry.sourceDate === input.sourceDate &&
    JSON.stringify(entry.sourceUrls) === JSON.stringify(input.sourceUrls) && entry.markdown === input.markdown;
}

export async function importResearchMemory(
  prisma: PrismaClient,
  organizationId: string,
  brandId: string,
  importedBy: string,
  input: ResearchMemoryImportInput,
): Promise<ResearchMemoryImportResult> {
  const existing = (await storedResearchMemoryRecords(prisma, organizationId, brandId))
    .filter(record => record.entry.sourceDoc === input.sourceDoc)
    .sort((a, b) => b.entry.version - a.entry.version);
  const latest = existing[0];
  if (latest && sameImportedContent(latest, input)) return { status: "unchanged", record: latest };
  const entry = buildResearchMemoryEntry({
    title: input.title, sourceDoc: input.sourceDoc, sourceDate: input.sourceDate, sourceUrls: input.sourceUrls,
    importedAt: new Date().toISOString(), importedBy, brandId,
    markdown: input.markdown, version: latest ? latest.entry.version + 1 : 1, supersedesId: latest?.id ?? null,
  });
  const record = await prisma.analysis.create({ data: { organizationId, type: RESEARCH_MEMORY_RECORD_TYPE,
    title: entry.title, status: "research_imported", data: entry as Prisma.InputJsonValue }, select: { id: true, data: true } });
  return { status: "imported", record: decodeResearchMemoryRecord(record, brandId) };
}
