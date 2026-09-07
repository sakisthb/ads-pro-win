// Next.js Middleware for API Security, Logging, and Auth
// Handles authentication, Redis-backed rate limiting, request logging, and
// security headers. Edge Runtime constraints mean Redis access is delegated to
// an internal Node.js route handler.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public page routes accessible without a session: the landing page plus the
// auth routes (login, signup, and the OAuth/email-confirmation callback).
// Every other non-API page is treated as protected, so the redirect covers
// the entire `(protected)` and `(chat)` route groups without per-route
// enumeration — new protected routes are guarded automatically.
const PUBLIC_PAGE_PATHS = ["/", "/auth/login", "/auth/signup", "/auth/callback"];

// Auth pages that bounce already-signed-in users to the dashboard.
const AUTH_REDIRECT_PATHS = ["/auth/login", "/auth/signup"];

const isPublicPage = (pathname: string) =>
  PUBLIC_PAGE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

const isAuthRedirectPath = (pathname: string) =>
  AUTH_REDIRECT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

const MAX_BODY_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface RateLimitRule {
  route: string;
  windowMs: number;
  max: number;
}

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { route: "internal", windowMs: 60_000, max: 100_000 },
  { route: "trpc", windowMs: 15 * 60 * 1000, max: 2_000 },
  { route: "chat", windowMs: 60_000, max: 20 },
  { route: "auth", windowMs: 60_000, max: 20 },
  { route: "health", windowMs: 60_000, max: 60 },
  { route: "api", windowMs: 15 * 60 * 1000, max: 1_000 },
];

function getClientIdentifier(request: NextRequest): string {
  const rawHops = process.env.TRUSTED_PROXY_HOPS ?? "1";
  const trustedHops = parseInt(rawHops, 10) || 1;
  const forwarded = request.headers.get("x-forwarded-for");

  let ip: string;
  if (forwarded) {
    // Take the rightmost untrusted address so clients cannot prepend arbitrary
    // IPs. If there are fewer addresses than trusted proxies, fall back to the
    // leftmost address we received.
    const ips = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = Math.max(0, ips.length - trustedHops);
    ip = ips[idx] ?? "unknown";
  } else {
    // `request.ip` is available in some Next.js / Edge Runtime deployments but
    // not included in the current type declarations; cast to avoid a build error.
    ip = (request as unknown as { ip?: string }).ip ?? "unknown";
  }

  return `ip:${ip}`;
}

function matchRateLimitRule(pathname: string): RateLimitRule {
  if (pathname === "/api/internal/rate-limit" || pathname.startsWith("/api/internal/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "internal")!;
  }
  if (pathname.startsWith("/api/trpc/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "trpc")!;
  }
  if (pathname === "/api/chat" || pathname.startsWith("/api/chat/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "chat")!;
  }
  if (pathname.startsWith("/api/auth/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "auth")!;
  }
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "health")!;
  }
  if (pathname.startsWith("/api/")) {
    return RATE_LIMIT_RULES.find((r) => r.route === "api")!;
  }
  return { route: "default", windowMs: 60_000, max: 100_000 };
}

interface RateLimitResponse {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

async function checkRateLimit(request: NextRequest): Promise<RateLimitResponse | null> {
  const rule = matchRateLimitRule(request.nextUrl.pathname);
  const identifier = getClientIdentifier(request);

  const secret = process.env.INTERNAL_RATE_LIMIT_SECRET ?? "";
  const url = new URL("/api/internal/rate-limit", request.nextUrl.origin);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({
        identifier,
        route: rule.route,
        windowMs: rule.windowMs,
        max: rule.max,
      }),
    });

    if (!response.ok) {
      console.error(`[middleware] Rate limit endpoint returned ${response.status}`);
      // Fail open on endpoint errors.
      return { allowed: true, limit: rule.max, remaining: rule.max, resetTime: Date.now() + rule.windowMs };
    }

    return (await response.json()) as RateLimitResponse;
  } catch (err) {
    console.error("[middleware] Rate limit fetch failed:", err instanceof Error ? err.message : err);
    return { allowed: true, limit: rule.max, remaining: rule.max, resetTime: Date.now() + rule.windowMs };
  }
}

function getAllowedOrigins(): string[] {
  const origins: string[] = [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.push(siteUrl);
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
  return origins;
}

function isAllowedOrigin(origin: string): boolean {
  return getAllowedOrigins().some((allowed) => origin === allowed);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Powered-By", "Ads Pro Enterprise v3.0");
  return response;
}

function applyCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : getAllowedOrigins()[0] ?? "";

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ---------------------------------------------------------------------------
  // API routes: rate limiting, body limits, security/CORS headers, logging.
  // ---------------------------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    const start = Date.now();

    // Reject oversized bodies before they reach route handlers.
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
        const response = NextResponse.json(
          { error: "Request body too large" },
          { status: 413 },
        );
        return applySecurityHeaders(response);
      }
    }

    // Respond to CORS preflight immediately.
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      applySecurityHeaders(response);
      applyCorsHeaders(response, request);
      return response;
    }

    // The rate-limit client posts to this same path. Skip that internal fetch
    // here so the request cannot re-enter middleware and recurse indefinitely.
    // Body-size, CORS, security headers, and development logging still apply.
    const rateLimit =
      pathname === "/api/internal/rate-limit"
        ? null
        : await checkRateLimit(request);

    if (rateLimit && !rateLimit.allowed) {
      const response = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set("X-RateLimit-Reset", String(rateLimit.resetTime));
      if (rateLimit.retryAfter) {
        response.headers.set("Retry-After", String(rateLimit.retryAfter));
      }
      applySecurityHeaders(response);
      return response;
    }

    const response = NextResponse.next();
    applySecurityHeaders(response);
    applyCorsHeaders(response, request);

    if (rateLimit) {
      response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      response.headers.set("X-RateLimit-Reset", String(rateLimit.resetTime));
    }

    if (pathname.startsWith("/api/trpc/")) {
      response.headers.set("X-tRPC-Source", "nextjs-middleware");
    }

    const acceptEncoding = request.headers.get("accept-encoding") || "";
    if (acceptEncoding.includes("br")) {
      response.headers.set("X-Compression-Available", "br,gzip");
    } else if (acceptEncoding.includes("gzip")) {
      response.headers.set("X-Compression-Available", "gzip");
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`🌐 ${request.method} ${pathname}`);
      const duration = Date.now() - start;
      console.log(`⏱️  API response time: ${duration}ms`);
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // Supabase Auth: refresh the session cookie + protect/auth-redirect pages.
  // Runs for all non-API page routes. Uses the @supabase/ssr middleware pattern
  // so the access token is rotated on every request and http-only cookies stay
  // in sync between the server and the browser.
  // ---------------------------------------------------------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicPage(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    const next = `${pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRedirectPath(pathname) && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
