import {
  adsManagerUrl,
  buildActionInbox,
  buildDemoFatiguePayload,
  buildDiversity,
  buildEconomics,
  buildKpis,
  buildRecommendations,
  buildRefreshCalendar,
  buildWinnerSwaps,
  catalogSignalFromWooProducts,
  clusterSimilarCreatives,
  emptyStoreSnapshot,
  extractHttpUrl,
  extractOfferClaims,
  fatigueCsv,
  inferFormat,
  inferObjective,
  jaccard,
  landingUrlsToProbe,
  mergeLandingWithCatalog,
  projectCtr,
  sanitizeCreativeLabel,
  scoreDrafts,
  scoreFatigue,
  scoreOfferMatch,
  shopOrigin,
  shopHostLabel,
  tokenizeCreative,
  windowCvr,
  wooStoreApiUrls,
  catalogSignalFromMetaProducts,
  canonicalizeShopUrl,
  buildFatigueAlertDrafts,
  looksLikeUgc,
  buildCreativeHealth,
  buildOfferRewrites,
  type FatigueAdDraft,
  type FatigueLandingSnapshot,
} from "@/lib/creative-fatigue";

function draft(overrides: Partial<FatigueAdDraft> = {}): FatigueAdDraft {
  return {
    adId: "ad-1",
    adName: "Hero",
    platform: "meta",
    campaignId: "c1",
    campaignName: "Prospecting",
    adsetId: "s1",
    adsetName: "LAL 1%",
    creativeTitle: "Summer sale bags",
    creativeBody: "Shop the drop today",
    creativeImageUrl: null,
    format: "image",
    objective: "prospecting",
    spend: 100,
    impressions: 10_000,
    reach: 4_000,
    clicks: 100,
    ctr: 1,
    frequency: 2,
    conversions: 4,
    daysLive: 10,
    avgWatchSeconds: null,
    daily: [
      { date: "2026-08-01", ctr: 2, frequency: 1.1, spend: 10, impressions: 1000, clicks: 20, conversions: 1 },
      { date: "2026-08-08", ctr: 1.8, frequency: 1.4, spend: 12, impressions: 1000, clicks: 18, conversions: 1 },
      { date: "2026-08-15", ctr: 1.1, frequency: 1.8, spend: 14, impressions: 1000, clicks: 11, conversions: 0 },
      { date: "2026-08-22", ctr: 0.8, frequency: 2.2, spend: 16, impressions: 1000, clicks: 8, conversions: 0 },
    ],
    ...overrides,
  };
}

