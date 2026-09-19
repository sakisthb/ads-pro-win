import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSession,
  fetchSessions,
  insertMessage,
  loadLocalSessions,
  rowToMessage,
  rowToSession,
  saveLocalSessions,
  type ChatMessage,
  type ConversationSession,
} from "@/lib/chat/persistence";

interface FakeCapture {
  table?: string;
  selectColumns?: string;
  eqCalls: [string, unknown][];
  inserted?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  fromTables: string[];
  listResult: { data: unknown; error: unknown };
  probeResult: { data: unknown; error: unknown };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function makeFakeSupabase(options: { probeError?: string } = {}) {
  const capture: FakeCapture = {
    eqCalls: [],
    fromTables: [],
    listResult: { data: [], error: null },
    probeResult: options.probeError
      ? { data: null, error: { message: options.probeError } }
      : { data: [], error: null },
  };
  let selectColumns: string | undefined;
  const builder: Record<string, unknown> = {};
  builder.from = jest.fn((table: string) => {
    capture.table = table;
    capture.fromTables.push(table);
    return builder;
  });
  builder.select = jest.fn((columns?: string) => {
    selectColumns = columns;
    return builder;
  });
  builder.insert = jest.fn((value: Record<string, unknown>) => {
    capture.inserted = value;
    return builder;
  });
  builder.update = jest.fn((value: Record<string, unknown>) => {
    capture.updated = value;
    return builder;
  });
  builder.eq = jest.fn((column: string, value: unknown) => {
    capture.eqCalls.push([column, value]);
    return builder;
  });
  builder.order = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.single = jest.fn(async () => ({ data: { id: "session-new" }, error: null }));
  builder.then = (onFulfilled: (value: unknown) => unknown) =>
    onFulfilled(selectColumns === "*" ? capture.listResult : capture.probeResult);
  return { sb: builder as unknown as SupabaseClient, capture };
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

describe("org-scoped session queries", () => {
  it("lists only sessions owned by the user inside the active organization", async () => {
    const { sb, capture } = makeFakeSupabase();
    capture.listResult = { data: [sessionRow], error: null };

    const rows = await fetchSessions(sb, "user-1", "org-1");

    expect(capture.table).toBe("chat_sessions");
    expect(capture.eqCalls).toContainEqual(["user_id", "user-1"]);
    expect(capture.eqCalls).toContainEqual(["organization_id", "org-1"]);
    expect(rows[0]).toMatchObject({ id: "session-1", title: "ROAS question", messageCount: 2 });
  });

  it("creates sessions stamped with the active organization", async () => {
    const { sb, capture } = makeFakeSupabase();

    const id = await createSession(sb, "user-1", "org-1", "Hello there");

    expect(capture.inserted).toEqual({
      id: expect.stringMatching(UUID_RE),
      user_id: "user-1",
      organization_id: "org-1",
      title: "Hello there",
      message_count: 0,
      created_at: expect.stringMatching(ISO_RE),
      updated_at: expect.stringMatching(ISO_RE),
    });
    expect((capture.inserted as Record<string, string>).created_at).toBe(
      (capture.inserted as Record<string, string>).updated_at,
    );
    expect(id).toBe("session-new");
  });

  it("returns null when the insert is rejected instead of leaking an error", async () => {
    const { sb } = makeFakeSupabase();
    (sb.from("chat_sessions").single as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });

    await expect(createSession(sb, "user-1", "org-1", "Hello")).resolves.toBeNull();
  });
});

describe("message persistence", () => {
  it("stores null metadata for plain messages", async () => {
    const { sb, capture } = makeFakeSupabase();
    const msg: ChatMessage = { id: "m-1", type: "user", content: "hi", createdAt: new Date("2026-09-18T10:00:00Z") };

    await insertMessage(sb, "session-1", msg);

    expect(capture.fromTables).toEqual(["chat_messages", "chat_sessions"]);
    expect(capture.inserted).toEqual({
      id: expect.stringMatching(UUID_RE),
      session_id: "session-1",
      type: "user",
      content: "hi",
      metadata: null,
      created_at: expect.stringMatching(ISO_RE),
    });
  });

  it("stores confidence and data cards inside metadata", async () => {
    const { sb, capture } = makeFakeSupabase();
    const msg: ChatMessage = {
      id: "m-2",
      type: "ai",
      content: "insight",
      createdAt: new Date("2026-09-18T10:00:00Z"),
      confidence: 92,
      dataCard: { title: "ROAS", metrics: [], sparkline: [1, 2] },
    };

    await insertMessage(sb, "session-1", msg);

    expect(capture.inserted).toMatchObject({
      id: expect.stringMatching(UUID_RE),
      session_id: "session-1",
      created_at: expect.stringMatching(ISO_RE),
      metadata: { confidence: 92, dataCard: { title: "ROAS" } },
    });
  });

  it("bumps the session's updated_at so recent sessions surface first", async () => {
    const { sb, capture } = makeFakeSupabase();
    const msg: ChatMessage = { id: "m-3", type: "user", content: "hello", createdAt: new Date("2026-09-18T10:00:00Z") };

    await insertMessage(sb, "session-1", msg);

    expect(capture.fromTables).toContain("chat_sessions");
    expect(capture.updated).toEqual({ updated_at: expect.stringMatching(ISO_RE) });
    expect(capture.eqCalls).toContainEqual(["id", "session-1"]);
  });
});

describe("this-browser storage fallback", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips sessions and revives message dates", () => {
    const session: ConversationSession = {
      id: "local-1",
      title: "Local chat",
      date: "Sep 18",
      messageCount: 1,
      messages: [
        { id: "m-1", type: "user", content: "hello", createdAt: new Date("2026-09-18T10:00:00Z") },
      ],
    };

    saveLocalSessions("user-1", [session]);

    const loaded = loadLocalSessions("user-1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].messages[0].createdAt).toBeInstanceOf(Date);
    expect(loaded[0].messages[0].content).toBe("hello");
  });

  it("returns an empty list for corrupt storage instead of throwing", () => {
    window.localStorage.setItem("adspro:chat:user-1", "{oops");
    expect(loadLocalSessions("user-1")).toEqual([]);
  });
});

describe("row mapping", () => {
  it("maps a session row without messages", () => {
    expect(rowToSession(sessionRow)).toMatchObject({
      id: "session-1",
      title: "ROAS question",
      messageCount: 2,
      messages: [],
    });
  });

  it("maps message extras from metadata", () => {
    const row = {
      id: "m-9",
      session_id: "session-1",
      type: "ai",
      content: "text",
      metadata: { confidence: 88, dataCard: { title: "Card" } },
      created_at: "2026-09-18T10:00:00.000Z",
    };
    expect(rowToMessage(row)).toMatchObject({ id: "m-9", confidence: 88, dataCard: { title: "Card" } });
  });
});
