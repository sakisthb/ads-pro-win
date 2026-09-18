import { auditEvidenceReference, auditEvidenceUrl, matchesAuditEvidenceReference, parseAuditEvidenceSearch } from "../audit-evidence-reference";
import { googleResearchFixture } from "@/test-utils/google-research-fixture";

it("round trips an exact snapshot/checksum/review revision in Chat and Reports links", () => {
  const ref = auditEvidenceReference(googleResearchFixture());
  for (const route of ["/chat", "/reports"] as const) {
    const url = new URL(auditEvidenceUrl(route, ref), "http://localhost");
    expect(url.pathname).toBe(route);
    expect(parseAuditEvidenceSearch(url.searchParams)).toEqual({ mode: "scoped", reference: ref });
  }
});
it("keeps normal workspace/brand URLs separate from scoped research", () => {
  expect(parseAuditEvidenceSearch(new URLSearchParams("brand=fixture-brand"))).toEqual({ mode: "workspace" });
});
it.each(["auditId=fixture-snapshot", "auditRevision=0", "auditHash=bad"]) ("fails closed on partial scoped URLs: %s", search => {
  expect(parseAuditEvidenceSearch(new URLSearchParams(search))).toEqual({ mode: "invalid" });
});
it.each(["-1", "1.5", "01", "Infinity", "9007199254740992"]) ("rejects ambiguous/invalid revisions: %s", revision => {
  const url = new URL(auditEvidenceUrl("/chat", auditEvidenceReference(googleResearchFixture())), "http://localhost");
  url.searchParams.set("auditRevision", revision);
  expect(parseAuditEvidenceSearch(url.searchParams)).toEqual({ mode: "invalid" });
});
it("rejects duplicate audit scope parameters rather than choosing a convenient one", () => {
  const url = new URL(auditEvidenceUrl("/reports", auditEvidenceReference(googleResearchFixture())), "http://localhost");
  url.searchParams.append("brand", "other-brand");
  expect(parseAuditEvidenceSearch(url.searchParams)).toEqual({ mode: "invalid" });
});
it("withholds responses with a changed record, account, hash or review revision", () => {
  const record = googleResearchFixture(), ref = auditEvidenceReference(record);
  expect(matchesAuditEvidenceReference(record, ref)).toBe(true);
  for (const changed of [{ ...ref, id: "other" }, { ...ref, adAccountId: "other" }, { ...ref, brandId: "other" },
    { ...ref, contentHash: "b".repeat(64) }, { ...ref, revision: 1 }]) expect(matchesAuditEvidenceReference(record, changed)).toBe(false);
});
