/**
 * Google Ads account discovery for a GA4-style Connections picker.
 *
 * listAccessibleCustomers returns resource names only. Names come from a
 * follow-up GAQL search; MCC trees expand via customer_client.
 * Scope: https://www.googleapis.com/auth/adwords
 * Every call also needs GOOGLE_ADS_DEVELOPER_TOKEN.
 */

import { safeFetch } from "@/lib/safe-fetch";

export const GOOGLE_ADS_API_VERSION = "v25";
export const GOOGLE_ADS_OAUTH_SCOPE = "https://www.googleapis.com/auth/adwords";

export interface GoogleAdsCustomer {
  id: string;
  descriptiveName: string;
  manager: boolean;
  currencyCode: string;
  loginCustomerId: string | null;
  testAccount: boolean;
}

export function googleAdsPendingAccountId(brandId: string): string {
  return `gads:pending:${brandId}`;
}

export function googleAdsStoredAccountId(
  brandId: string,
  customerId: string,
  loginCustomerId?: string | null,
): string {
  const id = bareGoogleAdsCustomerId(customerId);
  const login = loginCustomerId ? bareGoogleAdsCustomerId(loginCustomerId) : "";
  return login && login !== id ? `gadsacct:${brandId}:${id}:${login}` : `gadsacct:${brandId}:${id}`;
}

export function bareGoogleAdsCustomerId(value: string): string {
  return value.replace(/^customers\//, "").replace(/-/g, "").trim();
}

export function parseGoogleAdsCustomerId(accountId: string | null | undefined): string | null {
  const parsed = parseGoogleAdsStoredAccount(accountId);
  return parsed?.customerId ?? null;
}

export function parseGoogleAdsStoredAccount(accountId: string | null | undefined): {
  customerId: string;
  loginCustomerId: string | null;
} | null {
  const raw = (accountId ?? "").trim();
  if (!raw || raw.startsWith("gads:pending:")) return null;
  const stored = raw.match(/^gadsacct:[^:]+:(\d+)(?::(\d+))?$/);
  if (stored?.[1]) {
    return { customerId: stored[1], loginCustomerId: stored[2] ?? null };
  }
  const digits = bareGoogleAdsCustomerId(raw);
  if (/^\d{6,}$/.test(digits)) {
    return { customerId: digits, loginCustomerId: null };
  }
  return null;
}

export function isGoogleAdsAccountReady(accountId: string | null | undefined): boolean {
  return parseGoogleAdsCustomerId(accountId) != null;
}

export function googleAdsLoginCustomerId(accountId: string | null | undefined): string | null {
  const stored = parseGoogleAdsStoredAccount(accountId)?.loginCustomerId;
  if (stored) return stored;
  const envLogin = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "").trim();
  return /^\d{6,}$/.test(envLogin) ? envLogin : null;
}

export function googleAdsSearchStreamUrl(customerId: string): string {
  const cid = bareGoogleAdsCustomerId(customerId);
  return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cid}/googleAds:searchStream`;
}

export function googleAdsListAccessibleUrl(): string {
  return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`;
}

export function formatGoogleAdsApiError(status: number, body: string): string {
  if (status === 404 && /<!doctype html/i.test(body)) {
    return (
      "Google Ads returned 404 HTML. REST must POST /customers/{id}/googleAds:searchStream " +
      "(not /customers/{id}:searchStream). Sync Now after this fix. If it persists, pick the spend account " +
      "(not the MCC) so login-customer-id is stored."
    );
  }
  let message = body.slice(0, 400);
  try {
    const parsed = JSON.parse(body.replace(/^\s*\[/, "").replace(/\]\s*$/, "")) as {
      error?: { message?: string; status?: string };
      message?: string;
    };
    message = parsed.error?.message ?? parsed.message ?? message;
  } catch {
    /* raw body, including Google HTML 404s */
  }
  const haystack = `${message}\n${body}`.toLowerCase();
  if (status === 401 || haystack.includes("unauthenticated")) {
    return "Google Ads token expired. Reconnect Google Ads, then retry.";
  }
  if (
    haystack.includes("developer_token_not_approved") ||
    haystack.includes("only approved for use with test accounts") ||
    haystack.includes("apply for basic")
  ) {
    return "This developer token is test-only. Apply for Basic Access in Google Ads API Center, then Sync Now.";
  }
  if (haystack.includes("developer token") || haystack.includes("developer-token")) {
    return "Add GOOGLE_ADS_DEVELOPER_TOKEN to .env.local (Ads API Center), then reconnect Google Ads.";
  }
  if (haystack.includes("has not been used") || haystack.includes("is disabled") || haystack.includes("access not configured")) {
    return "Enable Google Ads API in this Google Cloud project, then retry.";
  }
  if (haystack.includes("not approved") || (haystack.includes("test account") && haystack.includes("only"))) {
    return "This developer token is test-only. Use a test Ads account, or apply for basic access in Ads API Center.";
  }
  if (haystack.includes("insufficient") || haystack.includes("permission") || status === 403) {
    return "This Google account cannot read that Ads customer. Pick another account or reconnect.";
  }
  return `Google Ads API error (${status}): ${message}`;
}