describe("creative fatigue scoring", () => {
  it("scores a 40% CTR drop as high fatigue even at low frequency", () => {
    const result = scoreFatigue({
      ctr: 1.1,
      ctrDropPct: -40,
      frequency: 2.1,
      objective: "prospecting",
      daysLive: 10,
      platform: "meta",
      cpaChangePct: 0,
      avgWatchSeconds: null,
    });
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.diagnosis).toBe("creative_death");
  });

  it("treats high frequency with stable CTR as audience saturation", () => {
    const result = scoreFatigue({
      ctr: 2.4,
      ctrDropPct: -4,
      frequency: 8.2,
      objective: "prospecting",
      daysLive: 9,
      platform: "meta",
      cpaChangePct: 0,
      avgWatchSeconds: null,
    });
    expect(result.diagnosis).toBe("audience_saturation");
    expect(result.score).toBeGreaterThan(0);
  });

  it("uses a higher frequency cap for retargeting", () => {
    const prospecting = scoreFatigue({
      ctr: 2.8,
      ctrDropPct: -2,
      frequency: 8,
      objective: "prospecting",
      daysLive: 4,
      platform: "meta",
      cpaChangePct: 0,
      avgWatchSeconds: null,
    });
    const retargeting = scoreFatigue({
      ctr: 2.8,
      ctrDropPct: -2,
      frequency: 8,
      objective: "retargeting",
      daysLive: 4,
      platform: "meta",
      cpaChangePct: 0,
      avgWatchSeconds: null,
    });
    expect(prospecting.score).toBeGreaterThan(retargeting.score);
    expect(retargeting.diagnosis).not.toBe("audience_saturation");
  });

  it("flags TikTok ads past the 8-day cadence", () => {
    const result = scoreFatigue({
      ctr: 2.1,
      ctrDropPct: -3,
      frequency: 2,
      objective: "prospecting",
      daysLive: 20,
      platform: "tiktok",
      cpaChangePct: 0,
      avgWatchSeconds: null,
    });
    expect(result.diagnosis).toBe("over_cadence");
    expect(result.score).toBeGreaterThan(0);
  });

  it("adds a hook penalty when average watch time is under 3s", () => {
    const healthy = scoreFatigue({
      ctr: 2.2,
      ctrDropPct: 0,
      frequency: 2,
      objective: "prospecting",
      daysLive: 5,
      platform: "tiktok",
      cpaChangePct: 0,
      avgWatchSeconds: 6,
    });
    const weak = scoreFatigue({
      ctr: 2.2,
      ctrDropPct: 0,
      frequency: 2,
      objective: "prospecting",
      daysLive: 5,
      platform: "tiktok",
      cpaChangePct: 0,
      avgWatchSeconds: 1.4,
    });
    expect(weak.score).toBe(healthy.score + 8);
  });

  it("diagnoses CPA inflation when CTR holds and CPA jumps 25%+", () => {
    const result = scoreFatigue({
      ctr: 5.5,
      ctrDropPct: 2,
      frequency: 3.4,
      objective: "prospecting",
      daysLive: 30,
      platform: "meta",
      cpaChangePct: 107,
      avgWatchSeconds: null,
      cadenceExempt: true,
    });
    expect(result.diagnosis).toBe("cpa_inflation");
    expect(result.level).toBe("low");
  });

  it("keeps creative death ahead of CPA inflation when CTR has already collapsed", () => {
    const result = scoreFatigue({
      ctr: 0.9,
      ctrDropPct: -40,
      frequency: 2.1,
      objective: "prospecting",
      daysLive: 12,
      platform: "meta",
      cpaChangePct: 80,
      avgWatchSeconds: null,
    });
    expect(result.diagnosis).toBe("creative_death");
  });
});

describe("objective and format inference", () => {
  it("detects retargeting from campaign naming", () => {
    expect(inferObjective("Advantage+ (PUR)", "Site visitors 30d retarget")).toBe("retargeting");
    expect(inferObjective("Advantage+ (PUR) // General Campaign")).toBe("prospecting");
  });

  it("maps Meta object types and Google ad types to formats", () => {
    expect(inferFormat({ objectType: "VIDEO", hasVideo: true })).toBe("video");
    expect(inferFormat({ name: "Carousel lookbook" })).toBe("carousel");
    expect(inferFormat({ googleAdType: "RESPONSIVE_SEARCH_AD" })).toBe("search");
    expect(inferFormat({ objectType: "PHOTO" })).toBe("image");
  });
});

describe("Andromeda-style clustering", () => {
  it("clusters near-duplicate headlines", () => {
    const clusters = clusterSimilarCreatives([
      { adId: "a", creativeTitle: "Summer sale bags shop the drop", creativeBody: "Free shipping" },
      { adId: "b", creativeTitle: "Summer sale bags shop the drop", creativeBody: "Free shipping today" },
      { adId: "c", creativeTitle: "Founder story from Athens", creativeBody: "Handmade leather" },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].size).toBe(2);
    expect(clusters[0].adIds.sort()).toEqual(["a", "b"]);
  });

  it("returns high jaccard for identical token sets", () => {
    const a = tokenizeCreative("Shop the drop", "Shop the drop");
    expect(jaccard(a, a)).toBe(1);
  });
});

