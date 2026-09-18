/** @jest-environment node */
import {
  buildCampaignStudy,
  sameDayStudyWindows,
  type CampaignStudyOrder,
  type CampaignStudyRow,
} from "@/lib/campaign-study";

const AS_OF = "2026-09-18";

function metaRow(day: string, campaignId: string, campaignName: string, over: Partial<CampaignStudyRow> = {}): CampaignStudyRow {
  return {
    date: day, platform: "meta", campaignId, campaignName,
    spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
    linkClicks: 0, landingPageViews: 0, addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0,
    ...over,
  };
}

/** Same-day (1-16) PUR campaign shape: normal July, zero-spend mid-Aug + gap, reduced Sept. */
function purRows(): CampaignStudyRow[] {
  const rows: CampaignStudyRow[] = [];
  for (let d = 1; d <= 16; d += 1) {
    rows.push(metaRow(`2026-07-${String(d).padStart(2, "0")}`, "cmp-pur", "Advantage+ (PUR) // General Campaign", {
      spend: 49.57, linkClicks: 100, landingPageViews: 66, addToCart: 2,
      websitePurchases: d === 16 ? 73 : 0, websitePurchaseValue: d === 16 ? 6345 : 0,
    }));
  }
  for (let d = 1; d <= 16; d += 1) {
    if (d >= 13 && d <= 14) continue; // sync gap
    if (d <= 10) rows.push(metaRow(`2026-08-${String(d).padStart(2, "0")}`, "cmp-pur", "Advantage+ (PUR) // General Campaign", {
      spend: 54, linkClicks: 60, landingPageViews: 5, addToCart: 3,
      websitePurchases: d === 10 ? 17 : 0, websitePurchaseValue: d === 10 ? 1530 : 0,
    }));
    else rows.push(metaRow(`2026-08-${String(d).padStart(2, "0")}`, "cmp-pur", "Advantage+ (PUR) // General Campaign", { spend: 0, addToCart: 2 }));
  }
  for (let d = 1; d <= 16; d += 1) {
    rows.push(metaRow(`2026-09-${String(d).padStart(2, "0")}`, "cmp-pur", "Advantage+ (PUR) // General Campaign", {
      spend: 20, linkClicks: 40, landingPageViews: 3, addToCart: 30,
      websitePurchases: d === 16 ? 24 : 0, websitePurchaseValue: d === 16 ? 5280 : 0,
    }));
  }
  return rows;
}

function b2bRows(): CampaignStudyRow[] {
  return [
    metaRow("2025-03-15", "cmp-b2b-brand", "B2B (GR+CY) || TOF | BRAND", { spend: 300 }),
    metaRow("2025-05-15", "cmp-b2b-brand", "B2B (GR+CY) || TOF | BRAND", { spend: 300 }),
    metaRow("2025-07-15", "cmp-b2b-brand", "B2B (GR+CY) || TOF | BRAND", { spend: 300 }),
    metaRow("2025-09-15", "cmp-b2b-brand", "B2B (GR+CY) || TOF | BRAND", { spend: 622.36 }),
    metaRow("2025-04-01", "cmp-b2b-reg", "B2B (GR+CY) | TOF | SALES - COMPLETE REGISTRATION", { spend: 806.1 }),
    metaRow("2025-08-01", "cmp-b2b-reg2", "B2B (GR+CY) | TOF | SALES - COMPLETE REGISTRATION - 2", { spend: 857.65 }),
  ];
}

function googleRows(): CampaignStudyRow[] {
  const mk = (day: string, campaignId: string, spend: number): CampaignStudyRow => ({
    date: day, platform: "google", campaignId, campaignName: `Google ${campaignId}`,
    spend, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
    linkClicks: 0, landingPageViews: 0, addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0,
  });
  return [mk("2025-10-15", "g-shopping", 1500), mk("2025-11-15", "g-search", 1500), mk("2025-12-15", "g-shopping", 1334.49)];
}

