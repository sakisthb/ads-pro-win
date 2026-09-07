/**
 * @jest-environment node
 */

import type { NextRequest } from "next/server";

const mockedFetch = jest.fn();
const mockedGetUser = jest.fn();
const mockedCreateServerClient = jest.fn();

jest.mock("next/server", () => {
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), init);
    }
    static next(init?: { request?: NextRequest }) {
      return new Response(null, { status: 200 });
    }
    static redirect(url: string | URL, status = 307) {
      return new Response(null, { status, headers: { Location: url.toString() } });
    }
  }
  return { NextResponse: MockNextResponse };
});

jest.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockedCreateServerClient(...args),
}));

// Import after mocks are registered.
const { middleware } = require("./middleware") as { middleware: (req: NextRequest) => Promise<Response> };

function buildRequest(
  pathname: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): NextRequest {
  const url = new URL(pathname, "http://localhost:3000");
  const headers = new Headers(opts.headers ?? {});
  if (opts.body && !headers.has("content-length")) {
    headers.set("content-length", String(Buffer.byteLength(opts.body)));
  }
  const request = new Request(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
  }) as NextRequest;
  Object.defineProperty(request, "nextUrl", {
    value: url,
    writable: false,
  });
  return request;
}

describe("middleware rate limiting", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockedFetch;
    process.env.INTERNAL_RATE_LIMIT_SECRET = "test-internal-secret-must-be-at-least-32-chars-long";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    process.env.TRUSTED_PROXY_HOPS = "1";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("calls the internal rate-limit endpoint with the client identifier and route", async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, limit: 1000, remaining: 999, resetTime: 12345 }), {
        status: 200,
      }),
    );

    const response = await middleware(
      buildRequest("/api/connections/woocommerce", {
        headers: { "x-forwarded-for": "203.0.113.42" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/internal/rate-limit");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_RATE_LIMIT_SECRET,
    });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      identifier: "ip:203.0.113.42",
      route: "api",
      windowMs: 15 * 60 * 1000,
      max: 1000,
    });
  });

  it("uses the rightmost untrusted IP from x-forwarded-for", async () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, limit: 1000, remaining: 999, resetTime: 12345 }), {
        status: 200,
      }),
    );

    await middleware(
      buildRequest("/api/test", {
        headers: { "x-forwarded-for": "spoofed, 198.51.100.1, 10.0.0.1" },
      }),
    );

    const body = JSON.parse((mockedFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.identifier).toBe("ip:198.51.100.1");
  });

  it("returns 429 with rate-limit headers when the bucket is exhausted", async () => {
    mockedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ allowed: false, limit: 10, remaining: 0, resetTime: 12345, retryAfter: 60 }),
        { status: 200 },
      ),
    );

    const response = await middleware(buildRequest("/api/chat", { method: "POST" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("12345");
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("adds rate-limit headers when the request is allowed", async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, limit: 1000, remaining: 500, resetTime: 12345 }), {
        status: 200,
      }),
    );

    const response = await middleware(buildRequest("/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("1000");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("500");
  });

  it("rejects oversized request bodies", async () => {
    const bigBody = "x".repeat(11 * 1024 * 1024);
    const response = await middleware(
      buildRequest("/api/chat", { method: "POST", body: bigBody }),
    );

    expect(response.status).toBe(413);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("responds to CORS preflight with 204", async () => {
    const response = await middleware(
      buildRequest("/api/trpc/organizations.list", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
  });

  it("adds the tRPC source header for tRPC routes", async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, limit: 2000, remaining: 1999, resetTime: 12345 }), {
        status: 200,
      }),
    );

    const response = await middleware(buildRequest("/api/trpc/organizations.list"));

    expect(response.headers.get("X-tRPC-Source")).toBe("nextjs-middleware");
  });

  it("limits /api/chat with the chat route bucket", async () => {
    mockedFetch.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, limit: 20, remaining: 19, resetTime: 12345 }), {
        status: 200,
      }),
    );

    await middleware(buildRequest("/api/chat", { method: "POST" }));

    const body = JSON.parse((mockedFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.route).toBe("chat");
    expect(body.max).toBe(20);
    expect(body.windowMs).toBe(60_000);
  });

  it("does not recurse by calling fetch for POST /api/internal/rate-limit", async () => {
    const response = await middleware(
      buildRequest("/api/internal/rate-limit", { method: "POST", body: "{}" }),
    );

    expect(response.status).toBe(200);
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
