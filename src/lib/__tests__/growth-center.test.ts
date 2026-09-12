/** @jest-environment node */
import {
  brandHostname,
  buildGrowthDesk,
  growthCenterOriginFromEnv,
  parseGrowthCenterOrigin,
  probeGrowthCenterReadyz,
  resolveGrowthCenterDesk,
  parseGrowthCenterFacts,
  loadGrowthDesk,
} from "@/lib/growth-center";
import { resolveBrandWebsite } from "@/lib/site-seo";

describe("brandHostname", () => {
  it("reads the host from a full website URL", () => {
    expect(brandHostname("https://bagtobag.com.gr/")).toBe("bagtobag.com.gr");
    expect(brandHostname("bagtobag.com.gr")).toBe("bagtobag.com.gr");
  });

  it("returns null for empty or unusable values", () => {
    expect(brandHostname(null)).toBeNull();
    expect(brandHostname("")).toBeNull();
    expect(brandHostname("not a host")).toBeNull();
  });
});

describe("growthCenterOriginFromEnv", () => {
  it("defaults to local 18806 only in development", () => {
    expect(growthCenterOriginFromEnv(undefined, "development")).toBe(
      "http://127.0.0.1:18806",
    );
    expect(growthCenterOriginFromEnv(undefined, "test")).toBeNull();
    expect(growthCenterOriginFromEnv(undefined, "production")).toBeNull();
    expect(
      growthCenterOriginFromEnv("https://sacos.socialideas.gr", "production"),
    ).toBe("https://sacos.socialideas.gr");
  });
});

describe("parseGrowthCenterOrigin", () => {
  it("accepts local loopback HTTP and hosted HTTPS with no path", () => {
    expect(parseGrowthCenterOrigin("http://127.0.0.1:18806")).toBe(
      "http://127.0.0.1:18806",
    );
    expect(parseGrowthCenterOrigin("https://sacos.socialideas.gr")).toBe(
      "https://sacos.socialideas.gr",
    );
  });

  it("rejects paths, http-to-the-internet, and junk", () => {
    expect(parseGrowthCenterOrigin("http://127.0.0.1:18806/accounts/login/")).toBeNull();
    expect(parseGrowthCenterOrigin("http://example.com")).toBeNull();
    expect(parseGrowthCenterOrigin("javascript:alert(1)")).toBeNull();
    expect(parseGrowthCenterOrigin("")).toBeNull();
  });
});

describe("resolveGrowthCenterDesk", () => {
  const origin = "http://127.0.0.1:18806";

  it("maps BagToBag to the SACOS site and never invents catalog counts", () => {
    const desk = resolveGrowthCenterDesk({
      organizationSlug: "kotman1979",
      website: "https://bagtobag.com.gr",
      origin,
    });
    expect(desk).toEqual({
      status: "linked",
      hostname: "bagtobag.com.gr",
      siteId: "bagtobag_com_gr",
      origin,
      href: "http://127.0.0.1:18806/",
      catalogFacts: null,
    });
  });

  it("stays unlinked for Demo, unknown shops, and missing origin", () => {
    expect(
      resolveGrowthCenterDesk({
        organizationSlug: "demo",
        website: "https://bagtobag.com.gr",
        origin,
      }).status,
    ).toBe("unlinked");
    expect(
      resolveGrowthCenterDesk({
        organizationSlug: "kotman1979",
        website: "https://example.com",
        origin,
      }).status,
    ).toBe("unlinked");
    expect(
      resolveGrowthCenterDesk({
        organizationSlug: "kotman1979",
        website: "https://bagtobag.com.gr",
        origin: null,
      }).status,
    ).toBe("unlinked");
  });

  it("uses the existing BagToBag website resolver when the brand slug is bagtobag", () => {
    const website = resolveBrandWebsite({ website: null, slug: "bagtobag" });
    const desk = resolveGrowthCenterDesk({
      organizationSlug: "kotman1979",
      website,
      origin,
    });
    expect(desk).toMatchObject({
      status: "linked",
      siteId: "bagtobag_com_gr",
    });
  });
});

