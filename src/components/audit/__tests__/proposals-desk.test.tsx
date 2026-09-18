import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalsDesk } from "../proposals-desk";
import { api } from "@/components/providers/trpc-provider";
import { buildCampaignStudy, type CampaignStudy } from "@/lib/campaign-study";
import { buildProposals } from "@/lib/proposals";
import type { ProposalDecisionRecord } from "@/lib/proposals-store";

jest.mock("@/components/providers/trpc-provider", () => ({
  api: {
    campaignStudy: { get: { useQuery: jest.fn() } },
    proposals: { decisions: { useQuery: jest.fn() }, decide: { useMutation: jest.fn() } },
    organizations: { list: { useQuery: jest.fn() } },
    useUtils: jest.fn(() => ({ proposals: { decisions: { invalidate: jest.fn() } } })),
  },
}));

const invalidate = jest.fn();
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

function decisionRecord(proposalKey: string, decision: "approved" | "rejected", note: string | null = null): ProposalDecisionRecord {
  return { id: `record-${proposalKey}`, decision: {
    schemaVersion: 1, kind: "operator_proposal_decision", proposalKey, brandId: "fixture-brand",
    decision, note, decidedBy: "fixture-user", decidedAt: "2026-09-18T12:00:00.000Z",
    contentHash: "ab".repeat(32),
  } };
}

const studyQuery = (data?: CampaignStudy, error?: Error) =>
  jest.mocked(api.campaignStudy.get.useQuery).mockReturnValue({ data, isLoading: !data && !error, error: error ?? null } as never);
const decisionsQuery = (data: ProposalDecisionRecord[] = [], error?: Error) =>
  jest.mocked(api.proposals.decisions.useQuery).mockReturnValue({ data, isLoading: false, error: error ?? null } as never);
const orgsQuery = (role: string) =>
  jest.mocked(api.organizations.list.useQuery).mockReturnValue({ data: [{ id: "org-1", name: "Fixture Org", isActive: true, role }],
    isLoading: false, error: null } as never);

describe("ProposalsDesk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidate.mockClear();
    jest.mocked(api.useUtils).mockReturnValue({ proposals: { decisions: { invalidate } } } as never);
    studyQuery(derivedStudy());
    decisionsQuery();
    orgsQuery("admin");
    jest.mocked(api.proposals.decide.useMutation).mockReturnValue({ mutate: jest.fn(), isPending: false, error: null } as never);
  });

  it("renders study-derived proposals with rationale, uncertainty and the execution gate", () => {
    render(<ProposalsDesk brandId="fixture-brand" />);
    expect(screen.getByRole("heading", { name: "Proposals" })).toBeInTheDocument();
    const proposals = buildProposals(derivedStudy());
    for (const proposal of proposals) {
      const card = screen.getByRole("article", { name: `Proposal ${proposal.title}` });
      expect(card).toBeInTheDocument();
      for (const part of proposal.rationale) expect(within(card).getByText(part)).toBeInTheDocument();
      expect(within(card).getByText(proposal.execution)).toBeInTheDocument();
      expect(within(card).getByText("Pending decision")).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Approve" })).toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Reject" })).toBeInTheDocument();
    }
    const spend = proposals.find(p => p.kind === "meta_spend_review")!;
    const spendCard = screen.getByRole("article", { name: `Proposal ${spend.title}` });
    expect(spendCard).toHaveTextContent("ADR 0002");
    const google = proposals.find(p => p.kind === "google_planning_note")!;
    expect(screen.getByRole("article", { name: `Proposal ${google.title}` })).toHaveTextContent("ADR 0003");
  });

  it("shows uncertainty limits inside the card details", () => {
    render(<ProposalsDesk brandId="fixture-brand" />);
    const study = derivedStudy();
    const first = buildProposals(study)[0];
    const card = screen.getByRole("article", { name: `Proposal ${first.title}` });
    for (const limit of study.limits) expect(within(card).getByText(limit)).toBeInTheDocument();
  });

  it("shows the stored decision instead of the action buttons for a decided proposal", () => {
    const proposals = buildProposals(derivedStudy());
    const decided = proposals[0];
    decisionsQuery([decisionRecord(decided.key, "approved", "go ahead via meta desk")]);
    render(<ProposalsDesk brandId="fixture-brand" />);
    const card = screen.getByRole("article", { name: `Proposal ${decided.title}` });
    expect(within(card).getByText("Approved")).toBeInTheDocument();
    expect(within(card).getByText(/go ahead via meta desk/)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    const pending = proposals.find(p => p.key !== decided.key)!;
    const pendingCard = screen.getByRole("article", { name: `Proposal ${pending.title}` });
    expect(within(pendingCard).getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("records a decision with the optional note and refreshes the decision list", async () => {
    const mutate = jest.fn();
    jest.mocked(api.proposals.decide.useMutation).mockReturnValue({ mutate, isPending: false, error: null } as never);
    const user = userEvent.setup();
    render(<ProposalsDesk brandId="fixture-brand" />);
    const proposals = buildProposals(derivedStudy());
    const target = proposals[0];
    const card = screen.getByRole("article", { name: `Proposal ${target.title}` });
    await user.type(within(card).getByLabelText("Decision note"), "operator approved");
    await user.click(within(card).getByRole("button", { name: "Approve" }));
    expect(mutate).toHaveBeenCalledWith({ brandId: "fixture-brand", proposalKey: target.key, decision: "approved", note: "operator approved" });
    const onSuccess = jest.mocked(api.proposals.decide.useMutation).mock.calls[0][0].onSuccess as () => Promise<void>;
    await onSuccess();
    expect(invalidate).toHaveBeenCalledWith({ brandId: "fixture-brand" });
  });

  it("hides the action buttons for non-admin roles while keeping decisions visible", () => {
    orgsQuery("member");
    render(<ProposalsDesk brandId="fixture-brand" />);
    const first = buildProposals(derivedStudy())[0];
    const card = screen.getByRole("article", { name: `Proposal ${first.title}` });
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    expect(within(card).getByText("Awaiting an organization admin decision.")).toBeInTheDocument();
  });

  it("renders proposals with a warning when saved decisions are unavailable", () => {
    decisionsQuery([], new Error("Fixture decisions unavailable"));
    render(<ProposalsDesk brandId="fixture-brand" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Saved decisions unavailable");
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });

  it("stays explicit while loading and withholds everything on study error", () => {
    studyQuery();
    const { unmount } = render(<ProposalsDesk brandId="fixture-brand" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading study-derived proposals");
    unmount();
    studyQuery(undefined, new Error("Fixture study unavailable"));
    render(<ProposalsDesk brandId="fixture-brand" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Proposals unavailable");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("shows the explicit empty state when the study derives no proposals", () => {
    studyQuery(buildCampaignStudy({ asOf: "2026-09-18", metaRows: [], googleRows: [], campaigns: [], orders: [] }));
    render(<ProposalsDesk brandId="fixture-brand" />);
    expect(screen.getByText("No proposals derived from the current study — every diagnostic is stable or has insufficient stored data.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
