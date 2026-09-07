/**
 * Server-only OAuth platform configuration & URL builder.
 *
 * Imported exclusively by the /api/auth route handlers. Never import this
 * module from a client component — it reads server-side environment variables
 * directly and exposes no client-safe surface.
 */

import { META_GRAPH_VERSION } from "@/lib/meta/actions";

export type OAuthPlatform =
  | "meta"
  | "google-ads"
  | "google-analytics"
  | "google-search-console"
  | "tiktok";

export interface PlatformOAuthConfig {
  id: OAuthPlatform;
  name: string;
  /** Authorization endpoint the user is redirected to. */
  authBaseUrl: string;
  /** Scopes requested (provider-specific delimiter). Empty string = omit. */
  scope: string;
  /** Env var holding the OAuth client identifier. */
  clientIdEnv:
    | "FACEBOOK_APP_ID"
    | "GOOGLE_ADS_CLIENT_ID"
    | "GOOGLE_ANALYTICS_CLIENT_ID"
    | "GOOGLE_SEARCH_CONSOLE_CLIENT_ID"
    | "TIKTOK_APP_ID";
  /** Token exchange endpoint for swapping an auth code for access tokens. */
  tokenUrl: string;
  /** Env var holding the OAuth client secret. */
  clientSecretEnv:
    | "FACEBOOK_APP_SECRET"
    | "GOOGLE_ADS_CLIENT_SECRET"
    | "GOOGLE_ANALYTICS_CLIENT_SECRET"
    | "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"
    | "TIKTOK_APP_SECRET";
  /** Query-param name carrying the client id. Defaults to "client_id". */
  clientIdParam?: string;
  /** Path (relative to app origin) the provider redirects back to. */
  callbackPath: string;
  /** Include response_type=code. Defaults to true. */
  includeResponseType?: boolean;
  /** Extra query params required by this provider. */
    extraParams?: Record<string, string>;
}

