import { buildCustomerProfiles, classifyRfmSegment } from "@/lib/woo-customers";

describe("classifyRfmSegment", () => {
  it("marks recent high-frequency buyers as champions", () => {
    expect(classifyRfmSegment({ orders: 4, recencyDays: 10 })).toBe("Champion");
  });

  it("marks one recent order as new", () => {
    expect(classifyRfmSegment({ orders: 1, recencyDays: 5 })).toBe("New");
  });

  it("marks old repeat buyers as at risk", () => {
    expect(classifyRfmSegment({ orders: 3, recencyDays: 120 })).toBe("At Risk");
  });
});

describe("buildCustomerProfiles", () => {
  it("groups by email and ignores guests", () => {
    const now = new Date("2026-08-28T00:00:00.000Z");
    const { profiles, guestOrders } = buildCustomerProfiles(
      [
        { email: "a@shop.gr", netSales: 100, dateCreated: new Date("2026-08-01T00:00:00.000Z") },
        { email: "A@shop.gr", netSales: 50, dateCreated: new Date("2026-08-20T00:00:00.000Z") },
        { email: null, netSales: 80, dateCreated: new Date("2026-08-21T00:00:00.000Z") },
      ],
      now,
    );
    expect(guestOrders).toBe(1);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.orders).toBe(2);
    expect(profiles[0]?.netSales).toBe(150);
    expect(profiles[0]?.segment).toBe("Loyal");
  });
});