describe("payload assembly", () => {
  it("puts spend-weighted high-fatigue ads into spend at risk", () => {
    const ads = scoreDrafts([
      draft({
        adId: "hot",
        spend: 500,
        daysLive: 40,
        frequency: 7,
        ctr: 0.5,
        daily: [
          { date: "2026-08-01", ctr: 2.4, frequency: 1, spend: 50, impressions: 2000, clicks: 48, conversions: 2 },
          { date: "2026-08-20", ctr: 0.4, frequency: 7, spend: 80, impressions: 2000, clicks: 8, conversions: 0 },
        ],
      }),
      draft({
        adId: "ok",
        spend: 40,
        daysLive: 4,
        frequency: 1.2,
        ctr: 2.8,
        daily: [
          { date: "2026-08-20", ctr: 2.8, frequency: 1.2, spend: 10, impressions: 800, clicks: 22, conversions: 1 },
          { date: "2026-08-21", ctr: 2.7, frequency: 1.3, spend: 10, impressions: 800, clicks: 21, conversions: 1 },
        ],
      }),
    ]);
    const hot = ads.find((a) => a.adId === "hot");
    expect(hot?.fatigueLevel).toBe("high");
    const payload = buildDemoFatiguePayload();
    expect(payload.kpis.adsCount).toBe(9);
    expect(payload.recommendations.length).toBeGreaterThan(0);
    expect(payload.decayKeys.length).toBeGreaterThan(0);
    expect(payload.connected).toBe(true);
  });

  it("keeps demo scatter points aligned with ads", () => {
    const payload = buildDemoFatiguePayload();
    expect(payload.scatter).toHaveLength(payload.ads.length);
  });

  it("ships operator inbox, calendar, mix and brief on the demo payload", () => {
    const payload = buildDemoFatiguePayload();
    expect(payload.inbox.length).toBeGreaterThan(0);
    expect(payload.calendar.length).toBeGreaterThan(0);
    expect(payload.mix.length).toBeGreaterThan(0);
    expect(payload.brief).toContain("Creative refresh brief");
    expect(payload.coverage).toEqual([]);
    expect(payload.mix.some((row) => row.diagnosis === "cpa_inflation")).toBe(true);
    expect(payload.launchDraft.name).toMatch(/UGC|carousel|catalog/i);
    expect(payload.kpis.cpaWatchSpend).toBeGreaterThan(0);
    expect(payload.economics.checks.length).toBeGreaterThan(0);
    expect(payload.brief).toMatch(/Economics|CPA watch|catalog/i);
    const csv = fatigueCsv(payload.ads);
    expect(csv.split("\n")[0]).toContain("projected_ctr_7d");
    expect(csv.split("\n")[0]).toContain("cpa_change_pct");
    expect(csv.split("\n")[0]).toContain("cvr_change_pct");
    expect(csv.split("\n")).toHaveLength(payload.ads.length + 1);
  });
});

