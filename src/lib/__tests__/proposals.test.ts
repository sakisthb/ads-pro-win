/** @jest-environment node */
import {
  buildCampaignStudy,
  type CampaignStudy,
  type CampaignStudyOrder,
  type CampaignStudyRow,
} from "@/lib/campaign-study";
import { buildProposals, proposalKeyOf, type CampaignProposal } from "@/lib/proposals";

const AS_OF = "2026-09-18";

function metaRow(day: string, over: Partial<CampaignStudyRow> = {}): CampaignStudyRow {
  return {
    date: day, platform: "meta", campaignId: "cmp-pur", campaignName: "Advantage+ (PUR) // General Campaign",
    spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
    linkClicks: 0, landingPageViews: 0, addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0,
    ...over,
  };
}

/** Same-day (1-16) PUR shape: normal July, cut mid-Aug, reduced Sept, LPV broken in Sept. */
function purRows(): CampaignStudyRow[] {
  const rows: CampaignStudyRow[] = [];
  for (let d = 1; d <= 16; d += 1) {
    rows.push(metaRow(`2026-07-${String(d).padStart(2, "0")}`, {
      spend: 49.57, linkClicks: 100, landingPageViews: 66, addToCart: 2,
      websitePurchases: d === 16 ? 73 : 0, websitePurchaseValue: d === 16 ? 6345 : 0,
    }));
  }
  for (let d = 1; d <= 16; d += 1) {
    if (d <= 10) rows.push(metaRow(`2026-08-${String(d).padStart(2, "0")}`, {
      spend: 54, linkClicks: 60, landingPageViews: 5, addToCart: 3,
      websitePurchases: d === 10 ? 17 : 0, websitePurchaseValue: d === 10 ? 1530 : 0,
    }));
    else rows.push(metaRow(`2026-08-${String(d).padStart(2, "0")}`, { spend: 0, addToCart: 2 }));
  }
  for (let d = 1; d <= 16; d += 1) {
    rows.push(metaRow(`2026-09-${String(d).padStart(2, "0")}`, {
      spend: 20, linkClicks: 40, landingPageViews: 3, addToCart: 30,
      websitePurchases: d === 16 ? 24 : 0, websitePurchaseValue: d === 16 ? 5280 : 0,
    }));
  }
  return rows;
}

function googleRows(): CampaignStudyRow[] {
  const mk = (day: string, campaignId: string, spend: number): CampaignStudyRow => ({
    date: day, platform: "google", campaignId, campaignName: `Google ${campaignId}`,
    spend, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0,
    linkClicks: 0, landingPageViews: 0, addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0,
  });
  return [mk("2025-10-15", "g-shopping", 1500), mk("2025-11-15", "g-search", 1500), mk("2025-12-15", "g-shopping", 1334.49)];
}

function wooOrders(market: string, counts: number[], fullSource = false): CampaignStudyOrder[] {
  const list: CampaignStudyOrder[] = [];
  const months = ["2026-07", "2026-08", "2026-09"];
  counts.forEach((count, mi) => {
    for (let i = 0; i < count; i += 1) {
      const day = String((i % 15) + 1).padStart(2, "0");
      list.push({ date: `${months[mi]}-${day}`, status: "completed", market, grossSales: 120,
        source: fullSource ? "meta" : i % 4 === 0 ? "meta" : null });
    }
  });
  return list;
}

const campaigns = [{ campaignId: "cmp-pur", name: "Advantage+ (PUR) // General Campaign", objective: "OUTCOME_SALES", status: "active" }];

function fullStudy(asOf = AS_OF): CampaignStudy {
  return buildCampaignStudy({
    asOf,
    metaRows: purRows(),
    googleRows: googleRows(),
    campaigns,
    orders: [...wooOrders("retail", [10, 4, 4]), ...wooOrders("wholesale", [10, 5, 8])],
  });
}

function byKind(proposals: CampaignProposal[], kind: CampaignProposal["kind"]): CampaignProposal[] {
  return proposals.filter(p => p.kind === kind);
}

