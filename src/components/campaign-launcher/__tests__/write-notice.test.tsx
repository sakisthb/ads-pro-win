import { render, screen } from "@testing-library/react";
import { CampaignLauncherStudio } from "../studio";

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("mode=launch") }));
jest.mock("@/hooks/use-active-org", () => ({ useActiveOrg: () => ({ isDemo: false, isLoading: false }) }));
jest.mock("@/components/providers/currency", () => ({ useCurrency: () => ({ format: (v: number) => `€${v}`, symbol: "€" }) }));
jest.mock("@/components/providers/trpc-provider", () => ({ api: {
  campaigns: {
    getLaunchContext: { useQuery: () => ({ data: { brands: [], products: [], drafts: [], connections: [
      { id: "fixture-google", platform: "google", isConnected: true, canWrite: false, name: "Fixture Google" },
    ] }, refetch: jest.fn() }) },
    getMetaAssets: { useQuery: () => ({}) },
    generatePlan: { useMutation: () => ({}) }, launch: { useMutation: () => ({}) },
    updateLiveStatus: { useMutation: () => ({}) }, scaleBudget: { useMutation: () => ({}) },
  }, marketing: { getCampaignPerformance: { useQuery: () => ({}) } },
} }));

it("explains planning-only creation lock without asking read-only Google to reconnect", () => {
  render(<CampaignLauncherStudio />);
  expect(screen.getByText(/Planning only/)).toBeInTheDocument();
  expect(screen.getByText("Read-only")).toBeInTheDocument();
  expect(screen.queryByText("Reconnect to write")).not.toBeInTheDocument();
});