export function preferGoogleAdsCustomer(
  customers: GoogleAdsCustomer[],
  brandName?: string | null,
): GoogleAdsCustomer | null {
  const spendAccounts = customers.filter((c) => !c.manager && !c.testAccount);
  const pool = spendAccounts.length > 0 ? spendAccounts : customers.filter((c) => !c.manager);
  if (pool.length === 0) return customers.length === 1 ? customers[0]! : null;
  const needle = (brandName ?? "").trim().toLowerCase();
  if (needle) {
    const match = pool.find((c) => c.descriptiveName.trim().toLowerCase().includes(needle));
    if (match) return match;
  }
  return pool.length === 1 ? pool[0]! : null;
}

function googleAdsHeaders(accessToken: string, loginCustomerId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "developer-token": (process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "").trim(),
  };
  const login = (loginCustomerId ?? "").replace(/-/g, "").trim();
  if (/^\d{6,}$/.test(login)) headers["login-customer-id"] = login;
  return headers;
}

function parseGoogleAdsSearchResults<T>(json: unknown): T[] {
  const batches = Array.isArray(json)
    ? json
    : json && typeof json === "object" && "results" in json
      ? [json]
      : [];
  const rows: T[] = [];
  for (const batch of batches) {
    if (!batch || typeof batch !== "object") continue;
    const err = (batch as { error?: { message?: string } }).error;
    if (err?.message) throw new Error(err.message);
    const results = (batch as { results?: T[] }).results;
    if (results) rows.push(...results);
  }
  return rows;
}

