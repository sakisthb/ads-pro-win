/**
 * Public and internal origin helpers.
 *
 * Edge-safe: no Prisma, env.ts, or provider SDKs. Used by middleware and
 * OAuth/auth route handlers so Docker `HOSTNAME=0.0.0.0` never leaks into
 * browser redirects or internal rate-limit fetches.
 */

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function hostWithoutBrackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostWithoutBrackets(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isListenAllHostname(hostname: string): boolean {
  const host = hostWithoutBrackets(hostname);
  return host === "0.0.0.0" || host === "::";
}

function originFromParts(protocol: string, host: string): string {
  const proto = protocol.replace(/:$/, "");
  return stripTrailingSlash(`${proto}://${host}`);
}

/**
 * `HOSTNAME=0.0.0.0` (Docker / `next start`) makes Request.url origin
 * `https://0.0.0.0:3000`. Browsers never navigate there; rewrite the listen
 * address to localhost when no public site URL is configured.
 */
export function normalizePublicOrigin(origin: string): string {
  try {
    const url = new URL(origin.includes("://") ? origin : `http://${origin}`);
    if (isListenAllHostname(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return stripTrailingSlash(origin);
  }
}

function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || url.protocol.replace(":", "");
  if (host) return originFromParts(proto, host);
  return url.origin;
}

/**
 * Resolve the public origin used for redirects and OAuth redirect URIs.
 * Prefers NEXT_PUBLIC_SITE_URL (correct behind proxies), then Host /
 * X-Forwarded-Host, then the request URL origin.
 */
export function getOrigin(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = explicit ? stripTrailingSlash(explicit) : requestOrigin(request);
  return normalizePublicOrigin(raw);
}

/**
 * Origin the Edge middleware uses to POST /api/internal/rate-limit.
 *
 * Must be reachable from inside the container. Never the public Cloudflare
 * URL and never the Docker listen address 0.0.0.0. Production sets
 * INTERNAL_RATE_LIMIT_ORIGIN=http://127.0.0.1:3000.
 */
export function getInternalRateLimitOrigin(listenOrigin: string): string {
  const configured = process.env.INTERNAL_RATE_LIMIT_ORIGIN?.trim();
  if (configured) return stripTrailingSlash(configured);
  try {
    const parsed = new URL(listenOrigin);
    if (isListenAllHostname(parsed.hostname)) {
      return `http://127.0.0.1:${parsed.port || "3000"}`;
    }
    return parsed.origin;
  } catch {
    return stripTrailingSlash(listenOrigin);
  }
}

export function isLoopbackHost(hostname: string): boolean {
  return isLoopbackHostname(hostname);
}

export function isListenAllHost(hostname: string): boolean {
  return isListenAllHostname(hostname);
}
