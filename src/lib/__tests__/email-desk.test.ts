import {
  classifyEmailCampaignName,
  classifyEmailTillSource,
  deriveEmailInsights,
  encodeBrevoExtra,
  nonMppUniqueOpens,
  parseBrevoExtra,
  rollupEmailDesks,
  buildEspEmailExportRows,
  buildNextSendBrief,
  uniqueListIds,
  rollupEmailListIds,
} from "@/lib/email-desk";

describe("classifyEmailCampaignName", () => {
  it("splits BAGTOBAG retail and wholesale names", () => {
    expect(classifyEmailCampaignName("ΛΙΑΝΙΚΗ - ΝΕΑ ΣΥΛΛΟΓΗ")).toBe("retail");
    expect(classifyEmailCampaignName("λιανικη NEW COLLECTION")).toBe("retail");
    expect(classifyEmailCampaignName("χονδρικη _copy")).toBe("wholesale");
    expect(classifyEmailCampaignName("ΧΟΝΔΡΙΚΗ NEW COLLECTION_copy_copy")).toBe("wholesale");
    expect(classifyEmailCampaignName("September newsletter")).toBe("other");
    expect(classifyEmailCampaignName("September newsletter", "retail")).toBe("retail");
    expect(classifyEmailCampaignName("September newsletter", "wholesale")).toBe("wholesale");
  });
});

describe("Brevo extra pack", () => {
  it("round-trips stats and ignores foreign attribution strings", () => {
    const packed = encodeBrevoExtra({
      v: 1,
      sent: 1600,
      hardBounces: 2,
      softBounces: 4,
      unsubscriptions: 3,
      complaints: 0,
      appleMppOpens: 88,
      subject: "The Ultimate Summer Squad",
      tags: ["Retail"],
      listIds: [12],
    });
    expect(parseBrevoExtra(packed)).toMatchObject({
      sent: 1600,
      appleMppOpens: 88,
      subject: "The Ultimate Summer Squad",
      listIds: [12],
    });
    expect(parseBrevoExtra("7d_click")).toBeNull();
    expect(parseBrevoExtra(null)).toBeNull();
  });
});

