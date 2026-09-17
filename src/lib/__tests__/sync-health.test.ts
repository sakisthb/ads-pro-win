import { syncHealth, deriveStoreInsights } from "@/lib/dashboard-insights";
import { accountSyncState, platformSyncState } from "@/lib/sync-health";

const now = new Date("2026-09-17T08:00:00Z");
const fresh = { lastSyncAt: "2026-09-17T07:00:00Z", lastJobStatus: "completed", isActive: true };

it("distinguishes fresh successful zero-row sync from failure, stale, unknown and in-progress evidence", () => {
  expect(accountSyncState(fresh, now)).toBe("ready");
  expect(accountSyncState({ ...fresh, lastJobStatus: "failed" }, now)).toBe("failed");
  expect(accountSyncState({ ...fresh, lastSyncAt: "2026-09-03T07:00:00Z" }, now)).toBe("stale");
  expect(accountSyncState({ ...fresh, lastJobStatus: null }, now)).toBe("unknown");
  expect(accountSyncState({ ...fresh, lastSyncAt: "invalid" }, now)).toBe("unknown");
  expect(accountSyncState({ ...fresh, lastSyncAt: "2026-09-18T07:00:00Z" }, now)).toBe("unknown");
  expect(accountSyncState({ ...fresh, lastJobStatus: "running" }, now)).toBe("syncing");
});

it("does not report historical success as 100% healthy", () => {
  const result = syncHealth({ now, accounts: [fresh, { ...fresh, lastJobStatus: "failed" }, { ...fresh, lastSyncAt: "2026-09-03T07:00:00Z" }] });
  expect(result.pct).toBe(33);
  expect(result.label).toMatch(/1 of 3.*recent successful/i);
});

it("excludes inactive accounts and never falls back to treating them as healthy", () => {
  expect(syncHealth({ now, accounts: [{ ...fresh, isActive: false }] }).pct).toBe(0);
  expect(syncHealth({ now, accounts: [fresh, { ...fresh, isActive: false, lastJobStatus: "failed" }] }).pct).toBe(100);
  expect(platformSyncState([], now)).toBe("unknown");
  expect(platformSyncState([fresh, { ...fresh, lastJobStatus: "failed" }], now)).toBe("failed");
});

it.each(["failed", "stale", "unknown", "syncing"] as const)("does not describe %s email data as a quiet zero window", (emailSyncState) => {
  const insights = deriveStoreInsights({ storeOrders: 0, storeNet: 0, pixelConversions: 0, pixelRevenue: 0, spend: 0, mer: 0, platformRoas: 0, cogsKnown: true, channels: [], connectedPlatforms: [], emailConnected: true, emailDelivered: 0, emailSyncState });
  expect(insights.map((i) => i.id)).not.toContain("email-quiet-window");
  expect(insights.find((i) => i.id === "email-sync-health")?.description).toMatch(/unverified/i);
});
