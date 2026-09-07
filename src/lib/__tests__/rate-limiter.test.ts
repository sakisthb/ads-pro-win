/**
 * @jest-environment node
 */

import {
  checkRateLimit,
  closeRateLimiterConnection,
  matchRateLimitRule,
  resetRateLimit,
} from "../rate-limiter";

class FakeRedis {
  private store = new Map<string, Array<{ score: number; member: string }>>();
  private expiry = new Map<string, number>();

  status = "wait";

  async connect() {
    this.status = "ready";
  }

  multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const store = this.store;
    const expiry = this.expiry;

    return {
      zremrangebyscore(key: string, min: number, max: number) {
        ops.push(async () => {
          const entries = store.get(key) ?? [];
          const kept = entries.filter((e) => e.score > max || e.score < min);
          if (kept.length === 0) store.delete(key);
          else store.set(key, kept);
          return kept.length;
        });
        return this;
      },
      zadd(key: string, score: number, member: string) {
        ops.push(async () => {
          const entries = store.get(key) ?? [];
          entries.push({ score, member });
          store.set(key, entries);
          return 1;
        });
        return this;
      },
      zcard(key: string) {
        ops.push(async () => store.get(key)?.length ?? 0);
        return this;
      },
      pexpire(key: string, ms: number) {
        ops.push(async () => {
          expiry.set(key, Date.now() + ms);
          return 1;
        });
        return this;
      },
      async exec() {
        const results: [null, unknown][] = [];
        for (const op of ops) {
          try {
            results.push([null, await op()]);
          } catch (err) {
            results.push([err as Error, null]);
          }
        }
        return results;
      },
    };
  }

  async del(key: string) {
    this.store.delete(key);
    this.expiry.delete(key);
    return 1;
  }

  async quit() {
    this.store.clear();
    this.expiry.clear();
  }

  on() {
    // no-op event listener
  }
}

const fakeRedis = new FakeRedis();

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(() => fakeRedis),
}));

describe("matchRateLimitRule", () => {
  it("matches internal routes first", () => {
    expect(matchRateLimitRule("/api/internal/rate-limit").route).toBe("internal");
    expect(matchRateLimitRule("/api/internal/health").route).toBe("internal");
  });

  it("matches tRPC routes", () => {
    expect(matchRateLimitRule("/api/trpc/organizations.list").route).toBe("trpc");
  });

  it("matches chat routes", () => {
    expect(matchRateLimitRule("/api/chat").route).toBe("chat");
    expect(matchRateLimitRule("/api/chat/").route).toBe("chat");
  });

  it("matches auth routes", () => {
    expect(matchRateLimitRule("/api/auth/meta").route).toBe("auth");
  });

  it("matches health routes", () => {
    expect(matchRateLimitRule("/api/health").route).toBe("health");
  });

  it("falls back to generic api for other API paths", () => {
    expect(matchRateLimitRule("/api/connections/woocommerce").route).toBe("api");
  });

  it("uses a high-limit default for non-API paths", () => {
    const rule = matchRateLimitRule("/dashboard");
    expect(rule.route).toBe("default");
    expect(rule.max).toBeGreaterThanOrEqual(100_000);
  });
});

describe("checkRateLimit sliding window", () => {
  beforeEach(async () => {
    fakeRedis.status = "wait";
    await fakeRedis.quit();
  });

  afterAll(async () => {
    await closeRateLimiterConnection();
  });

  it("allows the first N requests", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit({
        identifier: "client-a",
        route: "auth",
        windowMs: 60_000,
        max: 3,
      });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests that exceed the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ identifier: "client-b", route: "auth", windowMs: 60_000, max: 3 });
    }
    const result = await checkRateLimit({
      identifier: "client-b",
      route: "auth",
      windowMs: 60_000,
      max: 3,
    });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("segregates by identifier", async () => {
    await checkRateLimit({ identifier: "client-c", route: "auth", windowMs: 60_000, max: 1 });
    const other = await checkRateLimit({
      identifier: "client-d",
      route: "auth",
      windowMs: 60_000,
      max: 1,
    });
    expect(other.allowed).toBe(true);
  });

  it("segregates by route", async () => {
    await checkRateLimit({ identifier: "client-e", route: "auth", windowMs: 60_000, max: 1 });
    const other = await checkRateLimit({
      identifier: "client-e",
      route: "api",
      windowMs: 60_000,
      max: 1,
    });
    expect(other.allowed).toBe(true);
  });

  it("resets a bucket", async () => {
    await checkRateLimit({ identifier: "client-f", route: "auth", windowMs: 60_000, max: 1 });
    await resetRateLimit("client-f", "auth");
    const result = await checkRateLimit({
      identifier: "client-f",
      route: "auth",
      windowMs: 60_000,
      max: 1,
    });
    expect(result.allowed).toBe(true);
  });
});
