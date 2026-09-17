-- Server-only Prisma models. Supabase Auth/Storage and unrelated client tables
-- are deliberately excluded. The trusted backend must own these tables or use
-- BYPASSRLS; never FORCE RLS on this owner-access design.
-- One DO statement makes the grants, RLS and default changes atomic.
DO $$
DECLARE
  backend_table TEXT;
  client_role TEXT;
  backend_column TEXT;
  table_oid OID;
  secured_count INTEGER := 0;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '30s', true);
  FOREACH backend_table IN ARRAY ARRAY[
    'AdAccount', 'AdCampaign', 'ApprovalRequest', 'Brand', 'DailyMetric',
    'MetaWriteLog', 'SyncJob', 'WooOrder', 'WooProduct', '_prisma_migrations',
    'ai_agents', 'alert_rules', 'analyses', 'api_integrations', 'campaigns',
    'invitations', 'notifications', 'oauth_transactions', 'optimizations',
    'organization_memberships', 'organizations', 'predictions', 'users',
    'websocket_tickets', 'workflows', 'SyncCoverageReceipt'
  ] LOOP
    SELECT c.oid INTO table_oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = backend_table AND c.relkind = 'r';
    -- Allows a guarded one-off legacy containment before the additive receipt
    -- release, followed by this same idempotent migration during that release.
    IF table_oid IS NULL THEN
      IF backend_table = 'SyncCoverageReceipt' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Expected backend table is missing';
    END IF;
    IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = table_oid)) <> current_user
      OR (SELECT relforcerowsecurity FROM pg_class WHERE oid = table_oid)
      OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = table_oid)
      THEN RAISE EXCEPTION 'Unexpected backend ownership/RLS policy; manual review required'; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', backend_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', backend_table);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = client_role)
          THEN RAISE EXCEPTION 'Client role is not restricted'; END IF;
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', backend_table, client_role);
      END IF;
    END LOOP;
    -- Table revokes do not remove explicit column grants.
    FOR backend_column IN SELECT attname FROM pg_attribute
      WHERE attrelid = table_oid AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM PUBLIC', backend_column, backend_table);
      FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
          EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM %I', backend_column, backend_table, client_role);
        END IF;
      END LOOP;
    END LOOP;
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        IF has_table_privilege(client_role, table_oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege(client_role, table_oid, 'SELECT,INSERT,UPDATE,REFERENCES')
          THEN RAISE EXCEPTION 'Inherited backend client privileges remain; transaction aborted'; END IF;
      END IF;
    END LOOP;
    secured_count := secured_count + 1;
  END LOOP;
  IF secured_count < 25 THEN RAISE EXCEPTION 'Unexpected backend inventory'; END IF;

  -- Future tables made by this trusted migration owner require explicit grants.
  -- Do not modify managed creator roles, Auth schemas or service_role access.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', current_user);
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', current_user, client_role);
    END IF;
  END LOOP;
  -- Schema-specific revokes cannot cancel global grants. Refuse them rather
  -- than silently claiming future-table privacy or changing other schemas.
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      AND d.defaclnamespace = 0 AND d.defaclobjtype = 'r'
      AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
  ) THEN RAISE EXCEPTION 'Global default table grants require separate review'; END IF;
END;
$$;
