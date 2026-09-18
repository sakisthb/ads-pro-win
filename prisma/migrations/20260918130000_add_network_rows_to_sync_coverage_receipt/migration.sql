-- Additive only: the ad_network_type (network split) import now records its
-- own fetched/persisted counts on the sync coverage receipt instead of only
-- being folded into the aggregate recordsProcessed total.
ALTER TABLE "SyncCoverageReceipt" ADD COLUMN "networkRowsFetched" INTEGER;

ALTER TABLE "SyncCoverageReceipt" ADD COLUMN "networkRowsPersisted" INTEGER;
