/** @jest-environment node */
// Opt-in native test. No dotenv and never use DATABASE_URL from the operator env.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.ADPRO_NATIVE_CHAT_TEST_URL;
const suite = url ? describe : describe.skip;
const migrationPath = resolve('prisma/migrations/20260918143000_add_org_scoped_chat_history/migration.sql');

function run(sql) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)
      || !['58417', '5432'].includes(parsed.port)
      || parsed.pathname !== '/adspro_chat_isolation_test'
      || parsed.username !== 'postgres') throw new Error('Refusing non-disposable native test URL');
  const result = spawnSync(process.env.ADPRO_NATIVE_PSQL || 'psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: sql, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, PGHOST: parsed.hostname, PGPORT: parsed.port,
      PGUSER: parsed.username, PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: 'adspro_chat_isolation_test' },
  });
  if (result.error || result.status !== 0) throw new Error(`Disposable SQL failed: ${result.stderr}`);
  return result.stdout;
}

function fixture() {
  return `BEGIN;
    DO $$ BEGIN
      IF current_database() <> 'adspro_chat_isolation_test' OR current_user <> 'postgres'
      THEN RAISE EXCEPTION 'Unexpected chat fixture identity'; END IF;
    END $$;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE TABLE public.organizations (id text PRIMARY KEY);
    INSERT INTO public.organizations VALUES ('org-1'), ('org-2');
    CREATE SCHEMA auth;
    -- Real Supabase provides auth.uid(); the disposable cluster stubs it from a
    -- per-transaction GUC so each test user can be simulated.
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS text
      LANGUAGE sql STABLE AS $$ SELECT current_setting('adpro.chat_test_uid', true) $$;
    CREATE TABLE public.organization_memberships (
      id text PRIMARY KEY,
      "userId" text NOT NULL,
      "organizationId" text NOT NULL
    );
    INSERT INTO public.organization_memberships VALUES ('m1', 'user-a', 'org-1'), ('m2', 'user-b', 'org-2');
    -- Supabase-style default privileges: tables the migration creates inherit
    -- broad grants that the migration itself must replace with least privilege.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated;
  `;
}

const migration = () => existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

