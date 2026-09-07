"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Activity,
  MessageSquare,
  Brain,
  GitBranch,
  Filter,
  Users,
  Layers,
  Zap,
  AlertTriangle,
  Rocket,
  ShieldAlert,
  Radar,
  FileText,
  Plug,
  UsersRound,
  Bell,
  ClipboardCheck,
  CreditCard,
  Settings,
  HelpCircle,
  UserCircle,
  Sparkles,
  UserCheck,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Page registry — all 27 pages grouped by section
// ---------------------------------------------------------------------------
interface CommandItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: string;
  shortcut?: string;
}

const OPEN_COMMAND_PALETTE = "adspro:open-command-palette";

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
  }
}

const COMMAND_ITEMS: CommandItem[] = [
  // MAIN
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "MAIN", shortcut: "G D" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, section: "MAIN", shortcut: "G C" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, section: "MAIN", shortcut: "G A" },
  { label: "Analytics Studio", href: "/analytics-studio", icon: Sparkles, section: "MAIN" },
  { label: "Real-Time", href: "/realtime", icon: Activity, section: "MAIN" },
  { label: "AI Chat", href: "/chat", icon: MessageSquare, section: "MAIN" },
  // INTELLIGENCE
  { label: "AI Predictions", href: "/predictions", icon: Brain, section: "INTELLIGENCE" },
  { label: "Mystery AI", href: "/mystery-ai", icon: Sparkles, section: "INTELLIGENCE" },
  { label: "Attribution", href: "/attribution", icon: GitBranch, section: "INTELLIGENCE" },
  { label: "Funnel Analysis", href: "/funnel", icon: Filter, section: "INTELLIGENCE" },
  { label: "Audiences", href: "/audiences", icon: Users, section: "INTELLIGENCE" },
  { label: "Cross-Platform", href: "/cross-platform", icon: Layers, section: "INTELLIGENCE" },
  { label: "Bid Management", href: "/bidding", icon: Zap, section: "INTELLIGENCE" },
  { label: "Creative Fatigue", href: "/creative-fatigue", icon: AlertTriangle, section: "INTELLIGENCE" },
  { label: "SEO · GEO · AEO", href: "/seo", icon: Search, section: "INTELLIGENCE" },
  { label: "SEO desk", href: "/seo?desk=seo", icon: Search, section: "INTELLIGENCE" },
  { label: "GEO desk", href: "/seo?desk=geo", icon: Search, section: "INTELLIGENCE" },
  { label: "AEO desk", href: "/seo?desk=aeo", icon: Search, section: "INTELLIGENCE" },
  { label: "Email · Brevo", href: "/email", icon: Mail, section: "INTELLIGENCE" },
  // AUTOMATION
  { label: "Campaign Studio", href: "/campaign-launcher", icon: Rocket, section: "AUTOMATION" },
  { label: "First session", href: "/onboarding", icon: ClipboardCheck, section: "AUTOMATION" },
  { label: "Budget Alerts", href: "/budget-alerts", icon: ShieldAlert, section: "AUTOMATION" },
  { label: "Mission Control", href: "/mission-control", icon: Radar, section: "AUTOMATION" },
  // TOOLS
  { label: "Report Builder", href: "/reports", icon: FileText, section: "TOOLS" },
  { label: "Connections", href: "/connections", icon: Plug, section: "TOOLS" },
  { label: "Customers", href: "/customers", icon: UserCheck, section: "TOOLS" },
  { label: "AI Team", href: "/team", icon: UsersRound, section: "TOOLS" },
  // ACCOUNT
  { label: "Notifications", href: "/notifications", icon: Bell, section: "ACCOUNT" },
  { label: "Billing", href: "/billing", icon: CreditCard, section: "ACCOUNT" },
  { label: "Settings", href: "/settings", icon: Settings, section: "ACCOUNT" },
  { label: "Help", href: "/help", icon: HelpCircle, section: "ACCOUNT" },
  { label: "Profile", href: "/profile", icon: UserCircle, section: "ACCOUNT" },
];

// ---------------------------------------------------------------------------
// Fuzzy match — simple but effective
// ---------------------------------------------------------------------------
function fuzzyMatch(query: string, label: string): boolean {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  let qi = 0;
  for (let li = 0; li < l.length && qi < q.length; li++) {
    if (l[li] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ---------------------------------------------------------------------------
// Command Palette
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items by fuzzy search
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMAND_ITEMS;
    return COMMAND_ITEMS.filter((item) => fuzzyMatch(query, item.label));
  }, [query]);

  // Group filtered items by section
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatItems = useMemo(() => Object.values(grouped).flat(), [grouped]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const handleOpen = () => {
      setOpen(true);
      setQuery("");
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE, handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE, handleOpen);
    };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation inside the list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) {
          router.push(item.href);
          setOpen(false);
          setQuery("");
        }
      }
    },
    [flatItems, activeIndex, router]
  );

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = (href: string) => {
    router.push(href);
    setOpen(false);
    setQuery("");
  };

  // Track flat index across groups
  let flatIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[999] flex items-start justify-center pt-[18vh]"
          onClick={() => { setOpen(false); setQuery(""); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl" />

          {/* Palette */}
          <motion.div
            key="cmd-panel"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-gray-950/95 shadow-2xl shadow-black/60 backdrop-blur-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-white/40" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none"
              />
              <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/40 sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div
              ref={listRef}
              className="max-h-80 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10"
            >
              {flatItems.length === 0 && (
                <p className="py-8 text-center text-sm text-white/35">
                  No results found for &quot;{query}&quot;
                </p>
              )}

              {Object.entries(grouped).map(([section, items]) => (
                <div key={section} className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                    {section}
                  </p>
                  {items.map((item) => {
                    const isActive = flatIdx === activeIndex;
                    const thisIdx = flatIdx;
                    flatIdx++;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        data-active={isActive}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setActiveIndex(thisIdx)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/65 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-purple-400" : "text-white/40")} />
                        <span className="truncate">{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-[10px] text-white/30">{item.shortcut}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-white/35">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5">↵</kbd>
                  open
                </span>
              </div>
              <span>{flatItems.length} pages</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
