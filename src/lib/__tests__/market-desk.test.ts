import {
  adDeskForName,
  classifyMarketName,
  classifyWooOrderMarket,
  matchesMarketFilter,
  namedAdSpendForFilter,
  pickMarketTill,
  resolveMarketMode,
  resolveStoredMarket,
  rollupMarketTill,
  splitNamedAdSpend,
  visibleMarketFilters,
} from "@/lib/market-desk";

describe("classifyMarketName", () => {
  it("splits BAGTOBAG list and campaign names", () => {
    expect(classifyMarketName("ΛΙΑΝΙΚΗ - ΝΕΑ ΣΥΛΛΟΓΗ")).toBe("retail");
    expect(classifyMarketName("λιανικη NEW COLLECTION")).toBe("retail");
    expect(classifyMarketName("χονδρικη _copy")).toBe("wholesale");
    expect(classifyMarketName("ΧΟΝΔΡΙΚΗ NEW COLLECTION_copy_copy")).toBe("wholesale");
    expect(classifyMarketName("Advantage+ shopping")).toBe("unknown");
  });
});

describe("classifyWooOrderMarket", () => {
  it("uses wholesale plugin meta before AOV", () => {
    expect(
      classifyWooOrderMarket({
        customer_id: 0,
        billing: {},
        meta_data: [{ key: "_wwp_wholesale_role", value: "wholesale_customer" }],
      }).market,
    ).toBe("wholesale");
  });

  it("treats VAT and company as wholesale", () => {
    expect(
      classifyWooOrderMarket({
        customer_id: 12,
        billing: { company: "BAGTOBAG Α.Ε.", vat_number: "EL094000000" },
      }).reason,
    ).toBe("billing-vat");
    expect(
      classifyWooOrderMarket({
        customer_id: 12,
        billing: { company: "Athens Fashion IKE", first_name: "Nikos", last_name: "P." },
      }).market,
    ).toBe("wholesale");
  });

  it("treats guest checkout without company as retail on a mixed shop", () => {
    expect(
      classifyWooOrderMarket({
        customer_id: 0,
        billing: { email: "a@gmail.com", first_name: "Maria" },
      }),
    ).toEqual({ market: "retail", reason: "guest" });
  });

  it("does not call a registered shopper wholesale without signals on mixed", () => {
    expect(
      classifyWooOrderMarket({
        customer_id: 44,
        billing: { first_name: "Elena", last_name: "K", email: "elena@gmail.com" },
      }).market,
    ).toBe("unknown");
  });

  it("inherits the shop identity on a single-desk org", () => {
    expect(
      classifyWooOrderMarket(
        { customer_id: 0, billing: { email: "buyer@shop.gr" } },
        [],
        "wholesale",
      ),
    ).toEqual({ market: "wholesale", reason: "mode-wholesale" });
    expect(
      classifyWooOrderMarket(
        { customer_id: 44, billing: { first_name: "Elena", email: "elena@gmail.com" } },
        [],
        "retail",
      ).market,
    ).toBe("retail");
  });

  it("keeps an explicit opposite signal on a single-desk org", () => {
    expect(
      classifyWooOrderMarket(
        {
          customer_id: 0,
          billing: {},
          meta_data: [{ key: "_wwp_wholesale_role", value: "wholesale_customer" }],
        },
        [],
        "retail",
      ).market,
    ).toBe("wholesale");
  });

  it("honours wholesale customer ids and UTM names", () => {
    expect(
      classifyWooOrderMarket({ customer_id: 9, billing: {} }, [9]).reason,
    ).toBe("customer-role");
    expect(
      classifyWooOrderMarket({
        customer_id: 3,
        campaign: "ΛΙΑΝΙΚΗ - SS26",
        billing: { first_name: "A" },
      }).market,
    ).toBe("retail");
  });
});

