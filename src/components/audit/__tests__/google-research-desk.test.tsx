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
it('retains a complete operator study only after a separate source acknowledgment, without client metrics or execution permission', async () => {
  render(<GoogleResearchDesk {...props} providerAccountId='1111111111' />);
  fireEvent.change(screen.getByLabelText('Operator study Markdown'), { target: { value: '# Historical periods\nOwn research and hypotheses.' } });
  fireEvent.change(screen.getByLabelText('Study title'), { target: { value: 'Original strategic study' } });
  fireEvent.change(screen.getByLabelText('Study observed at (ISO UTC)'), { target: { value: '2026-09-17T11:00:00.000Z' } });
  fireEvent.change(screen.getByLabelText('Study source URLs (one HTTPS URL per line)'), { target: { value: 'https://support.google.com/google-ads/answer/16260130?hl=en' } });
  await userEvent.click(screen.getByRole('checkbox', { name: /Save research only/ }));
  expect(screen.getByRole('button', { name: 'Generate & save Google research' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: /Include this operator study as research/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Generate & save Google research' }));
  expect(save).toHaveBeenCalledWith({ ...props, acknowledgeResearchOnly: true, operatorStudy: {
    customerId: '1111111111', title: 'Original strategic study', observedAt: '2026-09-17T11:00:00.000Z',
    markdown: '# Historical periods\nOwn research and hypotheses.', sourceUrls: ['https://support.google.com/google-ads/answer/16260130?hl=en'], confirmOperatorSource: true,
  } });
  expect(screen.getByLabelText('Operator study Markdown')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Execute Google changes' })).toBeDisabled();
});
it('clears unsaved operator studies and acknowledgment on account scope changes', async () => {
  const { rerender } = render(<GoogleResearchDesk {...props} providerAccountId='1111111111' />);
  fireEvent.change(screen.getByLabelText('Operator study Markdown'), { target: { value: 'First account only' } });
  await userEvent.click(screen.getByRole('checkbox', { name: /Include this operator study as research/ }));
  rerender(<GoogleResearchDesk {...props} adAccountId='another-account' providerAccountId='2222222222' />);
  expect(screen.getByLabelText('Operator study Markdown')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name: /Include this operator study as research/ })).not.toBeChecked();
  expect(save).not.toHaveBeenCalled();
});
it('loads an original Markdown file into the study editor without automatically persisting it', async () => {
  render(<GoogleResearchDesk {...props} providerAccountId='1111111111' />);
  const content = '# Full original study\nSources and reasons.';
  const file = new File([content], 'account-study.md', { type: 'text/markdown' });
  Object.defineProperty(file, 'text', { value: async () => content });
  fireEvent.change(screen.getByLabelText('Load study Markdown file'), { target: { files: [file] } });
  expect(await screen.findByText('Markdown loaded into the draft editor. Confirm its account, sources and observation time before saving.')).toBeInTheDocument();
  expect(screen.getByLabelText('Operator study Markdown')).toHaveValue(content);
  expect(screen.getByRole('checkbox', { name: /Include this operator study as research/ })).not.toBeChecked();
  expect(save).not.toHaveBeenCalled();
});
it('rejects non-Markdown study files without retaining or saving their contents', async () => {
  render(<GoogleResearchDesk {...props} providerAccountId='1111111111' />);
  const file = new File(['not a study'], 'credentials.env', { type: 'text/plain' });
  fireEvent.change(screen.getByLabelText('Load study Markdown file'), { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a Markdown (.md) file of at most 1 MB.');
  expect(screen.getByLabelText('Operator study Markdown')).toHaveValue('');
  expect(save).not.toHaveBeenCalled();
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
it("links only a selected owned saved snapshot into Chat and Reports with the same hash/revision", async () => {
  jest.mocked(api.googleResearch.history.useQuery).mockReturnValue({ data: [snapshot], isLoading: false, refetch } as never);
  render(<GoogleResearchDesk {...props} />);
  expect(screen.queryByRole("link", { name: "Discuss saved audit in Scoped Chat" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Saved Google research" }), snapshot.id);
  for (const name of ["Discuss saved audit in Scoped Chat", "Open Scoped Report"]) {
    const url = new URL(screen.getByRole("link", { name }).getAttribute("href")!, "http://localhost");
    expect(url.searchParams.get("auditId")).toBe(snapshot.id); expect(url.searchParams.get("brand")).toBe(props.brandId);
    expect(url.searchParams.get("auditAccount")).toBe(props.adAccountId); expect(url.searchParams.get("auditHash")).toBe(snapshot.snapshot.contentHash);
    expect(url.searchParams.get("auditRevision")).toBe("0");
  }
});
