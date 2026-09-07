/**
 * On-site SEO from the brand homepage (apex host only).
 * No keyword volumes, DA, or backlinks — those need a rank tracker we do not have.
 */

import {
  canonicalizeShopUrl,
  extractOfferClaims,
  looksLikeBotWall,
  shopOrigin,
} from "@/lib/creative-fatigue";
import { safeFetch } from "@/lib/safe-fetch";

export const BAGTOBAG_APEX = "https://bagtobag.com.gr/";

export type SiteSeoStatus = "pass" | "warn" | "fail";
export type SiteSeoGrade = "A" | "B" | "C" | "D" | "F";

export interface SiteSeoPage {
  url: string;
  fetched: boolean;
  status: number | null;
  blocked: boolean;
  title: string | null;
  metaDescription: string | null;
  robots: string | null;
  h1: string | null;
  canonical: string | null;
  lang: string | null;
  ogTitle: string | null;
  wordCount: number;
  hasSaleLanguage: boolean;
  maxDiscountPct: number | null;
}

export interface SiteSeoCheck {
  id: string;
  status: SiteSeoStatus;
  title: string;
  detail: string;
}

export interface SiteSeoRobots {
  fetched: boolean;
  sitemapUrls: string[];
  preview: string;
}

export interface SiteSeoSitemap {
  fetched: boolean;
  urlCount: number;
  urls: string[];
}

export interface SiteSeoLlms {
  fetched: boolean;
  status: number | null;
  preview: string;
}

export interface SiteSeoAiCrawler {
  agent: string;
  disallowAll: boolean | null;
}

export interface SiteSeoReport {
  url: string | null;
  origin: string | null;
  score: number;
  grade: SiteSeoGrade;
  homepage: SiteSeoPage | null;
  robotsTxt: SiteSeoRobots;
  sitemap: SiteSeoSitemap;
  llmsTxt: SiteSeoLlms;
  jsonLdTypes: string[];
  aiCrawlers: SiteSeoAiCrawler[];
  checks: SiteSeoCheck[];
}

export interface FetchedDoc {
  url: string;
  status: number | null;
  text: string;
  fetched: boolean;
}

const HTML_FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
} as const;

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

export function resolveBrandWebsite(brand: {
  website?: string | null;
  slug?: string | null;
}): string | null {
  const fromBrand = shopOrigin(brand.website);
  if (fromBrand) return `${fromBrand}/`;
  if ((brand.slug ?? "").toLowerCase().includes("bagtobag")) return BAGTOBAG_APEX;
  return null;
}