describe("buildProposals", () => {
  it("derives no proposals from an empty study", () => {
    const study = buildCampaignStudy({ asOf: AS_OF, metaRows: [], googleRows: [], campaigns: [], orders: [] });
    expect(buildProposals(study)).toEqual([]);
  });

  it("derives no proposals when diagnostics are all stable or insufficient", () => {
    const rows: CampaignStudyRow[] = [];
    for (let d = 1; d <= 16; d += 1) {
      for (const month of ["2026-07", "2026-08", "2026-09"]) {
        rows.push(metaRow(`${month}-${String(d).padStart(2, "0")}`, {
          spend: 40, linkClicks: 80, landingPageViews: 48, addToCart: 2,
        }));
      }
    }
    const study = buildCampaignStudy({ asOf: AS_OF, metaRows: rows, googleRows: [], campaigns, orders: wooOrders("retail", [8, 8, 8], true) });
    expect(buildProposals(study)).toEqual([]);
  });

  it("gates the Meta spend review behind the audited write desk (ADR 0002) and never writes by itself", () => {
    const proposals = buildProposals(fullStudy());
    const spend = byKind(proposals, "meta_spend_review");
    expect(spend).toHaveLength(1);
    expect(spend[0].desk).toBe("retail");
    expect(spend[0].rationale.join(" ")).toContain("Sharp spend cut");
    expect(spend[0].execution).toContain("ADR 0002");
    expect(spend[0].execution).toContain("metaWriteLog");
    expect(spend[0].execution.toLowerCase()).toContain("never writes");
  });

  it("proposes an LPV/tracking repair when the click→LPV signal is broken", () => {
    const proposals = buildProposals(fullStudy());
    const tracking = byKind(proposals, "tracking_check").filter(p => p.title.includes("LPV"));
    expect(tracking).toHaveLength(1);
    expect(tracking[0].desk).toBe("retail");
    expect(tracking[0].rationale.join(" ")).toContain("LPV is unreliable");
    expect(tracking[0].execution).toContain("No provider write");
  });

  it("proposes UTM/source coverage repair when order attribution is thin", () => {
    const proposals = buildProposals(fullStudy());
    const utm = byKind(proposals, "tracking_check").filter(p => p.title.includes("UTM"));
    expect(utm).toHaveLength(1);
    expect(utm[0].rationale.join(" ")).toMatch(/orders carry a source/);
    expect(utm[0].execution).toContain("No provider write");
  });

  it("keeps Google proposals as read-only planning notes (ADR 0003)", () => {
    const proposals = buildProposals(fullStudy());
    const google = byKind(proposals, "google_planning_note");
    expect(google).toHaveLength(1);
    expect(google[0].desk).toBe("branding");
    expect(google[0].rationale.join(" ")).toContain("seasonal bursts only");
    expect(google[0].execution).toContain("ADR 0003");
    expect(google[0].execution).toContain("read-only");
  });

  it("derives an order-trend follow-up per desk with a dip or sustained decline", () => {
    const proposals = buildProposals(fullStudy());
    const followUps = byKind(proposals, "order_ops_review");
    expect(followUps.map(p => p.desk).sort()).toEqual(["retail", "wholesale"]);
    const retail = followUps.find(p => p.desk === "retail");
    expect(retail?.title).toContain("ΛΙΑΝΙΚΗ");
    expect(retail?.rationale.join(" ")).toContain("sustained decline");
    expect(retail?.execution).toContain("No ad-platform write");
    const wholesale = followUps.find(p => p.desk === "wholesale");
    expect(wholesale?.title).toContain("χονδρική");
    expect(wholesale?.rationale.join(" ")).toMatch(/dipped/);
  });

  it("skips the wholesale follow-up when the wholesale trend recovered", () => {
    const study = buildCampaignStudy({
      asOf: AS_OF,
      metaRows: purRows(),
      googleRows: [],
      campaigns,
      orders: wooOrders("retail", [10, 4, 4]),
    });
    const followUps = byKind(buildProposals(study), "order_ops_review");
    expect(followUps.map(p => p.desk)).toEqual(["retail"]);
  });

  it("carries study limits into every proposal's uncertainty", () => {
    const study = fullStudy();
    const proposals = buildProposals(study);
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      expect(proposal.uncertainty.length).toBeGreaterThan(0);
      for (const limit of study.limits) {
        expect(proposal.uncertainty).toContain(limit);
      }
    }
  });

  it("produces stable keys across as-of dates and repeated derivations", () => {
    const a = buildProposals(fullStudy("2026-09-18"));
    const b = buildProposals(fullStudy("2026-09-19"));
    expect(a.map(p => p.key)).toEqual(b.map(p => p.key));
    expect(buildProposals(fullStudy("2026-09-18"))).toEqual(a);
  });

  it("keys are deterministic and stable for the same desk, kind and title", () => {
    expect(proposalKeyOf("retail", "meta_spend_review", "Some title")).toBe(proposalKeyOf("retail", "meta_spend_review", "Some title"));
    expect(proposalKeyOf("retail", "meta_spend_review", "Some title")).not.toBe(proposalKeyOf("retail", "meta_spend_review", "Other title"));
    expect(proposalKeyOf("retail", "meta_spend_review", "Some title")).toMatch(/^p_[a-f0-9]{8}$/);
  });
});
