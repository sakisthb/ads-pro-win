/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("makes private receipt rows deny-by-default at the database boundary without public policies", () => {
  const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260917090000_add_sync_coverage_receipts/migration.sql"), "utf8");
  expect(sql).toMatch(/ALTER TABLE "SyncCoverageReceipt" ENABLE ROW LEVEL SECURITY;/);
  expect(sql).toMatch(/REVOKE ALL ON TABLE "SyncCoverageReceipt" FROM PUBLIC;/);
  expect(sql).toContain("'anon', 'authenticated'");
  expect(sql).toContain("pg_roles");
  expect(sql).toContain("REVOKE ALL ON TABLE %I FROM %I");
  expect(sql).not.toMatch(/CREATE\s+POLICY|GRANT\s+.*\s+TO\s+(anon|authenticated|public)/i);
});
