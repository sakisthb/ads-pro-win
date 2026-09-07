"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Lightbulb,
  Target,
  Sparkles,
  Bot,
  User,
  Loader2,
  Download,
  Database,
  Search,
  Plus,
  Menu,
  X,
  Mic,
  TrendingUp,
  BarChart3,
} from "lucide-react";

import { SAKI_PLAYBOOKS, PLAYBOOK_CATEGORIES } from "@/lib/saki-playbooks";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageType = "user" | "ai" | "insight" | "recommendation" | "data-card";

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  confidence?: number;
  dataCard?: DataCardPayload;
}

interface DataCardPayload {
  title: string;
  metrics: { label: string; value: string; change?: number }[];
  sparkline: number[];
}

interface ConversationSession {
  id: string;
  title: string;
  date: string;
  messageCount: number;
  messages: ChatMessage[];
}

/** DB row from chat_sessions table */
interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

/** DB row from chat_messages table */
interface MessageRow {
  id: string;
  session_id: string;
  type: MessageType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { label: "Pixel ROAS vs till", icon: Sparkles },
  { label: "Compare 7d", icon: BarChart3 },
  { label: "Find waste", icon: Lightbulb },
  { label: "Top campaigns", icon: Target },
  { label: "Pixel run-rate", icon: TrendingUp },
] as const;

// ---------------------------------------------------------------------------
// Supabase persistence helpers
// ---------------------------------------------------------------------------

function rowToSession(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    title: row.title,
    date: new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    messageCount: row.message_count,
    messages: [],
  };
}

function rowToMessage(row: MessageRow): ChatMessage {
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

async function fetchSessions(sb: SupabaseClient, userId: string): Promise<ConversationSession[]> {
  const { data, error } = await sb
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as SessionRow[]).map(rowToSession);
}

async function fetchMessages(sb: SupabaseClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await sb
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as MessageRow[]).map(rowToMessage);
}