function wooOrders(market: string, count: number, month: string): CampaignStudyOrder[] {
  const list: CampaignStudyOrder[] = [];
  for (let i = 0; i < count; i += 1) {
    const day = String((i % 15) + 1).padStart(2, "0");
    list.push({
      date: `${month}-${day}`, status: i % 5 === 0 ? "processing" : "completed",
      market, grossSales: 120,
      source: i % 3 === 0 ? (i % 9 === 0 ? "meta" : "google") : null,
    });
  }
  return list;
}

const campaigns = [
  { campaignId: "cmp-pur", name: "Advantage+ (PUR) // General Campaign", objective: "OUTCOME_SALES", status: "active" },
  { campaignId: "cmp-b2b-brand", name: "B2B (GR+CY) || TOF | BRAND", objective: "OUTCOME_AWARENESS", status: "archived" },
  { campaignId: "cmp-b2b-reg", name: "B2B (GR+CY) | TOF | SALES - COMPLETE REGISTRATION", objective: "OUTCOME_SALES", status: "archived" },
  { campaignId: "cmp-b2b-reg2", name: "B2B (GR+CY) | TOF | SALES - COMPLETE REGISTRATION - 2", objective: "OUTCOME_SALES", status: "archived" },
  { campaignId: "g-shopping", name: "Google Shopping", objective: null, status: "paused" },
];

function study() {
  return buildCampaignStudy({
    asOf: AS_OF,
    metaRows: [...purRows(), ...b2bRows()],
    googleRows: googleRows(),
    campaigns,
    orders: [
      ...wooOrders("retail", 69, "2026-07"),
      ...wooOrders("retail", 22, "2026-08"),
      ...wooOrders("retail", 23, "2026-09"),
      ...wooOrders("wholesale", 42, "2026-07"),
      ...wooOrders("wholesale", 35, "2026-08"),
      ...wooOrders("wholesale", 51, "2026-09"),
    ],
  });
}

