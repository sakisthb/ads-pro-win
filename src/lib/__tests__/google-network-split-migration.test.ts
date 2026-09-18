/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("stores the Google network split server-only with a per campaign-day-network unique key", () => {
  const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260918120000_add_google_network_daily_metrics/migration.sql"), "utf8");
  expect(sql).toMatch(/CREATE TABLE "GoogleNetworkDailyMetric"/);
  expect(sql).toMatch(/"networkType" TEXT NOT NULL/);
  expect(sql).toMatch(/CREATE UNIQUE INDEX "GoogleNetworkDailyMetric_date_adAccountId_campaignId_networ_key" ON "GoogleNetworkDailyMetric"\("date", "adAccountId", "campaignId", "networkType"\)/);
  expect(sql).toMatch(/REFERENCES "AdAccount"\("id"\) ON DELETE CASCADE/);
  expect(sql).toMatch(/ALTER TABLE "GoogleNetworkDailyMetric" ENABLE ROW LEVEL SECURITY;/);
  expect(sql).toMatch(/REVOKE ALL ON TABLE "GoogleNetworkDailyMetric" FROM PUBLIC;/);
  expect(sql).toContain("'anon', 'authenticated'");
  expect(sql).not.toMatch(/CREATE\s+POLICY|GRANT\s+.*\s+TO\s+(anon|authenticated|public)/i);
});
