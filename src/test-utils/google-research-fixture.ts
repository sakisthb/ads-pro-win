import type { GoogleResearchRecord } from "@/lib/trpc/routers/google-research";

export function googleResearchFixture(): GoogleResearchRecord {
  return { id: "fixture-snapshot", snapshot: {
    schemaVersion: 1, engine: "stored_rules_v1", createdBy: "fixture-user", createdAt: "2026-09-17T12:00:00Z",
    scope: { brandId: "fixture-brand", adAccountId: "fixture-account", platform: "google", market: "all", goal: "sales",
      brandName: "Fixture shop", accountName: "Fixture Google", providerAccountId: "1111111111",
      window: { startDate: "2026-08-18", endDate: "2026-09-16" }, comparison: { mode: "previous" },
      baselineWindow: { startDate: "2026-07-19", endDate: "2026-08-17" } },
    verdict: "blocked", reportMarkdown: "# Fixture frozen evidence\nCoverage Unverified; all loaded inventory retained.",
    contentHash: "a".repeat(64), revision: 0, reviewStatus: "pending", reviews: [], executionAllowed: false,
    proposals: [{ id: "fixture-proposal", kind: "measurement", title: "Verify account coverage", reason: "Missing evidence prevents campaign decisions",
      evidence: "Stored subset is not native completeness", nextCheck: "Reconcile exact account and both windows", successCriteria: "Verified coverage receipt",
      risk: "Attribution maturity remains unknown", confidence: "observed", expectedEffect: "Better evidence, not a ROAS forecast", executionAllowed: false }],
  } };
}
