/**
 * Pre-commit / pre-merge guard for private artifacts and credentials.
 *
 * Two rule classes:
 *  - Blocked paths: local-only files that must never be staged/merged even
 *    with `--force` (temp probes, editor config, operator financial journal,
 *    runtime evidence dumps). Mirrors the targeted .gitignore entries.
 *  - Secret patterns: high-confidence credential shapes only. Deliberately
 *    excludes loose markers (euro amounts, generic JWTs) that legitimately
 *    appear in committed UI code.
 */

export interface BlockedPathRule {
  name: string;
  reason: string;
  test: (path: string) => boolean;
}

export interface SecretRule {
  name: string;
  regex: RegExp;
}

export interface ContentFinding {
  rule: string;
  path: string;
  line: number;
  excerpt: string;
}

export const BLOCKED_PATH_PATTERNS: BlockedPathRule[] = [
  {
    name: "temp-probe",
    reason: "temp probe script (.tmp-*) — never publish temporary scripts",
    test: (p) => /^\.tmp-/.test(p),
  },
  {
    name: "editor-config",
    reason: "local editor config (.cursor/) — machine-local only",
    test: (p) => /^\.cursor\//.test(p),
  },
  {
    name: "operator-financial-journal",
    reason: "operator journal with customer financials — stays local",
    test: (p) => p === "docs/operator-bagtobag.md",
  },
  {
    name: "runtime-evidence",
    reason: "runtime evidence dump (docs/deployment/) — generated locally",
    test: (p) => /^docs\/deployment\//.test(p),
  },
  {
    name: "chat-dump",
    reason: "local chat dump (docs/chat-*.md) — mirrors .gitignore",
    test: (p) => /^docs\/chat-.*\.md$/.test(p),
  },
];

export const SECRET_PATTERNS: SecretRule[] = [
  { name: "private-key", regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { name: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "google-api-key", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "google-oauth-token", regex: /ya29\.[0-9A-Za-z_-]{10,}/ },
  { name: "meta-access-token", regex: /EAA[A-Za-z0-9]{60,}/ },
  { name: "github-pat", regex: /ghp_[A-Za-z0-9]{36,}/ },
  { name: "github-fine-grained-pat", regex: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "openai-key", regex: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: "stripe-live-key", regex: /(?:sk|rk)_live_[A-Za-z0-9]{16,}/ },
  { name: "shopify-token", regex: /shpat_[A-Za-z0-9]{32,}/ },
  { name: "sendgrid-key", regex: /SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{43,}/ },
];

const EXCERPT_MAX = 80;

function excerptAround(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + length + 20);
  return content.slice(start, end).replace(/\s+/g, " ").trim().slice(0, EXCERPT_MAX);
}

/** Returns the blocking reason for a repo-relative posix path, or null. */
export function isBlockedPath(path: string): string | null {
  for (const rule of BLOCKED_PATH_PATTERNS) {
    if (rule.test(path)) return `${rule.name}: ${rule.reason}`;
  }
  return null;
}

/** Scans staged file content for credential patterns. */
export function scanContent(path: string, content: string): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const lineStarts = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === "\n") lineStarts.push(i + 1);
  }
  const lineOf = (index: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  for (const rule of SECRET_PATTERNS) {
    const regex = new RegExp(rule.regex.source, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      findings.push({
        rule: rule.name,
        path,
        line: lineOf(match.index),
        excerpt: excerptAround(content, match.index, match[0].length),
      });
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }
  return findings;
}
