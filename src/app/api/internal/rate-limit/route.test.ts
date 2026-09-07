/**
 * @jest-environment node
 */

import { POST } from "./route";

jest.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

const { checkRateLimit } = jest.requireMock("@/lib/rate-limiter") as {
  checkRateLimit: jest.Mock;
};

describe("POST /api/internal/rate-limit", () => {
  const secret = "test-internal-secret-must-be-at-least-32-chars-long";

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.INTERNAL_RATE_LIMIT_SECRET = secret;
    process.env.RATE_LIMIT_ENABLED = "true";
  });

  function request(body: unknown, providedSecret?: string) {
    return new Request("http://localhost/api/internal/rate-limit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": providedSecret ?? secret,
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 403 without a secret", async () => {
    process.env.INTERNAL_RATE_LIMIT_SECRET = "";
    const response = await POST(request({ identifier: "x", route: "api", windowMs: 1000, max: 1 }));
    expect(response.status).toBe(403);
  });

  it("returns 403 with a mismatched secret", async () => {
    const response = await POST(
      request({ identifier: "x", route: "api", windowMs: 1000, max: 1 }, "wrong-secret"),
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid body", async () => {
    const response = await POST(request({ identifier: "x" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/internal/rate-limit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: "not-json",
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("short-circuits to allowed when rate limiting is disabled", async () => {
    process.env.RATE_LIMIT_ENABLED = "false";
    const response = await POST(request({ identifier: "x", route: "api", windowMs: 1000, max: 5 }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowed: true,
      limit: 5,
      remaining: 5,
      resetTime: expect.any(Number),
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("delegates to checkRateLimit and returns its result", async () => {
    checkRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 7,
      resetTime: 1234567890,
    });
    const response = await POST(
      request({ identifier: "client-1", route: "api", windowMs: 60_000, max: 10 }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowed: true,
      limit: 10,
      remaining: 7,
      resetTime: 1234567890,
    });
    expect(checkRateLimit).toHaveBeenCalledWith({
      identifier: "client-1",
      route: "api",
      windowMs: 60_000,
      max: 10,
    });
  });

  it("fails open when checkRateLimit throws", async () => {
    checkRateLimit.mockRejectedValue(new Error("Redis down"));
    const response = await POST(
      request({ identifier: "client-2", route: "api", windowMs: 60_000, max: 10 }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.allowed).toBe(true);
  });
});