describe("rollupMarketTill", () => {
  it("does not blend retail and wholesale net", () => {
    const desks = rollupMarketTill([
      { market: "retail", orders: 80, netSales: 9000, newOrders: 40, newCustomerNet: 4000 },
      { market: "unknown", campaign: "χονδρικη SS26", orders: 20, netSales: 14000, newOrders: 4, newCustomerNet: 2000 },
      { market: "unknown", campaign: "Advantage+", orders: 5, netSales: 400 },
    ]);
    expect(desks.retail.netSales).toBe(9000);
    expect(desks.wholesale.netSales).toBe(14000);
    expect(desks.unknown.netSales).toBe(400);
    expect(desks.wholesale.avgOrderValue).toBe(700);
    const blended = pickMarketTill(desks, "all");
    expect(blended.netSales).toBe(23400);
    expect(pickMarketTill(desks, "wholesale").orders).toBe(20);
  });
});

describe("splitNamedAdSpend", () => {
  it("keeps unnamed Meta spend out of wholesale on a mixed shop", () => {
    const ads = splitNamedAdSpend([
      { name: "ΛΙΑΝΙΚΗ prospecting", spend: 400, conversions: 20, conversionValue: 1800 },
      { name: "Advantage+ shopping", spend: 900, conversions: 40, conversionValue: 2600 },
      { name: "χονδρικη remarketing", spend: 50, conversions: 1, conversionValue: 800 },
    ]);
    expect(ads.retail.spend).toBe(400);
    expect(ads.wholesale.spend).toBe(50);
    expect(ads.unknown.spend).toBe(900);
    const wholesale = namedAdSpendForFilter(ads, "wholesale");
    expect(wholesale.spend).toBe(50);
    expect(wholesale.unnamedSpend).toBe(900);
  });

  it("assigns unnamed ads to a retail-only shop", () => {
    const ads = splitNamedAdSpend(
      [
        { name: "Advantage+ shopping", spend: 900 },
        { name: "χονδρικη leftover", spend: 40 },
      ],
      "retail",
    );
    expect(ads.retail.spend).toBe(900);
    expect(ads.wholesale.spend).toBe(40);
    expect(ads.unknown.spend).toBe(0);
    expect(adDeskForName("Catalog sales", "wholesale")).toBe("wholesale");
  });
});

describe("resolveStoredMarket", () => {
  it("trusts a persisted desk over a silent campaign", () => {
    expect(resolveStoredMarket({ market: "wholesale", campaign: "Advantage+" })).toBe("wholesale");
    expect(resolveStoredMarket({ market: "unknown", campaign: "λιανικη" })).toBe("retail");
  });

  it("folds unknown till into a single-desk shop", () => {
    expect(resolveStoredMarket({ market: "unknown", campaign: "Advantage+" }, "retail")).toBe(
      "retail",
    );
  });
});

describe("shop market mode", () => {
  it("lets a brand override the workspace default", () => {
    expect(resolveMarketMode("inherit", "wholesale")).toBe("wholesale");
    expect(resolveMarketMode("retail", "wholesale")).toBe("retail");
    expect(resolveMarketMode(undefined, undefined)).toBe("mixed");
  });

  it("hides the empty opposite desk on a single-market shop", () => {
    expect(visibleMarketFilters("retail", { retail: { orders: 12 }, wholesale: { orders: 0 } })).toEqual(
      ["retail"],
    );
    expect(visibleMarketFilters("mixed")).toEqual(["all", "retail", "wholesale"]);
    expect(
      visibleMarketFilters("retail", { retail: { orders: 10 }, wholesale: { orders: 2 } }),
    ).toEqual(["all", "retail", "wholesale"]);
  });
});

describe("matchesMarketFilter", () => {
  it("keeps all desks on the all chip", () => {
    expect(matchesMarketFilter("unknown", "all")).toBe(true);
    expect(matchesMarketFilter("retail", "wholesale")).toBe(false);
  });
});
