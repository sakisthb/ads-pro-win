import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingClient from "../onboarding-client";
import { api } from "@/components/providers/trpc-provider";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/font/google", () => ({ Syne: () => ({ className: "fixture-font" }) }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/hooks/use-active-org", () => ({ useActiveOrg: () => ({ isDemo: false, isLoading: false, org: { name: "Fixture workspace" } }) }));
jest.mock("@/components/providers/currency", () => ({ useCurrency: () => ({ format: (n: number) => `EUR ${n}` }) }));
jest.mock("@/components/providers/trpc-provider", () => ({ api: {
  onboarding: { getStatus: { useQuery: jest.fn() }, getQuickAudit: { useQuery: jest.fn() }, saveContext: { useMutation: jest.fn() }, complete: { useMutation: jest.fn() } },
  brands: { create: { useMutation: jest.fn() } },
} }));

const owned = { objective: "sales", targetResult: "Owned brand input", priorities: "Owned priorities", constraints: "", seasonality: "", notes: "" };
const legacy = { ...owned, targetResult: "OTHER BRAND LEGACY", priorities: "Other priorities" };
const save = jest.fn(), complete = jest.fn(), refetch = jest.fn();
let finish: () => void;
beforeEach(() => {
  jest.clearAllMocks(); window.sessionStorage.clear(); window.localStorage.clear();
  window.history.replaceState(null, "", "/onboarding?brand=brand-1");
  jest.mocked(api.onboarding.getStatus.useQuery).mockReturnValue({ isLoading: false, data: {
    brands: [{ id: "brand-1", name: "Fixture One", connectedCount: 1, contextComplete: true },
      { id: "brand-2", name: "Fixture Two", connectedCount: 0, contextComplete: false }],
    brandContexts: { "brand-1": owned }, context: legacy, contextComplete: true, hasPerformance: true,
    connections: [{ id: "account-1", platform: "google", name: "Fixture Google", brandId: "brand-1", isConnected: true }],
  }, refetch } as never);
  jest.mocked(api.onboarding.getQuickAudit.useQuery).mockReturnValue({ data: { audit: { summary: "No emergency spend", items: [] } }, refetch } as never);
  jest.mocked(api.onboarding.saveContext.useMutation).mockReturnValue({ mutate: save, isPending: false } as never);
  jest.mocked(api.onboarding.complete.useMutation).mockImplementation(options => {
    finish = (options as unknown as { onSuccess: () => void }).onSuccess;
    return { mutate: complete, isPending: false } as never;
  });
  jest.mocked(api.brands.create.useMutation).mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
});
async function contextStep() {
  await userEvent.click(screen.getByRole("button", { name: "Start first session" }));
  await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
}
it("clears stale fields rather than copying the organization legacy context after a brand switch", async () => {
  render(<OnboardingClient />); await contextStep();
  const target = screen.getByPlaceholderText(/Target result/);
  expect(target).toHaveValue("Owned brand input");
  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  await userEvent.click(screen.getByRole("button", { name: "Fixture Two" }));
  await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
  expect(screen.getByPlaceholderText(/Target result/)).toHaveValue("");
  expect(screen.getByPlaceholderText(/Priorities/)).toHaveValue("");
  expect(save).not.toHaveBeenCalled();
});
it("routes first audit to the shared scoped desk without a quick-audit read, save or bulk Sync", async () => {
  render(<OnboardingClient />); await contextStep();
  await userEvent.click(screen.getByRole("button", { name: "Review audit readiness without saving" }));
  expect(screen.getByRole("link", { name: "Open Performance Marketing Desk" })).toHaveAttribute("href", "/account-audit?brand=brand-1");
  expect(screen.getByText(/Legacy Quick Audit is retired/)).toBeInTheDocument();
  expect(screen.queryByText(/No emergency spend/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  expect(api.onboarding.getQuickAudit.useQuery).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
});
it("does not certify account action readiness after the setup-completion callback", async () => {
  render(<OnboardingClient />); await contextStep();
  await userEvent.click(screen.getByRole("button", { name: "Review audit readiness without saving" }));
  await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));
  act(() => finish());
  expect(screen.getByRole("heading", { name: "Setup completed — not campaign action readiness" })).toBeInTheDocument();
  expect(screen.queryByText(/Automation pushes a paused structure/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Reconnect Meta.*creating campaigns/)).not.toBeInTheDocument();
});
