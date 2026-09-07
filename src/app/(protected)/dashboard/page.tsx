import { DashboardClient } from "./dashboard-client";

/**
 * Marketing dashboard.
 *
 * Live workspaces read synced DailyMetric / Woo rows via tRPC.
 * The shared Demo org is the only place that uses StyleVault sample seed data.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