suite('native chat organization isolation', () => {
  it('lets each organization CRUD only its own sessions and messages', () => {
    expect(run(fixture() + migration() + `
      DO $$ DECLARE client_role text; BEGIN
        FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
          IF client_role = 'anon'
            AND (has_table_privilege(client_role, 'public.chat_sessions', 'SELECT,INSERT,UPDATE,DELETE')
              OR has_table_privilege(client_role, 'public.chat_messages', 'SELECT,INSERT,UPDATE,DELETE'))
            THEN RAISE EXCEPTION 'Anon chat privileges remain'; END IF;
        END LOOP;
        IF NOT has_table_privilege('authenticated', 'public.chat_sessions', 'SELECT,INSERT,UPDATE,DELETE')
          OR NOT has_table_privilege('authenticated', 'public.chat_messages', 'SELECT,INSERT,UPDATE,DELETE')
          THEN RAISE EXCEPTION 'Authenticated chat DML missing'; END IF;
        -- PUBLIC is a pseudo-role keyword, not a real role: privilege functions
        -- reject the name, so assert through the recorded ACL instead. After the
        -- migration's explicit REVOKE, no PUBLIC entry may remain on either table.
        IF EXISTS (
          SELECT 1 FROM pg_class, aclexplode(COALESCE(relacl, acldefault('r', relowner))) a
          WHERE oid IN ('public.chat_sessions'::regclass, 'public.chat_messages'::regclass)
            AND a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
        ) THEN RAISE EXCEPTION 'PUBLIC chat privileges remain'; END IF;
      END $$;
      SET LOCAL ROLE authenticated;
      SET LOCAL adpro.chat_test_uid = 'user-a';
      INSERT INTO public.chat_sessions (id, user_id, organization_id, title, message_count, created_at, updated_at)
        VALUES ('11111111-1111-1111-1111-111111111111','user-a','org-1','Session A',0,now(),now());
      SET LOCAL adpro.chat_test_uid = 'user-b';
      INSERT INTO public.chat_sessions (id, user_id, organization_id, title, message_count, created_at, updated_at)
        VALUES ('22222222-2222-2222-2222-222222222222','user-b','org-2','Session B',0,now(),now());
      SET LOCAL adpro.chat_test_uid = 'user-a';
      INSERT INTO public.chat_messages (id, session_id, type, content, metadata, created_at)
        VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','user','hello A',NULL::jsonb,now());
      SET LOCAL adpro.chat_test_uid = 'user-b';
      INSERT INTO public.chat_messages (id, session_id, type, content, metadata, created_at)
        VALUES ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','user','hello B',NULL::jsonb,now());
      SET LOCAL adpro.chat_test_uid = 'user-a';
      DO $$ DECLARE n integer; BEGIN
        SELECT count(*) INTO n FROM public.chat_sessions;
        IF n <> 1 THEN RAISE EXCEPTION 'user-a sees % sessions', n; END IF;
        SELECT count(*) INTO n FROM public.chat_messages;
        IF n <> 1 THEN RAISE EXCEPTION 'user-a sees % messages', n; END IF;
      END $$;
      SET LOCAL adpro.chat_test_uid = 'user-b';
      DO $$ DECLARE n integer; BEGIN
        SELECT count(*) INTO n FROM public.chat_sessions;
        IF n <> 1 THEN RAISE EXCEPTION 'user-b sees % sessions', n; END IF;
        SELECT count(*) INTO n FROM public.chat_messages;
        IF n <> 1 THEN RAISE EXCEPTION 'user-b sees % messages', n; END IF;
      END $$;
      SET LOCAL adpro.chat_test_uid = 'user-c';
      DO $$ DECLARE n integer; BEGIN
        SELECT count(*) INTO n FROM public.chat_sessions;
        IF n <> 0 THEN RAISE EXCEPTION 'membership-less user sees % sessions', n; END IF;
        SELECT count(*) INTO n FROM public.chat_messages;
        IF n <> 0 THEN RAISE EXCEPTION 'membership-less user sees % messages', n; END IF;
        IF public.is_chat_org_member('org-1') THEN RAISE EXCEPTION 'membership-less probe returned true'; END IF;
      END $$;
      SET LOCAL adpro.chat_test_uid = 'user-a';
      DO $$ BEGIN
        IF NOT public.is_chat_org_member('org-1') THEN RAISE EXCEPTION 'member probe returned false'; END IF;
        BEGIN
          INSERT INTO public.chat_sessions (id, user_id, organization_id, title, message_count, created_at, updated_at)
            VALUES ('55555555-5555-5555-5555-555555555555','user-a','org-2','Cross-org',0,now(),now());
          RAISE EXCEPTION 'cross-org session insert unexpectedly succeeded';
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
        BEGIN
          INSERT INTO public.chat_messages (id, session_id, type, content, metadata, created_at)
            VALUES ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222','user','cross',NULL::jsonb,now());
          RAISE EXCEPTION 'cross-org message insert unexpectedly succeeded';
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
        UPDATE public.chat_sessions SET title='hijack' WHERE id='22222222-2222-2222-2222-222222222222';
        IF FOUND THEN RAISE EXCEPTION 'cross-org session update succeeded'; END IF;
        DELETE FROM public.chat_sessions WHERE id='22222222-2222-2222-2222-222222222222';
        IF FOUND THEN RAISE EXCEPTION 'cross-org session delete succeeded'; END IF;
        UPDATE public.chat_messages SET content='hijack' WHERE id='44444444-4444-4444-4444-444444444444';
        IF FOUND THEN RAISE EXCEPTION 'cross-org message update succeeded'; END IF;
        DELETE FROM public.chat_messages WHERE id='44444444-4444-4444-4444-444444444444';
        IF FOUND THEN RAISE EXCEPTION 'cross-org message delete succeeded'; END IF;
        UPDATE public.chat_sessions SET title='Session A v2' WHERE id='11111111-1111-1111-1111-111111111111';
        IF NOT FOUND THEN RAISE EXCEPTION 'own-org session update blocked'; END IF;
      END $$;
      SET LOCAL ROLE anon;
      DO $$ BEGIN
        BEGIN
          PERFORM 1 FROM public.chat_sessions;
          RAISE EXCEPTION 'anon select unexpectedly succeeded';
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
        BEGIN
          PERFORM 1 FROM public.organization_memberships;
          RAISE EXCEPTION 'membership read via client role unexpectedly succeeded';
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
        BEGIN
          PERFORM public.is_chat_org_member('org-1');
          RAISE EXCEPTION 'anon membership probe unexpectedly succeeded';
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
      END $$;
      ROLLBACK; SELECT 'chat-org-isolation-pass';
    `)).toContain('chat-org-isolation-pass');
  });

  it('is idempotent and keeps RLS effective when replayed', () => {
    expect(run(fixture() + migration() + migration() + `
      SET LOCAL ROLE authenticated;
      SET LOCAL adpro.chat_test_uid = 'user-a';
      INSERT INTO public.chat_sessions (id, user_id, organization_id, title, message_count, created_at, updated_at)
        VALUES ('11111111-1111-1111-1111-111111111111','user-a','org-1','Session A',0,now(),now());
      DO $$ DECLARE n integer; BEGIN
        SELECT count(*) INTO n FROM public.chat_sessions;
        IF n <> 1 THEN RAISE EXCEPTION 'replay broke session isolation: % rows', n; END IF;
      END $$;
      SET LOCAL adpro.chat_test_uid = 'user-b';
      DO $$ DECLARE n integer; BEGIN
        SELECT count(*) INTO n FROM public.chat_sessions;
        IF n <> 0 THEN RAISE EXCEPTION 'replay leaked sessions: % rows', n; END IF;
      END $$;
      ROLLBACK; SELECT 'chat-replay-pass';
    `)).toContain('chat-replay-pass');
  });

  it('aborts atomically on a legacy-shaped chat_sessions without organization_id', () => {
    expect(() => run(fixture() + `
      CREATE TABLE public.chat_sessions (id text PRIMARY KEY, user_id text, title text);
      ` + migration() + 'ROLLBACK;')).toThrow('Disposable SQL failed');
    expect(run(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('chat_sessions','chat_messages');`)).toMatch(/0/);
    expect(run(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='is_chat_org_member';`)).toMatch(/0/);
  });

  it('aborts when applied as a client role instead of the trusted migration owner', () => {
    expect(() => run(fixture() + `
      SET LOCAL ROLE authenticated;
      ` + migration() + 'ROLLBACK;')).toThrow('Disposable SQL failed');
  });
});
