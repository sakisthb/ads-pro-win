-- Organization-scoped chat history (ADR-0004, milestone M2).
-- Supabase-connected browser clients hold real DML grants on these tables as
-- the authenticated role, so row level security — not grant absence — is the
-- security boundary here, unlike the server-only backend tables contained by
-- 20260917103000_harden_backend_tables. That hardening migration revoked
-- default grants for tables this migration owner creates, so least-privilege
-- grants below are explicit and never rely on defaults. Clients supply ids and
-- timestamps (no database-side defaults) so the Prisma datamodel and this
-- migration stay drift-free.

DO $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
    THEN RAISE EXCEPTION 'Chat history migration must run as the trusted migration owner'; END IF;
END $$;

-- auth.uid() exists only in Supabase-managed databases. Disposable CI clusters
-- and plain postgres need a NULL-returning stub so the membership helper and
-- policies below can be created; the stub is never installed over Supabase's
-- real function and keeps RLS default-deny outside Supabase.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
      CREATE SCHEMA auth;
    END IF;
    EXECUTE 'CREATE OR REPLACE FUNCTION auth.uid() RETURNS text
      LANGUAGE sql STABLE AS $fn$ SELECT NULL::text $fn$';
  END IF;
END $do$;

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id              uuid        NOT NULL,
  user_id         text        NOT NULL,
  organization_id text        NOT NULL,
  title           text        NOT NULL,
  message_count   integer     NOT NULL,
  created_at      timestamp(3) NOT NULL,
  updated_at      timestamp(3) NOT NULL,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid        NOT NULL,
  session_id uuid        NOT NULL,
  type       text        NOT NULL,
  content    text        NOT NULL,
  metadata   jsonb,
  created_at timestamp(3) NOT NULL,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_organization_id_idx ON public.chat_sessions (organization_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages (session_id);

DO $$
DECLARE
  chat_table text;
  chat_column text;
  client_role text;
BEGIN
  -- Refuse to silently adopt a pre-existing chat table that misses the
  -- org-scoped shape; containment must stay a reviewed, deliberate act.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.chat_sessions'::regclass
        AND attname = 'organization_id' AND attnum > 0 AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.chat_messages'::regclass
        AND attname = 'session_id' AND attnum > 0 AND NOT attisdropped)
    THEN RAISE EXCEPTION 'Existing chat tables miss the org-scoped shape; manual review required'; END IF;

  FOREACH chat_table IN ARRAY ARRAY['chat_sessions', 'chat_messages'] LOOP
    IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = format('public.%s', chat_table)::regclass)
      THEN RAISE EXCEPTION 'Chat table unexpectedly forces row level security'; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', chat_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', chat_table);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', chat_table, client_role);
      END IF;
    END LOOP;
    -- Table revokes do not remove explicit column grants.
    FOR chat_column IN SELECT attname FROM pg_attribute
      WHERE attrelid = format('public.%s', chat_table)::regclass AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC', chat_column, chat_table);
      FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
          EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM %I', chat_column, chat_table, client_role);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Membership lookup as SECURITY DEFINER: organization_memberships stays a
-- server-only backend table with zero client grants (hardening invariant), so
-- the RLS policies must not require client SELECT on it.
CREATE OR REPLACE FUNCTION public.is_chat_org_member(p_organization_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m."organizationId" = p_organization_id AND m."userId" = auth.uid()::text
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_chat_org_member(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.is_chat_org_member(text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.is_chat_org_member(text) TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_sessions TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages TO authenticated;
  END IF;
END $$;

-- Without the authenticated role (plain postgres / container smoke deploys)
-- there is no client path to these tables, so policies and DML grants wait
-- for a Supabase-managed deploy instead of failing the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    DROP POLICY IF EXISTS chat_sessions_org_member ON public.chat_sessions;
    CREATE POLICY chat_sessions_org_member ON public.chat_sessions
      FOR ALL TO authenticated
      USING (public.is_chat_org_member(organization_id))
      WITH CHECK (public.is_chat_org_member(organization_id));
    DROP POLICY IF EXISTS chat_messages_org_member ON public.chat_messages;
    CREATE POLICY chat_messages_org_member ON public.chat_messages
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.chat_sessions s
        WHERE s.id = chat_messages.session_id
          AND public.is_chat_org_member(s.organization_id)))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.chat_sessions s
        WHERE s.id = chat_messages.session_id
          AND public.is_chat_org_member(s.organization_id)));
  END IF;
END $$;
