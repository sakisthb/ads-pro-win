import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResearchMemoryPanel } from "../research-memory-panel";
import { api } from "@/components/providers/trpc-provider";
import type { ResearchMemoryEntry, ResearchMemoryRecord } from "@/lib/research-memory";

jest.mock("@/components/providers/trpc-provider", () => ({ api: { researchMemory: { list: { useQuery: jest.fn() } } } }));

const entry = (over: Partial<ResearchMemoryEntry> = {}, id = "fixture-memory"): ResearchMemoryRecord => ({
  id,
  entry: {
    schemaVersion: 1, kind: "imported_operator_research",
    title: "Network & shop evidence addendum",
    sourceDoc: "docs/BAGTOBAG-NETWORK-AND-SHOP-EVIDENCE-ADDENDUM-2026-09-18.md",
    sourceDate: "2026-09-18", sourceUrls: ["https://example.test/addendum-source"],
    importedAt: "2026-09-18T12:00:00.000Z", importedBy: "fixture-user", brandId: "fixture-brand",
    markdown: "# Addendum\nPrivate report content.", version: 1, supersedesId: null,
    contentHash: "a".repeat(64), ...over,
  },
});

const query = (data?: ResearchMemoryRecord[], error?: Error) =>
  jest.mocked(api.researchMemory.list.useQuery).mockReturnValue({ data, isLoading: !data && !error, error: error ?? null } as never);

describe("ResearchMemoryPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows an explicit empty state when no research memory is imported for the brand", () => {
    query([]);
    render(<ResearchMemoryPanel brandId="fixture-brand" />);
    expect(screen.getByText("No research memory imported for this brand yet.")).toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Saved research memory" })).getAllByRole("option")).toHaveLength(1);
  });

  it("lists saved entries with version, source date and title per brand", () => {
    query([entry({ version: 2, sourceDate: "2026-09-18", title: "Meta reconciliation finding" }, "fixture-v2"),
      entry({ version: 1, sourceDate: "2026-09-17", title: "Repair desk audit" }, "fixture-v1")]);
    render(<ResearchMemoryPanel brandId="fixture-brand" />);
    const select = screen.getByRole("combobox", { name: "Saved research memory" });
    expect(within(select).getByRole("option", { name: "v2 · 2026-09-18 · Meta reconciliation finding" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "v1 · 2026-09-17 · Repair desk audit" })).toBeInTheDocument();
  });

  it("shows the selected entry's integrity metadata and full imported Markdown", async () => {
    const record = entry({ version: 3, supersedesId: "fixture-v2" });
    query([record]);
    render(<ResearchMemoryPanel brandId="fixture-brand" />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Saved research memory" }), record.id);
    expect(screen.getByRole("heading", { name: record.entry.title })).toBeInTheDocument();
    expect(screen.getByText(record.entry.sourceDoc)).toBeInTheDocument();
    expect(screen.getByText(record.entry.sourceDate)).toBeInTheDocument();
    expect(screen.getByText(/v3 \(supersedes fixture-v2\)/)).toBeInTheDocument();
    expect(screen.getByText(/2026-09-18T12:00:00\.000Z by fixture-user/)).toBeInTheDocument();
    expect(screen.getByText(record.entry.contentHash)).toBeInTheDocument();
    expect(screen.getByText(record.entry.sourceUrls[0])).toBeInTheDocument();
    expect(screen.getByText(/# Addendum/)).toBeInTheDocument();
    expect(screen.getByText(/Private report content\./)).toBeInTheDocument();
  });

  it("withholds records pinned to another brand instead of listing them", () => {
    query([entry({ brandId: "foreign-brand", title: "Foreign brand research" })]);
    render(<ResearchMemoryPanel brandId="fixture-brand" />);
    expect(screen.getByText("No research memory imported for this brand yet.")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Saved research memory" });
    expect(within(select).getAllByRole("option")).toHaveLength(1);
    expect(select).not.toHaveTextContent("Foreign brand research");
  });

  it("keeps list errors explicit and withholds the entries", () => {
    query(undefined, new Error("Fixture list unavailable"));
    render(<ResearchMemoryPanel brandId="fixture-brand" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Saved research memory unavailable");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
