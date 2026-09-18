/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("adds network row counts to the sync coverage receipt without destructive statements", () => {
  const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260918130000_add_network_rows_to_sync_coverage_receipt/migration.sql"), "utf8");
  expect(sql).toMatch(/ALTER TABLE "SyncCoverageReceipt" ADD COLUMN "networkRowsFetched" INTEGER/);
  expect(sql).toMatch(/ALTER TABLE "SyncCoverageReceipt" ADD COLUMN "networkRowsPersisted" INTEGER/);
  expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE|REVOKE/i);
});
