// Server-side structured security & operations event logging for release
// observability (plan Phase 5.3).
//
// Every event is a single-line JSON object so log aggregation can index it
// without a custom parser. The hard contract: events must never contain
// credentials, tokens, bearer secrets, or URL query strings. All string
// values pass through redaction (origin/channel/message are attacker
// controllable), and values are length-capped so attacker-controlled input
// cannot flood logs.

export type SecurityEventName =
  | "authz_denied"
  | "oauth_failure"
  | "ssrf_blocked"
  | "ws_rejected"
  | "queue_failure"
  | "readiness_failure"
  | "migration_status";

export type SecurityEventSeverity = "info" | "warn" | "error";

export interface SecurityEventContext {
  code?: string;
  userId?: string | null;
  organizationId?: string | null;
  platform?: string | null;
  brandId?: string | null;
  adAccountId?: string | null;
  role?: string | null;
  required?: string | null;
  queue?: string | null;
  jobId?: string | null;
  dependency?: string | null;
  channel?: string | null;
  origin?: string | null;
  host?: string | null;
  url?: string | URL | null;
  count?: number | null;
  message?: string | null;
}

const LABELLED_SECRET_RE =
  /\b(bearer|token|api[_-]?key|secret|password|consumer[_-]?key|consumer[_-]?secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|code_verifier)\s*[:=]\s*[^\s,;"']+/gi;
const BEARER_RE = /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const URL_RE = /https?:\/\/[^\s"'<>]+/g;

const MAX_MESSAGE_LENGTH = 512;
const MAX_FIELD_LENGTH = 256;

export function redactSecrets(text: string): string {
  return text
    .replace(URL_RE, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
      } catch {
        return "[redacted]";
      }
    })
    .replace(BEARER_RE, "bearer [redacted]")
    .replace(LABELLED_SECRET_RE, "$1=[redacted]");
}

/** Strip query strings and fragments: URLs routinely carry tokens as params. */
export function sanitizeUrlForEvent(url: string | URL | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = url instanceof URL ? url : new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "[unparseable]";
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function logSecurityEvent(
  event: SecurityEventName,
  severity: SecurityEventSeverity,
  context: SecurityEventContext = {},
): void {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: severity,
    event,
  };

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "message") {
      record.message = truncate(redactSecrets(String(value)), MAX_MESSAGE_LENGTH);
    } else if (key === "url") {
      const sanitized = sanitizeUrlForEvent(value as string | URL);
      if (sanitized) record.url = truncate(sanitized, MAX_FIELD_LENGTH);
    } else if (typeof value === "string") {
      record[key] = truncate(redactSecrets(value), MAX_FIELD_LENGTH);
    } else {
      record[key] = value;
    }
  }

  const line = JSON.stringify(record);
  if (severity === "error") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
