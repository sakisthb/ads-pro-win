"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  Command,
  ExternalLink,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Mail,
  MessageCircle,
  Plug,
  Search,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useActiveOrg } from "@/hooks/use-active-org";
import { TRACKING_WORKSTREAMS } from "@/lib/tracking-ops";

// ---------------------------------------------------------------------------
// Platform color system
// ---------------------------------------------------------------------------
const PLATFORMS = {
  Meta: { color: "#1877F2", label: "Meta Ads" },
  Google: { color: "#4285F4", label: "Google Ads" },
  TikTok: { color: "#FF0050", label: "TikTok Ads" },
  WooCommerce: { color: "#96588A", label: "WooCommerce" },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FAQItem {
  question: string;
  answer: string;
  category: "general" | "platforms" | "analytics" | "export" | "demo";
}

interface TipItem {
  title: string;
  description: string;
  icon: typeof Search;
  category: "beginner" | "intermediate" | "advanced";
}

interface PlatformGuide {
  platform: PlatformKey;
  steps: string[];
  time: string;
}

// ---------------------------------------------------------------------------
// Demo data — inline, presentation only
// ---------------------------------------------------------------------------
const FAQ_DATA: FAQItem[] = [
  {
    question: "How do I connect my Meta Ads account?",
    answer:
      "Navigate to Settings → Connections and click Connect on the Meta Ads card. The secure OAuth flow will request ads_read and ads_management scopes. Once granted, the platform syncs account structure, historical performance, and sets up automatic token refresh — you never need to re-authenticate manually.",
    category: "platforms",
  },
  {
    question: "How do I connect Google Ads and TikTok Ads?",
    answer:
      "Both platforms connect from the same Connections page. Google Ads uses an OAuth consent screen scoped to your MCC hierarchy, while TikTok requires an Authorized Access Token generated from your TikTok Ads Manager developer settings. WooCommerce connects via the store REST API keys plus the plugin webhook.",
    category: "platforms",
  },
  {
    question: "What is Demo Mode?",
    answer:
      "Demo Mode populates every page with realistic simulated data across all four platforms. It is perfect for presentations, team training, and evaluating workflows before connecting live accounts. Toggle it from the workspace switcher — your real data stays untouched.",
    category: "demo",
  },
  {
    question: "How do I export my data?",
    answer:
      "Every analytics view has an Export action supporting CSV, JSON, and PDF. Exports respect your current filters and date ranges. Scheduled reports can also be delivered automatically via email — configure them under Reports → Automated.",
    category: "export",
  },
  {
    question: "How do I interpret the analytics dashboards?",
    answer:
      "Start with the blended KPIs (spend, revenue, ROAS, CPA) on the dashboard, then drill into the platform breakdown to spot imbalances. The attribution view shows how platforms assist each other, and predictions surface forward-looking opportunities. All charts support custom date ranges and platform filters.",
    category: "analytics",
  },
  {
    question: "Why is my data not loading?",
    answer:
      "First check the Connections page for expired tokens or revoked permissions — the most common cause. Then verify the selected date range actually has data. If a platform shows a sync delay banner, metrics are frozen but will backfill automatically once the sync completes.",
    category: "platforms",
  },
  {
    question: "What are the keyboard shortcuts?",
    answer:
      "Press Cmd/Ctrl + K for global search, Cmd/Ctrl + ? for the shortcut overlay, G then D to jump to the dashboard, and G then R for reports. The full list lives in the Shortcuts section below.",
    category: "general",
  },
  {
    question: "How are currency and timezone handled?",
    answer:
      "Choose Euro or US Dollar on your Profile page. Dashboards, campaigns, and exports follow that choice. Timezone is set under Profile → Preferences — important for daily budget pacing and attribution windows that span midnight.",
    category: "general",
  },
  {
    question: "Can I invite my team?",
    answer:
      "Yes — Team management lives under Settings → Team. Invite members by email, assign roles (Admin, Analyst, Viewer), and organize people into workspaces. Role-based access controls which platforms and cost data each member can see.",
    category: "general",
  },
];

const LIVE_FAQ: FAQItem[] = [
  {
    question: "How do I connect Meta Ads?",
    answer:
      "Open Connections (not Settings) and click Connect on Meta. OAuth stores an encrypted token on this workspace. After connect, use Sync Now so DailyMetric and campaigns backfill. Creative Fatigue reads live Graph ads, not only the daily rollup.",
    category: "platforms",
  },
  {
    question: "How do I connect Google, TikTok, or WooCommerce?",
    answer:
      "Same Connections page. Google Ads, Analytics, Search Console, and TikTok use OAuth. Google Ads Connect also needs GOOGLE_ADS_DEVELOPER_TOKEN (OAuth can reuse the Analytics client). WooCommerce uses the store URL plus REST consumer key and secret — there is no Ads Pro WordPress plugin. Store API calls must use the apex host, never a language subdomain (example: shop.com, not en.shop.com).",
    category: "platforms",
  },
  {
    question: "Does Attribution split credit across Meta, Google, and TikTok?",
    answer:
      "No. Live Attribution is last-click from Woo UTMs plus till vs pixel. It now also shows aMER (new-customer net / spend), channel gross profit, and refunds. Those are still last-click, not journeys. The model picker does not change numbers.",
    category: "analytics",
  },
  {
    question: "Can I pause ads or cut budget from Creative Fatigue?",
    answer:
      "Pause and a 50% ad-set budget cut write to live Meta after a confirm dialog. Do not bulk-pause. Advantage+ campaign budget (CBO) often has no ad-set daily_budget, so that cut will fail — keep the catalog as control and ship a new UGC/carousel instead.",
    category: "analytics",
  },
  {
    question: "What is SEO vs GEO vs AEO on Search Lab?",
    answer:
      "SEO, GEO, and AEO are separate tabs on Search Lab. SEO is Search Console clicks, impressions, query position bands, and on-site tags — not keyword volume or DA. GEO is GA4 generative-engine sessions (AI Assistant / Organic AI), the full GA4 channel table, llms.txt, and named AI crawlers — not ChatGPT rankings. AEO is question-shaped GSC queries and FAQ/Q&A JSON-LD — not a featured-snippet tracker. None of these enter Pixel ROAS or Store MER.",
    category: "analytics",
  },
  {
    question: "What are the five clocks?",
    answer:
      "Pixel (paid-ad spend and claimed conversions), till (Woo paid orders), GA4 (site sessions and ecommerce purchases), Search Console (clicks and impressions, €0 value, not Google Ads), and email (Brevo / Omnisend delivered). Dashboard names them on one strip. Do not add them into one ROAS.",
    category: "analytics",
  },
  {
    question: "How do retail and wholesale desks work?",
    answer:
      "Shop identity is a setting on the workspace (Settings) or per brand (Brands), not a guest=retail guess. Mixed shops such as BAGTOBAG classify each Woo order and leave unnamed ads unclassified — do not divide wholesale till by total Meta spend. A future retail-only or wholesale-only organization inherits that desk for guests, registered customers, and unnamed campaigns. Explicit opposite signals still show as a leak. After you change the identity, Sync Woo so new orders relabel. GSC and GA4 are not this dimension.",
    category: "analytics",
  },
  {
    question: "Where is Brevo?",
    answer:
      "Email desk in the sidebar (Email · Brevo). Dashboard still shows a summary strip. Connect and Sync Now live on Connections, card labelled Brevo. The desk splits ΛΙΑΝΙΚΗ vs χονδρικη, cites Apple MPP leftover uniqueViews (not proven human), and can show Woo last-click email as till — split proven Brevo UTM vs Gmail-app last-click. Never Pixel ROAS. Brevo campaigns API still has no order money. A 30-day dashboard with 0 delivered is not 0 influence — widen to 180 days.",
    category: "platforms",
  },
  {
    question: "How do I export?",
    answer:
      "Reports builds CSV and PDF from blended metrics, accounts, campaigns, and till vs pixel (MER, aMER, Net ex VAT). When Brevo is connected, a separate sheet titled ESP email (not till, not pixel) lists delivered, unique opens, clicks, Apple MPP leftover, and retail/wholesale delivered. That sheet is not added to spend or Pixel ROAS. Creative Fatigue also has a CSV of ads. There is no scheduled email report yet.",
    category: "export",
  },
  {
    question: "What is aMER vs Store MER?",
    answer:
      "Store MER is all till net / all ad spend in the window. aMER is only new-customer net / the same spend. Repeats and Direct can make MER look healthy while acquisition is expensive. Neither number is incremental ROAS. Pixel ROAS is the in-channel tactic; MER/aMER are P&L. Do not scale Advantage+ off a high MER.",
    category: "analytics",
  },
  {
    question: "Why are pixel purchases fewer than store orders?",
    answer:
      "Ads Pro reads both. Closing the gap is a store-side Meta job: one CAPI stack (Facebook for WooCommerce or PixelYourSite or sGTM — not two), Woo order id as event_id on Pixel and CAPI, hashed email/phone, unhashed fbp/fbc/IP/UA. Events Manager EMQ ≥ 6, aim 8+ on Purchase, dedup ≥90%. Funnel purchases are pixel, not till. GA4 ecommerce is a third clock — do not add them.",
    category: "platforms",
  },
  {
    question: "How do I close GA4 purchases vs Woo orders?",
    answer:
      "Thank-you JavaScript misses blocked browsers, declined consent, and payment-redirect drop-offs. Keep client GA4 for behaviour. Send purchase from woocommerce_payment_complete via Measurement Protocol with transaction_id = Woo order id, plus client_id and session_id. sGTM alone does not recover orders the browser never sent.",
    category: "platforms",
  },
  {
    question: "What is GA4 Unassigned?",
    answer:
      "Sessions GA4 could not map to any default channel, including Direct. Cause is usually stripped UTMs, payment redirects, consent cookieless pings, or Measurement Protocol hits without session_id. It is not a bid channel. Require source+medium+campaign on every paid link. Do not stamp a persistent server id onto denied-consent pings.",
    category: "analytics",
  },
  {
    question: "Why is Net ex VAT the same as store net?",
    answer:
      "Woo REST total_tax and cart_tax are 0 on those orders. Enable WooCommerce taxes (Greece 24% standard if that is the catalog) and re-sync. Ads Pro will not invent ΦΠΑ.",
    category: "analytics",
  },
  {
    question: "How do I invite the team?",
    answer:
      "Use Team (not Settings → Team). Invite by email with admin, member, or viewer. The Demo workspace is a separate sample org in the switcher — live shop data stays on your personal workspace.",
    category: "general",
  },
  {
    question: "Why is data empty or stale?",
    answer:
      "Check Connections for token expiry, then Sync Now. Widen the date range. Woo orders need a successful store sync. Pixel purchases without Woo orders cannot produce MER. Google Connect 503 means GOOGLE_ADS_DEVELOPER_TOKEN is missing — apply on an MCC at ads.google.com/aw/apicenter. OAuth can reuse GOOGLE_ANALYTICS_CLIENT_*.",
    category: "platforms",
  },
  {
    question: "What does Realtime show?",
    answer:
      "Two clocks. Site now is GA4 Realtime: active users in the last ~30 minutes, plus country, device, and page. Ads today is paid DailyMetric (Meta/Google Ads/TikTok) polled over HTTP — not a WebSocket. Settled GA4 sessions and ecommerce purchases sit in the three-lens strip next to Woo last-click and pixel ROAS. Those three numbers are different models; do not add them. GA4 never enters Pixel ROAS or Store MER.",
    category: "analytics",
  },
];

const LIVE_TIPS: TipItem[] = [
  {
    title: "Confirm before you write Meta",
    description:
      "Pause and budget cut dialogs are real. Cancel in QA. Bidding suggestions do not write bids.",
    icon: Bell,
    category: "beginner",
  },
  {
    title: "Use Reports for a client CSV",
    description:
      "Pick the date range and platforms, then download CSV. MER, aMER, new-customer net, and Net ex VAT are included when Woo has synced.",
    icon: ExternalLink,
    category: "beginner",
  },
  {
    title: "Read Creative Fatigue before scaling",
    description:
      "CPA inflation with a holding CTR is not a bid problem. Refresh creative or fix the offer URL on the live shop.",
    icon: TrendingUp,
    category: "intermediate",
  },
  {
    title: "Command palette",
    description:
      "Press Cmd/Ctrl + K to jump desks. Ask AI (floating chat or /chat) for a brief grounded in this org.",
    icon: Keyboard,
    category: "intermediate",
  },
  {
    title: "Budget alerts are rules you own",
    description:
      "Create daily/weekly spend thresholds on Budget Alerts. Fires land in Notifications. Channel email/Slack toggles are not persisted yet.",
    icon: Bell,
    category: "intermediate",
  },
  {
    title: "Funnel leakage is pixel drop-off",
    description:
      "Live Funnel does not have page-speed events. Leakage is impressions → clicks → pixel stages → purchases from this window.",
    icon: BarChart3,
    category: "advanced",
  },
];

const LIVE_GUIDES: PlatformGuide[] = [
  {
    platform: "Meta",
    time: "~2 min",
    steps: [
      "Open Connections → Meta → Connect",
      "Approve ads access, then Sync Now",
      "Confirm Creative Fatigue shows the live ads",
      "In Meta Events Manager, one CAPI stack, event_id = order id, EMQ ≥ 6 aim 8+",
    ],
  },
  {
    platform: "Google",
    time: "~3 min",
    steps: [
      "Open Connections → Google Ads → Connect",
      "If Connect 503s, add GOOGLE_ADS_DEVELOPER_TOKEN from ads.google.com/aw/apicenter (MCC)",
      "Pick the customer / MCC account",
      "Sync before expecting Search or PMax rows",
    ],
  },
  {
    platform: "TikTok",
    time: "~3 min",
    steps: [
      "Open Connections → TikTok → Connect",
      "Approve the advertiser account",
      "Sync — this desk will not invent a second channel",
    ],
  },
  {
    platform: "WooCommerce",
    time: "~4 min",
    steps: [
      "WooCommerce → Settings → Advanced → REST API → add key (read)",
      "Paste store URL, consumer key, and secret on Connections",
      "Use the apex host only, then Sync Now for orders and catalog",
    ],
  },
];

const TIPS_DATA: TipItem[] = [
  {
    title: "Master the filters",
    description:
      "Filters compound across the entire analytics suite. Combining a platform filter with a custom date range lets you isolate exactly the performance story you need.",
    icon: Search,
    category: "beginner",
  },
  {
    title: "Export on a schedule",
    description:
      "Skip manual downloads — set up a weekly automated report that lands in every stakeholder's inbox before Monday standup.",
    icon: ExternalLink,
    category: "beginner",
  },
  {
    title: "Watch the trends, not the snapshots",
    description:
      "Day-to-day numbers fluctuate. The 7-day trend lines smooth out noise and reveal the direction that actually matters for budget decisions.",
    icon: TrendingUp,
    category: "intermediate",
  },
  {
    title: "Learn the keyboard shortcuts",
    description:
      "Power users navigate the whole app without touching the mouse. Cmd+K plus two-letter jumps get you anywhere in under a second.",
    icon: Keyboard,
    category: "intermediate",
  },
  {
    title: "Let alerts work for you",
    description:
      "Configure budget pacing and anomaly alerts once, and the notification center becomes your safety net — no more manual budget check-ins.",
    icon: Bell,
    category: "intermediate",
  },
  {
    title: "Analyze the full funnel",
    description:
      "The funnel view connects impressions to purchases across platforms, exposing exactly where prospects drop off before converting.",
    icon: BarChart3,
    category: "advanced",
  },
];

const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    platform: "Meta",
    time: "~2 min",
    steps: [
      "Open Settings → Connections → Meta Ads",
      "Authorize with Facebook OAuth (ads_read + ads_management)",
      "Select the ad accounts and pages to sync",
    ],
  },
  {
    platform: "Google",
    time: "~3 min",
    steps: [
      "Open Settings → Connections → Google Ads",
      "Grant access to your MCC or individual accounts",
      "Enable conversion import for cross-platform attribution",
    ],
  },
  {
    platform: "TikTok",
    time: "~4 min",
    steps: [
      "Generate an Authorized Access Token in TikTok Ads Manager",
      "Paste the token in Settings → Connections → TikTok",
      "Select the advertiser accounts to monitor",
    ],
  },
  {
    platform: "WooCommerce",
    time: "~5 min",
    steps: [
      "Install the Ads Pro plugin on your store",
      "Generate REST API keys with read access",
      "Paste the keys plus store URL to sync your catalog",
    ],
  },
];

