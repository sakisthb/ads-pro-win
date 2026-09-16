/**
 * @jest-environment node
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
    redirect: (url: string | URL, status = 307) =>
      new Response(null, {
        status,
        headers: { Location: url.toString() },
      }),
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/org-bootstrap", () => ({
  ensureUserMemberships: jest.fn(),
}));

jest.mock("@/lib/active-org", () => ({
  activeOrgCookieOptions: jest.fn(),
}));

import { GET } from "@/app/auth/callback/route";

describe("GET /auth/callback public origin", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl == null) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("redirects to NEXT_PUBLIC_SITE_URL instead of the Docker 0.0.0.0 listen address", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://adpd.gr";
    const request = new Request("https://0.0.0.0:3000/auth/callback", {
      headers: {
        host: "0.0.0.0:3000",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://adpd.gr/dashboard");
    expect(response.headers.get("Location")).not.toMatch(/0\.0\.0\.0/);
  });

  it("keeps a relative next path on the public origin", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://adpd.gr";
    const request = new Request(
      "https://0.0.0.0:3000/auth/callback?next=%2Fconnections",
    );

    const response = await GET(request);

    expect(response.headers.get("Location")).toBe("https://adpd.gr/connections");
  });

  it("sends auth errors to the public login URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://adpd.gr";
    const request = new Request(
      "https://0.0.0.0:3000/auth/callback?error=access_denied&error_description=user%20cancelled",
    );

    const response = await GET(request);

    expect(response.headers.get("Location")).toBe(
      "https://adpd.gr/auth/login?error=user%20cancelled",
    );
  });
});
