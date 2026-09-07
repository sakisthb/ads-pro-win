import {
  amer,
  breakEvenMer,
  buildMerSnapshot,
  netExVat,
} from "@/lib/till-economics";

describe("till economics", () => {
  it("computes aMER from new-customer net and spend", () => {
    expect(amer(4000, 640)).toBeCloseTo(6.25);
    expect(amer(4000, 0)).toBe(0);
  });

  it("subtracts VAT from Woo net when tax is included", () => {
    expect(netExVat(17414, 2786)).toBe(14628);
    expect(netExVat(100, 0)).toBe(100);
    expect(netExVat(0, 20)).toBe(0);
  });

  it("sets break-even MER at 1 / catalog GP margin", () => {
    expect(breakEvenMer(2296, 17414)).toBeCloseTo(7.585, 2);
    expect(breakEvenMer(0, 17414)).toBeNull();
  });

  it("builds the CEO snapshot without treating MER as incremental", () => {
    const snap = buildMerSnapshot({
      totalSpend: 640,
      totalClicks: 900,
      totalAttributedRevenue: 4300,
      pixelConversions: 28,
      totalRevenue: 17414,
      orderCount: 123,
      costOfGoods: 15118,
      shipping: 400,
      tax: 2786,
      refunds: 120,
      grossProfit: 2296,
      newCustomerNet: 7000,
      newCustomerOrders: 50,
    });
    expect(snap.mer).toBeCloseTo(27.209, 2);
    expect(snap.amer).toBeCloseTo(10.938, 2);
    expect(snap.platformROAS).toBeCloseTo(6.719, 2);
    expect(snap.newCustomerShare).toBeCloseTo(0.402, 2);
    expect(snap.repeatOrders).toBe(73);
    expect(snap.netExVat).toBe(14628);
    expect(snap.breakEvenMer).toBeCloseTo(7.585, 2);
    expect(snap.cogsKnown).toBe(true);
    expect(snap.trueROAS).toBe(snap.mer);
  });
});
