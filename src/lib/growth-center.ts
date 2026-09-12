/**
 * Ads Pro ↔ SACOS Growth Center join.
 *
 * Ads Pro owns the brand shell. Growth Center stays the catalog system of
 * record. This module maps a brand website to a SACOS site and a click-through
 * origin. It never invents catalog counts.
 */

export type GrowthCatalogFacts = {
  imageIssues: number;
  pendingDrafts: number;
  lastAccepted: { appliedProducts: number; at: string | null } | null;
};

export type GrowthDeskUnlinked = { status: "unlinked" };

export type GrowthDeskLinked = {
  status: "linked";
  hostname: string;
  siteId: string;
  origin: string;
  href: string;
  catalogFacts: GrowthCatalogFacts | null;
  reachability?: "reachable" | "unreachable" | "skipped";
};

export type GrowthDesk = GrowthDeskUnlinked | GrowthDeskLinked;

const DEMO_ORG_SLUG = "demo";

const GROWTH_CENTER_SITES: Record<string, string> = {
  "bagtobag.com.gr": "bagtobag_com_gr",
  "www.bagtobag.com.gr": "bagtobag_com_gr",
};

const UNLINKED: GrowthDeskUnlinked = { status: "unlinked" };

export function brandHostname(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  const raw = website.trim();
  if (/\s/.test(raw)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

export function parseGrowthCenterOrigin(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname.replace(/\/+$/, "");
    if (path) return null;
    if (url.protocol === "http:") {
      if (url.hostname !== "127.0.0.1") return null;
    } else if (url.protocol !== "https:") {
      return null;
    }
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${url.hostname}${port}`;
  } catch {
    return null;
  }
}

export function growthCenterOriginFromEnv(
  raw: string | undefined,
  nodeEnv: string,
): string | null {
  const parsed = parseGrowthCenterOrigin(raw);
  if (parsed) return parsed;
  if (nodeEnv === "development") return "http://127.0.0.1:18806";
  return null;
}

export function formatGrowthAcceptedAt(at: string | null): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function growthCenterHref(
  origin: string,
  siteId: string,
  view?: "images" | "products" | "pilot" | string,
): string {
  const parsed = parseGrowthCenterOrigin(origin);
  if (!parsed) return "";
  if (!/^[a-z0-9_]{1,80}$/.test(siteId)) return `${parsed}/`;
  const url = new URL("/", parsed);
  url.searchParams.set("site", siteId);
  if (view === "images" || view === "products") {
    url.searchParams.set("view", view);
  } else if (view === "pilot") {
    url.searchParams.set("view", "products");
    url.searchParams.set("pilot", "1");
  }
  return url.toString();
}

export function resolveGrowthCenterDesk(args: {
  organizationSlug: string;
  website: string | null | undefined;
  origin: string | null;
}): GrowthDesk {
  if (args.organizationSlug === DEMO_ORG_SLUG) return UNLINKED;
  const origin = parseGrowthCenterOrigin(args.origin);
  const hostname = brandHostname(args.website);
  if (!origin || !hostname) return UNLINKED;
  const siteId = GROWTH_CENTER_SITES[hostname];
  if (!siteId) return UNLINKED;
  return {
    status: "linked",
    hostname,
    siteId,
    origin,
    href: growthCenterHref(origin, siteId),
    catalogFacts: null,
  };
}

export function buildGrowthDesk(args: {
  organizationSlug: string;
  website: string | null | undefined;
  origin: string | null;
  reachability: "reachable" | "unreachable" | "skipped";
}): GrowthDesk {
  const desk = resolveGrowthCenterDesk(args);
  if (desk.status !== "linked") return desk;
  return { ...desk, reachability: args.reachability };
}

export async function probeGrowthCenterReadyz(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"reachable" | "unreachable"> {
  const parsed = parseGrowthCenterOrigin(origin);
  if (!parsed) return "unreachable";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetchImpl(`${parsed}/readyz`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return "unreachable";
    const body = (await response.json()) as { status?: unknown };
    return body.status === "ready" ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseGrowthDeskToken(
  raw: string | null | undefined,
): string | null {
  if (!raw || raw.length < 32 || /\s/.test(raw)) return null;
  return raw;
}

export function parseGrowthCenterFacts(
  body: unknown,
): GrowthCatalogFacts | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  if (typeof rec.site !== "string" || !rec.site) return null;
  if (!isCount(rec.imageIssues) || !isCount(rec.pendingDrafts)) return null;
  if (rec.lastAccepted === null) {
    return {
      imageIssues: rec.imageIssues,
      pendingDrafts: rec.pendingDrafts,
      lastAccepted: null,
    };
  }
  if (!rec.lastAccepted || typeof rec.lastAccepted !== "object") return null;
  const last = rec.lastAccepted as Record<string, unknown>;
  if (!isCount(last.appliedProducts)) return null;
  if (!(last.at === null || typeof last.at === "string")) return null;
  return {
    imageIssues: rec.imageIssues,
    pendingDrafts: rec.pendingDrafts,
    lastAccepted: { appliedProducts: last.appliedProducts, at: last.at },
  };
}

export async function fetchGrowthCenterFacts(args: {
  origin: string;
  siteId: string;
  deskToken: string | null | undefined;
  fetchImpl?: typeof fetch;
}): Promise<GrowthCatalogFacts | null> {
  const origin = parseGrowthCenterOrigin(args.origin);
  const token = parseGrowthDeskToken(args.deskToken);
  if (!origin || !token || !args.siteId) return null;
  const url = new URL("/api/desk-summary", origin);
  url.searchParams.set("site", args.siteId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await (args.fetchImpl ?? fetch)(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const facts = parseGrowthCenterFacts(body);
    if (!facts) return null;
    const site =
      body && typeof body === "object"
        ? (body as { site?: unknown }).site
        : null;
    if (site !== args.siteId) return null;
    return facts;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadGrowthDesk(args: {
  organizationSlug: string;
  website: string | null | undefined;
  origin: string | null;
  deskToken?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<GrowthDesk> {
  const desk = resolveGrowthCenterDesk(args);
  if (desk.status !== "linked") return desk;
  const fetchImpl = args.fetchImpl ?? fetch;
  const reachability = await probeGrowthCenterReadyz(desk.origin, fetchImpl);
  const catalogFacts =
    reachability === "reachable"
      ? await fetchGrowthCenterFacts({
          origin: desk.origin,
          siteId: desk.siteId,
          deskToken: args.deskToken,
          fetchImpl,
        })
      : null;
  return { ...desk, reachability, catalogFacts };
}
