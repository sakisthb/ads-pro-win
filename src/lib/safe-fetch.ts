// Server-only SSRF-safe outbound transport.
//
// All calls that fetch user-supplied or indirectly controlled URLs must go
// through safeFetch. It validates the URL, resolves and filters DNS records at
// connection time, follows redirects manually while revalidating each hop,
// enforces timeouts and response-size limits, and never follows non-HTTP(S)
// destinations or URLs with embedded credentials.

import dns from "dns";
import http from "http";
import https from "https";
import net from "net";
import fetch, { Headers, Response } from "node-fetch";
import stream from "stream";
import tls from "tls";
import { Transform } from "stream";
import { URL } from "url";

import { logSecurityEvent } from "@/lib/security-events";

const { resolve4, resolve6 } = dns.promises;

if (typeof window !== "undefined") {
  throw new Error("safe-fetch is server-only");
}

export type SafeFetchErrorCode =
  | "INVALID_URL"
  | "INVALID_SCHEME"
  | "HTTP_IN_PRODUCTION"
  | "EMBEDDED_CREDENTIALS"
  | "MISSING_HOST"
  | "INVALID_PORT"
  | "NONSTANDARD_PORT"
  | "DNS_ERROR"
  | "BLOCKED_IP"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "REQUEST_TIMEOUT";

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code: SafeFetchErrorCode,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | Buffer | Uint8Array;
  maxRedirects?: number;
  maxResponseSizeBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function sanitizeUrlForLog(url: URL): string {
  return `${url.protocol}//${url.hostname}${url.pathname}`;
}

function logBlocked(message: string, url: URL, code: SafeFetchErrorCode): void {
  logSecurityEvent("ssrf_blocked", "warn", {
    code,
    url: sanitizeUrlForLog(url),
    message,
  });
}

function logConnectTimeBlock(hostname: string, error: unknown): void {
  const code = error instanceof SafeFetchError ? error.code : "BLOCKED_IP";
  logSecurityEvent("ssrf_blocked", "warn", {
    code,
    host: hostname,
    message: error instanceof Error ? error.message : String(error),
  });
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => parseInt(part, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 addresses: check the embedded IPv4.
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice(7);
    return isBlockedIPv4(v4);
  }

  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  const hextets = normalized.split(":");
  const firstHextet = hextets[0];
  if (!firstHextet) return true;
  const first = parseInt(firstHextet, 16);
  if (Number.isNaN(first)) return true;

  if (first >= 0xfc00 && first <= 0xfdff) return true; // unique local (fc00::/7)
  if (first >= 0xfe80 && first <= 0xfebf) return true; // link-local (fe80::/10)
  if (first >= 0xff00) return true; // multicast (ff00::/8)

  // Documentation and IETF special-purpose ranges.
  if (first === 0x2001) {
    const second = parseInt(hextets[1] || "0", 16);
    if (!Number.isNaN(second)) {
      if (second <= 0x01ff) return true; // 2001::/23
      if (second === 0x0db8) return true; // 2001:db8::/32
    }
  }
  if (first === 0x0100 && hextets[1] === "0") return true; // 100::/64

  return false;
}

function isAllowedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return !isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return !isBlockedIPv6(ip);
  return false;
}

async function resolveAllowedIps(hostname: string): Promise<string[]> {
  const [v4Result, v6Result] = await Promise.allSettled([
    resolve4(hostname),
    resolve6(hostname),
  ]);

  const ips: string[] = [];
  if (v4Result.status === "fulfilled") ips.push(...v4Result.value);
  if (v6Result.status === "fulfilled") ips.push(...v6Result.value);

  if (ips.length === 0) {
    const reasons = [v4Result, v6Result]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason)
      .filter(Boolean);
    throw new SafeFetchError(
      `DNS resolution failed: ${reasons.map((e) => (e instanceof Error ? e.message : String(e))).join(", ")}`,
      "DNS_ERROR",
    );
  }

  const blocked = ips.filter((ip) => !isAllowedIp(ip));
  if (blocked.length > 0) {
    throw new SafeFetchError("Destination resolved to a blocked IP address", "BLOCKED_IP");
  }
  return ips;
}

const validatingLookup: net.LookupFunction = (hostname, options, callback) => {
  resolveAllowedIps(hostname)
    .then((ips) => {
      const v4 = ips.find((ip) => net.isIPv4(ip));
      const v6 = ips.find((ip) => net.isIPv6(ip));
      const chosen = v4 ? { address: v4, family: 4 } : v6 ? { address: v6, family: 6 } : null;

      if (!chosen) {
        callback(
          new SafeFetchError("No usable IP address after filtering", "BLOCKED_IP"),
          "",
          0,
        );
        return;
      }

      if (options.all) {
        callback(null, [chosen]);
        return;
      }

      callback(null, chosen.address, chosen.family);
    })
    .catch((err) => {
      // Connect-time validation failure — this is the DNS-rebinding guard, so
      // it fires for destinations that changed resolution after validation.
      logConnectTimeBlock(hostname, err);
      callback(
        err instanceof Error ? err : new SafeFetchError(String(err), "BLOCKED_IP"),
        "",
        0,
      );
    });
};

class ValidatingHttpAgent extends http.Agent {
  createConnection(
    options: http.ClientRequestArgs,
    callback?: (err: Error | null, stream: stream.Duplex) => void,
  ): stream.Duplex {
    const socket = net.connect({ ...(options as net.NetConnectOpts), lookup: validatingLookup });
    if (callback) {
      const cb = callback as (err: Error | null, stream?: stream.Duplex) => void;
      socket.once("connect", () => cb(null, socket));
      socket.once("error", (err) => cb(err));
    }
    return socket;
  }
}

