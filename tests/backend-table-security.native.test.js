/** @jest-environment node */
// Opt-in native test. No dotenv and never use DATABASE_URL from the operator env.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.ADPRO_NATIVE_SECURITY_TEST_URL;
const suite = url ? describe : describe.skip;
const migrationPath = resolve('prisma/migrations/20260917103000_harden_backend_tables/migration.sql');
const tables = [
  'AdAccount', 'AdCampaign', 'ApprovalRequest', 'Brand', 'DailyMetric',
  'MetaWriteLog', 'SyncJob', 'WooOrder', 'WooProduct', '_prisma_migrations',
  'ai_agents', 'alert_rules', 'analyses', 'api_integrations', 'campaigns',
  'invitations', 'notifications', 'oauth_transactions', 'optimizations',
  'organization_memberships', 'organizations', 'predictions', 'users',
  'websocket_tickets', 'workflows', 'SyncCoverageReceipt',
];

function run(sql) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)
      || !['58417', '5432'].includes(parsed.port)
      || parsed.pathname !== '/adspro_containment_test'
      || parsed.username !== 'postgres') throw new Error('Refusing non-disposable native test URL');
  const result = spawnSync(process.env.ADPRO_NATIVE_PSQL || 'psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: sql, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, PGHOST: parsed.hostname, PGPORT: parsed.port,
      PGUSER: parsed.username, PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: 'adspro_containment_test' },
  });
  if (result.error || result.status !== 0) throw new Error(`Disposable SQL failed: ${result.stderr}`);
  return result.stdout;
}

function fixture(includeReceipt = true) {
  return `BEGIN;
    DO $$ BEGIN
      IF current_database() <> 'adspro_containment_test' OR current_user <> 'postgres'
      THEN RAISE EXCEPTION 'Unexpected native fixture identity'; END IF;
    END $$;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE backend_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, backend_owner;
    GRANT CREATE ON SCHEMA public TO backend_owner;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated;
    ${tables.filter(t => includeReceipt || t !== 'SyncCoverageReceipt').map(t => `
      CREATE TABLE public."${t}" (id text PRIMARY KEY, secret text);
      INSERT INTO public."${t}" VALUES ('fixture', 'not-real-data');
      GRANT SELECT(secret), UPDATE(secret), INSERT(secret), REFERENCES(secret)
        ON public."${t}" TO PUBLIC, anon, authenticated;
    `).join('\n')}
    CREATE SCHEMA auth;
    CREATE TABLE auth.sentinel(id text);
    CREATE TABLE public.client_sentinel(id text);
  `;
}

const migration = () => existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

suite('native server-only backend table containment', () => {
  it('denies effective table and column grants, enables default-deny RLS and preserves nonowner-managed schemas', () => {
    const checks = tables.map(t => `
      IF NOT (SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class
        WHERE oid = 'public."${t}"'::regclass) THEN RAISE EXCEPTION 'Backend RLS missing'; END IF;
      FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF has_table_privilege(client_role, 'public."${t}"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege(client_role, 'public."${t}"', 'SELECT,INSERT,UPDATE,REFERENCES')
          THEN RAISE EXCEPTION 'Backend privileges remain'; END IF;
      END LOOP;
    `).join('\n');
    expect(run(fixture() + migration() + `
      DO $$ DECLARE client_role text; BEGIN ${checks}
        IF NOT has_table_privilege('anon', 'public.client_sentinel', 'SELECT')
          OR (SELECT relrowsecurity FROM pg_class WHERE oid='auth.sentinel'::regclass)
          THEN RAISE EXCEPTION 'Unrelated object changed'; END IF;
      END $$;
      CREATE TABLE public.future_backend(id text);
      DO $$ BEGIN IF has_table_privilege('anon','public.future_backend','SELECT')
        OR has_table_privilege('authenticated','public.future_backend','INSERT')
        THEN RAISE EXCEPTION 'Default table privileges remain'; END IF; END $$;
      ROLLBACK; SELECT 'security-pass';
    `)).toContain('security-pass');
  });

  it('rejects client CRUD and independently filters rows after temporary grants, while nonsuperuser owner CRUD still works', () => {
    const denied = ['anon', 'authenticated'].flatMap(role => [
      'SELECT secret FROM public."AdAccount"',
      'INSERT INTO public."AdAccount" VALUES (\'client\',\'client\')',
      'UPDATE public."AdAccount" SET secret=\'client\'',
      'DELETE FROM public."AdAccount"',
    ].map(sql => `SET LOCAL ROLE ${role}; DO $$ BEGIN
      BEGIN EXECUTE ${"'" + sql.replaceAll("'", "''") + "'"};
        RAISE EXCEPTION 'Client operation unexpectedly succeeded';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END $$; RESET ROLE;`)).join('\n');
    expect(run(fixture() + migration() + denied + `
      GRANT SELECT,INSERT,UPDATE,DELETE ON public."AdAccount" TO anon;
      SET LOCAL ROLE anon;
      DO $$ BEGIN
        IF (SELECT count(*) FROM public."AdAccount") <> 0 THEN RAISE EXCEPTION 'RLS leaked rows'; END IF;
        UPDATE public."AdAccount" SET secret='rls';
        IF FOUND THEN RAISE EXCEPTION 'RLS allowed update'; END IF;
        DELETE FROM public."AdAccount";
        IF FOUND THEN RAISE EXCEPTION 'RLS allowed delete'; END IF;
        BEGIN INSERT INTO public."AdAccount" VALUES ('rls','rls');
          RAISE EXCEPTION 'RLS allowed insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      END $$; RESET ROLE;
      ALTER TABLE public."AdAccount" OWNER TO backend_owner;
      SET LOCAL ROLE backend_owner;
      DO $$ BEGIN
        IF (SELECT count(*) FROM public."AdAccount") <> 1 THEN RAISE EXCEPTION 'Owner read blocked'; END IF;
        INSERT INTO public."AdAccount" VALUES ('owner','owner');
        UPDATE public."AdAccount" SET secret='updated' WHERE id='owner';
        DELETE FROM public."AdAccount" WHERE id='owner';
      END $$; RESET ROLE;
      ROLLBACK; SELECT 'crud-pass';
    `)).toContain('crud-pass');
  });

  it('is idempotent and can contain the legacy schema before the optional receipt table exists', () => {
    expect(run(fixture(false) + migration() + migration() + `
      DO $$ BEGIN IF has_table_privilege('anon','public."AdAccount"','SELECT')
        THEN RAISE EXCEPTION 'Legacy table access remains'; END IF; END $$;
      ROLLBACK; SELECT 'legacy-pass';
    `)).toContain('legacy-pass');
  });

  it.each([
    'CREATE POLICY unexpected ON public."AdAccount" USING (true);',
    'ALTER TABLE public."AdAccount" FORCE ROW LEVEL SECURITY;',
    'ALTER TABLE public."AdAccount" OWNER TO backend_owner;',
    'GRANT SELECT ON public."AdAccount" TO backend_owner; GRANT backend_owner TO anon;',
    'ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO anon;',
  ])('aborts atomically for unexpected policy, owner, inheritance or global defaults: %s', (unexpected) => {
    expect(() => run(fixture() + unexpected + migration() + 'ROLLBACK;'))
      .toThrow('Disposable SQL failed');
    expect(run(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='AdAccount';`)).toMatch(/0/);
    expect(run("SELECT count(*) FROM pg_roles WHERE rolname='backend_owner';")).toMatch(/0/);
  });
});
