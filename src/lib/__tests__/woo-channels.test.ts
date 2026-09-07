import { groupWooChannels, missingPaidConnections, normalizeWooChannel } from "@/lib/woo-channels";

describe("normalizeWooChannel", () => {
  it("collapses Google hosts and UTM", () => {
    expect(normalizeWooChannel("google")).toBe("google");
    expect(normalizeWooChannel("google.com")).toBe("google");
    expect(normalizeWooChannel("www.google.com")).toBe("google");
  });

  it("collapses Meta and Instagram last-click", () => {
    expect(normalizeWooChannel("fb")).toBe("meta");
    expect(normalizeWooChannel("l.facebook.com")).toBe("meta");
    expect(normalizeWooChannel("meta-cpc-dpa")).toBe("meta");
    expect(normalizeWooChannel("ig")).toBe("instagram");
    expect(normalizeWooChannel("l.instagram.com")).toBe("instagram");
  });

  it("treats empty and type-in as direct", () => {
    expect(normalizeWooChannel(null)).toBe("direct");
    expect(normalizeWooChannel("(none)")).toBe("direct");
    expect(normalizeWooChannel("(direct)")).toBe("direct");
  });

  it("rolls ESP UTMs into email last-click, not pixel", () => {
    expect(normalizeWooChannel("Brevo")).toBe("email");
    expect(normalizeWooChannel("sendinblue")).toBe("email");
    expect(normalizeWooChannel("omnisend")).toBe("email");
  });
});

describe("groupWooChannels", () => {
  it("sums last-click hosts into operator channels", () => {
    const grouped = groupWooChannels([
      { source: "google", orders: 90, netSales: 9000 },
      { source: "google.com", orders: 3, netSales: 300 },
      { source: "fb", orders: 100, netSales: 8000 },
      { source: "(direct)", orders: 300, netSales: 20000 },
    ]);
    expect(grouped.find((r) => r.channel === "direct")?.orders).toBe(300);
    expect(grouped.find((r) => r.channel === "google")?.orders).toBe(93);
    expect(grouped.find((r) => r.channel === "meta")?.orders).toBe(100);
    expect(grouped.find((r) => r.channel === "direct")?.grossProfit).toBe(0);
  });

  it("rolls GP, refunds, and new-customer net into last-click channels", () => {
    const grouped = groupWooChannels([
      {
        source: "google",
        orders: 30,
        netSales: 5900,
        refunds: 80,
        tax: 940,
        grossProfit: 700,
        newOrders: 18,
        newNetSales: 3600,
      },
      {
        source: "google.com",
        orders: 2,
        netSales: 200,
        refunds: 0,
        tax: 32,
        grossProfit: 40,
        newOrders: 1,
        newNetSales: 100,
      },
      {
        source: "(direct)",
        orders: 77,
        netSales: 9000,
        refunds: 40,
        tax: 1400,
        grossProfit: 1100,
        newOrders: 20,
        newNetSales: 2400,
      },
    ]);
    const google = grouped.find((r) => r.channel === "google");
    expect(google?.orders).toBe(32);
    expect(google?.netSales).toBe(6100);
    expect(google?.grossProfit).toBe(740);
    expect(google?.refunds).toBe(80);
    expect(google?.newNetSales).toBe(3700);
    expect(google?.newShare).toBeCloseTo(3700 / 6100);
  });
});

describe("missingPaidConnections", () => {
  it("asks to connect Google when till has Google last-click and Ads is missing", () => {
    const missing = missingPaidConnections({
      channels: [{ channel: "google", orders: 93, netSales: 9000 }],
      connectedPlatforms: ["meta"],
    });
    expect(missing.map((m) => m.channel)).toEqual(["google"]);
  });

  it("does not nag when Google Ads is already connected", () => {
    const missing = missingPaidConnections({
      channels: [{ channel: "google", orders: 93, netSales: 9000 }],
      connectedPlatforms: ["meta", "google"],
    });
    expect(missing).toEqual([]);
  });
});
