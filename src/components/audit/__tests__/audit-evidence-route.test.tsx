import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditEvidenceRoute } from "../audit-evidence-route";
import ChatPage from "@/app/(chat)/chat/page";
import ReportsPage from "@/app/(protected)/reports/page";
import { api } from "@/components/providers/trpc-provider";
import { createClient } from "@/lib/supabase/client";
import { downloadBlob } from "@/lib/export/csv-generator";
import { googleResearchReviewMarkdown } from "@/lib/google-audit-research";
import { googleResearchFixture } from "@/test-utils/google-research-fixture";
import { auditEvidenceReference, auditEvidenceUrl } from "@/lib/audit-evidence-reference";
import { explainGoogleResearch } from "@/lib/google-evidence-explanation";

let search = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => search, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/export/csv-generator", () => ({ downloadBlob: jest.fn() }));
jest.mock("@/components/providers/trpc-provider", () => ({ api: { googleResearch: { get: { useQuery: jest.fn() } }, useUtils: jest.fn() } }));

const record = googleResearchFixture(), reference = auditEvidenceReference(record);
const refetch = jest.fn(), explain = jest.fn();
function scoped() { search = new URL(auditEvidenceUrl("/chat", reference), "http://localhost").searchParams; }
beforeEach(() => {
  jest.clearAllMocks(); scoped();
  refetch.mockResolvedValue({ data: record });
  explain.mockImplementation(async (input: { question: string; proposalId?: string }) => explainGoogleResearch(record, input));
  jest.mocked(api.googleResearch.get.useQuery).mockReturnValue({ data: record, isLoading: false, isFetching: false, refetch } as never);
  jest.mocked(api.useUtils).mockReturnValue({ googleResearch: { explain: { fetch: explain } } } as never);
});
it("keeps workspace mode visibly separate and does not read a fake scoped packet", () => {
  search = new URLSearchParams("brand=fixture-brand");
  render(<AuditEvidenceRoute mode="chat" fallback={<p>Workspace child</p>} />);
  expect(screen.getByText("Workspace child")).toBeInTheDocument();
  expect(screen.getByText(/Workspace mode.*not a scoped Google audit/)).toBeInTheDocument();
  expect(api.googleResearch.get.useQuery).not.toHaveBeenCalled();
});
it("withholds incomplete scoped URLs instead of running workspace fallback", () => {
  search = new URLSearchParams("auditId=fixture-snapshot");
  render(<AuditEvidenceRoute mode="report" fallback={<p>DO NOT READ WORKSPACE</p>} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid scoped audit reference");
  expect(screen.queryByText("DO NOT READ WORKSPACE")).not.toBeInTheDocument();
  expect(api.googleResearch.get.useQuery).not.toHaveBeenCalled();
});
it.each(["chat", "report"] as const)("withholds stale or failed packet data in %s mode", mode => {
  jest.mocked(api.googleResearch.get.useQuery).mockReturnValue({ data: { ...record, snapshot: { ...record.snapshot, revision: 1 } }, isLoading: false, refetch } as never);
  const view = render(<AuditEvidenceRoute mode={mode} fallback={<p>Workspace fallback</p>} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Evidence reference mismatch");
  expect(screen.queryByRole("region", { name: "Frozen evidence report" })).not.toBeInTheDocument();
  jest.mocked(api.googleResearch.get.useQuery).mockReturnValue({ data: record, error: new Error("Review revision changed"), refetch } as never);
  view.rerender(<AuditEvidenceRoute mode={mode} fallback={<p>Workspace fallback</p>} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Review revision changed");
  expect(screen.queryByRole("region", { name: "Frozen evidence report" })).not.toBeInTheDocument();
});
it("explains a user question using only the selected frozen reference and displays Why/Risk", async () => {
  render(<AuditEvidenceRoute mode="chat" fallback={<p>Workspace fallback</p>} />);
  fireEvent.change(screen.getByLabelText("Question about saved research"), { target: { value: "Γιατί το προτείνεις;" } });
  await userEvent.click(screen.getByRole("button", { name: "Explain from saved evidence" }));
  expect(explain).toHaveBeenCalledWith({ ...reference, question: "Γιατί το προτείνεις;", proposalId: undefined }, { staleTime: 0 });
  const region = await screen.findByRole("region", { name: "Scoped explanation" });
  expect(region).toHaveTextContent(record.snapshot.proposals[0].reason); expect(region).toHaveTextContent(record.snapshot.proposals[0].risk);
  expect(screen.queryByText("Workspace fallback")).not.toBeInTheDocument();
});
it("blocks repeated questions and rejects a late reply with the wrong reference", async () => {
  let resolve!: (value: ReturnType<typeof explainGoogleResearch>) => void;
  explain.mockImplementation(() => new Promise(r => { resolve = r; }));
  render(<AuditEvidenceRoute mode="chat" fallback={<p>Workspace fallback</p>} />);
  await userEvent.click(screen.getByRole("button", { name: "Why these proposals?" }));
  expect(screen.getByRole("button", { name: "Explain from saved evidence" })).toBeDisabled();
  const reply = explainGoogleResearch(record, { question: "Why these proposals?" });
  await act(async () => resolve({ ...reply, reference: { ...reference, adAccountId: "foreign-account" }, answer: "FOREIGN REPLY" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Explanation reference mismatch");
  expect(screen.queryByText("FOREIGN REPLY")).not.toBeInTheDocument();
});
it("exports identical frozen Markdown after a fresh reference check, not workspace totals", async () => {
  render(<AuditEvidenceRoute mode="report" fallback={<p>Workspace fallback</p>} />);
  expect(within(screen.getByRole("region", { name: "Frozen evidence report" })).getByText((_, element) =>
    element?.tagName === "PRE" && element.textContent === record.snapshot.reportMarkdown)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Download frozen report (.md)" }));
  expect(refetch).toHaveBeenCalledTimes(1);
  const blob = jest.mocked(downloadBlob).mock.calls[0][0];
  const value = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
  expect(value).toBe(googleResearchReviewMarkdown(record));
  expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "google-research-fixture-snapshot-review-0.md");
});
it("blocks export when the fresh server read changes revision", async () => {
  refetch.mockResolvedValue({ data: { ...record, snapshot: { ...record.snapshot, revision: 1 } } });
  render(<AuditEvidenceRoute mode="report" fallback={<p>Workspace fallback</p>} />);
  await userEvent.click(screen.getByRole("button", { name: "Download frozen report (.md)" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Evidence reference mismatch");
  expect(downloadBlob).not.toHaveBeenCalled();
});
it("withholds exports while evidence is fetching, even if cached data exists", () => {
  jest.mocked(api.googleResearch.get.useQuery).mockReturnValue({ data: record, isLoading: false, isFetching: true, refetch } as never);
  render(<AuditEvidenceRoute mode="report" fallback={<p>Workspace fallback</p>} />);
  expect(screen.getByRole("status")).toHaveTextContent("Validating owned frozen evidence");
  expect(screen.queryByRole("button", { name: "Download frozen report (.md)" })).not.toBeInTheDocument();
});
it.each([ChatPage, ReportsPage])("wires the actual page into the shared route without legacy Supabase/metric consumers", Page => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Scoped Google Audit");
  expect(within(screen.getByRole("region", { name: "Frozen evidence report" })).getByText((_, element) =>
    element?.tagName === "PRE" && element.textContent === record.snapshot.reportMarkdown)).toBeInTheDocument();
  expect(createClient).not.toHaveBeenCalled(); expect(api.googleResearch.get.useQuery).toHaveBeenCalledWith(reference, expect.objectContaining({ staleTime: 0, retry: false }));
});
it("clears an in-flight explanation when the URL reference changes", async () => {
  let resolve!: (value: ReturnType<typeof explainGoogleResearch>) => void;
  explain.mockImplementation(() => new Promise(r => { resolve = r; }));
  const view = render(<AuditEvidenceRoute mode="chat" fallback={<p>Workspace fallback</p>} />);
  await userEvent.click(screen.getByRole("button", { name: "Why these proposals?" }));
  const nextRecord = { ...record, id: "next-saved-snapshot" };
  search = new URL(auditEvidenceUrl("/chat", auditEvidenceReference(nextRecord)), "http://localhost").searchParams;
  jest.mocked(api.googleResearch.get.useQuery).mockReturnValue({ data: nextRecord, isLoading: false, isFetching: false, refetch } as never);
  view.rerender(<AuditEvidenceRoute mode="chat" fallback={<p>Workspace fallback</p>} />);
  await act(async () => resolve({ ...explainGoogleResearch(record, { question: "Why these proposals?" }), answer: "OLD SNAPSHOT REPLY" }));
  expect(screen.queryByText("OLD SNAPSHOT REPLY")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Scoped explanation" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Question about saved research")).toHaveValue("");
});