const SHORTCUTS = [
  { keys: ["⌘", "K"], action: "Global search" },
  { keys: ["⌘", "?"], action: "Shortcut overlay" },
  { keys: ["G", "D"], action: "Go to Dashboard" },
  { keys: ["G", "R"], action: "Go to Reports" },
  { keys: ["G", "P"], action: "Go to Predictions" },
  { keys: ["⌘", "\\"], action: "Toggle sidebar" },
  { keys: ["Esc"], action: "Close dialogs" },
  { keys: ["?"], action: "Show this help page" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TIP_CATEGORY_STYLES: Record<TipItem["category"], string> = {
  beginner: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  intermediate: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  advanced: "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

const CATEGORIES: { id: "all" | FAQItem["category"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "general", label: "General" },
  { id: "platforms", label: "Platforms" },
  { id: "analytics", label: "Analytics" },
  { id: "export", label: "Export" },
  { id: "demo", label: "Demo" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HelpPage() {
  const { isDemo, isLoading } = useActiveOrg();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | FAQItem["category"]>("all");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const faqData = isDemo ? FAQ_DATA : LIVE_FAQ;
  const tipsData = isDemo ? TIPS_DATA : LIVE_TIPS;
  const guides = isDemo ? PLATFORM_GUIDES : LIVE_GUIDES;
  const categories = isDemo ? CATEGORIES : CATEGORIES.filter((c) => c.id !== "demo");

  const filteredFAQ = faqData.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.question.toLowerCase().includes(term) || item.answer.toLowerCase().includes(term);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredTips = tipsData.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
    return matchesSearch;
  });

  const categoryCount = (id: "all" | FAQItem["category"]) =>
    id === "all" ? faqData.length + tipsData.length : faqData.filter((f) => f.category === id).length;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Hero */}
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2"
        >
          <Sparkles className="h-4 w-4 text-blue-300" />
          <span className="text-sm font-semibold text-blue-300">Help &amp; Support</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent"
        >
          How can we help?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.5 }}
          className="mx-auto max-w-2xl text-zinc-400"
        >
          {isDemo
            ? "Find answers, learn the workflows, and reach out whenever you need a hand — average first response time is under 2 hours."
            : "Operator answers for this workspace: CAPI/EMQ, GA4 vs till, Unassigned, Google Ads API token, Woo VAT, Connections, and Creative Fatigue writes."}
        </motion.p>
      </div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative mx-auto max-w-2xl"
      >
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder="Search help articles, guides, and tips…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 pr-4 text-base text-white shadow-lg shadow-black/20 backdrop-blur-xl placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-blue-500/30"
        />
        <Badge
          variant="outline"
          className="absolute right-3 top-1/2 hidden -translate-y-1/2 border-white/10 bg-white/5 text-zinc-500 sm:inline-flex"
        >
          <Command className="mr-1 h-3 w-3" />K
        </Badge>
      </motion.div>

      {!isDemo && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Store tracking playbook</h2>
          <p className="text-sm text-zinc-400">
            Ads Pro cannot fire CAPI or Measurement Protocol. These five jobs live on the shop and Google Cloud.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {TRACKING_WORKSTREAMS.map((w) => (
              <Card key={w.id} id={w.id} className={cn(GLASS, "p-0 scroll-mt-24")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">{w.title}</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">{w.owner}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  <p className="text-xs leading-relaxed text-zinc-300">{w.gap}</p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-zinc-400">
                    {w.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="text-xs text-zinc-500">{w.verify}</p>
                  <p className="text-[11px] text-amber-200/80">{w.doNot}</p>
                  <div className="flex flex-wrap gap-2">
                    {w.docs.map((doc) => (
                      <a
                        key={doc.href}
                        href={doc.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-blue-300 hover:text-blue-200"
                      >
                        {doc.label}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              selectedCategory === category.id
                ? "border-blue-500/50 bg-blue-500/20 text-blue-200 shadow-lg shadow-blue-500/10"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            {category.label}
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
              {categoryCount(category.id)}
            </span>
          </button>
        ))}
      </div>

      {/* FAQ + Tips */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* FAQ */}
        <Card className={cn(GLASS, "p-0")}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2">
                <HelpCircle className="h-5 w-5 text-blue-400" />
              </div>
              Frequently Asked Questions
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Answers to the questions we hear most often
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredFAQ.length > 0 ? (
              filteredFAQ.map((item, index) => {
                const isOpen = expandedFAQ === index;
                return (
                  <div key={item.question} className="rounded-xl">
                    <button
                      type="button"
                      onClick={() => setExpandedFAQ(isOpen ? null : index)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all",
                        isOpen
                          ? "border-blue-500/30 bg-blue-500/10"
                          : "border-transparent hover:border-white/10 hover:bg-white/5",
                      )}
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-white">{item.question}</span>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-300",
                          isOpen && "rotate-180 text-blue-300",
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-2">
                            <div className="mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <p className="text-sm leading-relaxed text-zinc-300">{item.answer}</p>
                            <Badge
                              variant="outline"
                              className="mt-3 border-white/10 bg-white/5 text-xs capitalize text-zinc-400"
                            >
                              {item.category}
                            </Badge>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <HelpCircle className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                <p className="text-zinc-500">No results found — try a different search term</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className={cn(GLASS, "p-0")}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2">
                <Lightbulb className="h-5 w-5 text-yellow-400" />
              </div>
              Pro Tips
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Get more out of the platform, faster
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredTips.length > 0 ? (
              filteredTips.map((tip, index) => (
                <motion.div
                  key={tip.title}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index, duration: 0.4 }}
                  className="group flex items-start gap-4 rounded-xl border border-transparent p-4 transition-all hover:border-white/10 hover:bg-white/5"
                >
                  <div className="shrink-0 rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/15 to-violet-500/10 p-2.5 transition-transform duration-300 group-hover:scale-110">
                    <tip.icon className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-1.5 font-semibold text-white">{tip.title}</h4>
                    <p className="mb-3 text-sm leading-relaxed text-zinc-400">{tip.description}</p>
                    <Badge className={cn("border capitalize", TIP_CATEGORY_STYLES[tip.category])}>
                      {tip.category}
                    </Badge>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Lightbulb className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                <p className="text-zinc-500">No tips match your search</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform connection guides */}
      <div className={cn(GLASS, "p-6")}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Connect Your Platforms</h3>
          </div>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
            4 integrations available
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {guides.map((guide, index) => {
            const platform = PLATFORMS[guide.platform];
            return (
              <motion.div
                key={guide.platform}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.06 * index, duration: 0.4 }}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="rounded-lg px-2.5 py-1 text-sm font-bold text-white"
                    style={{
                      backgroundColor: `${platform.color}2e`,
                      border: `1px solid ${platform.color}66`,
                    }}
                  >
                    {platform.label}
                  </span>
                  <span className="text-xs text-zinc-500">{guide.time}</span>
                </div>
                <ol className="space-y-2.5">
                  {guide.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `${platform.color}33`,
                          color: platform.color,
                          border: `1px solid ${platform.color}66`,
                        }}
                      >
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className={cn(GLASS, "p-6")}>
        <div className="mb-6 flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-violet-400" />
          <h3 className="font-semibold text-white">Keyboard Shortcuts</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="text-sm text-zinc-300">{shortcut.action}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-white"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className={cn(GLASS, "relative overflow-hidden p-6")}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-violet-500/10" />
        <div className="relative">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 p-3 shadow-lg shadow-blue-500/20">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white">
              {isDemo ? "Talk to a Human" : "Next desks"}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {isDemo
                ? "Our team of media buyers and engineers answers every message"
                : "There is no 2-hour SLA inbox here. Use Ask AI, Connections, or Team on this workspace."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(isDemo
              ? [
                  {
                    icon: Mail,
                    title: "Email Support",
                    detail: "support@adspro.com",
                    note: "Replies within 2 hours",
                    href: null as string | null,
                    gradient: "from-blue-500 to-blue-600",
                  },
                  {
                    icon: BookOpen,
                    title: "Documentation",
                    detail: "docs.adspro.com",
                    note: "Guides, API reference, recipes",
                    href: null,
                    gradient: "from-emerald-500 to-emerald-600",
                  },
                  {
                    icon: Video,
                    title: "Video Tutorials",
                    detail: "youtube.com/@adspro",
                    note: "Deep dives and walkthroughs",
                    href: null,
                    gradient: "from-red-500 to-red-600",
                  },
                ]
              : [
                  {
                    icon: Sparkles,
                    title: "Ask AI",
                    detail: "/chat",
                    note: "Brief grounded in this org",
                    href: "/chat",
                    gradient: "from-blue-500 to-violet-600",
                  },
                  {
                    icon: Plug,
                    title: "Connections",
                    detail: "OAuth and Woo REST keys",
                    note: "Sync before expecting rows",
                    href: "/connections",
                    gradient: "from-emerald-500 to-emerald-600",
                  },
                  {
                    icon: BookOpen,
                    title: "Team",
                    detail: "Invite admin, member, viewer",
                    note: "Not Settings → Team",
                    href: "/team",
                    gradient: "from-amber-500 to-orange-600",
                  },
                ]
            ).map((channel) => {
              const inner = (
                <>
                  <div
                    className={cn(
                      "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110",
                      channel.gradient,
                    )}
                  >
                    <channel.icon className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-semibold text-white">{channel.title}</h4>
                  <p className="mt-1 text-sm text-zinc-300">{channel.detail}</p>
                  <p className="mt-1 text-xs text-zinc-500">{channel.note}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" />
                  </span>
                </>
              );
              const className =
                "group rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-white/20 hover:bg-white/10";
              return channel.href ? (
                <Link key={channel.title} href={channel.href} className={className}>
                  {inner}
                </Link>
              ) : (
                <button key={channel.title} type="button" className={className}>
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