export function emptySiteSeoReport(url: string | null = null): SiteSeoReport {
  return {
    url,
    origin: shopOrigin(url),
    score: 0,
    grade: "F",
    homepage: null,
    robotsTxt: { fetched: false, sitemapUrls: [], preview: "" },
    sitemap: { fetched: false, urlCount: 0, urls: [] },
    llmsTxt: { fetched: false, status: null, preview: "" },
    jsonLdTypes: [],
    aiCrawlers: [],
    checks: [
      {
        id: "website",
        status: "fail",
        title: "No shop URL on this brand",
        detail: "Set the brand website (apex host only) so SEO Lab can fetch the homepage.",
      },
    ],
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, re: RegExp): string | null {
  const match = html.match(re);
  const raw = match?.[1] ?? match?.[2] ?? null;
  if (!raw) return null;
  const text = decodeEntities(raw);
  return text.length > 0 ? text : null;
}

function metaByName(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`,
    "i",
  );
  return firstMatch(html, re);
}

export function parseHtmlSeo(html: string, url: string, status: number | null): SiteSeoPage {
  const text = htmlToText(html);
  const blocked = looksLikeBotWall(html) || looksLikeBotWall(text);
  const claims = extractOfferClaims(blocked ? "" : text);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const canonical = firstMatch(
    html,
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i,
  );
  const lang = firstMatch(html, /<html[^>]+lang=["']([^"']+)["'][^>]*>/i);
  return {
    url,
    fetched: html.length > 80,
    status,
    blocked,
    title: title ? title.slice(0, 180) : null,
    metaDescription: metaByName(html, "description")?.slice(0, 320) ?? null,
    robots: metaByName(html, "robots"),
    h1: h1 ? htmlToText(h1).slice(0, 180) : null,
    canonical: canonicalizeShopUrl(canonical),
    lang,
    ogTitle: metaByName(html, "og:title")?.slice(0, 180) ?? null,
    wordCount: blocked ? 0 : text.split(" ").filter(Boolean).length,
    hasSaleLanguage: claims.hasSaleLanguage,
    maxDiscountPct: claims.maxDiscountPct,
  };
}

const AI_CRAWLER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "Google-CloudVertexBot",
  "PerplexityBot",
  "ClaudeBot",
  "Applebot-Extended",
  "CCBot",
] as const;

export function parseJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    if (!json) continue;
    try {
      collectJsonLdTypes(JSON.parse(json) as unknown, types);
    } catch {
      /* invalid JSON-LD is a miss, not a crash */
    }
  }
  return [...types].sort();
}

function collectJsonLdTypes(node: unknown, types: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, types);
    return;
  }
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  const rawType = rec["@type"];
  if (typeof rawType === "string" && rawType.trim()) types.add(rawType.trim());
  if (Array.isArray(rawType)) {
    for (const item of rawType) {
      if (typeof item === "string" && item.trim()) types.add(item.trim());
    }
  }
  if (rec["@graph"]) collectJsonLdTypes(rec["@graph"], types);
}

export function parseAiCrawlerDirectives(robotsText: string): SiteSeoAiCrawler[] {
  const lines = robotsText.split(/\r?\n/);
  const found = new Map<string, boolean | null>();
  let current: string[] = [];
  let blockDisallowAll: boolean | null = null;
  const flush = () => {
    for (const agent of current) {
      const match = AI_CRAWLER_AGENTS.find((name) => name.toLowerCase() === agent.toLowerCase());
      if (match) found.set(match, blockDisallowAll);
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = /^user-agent:\s*(.+)$/i.exec(line);
    if (ua?.[1]) {
      flush();
      current = [ua[1].trim()];
      blockDisallowAll = null;
      continue;
    }
    const disallow = /^disallow:\s*(.*)$/i.exec(line);
    if (disallow && current.length > 0) {
      const path = (disallow[1] ?? "").trim();
      if (path === "/" || path === "/*") blockDisallowAll = true;
      else if (path === "" && blockDisallowAll == null) blockDisallowAll = false;
    }
    const allow = /^allow:\s*(.*)$/i.exec(line);
    if (allow && current.length > 0 && (allow[1] ?? "").trim() === "/") {
      blockDisallowAll = false;
    }
  }
  flush();
  return AI_CRAWLER_AGENTS.map((agent) => ({
    agent,
    disallowAll: found.has(agent) ? found.get(agent)! : null,
  }));
}

export function parseRobotsTxt(text: string): SiteSeoRobots {
  const sitemapUrls: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*sitemap:\s*(\S+)/i.exec(line);
    if (!match?.[1]) continue;
    const url = canonicalizeShopUrl(match[1]);
    if (url && !sitemapUrls.includes(url)) sitemapUrls.push(url);
  }
  return {
    fetched: text.trim().length > 0,
    sitemapUrls,
    preview: text.slice(0, 400),
  };
}

export function parseSitemapLocs(xml: string, allowedHost: string): string[] {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  const out: string[] = [];
  for (const loc of locs) {
    const url = canonicalizeShopUrl(loc);
    if (!url) continue;
    try {
      if (new URL(url).hostname !== allowedHost) continue;
    } catch {
      continue;
    }
    if (!out.includes(url)) out.push(url);
    if (out.length >= 20) break;
  }
  return out;
}

export function gradeFromScore(score: number): SiteSeoGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function check(
  id: string,
  status: SiteSeoStatus,
  title: string,
  detail: string,
  weight: number,
): { check: SiteSeoCheck; points: number } {
  const points = status === "pass" ? weight : status === "warn" ? Math.round(weight * 0.4) : 0;
  return { check: { id, status, title, detail }, points };
}

export function assembleSiteSeo(args: {
  homepageUrl: string;
  homepage: FetchedDoc | null;
  robots: FetchedDoc | null;
  sitemap: FetchedDoc | null;
  llms?: FetchedDoc | null;
}): SiteSeoReport {
  const origin = shopOrigin(args.homepageUrl);
  const allowedHost = origin ? new URL(origin).hostname : "";
  const homeDoc = args.homepage;
  const homepage =
    homeDoc && homeDoc.text
      ? parseHtmlSeo(homeDoc.text, homeDoc.url || args.homepageUrl, homeDoc.status)
      : homeDoc
        ? {
            url: args.homepageUrl,
            fetched: false,
            status: homeDoc.status,
            blocked: false,
            title: null,
            metaDescription: null,
            robots: null,
            h1: null,
            canonical: null,
            lang: null,
            ogTitle: null,
            wordCount: 0,
            hasSaleLanguage: false,
            maxDiscountPct: null,
          }
        : null;

  const robotsTxt = args.robots?.fetched ? parseRobotsTxt(args.robots.text) : {
    fetched: false,
    sitemapUrls: [],
    preview: "",
  };
  const sitemapXml = args.sitemap?.fetched ? args.sitemap.text : "";
  const sitemapUrls = allowedHost && sitemapXml ? parseSitemapLocs(sitemapXml, allowedHost) : [];
  const sitemap: SiteSeoSitemap = {
    fetched: Boolean(args.sitemap?.fetched && sitemapXml.length > 20),
    urlCount: sitemapUrls.length,
    urls: sitemapUrls,
  };
  const jsonLdTypes = homeDoc?.text ? parseJsonLdTypes(homeDoc.text) : [];
  const aiCrawlers = args.robots?.fetched ? parseAiCrawlerDirectives(args.robots.text) : [];
  const llmsTxt: SiteSeoLlms = {
    fetched: Boolean(args.llms?.fetched && (args.llms.text ?? "").trim().length > 8),
    status: args.llms?.status ?? null,
    preview: (args.llms?.text ?? "").slice(0, 2500),
  };

  const checks: SiteSeoCheck[] = [];
  let score = 0;
  const add = (row: { check: SiteSeoCheck; points: number }) => {
    checks.push(row.check);
    score += row.points;
  };

  const usable = Boolean(homepage?.fetched && !homepage.blocked);
  if (homepage?.blocked) {
    add(
      check(
        "fetch",
        "warn",
        "Cloudflare wall — on-page tags unread",
        "The HTML is a bot challenge, not the shop. Title / H1 / meta below are incomplete until the wall lets this server through.",
        20,
      ),
    );
  } else if (!homepage?.fetched) {
    add(
      check(
        "fetch",
        "fail",
        "Homepage did not fetch",
        homepage?.status
          ? `HTTP ${homepage.status} from ${args.homepageUrl}. Open the site in a browser if Cloudflare is in front.`
          : `Could not load ${args.homepageUrl}.`,
        20,
      ),
    );
  } else {
    add(check("fetch", "pass", "Homepage fetched", args.homepageUrl, 20));
  }

  const titleLen = homepage?.title?.length ?? 0;
  if (!usable) {
    add(check("title", "warn", "Title unread", "Needs a successful HTML fetch.", 12));
    add(check("description", "warn", "Meta description unread", "Needs a successful HTML fetch.", 10));
    add(check("h1", "warn", "H1 unread", "Needs a successful HTML fetch.", 10));
    add(check("canonical", "warn", "Canonical unread", "Needs a successful HTML fetch.", 8));
    add(check("lang", "warn", "html lang unread", "Needs a successful HTML fetch.", 5));
    add(check("og", "warn", "Open Graph unread", "Needs a successful HTML fetch.", 8));
    add(check("index", "warn", "Robots meta unread", "Needs a successful HTML fetch.", 4));
  } else {
    add(
      titleLen >= 10 && titleLen <= 70
        ? check("title", "pass", "Title length", `${titleLen} characters.`, 12)
        : check(
            "title",
            titleLen === 0 ? "fail" : "warn",
            "Title length",
            titleLen === 0 ? "No <title> on the homepage." : `${titleLen} characters — aim for 10–70.`,
            12,
          ),
    );
    const descLen = homepage?.metaDescription?.length ?? 0;
    add(
      descLen >= 50 && descLen <= 160
        ? check("description", "pass", "Meta description", `${descLen} characters.`, 10)
        : check(
            "description",
            descLen === 0 ? "fail" : "warn",
            "Meta description",
            descLen === 0 ? "No meta description." : `${descLen} characters — aim for 50–160.`,
            10,
          ),
    );
    add(
      homepage?.h1
        ? check("h1", "pass", "H1 present", homepage.h1, 10)
        : check("h1", "fail", "Missing H1", "Homepage has no H1.", 10),
    );
    const canonicalHost = homepage?.canonical ? shopOrigin(homepage.canonical) : null;
    add(
      homepage?.canonical && canonicalHost === origin
        ? check("canonical", "pass", "Canonical on this host", homepage.canonical, 8)
        : check(
            "canonical",
            homepage?.canonical ? "warn" : "fail",
            homepage?.canonical ? "Canonical host mismatch" : "No canonical",
            homepage?.canonical ?? "Add a same-host canonical.",
            8,
          ),
    );
    add(
      homepage?.lang
        ? check("lang", "pass", "html lang", homepage.lang, 5)
        : check("lang", "warn", "Missing html lang", "Set lang on <html> to match the shop (el for a Greek store).", 5),
    );
    add(
      homepage?.ogTitle
        ? check("og", "pass", "og:title", homepage.ogTitle, 8)
        : check("og", "warn", "Missing og:title", "Social shares fall back to the document title.", 8),
    );
    const robots = (homepage?.robots ?? "").toLowerCase();
    add(
      robots.includes("noindex")
        ? check("index", "fail", "Homepage is noindex", homepage?.robots ?? "noindex", 4)
        : check("index", "pass", "Indexable", homepage?.robots || "no robots meta (default index).", 4),
    );
  }

  add(
    args.homepageUrl.startsWith("https://")
      ? check("https", "pass", "HTTPS", args.homepageUrl, 5)
      : check("https", "fail", "Not HTTPS", args.homepageUrl, 5),
  );
  add(
    robotsTxt.fetched
      ? check(
          "robots",
          "pass",
          "robots.txt",
          robotsTxt.sitemapUrls.length
            ? `Sitemap: ${robotsTxt.sitemapUrls[0]}`
            : "Fetched. No Sitemap: line.",
          8,
        )
      : check("robots", "warn", "robots.txt missing", "Could not fetch /robots.txt.", 8),
  );
  add(
    sitemap.fetched
      ? check(
          "sitemap",
          sitemap.urlCount > 0 ? "pass" : "warn",
          "sitemap.xml",
          sitemap.urlCount > 0
            ? `${sitemap.urlCount} apex URLs listed (sample).`
            : "Sitemap fetched but no same-host <loc> tags.",
          10,
        )
      : check("sitemap", "warn", "No sitemap.xml", "Could not fetch /sitemap.xml on this host.", 10),
  );

  if (usable && homepage && !homepage.hasSaleLanguage) {
    checks.push({
      id: "offer",
      status: "warn",
      title: "Homepage is not a sale page",
      detail:
        "No sale language or %-off in the homepage text. If Meta ads claim a discount, send traffic to a real sale URL on this host — see Creative Fatigue.",
    });
  } else if (usable && homepage?.hasSaleLanguage) {
    checks.push({
      id: "offer",
      status: "pass",
      title: "Sale language on homepage",
      detail:
        homepage.maxDiscountPct != null
          ? `Largest %-off parsed from text: ${homepage.maxDiscountPct}% (not from CSS widths).`
          : "Sale wording found. Confirm the live discount in Creative Fatigue before matching ad copy.",
    });
  }

  const hasFaqSchema = jsonLdTypes.some((type) =>
    /^(FAQPage|QAPage|HowTo)$/i.test(type),
  );
  checks.push({
    id: "aeo-schema",
    status: hasFaqSchema ? "pass" : "warn",
    title: hasFaqSchema ? "Answer schema on homepage" : "No FAQ / Q&A schema",
    detail: hasFaqSchema
      ? `JSON-LD includes ${jsonLdTypes.filter((type) => /FAQPage|QAPage|HowTo/i.test(type)).join(", ")}. That is AEO markup, not a featured-snippet guarantee.`
      : jsonLdTypes.length > 0
        ? `JSON-LD types: ${jsonLdTypes.join(", ")}. FAQPage / QAPage / HowTo would help answer engines; we do not invent rankings.`
        : "No JSON-LD on the homepage. AEO needs FAQ/Q&A markup we can parse — not a rank tracker.",
  });

  const blockedAi = aiCrawlers.filter((row) => row.disallowAll === true);
  const namedAi = aiCrawlers.filter((row) => row.disallowAll != null);
  checks.push({
    id: "geo-crawlers",
    status: blockedAi.length > 0 ? "warn" : namedAi.length > 0 ? "pass" : "warn",
    title:
      blockedAi.length > 0
        ? `robots.txt blocks ${blockedAi.map((row) => row.agent).join(", ")}`
        : namedAi.length > 0
          ? "Named AI crawlers in robots.txt"
          : "No named AI crawler rules",
    detail:
      blockedAi.length > 0
        ? "Those agents cannot train or cite from this host while Disallow: / is set. GEO traffic in GA4 is still a session clock, not a ranking."
        : namedAi.length > 0
          ? `Rules found for ${namedAi.map((row) => row.agent).join(", ")}. Wildcard * still applies to unnamed bots.`
          : "GPTBot, Google-Extended, PerplexityBot and peers are unnamed here — they follow User-agent: *. This is not ChatGPT rank data.",
  });

  checks.push({
    id: "geo-llms",
    status: llmsTxt.fetched ? "pass" : "warn",
    title: llmsTxt.fetched ? "llms.txt present" : "No llms.txt",
    detail: llmsTxt.fetched
      ? "Generative crawlers can read /llms.txt. That is GEO plumbing, not a citation count."
      : "No /llms.txt on this host. Optional for GEO; we will not invent Perplexity or ChatGPT rankings.",
  });

  const clamped = Math.max(0, Math.min(100, score));
  return {
    url: args.homepageUrl,
    origin,
    score: clamped,
    grade: gradeFromScore(clamped),
    homepage,
    robotsTxt,
    sitemap,
    llmsTxt,
    jsonLdTypes,
    aiCrawlers,
    checks,
  };
}

export async function fetchSiteDoc(url: string): Promise<FetchedDoc> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: 4500,
      headers: {
        Accept: HTML_FETCH_HEADERS.Accept,
        "User-Agent": HTML_FETCH_HEADERS["User-Agent"],
      },
    });
    const text = await res.text();
    return {
      url: res.url || url,
      status: res.status,
      text: text.slice(0, 250_000),
      fetched: res.ok && text.length > 20,
    };
  } catch {
    return { url, status: null, text: "", fetched: false };
  }
}
