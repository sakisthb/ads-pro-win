import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleResearchDesk } from "../google-research-desk";
import { api } from "@/components/providers/trpc-provider";

jest.mock("@/components/providers/trpc-provider", () => ({ api: { googleResearch: {
  history: { useQuery: jest.fn() }, save: { useMutation: jest.fn() }, review: { useMutation: jest.fn() },
} } }));
const props = { brandId: "fixture-brand", adAccountId: "fixture-account", market: "all" as const, goal: "sales" as const,
  window: { startDate: "2026-08-18", endDate: "2026-09-16" }, comparison: { mode: "previous" as const } };
const snapshot = { id: "fixture-snapshot", snapshot: { schemaVersion: 1, engine: "stored_rules_v1", createdBy: "fixture-user", createdAt: "2026-09-17T12:00:00Z",
  scope: { ...props, platform: "google", brandName: "Fixture shop", accountName: "Fixture Google", providerAccountId: "1111111111", baselineWindow: { startDate: "2026-07-19", endDate: "2026-08-17" } },
  verdict: "blocked", reportMarkdown: "# Fixture frozen evidence\nUnverified coverage", contentHash: "a".repeat(64), revision: 0, reviewStatus: "pending", reviews: [], executionAllowed: false,
  proposals: [{ id: "fixture-proposal", kind: "measurement", title: "Verify coverage", reason: "No campaign decision without evidence", evidence: "Missing metrics",
    nextCheck: "Reconcile exact account", successCriteria: "Verified coverage receipt", risk: "Lag and tracking", confidence: "observed", expectedEffect: "Not a ROAS forecast", executionAllowed: false }] } };
const save = jest.fn(), review = jest.fn(), refetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); save.mockResolvedValue(snapshot); refetch.mockResolvedValue({});
  review.mockResolvedValue({ ...snapshot, snapshot: { ...snapshot.snapshot, revision: 1, reviewStatus: "accepted_research", reviews: [{ actorId: "fixture-user", at: "2026-09-17T12:01:00Z", revision: 1, decision: "accepted_research", note: "Research first" }] } });
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({ data: [], isLoading: false, refetch } as never);
  jest.mocked(api.googleResearch.save.useMutation).mockReturnValue({ mutateAsync: save, isPending: false } as never);
  jest.mocked(api.googleResearch.review.useMutation).mockReturnValue({ mutateAsync: review, isPending: false } as never);
});
it("requires explicit acknowledgment and saves only owned scope, never client performance values", async () => {
  render(<GoogleResearchDesk {...props} />);
  const button = screen.getByRole("button", { name: "Generate & save Google research" });
  expect(button).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: /Save research only/ }));
  await userEvent.click(button);
  expect(save).toHaveBeenCalledWith({ ...props, acknowledgeResearchOnly: true });
  expect(await screen.findByRole("heading", { name: "Verify coverage" })).toBeInTheDocument();
  expect(screen.getByText("No campaign decision without evidence")).toBeInTheDocument();
  expect(screen.getByText("Verified coverage receipt")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Execute Google changes" })).toBeDisabled();
});
it("accepts research explicitly, records the server review, and still cannot execute ads", async () => {
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({ data: [snapshot], isLoading: false, refetch } as never);
  render(<GoogleResearchDesk {...props} />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Saved Google research" }), snapshot.id);
  expect(screen.getByRole("button", { name: "Accept research plan" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Review note / requested changes"), "Research first");
  await userEvent.click(screen.getByRole("checkbox", { name: /This review does not authorize/ }));
  await userEvent.click(screen.getByRole("button", { name: "Accept research plan" }));
  expect(review).toHaveBeenCalledWith({ brandId: props.brandId, adAccountId: props.adAccountId, id: snapshot.id, revision: 0,
    decision: "accepted_research", note: "Research first", confirmResearchOnly: true });
  expect(await screen.findByText(/accepted_research.*Research first/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Execute Google changes" })).toBeDisabled();
});
it("requires a change reason and labels saved historical scope distinctly from the current selection", async () => {
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({ data: [snapshot], isLoading: false, refetch } as never);
  render(<GoogleResearchDesk {...props} goal="wholesale" />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Saved Google research" }), snapshot.id);
  expect(screen.getByText(/Saved scope differs from current controls/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox", { name: /This review does not authorize/ }));
  expect(screen.getByRole("button", { name: "Request revised research" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Review note / requested changes"), { target: { value: "Wholesale separately" } });
  expect(screen.getByRole("button", { name: "Request revised research" })).toBeEnabled();
});
it("shows save failure without invented history or optimistic plan acceptance", async () => {
  save.mockRejectedValue(new Error("Fixture save failed"));
  render(<GoogleResearchDesk {...props} />);
  await userEvent.click(screen.getByRole("checkbox", { name: /Save research only/ }));
  await userEvent.click(screen.getByRole("button", { name: "Generate & save Google research" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Fixture save failed");
  expect(screen.queryByRole("heading", { name: "Verify coverage" })).not.toBeInTheDocument();
});
it("keeps history read errors explicit and withholds research controls while busy", () => {
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({ isLoading: false, error: new Error("Fixture history unavailable"), refetch } as never);
  render(<GoogleResearchDesk {...props} />);
  expect(within(screen.getByRole("region", { name: "Google research & review" })).getByRole("alert")).toHaveTextContent("Saved research history unavailable");
});
it("withholds stale foreign-account history rather than displaying another account's saved report",()=>{
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({data:[{...snapshot,snapshot:{...snapshot.snapshot,scope:{...snapshot.snapshot.scope,adAccountId:"other-account"}}}],isLoading:false,refetch} as never);
  render(<GoogleResearchDesk {...props}/>);
  expect(screen.getByRole("combobox",{name:"Saved Google research"})).not.toHaveTextContent("2026-09-17T12:00:00Z");
});
it("prevents repeated saves and reviews while a mutation is pending",()=>{
  jest.mocked(api.googleResearch.save.useMutation).mockReturnValue({mutateAsync:save,isPending:true} as never);
  render(<GoogleResearchDesk {...props}/>);
  expect(screen.getByRole("checkbox",{name:/Save research only/})).toBeDisabled();
  expect(screen.getByRole("button",{name:"Generate & save Google research"})).toBeDisabled();
  expect(screen.getByRole("combobox",{name:"Saved Google research"})).toBeDisabled();
});
