import { buildPerformanceAudit, type AuditSnapshot } from "../performance-audit";
import { googleResearchProposals, googleResearchReviewMarkdown } from "../google-audit-research";

const empty: AuditSnapshot = { window: { startDate: "2026-08-18", endDate: "2026-09-16" }, campaigns: [], truncated: false,
  coverage: "stored_only_not_provider_verified", totals: { campaigns: 0, active: 0, storedMetricCampaigns: 0, unverifiedCampaigns: 0 } };
const audit = (current = empty) => buildPerformanceAudit({ current, goal: "sales", asOf: "2026-09-17", platform: "google", adAccountId: "fixture-account" });

it("turns empty coverage into reasoned measurement research, never invented campaign changes", () => {
  const proposals = googleResearchProposals(audit());
  expect(proposals).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "measurement", executionAllowed: false,
    reason: expect.any(String), evidence: expect.stringContaining("Missing observations"), successCriteria: expect.any(String) })]));
  expect(proposals.every(p => p.executionAllowed === false)).toBe(true);
  expect(proposals.some(p => p.campaignId)).toBe(false);
  expect(proposals.some(p => p.kind === "investigation")).toBe(false);
});
it("binds a provisional spend investigation to an actual stored campaign ID and states its limitations", () => {
  const current = { ...empty, campaigns: [{ adAccountId: "fixture-account", campaignId: "fixture-campaign", campaignName: "Fixture Search",
    platform: "google", status: "paused", currency: "EUR", objective: "SALES", metricState: "stored_metrics" as const,
    totalSpend: 100, totalConversionValue: 0, totalConversions: 0, totalClicks: 20, totalImpressions: 1000 }],
    totals: { campaigns: 1, active: 0, storedMetricCampaigns: 1, unverifiedCampaigns: 0 } };
  const proposal = googleResearchProposals(audit(current)).find(p => p.kind === "investigation");
  expect(proposal).toMatchObject({ campaignId: "fixture-campaign", confidence: "provisional", executionAllowed: false });
  expect(proposal?.risk).toMatch(/lag|tracking/i);
  expect(proposal?.expectedEffect).toMatch(/not.*forecast/i);
});
it("does not propose campaign investigations for invalid or truncated observations", () => {
  expect(googleResearchProposals(audit({ ...empty, truncated: true })).some(p => p.kind === "investigation")).toBe(false);
});
it("rejects a non-Google audit rather than relabelling another provider's evidence", () => {
  expect(() => googleResearchProposals({ ...audit(), platform: "meta" })).toThrow(/Google/);
});
it("exports frozen evidence, rationale and escaped review notes without implying execution", () => {
  const md = googleResearchReviewMarkdown({ id: "fixture", snapshot: { reportMarkdown: "# Frozen evidence", revision: 1,
    contentHash: "a".repeat(64), createdAt: "2026-09-17T12:00:00Z", engine: "stored_rules_v1", reviewStatus: "accepted_research",
    proposals: googleResearchProposals(audit()), reviews: [{ actorId: "fixture-user", at: "2026-09-17T12:01:00Z", decision: "accepted_research", note: "[unsafe](https://invalid.example)", revision: 1 }] } } as never);
  expect(md).toContain("# Frozen evidence"); expect(md).toContain("Research acceptance is not execution approval");
  expect(md).toContain("Why:"); expect(md).toContain("\\[unsafe\\]");
});
