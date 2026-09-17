# Campaign reporting and live-write boundaries

Technical source contract. This document contains no operator/customer/runtime
findings and makes no deployment or provider-ingestion claim.

## Accepted action policy

ADR 0002 permits operator-authorized existing-object Meta edits. Google/TikTok
stay read-only; creation of campaigns/ad sets/ads is outside that ADR, including
creation as PAUSED. Paused creation is still a provider mutation.

- `platform-launch/write-policy.ts` has no env flag or credential-based bypass.
- Campaign launch preflights the complete platform list before account resolution,
  token refresh, provider calls or local launch-result persistence. Blocked requests
  return FORBIDDEN, not a partial launch or a persisted draft result.
- Google/TikTok status/budget procedures reject before account resolution.
- Their direct exported launch/status/budget helpers also return blocked results
  before network access; Google budget rejection precedes the budget read.
- The direct Meta creation helper rejects before Graph access. Existing Meta
  status/budget implementations and the Meta operator desk are not expanded.
- Connection metadata distinguishes connected, canWrite and canLaunch. A read-only
  policy block is not repaired by reconnecting or obtaining a developer token.
- Campaign Studio explains planning-only creation and disables apply controls.
  Google/TikTok live edit controls are read-only, not additional permissions.

This patch does **not** certify every Meta surface's confirmation, account ownership
or audit behavior, complete campaign builders, conversational execution, new ADR
authority or production security. Those remain separately verified contracts.

## Stored campaign reporting

`marketing.getCampaignReportAccounts` returns organization/brand/platform-scoped
account metadata only. It selects no credentials and performs no credential refresh
or provider request. Viewer-level organization membership can read reports.

`marketing.getCampaignPerformance` adds platform, account, status and search scope.
Account selection is validated against the same organization/brand/platform scope.
Both metric and inventory queries share that scope. Meta platform aliases select
the Meta family, not a proven placement-level breakdown.

- Calendar dates are validated strictly and start must not follow end. Bounds are
  inclusive UTC boundaries of stored date keys, not a provider-timezone guarantee.
- Campaigns page supplies an explicit last-30-completed-UTC-days window and editable
  bounds. Other existing callers retain legacy all-time defaults for compatibility.
- Metric grouping is account/campaign/platform/currency, not campaign name. Current
  inventory names take precedence; latest stored metric names are the fallback.
- Lookup/row identity includes account and currency to avoid cross-account joining
  or aggregating unlike currency amounts. No historical collision is asserted.
- Search/status/market filter before truncation. Summary includes all matching
  stored rows, while `truncated` discloses the displayed limit.
- Spend totals stay separated by currency. The page does not convert currencies
  or silently add them. Local plans never substitute for synced summary KPIs.
- `metricState=no_stored_metrics` means unverified storage coverage, not verified
  zero provider activity. `stored_metrics` is not complete provider coverage either.
- Response `coverage=stored_only_not_provider_verified` and exact window disclose
  this limitation. Inventory status does not prove serving. Generic conversions
  are not labelled purchase orders or qualified wholesale leads.
- Empty scopes, errors and invalid windows have distinct UI states. Google/TikTok
  cards do not offer Meta edit controls. Local plans are separately labelled.

No schema migration, Sync, import/backfill, credential refresh, provider mutation,
deployment, queue/worker action or live OAuth consent is part of these report reads.
The surrounding authenticated application can still have its own normal session
refresh and unrelated existing queries; this is not a global DB-pure guarantee.

## Verification

Behavioral TDD covers provider-boundary denials, early router rejection, whole-list
creation preflight, preserved Meta edit paths, reporting account isolation/calendar
validation/currency/totals, and rendered platform/account/header/error/write UX.
External provider and Prisma boundaries are mocked; no live credentials, fixture
DB migration, provider upload or advertising action is used by these tests.

Run relevant Jest tests, `npx tsc --noEmit`, lint and full suite with unchanged coverage
thresholds. CI builds/smokes the merged source independently. Mocked tests and local
browser rendering never substitute for an approved production migration/deploy,
provider reconciliation or live operator action receipt.