describe("buildGrowthDesk", () => {
  it("keeps catalog facts null even when the origin is reachable", () => {
    const desk = buildGrowthDesk({
      organizationSlug: "kotman1979",
      website: "https://www.bagtobag.com.gr",
      origin: "http://127.0.0.1:18806",
      reachability: "reachable",
    });
    expect(desk.status).toBe("linked");
    if (desk.status !== "linked") return;
    expect(desk.reachability).toBe("reachable");
    expect(desk.catalogFacts).toBeNull();
    expect(desk).not.toHaveProperty("imageIssues");
    expect(desk).not.toHaveProperty("drafts");
  });
});

describe("probeGrowthCenterReadyz", () => {
  it("treats a ready JSON body as reachable", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ready", release: "local" }),
    });
    await expect(
      probeGrowthCenterReadyz("http://127.0.0.1:18806", fetchImpl),
    ).resolves.toBe("reachable");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:18806/readyz",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fails closed on network errors, timeouts, and non-ready bodies", async () => {
    await expect(
      probeGrowthCenterReadyz("http://127.0.0.1:18806", async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).resolves.toBe("unreachable");
    await expect(
      probeGrowthCenterReadyz("http://127.0.0.1:18806", async () =>
        ({
          ok: true,
          json: async () => ({ status: "unavailable" }),
        }) as Response,
      ),
    ).resolves.toBe("unreachable");
  });
});

describe("parseGrowthCenterFacts", () => {
  it("accepts the SACOS desk-summary shape", () => {
    expect(
      parseGrowthCenterFacts({
        site: "bagtobag_com_gr",
        imageIssues: 12,
        pendingDrafts: 3,
        lastAccepted: { appliedProducts: 32, at: "2026-09-11T12:38:19Z" },
      }),
    ).toEqual({
      imageIssues: 12,
      pendingDrafts: 3,
      lastAccepted: { appliedProducts: 32, at: "2026-09-11T12:38:19Z" },
    });
  });

  it("returns null instead of inventing counts", () => {
    expect(parseGrowthCenterFacts(null)).toBeNull();
    expect(parseGrowthCenterFacts({ imageIssues: 12 })).toBeNull();
    expect(
      parseGrowthCenterFacts({
        imageIssues: 0,
        pendingDrafts: 0,
        lastAccepted: null,
      }),
    ).toBeNull();
    expect(
      parseGrowthCenterFacts({
        imageIssues: -1,
        pendingDrafts: 0,
        lastAccepted: null,
      }),
    ).toBeNull();
    expect(
      parseGrowthCenterFacts({
        imageIssues: 1,
        pendingDrafts: 1,
        lastAccepted: { appliedProducts: "32" },
      }),
    ).toBeNull();
  });
});

describe("loadGrowthDesk facts", () => {
  const origin = "http://127.0.0.1:18806";

  it("attaches desk-summary facts when the token and origin succeed", async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (String(url).endsWith("/readyz")) {
        return {
          ok: true,
          json: async () => ({ status: "ready" }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          site: "bagtobag_com_gr",
          imageIssues: 4,
          pendingDrafts: 2,
          lastAccepted: { appliedProducts: 32, at: null },
        }),
      };
    });
    const desk = await loadGrowthDesk({
      organizationSlug: "kotman1979",
      website: "https://bagtobag.com.gr",
      origin,
      deskToken: "t".repeat(32),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(desk.status).toBe("linked");
    if (desk.status !== "linked") return;
    expect(desk.catalogFacts).toEqual({
      imageIssues: 4,
      pendingDrafts: 2,
      lastAccepted: { appliedProducts: 32, at: null },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:18806/api/desk-summary?site=bagtobag_com_gr",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Bearer ${"t".repeat(32)}`,
        }),
      }),
    );
  });

  it("skips desk-summary without a desk token", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ status: "ready" }),
    }));
    const desk = await loadGrowthDesk({
      organizationSlug: "kotman1979",
      website: "https://bagtobag.com.gr",
      origin,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(desk.status).toBe("linked");
    if (desk.status !== "linked") return;
    expect(desk.catalogFacts).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps catalog facts null when the summary call fails", async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (String(url).endsWith("/readyz")) {
        return { ok: true, json: async () => ({ status: "ready" }) };
      }
      return { ok: false, json: async () => ({ error: "no" }) };
    });
    const desk = await loadGrowthDesk({
      organizationSlug: "kotman1979",
      website: "https://bagtobag.com.gr",
      origin,
      deskToken: "t".repeat(32),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(desk.status).toBe("linked");
    if (desk.status !== "linked") return;
    expect(desk.catalogFacts).toBeNull();
  });
});

