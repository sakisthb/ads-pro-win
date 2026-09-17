# Server-only backend table security

Prisma application models are accessed through the trusted backend, not browser
Supabase REST/GraphQL. Supabase Auth remains a separate managed service. Do not
disable the Data API globally or grant client access just to remove an error.

`20260917103000_harden_backend_tables` is an atomic, idempotent containment:

- An explicit 25-table backend allowlist plus optional `SyncCoverageReceipt`.
- Default-deny RLS, no client policies, no FORCE RLS or ownership change.
- Revoke PUBLIC/anon/authenticated table **and explicit column** privileges.
- Verify effective inherited client privileges were removed; otherwise abort.
- Revoke public-schema client table defaults only for the current migration owner.
- Refuse global default grants, unexpected owners/policies/FORCE or missing legacy
  tables rather than silently widening scope. Preserve service_role and managed
  Auth/Storage/other creator roles/unrelated client tables.

Trusted connections must own these tables or have BYPASSRLS. The migration runner
must own them. New tables created by other roles still require reviewed security;
this migration is not an exhaustive function/view/future-schema access audit.

A separately approved one-off legacy containment can run the same statement
before a receipt release. Do not fabricate Prisma migration history or use a
generic deploy as a shortcut: the normal later migration is safe to replay.
Record real production execution privately, not real account details in this doc.

## Native behavior verification

`tests/backend-table-security.native.test.js` never loads dotenv or uses the
operator DATABASE_URL. It is opt-in and guards loopback/port, PostgreSQL user and
exact disposable `adspro_containment_test` database before spawning psql.
CI creates that separate database before preparing the coverage test roles.

Tests reproduce broad default/PUBLIC/table/column grants and prove restricted
role CRUD denial, independent RLS filtering, nonsuperuser owner CRUD, unaffected
Auth/client sentinel, future defaults, idempotence and atomic failure/rollback
for unexpected policies, owners, inherited and global grants. Fixtures and roles
are transactionally rolled back. Never run fixture creation on production.

For an already-created disposable local cluster on port58417:

```bash
ADPRO_NATIVE_SECURITY_TEST_URL=postgresql://postgres@127.0.0.1:58417/adspro_containment_test \
ADPRO_NATIVE_PSQL=/path/to/psql \
npx jest tests/backend-table-security.native.test.js --runInBand --no-coverage
```

Missing opt-in env skips native tests in ordinary unit runs; a passing unit suite
with skips is not native DB proof. CI explicitly opts in. Restore/privacy receipts,
backup archives, keys, environment and operator account data remain private.
