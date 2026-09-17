import { render, screen } from "@testing-library/react";
import { OnboardingBanner } from "../onboarding-banner";
import { api } from "@/components/providers/trpc-provider";

jest.mock("@/hooks/use-active-org", () => ({ useActiveOrg: () => ({ isDemo: false }) }));
jest.mock("@/components/providers/trpc-provider", () => ({ api: { onboarding: { getStatus: { useQuery: jest.fn() } } } }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
beforeEach(() => { jest.clearAllMocks(); window.sessionStorage.clear(); });

it("does not prompt completed setup merely because account actions are unavailable", () => {
  jest.mocked(api.onboarding.getStatus.useQuery).mockReturnValue({ data: { onboardingCompleted: false, setupReady: true, ready: false } } as never);
  render(<OnboardingBanner />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("prompts setup without claiming loaded performance or action readiness", () => {
  jest.mocked(api.onboarding.getStatus.useQuery).mockReturnValue({ data: { onboardingCompleted: false, setupReady: false, ready: false } } as never);
  render(<OnboardingBanner />);
  expect(screen.getByRole("link")).toHaveTextContent("Finish first-session setup — select a shop, review connections and context");
  expect(screen.getByRole("link")).not.toHaveTextContent("load performance");
});
