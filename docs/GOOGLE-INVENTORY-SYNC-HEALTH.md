# Google inventory and reporting health

## Scope

This patch separates Google campaign inventory from dated reporting metrics and qualifies Dashboard reporting health. It does not change ad permissions, create campaigns, change budgets, run a data Sync, or introduce a schema migration.

Manual Google Sync and the Google worker use the same reporting service and existing credential-refresh helper. Inventory is fetched independently of metric activity, with stored manager-account context preserved. Non-removed campaign objects can therefore be imported even when a valid reporting window has no metric rows. Enabled status is not a guarantee of serving; provider primary status remains separate.

Both Google fetches must return structurally valid results before persistence begins. Malformed responses and supplied non-finite metric values fail rather than becoming fabricated zero activity. Legitimate empty SearchStream responses and unset protobuf numeric fields remain accepted. A failed inventory fetch does not advance the successful-sync timestamp. Inactive or platform-mismatched queued accounts are rejected.

## Reporting truth

- Dashboard health counts active accounts whose latest job completed and whose valid, non-future successful-sync timestamp is within 24 hours.
- Failed, stale, unknown and in-progress reporting is not counted as ready. Inactive accounts are excluded.
- Unverified Email reporting is qualified in clocks, blockers, insights and the Email panel. Missing evidence is not presented as quiet delivery activity.
- Google zero stored spend is labeled as a reporting-coverage question, not a reason to infer insufficient API access or reconnect.
- A recent successful run is not proof of selected-window completeness, provider-confirmed zero activity, OAuth longevity, or overall application readiness.

## Verification

Local verification on 2026-09-17: 78 Jest suites / 719 tests passed, including coverage thresholds; TypeScript, lint with existing warnings, and production build passed. Provider and persistence boundaries in the new tests are mocked. Authenticated localhost Chrome rendering was checked without clicking Sync, Connect or campaign actions.

The initial sandbox-restricted full suite encountered local socket permission failures; the complete rerun with normal socket permissions passed without excluding suites. Local production-build environment validation required a build-only Redis placeholder; that does not verify a running Redis service.

Existing Connections queries can refresh stored OAuth credentials while rendering the account lists. Browser navigation is consequently not guaranteed to be database-pure read-only, even without a new OAuth consent flow.

## Remaining limitations and release gates

1. No actual provider ingestion or production deployment is claimed by local tests or PR CI.
2. A durable per-run coverage receipt is still needed: account identity, requested dates, timezone, execution path, separate metric/inventory counts, and success/error/partial evidence.
3. Inventory is non-removed, merge/upsert only. Removed-object reconciliation, budget metadata and full serving/billing readiness are outside this patch.
4. Existing batched persistence is not one atomic transaction for the entire import. Persistence failures can leave partial rows without completing the job.
5. The provider rewrite is scoped to Google. Other providers and all reporting labels have not received an exhaustive cross-provider reconciliation.
6. Web and worker release planning requires separate approval. Starting or replacing a worker can execute pending or scheduled jobs automatically; queue behavior and reporting windows must be agreed before that step.
7. External OAuth lifecycle, Email provider security policy and hosted catalog integration remain separate operational gates. Google ad mutations remain read-only under the current operating contract.

The full operator audit is maintained locally, separately from this public technical note. Customer financial data, operational identifiers, diagnostics, environment files and credentials are not part of this PR.
