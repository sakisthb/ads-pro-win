import type { SupabaseClient } from "@supabase/supabase-js";

export type MessageType = "user" | "ai" | "insight" | "recommendation" | "data-card";

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  confidence?: number;
  dataCard?: DataCardPayload;
}

export interface DataCardPayload {
  title: string;
  metrics: { label: string; value: string; change?: number }[];
  sparkline: number[];
}

export interface ConversationSession {
  id: string;
  title: string;
  date: string;
  messageCount: number;
  messages: ChatMessage[];
}

/** DB row from chat_sessions table */
export interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

/** DB row from chat_messages table */
export interface MessageRow {
  id: string;
  session_id: string;
  type: MessageType;
  metadata: Record<string, unknown> | null;
  content: string;
  created_at: string;
}

export function rowToSession(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    title: row.title,
    date: new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    messageCount: row.message_count,
    messages: [],
  };
}

export function rowToMessage(row: MessageRow): ChatMessage {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    createdAt: new Date(row.created_at),
    confidence: (meta.confidence as number) ?? undefined,
    dataCard: (meta.dataCard as DataCardPayload) ?? undefined,
  };
}

// Organization scoping is enforced twice: the explicit filters below pin every
// read/write to the active organization, and RLS (is_chat_org_member) rejects
// cross-organization access even if a caller omits the filter.
export async function fetchSessions(
  sb: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<ConversationSession[]> {
  const { data, error } = await sb
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as SessionRow[]).map(rowToSession);
}

export async function fetchMessages(sb: SupabaseClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await sb
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as MessageRow[]).map(rowToMessage);
}

export async function createSession(
  sb: SupabaseClient,
  userId: string,
  organizationId: string,
  title: string,
): Promise<string | null> {
  // The chat tables have no database-side defaults (see migration
  // 20260918143000): the client must supply id and timestamps or every insert
  // fails NOT NULL.
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("chat_sessions")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      organization_id: organizationId,
      title,
      message_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function insertMessage(sb: SupabaseClient, sessionId: string, msg: ChatMessage): Promise<void> {
  const metadata: Record<string, unknown> = {};
  if (msg.confidence) metadata.confidence = msg.confidence;
  if (msg.dataCard) metadata.dataCard = msg.dataCard;
  await sb.from("chat_messages").insert({
    id: crypto.randomUUID(),
    session_id: sessionId,
    type: msg.type,
    content: msg.content,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    created_at: new Date().toISOString(),
  });
  await sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
}

export function localChatKey(userId: string) {
  return `adspro:chat:${userId}`;
}

export function loadLocalSessions(userId: string): ConversationSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(localChatKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { sessions?: ConversationSession[] };
    return (parsed.sessions ?? []).map((s) => ({
      ...s,
      messages: (s.messages ?? []).map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
      })),
    }));
  } catch {
    return [];
  }
}

export function saveLocalSessions(userId: string, sessions: ConversationSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localChatKey(userId), JSON.stringify({ sessions }));
}