describe("email desk rollup and insights", () => {
  const campaigns = [
    { name: "ΛΙΑΝΙΚΗ", delivered: 4111, opens: 535, clicks: 71, date: "2026-07-27" },
    { name: "ΛΙΑΝΙΚΗ NEW COLLECTION", delivered: 4136, opens: 454, clicks: 112, date: "2026-07-06" },
    { name: "ΛΙΑΝΙΚΗ - ΝΕΑ ΣΥΛΛΟΓΗ", delivered: 4198, opens: 490, clicks: 93, date: "2026-05-08" },
    { name: "χονδρικη _copy", delivered: 1598, opens: 300, clicks: 48, date: "2026-07-31" },
    { name: "ΧΟΝΔΡΙΚΗ NEW COLLECTION", delivered: 1599, opens: 280, clicks: 40, date: "2026-07-21" },
  ];

  it("does not blend retail and wholesale delivered", () => {
    const desks = rollupEmailDesks(campaigns);
    expect(desks.retail.campaigns).toBe(3);
    expect(desks.retail.delivered).toBe(4111 + 4136 + 4198);
    expect(desks.wholesale.delivered).toBe(1598 + 1599);
    expect(desks.retail.minDelivered).toBe(4111);
    expect(desks.retail.maxDelivered).toBe(4198);
  });

  it("inherits unnamed sends on a retail-only shop", () => {
    const desks = rollupEmailDesks(
      [{ name: "September newsletter", delivered: 100, opens: 10, clicks: 2 }],
      "retail",
    );
    expect(desks.retail.delivered).toBe(100);
    expect(desks.other.delivered).toBe(0);
    expect(desks.wholesale.delivered).toBe(0);
  });

  it("cites two markets and refuses email ROAS", () => {
    const desks = rollupEmailDesks(campaigns);
    const insights = deriveEmailInsights({
      campaigns,
      desks,
      extras: {
        present: false,
        sent: 0,
        hardBounces: 0,
        softBounces: 0,
        unsubscriptions: 0,
        complaints: 0,
        appleMppOpens: 0,
      },
      till: { orders: 12, netSales: 1840, sources: ["Brevo"], brevoOrders: 12, gmailAppOrders: 0 },
      currency: "EUR",
    });
    expect(insights.map((i) => i.id)).toEqual(
      expect.arrayContaining(["two-markets", "retail-run-rate", "human-opens-unknown", "till-separate", "list-growth-unknown"]),
    );
    expect(insights.find((i) => i.id === "list-growth-unknown")?.description).toMatch(/not subscriber count/);
    expect(insights.find((i) => i.id === "till-separate")?.description).toMatch(/till/i);
    expect(insights.find((i) => i.id === "till-separate")?.href).toBe("/attribution");
    expect(insights.some((i) => /pixel roas/i.test(i.description))).toBe(true);
    expect(insights.some((i) => /email roas/i.test(i.title))).toBe(false);
  });

  it("cites a next-send band without forecasting Woo", () => {
    const desks = rollupEmailDesks(campaigns);
    const brief = buildNextSendBrief(desks);
    expect(brief).toEqual([
      expect.objectContaining({
        desk: "retail",
        bandMin: 4111,
        bandMax: 4198,
        lastDelivered: 4111,
        sends: 3,
      }),
      expect.objectContaining({
        desk: "wholesale",
        bandMin: 1598,
        bandMax: 1599,
        lastDelivered: 1598,
        sends: 2,
      }),
    ]);
    expect(uniqueListIds([{ extra: { listIds: [2, 1, 2] } }, { extra: { listIds: [1] } }])).toEqual([1, 2]);
    expect(uniqueListIds([{ extra: null }])).toEqual([]);
    const lists = rollupEmailListIds([
      { name: "ΛΙΑΝΙΚΗ", delivered: 4111, opens: 1, clicks: 1, extra: { v: 1, sent: 4111, hardBounces: 0, softBounces: 0, unsubscriptions: 0, complaints: 0, appleMppOpens: 0, listIds: [8] } },
      { name: "χονδρικη", delivered: 1598, opens: 1, clicks: 1, extra: { v: 1, sent: 1598, hardBounces: 0, softBounces: 0, unsubscriptions: 0, complaints: 0, appleMppOpens: 0, listIds: [10] } },
      { name: "ΛΙΑΝΙΚΗ both", delivered: 100, opens: 1, clicks: 1, extra: { v: 1, sent: 100, hardBounces: 0, softBounces: 0, unsubscriptions: 0, complaints: 0, appleMppOpens: 0, listIds: [8, 10] } },
    ]);
    expect(lists[0]).toMatchObject({ listId: 8, delivered: 4211, campaigns: 2, multiListSends: 1, desks: ["retail"] });
    expect(lists.find((row) => row.listId === 10)?.delivered).toBe(1698);
    expect(lists.reduce((sum, row) => sum + row.delivered, 0)).toBeGreaterThan(4111 + 1598 + 100);
  });

  it("subtracts Apple MPP when extras exist", () => {
    const desks = rollupEmailDesks(campaigns);
    const insights = deriveEmailInsights({
      campaigns,
      desks,
      extras: {
        present: true,
        sent: 8000,
        hardBounces: 5,
        softBounces: 2,
        unsubscriptions: 9,
        complaints: 1,
        appleMppOpens: 400,
      },
      till: null,
    });
    expect(insights.map((i) => i.id)).toEqual(expect.arrayContaining(["apple-mpp", "list-health", "no-esp-money"]));
    expect(insights.find((i) => i.id === "apple-mpp")?.description).toMatch(/400/);
    expect(insights.find((i) => i.id === "apple-mpp")?.description).toMatch(/not proven human/);
  });

  it("splits proven Brevo till from Gmail-app last-click", () => {
    expect(classifyEmailTillSource("brevo")).toBe("brevo");
    expect(classifyEmailTillSource("com.google.android.gm")).toBe("gmail-app");
    expect(classifyEmailTillSource("omnisend")).toBe("other-email");
    const desks = rollupEmailDesks(campaigns);
    const insights = deriveEmailInsights({
      campaigns,
      desks,
      extras: {
        present: true,
        sent: 8000,
        hardBounces: 0,
        softBounces: 0,
        unsubscriptions: 0,
        complaints: 0,
        appleMppOpens: 0,
      },
      till: {
        orders: 18,
        netSales: 925,
        sources: ["brevo", "com.google.android.gm"],
        brevoOrders: 10,
        gmailAppOrders: 8,
      },
      currency: "EUR",
    });
    const till = insights.find((i) => i.id === "till-separate")?.description ?? "";
    expect(till).toMatch(/10 have a Brevo UTM/);
    expect(till).toMatch(/Gmail-app last-click/);
    expect(till).not.toMatch(/email ROAS/i);
  });

  it("keeps all-sent archive out of this window's KPIs", () => {
    const desks = rollupEmailDesks(campaigns);
    const insights = deriveEmailInsights({
      campaigns,
      desks,
      extras: {
        present: false,
        sent: 0,
        hardBounces: 0,
        softBounces: 0,
        unsubscriptions: 0,
        complaints: 0,
        appleMppOpens: 0,
      },
      till: null,
      archiveCampaignCount: 178,
    });
    const archive = insights.find((i) => i.id === "email-archive");
    expect(archive?.title).toMatch(/archive/i);
    expect(archive?.description).toMatch(/178/);
    expect(archive?.description).toMatch(/5/);
    expect(archive?.description).toMatch(/Do not mix older delivered/);
    expect(
      deriveEmailInsights({
        campaigns,
        desks,
        extras: {
          present: false,
          sent: 0,
          hardBounces: 0,
          softBounces: 0,
          unsubscriptions: 0,
          complaints: 0,
          appleMppOpens: 0,
        },
        till: null,
        archiveCampaignCount: 5,
      }).some((i) => i.id === "email-archive"),
    ).toBe(false);
  });
});

describe("non-MPP leftover and ESP export", () => {
  it("subtracts Apple MPP without calling the leftover human", () => {
    expect(nonMppUniqueOpens(8843, 5573)).toBe(3270);
    expect(nonMppUniqueOpens(100, 0)).toBe(100);
    expect(nonMppUniqueOpens(0, 10)).toBe(0);
    const rows = buildEspEmailExportRows({
      delivered: 71029,
      uniqueOpens: 8843,
      clicks: 1816,
      extrasPresent: true,
      appleMppOpens: 5573,
      retailDelivered: 41747,
      wholesaleDelivered: 29282,
    });
    expect(rows.find((r) => r[0] === "Unique opens minus Apple MPP (not proven human)")?.[1]).toBe(3270);
    expect(rows.some((r) => /pixel roas/i.test(String(r[1])))).toBe(true);
    expect(rows.some((r) => /email roas/i.test(String(r[0])))).toBe(false);
  });
});