export async function googleAdsSearchRows<T>(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId: string | null,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<T[]> {
  const cid = bareGoogleAdsCustomerId(customerId);
  const res = await fetchImpl(googleAdsSearchStreamUrl(cid), {
    method: "POST",
    headers: googleAdsHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGoogleAdsApiError(res.status, text));
  }
  try {
    return parseGoogleAdsSearchResults<T>(JSON.parse(text || "[]"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(formatGoogleAdsApiError(res.status, text));
    }
    throw error;
  }
}

interface CustomerSearchRow {
  customer?: {
    id?: string | number;
    descriptiveName?: string;
    manager?: boolean;
    currencyCode?: string;
    testAccount?: boolean;
  };
}

interface CustomerClientRow {
  customerClient?: {
    id?: string | number;
    descriptiveName?: string;
    manager?: boolean;
    currencyCode?: string;
    testAccount?: boolean;
    status?: string;
  };
}

async function describeCustomer(
  accessToken: string,
  customerId: string,
  loginCustomerId: string | null,
  fetchImpl: typeof fetch,
): Promise<GoogleAdsCustomer | null> {
  try {
    const rows = await googleAdsSearchRows<CustomerSearchRow>(
      accessToken,
      customerId,
      "SELECT customer.id, customer.descriptive_name, customer.manager, customer.currency_code, customer.test_account FROM customer LIMIT 1",
      loginCustomerId,
      fetchImpl,
    );
    const customer = rows[0]?.customer;
    const id = bareGoogleAdsCustomerId(String(customer?.id ?? customerId));
    if (!/^\d{6,}$/.test(id)) return null;
    return {
      id,
      descriptiveName: customer?.descriptiveName?.trim() || `Google Ads ${id}`,
      manager: Boolean(customer?.manager),
      currencyCode: customer?.currencyCode?.trim() || "EUR",
      loginCustomerId,
      testAccount: Boolean(customer?.testAccount),
    };
  } catch {
    return null;
  }
}

async function listClientsUnderManager(
  accessToken: string,
  managerId: string,
  fetchImpl: typeof fetch,
): Promise<GoogleAdsCustomer[]> {
  try {
    const rows = await googleAdsSearchRows<CustomerClientRow>(
      accessToken,
      managerId,
      `SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code, customer_client.test_account, customer_client.status
       FROM customer_client
       WHERE customer_client.status = 'ENABLED'`,
      managerId,
      fetchImpl,
    );
    return rows
      .map((row) => row.customerClient)
      .filter((client): client is NonNullable<CustomerClientRow["customerClient"]> => Boolean(client?.id))
      .map((client) => {
        const id = bareGoogleAdsCustomerId(String(client.id));
        return {
          id,
          descriptiveName: client.descriptiveName?.trim() || `Google Ads ${id}`,
          manager: Boolean(client.manager),
          currencyCode: client.currencyCode?.trim() || "EUR",
          loginCustomerId: managerId === id ? null : managerId,
          testAccount: Boolean(client.testAccount),
        };
      });
  } catch {
    return [];
  }
}

export async function listGoogleAdsCustomers(
  accessToken: string,
  fetchImpl: typeof fetch = safeFetch as unknown as typeof fetch,
): Promise<GoogleAdsCustomer[]> {
  const token = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "").trim();
  if (!token) {
    throw new Error("Add GOOGLE_ADS_DEVELOPER_TOKEN to .env.local (Ads API Center), then reconnect Google Ads.");
  }
  const res = await fetchImpl(googleAdsListAccessibleUrl(), {
    method: "GET",
    headers: googleAdsHeaders(accessToken),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatGoogleAdsApiError(res.status, text));
  }
  const json = JSON.parse(text || "{}") as { resourceNames?: string[] };
  const accessible = (json.resourceNames ?? [])
    .map((name) => bareGoogleAdsCustomerId(name))
    .filter((id) => /^\d{6,}$/.test(id));

  const byId = new Map<string, GoogleAdsCustomer>();

  const mergeCustomer = (customer: GoogleAdsCustomer) => {
    const existing = byId.get(customer.id);
    if (!existing || (existing.manager && !customer.manager)) {
      byId.set(customer.id, customer);
    }
  };

  const expandManager = async (managerId: string) => {
    for (const child of await listClientsUnderManager(accessToken, managerId, fetchImpl)) {
      mergeCustomer(child);
    }
  };

  const failedIds: string[] = [];
  for (const id of accessible) {
    const described = await describeCustomer(accessToken, id, null, fetchImpl);
    if (!described) {
      failedIds.push(id);
      continue;
    }
    mergeCustomer(described);
    if (described.manager) await expandManager(described.id);
  }

  const managerIds = [...byId.values()].filter((c) => c.manager).map((c) => c.id);
  for (const id of failedIds) {
    if (byId.has(id)) continue;
    const logins = managerIds.length > 0 ? managerIds : accessible.filter((other) => other !== id);
    let found: GoogleAdsCustomer | null = null;
    for (const login of logins) {
      found = await describeCustomer(accessToken, id, login, fetchImpl);
      if (found) {
        if (!found.loginCustomerId) found = { ...found, loginCustomerId: login };
        break;
      }
    }
    if (found) {
      mergeCustomer(found);
      if (found.manager) await expandManager(found.id);
    }
  }

  const loginHint = managerIds[0] ?? googleAdsLoginCustomerId(null);
  for (const id of accessible) {
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      descriptiveName: `Google Ads ${id}`,
      manager: false,
      currencyCode: "EUR",
      loginCustomerId: loginHint && loginHint !== id ? loginHint : null,
      testAccount: false,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.manager !== b.manager) return a.manager ? 1 : -1;
    return a.descriptiveName.localeCompare(b.descriptiveName);
  });
}
