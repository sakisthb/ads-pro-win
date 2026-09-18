import { render, screen, within } from "@testing-library/react";
import { CampaignStudyDesk } from "../campaign-study-desk";
import { api } from "@/components/providers/trpc-provider";
import { buildCampaignStudy, type CampaignStudy } from "@/lib/campaign-study";

jest.mock("@/components/providers/trpc-provider", () => ({ api: { campaignStudy: { get: { useQuery: jest.fn() } } } }));

const row = (date: string, over: Record<string, number> = {}) => ({ date, platform: "meta" as const, campaignId: "cmp-pur",
  campaignName: "PUR · ΛΙΑΝΙΚΗ Sales", spend: 40, impressions: 4000, clicks: 160, conversions: 0, conversionValue: 0,
  linkClicks: 80, landingPageViews: 60, addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0, ...over });
const day = (month: string, d: number) => `2026-${month}-${String(d).padStart(2, "0")}`;

function derivedStudy(): CampaignStudy {
  const metaRows = [
    ...Array.from({ length: 16 }, (_, i) => row(day("07", i + 1))),
    ...Array.from({ length: 16 }, (_, i) => row(day("08", i + 1))),
    ...Array.from({ length: 16 }, (_, i) => row(day("09", i + 1), { spend: 20, linkClicks: 40, landingPageViews: 4, addToCart: 30,
      websitePurchases: i === 15 ? 24 : 0, websitePurchaseValue: i === 15 ? 5280 : 0 })),
  ];
  const order = (month: string, market: string, count: number) => Array.from({ length: count }, () => ({
    date: `2026-${month}-10`, status: "completed", market, grossSales: 120, source: null as string | null }));
  return buildCampaignStudy({ asOf: "2026-09-18", metaRows,
    googleRows: [{ date: "2025-12-15", platform: "google", campaignId: "g-shopping", campaignName: "Shopping",
      spend: 1334.49, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, linkClicks: 0, landingPageViews: 0,
      addToCart: 0, websitePurchases: 0, websitePurchaseValue: 0 }],
    campaigns: [{ campaignId: "cmp-pur", name: "PUR · ΛΙΑΝΙΚΗ Sales", objective: "OUTCOME_SALES", status: "active" }],
    orders: [...order("07", "retail", 10), ...order("08", "retail", 4), ...order("09", "retail", 4),
      ...order("07", "wholesale", 10), ...order("08", "wholesale", 8), ...order("09", "wholesale", 9)] });
}

const query = (data?: CampaignStudy, error?: Error) =>
  jest.mocked(api.campaignStudy.get.useQuery).mockReturnValue({ data, isLoading: !data && !error, error: error ?? null } as never);

describe("CampaignStudyDesk", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders same-day windows, the PUR funnel and the spend-cut / LPV diagnostics", () => {
    const study = derivedStudy();
    query(study);
    render(<CampaignStudyDesk brandId="fixture-brand" />);
    expect(screen.getByRole("heading", { name: "Campaign study" })).toBeInTheDocument();
    for (const label of ["2026-07", "2026-08", "2026-09"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    const funnel = screen.getByRole("table", { name: "Primary Meta purchase funnel by same-day window" });
    expect(within(funnel).getAllByRole("row")).toHaveLength(4); // header + 3 windows
    expect(screen.getAllByText(study.spendCut.summary).length).toBeGreaterThan(0);
    expect(screen.getAllByText(study.lpv.summary).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: `Primary Meta purchase campaign: ${study.metaCoverage.primaryCampaign!.name}` })).toBeInTheDocument();
  });

  it("renders separate Retail, Branding and Wholesale conclusions with their evidence status", () => {
    const study = derivedStudy();
    query(study);
    render(<CampaignStudyDesk brandId="fixture-brand" />);
    const retail = study.conclusions.find(c => c.desk === "retail")!;
    expect(screen.getByRole("heading", { name: "Retail · ΛΙΑΝΙΚΗ" })).toBeInTheDocument();
    expect(screen.getByText(retail.title)).toBeInTheDocument();
    for (const point of retail.points) expect(screen.getAllByText(point).length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence-backed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branding / demand" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wholesale · χονδρική" })).toBeInTheDocument();
  });

  it("renders Woo desk trends, Google coverage and the limits of the stored evidence", () => {
    const study = derivedStudy();
    query(study);
    render(<CampaignStudyDesk brandId="fixture-brand" />);
    expect(screen.getAllByText(study.retail.summary).length).toBeGreaterThan(0);
    expect(screen.getAllByText(study.wholesale.summary).length).toBeGreaterThan(0);
    expect(screen.getAllByText(study.googleCoverage.summary).length).toBeGreaterThan(0);
    for (const limit of study.limits) expect(screen.getAllByText(limit).length).toBeGreaterThan(0);
  });

  it("stays explicit while loading and withholds everything on error", () => {
    query();
    const { unmount } = render(<CampaignStudyDesk brandId="fixture-brand" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    unmount();
    query(undefined, new Error("Fixture study unavailable"));
    render(<CampaignStudyDesk brandId="fixture-brand" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Campaign study unavailable");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the explicit insufficient-data state instead of invented numbers", () => {
    query(buildCampaignStudy({ asOf: "2026-09-18", metaRows: [], googleRows: [], campaigns: [], orders: [] }));
    render(<CampaignStudyDesk brandId="fixture-brand" />);
    expect(screen.getByText("Insufficient stored data — windows shown with Unverified values, conclusions stay insufficient_data.")).toBeInTheDocument();
    expect(screen.queryByText("Evidence-backed")).not.toBeInTheDocument();
  });
});
