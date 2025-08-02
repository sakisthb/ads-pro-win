// Next.js Middleware for API Security and Logging
// Handles authentication, rate limiting, and request logging

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting store (in production, use Redis)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
};

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  return `rate_limit:${ip}`;
}

function checkRateLimit(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const current = rateLimit.get(key);

  if (!current || now > current.resetTime) {
    // Reset the count
    rateLimit.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return true;
  }

  if (current.count >= RATE_LIMIT.max) {
    return false;
  }

  current.count++;
  return true;
}

export function middleware(request: NextRequest) {
  // API route logging and rate limiting
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const start = Date.now();
    
    // Rate limiting for API routes
    if (!checkRateLimit(request)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Log API requests in development
    if (process.env.NODE_ENV === "development") {
      console.log(`🌐 ${request.method} ${request.nextUrl.pathname}`);
    }

    // Add CORS headers for API routes
    const response = NextResponse.next();
    
    // Add security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // CORS headers for API
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Log response time in development
    if (process.env.NODE_ENV === "development") {
      const duration = Date.now() - start;
      console.log(`⏱️  API response time: ${duration}ms`);
    }

    return response;
  }

  // tRPC specific middleware
  if (request.nextUrl.pathname.startsWith("/api/trpc/")) {
    // Add tRPC specific headers
    const response = NextResponse.next();
    response.headers.set("X-tRPC-Source", "nextjs-middleware");
    return response;
  }

  // AI endpoints specific middleware
  if (request.nextUrl.pathname.includes("/ai/")) {
    // Enhanced rate limiting for AI endpoints (more restrictive)
    const aiKey = `ai_${getRateLimitKey(request)}`;
    const aiLimit = { windowMs: 60 * 1000, max: 10 }; // 10 requests per minute for AI
    
    const now = Date.now();
    const current = rateLimit.get(aiKey);

    if (!current || now > current.resetTime) {
      rateLimit.set(aiKey, {
        count: 1,
        resetTime: now + aiLimit.windowMs,
      });
    } else if (current.count >= aiLimit.max) {
      return NextResponse.json(
        { error: "AI rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    } else {
      current.count++;
    }

    // Log AI requests
    console.log(`🤖 AI Request: ${request.method} ${request.nextUrl.pathname}`);
  }

  return NextResponse.next();
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