import {
  classifyNewCustomers,
  costMapFromProducts,
  extractWooAttribution,
  extractWooProductCost,
  moneyFromWooOrder,
  orderCogsFromLineItems,
  profitWhenCogsUnknown,
  rankCatalogProfitability,
  soldTotalsFromWooOrders,
  wooParentsNeedingVariationCosts,
} from "@/lib/woo-orders";

describe("Woo order helpers", () => {
  it("prefers classic UTM, then Woo Order Attribution", () => {
    expect(
      extractWooAttribution([
        { key: "utm_source", value: "facebook" },
        { key: "utm_medium", value: "paid" },
        { key: "utm_campaign", value: "spring" },
      ]),
    ).toEqual({ source: "facebook", medium: "paid", campaign: "spring" });

    expect(
      extractWooAttribution([
        { key: "_wc_order_attribution_source_type", value: "organic" },
        { key: "_wc_order_attribution_utm_source", value: "google" },
      ]),
    ).toEqual({ source: "google", medium: "organic", campaign: null });

    expect(
      extractWooAttribution([{ key: "_wc_order_attribution_source_type", value: "typein" }]),
    ).toEqual({ source: "direct", medium: "typein", campaign: null });
  });

  it("treats Woo total as after-discount and subtracts refunds from net", () => {
    const money = moneyFromWooOrder({
      total: "80",
      discount_total: "20",
      shipping_total: "5",
      total_tax: "16",
      refunds: [{ total: "-10" }],
    });
    expect(money.grossSales).toBe(100);
    expect(money.discounts).toBe(20);
    expect(money.refunds).toBe(10);
    expect(money.tax).toBe(16);
    expect(money.netSales).toBe(70);
  });

  it("falls back to cart_tax + shipping_tax when total_tax is 0", () => {
    const money = moneyFromWooOrder({
      total: "124",
      total_tax: "0",
      cart_tax: "20",
      shipping_tax: "4",
    });
    expect(money.tax).toBe(24);
  });

  it("does not invent VAT when every tax field is 0", () => {
    expect(moneyFromWooOrder({ total: "100", total_tax: "0" }).tax).toBe(0);
  });

  it("does not call net sales gross profit when COGS is missing", () => {
    expect(profitWhenCogsUnknown(0, 80)).toEqual({ costOfGoods: 0, grossProfit: 0 });
    expect(profitWhenCogsUnknown(30, 80)).toEqual({ costOfGoods: 30, grossProfit: 50 });
  });

  it("reads catalog cost from common plugin meta and skips unknown lines", () => {
    expect(extractWooProductCost([{ key: "_wc_cog_cost", value: "12.50" }])).toBe(12.5);
    expect(extractWooProductCost([{ key: "_atum_purchase_price", value: "8,40" }])).toBe(8.4);
    expect(extractWooProductCost([{ key: "_wc_cog_cost", value: "0" }])).toBe(0);

    const costs = costMapFromProducts([
      { productId: 10, costOfGoods: 5 },
      { productId: 20, costOfGoods: 0 },
    ]);
    expect(
      orderCogsFromLineItems(
        [
          { product_id: 10, quantity: 2 },
          { product_id: 20, variation_id: 99, quantity: 1 },
        ],
        costs,
      ),
    ).toBe(0);
    expect(orderCogsFromLineItems([{ product_id: 10, quantity: 3 }], costs)).toBe(15);
    expect(wooParentsNeedingVariationCosts(
      [{ line_items: [{ product_id: 10, variation_id: 99, quantity: 1 }] }],
      costs,
    )).toEqual([10]);
  });

  it("marks only the first order per email as a new customer", () => {
    const classified = classifyNewCustomers([
      { id: "b", customerEmail: "A@Shop.gr", dateCreated: new Date("2026-02-01") },
      { id: "a", customerEmail: "a@shop.gr", dateCreated: new Date("2026-01-01") },
      { id: "c", customerEmail: "other@shop.gr", dateCreated: new Date("2026-01-15") },
    ]);
    expect(classified.newIds).toEqual(["a", "c"]);
    expect(classified.returningIds).toEqual(["b"]);
  });

  it("rolls paid line qty onto variation ids and skips refunded", () => {
    const totals = soldTotalsFromWooOrders([
      { status: "completed", line_items: [{ product_id: 1, quantity: 2, total: "20" }] },
      { status: "refunded", line_items: [{ product_id: 1, quantity: 1, total: "10" }] },
      { status: "processing", line_items: [{ product_id: 1, variation_id: 9, quantity: 1, total: "15" }] },
    ]);
    expect(totals.get(1)).toEqual({ qty: 2, net: 20, parentId: 1 });
    expect(totals.get(9)).toEqual({ qty: 1, net: 15, parentId: 1 });
  });

  it("ranks by till contribution when sold qty exists, not list price", () => {
    const { rows, rankedBy } = rankCatalogProfitability(
      [
        {
          id: "cheap",
          productId: 1,
          sku: null,
          name: "Cheap",
          listPrice: 40,
          cost: 10,
          soldQty: 5,
          soldNet: 180,
          stockQty: 1,
          stockStatus: "instock",
          isAdvertised: false,
        },
        {
          id: "list",
          productId: 2,
          sku: null,
          name: "High list price",
          listPrice: 200,
          cost: 20,
          soldQty: 0,
          soldNet: 0,
          stockQty: 1,
          stockStatus: "instock",
          isAdvertised: false,
        },
      ],
      "profit",
    );
    expect(rankedBy).toBe("sold");
    expect(rows[0].name).toBe("Cheap");
    expect(rows[0].profit).toBe(130);
    expect(rows[1].profit).toBe(0);
  });
});
