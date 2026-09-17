# Google reporting coverage receipts — v1

This follow-up depends on the Google inventory / truthful-health foundation patch. It adds reporting evidence, not an ad-write permission or an instruction to deploy or run Sync.

## Durable contract

Each new Google metric SyncJob gets one `SyncCoverageReceipt`, keyed by the job ID. Legacy jobs remain without receipts; no retrospective backfill of evidence is performed.

The receipt stores:

- customer and actual login-customer context;
- exact inclusive query dates, execution path (`manual` / `worker`), API version and SearchStream transport;
- `non_removed_campaigns` query scope;
- provider-reported timezone and currency, validated against customer identity;
- separate fetched and persisted metric/inventory row counts;
- run status, processing stage, start/end times and a conservative partial-storage flag.

Unknown counts remain NULL, not zero. Persisted counts describe writes successfully returned by an import stage, not necessarily new rows or the final total stored in the database. A batched stage that fails can have unknown partial writes.

The shared runner creates the initial receipt before credential refresh or provider requests. Metrics, inventory and customer metadata must validate before import. Currency mismatch against the stored connector stops import rather than labeling native spend with an incorrect currency. It does not automatically change connector identity/currency.

Before batched persistence, the runner durably records possible partial storage. Successful receipt, completed job and account freshness timestamp commit together in one transaction. Failure evidence uses the known counts and stage; the original failure is preserved if the database also rejects its failure receipt. A process crash can leave a running/unverified receipt with the partial-risk flag set. This is not whole-import atomicity.

## Read-only surface

`syncStatus.getGoogleCoverage` authorizes the account through organization ownership and returns at most ten Google metric runs. It returns explicit `migration_required` only when the receipt table is missing; unrelated database failures remain errors. Existing status APIs do not automatically select the new relation.

Connections displays the latest three runs, with exact scope/window, customer context, provider timezone, separate counts and unknown/partial qualification. Missing migration, legacy runs, errors and unsupported/incomplete receipts never become verified zero activity. It makes no Sync, OAuth or campaign-action request to obtain proof.

A completed zero-row query means zero returned rows for this non-removed-campaign query scope and window. It is not all-account zero activity, removed-campaign coverage, a later provider readback, or completeness of another Dashboard window. Empty fetches do not clear old stored rows.

## Migration and rollout gates

The additive migration creates only the receipt table and its cascading job foreign key, enabling deny-by-default RLS with no public client policy. It revokes this table's PUBLIC privileges and any inherited default grants for existing `anon` / `authenticated` roles (conditional so vanilla test Postgres does not need those roles). It does not rewrite history, existing tables or other role permissions. The trusted Prisma database role must own the table or have BYPASSRLS; application API reads still enforce organization ownership. Database-level anon/authenticated deny and trusted-server access must be verified before production use. RLS/grants are SQL-only migration additions, not represented by the Prisma schema diff. Client generation, schema validation and a schema-to-schema SQL diff do not apply a database migration.

Database migration execution/drift validation must pass in a disposable test/CI database before any approved production migration. Production migration, web/worker release, queue/scheduled-job behavior and actual provider Sync require their separate reviewed rollout plan and authorization. Starting a worker can execute pending or scheduled jobs automatically.

## Disposable CI database verification

The migration-validation job runs `scripts/verify-google-coverage-db.cjs prepare` before migrations and `verify` after apply/status/drift. Both entry points require `CI=true`, `GITHUB_ACTIONS=true`, and the exact workflow-owned localhost test database URL for both Prisma URLs. The script does not load dotenv and rejects unsafe environments before constructing a client; it also checks the connected database identity. Never run it against an operator or hosted database.

Preparation creates non-login, non-superuser, non-BYPASSRLS fixture roles and deliberately broad default grants to exercise migration revocation. Verification checks RLS/no policies/no PUBLIC or client table grants, native Prisma CRUD/defaults/NULL counts/legacy relation/cascade, denied client CRUD, and independent RLS filtering/rejection under temporary CRUD grants. A temporary nonsuperuser table owner proves the owner-access path without relying only on the CI superuser. Expected denials must be PostgreSQL `42501`; missing-table or connectivity errors cannot count as privacy proof.

All verification fixtures, temporary grants and ownership changes roll back, with explicit post-rollback checks. Role/default-grant preparation is confined to the disposable CI service. The vanilla smoke database separately applies/status-checks the conditional migration without client fixture roles. Both migration URLs are explicitly set to the smoke database so Prisma's direct connection cannot silently migrate a different database from the application container. Passing these checks verifies the CI database contract, not actual hosted Prisma credentials, Supabase Data API configuration, provider ingestion or production deployment.

## Remaining boundaries

- No actual provider import is proved by mocked tests or the missing-migration browser state.
- Import stages remain batched, not one transaction for all reporting data.
- No removed-object reconciliation, zero-window clearing, budget metadata or provider/DB totals readback is introduced.
- Concurrent account remapping, stale concurrent runs and cross-provider coverage reconciliation require separate safeguards; receipts are not a global consistency lock.
- The receipt panel does not automatically mark the Dashboard's selected window as provider-verified.
- External OAuth lifecycle, Email security policy and catalog hosting remain separate gates. Google Ads remains read-only.

Provider metadata follows the official [Google Ads Customer contract](https://developers.google.com/google-ads/api/reference/rpc/v25/Customer).

Private-table protection follows the official [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security); custom SQL features follow [Prisma migration guidance](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features).

CI role probes follow the official [PostgreSQL row-security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html) and [SET ROLE](https://www.postgresql.org/docs/16/sql-set-role.html) contracts.
