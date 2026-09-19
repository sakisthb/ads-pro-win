import { z } from "zod";
import type { GoogleResearchRecord } from "./trpc/routers/google-research";

export const auditEvidenceReferenceSchema = z.object({
  id: z.string().min(1).max(200), brandId: z.string().min(1).max(200), adAccountId: z.string().min(1).max(200),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();
export type AuditEvidenceReference = z.infer<typeof auditEvidenceReferenceSchema>;

export function auditEvidenceReference(record: GoogleResearchRecord): AuditEvidenceReference {
  return { id: record.id, brandId: record.snapshot.scope.brandId, adAccountId: record.snapshot.scope.adAccountId,
    contentHash: record.snapshot.contentHash, revision: record.snapshot.revision };
}
export function matchesAuditEvidenceReference(record: GoogleResearchRecord, ref: AuditEvidenceReference): boolean {
  const actual = auditEvidenceReference(record);
  return record.snapshot.scope.platform === "google" && record.snapshot.executionAllowed === false &&
    actual.id === ref.id && actual.brandId === ref.brandId && actual.adAccountId === ref.adAccountId &&
    actual.contentHash === ref.contentHash && actual.revision === ref.revision;
}
export function auditEvidenceUrl(route: "/chat" | "/reports", ref: AuditEvidenceReference): string {
  return `${route}?${new URLSearchParams({ auditId: ref.id, brand: ref.brandId, auditAccount: ref.adAccountId,
    auditHash: ref.contentHash, auditRevision: String(ref.revision) })}`;
}

type Search = Pick<URLSearchParams, "has" | "getAll">;
/** An incomplete scoped link must never fall through to organization-wide tools. */
export function parseAuditEvidenceSearch(search: Search):
  { mode: "workspace" } | { mode: "invalid" } | { mode: "scoped"; reference: AuditEvidenceReference } {
  const scopedKeys = ["auditId", "auditAccount", "auditHash", "auditRevision"];
  if (!scopedKeys.some(k => search.has(k))) return { mode: "workspace" };
  const keys = [...scopedKeys, "brand"];
  if (keys.some(k => search.getAll(k).length !== 1)) return { mode: "invalid" };
  const value = (key: string) => search.getAll(key)[0];
  if (!/^(0|[1-9]\d*)$/.test(value("auditRevision"))) return { mode: "invalid" };
  const parsed = auditEvidenceReferenceSchema.safeParse({ id: value("auditId"), brandId: value("brand"),
    adAccountId: value("auditAccount"), contentHash: value("auditHash"), revision: Number(value("auditRevision")) });
  return parsed.success ? { mode: "scoped", reference: parsed.data } : { mode: "invalid" };
}
