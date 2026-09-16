/** @jest-environment node */
import {
  brandHostname,
  buildGrowthDesk,
  growthCenterOriginFromEnv,
  parseGrowthCenterOrigin,
  assertHostedGrowthDeskEnv,
  resolveGrowthDeskOrigin,
  probeGrowthCenterReadyz,
  resolveGrowthCenterDesk,
  parseGrowthCenterFacts,
  loadGrowthDesk,
  growthCenterHref,
  formatGrowthAcceptedAt,
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

  it("rejects loopback origin outside development so Docker cannot point at itself", () => {
    expect(
      growthCenterOriginFromEnv("http://127.0.0.1:18806", "production"),
    ).toBeNull();
    expect(
      growthCenterOriginFromEnv("http://127.0.0.1:18806", "test"),
    ).toBeNull();
    expect(
      growthCenterOriginFromEnv("http://127.0.0.1:18806", "development"),
    ).toBe("http://127.0.0.1:18806");
  });
});

describe("assertHostedGrowthDeskEnv", () => {
  it("allows an empty origin until the Growth Center domain exists", () => {
    expect(assertHostedGrowthDeskEnv({ origin: "", token: "" })).toEqual({
      ok: true,
      origin: null,
    });
  });

  it("requires HTTPS origin and a desk token when origin is set", () => {
    expect(
      assertHostedGrowthDeskEnv({
        origin: "http://127.0.0.1:18806",
        token: "t".repeat(32),
      }).ok,
    ).toBe(false);
    expect(
      assertHostedGrowthDeskEnv({
        origin: "https://growth.example",
        token: "short",
      }).ok,
    ).toBe(false);
    expect(
      assertHostedGrowthDeskEnv({
        origin: "https://growth.example",
        token: "t".repeat(32),
      }),
    ).toEqual({ ok: true, origin: "https://growth.example" });
  });
});

describe("resolveGrowthDeskOrigin", () => {
  it("keeps local loopback in development even without a desk token", () => {
    expect(
      resolveGrowthDeskOrigin({
        originRaw: "http://127.0.0.1:18806",
        token: "",
        nodeEnv: "development",
      }),
    ).toBe("http://127.0.0.1:18806");
  });

  it("fails closed in production when origin is loopback or token is missing", () => {
    expect(
      resolveGrowthDeskOrigin({
        originRaw: "http://127.0.0.1:18806",
        token: "t".repeat(32),
        nodeEnv: "production",
      }),
    ).toBeNull();
    expect(
      resolveGrowthDeskOrigin({
        originRaw: "https://growth.example",
        token: "",
        nodeEnv: "production",
      }),
    ).toBeNull();
  });

  it("accepts HTTPS Growth Center origin with a desk token outside development", () => {
    expect(
      resolveGrowthDeskOrigin({
        originRaw: "https://growth.example",
        token: "t".repeat(32),
        nodeEnv: "production",
      }),
    ).toBe("https://growth.example");
  });

  it("leaves the desk unlinked when production origin is unset", () => {
    expect(
      resolveGrowthDeskOrigin({
        originRaw: "",
        token: "",
        nodeEnv: "production",
      }),
    ).toBeNull();
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

describe("formatGrowthAcceptedAt", () => {
  it("formats a SACOS timestamp in UTC without inventing a batch", () => {
    expect(formatGrowthAcceptedAt("2026-09-11T13:51:16.848213+00:00")).toBe(
      "Sep 11, 2026",
    );
    expect(formatGrowthAcceptedAt(null)).toBeNull();
    expect(formatGrowthAcceptedAt("not-a-date")).toBeNull();
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
      href: "http://127.0.0.1:18806/?site=bagtobag_com_gr",
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

describe("growthCenterHref", () => {
  const origin = "http://127.0.0.1:18806";

  it("opens the BagToBag workspace, not a raw origin", () => {
    expect(growthCenterHref(origin, "bagtobag_com_gr")).toBe(
      "http://127.0.0.1:18806/?site=bagtobag_com_gr",
    );
  });

  it("opens image issues, drafts, and last accepted as views", () => {
    expect(growthCenterHref(origin, "bagtobag_com_gr", "images")).toBe(
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=images",
    );
    expect(growthCenterHref(origin, "bagtobag_com_gr", "products")).toBe(
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=products",
    );
    expect(growthCenterHref(origin, "bagtobag_com_gr", "pilot")).toBe(
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=products&pilot=1",
    );
  });

  it("drops junk site ids and views instead of stuffing them into the URL", () => {
    expect(growthCenterHref(origin, "../etc")).toBe("http://127.0.0.1:18806/");
    expect(growthCenterHref(origin, "bagtobag_com_gr", "javascript:alert(1)" as never)).toBe(
      "http://127.0.0.1:18806/?site=bagtobag_com_gr",
    );
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

describe("loadGrowthDesk live HTTP contract", () => {
  it("talks to a real loopback peer shaped like SACOS desk-summary", async () => {
    const http = await import("node:http");
    const token = "t".repeat(32);
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/readyz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ready", release: "contract-smoke" }));
        return;
      }
      if (url.pathname === "/api/desk-summary") {
        const auth = req.headers.authorization ?? "";
        if (
          auth !== `Bearer ${token}` ||
          url.searchParams.get("site") !== "bagtobag_com_gr"
        ) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            site: "bagtobag_com_gr",
            imageIssues: 14,
            pendingDrafts: 0,
            lastAccepted: {
              appliedProducts: 32,
              at: "2026-09-11T12:38:19Z",
            },
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("expected TCP address");
    }
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      const desk = await loadGrowthDesk({
        organizationSlug: "kotman1979",
        website: "https://bagtobag.com.gr",
        origin,
        deskToken: token,
      });
      expect(desk).toMatchObject({
        status: "linked",
        siteId: "bagtobag_com_gr",
        origin,
        reachability: "reachable",
        catalogFacts: {
          imageIssues: 14,
          pendingDrafts: 0,
          lastAccepted: {
            appliedProducts: 32,
            at: "2026-09-11T12:38:19Z",
          },
        },
      });
      if (desk.status === "linked") {
        expect(growthCenterHref(desk.origin, desk.siteId, "images")).toBe(
          `${origin}/?site=bagtobag_com_gr&view=images`,
        );
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

