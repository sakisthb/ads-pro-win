/**
 * Client-safe GA4 helpers and types.
 *
 * This module must not import any server-only code (e.g. safe-fetch) because
 * it is imported by client components. All network-facing GA4 logic lives in
 * `@/lib/ga4`.
 */

export interface Ga4Property {
  id: string;
  displayName: string;
  accountName: string;
  resourceName: string;
}

export function isGa4OrganicSearchChannel(channel: string | null | undefined): boolean {
  return /^\s*organic search\s*$/i.test(channel ?? "");
}

/** GA4 default-channel labels for generative / answer engines — not ChatGPT rankings. */
export function isGa4GenerativeChannel(channel: string | null | undefined): boolean {
  const t = (channel ?? "").trim().toLowerCase();
  if (!t) return false;
  return (
    t === "ai assistant" ||
    t === "organic ai" ||
    t.includes("chatgpt") ||
    t.includes("perplexity") ||
    t.includes("gemini") ||
    t.includes("ai overview") ||
    t.includes("copilot")
  );
}

/** GA4 paid default channels — still not Ads Pro DailyMetric spend. */
export function isGa4PaidChannel(channel: string | null | undefined): boolean {
  const t = (channel ?? "").trim().toLowerCase();
  if (!t) return false;
  return (
    t.startsWith("paid ") ||
    t === "cross-network" ||
    t === "display" ||
    t === "paid shopping" ||
    t === "paid video"
  );
}

export type Ga4DeskLabel = "SEO" | "GEO" | "Paid (GA4)" | "Other";

export function ga4DeskLabel(channel: string | null | undefined): Ga4DeskLabel {
  if (isGa4GenerativeChannel(channel)) return "GEO";
  if (isGa4OrganicSearchChannel(channel)) return "SEO";
  if (isGa4PaidChannel(channel)) return "Paid (GA4)";
  return "Other";
}

export type Ga4DeskDay = {
  date: string;
  sessions: number;
  purchases: number;
  revenue: number;
};

export function rollupGa4DeskDays(
  rows: Array<{
    date: string;
    channel: string;
    sessions: number;
    purchases: number;
    revenue: number;
  }>,
  match: (channel: string) => boolean,
): Ga4DeskDay[] {
  const map = new Map<string, Ga4DeskDay>();
  for (const row of rows) {
    if (!match(row.channel)) continue;
    const cur = map.get(row.date) ?? {
      date: row.date,
      sessions: 0,
      purchases: 0,
      revenue: 0,
    };
    cur.sessions += row.sessions;
    cur.purchases += row.purchases;
    cur.revenue += row.revenue;
    map.set(row.date, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function ga4PendingAccountId(brandId: string): string {
  return `ga4:pending:${brandId}`;
}

export function ga4StoredAccountId(brandId: string, propertyId: string): string {
  return `ga4prop:${brandId}:${propertyId}`;
}

/** Numeric GA4 property id, or null when the shop still needs a picker. */
export function parseGa4PropertyId(accountId: string | null | undefined): string | null {
  const raw = (accountId ?? "").trim();
  if (!raw) return null;
  const stored = raw.match(/^ga4prop:[^:]+:(\d+)$/);
  if (stored?.[1]) return stored[1];
  const resource = raw.match(/^properties\/(\d+)$/);
  if (resource?.[1]) return resource[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

export function isGa4PropertyReady(accountId: string | null | undefined): boolean {
  return parseGa4PropertyId(accountId) != null;
}

export function formatGa4Date(value: string): string {
  const digits = value.replace(/-/g, "");
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return value;
}

export function formatGa4ApiError(status: number, body: string): string {
  let message = body.slice(0, 400);
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    message = parsed.error?.message ?? message;
  } catch {
    /* raw body */
  }
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes("unauthenticated")) {
    return "Google Analytics token expired. Reconnect Google Analytics, then retry.";
  }
  if (lower.includes("has not been used") || lower.includes("is disabled") || lower.includes("access not configured")) {
    return (
      "Enable Google Analytics Admin API and Google Analytics Data API " +
      "in this Google Cloud project, then retry Sync Now."
    );
  }
  if (lower.includes("insufficient") || lower.includes("permission")) {
    return "This Google account cannot read the selected GA4 property. Pick another property or reconnect.";
  }
  if (status === 429 || lower.includes("exhausted") || lower.includes("quota")) {
    return "Google Analytics Realtime quota is exhausted. Wait a minute — this desk polls about every 45 seconds, not every second.";
  }
  return `Google Analytics API error (${status}): ${message}`;
}

/** Operator label for GA4 page titles (drop host / theme suffix). */
export function shortGa4PageLabel(raw: string, maxChars = 56): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "(not set)";
  const withoutHost = trimmed.replace(/\s*[-–—]\s*\S+\.[a-z]{2,}.*$/i, "").trim();
  const first = withoutHost.split(/\s+-\s+/)[0]?.trim() || withoutHost;
  if (first.length <= maxChars) return first;
  return `${first.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export interface Ga4RealtimeBreakdownRow {
  label: string;
  activeUsers: number;
}

/** Merge realtime page rows that collapse to the same operator label. */
export function collapseGa4BreakdownByShortLabel(
  rows: Ga4RealtimeBreakdownRow[],
): Ga4RealtimeBreakdownRow[] {
  const byLabel = new Map<string, number>();
  for (const row of rows) {
    const label = shortGa4PageLabel(row.label);
    byLabel.set(label, (byLabel.get(label) ?? 0) + row.activeUsers);
  }
  return [...byLabel.entries()]
    .map(([label, activeUsers]) => ({ label, activeUsers }))
    .sort((a, b) => b.activeUsers - a.activeUsers);
}
