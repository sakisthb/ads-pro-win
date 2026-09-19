/**
 * Staged-content guard: blocks commits/merges of private artifacts and
 * credentials. Thin CLI over src/lib/security/content-guard (jest-tested).
 *
 * Usage:
 *   npx tsx scripts/check-staged-content.ts                 # local: git diff --cached
 *   npx tsx scripts/check-staged-content.ts --base origin/main # CI: PR diff
 *
 * Exit 0 = clean, exit 1 = findings (prints each rule, path, line, excerpt).
 */
import { execFileSync } from "node:child_process";

import { isBlockedPath, scanContent, type ContentFinding } from "../src/lib/security/content-guard";

const MAX_SCAN_BYTES = 5 * 1024 * 1024;

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

interface ChangeEntry {
  status: string;
  path: string;
}

/** Parses `git diff --name-status -z` output into (status, path) pairs. */
export function parseNameStatusZ(raw: string): ChangeEntry[] {
  return tokenize(raw).map((line) => ({
    status: line.slice(0, 1),
    path: line.slice(2),
  }));
}

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i += 1) {
    if (raw.charCodeAt(i) === 0) {
      if (current.length > 0) tokens.push(current);
      current = "";
    } else {
      current += raw[i];
    }
  }
  if (current.length > 0) tokens.push(current);
  // Rename entries arrive as "R100\0old\0new": name-status -z puts status and
  // path in separate NUL tokens. Pair them: a bare status token (len<=4, no
  // slash beyond leading) is followed by its path token(s).
  const lines: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[AMDRTUXB]\d{0,3}$/.test(t)) {
      const status = t.replace(/\d/g, "");
      const copies = status === "R" || status === "C" ? 2 : 1;
      const path = tokens[i + copies]; // last path wins for renames
      lines.push(`${status} ${path}`);
      i += 1 + copies;
    } else {
      i += 1;
    }
  }
  return lines;
}

function isBinary(buf: Buffer): boolean {
  const slice = buf.subarray(0, 8192);
  return slice.includes(0);
}

function main(): number {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf("--base");
  const base = baseIdx >= 0 ? args[baseIdx + 1] : null;

  const entries: ChangeEntry[] = base
    ? parseNameStatusZ(git(["diff", "--name-status", "-z", `${base}...HEAD`]))
    : parseNameStatusZ(git(["diff", "--cached", "--name-status", "-z"]));

  const findings: ContentFinding[] = [];
  const blockedPaths: string[] = [];
  let scanned = 0;

  for (const entry of entries) {
    if (entry.status === "D") continue; // deletions shrink the tree; fine
    const blocked = isBlockedPath(entry.path);
    if (blocked) {
      blockedPaths.push(`${entry.path} — ${blocked}`);
      continue;
    }

    let blob: Buffer;
    try {
      blob = base
        ? execFileSync("git", ["show", `HEAD:${entry.path}`], { maxBuffer: MAX_SCAN_BYTES + 1024 })
        : execFileSync("git", ["show", `:${entry.path}`], { maxBuffer: MAX_SCAN_BYTES + 1024 });
    } catch {
      continue; // unresolved/missing blob; git itself will fail the commit
    }
    if (blob.length > MAX_SCAN_BYTES || isBinary(blob)) continue;

    findings.push(...scanContent(entry.path, blob.toString("utf8")));
    scanned += 1;
  }

  if (blockedPaths.length > 0) {
    console.error("\nBlocked private-artifact paths:");
    for (const p of blockedPaths) console.error(`  ✗ ${p}`);
  }
  if (findings.length > 0) {
    console.error("\nCredential findings:");
    for (const f of findings) {
      console.error(`  ✗ ${f.path}:${f.line} [${f.rule}] ${f.excerpt}`);
    }
  }

  if (blockedPaths.length === 0 && findings.length === 0) {
    console.log(`content-guard: clean (${scanned} file(s) scanned${base ? ` vs ${base}` : ", staged"}).`);
    return 0;
  }
  console.error("\ncontent-guard: FAIL — remove the artifacts above or keep them local.");
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
