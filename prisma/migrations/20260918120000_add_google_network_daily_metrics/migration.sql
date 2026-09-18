-- Additive only: Google campaign metrics segmented by ad_network_type live in
-- their own table so DailyMetric totals are never double-counted.
CREATE TABLE "GoogleNetworkDailyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "networkType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "spend" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleNetworkDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleNetworkDailyMetric_date_adAccountId_campaignId_networ_key" ON "GoogleNetworkDailyMetric"("date", "adAccountId", "campaignId", "networkType");

CREATE INDEX "GoogleNetworkDailyMetric_adAccountId_date_idx" ON "GoogleNetworkDailyMetric"("adAccountId", "date");

ALTER TABLE "GoogleNetworkDailyMetric" ADD CONSTRAINT "GoogleNetworkDailyMetric_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only reporting data: no anon/authenticated Data API access.
ALTER TABLE "GoogleNetworkDailyMetric" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GoogleNetworkDailyMetric" FROM PUBLIC;

DO $$
DECLARE network_client_role TEXT;
BEGIN
  FOREACH network_client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = network_client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', 'GoogleNetworkDailyMetric', network_client_role);
    END IF;
  END LOOP;
END;
$$;