async function createSession(sb: SupabaseClient, userId: string, title: string): Promise<string | null> {
  const { data, error } = await sb
    .from("chat_sessions")
    .insert({ user_id: userId, title, message_count: 0 })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function insertMessage(sb: SupabaseClient, sessionId: string, msg: ChatMessage): Promise<void> {
  const metadata: Record<string, unknown> = {};
  if (msg.confidence) metadata.confidence = msg.confidence;
  if (msg.dataCard) metadata.dataCard = msg.dataCard;
  await sb.from("chat_messages").insert({
    session_id: sessionId,
    type: msg.type,
    content: msg.content,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });
}

async function updateSessionMeta(sb: SupabaseClient, sessionId: string, title: string, count: number): Promise<void> {
  await sb.from("chat_sessions").update({ title, message_count: count, updated_at: new Date().toISOString() }).eq("id", sessionId);
}

function localChatKey(userId: string) {
  return `adspro:chat:${userId}`;
}

function loadLocalSessions(userId: string): ConversationSession[] {
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

function saveLocalSessions(userId: string, sessions: ConversationSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localChatKey(userId), JSON.stringify({ sessions }));
}

// ---------------------------------------------------------------------------
// SSE streaming helper
// ---------------------------------------------------------------------------

async function streamChat(
  message: string,
  onToken: (token: string) => void,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: history.slice(-10) }),
  });

  if (!res.ok || !res.body) throw new Error(`Chat API error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        if (json.content) onToken(json.content);
      } catch { /* skip malformed */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Detect message type from AI response
// ---------------------------------------------------------------------------

function detectMessageType(content: string): MessageType {
  const lower = content.toLowerCase();
  if (lower.includes("recommend") || lower.includes("action:") || lower.includes("quick win")) {
    return "recommendation";
  }
  if (lower.includes("insight") || lower.includes("alert") || lower.includes("warning")) {
    return "insight";
  }
  return "ai";
}

// ---------------------------------------------------------------------------
// Sources & follow-up generation
// ---------------------------------------------------------------------------

interface MessageSources { dataSources: string[]; timeRange: string; scope: string }

function generateSources(content: string): MessageSources {
  const lower = content.toLowerCase();
  const dataSources: string[] = [];
  if (lower.includes("dailymetric") || lower.includes("synced")) dataSources.push("Synced DailyMetric");
  if (lower.includes("meta") || lower.includes("facebook") || lower.includes("instagram")) dataSources.push("Meta Ads");
  if (lower.includes("google") || lower.includes("search") || lower.includes("shopping")) dataSources.push("Google Ads");
  if (lower.includes("tiktok")) dataSources.push("TikTok Ads");
  if (lower.includes("woo") || lower.includes("commerce") || lower.includes("order")) dataSources.push("WooCommerce");
  if (dataSources.length === 0) dataSources.push("Synced DailyMetric");

  let timeRange = "last 30 days";
  if (lower.includes("7 day") || lower.includes("week")) timeRange = "last 7 days";
  else if (lower.includes("24 hour") || lower.includes("today")) timeRange = "last 24 hours";

  return { dataSources: [...new Set(dataSources)], timeRange, scope: "this workspace" };
}

function generateFollowups(content: string): string[] {
  const lower = content.toLowerCase();
  const pool: string[] = [];
  if (lower.includes("roas") || lower.includes("performance") || lower.includes("clock")) pool.push("Which campaign has the best pixel ROAS?", "Show spend by platform", "Name the five clocks");
  if (lower.includes("budget") || lower.includes("spend") || lower.includes("wasted")) pool.push("Reallocate budget to top performers", "Show budget alerts", "Where can I cut spend?");
  if (lower.includes("creative")) pool.push("Generate 3 ad copy variants", "Which creative is fatiguing?", "Show creative fatigue report");
  if (lower.includes("audience")) pool.push("Keep Advantage+ as the control", "Which geo converts best?", "Open Creative Fatigue");
  const defaults = ["Summarize last 7 days", "Find quick wins", "Name the five clocks", "Which paid platform has spend?", "Forecast pixel run-rate"];
  const unique = [...new Set(pool)];
  const result = unique.slice(0, 3);
  let di = 0;
  while (result.length < 3 && di < defaults.length) {
    if (!result.includes(defaults[di])) result.push(defaults[di]);
    di++;
  }
  return result.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Export conversation
// ---------------------------------------------------------------------------

function exportConversation(messages: ChatMessage[]) {
  const lines = messages.map((m) => {
    const role = m.type === "user" ? "You" : "Moby AI";
    return `[${m.createdAt.toLocaleString("en-US")}] ${role}:\n${m.content}`;
  });
  const text = `Ads Pro — AI Chat Export\nGenerated: ${new Date().toLocaleString("en-US")}\n${"=".repeat(60)}\n\n${lines.join(`\n\n${"-".repeat(60)}\n\n`)}`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ads-pro-chat-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer
// ---------------------------------------------------------------------------

function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });
    return <span key={i}>{rendered}{i < text.split("\n").length - 1 && <br />}</span>;
  });
}

// ---------------------------------------------------------------------------
// Mini Sparkline (pure SVG, no recharts)
// ---------------------------------------------------------------------------

function MiniSparkline({ data, color = "#a855f7" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#spark-grad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Inline Data Card (rendered inside chat)
// ---------------------------------------------------------------------------

function InlineDataCard({ data }: { data: DataCardPayload }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/70">{data.title}</span>
        <MiniSparkline data={data.sparkline} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-white/[0.04] p-2 text-center">
            <div className="text-[10px] font-medium text-white/40">{m.label}</div>
            <div className="text-sm font-bold text-white">{m.value}</div>
            {m.change !== undefined && (
              <div className={`text-[10px] font-medium ${m.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {m.change >= 0 ? "+" : ""}{m.change}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources bar + follow-up chips
// ---------------------------------------------------------------------------

function SourcesBar({ sources }: { sources: MessageSources }) {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-white/35">
      <Database className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
      <span>
        Based on: <span className="text-white/55">{sources.dataSources.join(", ")}</span>
        {" · "}<span className="text-white/55">{sources.timeRange}</span>
        {" · "}<span className="text-white/55">{sources.scope}</span>
      </span>
    </div>
  );
}

function FollowupChips({ items, onPick, disabled }: { items: string[]; onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-medium text-white/30">
        <Sparkles className="h-3 w-3 text-purple-300/70" /> Follow-up:
      </span>
      {items.map((item) => (
        <button key={item} onClick={() => onPick(item)} disabled={disabled}
          className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60 transition-all hover:border-purple-400/30 hover:bg-purple-400/5 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-50">
          {item}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation Sidebar
// ---------------------------------------------------------------------------

function ConversationSidebar({
  sessions, activeId, onSelect, onNew, searchQuery, onSearchChange, open, onClose, localOnly,
}: {
  sessions: ConversationSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  open: boolean;
  onClose: () => void;
  localOnly?: boolean;
}) {
  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#0c0c14]/95 backdrop-blur-xl transition-transform duration-300 lg:relative lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white/80">Conversations</h2>
            {localOnly && (
              <p className="mt-0.5 text-[10px] text-amber-300/70">Saved in this browser</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onNew}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-purple-500/20 hover:text-purple-300"
              title="New Chat">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/80 lg:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/30" />
            <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations…"
              className="min-w-0 flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/30 focus:outline-none" />
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1 scrollbar-thin">
          {filtered.map((session) => (
            <button key={session.id} onClick={() => { onSelect(session.id); onClose(); }}
              className={`group flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-all ${
                session.id === activeId
                  ? "border-l-2 border-purple-400 bg-purple-500/10"
                  : "border-l-2 border-transparent hover:bg-white/[0.04]"
              }`}>
              <span className={`text-xs font-medium ${session.id === activeId ? "text-purple-200" : "text-white/70 group-hover:text-white/90"}`}>
                {session.title}
              </span>
              <span className="mt-0.5 text-[10px] text-white/30">
                {session.date} · {session.messageCount} messages
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-white/30">No conversations found</p>
          )}
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Welcome State
// ---------------------------------------------------------------------------

function WelcomeState({ onPick }: { onPick: (text: string) => void }) {
  const [category, setCategory] = useState<(typeof PLAYBOOK_CATEGORIES)[number] | "All">("All");
  const playbooks =
    category === "All"
      ? SAKI_PLAYBOOKS
      : SAKI_PLAYBOOKS.filter((p) => p.category === category);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
      className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-spin rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 opacity-60 blur-md [animation-duration:3s]" style={{ margin: -6 }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 shadow-2xl shadow-purple-500/30">
          <Bot className="h-10 w-10 text-white" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Ask AI anything about this workspace
        </h2>
        <p className="mt-1.5 text-sm text-white/40">
          {SAKI_PLAYBOOKS.length} playbooks over pixel, till, GA4, GSC, and email — never one blended ROAS
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {(["All", ...PLAYBOOK_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
              category === cat
                ? "border-purple-400/40 bg-purple-500/15 text-white"
                : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {playbooks.map((sp) => {
          const Icon = sp.icon;
          return (
            <button key={sp.id} onClick={() => onPick(sp.prompt)}
              className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left backdrop-blur-xl transition-all hover:border-purple-400/30 hover:bg-purple-500/5">
              <Icon className="h-4 w-4 text-purple-400/70 transition-colors group-hover:text-purple-300" />
              <span className="text-xs font-medium text-white/70 group-hover:text-white/90">{sp.label}</span>
              <span className="text-[10px] text-white/35">{sp.category}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg, onSuggestionClick, isSending }: {
  msg: ChatMessage; onSuggestionClick: (text: string) => void; isSending: boolean;
}) {
  const isUser = msg.type === "user";
  const isInsight = msg.type === "insight";
  const isRecommendation = msg.type === "recommendation";
  const isDataCard = msg.type === "data-card";

  const showExtras = !isUser && !msg.isStreaming && msg.content.length > 0;

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        isUser ? "bg-white/10" : "bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20"
      }`}>
        {isUser ? <User className="h-4 w-4 text-white/80" /> : <Bot className="h-4 w-4 text-white" />}
      </span>

      {/* Content column */}
      <div className={`flex min-w-0 flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {/* Name tag for AI */}
        {!isUser && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40">
            Moby
            {msg.confidence && !msg.isStreaming && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                {msg.confidence}% confidence
              </span>
            )}
          </span>
        )}

        {/* Bubble */}
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/15"
            : isInsight
              ? "border-l-4 border-amber-400 bg-amber-400/5 text-white/90 backdrop-blur-xl"
              : isRecommendation
                ? "border-l-4 border-emerald-400 bg-emerald-400/5 text-white/90 backdrop-blur-xl"
                : "border border-white/10 bg-white/[0.04] text-white/90 backdrop-blur-xl"
        }`}>
          {isInsight && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-300">
              <Lightbulb className="h-3.5 w-3.5" /> Insight
              {msg.confidence && (
                <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">HIGH</span>
              )}
            </div>
          )}
          {isRecommendation && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
              <Target className="h-3.5 w-3.5" /> Recommendation
            </div>
          )}

          <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>

          {/* Inline data card */}
          {isDataCard && msg.dataCard && <InlineDataCard data={msg.dataCard} />}

          {/* Streaming cursor */}
          {msg.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-purple-400" />
          )}

          {/* Timestamp */}
          <div className="mt-2 text-[10px] text-white/30">
            {msg.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* Sources + follow-ups */}
        {showExtras && (
          <div className="flex w-full max-w-[80%] flex-col gap-2 pl-1">
            <SourcesBar sources={generateSources(msg.content)} />
            <FollowupChips items={generateFollowups(msg.content)} onPick={onSuggestionClick} disabled={isSending} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [persistRemote, setPersistRemote] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consumedAsk = useRef(false);

  // Fetch authenticated user + verify DB tables + load sessions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) { setIsLoading(false); return; }
      setUserId(user.id);

      // Prefer Supabase tables when they exist; otherwise keep the playbook
      // UI working with this-browser storage so /chat is not a dead end.
      const probeSessions = await supabase.from("chat_sessions").select("id").limit(1);
      const probeMessages = await supabase.from("chat_messages").select("id").limit(1);
      const tablesMissing = Boolean(probeSessions.error || probeMessages.error);
      if (tablesMissing) {
        if (!cancelled) {
          setPersistRemote(false);
          setDbError(probeSessions.error?.message ?? probeMessages.error?.message ?? "chat tables unavailable");
          setSessions(loadLocalSessions(user.id));
          setIsLoading(false);
        }
        return;
      }

      const rows = await fetchSessions(supabase, user.id);
      if (!cancelled) {
        setPersistRemote(true);
        setDbError(null);
        setSessions(rows);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  // Focus input on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const showEmptyState = messages.length === 0;

  // ---------------------------------------------------------------------------
  // Send message + stream response
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`, type: "user", content: trimmed, createdAt: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsSending(true);

    const history = messages
      .filter((m) => m.type !== "insight" && m.type !== "recommendation")
      .map((m) => ({
        role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      }));

    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiMsgId, type: "ai", content: "", createdAt: new Date(), isStreaming: true,
    };
    setMessages((m) => [...m, aiMsg]);

    try {
      let fullContent = "";
      await streamChat(trimmed, (token) => {
        fullContent += token;
        setMessages((m) => m.map((msg) => msg.id === aiMsgId ? { ...msg, content: fullContent } : msg));
      }, history);

      const msgType = detectMessageType(fullContent);

      setMessages((m) => m.map((msg) => msg.id === aiMsgId
        ? { ...msg, isStreaming: false, type: msgType }
        : msg
      ));

      const finalAiMsg: ChatMessage = {
        id: aiMsgId, type: msgType, content: fullContent, createdAt: new Date(),
      };

      if (userId && persistRemote) {
        let sessionId = activeSessionId;
        if (!sessionId) {
          sessionId = await createSession(supabase, userId, trimmed.slice(0, 40));
          if (sessionId) setActiveSessionId(sessionId);
        }
        if (sessionId) {
          insertMessage(supabase, sessionId, userMsg).catch(() => {});
          insertMessage(supabase, sessionId, finalAiMsg).catch(() => {});
          const updated = await fetchSessions(supabase, userId);
          setSessions(updated);
        }
      } else if (userId) {
        setSessions((prev) => {
          const sid = activeSessionId ?? `local-${Date.now()}`;
          if (!activeSessionId) setActiveSessionId(sid);
          const existing = prev.find((s) => s.id === sid);
          const nextMsgs = [...(existing?.messages ?? []), userMsg, { ...finalAiMsg, isStreaming: false }];
          const nextSession: ConversationSession = {
            id: sid,
            title: existing?.title ?? trimmed.slice(0, 40),
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            messageCount: nextMsgs.length,
            messages: nextMsgs,
          };
          const next = existing
            ? prev.map((s) => (s.id === sid ? nextSession : s))
            : [nextSession, ...prev];
          saveLocalSessions(userId, next);
          return next;
        });
      }
    } catch {
      setMessages((m) => m.map((msg) => msg.id === aiMsgId
        ? { ...msg, content: "Sorry — I ran into an error processing your request. Please try again.", isStreaming: false }
        : msg
      ));
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages, userId, persistRemote, activeSessionId, supabase]);

  useEffect(() => {
    const ask = searchParams.get("ask")?.trim();
    if (!ask || consumedAsk.current || isLoading || isSending) return;
    consumedAsk.current = true;
    void sendMessage(ask);
    router.replace("/chat", { scroll: false });
  }, [searchParams, isLoading, isSending, sendMessage, router]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setActiveSessionId(null);
    setInput("");
  }

  async function handleSelectSession(id: string) {
    setActiveSessionId(id);
    if (!persistRemote) {
      const local = sessions.find((s) => s.id === id);
      setMessages(local?.messages ?? []);
      return;
    }
    setMessages([]);
    const msgs = await fetchMessages(supabase, id);
    setMessages(msgs);
  }

  // Show loading state while fetching user + sessions
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          <span className="text-sm text-white/40">Loading conversations…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        localOnly={!persistRemote}
      />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white/80 lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Ask AI</h1>
              <p className="text-xs text-white/35">Saki playbooks · campaign intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => exportConversation(messages)} disabled={messages.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-white/60 backdrop-blur-xl transition-all hover:border-purple-400/30 hover:bg-purple-400/5 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40">
              <Download className="h-3 w-3" /> Export
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online
            </span>
          </div>
        </div>

        {!persistRemote && (
          <div className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-200/80 lg:px-6">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Playbooks work in this browser. Cloud history is off until{" "}
              <code className="text-amber-100">chat_sessions</code> exists in Supabase.
              {dbError ? ` (${dbError})` : ""}
            </span>
          </div>
        )}

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin lg:px-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onSuggestionClick={sendMessage} isSending={isSending} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isSending && messages[messages.length - 1]?.content === "" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                <Bot className="h-4 w-4 text-white" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" />
                <span className="ml-1 text-xs text-white/40">Analyzing…</span>
              </div>
            </motion.div>
          )}

          {/* Welcome state */}
          {showEmptyState && <WelcomeState onPick={sendMessage} />}
        </div>

        {/* Quick-action bar */}
        {!showEmptyState && (
          <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2 lg:px-6">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} onClick={() => sendMessage(action.label)} disabled={isSending}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50 transition-all hover:border-purple-400/30 hover:bg-purple-400/5 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-50">
                  <Icon className="h-3 w-3 text-purple-300/70" /> {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit}
          className="mx-4 mb-3 flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-xl transition-colors focus-within:border-purple-400/40 lg:mx-6">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your marketing…"
            disabled={isSending}
            rows={1}
            className="max-h-40 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
          />
          {/* Voice placeholder */}
          <div className="group relative mb-1">
            <button type="button" disabled
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/30 transition-colors">
              <Mic className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon
            </span>
          </div>
          <button type="submit" disabled={isSending || !input.trim()}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/20 transition-all hover:from-purple-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        <p className="pb-3 text-center text-[10px] text-white/20">
          Responses are generated from your marketing data. Verify critical decisions against the dashboard.
        </p>
      </div>
    </div>
  );
}
