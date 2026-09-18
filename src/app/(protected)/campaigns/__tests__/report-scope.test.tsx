import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampaignsPage from "../page";
import { api } from "@/components/providers/trpc-provider";

jest.mock("@/components/providers/trpc-provider", () => ({ api: {
  campaigns: { getAll: { useQuery: jest.fn() }, getStatistics: { useQuery: jest.fn() },
    updateLiveStatus: { useMutation: jest.fn() }, scaleBudget: { useMutation: jest.fn() } },
  marketing: { getCampaignPerformance: { useQuery: jest.fn() }, getCampaignReportAccounts: { useQuery: jest.fn() }, getGoogleNetworkSplit: { useQuery: jest.fn() } },
} }));
jest.mock("@/hooks/use-active-brand", () => ({ useActiveBrand: () => ({ brands: [], brandId: "brand-1", setBrandId: jest.fn() }) }));
jest.mock("@/hooks/use-active-market", () => ({ useActiveMarket: () => ({ market: "all" }) }));
jest.mock("@/components/providers/currency", () => ({ useCurrency: () => ({ format: (v: number) => `€${v}`, formatExact: (v: number) => `€${v}`, symbol: "€" }) }));
jest.mock("@/components/campaigns/meta-operator-desk", () => ({ MetaOperatorDesk: () => null }));
jest.mock("@/components/ui/animated-counter", () => ({ AnimatedCounter: ({ target, prefix = "" }: { target: number; prefix?: string }) => <span>{prefix}{target}</span> }));
jest.mock("@/components/ui/animated-section", () => ({
  AnimatedSection: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
  StaggerContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>, fadeInUp: {},
}));
jest.mock("recharts", () => ({ ResponsiveContainer: () => null, LineChart: () => null, Line: () => null }));

const row = (platform: string, name: string, totalSpend: number) => ({
  reportRowId: `${platform}-fixture`, adAccountId: `acc-${platform}`, campaignId: "123", campaignName: name,
  currency: "EUR", metricState: "stored_metrics", platform, status: "active", totalSpend, roas: 2,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.campaigns.getStatistics.useQuery).mockReturnValue({ isLoading: false, data: { data: { totals: { campaigns: 1, active: 0, spent: 0, budget: 80 } } } } as never);
  jest.mocked(api.campaigns.getAll.useQuery).mockReturnValue({ isLoading: false, data: { data: { campaigns: [] } }, refetch: jest.fn() } as never);
  jest.mocked(api.campaigns.updateLiveStatus.useMutation).mockReturnValue({ mutate: jest.fn() } as never);
  jest.mocked(api.campaigns.scaleBudget.useMutation).mockReturnValue({ mutate: jest.fn() } as never);
  jest.mocked(api.marketing.getCampaignReportAccounts.useQuery).mockReturnValue({ data: { accounts: [{ id: "acc-google", name: "Fixture Google", accountId: "1111111111", currency: "EUR" }] } } as never);
  jest.mocked(api.marketing.getGoogleNetworkSplit.useQuery).mockReturnValue({ isLoading: false, data: { rows: [
    { adAccountId: "acc-google", campaignId: "123", networkType: "SEARCH", currency: "EUR", spend: 24, impressions: 800, clicks: 40, conversions: 1, conversionValue: 80 },
    { adAccountId: "acc-google", campaignId: "123", networkType: "DISPLAY", currency: "EUR", spend: 6, impressions: 200, clicks: 5, conversions: 0, conversionValue: 0 },
  ] } } as never);
  jest.mocked(api.marketing.getCampaignPerformance.useQuery).mockImplementation((input: unknown) => {
    const args = input as { platform?: string; startDate?: string; endDate?: string };
    const campaigns = args.platform === "google" ? [row("google", "Google fixture", 30)] : [row("meta", "Meta fixture", 10), row("google", "Google fixture", 30)];
    return { isLoading: false, refetch: jest.fn(), data: { data: { campaigns,
      totals: { campaigns: campaigns.length, active: campaigns.length, spendByCurrency: { EUR: campaigns.reduce((sum, c) => sum + c.totalSpend, 0) }, storedMetricCampaigns: campaigns.length, unverifiedCampaigns: 0 },
      coverage: "stored_only_not_provider_verified", window: { startDate: args.startDate, endDate: args.endDate }, truncated: false,
    } } } as never;
  });
});

it("sends platform and explicit dates to synced reporting and removes Meta cards when Google is selected", async () => {
  render(<CampaignsPage />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Platform" }), "google");
  expect(api.marketing.getCampaignPerformance.useQuery).toHaveBeenLastCalledWith(expect.objectContaining({
    platform: "google", startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }), expect.anything());
  expect(screen.queryByText("Meta fixture")).not.toBeInTheDocument();
  expect(screen.getByText("Google fixture")).toBeInTheDocument();
});

it("summarizes synced scope only, never falls back to local draft budget", () => {
  render(<CampaignsPage />);
  const summary = screen.getByLabelText("Synced campaign summary");
  expect(within(summary).getByText("Recorded spend")).toBeInTheDocument();
  expect(summary).toHaveTextContent("40");
  expect(summary).not.toHaveTextContent("80");
});

it("passes the selected owned report account", async () => {
  render(<CampaignsPage />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ad account" }), "acc-google");
  expect(api.marketing.getCampaignPerformance.useQuery).toHaveBeenLastCalledWith(expect.objectContaining({ adAccountId: "acc-google" }), expect.anything());
});

it("does not offer Meta edit or live write controls for Google cards", () => {
  render(<CampaignsPage />);
  const card = screen.getByText("Google fixture").closest("[data-report-row]")!;
  expect(card).not.toBeNull();
  expect(within(card).queryByRole("button", { name: /Edit on Meta|Pause|Resume|\+20%/ })).not.toBeInTheDocument();
  expect(card).toHaveTextContent("Read-only");
});

it("labels results as Meta results only on Meta rows, not on Google rows", () => {
  render(<CampaignsPage />);
  const googleCard = screen.getByText("Google fixture").closest("[data-report-row]")!;
  expect(within(googleCard).queryByText(/Meta result/)).not.toBeInTheDocument();
  expect(within(googleCard).getByTestId("result-caption")).toHaveTextContent("Conversions");
  const metaCard = screen.getByText("Meta fixture").closest("[data-report-row]")!;
  expect(within(metaCard).getByTestId("result-caption")).toHaveTextContent("Meta result · Results");
});

it("keeps Google rows free of Meta result labels in table view", async () => {
  render(<CampaignsPage />);
  await userEvent.click(screen.getByRole("button", { name: "Table view" }));
  const googleRow = screen.getByText("Google fixture").closest("tr")!;
  expect(googleRow).not.toBeNull();
  expect(within(googleRow).queryByText(/Meta result/)).not.toBeInTheDocument();
});

it("shows the Search/Display network split on Google cards only", () => {
  render(<CampaignsPage />);
  const googleCard = screen.getByText("Google fixture").closest("[data-report-row]")!;
  const split = within(googleCard).getByTestId("network-split");
  expect(split).toHaveTextContent("Search 80%");
  expect(split).toHaveTextContent("Display 20%");
  const metaCard = screen.getByText("Meta fixture").closest("[data-report-row]")!;
  expect(within(metaCard).queryByTestId("network-split")).not.toBeInTheDocument();
});

it("shows a reporting error rather than claiming empty campaigns", () => {
  jest.mocked(api.marketing.getCampaignPerformance.useQuery).mockReturnValue({ isLoading: false, error: { message: "Fixture failure" } } as never);
  render(<CampaignsPage />);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load synced campaigns");
});
