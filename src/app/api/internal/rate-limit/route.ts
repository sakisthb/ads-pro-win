/**
 * Internal rate-limit decision endpoint.
 *
 * Next.js middleware runs in the Edge Runtime and cannot import `ioredis`.
 * Middleware delegates its rate-limit decisions to this Node.js route handler,
 * which is protected by `INTERNAL_RATE_LIMIT_SECRET` so external clients cannot
 * query or reset public rate-limit state.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

interface RateLimitRequestBody {
  identifier: string;
  route: string;
  windowMs: number;
  max: number;
}

function isValidBody(body: unknown): body is RateLimitRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.identifier === "string" &&
    b.identifier.length > 0 &&
    typeof b.route === "string" &&
    b.route.length > 0 &&
    typeof b.windowMs === "number" &&
    Number.isFinite(b.windowMs) &&
    b.windowMs > 0 &&
    typeof b.max === "number" &&
    Number.isFinite(b.max) &&
    b.max > 0
  );
}

export async function POST(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_RATE_LIMIT_SECRET ?? "";
  const secret = request.headers.get("x-internal-secret");
  if (!internalSecret || secret !== internalSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (process.env.RATE_LIMIT_ENABLED === "false") {
    return NextResponse.json(
      {
        allowed: true,
        limit: body.max,
        remaining: body.max,
        resetTime: Date.now() + body.windowMs,
      },
      { status: 200 },
    );
  }

  try {
    const result = await checkRateLimit(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[internal/rate-limit] Unexpected error:", err instanceof Error ? err.message : err);
    // Fail open on unexpected errors so a bug here does not hard-down the site.
    return NextResponse.json(
      {
        allowed: true,
        limit: body.max,
        remaining: body.max,
        resetTime: Date.now() + body.windowMs,
      },
      { status: 200 },
    );
  }
}
