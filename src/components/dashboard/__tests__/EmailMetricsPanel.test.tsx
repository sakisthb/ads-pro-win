import { render, screen } from "@testing-library/react";
import { EmailMetricsPanel } from "@/components/dashboard/EmailMetricsPanel";
jest.mock("@/components/providers/trpc-provider", () => ({ api: { emailCampaigns: { getEmailMetrics: { useQuery: jest.fn(() => ({ isLoading: false, isError: false, data: { data: { connected: true, dailyData: [], lastSyncAt: "2026-09-03T07:00:00Z" } } })) } } } }));

it.each(["failed", "stale", "unknown", "syncing"] as const)("shows %s email sync as unverified, not quiet zero delivery", (syncState) => {
  render(<EmailMetricsPanel startDate="2026-08-17" endDate="2026-09-16" syncState={syncState} />);
  expect(screen.getByText(/Email sync.*unverified/i)).toBeInTheDocument();
  expect(screen.queryByText(/wrote 0 sent campaigns|Widen the date range/)).not.toBeInTheDocument();
});

it("labels an empty stored window without claiming the sync covered that date range", () => {
  render(<EmailMetricsPanel startDate="2026-08-17" endDate="2026-09-16" syncState="ready" />);
  expect(screen.getByText(/No stored email campaign rows/i)).toBeInTheDocument();
  expect(screen.queryByText(/wrote 0 sent campaigns/)).not.toBeInTheDocument();
});
