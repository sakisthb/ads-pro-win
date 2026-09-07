/**
 * Redis-backed sliding-window rate limiter.
 *
 * Used by middleware (via the internal /api/internal/rate-limit route) and by
 * API routes that need route-specific limits. Runs in Node.js only; Edge
 * Runtime code must call the internal endpoint rather than importing this
 * module directly because it depends on `ioredis`.
 */

import IORedis from "ioredis";

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisDb = parseInt(process.env.REDIS_DB || "0", 10);

export interface RateLimitRule {
  /** Route prefix used for grouping limits. */
  route: string;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export const DEFAULT_RATE_LIMIT_RULES: RateLimitRule[] = [
  // Internal infrastructure routes should not be throttled by the public limiter.
  { route: "internal", windowMs: 60_000, max: 100_000 },
  // tRPC batches many tiny requests per dashboard interaction.
  { route: "trpc", windowMs: 15 * 60 * 1000, max: 2_000 },
  // AI chat endpoint.
  { route: "chat", windowMs: 60_000, max: 20 },
  // Authentication endpoints — conservative to slow brute force / enumeration.
  { route: "auth", windowMs: 60_000, max: 20 },
  // Health probes.
  { route: "health", windowMs: 60_000, max: 60 },
  // General API fallback.
  { route: "api", windowMs: 15 * 60 * 1000, max: 1_000 },
];

let sharedConnection: IORedis | null = null;

function getConnection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = new IORedis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      db: redisDb,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 2_000,
      commandTimeout: 1_500,
      enableReadyCheck: false,
    });

    sharedConnection.on("error", (err) => {
      // ioredis emits errors asynchronously; log them but do not crash the
      // process. Callers receive rejected promises for the commands in flight.
      console.error("[rate-limiter] Redis connection error:", err.message);
    });
  }
  return sharedConnection;
}

/**
 * Determine which rate-limit bucket a pathname belongs to. More specific routes
 * are checked first so `/api/trpc/...` uses the trpc rule, not the generic api
 * rule.
 */
export function matchRateLimitRule(
  pathname: string,
  rules: RateLimitRule[] = DEFAULT_RATE_LIMIT_RULES,
): RateLimitRule {
  if (pathname === "/api/internal/rate-limit" || pathname.startsWith("/api/internal/")) {
    return rules.find((r) => r.route === "internal") ?? DEFAULT_RATE_LIMIT_RULES[0];
  }
  if (pathname.startsWith("/api/trpc/")) {
    return rules.find((r) => r.route === "trpc") ?? DEFAULT_RATE_LIMIT_RULES[1];
  }
  if (pathname === "/api/chat" || pathname.startsWith("/api/chat/")) {
    return rules.find((r) => r.route === "chat") ?? DEFAULT_RATE_LIMIT_RULES[2];
  }
  if (pathname.startsWith("/api/auth/")) {
    return rules.find((r) => r.route === "auth") ?? DEFAULT_RATE_LIMIT_RULES[3];
  }
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return rules.find((r) => r.route === "health") ?? DEFAULT_RATE_LIMIT_RULES[4];
  }
  if (pathname.startsWith("/api/")) {
    return rules.find((r) => r.route === "api") ?? DEFAULT_RATE_LIMIT_RULES[5];
  }
  // Non-API routes are not rate-limited here (page auth is handled separately).
  return { route: "default", windowMs: 60_000, max: 100_000 };
}

/**
 * Sliding-window rate limit check backed by Redis.
 *
 * A sorted set stores request timestamps for each identifier+route. Entries
 * outside the current window are removed, the remaining count is compared to
 * `max`, and the current request timestamp is added.
 */
export async function checkRateLimit(args: {
  identifier: string;
  route: string;
  windowMs: number;
  max: number;
  redis?: IORedis;
}): Promise<RateLimitResult> {
  const { identifier, route, windowMs, max } = args;
  const redis = args.redis ?? getConnection();
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = `ratelimit:v1:${route}:${identifier}`;

  // Ensure a connection before issuing commands.
  if (redis.status === "wait") {
    try {
      await redis.connect();
    } catch (err) {
      console.error("[rate-limiter] Failed to connect to Redis:", err instanceof Error ? err.message : err);
      // Fail open so a Redis outage does not hard-down the site, but treat the
      // caller as allowed with no remaining budget surfaced. This is a safety
      // compromise; the deployment should page on Redis unavailability.
      return { allowed: true, limit: max, remaining: 0, resetTime: now + windowMs };
    }
  }

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
  multi.zcard(key);
  multi.pexpire(key, windowMs);

  let results: [Error | null, unknown][] | null;
  try {
    results = await multi.exec();
  } catch (err) {
    console.error("[rate-limiter] Redis command failed:", err instanceof Error ? err.message : err);
    return { allowed: true, limit: max, remaining: 0, resetTime: now + windowMs };
  }

  if (!results) {
    return { allowed: true, limit: max, remaining: 0, resetTime: now + windowMs };
  }

  // multi.exec returns [Error|null, unknown][] in ioredis.
  const countResult = results[2];
  const count =
    Array.isArray(countResult) && countResult[0] === null && typeof countResult[1] === "number"
      ? countResult[1]
      : 0;

  const allowed = count <= max;
  const resetTime = now + windowMs;
  const remaining = Math.max(0, max - count);
  const retryAfter = allowed ? undefined : Math.ceil(windowMs / 1000);

  return { allowed, limit: max, remaining, resetTime, retryAfter };
}

/**
 * Reset a rate-limit bucket. Useful in tests.
 */
export async function resetRateLimit(identifier: string, route: string, redis?: IORedis): Promise<void> {
  const key = `ratelimit:v1:${route}:${identifier}`;
  await (redis ?? getConnection()).del(key);
}

/**
 * Close the shared Redis connection. Useful in tests and graceful shutdown.
 */
export async function closeRateLimiterConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