describe("operator projections and swaps", () => {
  it("projects CTR from a declining series and floors at zero", () => {
    const pts = [
      { date: "2026-08-01", ctr: 3, frequency: 1, spend: 10, impressions: 1000, clicks: 30, conversions: 1 },
      { date: "2026-08-02", ctr: 2, frequency: 1, spend: 10, impressions: 1000, clicks: 20, conversions: 1 },
      { date: "2026-08-03", ctr: 1, frequency: 1, spend: 10, impressions: 1000, clicks: 10, conversions: 0 },
    ];
    expect(projectCtr(pts, 7)).toBe(0);
    expect(projectCtr(pts.slice(0, 2))).toBeNull();
  });

  it("does not explode a mild CTR rise into a doubled forecast", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      ctr: 5.4 + i * 0.015,
      frequency: 3,
      spend: 20,
      impressions: 1000,
      clicks: 54,
      conversions: 2,
    }));
    const projected = projectCtr(pts, 7);
    expect(projected).not.toBeNull();
    expect(projected as number).toBeLessThan(8);
    expect(projected as number).toBeGreaterThan(5.4);
  });

  it("pairs a dying ad with a healthier same-platform winner", () => {
    const ads = scoreDrafts([
      draft({
        adId: "tired",
        spend: 400,
        ctr: 0.4,
        daysLive: 30,
        frequency: 6,
        daily: [
          { date: "2026-08-01", ctr: 2.2, frequency: 1, spend: 40, impressions: 2000, clicks: 44, conversions: 2 },
          { date: "2026-08-20", ctr: 0.4, frequency: 6, spend: 80, impressions: 2000, clicks: 8, conversions: 0 },
        ],
      }),
      draft({
        adId: "winner",
        spend: 80,
        ctr: 2.8,
        daysLive: 5,
        frequency: 1.4,
        creativeTitle: "New angle bags",
        creativeBody: "Handmade in Athens",
        daily: [
          { date: "2026-08-20", ctr: 2.8, frequency: 1.2, spend: 20, impressions: 800, clicks: 22, conversions: 1 },
          { date: "2026-08-21", ctr: 2.9, frequency: 1.3, spend: 20, impressions: 800, clicks: 23, conversions: 1 },
          { date: "2026-08-22", ctr: 2.7, frequency: 1.4, spend: 20, impressions: 800, clicks: 21, conversions: 1 },
        ],
      }),
    ]);
    const swaps = buildWinnerSwaps(ads);
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps[0].tiredAdId).toBe("tired");
    expect(swaps[0].winnerAdId).toBe("winner");
  });

  it("marks overdue Meta ads on the refresh calendar", () => {
    const ads = scoreDrafts([draft({ daysLive: 40, platform: "meta" })]);
    const cal = buildRefreshCalendar(ads);
    expect(cal[0]?.bucket).toBe("overdue");
    expect(ads[0].daysUntilRefresh).toBe(-22);
  });

  it("builds Meta Ads Manager deep links with the account id", () => {
    const [ad] = scoreDrafts([draft({ accountId: "377992403045602" })]);
    const url = adsManagerUrl(ad);
    expect(url).toContain("act=377992403045602");
    expect(url).toContain("selected_ad_ids=ad-1");
  });
});

describe("catalog templates and operator labels", () => {
  it("strips Shopify Liquid into a readable catalog label", () => {
    expect(
      sanitizeCreativeLabel("[ {{product.current_price strip_zeros}} ] - {{product.name}}"),
    ).toBe("Catalog product ad");
    expect(sanitizeCreativeLabel("Summer tote {{product.name}}")).toBe("Summer tote");
  });

  it("does not treat evergreen catalog ads as overdue cadence", () => {
    const [ad] = scoreDrafts([
      draft({
        creativeTitle: "[ {{product.current_price strip_zeros}} ] - {{product.name}}",
        adName: "{{product.name}}",
        campaignName: "Advantage+ PUR // General Campaign",
        daysLive: 694,
        ctr: 5.59,
        frequency: 3.49,
        avgWatchSeconds: 1,
        format: "image",
        daily: [
          { date: "2026-08-01", ctr: 5.4, frequency: 3.1, spend: 20, impressions: 1000, clicks: 54, conversions: 2 },
          { date: "2026-08-15", ctr: 5.6, frequency: 3.4, spend: 22, impressions: 1000, clicks: 56, conversions: 2 },
        ],
      }),
    ]);
    expect(ad.catalogTemplate).toBe(true);
    expect(ad.advantagePlus).toBe(true);
    expect(ad.creativeTitle).toBe("Catalog product ad");
    expect(ad.daysLive).toBeLessThan(40);
    expect(ad.pastCadence).toBe(false);
    expect(ad.diagnosis).not.toBe("over_cadence");
    expect(ad.avgWatchSeconds).toBeNull();
    expect(buildKpis([ad]).projectedCtr7d).not.toBeUndefined();
    expect(ad.recentCtr7d).toBeGreaterThan(0);
  });

  it("puts CPA inflation on the inbox while CTR is holding", () => {
    const [ad] = scoreDrafts([
      draft({
        spend: 678,
        ctr: 5.5,
        frequency: 3.4,
        conversions: 10,
        catalogTemplate: true,
        creativeTitle: "[ {{product.name}} ]",
        campaignName: "Advantage+ PUR",
        daily: [
          { date: "2026-08-01", ctr: 5.4, frequency: 3, spend: 20, impressions: 1000, clicks: 54, conversions: 4 },
          { date: "2026-08-02", ctr: 5.5, frequency: 3.1, spend: 20, impressions: 1000, clicks: 55, conversions: 4 },
          { date: "2026-08-20", ctr: 5.6, frequency: 3.4, spend: 40, impressions: 1000, clicks: 56, conversions: 1 },
          { date: "2026-08-21", ctr: 5.5, frequency: 3.5, spend: 40, impressions: 1000, clicks: 55, conversions: 1 },
        ],
      }),
    ]);
    expect(ad.cpaChangePct).toBeGreaterThanOrEqual(25);
    expect(ad.diagnosis).toBe("cpa_inflation");
    const inbox = buildActionInbox([ad]);
    expect(inbox[0]?.why).toMatch(/CPA/);
    expect(inbox[0]?.playbook).toMatch(/Purchases got expensive/i);
    const recs = buildRecommendations([ad], buildDiversity([ad]), []);
    expect(recs.some((r) => r.kind === "cpa" || r.kind === "diversity")).toBe(true);
    expect(ad.cvrChangePct).toBeLessThan(-25);
  });
});

