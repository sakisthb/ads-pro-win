/** @jest-environment node */
import { GET, POST } from "./route";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

jest.mock("@trpc/server/adapters/fetch", () => ({ fetchRequestHandler: jest.fn() }));
jest.mock("@/env", () => ({ env: { NODE_ENV: "test" } }));
jest.mock("@/lib/trpc/root", () => ({ appRouter: {} }));
jest.mock("@/lib/trpc/server", () => ({ createTRPCContext: jest.fn() }));

describe("authenticated tRPC HTTP responses", () => {
  it.each([200, 401, 403, 500])("never publicly caches a GET response (%s)", async (status) => {
    jest.mocked(fetchRequestHandler).mockResolvedValue(new Response("account result", {
      status, headers: { "Cache-Control": "public, max-age=604800", "Content-Type": "application/json" },
    }));
    const response = await GET(new Request("https://adpd.gr/api/trpc/connections.list") as NextRequest);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.text()).toBe("account result");
  });

  it("preserves streaming POST bodies while disabling storage", async () => {
    jest.mocked(fetchRequestHandler).mockResolvedValue(new Response("streamed mutation result"));
    const response = await POST(new Request("https://adpd.gr/api/trpc/connections.select", { method: "POST" }) as NextRequest);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(await response.text()).toBe("streamed mutation result");
  });
});