export const OAUTH_PLATFORMS: Record<OAuthPlatform, PlatformOAuthConfig> = {
  meta: {
    id: "meta",
    name: "Meta Ads",
    authBaseUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    // ads_management is required to create, pause, and scale campaigns.
    // Existing tokens stay read-only until the user reconnects Meta.
    scope: "ads_read,ads_management,pages_show_list,business_management",
    clientIdEnv: "FACEBOOK_APP_ID",
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    callbackPath: "/api/auth/meta/callback",
    // Re-prompt declined scopes (ads_management) on every Connect / Reconnect.
    extraParams: { auth_type: "rerequest" },
  },
  "google-ads": {
    id: "google-ads",
    name: "Google Ads",
    authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/adwords",
    clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientSecretEnv: "GOOGLE_ADS_CLIENT_SECRET",
    callbackPath: "/api/auth/google-ads/callback",
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok Ads",
    authBaseUrl: "https://business-api.tiktok.com/portal/auth",
    scope: "",
    clientIdEnv: "TIKTOK_APP_ID",
    tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    clientSecretEnv: "TIKTOK_APP_SECRET",
    clientIdParam: "app_id",
    callbackPath: "/api/auth/tiktok/callback",
    includeResponseType: false,
  },
  "google-analytics": {
    id: "google-analytics",
    name: "Google Analytics",
    authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    clientIdEnv: "GOOGLE_ANALYTICS_CLIENT_ID",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientSecretEnv: "GOOGLE_ANALYTICS_CLIENT_SECRET",
    callbackPath: "/api/auth/google-analytics/callback",
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  "google-search-console": {
    id: "google-search-console",
    name: "Search Console",
    authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    clientIdEnv: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientSecretEnv: "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
    callbackPath: "/api/auth/google-search-console/callback",
    extraParams: { access_type: "offline", prompt: "consent" },
  },
};

const VALID_PLATFORMS = new Set<OAuthPlatform>(
  Object.keys(OAUTH_PLATFORMS) as OAuthPlatform[],
);

/** Type guard: is this a platform we know how to OAuth? */
export function isOAuthPlatform(value: string): value is OAuthPlatform {
  return VALID_PLATFORMS.has(value as OAuthPlatform);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isListenAllHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "0.0.0.0" || host === "::" || host === "[::]";
}

function originFromParts(protocol: string, host: string): string {
  const proto = protocol.replace(/:$/, "");
  return stripTrailingSlash(`${proto}://${host}`);
}

/**
 * `next dev --hostname 0.0.0.0` makes Request.url origin `http://0.0.0.0:3000`.
 * Browsers never navigate there; rewrite the listen address to localhost.
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

/**
 * Google only allows HTTP redirect URIs on localhost / 127.0.0.1.
 * LAN IPs and 0.0.0.0 produce Error 400 invalid_request ("doesn't comply
 * with Google's OAuth 2.0 policy for keeping apps secure").
 */
export function toGoogleOAuthOrigin(origin: string): string {
  const normalized = normalizePublicOrigin(origin);
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return normalized;
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
 * Resolve the public origin used for redirect URIs. Prefers an explicitly
 * configured NEXT_PUBLIC_SITE_URL (correct behind proxies/tunnels where the
 * request's own origin is unreliable), then Host / X-Forwarded-Host, then
 * the request URL origin.
 */
export function getOrigin(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const raw = explicit ? stripTrailingSlash(explicit) : requestOrigin(request);
  return normalizePublicOrigin(raw);
}

/** Origin Google will accept for Ads / GA4 / Search Console OAuth. */
export function googleOAuthOrigin(request: Request): string {
  return toGoogleOAuthOrigin(getOrigin(request));
}

function envTrim(name: string): string {
  return (process.env[name] ?? "").trim();
}

const GOOGLE_OAUTH_PLATFORMS = new Set<OAuthPlatform>([
  "google-ads",
  "google-analytics",
  "google-search-console",
]);

const GOOGLE_CLIENT_PAIRS = [
  {
    platform: "google-analytics" as const,
    id: "GOOGLE_ANALYTICS_CLIENT_ID",
    secret: "GOOGLE_ANALYTICS_CLIENT_SECRET",
  },
  {
    platform: "google-ads" as const,
    id: "GOOGLE_ADS_CLIENT_ID",
    secret: "GOOGLE_ADS_CLIENT_SECRET",
  },
  {
    platform: "google-search-console" as const,
    id: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID",
    secret: "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET",
  },
];

/**
 * Google OAuth clients are interchangeable for Ads / GA4 / Search Console.
 * Prefer the platform's own env pair, then any other complete Google pair.
 */
export function resolveGoogleOAuthClient(
  platform: "google-ads" | "google-analytics" | "google-search-console",
): { clientId: string; clientSecret: string } {
  const ordered = [
    GOOGLE_CLIENT_PAIRS.find((pair) => pair.platform === platform)!,
    ...GOOGLE_CLIENT_PAIRS.filter((pair) => pair.platform !== platform),
  ];
  for (const pair of ordered) {
    const clientId = envTrim(pair.id);
    const clientSecret = envTrim(pair.secret);
    if (clientId && clientSecret) return { clientId, clientSecret };
  }
  const cfg = OAUTH_PLATFORMS[platform];
  return { clientId: envTrim(cfg.clientIdEnv), clientSecret: envTrim(cfg.clientSecretEnv) };
}

/** Read the configured client id for a platform (empty string when unset). */
export function getClientId(platform: OAuthPlatform): string {
  if (
    platform === "google-ads" ||
    platform === "google-analytics" ||
    platform === "google-search-console"
  ) {
    return resolveGoogleOAuthClient(platform).clientId;
  }
  return envTrim(OAUTH_PLATFORMS[platform].clientIdEnv);
}

/** Read the configured client secret for a platform (empty string when unset). */
export function getClientSecret(platform: OAuthPlatform): string {
  if (
    platform === "google-ads" ||
    platform === "google-analytics" ||
    platform === "google-search-console"
  ) {
    return resolveGoogleOAuthClient(platform).clientSecret;
  }
  return envTrim(OAUTH_PLATFORMS[platform].clientSecretEnv);
}

/** Env var names still missing for this OAuth platform. */
export function missingPlatformConfig(platform: OAuthPlatform): string[] {
  const cfg = OAUTH_PLATFORMS[platform];
  const missing: string[] = [];
  if (GOOGLE_OAUTH_PLATFORMS.has(platform)) {
    const creds = resolveGoogleOAuthClient(
      platform as "google-ads" | "google-analytics" | "google-search-console",
    );
    if (!creds.clientId) missing.push(cfg.clientIdEnv);
    if (!creds.clientSecret) missing.push(cfg.clientSecretEnv);
  } else {
    if (!envTrim(cfg.clientIdEnv)) missing.push(cfg.clientIdEnv);
    if (!envTrim(cfg.clientSecretEnv)) missing.push(cfg.clientSecretEnv);
  }
  if (platform === "google-ads" && !envTrim("GOOGLE_ADS_DEVELOPER_TOKEN")) {
    missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  }
  return missing;
}

/** True when the OAuth client (and Google Ads developer token) env vars are set. */
export function isPlatformConfigured(platform: OAuthPlatform): boolean {
  return missingPlatformConfig(platform).length === 0;
}

export function platformNotConfiguredMessage(platform: OAuthPlatform): string {
  const missing = missingPlatformConfig(platform);
  const names = missing.join(", ");
  if (platform === "google-ads") {
    return (
      `Google Ads is not wired. Add ${names} to .env.local ` +
      `(OAuth client can reuse GOOGLE_ANALYTICS_CLIENT_* ; Ads API still needs a developer token from https://ads.google.com/aw/apicenter on an MCC). ` +
      `Woo last-click Google demand is already on Attribution — spend still needs this connect.`
    );
  }
  if (platform === "google-search-console") {
    return (
      `Search Console is not wired. Add ${names} to .env.local, ` +
      `or reuse GOOGLE_ANALYTICS_CLIENT_ID / SECRET from Ads Pro Connects.`
    );
  }
  return `${OAUTH_PLATFORMS[platform].name} is not configured. Add ${names} to .env.local, then retry.`;
}

/** TikTok returns `auth_code`; Google/Meta return `code`. */
export function oauthAuthorizationCode(searchParams: URLSearchParams): string | null {
  const code = searchParams.get("code") ?? searchParams.get("auth_code");
  const trimmed = code?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function oauthReadiness(): Record<OAuthPlatform, boolean> {
  return {
    meta: isPlatformConfigured("meta"),
    "google-ads": isPlatformConfigured("google-ads"),
    tiktok: isPlatformConfigured("tiktok"),
    "google-analytics": isPlatformConfigured("google-analytics"),
    "google-search-console": isPlatformConfigured("google-search-console"),
  };
}

/** Allowed in-app paths OAuth may bounce back to. */
export const OAUTH_RETURN_PATHS = new Set(["/connections", "/onboarding", "/campaign-launcher"]);

export function oauthReturnPath(raw: string | null | undefined): string {
  if (!raw) return "/connections";
  const path = raw.split("?")[0]?.trim() ?? "";
  return OAUTH_RETURN_PATHS.has(path) ? path : "/connections";
}

/**
 * Legacy state encoder. The callback no longer trusts this format; it is kept
 * only so that plaintext/legacy state can be detected and rejected.
 */
export function encodeOAuthState(
  platform: string,
  returnPath?: string | null,
  brandId?: string | null,
): string {
  const dest = oauthReturnPath(returnPath);
  const brand = brandId && /^[a-z0-9_-]{8,}$/i.test(brandId) ? brandId : "";
  if (!brand && dest === "/connections") return platform;
  return brand ? `${platform}~${dest}~${brand}` : `${platform}~${dest}`;
}

export interface BuildOAuthUrlOptions {
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/** Build the fully-qualified OAuth authorization URL for a platform. */
export function buildOAuthUrl(
  platform: OAuthPlatform,
  origin: string,
  options: BuildOAuthUrlOptions,
): string {
  const cfg = OAUTH_PLATFORMS[platform];
  const clientId = getClientId(platform);
  const redirectUri = `${origin}${cfg.callbackPath}`;

  const params = new URLSearchParams();
  params.set(cfg.clientIdParam ?? "client_id", clientId);
  params.set("redirect_uri", redirectUri);
  if (cfg.includeResponseType !== false) {
    params.set("response_type", "code");
  }
  if (cfg.scope) params.set("scope", cfg.scope);
  for (const [k, v] of Object.entries(cfg.extraParams ?? {})) {
    params.set(k, v);
  }
  params.set("state", options.state);
  if (options.codeChallenge) {
    params.set("code_challenge", options.codeChallenge);
    params.set("code_challenge_method", options.codeChallengeMethod ?? "S256");
  }

  return `${cfg.authBaseUrl}?${params.toString()}`;
}

export function parseOAuthState(state: string | null | undefined): {
  platformHint: string;
  returnPath: string;
  brandId?: string;
} {
  const raw = state?.trim() ?? "";
  if (!raw) return { platformHint: "", returnPath: "/connections" };

  if (raw.includes("~")) {
    const [platformHint, dest, brand] = raw.split("~");
    return {
      platformHint: platformHint ?? "",
      returnPath: oauthReturnPath(dest),
      brandId: brand && /^[a-z0-9_-]{8,}$/i.test(brand) ? brand : undefined,
    };
  }

  const colon = raw.indexOf(":");
  if (colon <= 0) {
    return { platformHint: raw, returnPath: "/connections" };
  }
  const rest = raw.slice(colon + 1);
  const second = rest.indexOf(":");
  if (second > 0) {
    const brand = rest.slice(second + 1);
    return {
      platformHint: raw.slice(0, colon),
      returnPath: oauthReturnPath(rest.slice(0, second)),
      brandId: /^[a-z0-9_-]{8,}$/i.test(brand) ? brand : undefined,
    };
  }
  return {
    platformHint: raw.slice(0, colon),
    returnPath: oauthReturnPath(rest),
  };
}
