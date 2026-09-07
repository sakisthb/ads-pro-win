export type RfmSegment =
  | "Champion"
  | "Loyal"
  | "Potential Loyalist"
  | "New"
  | "At Risk"
  | "Hibernating";

export const RFM_SEGMENT_COLOR: Record<RfmSegment, string> = {
  Champion: "#10B981",
  Loyal: "#38BDF8",
  "Potential Loyalist": "#8B5CF6",
  New: "#22D3EE",
  "At Risk": "#F59E0B",
  Hibernating: "#71717A",
};

export interface CustomerOrderRow {
  email: string | null;
  netSales: number;
  dateCreated: Date;
}

export interface CustomerProfile {
  email: string;
  orders: number;
  netSales: number;
  lastOrderAt: Date;
  recencyDays: number;
  segment: RfmSegment;
}

/** Recency / frequency / monetary from first-seen emails. Guest (no email) orders are ignored. */
export function classifyRfmSegment(args: {
  orders: number;
  recencyDays: number;
}): RfmSegment {
  const { orders, recencyDays } = args;
  if (orders >= 3 && recencyDays <= 45) return "Champion";
  if (orders >= 2 && recencyDays <= 90) return "Loyal";
  if (orders === 1 && recencyDays <= 30) return "New";
  if (orders >= 2 && recencyDays <= 180) return "At Risk";
  if (orders === 1 && recencyDays <= 90) return "Potential Loyalist";
  return "Hibernating";
}

export function buildCustomerProfiles(
  rows: CustomerOrderRow[],
  now: Date = new Date(),
): { profiles: CustomerProfile[]; guestOrders: number } {
  const byEmail = new Map<
    string,
    { orders: number; netSales: number; lastOrderAt: Date }
  >();
  let guestOrders = 0;
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email) {
      guestOrders += 1;
      continue;
    }
    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, {
        orders: 1,
        netSales: row.netSales,
        lastOrderAt: row.dateCreated,
      });
      continue;
    }
    prev.orders += 1;
    prev.netSales += row.netSales;
    if (row.dateCreated > prev.lastOrderAt) prev.lastOrderAt = row.dateCreated;
  }

  const profiles: CustomerProfile[] = [...byEmail.entries()].map(([email, row]) => {
    const recencyDays = Math.max(
      0,
      Math.floor((now.getTime() - row.lastOrderAt.getTime()) / 86_400_000),
    );
    return {
      email,
      orders: row.orders,
      netSales: row.netSales,
      lastOrderAt: row.lastOrderAt,
      recencyDays,
      segment: classifyRfmSegment({ orders: row.orders, recencyDays }),
    };
  });
  profiles.sort((a, b) => b.netSales - a.netSales);
  return { profiles, guestOrders };
}

export function rfmCounts(profiles: CustomerProfile[]): Array<{
  name: RfmSegment;
  value: number;
  color: string;
}> {
  const counts = new Map<RfmSegment, number>();
  for (const profile of profiles) {
    counts.set(profile.segment, (counts.get(profile.segment) ?? 0) + 1);
  }
  return (Object.keys(RFM_SEGMENT_COLOR) as RfmSegment[])
    .map((name) => ({
      name,
      value: counts.get(name) ?? 0,
      color: RFM_SEGMENT_COLOR[name],
    }))
    .filter((row) => row.value > 0);
}