class ValidatingHttpsAgent extends https.Agent {
  createConnection(
    options: http.ClientRequestArgs,
    callback?: (err: Error | null, stream: stream.Duplex) => void,
  ): stream.Duplex {
    const socket = tls.connect({ ...(options as tls.ConnectionOptions), lookup: validatingLookup });
    if (callback) {
      const cb = callback as (err: Error | null, stream?: stream.Duplex) => void;
      socket.once("secureConnect", () => cb(null, socket));
      socket.once("error", (err) => cb(err));
    }
    return socket;
  }
}

const httpAgent = new ValidatingHttpAgent();
const httpsAgent = new ValidatingHttpsAgent();

function getAgent(protocol: string): http.Agent | https.Agent {
  return protocol === "https:" ? httpsAgent : httpAgent;
}

function validateUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only HTTP and HTTPS URLs are allowed", "INVALID_SCHEME");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new SafeFetchError("Only HTTPS URLs are allowed in production", "HTTP_IN_PRODUCTION");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("URLs with embedded credentials are not allowed", "EMBEDDED_CREDENTIALS");
  }
  if (!url.hostname || url.hostname.length === 0) {
    throw new SafeFetchError("URL must have a hostname", "MISSING_HOST");
  }

  const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new SafeFetchError("Invalid port number", "INVALID_PORT");
  }

  if (process.env.NODE_ENV === "production" && port !== 443) {
    throw new SafeFetchError("Only standard HTTPS port 443 is allowed in production", "NONSTANDARD_PORT");
  }
}

function normalizedHostname(url: URL): string {
  // WHATWG URL keeps brackets around IPv6 literals in hostname.
  return url.hostname.replace(/^\[|\]$/g, "");
}

async function validateDestination(url: URL): Promise<void> {
  validateUrl(url);

  const host = normalizedHostname(url);

  // Block literal IP addresses immediately; do not send them through DNS.
  if (net.isIPv4(host) || net.isIPv6(host)) {
    if (!isAllowedIp(host)) {
      throw new SafeFetchError("Destination IP is not allowed", "BLOCKED_IP");
    }
    return;
  }

  // Resolve DNS and verify no blocked IPs. The agent repeats this at connect
  // time, so this pre-check is a fast-fail and the agent check is the
  // DNS-rebinding guard.
  await resolveAllowedIps(host);
}

function stripSensitiveHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.delete("authorization");
  next.delete("cookie");
  next.delete("set-cookie");
  return next;
}

function wrapResponseSize(response: Response, maxBytes: number): Response {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    if (!Number.isNaN(length) && length > maxBytes) {
      throw new SafeFetchError("Response body too large", "RESPONSE_TOO_LARGE");
    }
  }

  if (!response.body) return response;

  let bytesRead = 0;
  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesRead += chunk.length;
      if (bytesRead > maxBytes) {
        callback(new SafeFetchError("Response body too large", "RESPONSE_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });

  response.body.pipe(transform);

  return new Response(transform, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxResponseSizeBytes = DEFAULT_MAX_RESPONSE_SIZE_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  const originalHost = new URL(url).host;
  let currentUrl = url;
  let redirects = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const parsed = new URL(currentUrl);

    try {
      await validateDestination(parsed);
    } catch (error) {
      if (error instanceof SafeFetchError) {
        logBlocked(error.message, parsed, error.code);
      }
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: "manual",
        signal: controller.signal,
        agent: getAgent(parsed.protocol),
      });

      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
        if (redirects >= maxRedirects) {
          throw new SafeFetchError("Too many redirects", "TOO_MANY_REDIRECTS");
        }
        redirects++;
        const location = response.headers.get("location")!;
        currentUrl = new URL(location, currentUrl).toString();

        const nextParsed = new URL(currentUrl);
        try {
          await validateDestination(nextParsed);
        } catch (error) {
          if (error instanceof SafeFetchError) {
            logBlocked(error.message, nextParsed, error.code);
          }
          throw error;
        }

        // Strip sensitive headers when crossing hosts.
        if (nextParsed.host !== originalHost && fetchOptions.headers) {
          fetchOptions.headers = stripSensitiveHeaders(new Headers(fetchOptions.headers));
        }

        // 301/302/303 redirect a POST/PUT/PATCH to GET; 307/308 preserve method.
        const method = (fetchOptions.method || "GET").toUpperCase();
        if ([301, 302, 303].includes(response.status) && method !== "GET" && method !== "HEAD") {
          fetchOptions.method = "GET";
          delete fetchOptions.body;
        }

        continue;
      }

      return wrapResponseSize(response, maxResponseSizeBytes);
    } catch (error) {
      if (error instanceof SafeFetchError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new SafeFetchError("Request timeout", "REQUEST_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export async function safeFetchJson<T = unknown>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<T> {
  const response = await safeFetch(url, options);
  if (!response.ok) {
    throw new SafeFetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      "INVALID_URL",
    );
  }
  return response.json() as Promise<T>;
}

export async function safeFetchText(
  url: string,
  options: SafeFetchOptions = {},
): Promise<string> {
  const response = await safeFetch(url, options);
  if (!response.ok) {
    throw new SafeFetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      "INVALID_URL",
    );
  }
  return response.text();
}