describe("CPA forensics", () => {
  it("flags post-click CVR drop when CTR holds", () => {
    const [ad] = scoreDrafts([
      draft({
        spend: 400,
        ctr: 5.5,
        frequency: 3.2,
        catalogTemplate: true,
        campaignName: "Advantage+ PUR",
        daily: [
          { date: "2026-08-01", ctr: 5.5, frequency: 3, spend: 20, impressions: 1000, clicks: 55, conversions: 4 },
          { date: "2026-08-02", ctr: 5.5, frequency: 3.1, spend: 20, impressions: 1000, clicks: 55, conversions: 4 },
          { date: "2026-08-20", ctr: 5.5, frequency: 3.3, spend: 40, impressions: 1000, clicks: 55, conversions: 1 },
          { date: "2026-08-21", ctr: 5.5, frequency: 3.4, spend: 40, impressions: 1000, clicks: 55, conversions: 1 },
        ],
      }),
    ]);
    const economics = buildEconomics([ad], emptyStoreSnapshot());
    expect(economics.cvrChangePct).toBeLessThan(-25);
    expect(economics.checks.some((c) => c.id === "cvr" && c.status === "fail")).toBe(true);
    expect(economics.checks.some((c) => c.id === "pixel" && c.status === "unknown")).toBe(true);
  });

  it("flags Meta under-reporting vs WooCommerce orders", () => {
    const [ad] = scoreDrafts([
      draft({
        conversions: 10,
        clicks: 500,
        spend: 200,
        daily: [
          { date: "2026-08-01", ctr: 2, frequency: 2, spend: 20, impressions: 1000, clicks: 20, conversions: 2 },
          { date: "2026-08-21", ctr: 2, frequency: 2, spend: 20, impressions: 1000, clicks: 20, conversions: 2 },
        ],
      }),
    ]);
    const economics = buildEconomics([ad], {
      ...emptyStoreSnapshot(),
      connected: true,
      orders: 40,
      netSales: 800,
      aov: 20,
      aovBaseline: 20,
      aovRecent: 20,
      productCount: 12,
    });
    expect(economics.pixelGapPct).toBeLessThan(-25);
    expect(economics.checks.some((c) => c.id === "pixel" && c.status === "fail")).toBe(true);
  });

  it("flags store MER as not Advantage+ pixel ROAS", () => {
    const [ad] = scoreDrafts([
      draft({
        campaignName: "Advantage+ (PUR) // General Campaign",
        conversions: 10,
        clicks: 500,
        spend: 200,
        conversionValue: 400,
        daily: [
          { date: "2026-08-01", ctr: 2, frequency: 2, spend: 20, impressions: 1000, clicks: 20, conversions: 2 },
          { date: "2026-08-21", ctr: 2, frequency: 2, spend: 20, impressions: 1000, clicks: 20, conversions: 2 },
        ],
      }),
    ]);
    const economics = buildEconomics([ad], {
      ...emptyStoreSnapshot(),
      connected: true,
      orders: 40,
      netSales: 800,
      aov: 20,
      productCount: 12,
    });
    expect(economics.mer).toBe(4);
    expect(economics.funnel.roas).toBe(2);
    expect(economics.checks.some((c) => c.id === "mer" && c.status === "warn")).toBe(true);
    expect(economics.checks.find((c) => c.id === "mer")?.detail).toMatch(/Advantage\+/);
  });

  it("computes window CVR from clicks and conversions", () => {
    const pts = [
      { date: "2026-08-01", ctr: 2, frequency: 1, spend: 10, impressions: 1000, clicks: 20, conversions: 4 },
      { date: "2026-08-08", ctr: 2, frequency: 1, spend: 10, impressions: 1000, clicks: 20, conversions: 1 },
    ];
    expect(windowCvr(pts, false)).toBe(20);
    expect(windowCvr(pts, true)).toBe(5);
  });
});

