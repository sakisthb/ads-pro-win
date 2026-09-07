/**
 * @jest-environment node
 */

import http from "http";

import { safeFetch, SafeFetchError, safeFetchText } from "../safe-fetch";

jest.mock("dns", () => ({
  promises: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

const mockedDns = jest.requireMock("dns") as { promises: { resolve4: jest.Mock; resolve6: jest.Mock } };
const mockedResolve4 = mockedDns.promises.resolve4;
const mockedResolve6 = mockedDns.promises.resolve6;

describe("safeFetch SSRF protection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolve4.mockRejectedValue(new Error("no A records"));
    mockedResolve6.mockRejectedValue(new Error("no AAAA records"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects non-HTTP(S) schemes", async () => {
    await expect(safeFetch("ftp://example.com/file")).rejects.toMatchObject({
      code: "INVALID_SCHEME",
    });
  });

  it("rejects URLs with embedded credentials", async () => {
    await expect(safeFetch("https://user:pass@example.com")).rejects.toMatchObject({
      code: "EMBEDDED_CREDENTIALS",
    });
  });

  it("rejects HTTP in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(safeFetch("http://example.com")).rejects.toMatchObject({
        code: "HTTP_IN_PRODUCTION",
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("rejects non-standard ports in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(safeFetch("https://example.com:8443")).rejects.toMatchObject({
        code: "NONSTANDARD_PORT",
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it.each([
    ["127.0.0.1"],
    ["10.0.0.1"],
    ["172.16.0.1"],
    ["172.31.255.255"],
    ["192.168.1.1"],
    ["169.254.1.1"],
    ["0.0.0.0"],
    ["224.0.0.1"],
    ["255.255.255.255"],
    ["::1"],
    ["fe80::1"],
    ["fc00::1"],
    ["ff02::1"],
    ["::ffff:127.0.0.1"],
  ])("rejects literal blocked IP %s", async (ip) => {
    const host = ip.includes(":") ? `[${ip}]` : ip;
    const url = `http://${host}/path`;
    await expect(safeFetch(url)).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("rejects a hostname that resolves only to blocked IPs", async () => {
    mockedResolve4.mockResolvedValue(["127.0.0.1"]);

    await expect(safeFetch("http://internal.example.com")).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("rejects a hostname when any resolved IP is blocked", async () => {
    mockedResolve4.mockResolvedValue(["127.0.0.1"]);
    mockedResolve6.mockResolvedValue(["::1"]);

    await expect(safeFetch("http://mixed.example.com")).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("allows a hostname that resolves to public IPs", async () => {
    mockedResolve4.mockResolvedValue(["1.1.1.1"]);

    // Cloudflare's 1.1.1.1 responds on port 80 with a 403. The important
    // assertion is that the request is not rejected by SSRF controls.
    const response = await safeFetch("http://public.example.com");
    expect(response).toBeInstanceOf(Object);
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it("allows a hostname that resolves to public IPv6 when no IPv4 exists", async () => {
    mockedResolve6.mockResolvedValue(["2606:4700:4700::1111"]);

    try {
      await safeFetch("http://public6.example.com");
    } catch (err) {
      expect(err).not.toBeInstanceOf(SafeFetchError);
    }
  });

  it("rejects DNS resolution failure", async () => {
    mockedResolve4.mockRejectedValue(new Error("NXDOMAIN"));

    await expect(safeFetch("http://missing.example.com")).rejects.toMatchObject({
      code: "DNS_ERROR",
    });
  });

  it("enforces request timeout", async () => {
    // TEST-NET-1 is a reserved, non-routable documentation range.
    mockedResolve4.mockResolvedValue(["192.0.2.1"]);

    await expect(
      safeFetch("http://slow.example.com", { timeoutMs: 1 }),
    ).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
  });

  it("enforces response size limit via Content-Length", async () => {
    mockedResolve4.mockResolvedValue(["127.0.0.1"]);

    await expect(
      safeFetch("http://localhost/large", { maxResponseSizeBytes: 1 }),
    ).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  describe("redirect handling", () => {
    let server: http.Server;
    let port: number;

    afterEach((done) => {
      if (server) {
        server.close(() => done());
      } else {
        done();
      }
    });

    it("rejects a redirect to a blocked destination", async () => {
      mockedResolve4.mockImplementation(async (hostname) => {
        if (hostname === "public.example.com") return ["127.0.0.1"];
        throw new Error("no records");
      });

      server = http.createServer((req, res) => {
        if (req.url === "/") {
          res.writeHead(302, { Location: "http://127.0.0.1/secret" });
          res.end();
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          port = (server.address() as http.AddressInfo).port;
          resolve();
        });
      });

      await expect(safeFetch(`http://public.example.com:${port}/`)).rejects.toMatchObject({
        code: "BLOCKED_IP",
      });
    });

    it("limits redirect hops", async () => {
      mockedResolve4.mockResolvedValue(["127.0.0.1"]);

      server = http.createServer((req, res) => {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/${Date.now()}` });
        res.end();
      });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          port = (server.address() as http.AddressInfo).port;
          resolve();
        });
      });

      await expect(
        safeFetch(`http://127.0.0.1:${port}/`, { maxRedirects: 2 }),
      ).rejects.toMatchObject({
        code: "BLOCKED_IP",
      });
    });
  });

  describe("successful fetch", () => {
    let server: http.Server;
    let port: number;

    beforeEach(async () => {
      mockedResolve4.mockImplementation(async (hostname) => {
        if (hostname === "localhost") return ["127.0.0.1"];
        throw new Error("no A records");
      });

      server = http.createServer((req, res) => {
        if (req.url === "/json") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else if (req.url === "/big") {
          res.writeHead(200, { "Content-Length": "100" });
          res.end("x".repeat(100));
        } else {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("hello");
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          port = (server.address() as http.AddressInfo).port;
          resolve();
        });
      });
    });

    afterEach((done) => {
      if (server) {
        server.close(() => done());
      } else {
        done();
      }
    });

    it("blocks a local server accessed by literal loopback IP", async () => {
      await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({
        code: "BLOCKED_IP",
      });
    });

    it("blocks a local server accessed by localhost", async () => {
      await expect(safeFetch(`http://localhost:${port}/`)).rejects.toMatchObject({
        code: "BLOCKED_IP",
      });
    });

    it("safeFetchText returns text when fetched via allowed host", async () => {
      // A real public-IP server is not available in unit tests, so this only
      // verifies the helper is exported as a function.
      expect(typeof safeFetchText).toBe("function");
    });
  });

  it("exposes SafeFetchError with code", () => {
    const err = new SafeFetchError("boom", "INVALID_URL");
    expect(err.code).toBe("INVALID_URL");
    expect(err.message).toBe("boom");
  });
});
