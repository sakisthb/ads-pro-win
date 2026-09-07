/** @jest-environment node */
import {
  assembleSiteSeo,
  emptySiteSeoReport,
  gradeFromScore,
  htmlToText,
  parseAiCrawlerDirectives,
  parseHtmlSeo,
  parseJsonLdTypes,
  parseRobotsTxt,
  parseSitemapLocs,
  resolveBrandWebsite,
  BAGTOBAG_APEX,
} from "@/lib/site-seo";

const HOME = `<!doctype html>
<html lang="el">
<head>
  <title>BAGTOBAG | Δερμάτινα είδη</title>
  <meta name="description" content="Τσάντες και αξεσουάρ από γνήσιο δέρμα. Χονδρική πώληση για καταστήματα." />
  <meta property="og:title" content="BAGTOBAG leather" />
  <link rel="canonical" href="https://bagtobag.com.gr/" />
</head>
<body>
  <style>.hero { width: 80%; }</style>
  <h1>Wholesale leather goods</h1>
  <p>Corporate catalogue for retailers. Contact us for B2B pricing.</p>
</body>
</html>`;

describe("resolveBrandWebsite", () => {
  it("uses the brand website and strips en.", () => {
    expect(
      resolveBrandWebsite({
        website: "https://en.bagtobag.com.gr/shop",
        slug: "other",
      }),
    ).toBe("https://bagtobag.com.gr/");
  });

  it("falls back to apex only for bagtobag slugs", () => {
    expect(resolveBrandWebsite({ website: null, slug: "bagtobag" })).toBe(BAGTOBAG_APEX);
    expect(resolveBrandWebsite({ website: null, slug: "acme-shop" })).toBeNull();
  });
});

describe("parseHtmlSeo", () => {
  it("reads title, h1, canonical, lang, og — not CSS percentages", () => {
    const page = parseHtmlSeo(HOME, "https://bagtobag.com.gr/", 200);
    expect(page.title).toContain("BAGTOBAG");
    expect(page.h1).toMatch(/Wholesale/i);
    expect(page.canonical).toBe("https://bagtobag.com.gr/");
    expect(page.lang).toBe("el");
    expect(page.ogTitle).toBe("BAGTOBAG leather");
    expect(page.maxDiscountPct).toBeNull();
    expect(page.hasSaleLanguage).toBe(false);
    expect(page.blocked).toBe(false);
  });

  it("flags a Cloudflare wall and ignores fake sale % in CSS", () => {
    const page = parseHtmlSeo(
      `<html><title>Just a moment...</title><style>.x{width:80%}</style><p>Enable JavaScript and cookies to continue</p></html>`,
      "https://bagtobag.com.gr/",
      403,
    );
    expect(page.blocked).toBe(true);
    expect(page.hasSaleLanguage).toBe(false);
    expect(page.maxDiscountPct).toBeNull();
  });
});

describe("parseRobotsTxt / sitemap", () => {
  it("reads Sitemap: lines", () => {
    const robots = parseRobotsTxt("User-agent: *\nAllow: /\nSitemap: https://bagtobag.com.gr/sitemap.xml\n");
    expect(robots.fetched).toBe(true);
    expect(robots.sitemapUrls).toEqual(["https://bagtobag.com.gr/sitemap.xml"]);
  });

  it("rewrites en. locs onto the apex host and drops other domains", () => {
    const urls = parseSitemapLocs(
      `<urlset>
        <loc>https://bagtobag.com.gr/product/a</loc>
        <loc>https://en.bagtobag.com.gr/product/b</loc>
        <loc>https://other.com/x</loc>
      </urlset>`,
      "bagtobag.com.gr",
    );
    expect(urls).toEqual([
      "https://bagtobag.com.gr/product/a",
      "https://bagtobag.com.gr/product/b",
    ]);
  });
});

describe("assembleSiteSeo", () => {
  it("scores a fetched homepage without inventing keyword volume", () => {
    const report = assembleSiteSeo({
      homepageUrl: "https://bagtobag.com.gr/",
      homepage: { url: "https://bagtobag.com.gr/", status: 200, text: HOME, fetched: true },
      robots: {
        url: "https://bagtobag.com.gr/robots.txt",
        status: 200,
        text: "User-agent: *\nSitemap: https://bagtobag.com.gr/sitemap.xml",
        fetched: true,
      },
      sitemap: {
        url: "https://bagtobag.com.gr/sitemap.xml",
        status: 200,
        text: "<urlset><loc>https://bagtobag.com.gr/</loc></urlset>",
        fetched: true,
      },
    });
    expect(report.grade).not.toBe("F");
    expect(report.score).toBeGreaterThan(70);
    expect(report.checks.some((c) => c.id === "offer" && c.status === "warn")).toBe(true);
    expect(report.sitemap.urlCount).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(/backlink|keyword volume|domain authority/i);
    expect(report.checks.some((c) => c.id === "geo-llms")).toBe(true);
    expect(report.checks.some((c) => c.id === "aeo-schema")).toBe(true);
  });

  it("warns instead of inventing on-page tags when Cloudflare blocks", () => {
    const report = assembleSiteSeo({
      homepageUrl: "https://bagtobag.com.gr/",
      homepage: {
        url: "https://bagtobag.com.gr/",
        status: 403,
        text: "<html>Just a moment... Enable JavaScript and cookies to continue</html>",
        fetched: true,
      },
      robots: { url: "https://bagtobag.com.gr/robots.txt", status: 403, text: "", fetched: false },
      sitemap: { url: "https://bagtobag.com.gr/sitemap.xml", status: 403, text: "", fetched: false },
    });
    expect(report.homepage?.blocked).toBe(true);
    expect(report.checks.find((c) => c.id === "fetch")?.status).toBe("warn");
    expect(report.checks.find((c) => c.id === "title")?.status).toBe("warn");
  });
});

describe("empty / grade", () => {
  it("fails closed without a website", () => {
    const report = emptySiteSeoReport(null);
    expect(report.score).toBe(0);
    expect(report.grade).toBe("F");
    expect(report.checks[0]?.id).toBe("website");
  });

  it("maps score bands", () => {
    expect(gradeFromScore(90)).toBe("A");
    expect(gradeFromScore(72)).toBe("B");
    expect(gradeFromScore(12)).toBe("F");
  });

  it("strips script and style before word count", () => {
    const text = htmlToText("<style>.a{width:80%}</style><p>Hello bag</p>");
    expect(text).toBe("Hello bag");
    expect(text).not.toContain("80");
  });
});

describe("GEO / AEO on-site parsers", () => {
  it("reads JSON-LD @type including @graph", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [{ "@type": "Organization" }, { "@type": "FAQPage" }],
    })}</script>`;
    expect(parseJsonLdTypes(html)).toEqual(["FAQPage", "Organization"]);
  });

  it("flags GPTBot Disallow: / without inventing other agents", () => {
    const rows = parseAiCrawlerDirectives("User-agent: GPTBot\nDisallow: /\n");
    expect(rows.find((row) => row.agent === "GPTBot")?.disallowAll).toBe(true);
    expect(rows.find((row) => row.agent === "PerplexityBot")?.disallowAll).toBeNull();
  });
});
