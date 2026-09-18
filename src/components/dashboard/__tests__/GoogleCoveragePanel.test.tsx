import { render, screen } from "@testing-library/react";
jest.mock("@/lib/trpc/react", () => ({ api: { syncStatus: { getGoogleCoverage: { useQuery: jest.fn() } } } }));
import { api } from "@/lib/trpc/react";
import { GoogleCoveragePanel } from "@/components/connections/GoogleCoveragePanel";
const query = jest.mocked(api.syncStatus.getGoogleCoverage.useQuery);
const receipt = { providerApiVersion: "v25", transport: "google_ads_search_stream", syncJobId: "job-1", version: 1, customerId: "1234567890", loginCustomerId: "9876543210", executionPath: "manual", queryScope: "non_removed_campaigns", startDate: "2026-08-17", endDate: "2026-09-16", providerTimezone: "Europe/Athens", providerCurrency: "EUR", status: "completed", stage: "completed", metricRowsFetched: 0, campaignRowsFetched: 27, metricRowsPersisted: 0, campaignRowsPersisted: 27, storageMayBePartial: false, startedAt: new Date("2026-09-17T09:00:00Z"), completedAt: new Date("2026-09-17T09:00:01Z") };
const load = (data: unknown, overrides = {}) => query.mockReturnValue({ data, isLoading: false, isError: false, ...overrides } as never);
beforeEach(() => jest.clearAllMocks());
it("shows migration-required coverage as unavailable, never verified zero", () => {
  load({ availability: "migration_required", jobs: [] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByRole("status")).toHaveTextContent(/migration.*not applied/i);
  expect(screen.queryByText("Completed scoped run")).not.toBeInTheDocument();
});
it("qualifies legacy completed runs without retrospective coverage claims", () => {
  load({ availability: "available", jobs: [{ id: "legacy", status: "completed", coverageReceipt: null }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText(/Legacy success does not verify/i)).toBeInTheDocument();
});
it("shows exact provider window, separate counts and narrow scoped-zero qualification", () => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "completed", coverageReceipt: receipt }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText("Completed scoped run")).toBeInTheDocument();
  expect(screen.getByText(/2026-08-17.*2026-09-16/)).toHaveTextContent("Europe/Athens");
  expect(screen.getByText(/Metrics: 0 fetched.*0 persisted/)).toBeInTheDocument();
  expect(screen.getByText(/Campaigns: 27 fetched.*27 persisted/)).toBeInTheDocument();
  expect(screen.getByText(/not.*all account activity/i)).toBeInTheDocument();
  expect(screen.getByText(/Empty results do not clear old stored rows/i)).toBeInTheDocument();
});
it("shows partial unknown persistence as unknown rather than zero", () => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "failed", coverageReceipt: { ...receipt, status: "partial", storageMayBePartial: true, metricRowsPersisted: null } }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText(/Metrics: 0 fetched.*unknown persisted/)).toBeInTheDocument();
  expect(screen.getByText(/Storage may be partial/i)).toBeInTheDocument();
  expect(screen.queryByText("Completed scoped run")).not.toBeInTheDocument();
});
it("recognizes the wider historical scope without reclassifying older receipts", () => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "completed", coverageReceipt: { ...receipt, queryScope: "enabled_paused_removed_campaigns", campaignRowsFetched: 40, campaignRowsPersisted: 40 } }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText("Completed scoped run")).toBeInTheDocument();
  expect(screen.getByText(/Campaign scope: ENABLED, PAUSED and REMOVED/i)).toBeInTheDocument();
  expect(screen.getByText(/0 metric rows.*ENABLED, PAUSED and REMOVED/i)).toBeInTheDocument();
  expect(screen.queryByText(/Removed campaigns are excluded/i)).not.toBeInTheDocument();
});
it("keeps earlier non-removed receipts explicitly narrower than historical coverage", () => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "completed", coverageReceipt: receipt }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText(/Campaign scope: non-removed only.*not complete historical campaign coverage/i)).toBeInTheDocument();
});
it("does not trust a completed receipt with an unknown query scope", () => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "completed", coverageReceipt: { ...receipt, queryScope: "unknown_scope" } }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByText("Unverified run")).toBeInTheDocument();
});
it.each([{ status: "failed" }, { status: "running" }])("does not trust inconsistent job / completed receipt state %j", (job) => {
  load({ availability: "available", jobs: [{ id: "job-1", ...job, coverageReceipt: receipt }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.queryByText("Completed scoped run")).not.toBeInTheDocument();
});
it("does not turn query errors into empty reporting", () => {
  load(undefined, { isError: true });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.getByRole("status")).toHaveTextContent(/could not be loaded/i);
});

it.each([{ version: 2 }, { completedAt: null }, { metricRowsFetched: null }])("does not verify incomplete or unsupported receipt evidence %j", (override) => {
  load({ availability: "available", jobs: [{ id: "job-1", status: "completed", coverageReceipt: { ...receipt, ...override } }] });
  render(<GoogleCoveragePanel adAccountId="acc-1" />);
  expect(screen.queryByText("Completed scoped run")).not.toBeInTheDocument();
});