describe("offer / landing match", () => {
  const fetched = (overrides: Partial<FatigueLandingSnapshot> = {}): FatigueLandingSnapshot => ({
    url: "https://bagtobag.com.gr/",
    fetched: true,
    title: "BAGTOBAG",
    maxDiscountPct: null,
    hasSaleLanguage: false,
    source: "html",
    onSaleCount: 0,
    ...overrides,
  });

  it("reads Greek sale claims from ad copy", () => {
    const claims = extractOfferClaims("Μήνας Εκπτώσεων & -80% OFF");
    expect(claims.maxDiscountPct).toBe(80);
    expect(claims.hasSaleLanguage).toBe(true);
    expect(extractHttpUrl("https://bagtobag.com.gr/{{product.url}}")).toBeNull();
    expect(extractHttpUrl("https://bagtobag.com.gr/gynaikeies-tsantes/")).toContain("bagtobag");
  });

  it("fails when a sale ad lands on a corporate page", () => {
    const check = scoreOfferMatch(
      "Μήνας Εκπτώσεων & -80% OFF",
      fetched(),
      "Η BAGTOBAG είναι μία εταιρεία εμπορίας. Wholesale registration form.",
    );
    expect(check?.id).toBe("offer");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toMatch(/80/);
  });

  it("fails when the ad over-claims the live discount", () => {
    const landingText = "WINTER SALES ΕΩΣ ΚΑΙ 60% — Πρόλαβε τις Προσφορές!";
    const check = scoreOfferMatch(
      "SALE -80% OFF",
      fetched({ maxDiscountPct: 60, hasSaleLanguage: true }),
      landingText,
    );
    expect(check?.status).toBe("fail");
    expect(check?.detail).toMatch(/60/);
  });

  it("passes when discount depth matches", () => {
    const check = scoreOfferMatch(
      "Winter sales έως 60%",
      fetched({ maxDiscountPct: 60, hasSaleLanguage: true }),
      "WINTER SALES ΕΩΣ ΚΑΙ 60%",
    );
    expect(check?.status).toBe("pass");
  });

  it("probes destination origin as a second URL", () => {
    const urls = landingUrlsToProbe(null, ["https://bagtobag.com.gr/psathini-tsanta-omoy-by-31402/"]);
    expect(urls[0]).toContain("psathini");
    expect(urls.some((u) => u === "https://bagtobag.com.gr/")).toBe(true);
  });

  it("warns when a deep-discount ad cannot be verified because of a bot wall", () => {
    const check = scoreOfferMatch("Μήνας Εκπτώσεων & -80% OFF", {
      url: "https://bagtobag.com.gr/",
      fetched: false,
      title: "Just a moment...",
      maxDiscountPct: null,
      hasSaleLanguage: false,
      source: null,
      onSaleCount: 0,
    });
    expect(check?.status).toBe("warn");
    expect(check?.detail).toMatch(/80/);
    expect(check?.detail).toMatch(/bot protection/);
  });

  it("calls out an unread Meta catalog instead of a silent miss", () => {
    const check = scoreOfferMatch("Μήνας Εκπτώσεων & -80% OFF", {
      url: "https://bagtobag.com.gr/",
      fetched: false,
      title: "Just a moment...",
      maxDiscountPct: null,
      hasSaleLanguage: false,
      source: null,
      onSaleCount: 0,
      catalogAttempted: true,
    });
    expect(check?.status).toBe("warn");
    expect(check?.title).toMatch(/live sale prices/i);
    expect(check?.detail).toMatch(/catalog/);
    expect(check?.detail).not.toMatch(/en\.bagtobag/);
  });

  it("puts offer mismatch on the demo inbox and economics panel", () => {
    const payload = buildDemoFatiguePayload();
    expect(payload.economics.checks.some((c) => c.id === "offer" && c.status === "fail")).toBe(true);
    expect(payload.inbox[0]?.title).toMatch(/sale|landing|discount/i);
    expect(payload.economics.funnel.roas).not.toBeNull();
    expect(payload.brief).toMatch(/Economics/);
  });

  it("stays on the apex shop host and scores catalog sale prices vs the ad", () => {
    expect(canonicalizeShopUrl("https://en.bagtobag.com.gr/gynaikeies-tsantes/")).toBe(
      "https://bagtobag.com.gr/gynaikeies-tsantes/",
    );
    expect(shopOrigin("https://en.bagtobag.com.gr/")).toBe("https://bagtobag.com.gr");
    expect(shopHostLabel("https://en.bagtobag.com.gr/")).toBe("bagtobag.com.gr");
    expect(shopHostLabel("https://other-shop.example/")).toBe("other-shop.example");
    expect(wooStoreApiUrls("https://bagtobag.com.gr/")[0]).toContain("bagtobag.com.gr");
    expect(wooStoreApiUrls("https://bagtobag.com.gr/")[0]).not.toContain("en.bagtobag");
    const catalog = catalogSignalFromWooProducts(
      [
        {
          on_sale: true,
          prices: { price: "1439", regular_price: "1599", sale_price: "1439", currency_minor_unit: 2 },
        },
        {
          on_sale: true,
          prices: { price: "7400", regular_price: "10000", sale_price: "7400", currency_minor_unit: 2 },
        },
      ],
      "https://bagtobag.com.gr/wp-json/wc/store/v1/products?on_sale=true",
    );
    expect(catalog.maxDiscountPct).toBe(26);
    expect(catalog.onSaleCount).toBe(2);
    const merged = mergeLandingWithCatalog(
      { url: "https://bagtobag.com.gr/", fetched: false, title: "Just a moment...", text: "Just a moment..." },
      catalog,
    );
    expect(merged.fetched).toBe(true);
    expect(merged.source).toBe("catalog");
    expect(merged.maxDiscountPct).toBe(26);
    expect(merged.url).toBe("https://bagtobag.com.gr/");
    const fromMeta = catalogSignalFromMetaProducts(
      [
        { price: "39.99 EUR", sale_price: "31.99 EUR", url: "https://en.bagtobag.com.gr/tsanta-omoy/" },
        { price: "20 EUR", sale_price: "16 EUR", url: "https://other-shop.example/x" },
      ],
      "https://bagtobag.com.gr/",
    );
    expect(fromMeta.sampleCount).toBe(1);
    expect(fromMeta.maxDiscountPct).toBe(20);
    expect(fromMeta.url).toBe("https://bagtobag.com.gr/");
    expect(merged.fetched).toBe(true);
    expect(merged.source).toBe("catalog");
    expect(merged.maxDiscountPct).toBe(26);
    const payload = buildEconomics(
      scoreDrafts([
        {
          adId: "ad-1",
          adName: "Advantage+",
          platform: "meta",
          campaignId: "c1",
          campaignName: "Advantage+ PUR",
          adsetId: "s1",
          adsetName: "Advantage+",
          creativeTitle: "Catalog",
          creativeBody: "Μήνας Εκπτώσεων & -80% OFF",
          creativeImageUrl: null,
          format: "image",
          objective: "prospecting",
          spend: 679,
          impressions: 182000,
          reach: 52000,
          clicks: 10000,
          ctr: 5.59,
          frequency: 3.49,
          conversions: 34,
          daysLive: 30,
          avgWatchSeconds: null,
          catalogTemplate: true,
          daily: [
            { date: "2026-08-01", ctr: 5.5, frequency: 3, spend: 20, impressions: 1000, clicks: 55, conversions: 4 },
            { date: "2026-08-21", ctr: 5.6, frequency: 3.5, spend: 40, impressions: 1000, clicks: 56, conversions: 1 },
          ],
        },
      ]),
      emptyStoreSnapshot(),
      "EUR",
      merged,
    );
    const offer = payload.checks.find((c) => c.id === "offer");
    expect(offer?.status).toBe("fail");
    expect(offer?.detail).toMatch(/26%/);
  });

  it("marks an empty Meta catalog as attempted so offer scoring can warn", () => {
    const empty = catalogSignalFromMetaProducts([], "https://bagtobag.com.gr/");
    expect(empty.attempted).toBe(true);
    expect(empty.sampleCount).toBe(0);
    expect(empty.url).toBe("https://bagtobag.com.gr/");
    const merged = mergeLandingWithCatalog(
      { url: "https://bagtobag.com.gr/", fetched: false, title: "Just a moment...", text: "Just a moment..." },
      empty,
    );
    expect(merged.catalogAttempted).toBe(true);
    expect(merged.fetched).toBe(false);
    expect(merged.url).toBe("https://bagtobag.com.gr/");
  });

  it("opens a daily offer alert on the CPA-climbing catalog ad", () => {
    const payload = buildDemoFatiguePayload();
    const alerts = buildFatigueAlertDrafts(payload.ads, "EUR", payload.economics);
    expect(alerts.some((row) => row.kind === "cpa_inflation")).toBe(true);
    const offer = alerts.find((row) => row.kind === "offer");
    expect(offer?.href).toMatch(/^\/creative-fatigue\?ad=/);
    expect(offer?.message).toMatch(/80|sale|discount|landing/i);
    expect(offer?.href).not.toMatch(/en\.bagtobag/);
  });

  it("audits format volume, UGC, and ships rewrites for a sale/catalog mix", () => {
    expect(looksLikeUgc("UGC Unboxing", "Shot on iPhone")).toBe(true);
    expect(looksLikeUgc("Advantage+ catalog")).toBe(false);
    const payload = buildDemoFatiguePayload();
    expect(payload.health.checks.some((c) => c.id.startsWith("CR-01"))).toBe(true);
    expect(payload.health.grade).toMatch(/^[A-F]$/);
    expect(payload.rewrites.length).toBeGreaterThan(0);
    expect(payload.brief).toMatch(/Creative health/);
    const catalogOnly = buildCreativeHealth(
      payload.ads.filter((a) => a.catalogTemplate),
      payload.diversity,
      payload.clusters,
      payload.economics,
    );
    expect(catalogOnly.checks.some((c) => c.id === "CR-02" && c.status === "fail")).toBe(true);
    const pack = buildOfferRewrites(payload.ads, payload.economics.landing);
    expect(pack.some((r) => r.body.includes("bagtobag.com.gr") || r.why.length > 10)).toBe(true);
    const other = buildOfferRewrites(payload.ads, {
      ...payload.economics.landing,
      url: "https://other-shop.example/",
    });
    expect(other.some((r) => /BAGTOBAG/i.test(r.body))).toBe(false);
    expect(other.some((r) => r.body.includes("other-shop.example"))).toBe(true);
  });
});
