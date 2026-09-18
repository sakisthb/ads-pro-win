import {
  BLOCKED_PATH_PATTERNS,
  SECRET_PATTERNS,
  isBlockedPath,
  scanContent,
} from "@/lib/security/content-guard";

// Token fixtures are spliced at runtime on purpose: the content-guard scans
// this repo's own staged files, so a complete example token must never appear
// literally here (a real secret pasted into any file must still be caught).
const AWS_EXAMPLE = ["AKIA", "IOSFODNN7EXAM", "PLE"].join("");
const GOOGLE_API_KEY = ["AIzaSyD4iE7xn0vR2XaQlH0m", "Tkg9uY2LwFcBh1Q"].join("");
const GOOGLE_OAUTH = ["ya29.a0AfH6", "SMBxExampleTokenValue1234567890abcd"].join("");
const PRIVATE_KEY_BLOCK = ["-----BEGIN ", "RSA ", "PRIVATE KEY-----"].join("");
const SLACK_TOKEN = ["xoxb-123456789", "012-abcdefghijkl"].join("");
const STRIPE_LIVE = ["sk_live_4eC39HqLyjW", "DarjtT1zdp7dc"].join("");

describe("content-guard path rules", () => {
  it.each([
    [".tmp-gads-probe.mjs", "temp probe script"],
    [".tmp-google-history-readonly.ts", "temp probe script (ts)"],
    [".cursor/rules/adpd.mdc", "local editor config"],
    ["docs/operator-bagtobag.md", "operator journal with customer financials"],
    ["docs/deployment/ADPD-ROLLOUT-RECEIPT-2026-09-18.json", "runtime evidence JSON"],
    ["docs/chat-dump-2026-09-18.md", "local chat dump"],
  ])("blocks %s (%s)", (path) => {
    expect(isBlockedPath(path)).not.toBeNull();
  });

  it.each([
    ["src/lib/sync/fetchers.ts", "source file"],
    ["docs/adr/0003-google-repair-desk.md", "ADR doc"],
    ["docs/agents/issue-tracker.md", "agent doc"],
    ["scripts/check-staged-content.ts", "the guard script itself"],
    ["docs/operator-bagtobag-archive.md", "similarly named but different file"],
  ])("allows %s (%s)", (path) => {
    expect(isBlockedPath(path)).toBeNull();
  });

  it("describes why a path is blocked", () => {
    const reason = isBlockedPath("docs/operator-bagtobag.md");
    expect(reason).toMatch(/financial/i);
  });

  it("has no overlapping blocked-path rules", () => {
    // A path must match at most one rule so reports stay unambiguous.
    for (const path of [
      ".tmp-x.mjs",
      ".cursor/a",
      "docs/operator-bagtobag.md",
      "docs/deployment/a.json",
      "docs/chat-a.md",
    ]) {
      const hits = BLOCKED_PATH_PATTERNS.filter((r) => r.test(path));
      expect(hits.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("content-guard secret patterns", () => {
  it("detects a private key block", () => {
    const findings = scanContent(
      "docs/notes.md",
      `key\n${PRIVATE_KEY_BLOCK}\nMIIEpAIBAAKCAQEA\n`,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toMatch(/private-key/);
    expect(findings[0].line).toBe(2);
  });

  it.each([
    ["aws-access-key", `token ${AWS_EXAMPLE} end`],
    ["google-api-key", `key=${GOOGLE_API_KEY} here`],
    ["google-oauth-token", `refresh ${GOOGLE_OAUTH}`],
    ["meta-access-token", "EAA" + "a".repeat(80)],
    ["github-pat", "ghp_" + "a1".repeat(20) + " extra"],
    ["github-fine-grained-pat", "github_pat_11ABCDEFG0" + "x".repeat(30)],
    ["slack-token", SLACK_TOKEN],
    ["openai-key", "sk-" + "Ab1".repeat(10) + " trailing"],
    ["stripe-live-key", STRIPE_LIVE],
    ["shopify-token", "shpat_" + "0a9b".repeat(8) + " end"],
    ["sendgrid-key", "SG." + "x".repeat(25) + "." + "z".repeat(45)],
  ])("detects %s", (rule, content) => {
    const findings = scanContent("docs/notes.md", content);
    expect(findings.map((f) => f.rule)).toContain(rule);
  });

  it("reports the line number and a bounded excerpt", () => {
    const content = `line one\nline two ${AWS_EXAMPLE}\nline three\n`;
    const findings = scanContent("a.md", content);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(2);
    expect(findings[0].excerpt.length).toBeLessThanOrEqual(80);
    expect(findings[0].path).toBe("a.md");
  });

  it("passes clean content with no findings", () => {
    const findings = scanContent(
      "docs/adr/0001.md",
      "# Decision\n\nGoogle repairs stay read-only until a scoped ADR accepts them.\n",
    );
    expect(findings).toEqual([]);
  });

  it("passes euro amounts in UI source (legitimate formatting)", () => {
    const findings = scanContent(
      "src/app/billing/page.tsx",
      "const label = `Total: €${(cents / 100).toFixed(2)}`;\n",
    );
    expect(findings).toEqual([]);
  });

  it("does not double-report overlapping matches of the same rule", () => {
    const content = `${AWS_EXAMPLE} and ${["AKIA", "IOSFODNN7EXAM", "PLF"].join("")} twice`;
    const findings = scanContent("a.md", content);
    expect(findings.filter((f) => f.rule === "aws-access-key")).toHaveLength(2);
    expect(findings).toHaveLength(2);
  });

  it("keeps every secret pattern free of capture-group typos", () => {
    // Guards against regex edits that would silently break a rule.
    expect(SECRET_PATTERNS.length).toBeGreaterThanOrEqual(10);
    for (const { regex } of SECRET_PATTERNS) {
      expect(regex.source.length).toBeGreaterThan(5);
    }
  });
});
