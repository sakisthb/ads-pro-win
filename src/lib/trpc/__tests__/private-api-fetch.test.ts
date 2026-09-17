/** @jest-environment node */
import { fetchPrivateApi } from "../private-api-fetch";

describe("private API transport", () => {
  afterEach(() => jest.restoreAllMocks());

  it("bypasses HTTP cache and includes the authenticated session", async () => {
    const response = new Response("fresh account");
    const transport = jest.spyOn(global, "fetch").mockResolvedValue(response);
    const signal = new AbortController().signal;

    expect(await fetchPrivateApi("/api/trpc/connections.list", {
      cache: "force-cache", credentials: "omit", signal,
      headers: { "x-trpc-source": "nextjs-react" },
    })).toBe(response);
    expect(transport).toHaveBeenCalledWith("/api/trpc/connections.list", {
      cache: "no-store", credentials: "include", signal,
      headers: { "x-trpc-source": "nextjs-react" },
    });
  });

  it("preserves POST method, body and abort behavior without retries", async () => {
    const failure = new Error("network unavailable");
    const transport = jest.spyOn(global, "fetch").mockRejectedValue(failure);
    await expect(fetchPrivateApi("/api/trpc/connections.select", {
      method: "POST", body: "selected account",
    })).rejects.toBe(failure);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith("/api/trpc/connections.select", {
      method: "POST", body: "selected account", cache: "no-store", credentials: "include",
    });
  });
});