describe("sameDayStudyWindows", () => {
  it("builds day 1-16 windows for the last three months before asOf", () => {
    const windows = sameDayStudyWindows("2026-09-18");
    expect(windows.map(w => w.label)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(windows.map(w => w.startDate)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    expect(windows.map(w => w.endDate)).toEqual(["2026-07-16", "2026-08-16", "2026-09-16"]);
    expect(windows.every(w => w.daysInWindow === 16)).toBe(true);
  });
  it("skips the asOf month when it has no completed day", () => {
    const windows = sameDayStudyWindows("2026-09-01");
    expect(windows.map(w => w.label)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });
});

describe("buildCampaignStudy", () => {
  it("selects the top-spend Meta purchase campaign as primary", () => {
    const s = study();
    expect(s.metaCoverage.primaryCampaign?.campaignId).toBe("cmp-pur");
    expect(s.metaCoverage.primaryCampaign?.shareOfMetaSpend).toBeCloseTo(1653.12 / 4839.23, 5);
    expect(s.metaCoverage.primaryCampaign?.lastRow).toBe("2026-09-16");
  });

  it("computes same-day purchase funnel windows with coverage, zero-spend and gap days", () => {
    const s = study();
    expect(s.purchaseFunnel.map(w => w.window.label)).toEqual(["2026-07", "2026-08", "2026-09"]);
    const [jul, aug, sep] = s.purchaseFunnel;
    expect(jul.daysWithRows).toBe(16);
    expect(jul.zeroSpendDays).toBe(0);
    expect(jul.gapDays).toBe(0);
    expect(jul.spendPerDay).toBeCloseTo(49.57, 2);
    expect(aug.daysWithRows).toBe(14);
    expect(aug.zeroSpendDays).toBe(4);
    expect(aug.gapDays).toBe(2);
    expect(aug.spendPerDay).toBeCloseTo(33.75, 2);
    expect(sep.spendPerDay).toBeCloseTo(20, 2);
    expect(sep.purchases).toBe(24);
    expect(sep.purchaseValue).toBeCloseTo(5280, 2);
    expect(sep.roas).toBeCloseTo(16.5, 1);
  });

  it("diagnoses a sharp spend cut from consecutive same-day declines", () => {
    const s = study();
    expect(s.spendCut.status).toBe("sharp");
    expect(s.spendCut.changes[1].changePct).toBeCloseTo(-31.92, 1);
    expect(s.spendCut.changes[2].changePct).toBeCloseTo(-40.74, 1);
  });

  it("flags broken LPV measurement on rate collapse with ATC exceeding LPV", () => {
    const s = study();
    expect(s.lpv.status).toBe("broken");
    expect(s.lpv.rates[0].rate).toBeCloseTo(0.66, 2);
    expect(s.lpv.rates[2].rate).toBeCloseTo(0.075, 3);
    expect(s.lpv.atcExceedsLpvDays).toBe(16);
  });

  it("tracks Woo retail and wholesale trends per same-day window", () => {
    const s = study();
    expect(s.retail.counts.map(c => c.orders)).toEqual([69, 22, 23]);
    expect(s.retail.status).toBe("sustained_decline");
    expect(s.wholesale.counts.map(c => c.orders)).toEqual([42, 35, 51]);
    expect(s.wholesale.status).toBe("recovered");
  });

  it("detects that the retail dip began while spend was still near-normal", () => {
    const s = study();
    expect(s.timing.dropBeforeSpendCut).toBe(true);
  });

  it("summarizes Google coverage as seasonal bursts only", () => {
    const s = study();
    expect(s.googleCoverage.activeMonths).toEqual(["2025-10", "2025-11", "2025-12"]);
    expect(s.googleCoverage.seasonalOnly).toBe(true);
    expect(s.googleCoverage.totalSpend).toBeCloseTo(4334.49, 2);
    expect(s.googleCoverage.campaignCount).toBe(2);
  });

  it("compares Meta vs Google channel scale", () => {
    const s = study();
    expect(s.metaCoverage.channelRatio?.metaSpend).toBeCloseTo(4839.23, 2);
    expect(s.metaCoverage.channelRatio?.multiple).toBeCloseTo(4839.23 / 4334.49, 4);
  });

  it("marks UTM coverage as insufficient and adds the correlation caveat", () => {
    const s = study();
    expect(s.utmCoverage.sufficient).toBe(false);
    expect(s.utmCoverage.coveragePct).toBeCloseTo(82 / 242, 3);
    expect(s.limits.join(" ")).toMatch(/UTM/i);
  });

  it("derives separate retail, branding and wholesale conclusions", () => {
    const s = study();
    const retail = s.conclusions.find(c => c.desk === "retail");
    expect(retail?.status).toBe("evidence_backed");
    expect(retail?.points.join(" ")).toMatch(/spend cut/i);
    expect(retail?.points.join(" ")).toMatch(/budget/i);
    const branding = s.conclusions.find(c => c.desk === "branding");
    expect(branding?.status).toBe("evidence_backed");
    expect(branding?.points.join(" ")).toMatch(/ended 2025-09/);
    expect(branding?.points.join(" ")).toMatch(/landing-page/i);
    const wholesale = s.conclusions.find(c => c.desk === "wholesale");
    expect(wholesale?.status).toBe("no_linkable_evidence");
    expect(wholesale?.points.join(" ")).toMatch(/2025-09/);
  });

  it("handles empty inputs without inventing data", () => {
    const s = buildCampaignStudy({ asOf: AS_OF, metaRows: [], googleRows: [], campaigns: [], orders: [] });
    expect(s.metaCoverage.primaryCampaign).toBeNull();
    expect(s.googleCoverage.dateRange).toBeNull();
    expect(s.spendCut.status).toBe("stable");
    expect(s.lpv.status).toBe("unverified");
    expect(s.retail.status).toBe("insufficient_data");
    expect(s.wholesale.status).toBe("insufficient_data");
    expect(s.timing.dropBeforeSpendCut).toBeNull();
    expect(s.conclusions.every(c => c.status === "insufficient_data")).toBe(true);
    expect(s.limits.length).toBeGreaterThan(0);
  });
});
