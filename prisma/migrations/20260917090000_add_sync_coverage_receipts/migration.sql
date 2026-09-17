-- Additive only: no old jobs are assigned retrospective coverage evidence.
CREATE TABLE "SyncCoverageReceipt" (
    "syncJobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerId" TEXT NOT NULL,
    "loginCustomerId" TEXT,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10) NOT NULL,
    "executionPath" TEXT NOT NULL,
    "providerApiVersion" TEXT NOT NULL DEFAULT 'v25',
    "transport" TEXT NOT NULL DEFAULT 'google_ads_search_stream',
    "queryScope" TEXT NOT NULL DEFAULT 'non_removed_campaigns',
    "providerTimezone" TEXT,
    "providerCurrency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "stage" TEXT NOT NULL DEFAULT 'credentials',
    "metricRowsFetched" INTEGER,
    "campaignRowsFetched" INTEGER,
    "metricRowsPersisted" INTEGER,
    "campaignRowsPersisted" INTEGER,
    "storageMayBePartial" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SyncCoverageReceipt_pkey" PRIMARY KEY ("syncJobId")
);

ALTER TABLE "SyncCoverageReceipt" ADD CONSTRAINT "SyncCoverageReceipt_syncJobId_fkey"
FOREIGN KEY ("syncJobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only evidence: no anon/authenticated Data API policy is granted.
-- The trusted Prisma connection must own this table or have BYPASSRLS.
ALTER TABLE "SyncCoverageReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SyncCoverageReceipt" FROM PUBLIC;

-- Supabase client roles may inherit default grants; vanilla CI Postgres has
-- no such roles. Revoke only this new table when those roles exist.
DO $$
DECLARE receipt_client_role TEXT;
BEGIN
  FOREACH receipt_client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = receipt_client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', 'SyncCoverageReceipt', receipt_client_role);
    END IF;
  END LOOP;
END;
$$;
