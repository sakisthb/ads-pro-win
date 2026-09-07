/**
 * @jest-environment node
 */

import {
  logSecurityEvent,
  redactSecrets,
  sanitizeUrlForEvent,
  SecurityEventContext,
} from "../security-events";

describe("redactSecrets", () => {
  it("redacts bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")).toBe(
      "Authorization: bearer [redacted]",
    );
  });

  it("redacts labelled secrets regardless of separator or case", () => {
    expect(redactSecrets("failed with api_key=sk-live-1234567890")).toBe(
      "failed with api_key=[redacted]",
    );
    expect(redactSecrets("password: hunter2secret")).toBe("password=[redacted]");
    expect(redactSecrets("Consumer_Secret: abc123def")).toBe("Consumer_Secret=[redacted]");
    expect(redactSecrets("refresh_token=tok_abcdefghijklmnop")).toBe(
      "refresh_token=[redacted]",
    );
  });

  it("stops labelled-secret values at delimiters so trailing text survives", () => {
    expect(redactSecrets("token=secret123, retrying")).toBe("token=[redacted], retrying");
  });

  it("strips query strings and fragments from embedded URLs", () => {
    expect(redactSecrets("fetch failed for https://api.example.com/v1?access_token=abc123")).toBe(
      "fetch failed for https://api.example.com/v1",
    );
    expect(redactSecrets("see https://shop.example.com/checkout#code=xyz")).toBe(
      "see https://shop.example.com/checkout",
    );
  });
});

describe("sanitizeUrlForEvent", () => {
  it("returns null for empty input", () => {
    expect(sanitizeUrlForEvent(null)).toBeNull();
    expect(sanitizeUrlForEvent(undefined)).toBeNull();
    expect(sanitizeUrlForEvent("")).toBeNull();
  });

  it("strips query and fragment from string and URL inputs", () => {
    expect(sanitizeUrlForEvent("https://evil.example.com/path?token=secret")).toBe(
      "https://evil.example.com/path",
    );
    expect(
      sanitizeUrlForEvent(new URL("https://evil.example.com/p#access_token=secret")),
    ).toBe("https://evil.example.com/p");
  });

  it("marks unparseable URLs instead of echoing them", () => {
    expect(sanitizeUrlForEvent("not a url")).toBe("[unparseable]");
  });
});

describe("logSecurityEvent", () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const events = (spy: jest.SpyInstance) =>
    spy.mock.calls.map((call) => JSON.parse(String(call[0]))) as Array<Record<string, unknown>>;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("emits single-line parseable JSON with ts, level, and event", () => {
    logSecurityEvent("ssrf_blocked", "warn", { code: "private_address", host: "10.0.0.1" });
    const lines = warnSpy.mock.calls.map(String);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    const parsed = JSON.parse(lines[0]);
    expect(parsed.event).toBe("ssrf_blocked");
    expect(parsed.level).toBe("warn");
    expect(parsed.code).toBe("private_address");
    expect(parsed.host).toBe("10.0.0.1");
    expect(typeof parsed.ts).toBe("string");
  });

  it.each([
    ["info", "log"],
    ["warn", "warn"],
    ["error", "error"],
  ] as const)("routes %s severity to console.%s", (severity, method) => {
    logSecurityEvent("authz_denied", severity, { code: "test" });
    const spy = method === "log" ? logSpy : method === "warn" ? warnSpy : errorSpy;
    expect(spy).toHaveBeenCalledTimes(1);
    expect([logSpy, warnSpy, errorSpy].filter((s) => s !== spy)).toEqual(
      expect.arrayContaining([expect.objectContaining({ mock: expect.objectContaining({ calls: [] }) })]),
    );
  });

  it("skips null, undefined, and empty context values", () => {
    logSecurityEvent("ws_rejected", "warn", {
      code: "expired",
      userId: null,
      organizationId: undefined,
      platform: "",
      channel: "org-1:*",
    });
    const [event] = events(warnSpy);
    expect(Object.keys(event).sort()).toEqual(["channel", "code", "event", "level", "ts"]);
  });

  it("passes numeric fields through unredacted", () => {
    logSecurityEvent("migration_status", "error", { code: "failed_migrations", count: 3 });
    const [event] = events(errorSpy);
    expect(event.count).toBe(3);
  });

  it("sanitizes url context values and redacts message free text", () => {
    logSecurityEvent("oauth_failure", "error", {
      code: "token_exchange_failed",
      url: "https://oauth.provider.com/token?client_secret=supersecret",
      message: "exchange failed for client_secret=abc123 token_type=bearer",
    });
    const [event] = events(errorSpy);
    const raw = String(errorSpy.mock.calls[0][0]);
    expect(event.url).toBe("https://oauth.provider.com/token");
    expect(raw).not.toContain("supersecret");
    expect(raw).not.toContain("abc123");
    expect(event.message).toContain("client_secret=[redacted]");
  });

  it("truncates long strings and messages with an ellipsis", () => {
    const longField = "a".repeat(300);
    const longMessage = "m".repeat(600);
    logSecurityEvent("queue_failure", "error", {
      queue: longField,
      message: longMessage,
    });
    const [event] = events(errorSpy);
    expect(String(event.queue)).toHaveLength(256 + 3);
    expect(String(event.queue).endsWith("...")).toBe(true);
    expect(String(event.message)).toHaveLength(512 + 3);
  });

  it("never leaks bearer tokens or query secrets in any field", () => {
    const context: SecurityEventContext = {
      code: "token_exchange_failed",
      origin: "https://app.example.com/callback?code=forged&state=tampered",
      message: "POST https://provider.com/token failed for client_secret=topsecret123",
      channel: "bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
    };
    logSecurityEvent("oauth_failure", "error", context);
    const raw = String(errorSpy.mock.calls[0][0]);
    expect(raw).not.toContain("forged");
    expect(raw).not.toContain("tampered");
    expect(raw).not.toContain("topsecret123");
    expect(raw).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    const [event] = events(errorSpy);
    expect(event.origin).toBe("https://app.example.com/callback");
    expect(event.channel).toBe("bearer [redacted]");
    expect(event.message).toContain("client_secret=[redacted]");
  });
});
