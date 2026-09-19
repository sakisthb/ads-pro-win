# Google Hygiene & Operator — implementation plan

## Outcome

Turn the Performance Marketing Desk into an evidence-first Google Ads operator without weakening ADR 0003. The system must first prove what exists, classify each issue, and only then expose an approved action contract.

The four operator dispositions are:

- `Detected` — a native fact exists, but the safe next action is not yet established.
- `Repairable in ADPD` — an existing ADR 0003 contract can handle the exact target after preview and confirmation.
- `Manual Google action` — Google Ads or Merchant Center must currently perform the action.
- `Monitoring` — evidence should be observed before a change is proposed.

## Milestones

### M1 — Native Full Account Hygiene Audit

- Read the exact organization-owned Google Ads spend account.
- Inventory current campaigns, ads, positive keywords, campaign assets and conversion actions.
- Surface policy, destination, network, asset and measurement findings.
- Classify every finding into one of the four dispositions.
- Show coverage and truncation explicitly; provider failures never become an empty-success report.
- Render the result in Account Audit with a clear handoff to the existing Google Repair Desk.
- No provider mutation, persistence, policy resubmission or automatic repair.

Acceptance:

- Search + Content Network is classified as repairable through the existing one-way network repair.
- An existing Search RSA policy/destination issue is classified as repairable only for the fields ADR 0003 supports.
- Unsupported asset, PMax, goal and policy operations are classified as manual Google actions.
- Limited or misconfigured campaign states are monitoring findings unless a specific supported repair is proven.
- Account, brand and organization isolation are covered by tests.

### M2 — Durable snapshots and change history

- Store immutable, organization-scoped hygiene snapshots.
- Diff new scans against the prior verified snapshot.
- Track first seen, last seen, resolved and regressed findings.
- Add downloadable Markdown and JSON receipts.

### M3 — Repair proposal bridge

- Convert only `Repairable in ADPD` findings into exact Repair Desk drafts.
- Preserve native IDs and before-state; require fresh readback before preview.
- Record operator decisions independently from execution receipts.

### M4 — Policy and asset contracts

- Add narrowly scoped policy resubmission and asset-link management contracts.
- Keep asset creation/editing separate from association pause.
- Add explicit provider acknowledgement, validate-only where supported, single mutation and native readback.

### M5 — Campaign operator contracts

- Add separate contracts for campaign status, budget and creation.
- Require strategy evidence, spend-impact preview, confirmation and post-write reconciliation.
- PMax and Merchant Center remain separate product lanes.

### M6 — SEO/GEO evidence connectors

- Import normalized evidence from Nozzle, Scalenut and Ranktracker.
- Keep SEO evidence separate from Google Ads canonical metrics.
- Use the evidence in landing-page, keyword and content proposals with source/time provenance.

## Safety and tenancy invariants

- Every provider read is scoped to one owned `brandId` + `adAccountId` + native customer ID.
- Read-only audit never implies permission to write.
- No finding is invented when coverage is partial or a provider query fails.
- No cross-organization fallback, shared cached inventory or generic all-account scan.
- Existing ADR 0003 remains the only Google write path until later ADRs are reviewed and accepted.

## Delivery sequence

M1 is the current implementation unit. M2–M6 remain explicit follow-up milestones and must not be bundled into the first release.
