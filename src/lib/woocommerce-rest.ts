/**
 * Shared WooCommerce REST helpers.
 *
 * Used by the connections test and by sync fetchers so both paths send the
 * same headers, auth, and map Cloudflare / REST failures the same way.
 */

import { safeFetch, SafeFetchError } from "@/lib/safe-fetch";

export const WOO_REST_USER_AGENT =
  "Mozilla/5.0 (compatible; AdsPro-WooCommerce/1.0; +https://ads-pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const CLOUDFLARE_BODY =
  /just a moment|challenges\.cloudflare\.com|cf-browser-verification|cf-mitigated|enable javascript and cookies to continue|attention required/i;

export function normalizeWooStoreUrl(storeUrl: string): string {
  return storeUrl.trim().replace(/\/+$/, "");
}

export function looksLikeCloudflareChallenge(input: {
  status: number;
  body: string;
  cfMitigated?: string | null;
}): boolean {
  if (input.cfMitigated?.toLowerCase() === "challenge") return true;
  const snippet = input.body.slice(0, 8_000);
  if (!CLOUDFLARE_BODY.test(snippet)) return false;
  return input.status === 403 || input.status === 503 || input.status === 429 || /just a moment/i.test(snippet);
}

function hostOf(storeUrl: string): string {
  try {
    return new URL(normalizeWooStoreUrl(storeUrl)).hostname;
  } catch {
    return storeUrl;
  }
}

function parseWooJsonError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; code?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.replace(/<[^>]+>/g, "").trim();
    }
  } catch {
    // not JSON
  }
  return null;
}

export function explainWooHttpFailure(input: {
  storeUrl: string;
  status: number;
  body: string;
  cfMitigated?: string | null;
}): string {
  const host = hostOf(input.storeUrl);
  if (looksLikeCloudflareChallenge(input)) {
    return (
      `Cloudflare is blocking Ads Pro from reaching the WooCommerce REST API on ${host} ` +
      `(bot challenge, not a bad consumer key). In Cloudflare → Security → WAF, add a skip ` +
      `rule for URI Path starting with /wp-json/wc/ (skip Bot Fight / managed challenge), then connect again.`
    );
  }

  const wooMessage = parseWooJsonError(input.body);
  if (input.status === 401 || input.status === 403) {
    return (
      wooMessage ??
      `WooCommerce rejected the REST credentials (HTTP ${input.status}). ` +
      `Use a Read or Read/Write REST API key for an administrator or shop manager.`
    );
  }
  if (input.status === 404) {
    return (
      `No WooCommerce REST API at ${host}/wp-json/wc/v3/. ` +
      `Confirm the store URL, that permalinks are not “Plain”, and that WooCommerce is active.`
    );
  }
  return wooMessage
    ? `WooCommerce returned HTTP ${input.status}: ${wooMessage}`
    : `WooCommerce REST API returned HTTP ${input.status}. Check the store URL and credentials.`;
}

export function explainWooNetworkFailure(storeUrl: string, error: unknown): string {
  const host = hostOf(storeUrl);
  if (error instanceof SafeFetchError) {
    if (error.code === "BLOCKED_IP" || error.code === "DNS_ERROR" || error.code === "INVALID_URL") {
      return `The store URL ${host} is not reachable from this service.`;
    }
    if (error.code === "REQUEST_TIMEOUT") {
      return `Timed out reaching the WooCommerce REST API on ${host}.`;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `Could not resolve ${host}. Check the store URL.`;
  }
  if (/certificate|UNABLE_TO_VERIFY|CERT/i.test(message)) {
    return `TLS certificate error talking to ${host}.`;
  }
  if (/abort|timeout/i.test(message)) {
    return `Timed out reaching the WooCommerce REST API on ${host}.`;
  }
  return `Could not reach ${host}: ${message}`;
}

export type WooRestResult =
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number; error: string };

function wooEndpointUrl(
  storeUrl: string,
  path: string,
  searchParams?: Record<string, string>,
): URL {
  const url = new URL(`${storeUrl}/wp-json/wc/v3/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

function parseWooResponse(
  storeUrl: string,
  status: number,
  body: string,
  cfMitigated: string | null,
): WooRestResult {
  if (
    !status ||
    status >= 400 ||
    looksLikeCloudflareChallenge({ status, body, cfMitigated })
  ) {
    return {
      ok: false,
      status,
      error: explainWooHttpFailure({ storeUrl, status, body, cfMitigated }),
    };
  }
  try {
    return { ok: true, status, json: JSON.parse(body) as unknown };
  } catch {
    return {
      ok: false,
      status,
      error: explainWooHttpFailure({ storeUrl, status, body, cfMitigated }),
    };
  }
}

export async function wooRestGet(options: {
  storeUrl: string;
  path: string;
  consumerKey: string;
  consumerSecret: string;
  searchParams?: Record<string, string>;
  timeoutMs?: number;
}): Promise<WooRestResult> {
  const base = normalizeWooStoreUrl(options.storeUrl);
  const basic = Buffer.from(
    `${options.consumerKey}:${options.consumerSecret}`,
    "utf8",
  ).toString("base64");
  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${basic}`,
    "User-Agent": WOO_REST_USER_AGENT,
  };

  // Use Basic Auth only. The consumer secret must never sit in the URL because
  // query strings are routinely logged and are also more likely to trip WAF
  // inspection rules. HTTPS protects the Authorization header in transit.
  const basicUrl = wooEndpointUrl(base, options.path, options.searchParams);
  const basicRes = await safeFetch(basicUrl.toString(), {
    method: "GET",
    timeoutMs: options.timeoutMs ?? 20_000,
    headers,
  });
  const basicBody = await basicRes.text();
  const basicCf = basicRes.headers.get("cf-mitigated");
  return parseWooResponse(base, basicRes.status, basicBody, basicCf);
}

/** Live probe used when saving a WooCommerce connection. */
export async function testWooCommerceConnection(options: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<{ ok: true; storeUrl: string } | { ok: false; error: string }> {
  const storeUrl = normalizeWooStoreUrl(options.storeUrl);
  try {
    const result = await wooRestGet({
      storeUrl,
      path: "orders",
      consumerKey: options.consumerKey,
      consumerSecret: options.consumerSecret,
      searchParams: { per_page: "1", status: "any" },
    });
    if (!result.ok) return { ok: false, error: result.error };
    if (!Array.isArray(result.json)) {
      return {
        ok: false,
        error: "The store responded, but not with WooCommerce order data. Check the store URL.",
      };
    }
    return { ok: true, storeUrl };
  } catch (error) {
    return { ok: false, error: explainWooNetworkFailure(storeUrl, error) };
  }
}
