import { createHash } from "node:crypto";
import { z } from "zod";

// Imported operator research lives in the org-scoped Analysis table under its own
// record type so it can never be mistaken for a computed audit snapshot. Brand scope
// is pinned in the record and verified on every read; organization scope is the
// table-level boundary enforced by the tRPC procedures.
export const RESEARCH_MEMORY_RECORD_TYPE = "research_memory_v1";

const researchMemoryEntrySchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("imported_operator_research"),
  title: z.string().trim().min(3).max(200),
  sourceDoc: z.string().trim().min(1).max(500),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrls: z.array(z.string().url().max(2000)).max(50),
  importedAt: z.string().datetime(),
  importedBy: z.string().min(1),
  brandId: z.string().min(1),
  markdown: z.string().min(1).max(250000),
  version: z.number().int().positive(),
  supersedesId: z.string().nullable(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type ResearchMemoryEntry = z.infer<typeof researchMemoryEntrySchema>;
export type ResearchMemoryInput = Omit<ResearchMemoryEntry, "schemaVersion" | "kind" | "contentHash">;
export type ResearchMemoryRecord = { id: string; entry: ResearchMemoryEntry };

export type ResearchMemoryErrorCode = "unsupported" | "scope" | "integrity";
export class ResearchMemoryError extends Error {
  constructor(readonly code: ResearchMemoryErrorCode, message: string) {
    super(message);
    this.name = "ResearchMemoryError";
  }
}

export function researchMemoryContentHash(entry: Omit<ResearchMemoryEntry, "contentHash">): string {
  return createHash("sha256").update(JSON.stringify({
    schemaVersion: entry.schemaVersion, kind: entry.kind, title: entry.title, sourceDoc: entry.sourceDoc,
    sourceDate: entry.sourceDate, sourceUrls: entry.sourceUrls, importedAt: entry.importedAt,
    importedBy: entry.importedBy, brandId: entry.brandId, markdown: entry.markdown,
    version: entry.version, supersedesId: entry.supersedesId,
  })).digest("hex");
}

export function buildResearchMemoryEntry(input: ResearchMemoryInput): ResearchMemoryEntry {
  const entry = researchMemoryEntrySchema.omit({ contentHash: true }).parse({ ...input, schemaVersion: 1, kind: "imported_operator_research" });
  return { ...entry, contentHash: researchMemoryContentHash(entry) };
}

export function decodeResearchMemoryRecord(record: { id: string; data: unknown }, brandId: string): { id: string; entry: ResearchMemoryEntry } {
  const parsed = researchMemoryEntrySchema.safeParse(record.data);
  if (!parsed.success) throw new ResearchMemoryError("unsupported", "Unsupported research memory record; evidence withheld");
  const entry = parsed.data;
  if (entry.brandId !== brandId) throw new ResearchMemoryError("scope", "Research memory record not found in this brand scope");
  if (researchMemoryContentHash(entry) !== entry.contentHash)
    throw new ResearchMemoryError("integrity", "Research memory integrity check failed; evidence withheld");
  return { id: record.id, entry };
}
