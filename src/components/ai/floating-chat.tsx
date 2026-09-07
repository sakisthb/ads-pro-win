"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  X,
  Bot,
  User,
  Loader2,
  Lightbulb,
  Target,
  Sparkles,
} from "lucide-react";
import { ASK_AI_EVENT } from "@/lib/ask-ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageType = "user" | "ai" | "insight" | "recommendation";

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// SSE streaming helper (shared logic)
// ---------------------------------------------------------------------------

async function streamChat(
  message: string,
  onToken: (token: string) => void,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: history.slice(-8) }),
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
      } catch {
        // skip malformed
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer
// ---------------------------------------------------------------------------

function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });
    return (
      <span key={i}>
        {rendered}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

function detectMessageType(content: string): MessageType {
  const lower = content.toLowerCase();
  if (lower.includes("recommend") || lower.includes("action:") || lower.includes("quick win"))
    return "recommendation";
  if (lower.includes("insight") || lower.includes("alert") || lower.includes("detected"))
    return "insight";
  return "ai";
}

// ---------------------------------------------------------------------------
// Compact message bubble
// ---------------------------------------------------------------------------

function MiniMessage({ msg }: { msg: ChatMessage }) {
  const isUser = msg.type === "user";
  const isInsight = msg.type === "insight";
  const isRecommendation = msg.type === "recommendation";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
          isUser
            ? "bg-white/10"
            : "bg-gradient-to-br from-purple-500 to-blue-500"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3 text-white/80" />
        ) : (
          <Bot className="h-3 w-3 text-white" />
        )}
      </span>

      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow shadow-purple-500/15"
            : isInsight
              ? "border-l-2 border-amber-400 bg-amber-400/5 text-white/90"
              : isRecommendation
                ? "border-l-2 border-emerald-400 bg-emerald-400/5 text-white/90"
                : "border border-white/10 bg-white/[0.04] text-white/90"
        }`}
      >
        {isInsight && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-amber-300">
            <Lightbulb className="h-2.5 w-2.5" /> Insight
          </div>
        )}
        {isRecommendation && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-emerald-300">
            <Target className="h-2.5 w-2.5" /> Recommendation
          </div>
        )}
        {renderContent(msg.content)}
        {msg.isStreaming && (
          <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-purple-400" />
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main floating chat component
// ---------------------------------------------------------------------------

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [askNonce, setAskNonce] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingAsk = useRef<string | null>(null);

  useEffect(() => {
    function onAsk(event: Event) {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim();
      if (!prompt) return;
      pendingAsk.current = prompt;
      setOpen(true);
      setAskNonce((n) => n + 1);
    }
    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, []);

  // Welcome only when the user opens the widget by hand — not when a desk
  // already queued a prompt (that would race and wipe the user message).
  useEffect(() => {
    if (!open) return;
    setMessages((m) => {
      if (m.length > 0 || pendingAsk.current) return m;
      return [
        {
          id: "welcome",
          type: "ai",
          content:
            "Hi! I'm your AI assistant. Ask me about campaigns, ROAS, or creative strategy.",
          createdAt: new Date(),
        },
      ];
    });
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        type: "user",
        content: trimmed,
        createdAt: new Date(),
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
      setMessages((m) => [
        ...m,
        {
          id: aiMsgId,
          type: "ai",
          content: "",
          createdAt: new Date(),
          isStreaming: true,
        },
      ]);

      try {
        let fullContent = "";
        await streamChat(
          trimmed,
          (token) => {
            fullContent += token;
            setMessages((m) =>
              m.map((msg) =>
                msg.id === aiMsgId ? { ...msg, content: fullContent } : msg,
              ),
            );
          },
          history,
        );
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? { ...msg, isStreaming: false, type: detectMessageType(fullContent) }
              : msg,
          ),
        );
      } catch {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  content: "Sorry, something went wrong. Please try again.",
                  isStreaming: false,
                }
              : msg,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages],
  );

  useEffect(() => {
    if (!open || isSending) return;
    const prompt = pendingAsk.current;
    if (!prompt) return;
    pendingAsk.current = null;
    void sendMessage(prompt);
  }, [open, isSending, askNonce, sendMessage]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-2xl shadow-purple-500/30 transition-transform hover:scale-105"
        whileTap={{ scale: 0.92 }}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquare className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 flex w-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
            style={{ height: "500px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">AI Assistant</p>
                  <p className="text-[10px] text-white/40">
                    Campaign analytics & insights
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Live
              </span>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin"
            >
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MiniMessage key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {isSending && messages[messages.length - 1]?.content === "" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-blue-500">
                    <Bot className="h-3 w-3 text-white" />
                  </span>
                  <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick chips */}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {["Name the five clocks", "Find wasted spend", "Top campaigns"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/50 transition-colors hover:border-purple-400/30 hover:text-white/80"
                    >
                      <Sparkles className="mr-1 inline-block h-2.5 w-2.5 text-purple-300" />
                      {s}
                    </button>
                  ),
                )}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-white/10 p-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about marketing…"
                disabled={isSending}
                className="h-9 min-w-0 flex-1 bg-transparent px-2 text-xs text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white transition-all hover:from-purple-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
