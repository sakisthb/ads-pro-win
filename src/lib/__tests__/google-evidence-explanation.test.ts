import { explainGoogleResearch, googleResearchProposalCsv } from "../google-evidence-explanation";
import { googleResearchFixture } from "@/test-utils/google-research-fixture";

it("explains the saved proposal with its exact Why/Evidence/Risk/next check and reference", () => {
  const record = googleResearchFixture(), before = JSON.stringify(record);
  const result = explainGoogleResearch(record, { question: "Γιατί το προτείνεις;", proposalId: "fixture-proposal" });
  expect(result.reference).toMatchObject({ id: record.id, contentHash: record.snapshot.contentHash, revision: 0 });
  expect(result.intent).toBe("why");
  expect(result.answer).toContain(record.snapshot.proposals[0].reason);
  expect(result.answer).toContain(record.snapshot.proposals[0].evidence);
  expect(result.answer).toContain(record.snapshot.proposals[0].risk);
  expect(result.answer).toContain(record.snapshot.proposals[0].nextCheck);
  expect(result.executionAllowed).toBe(false); expect(JSON.stringify(record)).toBe(before);
});
it("uses saved measurement steps for a next-step question, not invented campaigns or targets", () => {
  const result = explainGoogleResearch(googleResearchFixture(), { question: "Τι προτείνεις ως επόμενο βήμα;" });
  expect(result.intent).toBe("next"); expect(result.answer).toContain("Reconcile exact account and both windows");
  expect(result.answer).not.toMatch(/2\.5x|1\.5x|No emergency spend|Protect this performer/);
});
it.each(["What ROAS is working?", "Φτιάξε μου νέες χειμερινές καμπάνιες", "Activate two campaigns and change budget"]) (
  "never turns a question into a new study or provider action: %s", question => {
    const result = explainGoogleResearch(googleResearchFixture(), { question });
    expect(result.answer).toContain("not a new campaign-performance study");
    expect(result.answer).toContain("Google remains read-only"); expect(result.executionAllowed).toBe(false);
    expect(result.answer).not.toMatch(/\bROAS (0\.00|3\.00)x\b|campaigns activated|budget updated/i);
  },
);
it("labels unsupported free-form questions as unanswered rather than echoing a fake diagnosis", () => {
  const result = explainGoogleResearch(googleResearchFixture(), { question: "What is the weather?" });
  expect(result.intent).toBe("unsupported"); expect(result.answer).toContain("not answered by this frozen research packet");
});
it("refuses a missing proposal instead of silently using an unrelated one", () => {
  expect(() => explainGoogleResearch(googleResearchFixture(), { question: "Why?", proposalId: "foreign-proposal" })).toThrow(/Proposal not found/);
});
it("exports all research proposals with frozen scope metadata, never only the top ten", () => {
  const record = googleResearchFixture(); record.snapshot.proposals = Array.from({ length: 30 }, (_, i) => ({ ...record.snapshot.proposals[0], id: `proposal-${i}`, title: `Proposal ${i}` }));
  const csv = googleResearchProposalCsv(record);
  expect(csv).toContain('"proposal-29"'); expect(csv).toContain(record.snapshot.contentHash);
  expect(csv).toContain("2026-08-18"); expect(csv).toContain("2026-07-19"); expect(csv).toContain('"false"');
  expect(csv).toContain("research proposals, not a performance dataset");
});
it.each(["=SUM(A1)", "+formula", "@formula", "-formula", "\t=1"]) ("neutralizes spreadsheet formula cells: %s", title => {
  const record = googleResearchFixture(); record.snapshot.proposals[0].title = title;
  const csv = googleResearchProposalCsv(record);
  expect(csv).toContain(`"'${title}"`);
});
