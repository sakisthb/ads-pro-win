import { render, screen } from "@testing-library/react";
import ChatPage from "../page";
import { api } from "@/lib/trpc/react";
import { createClient } from "@/lib/supabase/client";

jest.mock("@/lib/trpc/react", () => ({
  api: { chat: { getOrgContext: { useQuery: jest.fn() } } },
}));
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/components/audit/audit-evidence-route", () => ({
  AuditEvidenceRoute: ({ fallback }: { fallback: React.ReactNode }) => <>{fallback}</>,
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

interface FakeQueries {
  tables: string[];
  selects: string[];
  eqCalls: [string, unknown][];
}

function makeFakeSupabase({ probeError, listRows = [] }: { probeError?: string; listRows?: unknown[] } = {}) {
  const queries: FakeQueries = { tables: [], selects: [], eqCalls: [] };
  let selectColumns: string | undefined;
  const builder: Record<string, unknown> = {};
  builder.auth = { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) };
  builder.from = jest.fn((table: string) => {
    queries.tables.push(table);
    return builder;
  });
  builder.select = jest.fn((columns?: string) => {
    selectColumns = columns;
    queries.selects.push(columns ?? "");
    return builder;
  });
  builder.eq = jest.fn((column: string, value: unknown) => {
    queries.eqCalls.push([column, value]);
    return builder;
  });
  builder.order = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.then = (onFulfilled: (value: unknown) => unknown) =>
    onFulfilled(
      selectColumns === "*"
        ? { data: listRows, error: null }
        : probeError
          ? { data: null, error: { message: probeError } }
          : { data: [], error: null },
    );
  return { supabase: builder, queries };
}

const sessionRow = {
  id: "session-1",
  user_id: "user-1",
  organization_id: "org-1",
  title: "ROAS question",
  message_count: 2,
  created_at: "2026-09-18T08:00:00.000Z",
  updated_at: "2026-09-18T09:00:00.000Z",
};

beforeAll(() => {
  Element.prototype.scrollTo = jest.fn();
});
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

it("falls back to this-browser history when the account has no organization scope", async () => {
  jest.mocked(api.chat.getOrgContext.useQuery).mockReturnValue({
    data: { organizationId: null },
    isLoading: false,
  } as never);
  const { supabase, queries } = makeFakeSupabase();
  jest.mocked(createClient).mockReturnValue(supabase as never);

  render(<ChatPage />);

  expect(await screen.findByText(/Cloud history is off until an organization scope is available/)).toBeInTheDocument();
  expect(screen.getByText("Saved in this browser")).toBeInTheDocument();
  expect(queries.selects).not.toContain("*");
});

it("loads cloud history filtered to the active organization when scope and tables exist", async () => {
  jest.mocked(api.chat.getOrgContext.useQuery).mockReturnValue({
    data: { organizationId: "org-1" },
    isLoading: false,
  } as never);
  const { supabase, queries } = makeFakeSupabase({ listRows: [sessionRow] });
  jest.mocked(createClient).mockReturnValue(supabase as never);

  render(<ChatPage />);

  expect(await screen.findByText("ROAS question")).toBeInTheDocument();
  expect(queries.eqCalls).toContainEqual(["user_id", "user-1"]);
  expect(queries.eqCalls).toContainEqual(["organization_id", "org-1"]);
  expect(screen.queryByText("Saved in this browser")).not.toBeInTheDocument();
});

it("keeps the playbook usable in this browser when the chat tables are missing", async () => {
  jest.mocked(api.chat.getOrgContext.useQuery).mockReturnValue({
    data: { organizationId: "org-1" },
    isLoading: false,
  } as never);
  const { supabase, queries } = makeFakeSupabase({ probeError: 'relation "public.chat_sessions" does not exist' });
  jest.mocked(createClient).mockReturnValue(supabase as never);

  render(<ChatPage />);

  expect(await screen.findByText(/exists in Supabase/)).toBeInTheDocument();
  expect(queries.selects).not.toContain("*");
});
