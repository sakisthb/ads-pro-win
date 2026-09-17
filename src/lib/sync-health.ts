/** Freshness policy for UI evidence, not a delivery guarantee or provider SLA. */
export const SYNC_FRESHNESS_MS = 24 * 60 * 60 * 1000;
/** ready = recent completed run; NOT proven delivery, OAuth longevity or date coverage. */
export type SyncState = "ready" | "failed" | "stale" | "unknown" | "syncing";
export interface SyncEvidence {
  lastSyncAt: Date | string | null;
  lastJobStatus?: string | null;
  isActive?: boolean;
}

export function accountSyncState(account: SyncEvidence, now = new Date()): SyncState {
  if (account.isActive === false) return "unknown";
  if (account.lastJobStatus === "failed") return "failed";
  if (["running", "pending", "retrying"].includes(account.lastJobStatus ?? "")) return "syncing";
  if (account.lastJobStatus !== "completed" || !account.lastSyncAt) return "unknown";
  const at = new Date(account.lastSyncAt).getTime();
  const age = now.getTime() - at;
  if (!Number.isFinite(age) || age < 0) return "unknown";
  return age > SYNC_FRESHNESS_MS ? "stale" : "ready";
}

/** A failed/missing source prevents an aggregate platform from claiming readiness. */
export function platformSyncState(accounts: SyncEvidence[], now = new Date()): SyncState {
  const states = accounts.filter((a) => a.isActive !== false).map((a) => accountSyncState(a, now));
  if (!states.length) return "unknown";
  for (const state of ["failed", "syncing", "unknown", "stale"] as const) {
    if (states.includes(state)) return state;
  }
  return "ready";
}

export function syncStateNotice(state: SyncState): string {
  return `Email sync ${state}. Stored delivery data is unverified; check the latest run on Connections before interpreting this window.`;
}
