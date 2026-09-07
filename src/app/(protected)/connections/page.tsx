"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Bricolage_Grotesque } from "next/font/google";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Key,
  Loader2,
  Mail,
  Plug,
  Plus,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { AnimatedSection } from "@/components/ui/animated-section";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { dailySyncVolume, sparklineForPlatform } from "@/lib/sync-sparkline";
import {
  StatusBadge,
  type ConnectionStatus,
} from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { TRACKING_WORKSTREAMS } from "@/lib/tracking-ops";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

/* -------------------------------------------------------------------------- */
/* Types & Constants                                                           */
/* -------------------------------------------------------------------------- */

type PlatformId = "meta" | "google-ads" | "google-analytics" | "google-search-console" | "tiktok" | "woocommerce" | "opencart" | "omnisend" | "brevo";
type PlatformStatus = "disconnected" | "connecting" | "connected" | "error";

interface PlatformDef {
  id: PlatformId;
  name: string;
  description: string;
  initial: string;
  accent: string;
  glow: string;
  barColor: string;
  kind: "oauth" | "form";
  authPath?: string;
  externalUrl?: string;
  metricLabel: string;
  permissions: string[];
  /** Platform string stored in AdAccount.platform (used to match DB rows). */
  dbPlatform?: string;
  /** Platform string accepted by POST /api/sync/[platform]. */
  syncPlatform?: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "meta", name: "Meta Ads", initial: "M",
    description: "Sync Facebook & Instagram campaigns. Reconnect to grant ads_management before creating or pausing ads.",
    accent: "from-blue-600 to-blue-700", glow: "shadow-blue-500/30", barColor: "#3b82f6",
    kind: "oauth", authPath: "/api/auth/meta",
    externalUrl: "https://business.facebook.com/adsmanager",
    metricLabel: "Campaigns",
    permissions: ["ads_read", "ads_management", "business_management"],
    dbPlatform: "meta", syncPlatform: "meta",
  },
  {
    id: "google-ads", name: "Google Ads", initial: "G",
    description: "Pick the BAGTOBAG spend account (not the MCC), then Sync Now. Woo last-click Google on Attribution is till, not Ads spend.",
    accent: "from-red-500 to-yellow-500", glow: "shadow-red-500/25", barColor: "#ef4444",
    kind: "oauth", authPath: "/api/auth/google-ads",
    externalUrl: "https://ads.google.com/",
    metricLabel: "Campaigns",
    permissions: ["googleads.readonly", "googleads.manage"],
    dbPlatform: "google", syncPlatform: "google",
  },
  {
    id: "tiktok", name: "TikTok Ads", initial: "T",
    description: "Connect TikTok For Business campaigns. Needs TIKTOK_APP_ID and TIKTOK_APP_SECRET in .env.local (portal/auth, auth_code callback).",
    accent: "from-pink-500 to-cyan-500", glow: "shadow-pink-500/25", barColor: "#ec4899",
    kind: "oauth", authPath: "/api/auth/tiktok",
    externalUrl: "https://ads.tiktok.com/",
    metricLabel: "Campaigns",
    permissions: ["advertiser.read", "advertiser.manage", "report.read"],
    dbPlatform: "tiktok", syncPlatform: "tiktok",
  },
  {
    id: "google-analytics", name: "Google Analytics", initial: "A",
    description: "Import GA4 sessions, channels, and conversions. Pick a property, then Sync Now.",
    accent: "from-orange-500 to-yellow-500", glow: "shadow-orange-500/25", barColor: "#f97316",
    kind: "oauth", authPath: "/api/auth/google-analytics",
    externalUrl: "https://analytics.google.com/",
    metricLabel: "Properties",
    permissions: ["analytics.readonly"],
    dbPlatform: "google-analytics", syncPlatform: "google-analytics",
  },
  {
    id: "google-search-console", name: "Search Console", initial: "S",
    description: "Import Search Analytics clicks, impressions, and queries. Pick the shop property, then Sync Now.",
    accent: "from-sky-500 to-blue-600", glow: "shadow-sky-500/25", barColor: "#0ea5e9",
    kind: "oauth", authPath: "/api/auth/google-search-console",
    externalUrl: "https://search.google.com/search-console",
    metricLabel: "Sites",
    permissions: ["webmasters.readonly"],
    dbPlatform: "google-search-console", syncPlatform: "google-search-console",
  },
  {
    id: "woocommerce", name: "WooCommerce", initial: "W",
    description: "Orders, revenue and last-click mix from the store REST API. UI sync uses the saved key, not WOOCOMMERCE_* env vars.",
    accent: "from-purple-500 to-fuchsia-500", glow: "shadow-purple-500/25", barColor: "#a855f7",
    kind: "form", metricLabel: "Orders",
    permissions: ["read orders", "read products", "read customers"],
    dbPlatform: "woocommerce", syncPlatform: "woocommerce",
  },
  {
    id: "opencart", name: "OpenCart", initial: "O",
    description: "E-commerce platform – orders & products (read-only sync).",
    accent: "from-sky-500 to-cyan-500", glow: "shadow-sky-500/25", barColor: "#0ea5e9",
    kind: "form", metricLabel: "Orders",
    permissions: ["read orders", "read products"],
    dbPlatform: "opencart", syncPlatform: "opencart",
  },
  {
    id: "omnisend", name: "Omnisend", initial: "O",
    description: "Email & SMS marketing automation",
    accent: "from-green-500 to-emerald-500", glow: "shadow-green-500/25", barColor: "#22c55e",
    kind: "form", metricLabel: "Contacts",
    permissions: ["read contacts", "read campaigns"],
    dbPlatform: "omnisend", syncPlatform: "omnisend",
  },
  {
    id: "brevo", name: "Brevo", initial: "B",
    description: "Email marketing & CRM",
    accent: "from-blue-400 to-indigo-500", glow: "shadow-blue-500/25", barColor: "#6366f1",
    kind: "form", metricLabel: "Contacts",
    permissions: ["read contacts", "read campaigns"],
    dbPlatform: "brevo", syncPlatform: "brevo",
  },
];

interface PlatformState {
  status: PlatformStatus;
  error?: string;
  syncing?: boolean;
  metric?: number;
  successRate?: number;
  lastSync?: number;
  healthScore?: number;
  errorCount?: number;
  syncError?: string;
  syncSuccess?: boolean;
  accountName?: string;
  needsGa4Property?: boolean;
  needsGscSite?: boolean;
  needsGoogleAdsAccount?: boolean;
}

type StateMap = Record<PlatformId, PlatformState>;

const INITIAL_STATES: StateMap = {
  meta: { status: "disconnected" },
  "google-ads": { status: "disconnected" },
  "google-analytics": { status: "disconnected" },
  "google-search-console": { status: "disconnected" },
  tiktok: { status: "disconnected" },
  woocommerce: { status: "disconnected" },
  opencart: { status: "disconnected" },
  omnisend: { status: "disconnected" },
  brevo: { status: "disconnected" },
};

/* -------------------------------------------------------------------------- */
/* Sparkline helpers live in src/lib/sync-sparkline.ts                         */
/* -------------------------------------------------------------------------- */

interface SyncEvent {
  id: string;
  platform: PlatformId;
  records: number;
  duration: string;
  status: "success" | "partial" | "failed";
  timestamp: number;
}

function oauthEnvHint(id: PlatformId): string {
  if (id === "tiktok") {
    return "Add TIKTOK_APP_ID and TIKTOK_APP_SECRET to .env.local. TikTok uses portal/auth (app_id) and returns auth_code.";
  }
  if (id === "google-ads") {
    return "Add GOOGLE_ADS_DEVELOPER_TOKEN to .env.local (OAuth can reuse GOOGLE_ANALYTICS_CLIENT_*).";
  }
  if (id === "meta") {
    return "Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to .env.local.";
  }
  if (id === "google-analytics") {
    return "Add GOOGLE_ANALYTICS_CLIENT_ID and GOOGLE_ANALYTICS_CLIENT_SECRET to .env.local.";
  }
  if (id === "google-search-console") {
    return "Add Search Console OAuth env, or reuse GOOGLE_ANALYTICS_CLIENT_*.";
  }
  return "This OAuth client is not configured in .env.local.";
}

function platformIdFromDb(platform: string): PlatformId | null {
  if (platform === "google") return "google-ads";
  if (platform === "google-analytics") return "google-analytics";
  if (platform === "google-search-console") return "google-search-console";
  if (platform === "meta" || platform === "tiktok" || platform === "woocommerce" || platform === "opencart" || platform === "omnisend" || platform === "brevo") {
    return platform;
  }
  return null;
}

function syncDuration(startedAt: Date | string | null, completedAt: Date | string | null): string {
  if (!startedAt || !completedAt) return "—";
  const milliseconds = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.round(milliseconds / 1_000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function badgeStatus(s: PlatformState): ConnectionStatus {
  if (s.status === "connected") {
    if (s.syncing) return "syncing";
    if (s.syncError) return "error";
    return "connected";
  }
  if (s.status === "connecting") return "syncing";
  if (s.status === "error") return "error";
  return "disconnected";
}

function badgeLabel(s: PlatformState): string {
  if (s.status === "connected") {
    if (s.syncing) return "Syncing";
    if (s.syncError) return "Sync failed";
    return "Connected";
  }
  if (s.status === "connecting") return "Connecting";
  if (s.status === "error") return "Error";
  return "Not connected";
}

function relativeTime(ts?: number): string {
  if (!ts) return "Never";
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

/** Derive a 0–100 health score from the token expiry date. */
function deriveHealthScore(
  tokenExpiry: Date | null | undefined,
  isConnected: boolean,
): number {
  if (!isConnected) return 0;
  if (!tokenExpiry) return 100; // WooCommerce API keys don't expire
  const msLeft = tokenExpiry.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  const daysLeft = msLeft / 86_400_000;
  if (daysLeft <= 1) return 30;
  if (daysLeft <= 3) return 60;
  if (daysLeft <= 7) return 80;
  return 100;
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function HealthRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 95 ? "#34d399" : score >= 80 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute font-mono text-xs font-bold tabular-nums text-white">{score}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-gray-950/90 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-white/50">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono tabular-nums" style={{ color: p.color ?? "#fff" }}>
          {p.name}: {(p.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                   */
/* -------------------------------------------------------------------------- */

export default function ConnectionsPage() {
  // ── Brand selector ──
  const { data: brandsData, isLoading: brandsLoading } = api.connections.getBrands.useQuery(undefined);
  const { data: oauthReady } = api.connections.oauthReadiness.useQuery(undefined);
  const brands = useMemo(() => brandsData?.brands ?? [], [brandsData]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!brands.length || selectedBrandId) return;
    const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("brand") : null;
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem("adspro:active-brand");
    } catch {
      saved = null;
    }
    const preferred =
      (fromUrl && brands.some((b: { id: string }) => b.id === fromUrl) ? fromUrl : null) ||
      (saved && brands.some((b: { id: string }) => b.id === saved) ? saved : null) ||
      brands[0].id;
    setSelectedBrandId(preferred);
  }, [brands, selectedBrandId]);

  // ── Connections query (real DB status) ──
  const {
    data: connData,
    isLoading: connLoading,
    error: connError,
    refetch: refetchConnections,
  } = api.connections.list.useQuery(
    { brandId: selectedBrandId },
    { enabled: !!selectedBrandId },
  );
  const waiting = brandsLoading || Boolean(selectedBrandId && connLoading);
  const connections = useMemo(() => connData?.connections ?? [], [connData]);

  // ── Local overrides for transient UI state (syncing, sync feedback) ──
  const [localOverrides, setLocalOverrides] = useState<Partial<Record<PlatformId, Partial<PlatformState>>>>({});

  // ── Session-tracked sync events (real data, replaces mock generator) ──
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const persistedSyncEvents = useMemo<SyncEvent[]>(() => {
    return (connData?.recentJobs ?? []).reduce<SyncEvent[]>((events, job) => {
      if (job.status === "completed" || job.status === "failed") {
        const platform = platformIdFromDb(job.platform);
        if (!platform) return events;
        events.push({
          id: job.id,
          platform,
          records: job.recordsProcessed,
          duration: syncDuration(job.startedAt, job.completedAt),
          status: job.status === "completed" ? "success" : "failed",
          timestamp: new Date(job.completedAt ?? job.createdAt).getTime(),
        });
      }
      return events;
    }, []);
  }, [connData]);
  const visibleSyncEvents = useMemo(() => {
    const byId = new Map<string, SyncEvent>();
    for (const event of [...syncEvents, ...persistedSyncEvents]) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
    return Array.from(byId.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [syncEvents, persistedSyncEvents]);

  const allSyncJobs = useMemo(
    () => {
      const byId = new Map<string, SyncEvent>();
      for (const event of [...syncEvents, ...persistedSyncEvents]) {
        if (!byId.has(event.id)) byId.set(event.id, event);
      }
      return Array.from(byId.values());
    },
    [syncEvents, persistedSyncEvents],
  );
  const sparkByPlatform = useMemo(() => {
    const map = {} as Record<PlatformId, ReturnType<typeof sparklineForPlatform>>;
    for (const def of PLATFORMS) {
      map[def.id] = sparklineForPlatform(allSyncJobs, def.id);
    }
    return map;
  }, [allSyncJobs]);
  const volumeChart = useMemo(() => dailySyncVolume(allSyncJobs, 7), [allSyncJobs]);

  // ── WooCommerce form ──
  const [wooExpanded, setWooExpanded] = useState(false);
  const [wooUrl, setWooUrl] = useState("");
  const [wooKey, setWooKey] = useState("");
  const [wooSecret, setWooSecret] = useState("");
  const [wooSubmitting, setWooSubmitting] = useState(false);
  const [wooSaved, setWooSaved] = useState(false);
  const [wooError, setWooError] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connect = new URLSearchParams(window.location.search).get("connect");
    if (!connect) return;
    const id = connect === "google" ? "google-ads" : connect;
    if (id === "woocommerce") setWooExpanded(true);
    if (!PLATFORMS.some((p) => p.id === id)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  // ── OpenCart form ──
  const [ocExpanded, setOcExpanded] = useState(false);
  const [ocUrl, setOcUrl] = useState("");
  const [ocUsername, setOcUsername] = useState("");
  const [ocApiKey, setOcApiKey] = useState("");
  const [ocSubmitting, setOcSubmitting] = useState(false);
  const [ocSaved, setOcSaved] = useState(false);
  const [ocError, setOcError] = useState<string | undefined>();

  // ── API Key form (Omnisend / Brevo) ──
  const [apiKeyFormPlatform, setApiKeyFormPlatform] = useState<"omnisend" | "brevo" | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeySubmitting, setApiKeySubmitting] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | undefined>();

  const [modalPlatform, setModalPlatform] = useState<PlatformDef | null>(null);

  // ── Derive base states from the DB query ──
  const baseStates = useMemo<StateMap>(() => {
    const next: StateMap = { ...INITIAL_STATES };
    const map = new Map(connections.map((c) => [c.platform, c]));
    for (const def of PLATFORMS) {
      if (!def.dbPlatform) continue;
      const acct = map.get(def.dbPlatform);
      if (!acct) continue;
      if (acct.isConnected) {
        next[def.id] = {
          status: "connected",
          lastSync: acct.lastSyncAt
            ? (acct.lastSyncAt instanceof Date ? acct.lastSyncAt.getTime() : new Date(acct.lastSyncAt).getTime())
            : undefined,
          healthScore: deriveHealthScore(acct.tokenExpiry, true),
          metric: acct.latestJob?.recordsProcessed ?? 0,
          successRate: acct.successRate ?? 0,
          errorCount: acct.errorCount,
          syncError: acct.latestJob?.status === "failed"
            ? acct.latestJob.error ?? "Last sync failed."
            : undefined,
          accountName: acct.name,
          needsGa4Property: acct.needsGa4Property,
          needsGscSite: acct.needsGscSite,
          needsGoogleAdsAccount: acct.needsGoogleAdsAccount,
        };
      } else if (acct.tokenExpired) {
        next[def.id] = { status: "error", error: "Access token expired — reconnect to resume syncing." };
      }
    }
    return next;
  }, [connections]);

  // ── Merge DB base state + local overrides ──
  const states = useMemo<StateMap>(() => {
    const merged: StateMap = { ...baseStates };
    for (const def of PLATFORMS) {
      const ov = localOverrides[def.id];
      if (ov) merged[def.id] = { ...merged[def.id], ...ov };
    }
    return merged;
  }, [baseStates, localOverrides]);

  const update = useCallback((id: PlatformId, patch: Partial<PlatformState>) => {
    setLocalOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const disconnectMutation = api.connections.disconnect.useMutation({
    onSuccess: (res, vars) => {
      toast.success(`Disconnected ${res.name}.`);
      const id = platformIdFromDb(vars.platform);
      if (id) {
        setLocalOverrides((prev) => ({
          ...prev,
          [id]: { status: "disconnected", error: undefined, accountName: undefined, syncError: undefined },
        }));
      }
      void refetchConnections();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── OAuth connect (full-page redirect to the provider) ──
  const handleConnectOAuth = useCallback(async (def: PlatformDef) => {
    if (!def.authPath) {
      toast.error(`${def.name} has no OAuth connect path.`);
      return;
    }
    const qs = new URLSearchParams({ return: "/connections" });
    if (selectedBrandId) qs.set("brand", selectedBrandId);
    const href = `${def.authPath}?${qs.toString()}`;
    update(def.id, { status: "connecting", error: undefined });
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch(href, {
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (res.status === 503) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        update(def.id, {
          status: "error",
          error:
            data.error ??
            `${def.name} is not configured. Add the OAuth client id and secret in .env.local, then retry.`,
        });
        return;
      }
    } catch {
      // Fall through to a full navigation if the preflight fails.
    }
    window.location.assign(href);
  }, [update, selectedBrandId]);

  const startFormConnect = useCallback((def: PlatformDef) => {
    if (def.id === "woocommerce") setWooExpanded(true);
    else if (def.id === "opencart") setOcExpanded(true);
    else if (def.id === "omnisend" || def.id === "brevo") setApiKeyFormPlatform(def.id);
    requestAnimationFrame(() => {
      document.getElementById(def.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const startPlatformConnect = useCallback((def: PlatformDef) => {
    if (def.kind === "form") {
      startFormConnect(def);
      return;
    }
    void handleConnectOAuth(def);
  }, [startFormConnect, handleConnectOAuth]);

  // ── Sync Now — POST /api/sync/{platform} ──
  const handleSync = useCallback(async (id: PlatformId) => {
    const def = PLATFORMS.find((p) => p.id === id);
    if (!def?.syncPlatform || !selectedBrandId) return;
    update(id, { syncing: true, syncError: undefined, syncSuccess: false });
    try {
      const res = await fetch(`/api/sync/${def.syncPlatform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; recordsSynced?: number; syncJobId?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Sync failed (${res.status})`);
      }
      update(id, { syncing: false, syncSuccess: true, lastSync: Date.now(), metric: data.recordsSynced ?? 0, syncError: undefined });
      window.setTimeout(() => update(id, { syncSuccess: false }), 2500);
      setSyncEvents((prev) => [
        { id: data.syncJobId ?? `ev-${Date.now()}`, platform: id, records: data.recordsSynced ?? 0, duration: "—", status: "success" as const, timestamp: Date.now() },
        ...prev,
      ].slice(0, 10));
      refetchConnections();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      update(id, { syncing: false, syncError: msg, syncSuccess: false });
      setSyncEvents((prev) => [
        { id: `ev-${Date.now()}`, platform: id, records: 0, duration: "—", status: "failed" as const, timestamp: Date.now() },
        ...prev,
      ].slice(0, 10));
      void refetchConnections();
    }
  }, [selectedBrandId, update, refetchConnections]);

  // ── Disconnect — clear tokens, keep synced history ──
  const handleDisconnect = useCallback((def: PlatformDef) => {
    if (!def.dbPlatform) {
      toast.error(`${def.name} cannot be disconnected yet.`);
      return;
    }
    if (!selectedBrandId) {
      toast.error("Select a shop first.");
      return;
    }
    const ok = window.confirm(
      `Disconnect ${def.name} from this shop? Tokens are removed. Synced history stays. You can connect again anytime.`,
    );
    if (!ok) return;
    disconnectMutation.mutate({ brandId: selectedBrandId, platform: def.dbPlatform });
  }, [disconnectMutation, selectedBrandId]);

  // ── WooCommerce form → POST /api/connections/woocommerce ──
  const handleWooSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBrandId) { setWooError("Select a brand first."); return; }
    setWooSubmitting(true);
    setWooError(undefined);
    try {
      const res = await fetch("/api/connections/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: wooUrl,
          consumerKey: wooKey,
          consumerSecret: wooSecret,
          brandId: selectedBrandId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Connection failed");
      }
      setWooSubmitting(false);
      setWooSaved(true);
      window.setTimeout(() => setWooSaved(false), 1800);
      setWooUrl(""); setWooKey(""); setWooSecret(""); setWooExpanded(false);
      refetchConnections();
    } catch (err) {
      setWooSubmitting(false);
      setWooError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [selectedBrandId, wooUrl, wooKey, wooSecret, refetchConnections]);

  // ── OpenCart form → POST /api/connections/opencart ──
  const handleOpenCartSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBrandId) { setOcError("Select a brand first."); return; }
    setOcSubmitting(true);
    setOcError(undefined);
    try {
      const res = await fetch("/api/connections/opencart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeUrl: ocUrl,
          username: ocUsername,
          apiKey: ocApiKey,
          brandId: selectedBrandId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Connection failed");
      }
      setOcSubmitting(false);
      setOcSaved(true);
      window.setTimeout(() => setOcSaved(false), 1800);
      setOcUrl(""); setOcUsername(""); setOcApiKey(""); setOcExpanded(false);
      refetchConnections();
    } catch (err) {
      setOcSubmitting(false);
      setOcError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [selectedBrandId, ocUrl, ocUsername, ocApiKey, refetchConnections]);

  // ── API key form submit (Omnisend / Brevo) ──
  const handleApiKeySubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBrandId || !apiKeyFormPlatform) return;
    setApiKeySubmitting(true);
    setApiKeyError(undefined);
    try {
      const res = await fetch(`/api/connections/${apiKeyFormPlatform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyValue, brandId: selectedBrandId }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Connection failed");
      setApiKeySubmitting(false);
      setApiKeySaved(true);
      window.setTimeout(() => setApiKeySaved(false), 1800);
      setApiKeyValue("");
      setApiKeyFormPlatform(null);
      refetchConnections();
    } catch (err) {
      setApiKeySubmitting(false);
      setApiKeyError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [selectedBrandId, apiKeyFormPlatform, apiKeyValue, refetchConnections]);

  // ── After an OAuth redirect, toast, refetch, and keep shop in the URL ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (connected) {
      const name =
        PLATFORMS.find((p) => p.id === connected || p.authPath === `/api/auth/${connected}`)?.name ?? connected;
      const ga4 = params.get("ga4");
      const gsc = params.get("gsc");
      const gads = params.get("gads");
      toast.success(
        connected === "meta"
          ? "Meta connected. Confirm ads_management was granted, then reopen the campaign desk."
          : connected === "google-analytics" && ga4 === "pick"
            ? "Google Analytics connected. Choose a GA4 property, then Sync Now."
            : connected === "google-analytics" && ga4 === "none"
              ? "Google signed in, but this account has no GA4 properties."
              : connected === "google-search-console" && gsc === "pick"
                ? "Search Console connected. Choose the shop property, then Sync Now."
                : connected === "google-search-console" && gsc === "none"
                  ? "Google signed in, but this account has no Search Console sites."
                  : connected === "google-ads" && gads === "pick"
                    ? "Google Ads connected. Choose the spend account, then Sync Now."
                    : connected === "google-ads" && gads === "none"
                      ? "Google signed in, but this login has no Google Ads accounts."
                      : `${name} connected.`,
      );
    }
    if (error) {
      const reason = params.get("reason");
      toast.error(
        error === "meta-no-accounts"
          ? "Facebook returned no ad accounts. Reconnect and approve ads management."
          : reason === "brand"
            ? "That shop is not in this workspace."
            : `Could not connect ${error}. Use Reconnect and approve every permission.`,
      );
    }
    void refetchConnections();
    params.delete("connected");
    params.delete("error");
    params.delete("reason");
    params.delete("ga4");
    params.delete("gsc");
    params.delete("gads");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [refetchConnections]);

  const connectedCount = useMemo(
    () => PLATFORMS.filter((p) => states[p.id].status === "connected").length,
    [states],
  );
  const overallHealth = useMemo(() => {
    const connected = PLATFORMS.filter((p) => states[p.id].status === "connected" && states[p.id].healthScore != null);
    if (!connected.length) return 0;
    return connected.reduce((s, p) => s + (states[p.id].healthScore ?? 0), 0) / connected.length;
  }, [states]);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      {/* ── Header ── */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-purple-300/80">
          <span className="h-px w-6 bg-gradient-to-r from-purple-400/60 to-transparent" />
          Integrations
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={cn("bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl", bricolage.className)}>
              Platform Health Monitoring
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/45">
              Connect ads and Woo per e-shop. BAGTOBAG and every store you add keep their own tokens and sync.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {brands.length > 0 && (
              <select
                value={selectedBrandId ?? ""}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value);
                  try {
                    window.sessionStorage.setItem("adspro:active-brand", e.target.value);
                  } catch {
                    /* ignore */
                  }
                }}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-white/80 outline-none transition-colors hover:bg-white/[0.06] [&>option]:bg-gray-900"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {connectedCount > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-emerald-300">{overallHealth.toFixed(1)}%</span>
                <span className="text-[10px] text-emerald-400/60">System Health</span>
              </motion.div>
            )}
            <button type="button" onClick={() => {
              const first = PLATFORMS.find((p) => states[p.id].status !== "connected") ?? PLATFORMS[0];
              if (!first) return;
              if (first.kind === "form") {
                startFormConnect(first);
                return;
              }
              setModalPlatform(first);
            }} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/40">
              <Plus className="h-3.5 w-3.5" /> Add Platform
            </button>
            {connectedCount > 0 && (
              <button onClick={() => PLATFORMS.filter((p) => states[p.id].status === "connected" && !states[p.id].needsGa4Property && !states[p.id].needsGscSite && !states[p.id].needsGoogleAdsAccount).forEach((p) => handleSync(p.id))} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.06]">
                <Zap className="h-3.5 w-3.5" /> Run Full Sync
              </button>
            )}
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-purple-300/80">Store ops</p>
            <h2 className="mt-1 text-base font-semibold text-white">CAPI, GA4, Unassigned, Google Ads token, Woo VAT</h2>
            <p className="mt-1 max-w-2xl text-xs text-white/45">
              Ads Pro reads the five clocks. Closing the gaps is on the shop. Full steps on Help.
            </p>
          </div>
          <Link
            href="/help"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] font-semibold text-white/70 hover:bg-white/[0.06]"
          >
            Open playbook <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TRACKING_WORKSTREAMS.map((w, i) => (
            <li key={w.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/90">{w.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">{w.verify}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Loading state ── */}
      {waiting && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-sm text-white/50">
          <Loader2 className="h-5 w-5 animate-spin text-purple-300" />
          Loading connection status…
        </div>
      )}

      {/* ── Error state ── */}
      {connError && !waiting && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Failed to load connection status</p>
            <p className="mt-0.5 text-xs text-red-300/70">{connError.message}</p>
            <button onClick={() => refetchConnections()} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-200 hover:text-red-100">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* ── No brands state ── */}
      {!waiting && !connError && brands.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-inset ring-white/10">
            <Plug className="h-6 w-6 text-purple-300" />
          </div>
          <p className="text-sm font-medium text-white/70">No brands yet</p>
          <p className="max-w-sm text-xs text-white/40">Create a brand in your organization settings before connecting ad platforms.</p>
        </div>
      )}

      {/* ── Summary bar ── */}
      {!waiting && !connError && brands.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 text-purple-200 ring-1 ring-inset ring-white/10">
            <Plug className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white/55">
              <span className="font-semibold text-white">{connectedCount}</span> of {PLATFORMS.length} platforms connected
            </p>
            <p className="text-[11px] text-white/35">
              {connectedCount === PLATFORMS.length ? "All channels synced — you're live." : "Connect remaining channels. Pixel, till, GA4, GSC, and email stay five clocks."}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text font-mono text-sm font-semibold tabular-nums text-transparent">
              {Math.round((connectedCount / PLATFORMS.length) * 100)}%
            </span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5 sm:w-44">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]" initial={{ width: 0 }} animate={{ width: `${(connectedCount / PLATFORMS.length) * 100}%` }} transition={{ duration: 0.6 }} />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Platform Cards ── */}
      {!waiting && !connError && brands.length > 0 && (
        <div className="space-y-4">
          {PLATFORMS.map((def, i) => (
            <AnimatedSection key={def.id} delay={i * 0.06} variant="fadeInUp">
              <PlatformCard
                def={def} state={states[def.id]} timelineData={sparkByPlatform[def.id]}
                onConnect={() => handleConnectOAuth(def)} onSync={() => handleSync(def.id)}
                onDisconnect={() => handleDisconnect(def)}
                disconnecting={disconnectMutation.isPending && disconnectMutation.variables?.platform === def.dbPlatform}
                hasAccount={Boolean(def.dbPlatform && connections.some((c) => c.platform === def.dbPlatform))}
                ga4BrandId={def.id === "google-analytics" ? selectedBrandId : null}
                gscBrandId={def.id === "google-search-console" ? selectedBrandId : null}
                gadsBrandId={def.id === "google-ads" ? selectedBrandId : null}
                oauthReady={
                  def.id === "meta" ||
                  def.id === "google-ads" ||
                  def.id === "tiktok" ||
                  def.id === "google-analytics" ||
                  def.id === "google-search-console"
                    ? oauthReady?.[def.id]
                    : undefined
                }
                onGa4Picked={() => {
                  void refetchConnections();
                  window.setTimeout(() => void handleSync("google-analytics"), 250);
                }}
                onGscPicked={() => {
                  void refetchConnections();
                  window.setTimeout(() => void handleSync("google-search-console"), 250);
                }}
                onGadsPicked={() => {
                  void refetchConnections();
                  window.setTimeout(() => void handleSync("google-ads"), 250);
                }}
                woo={{ url: wooUrl, setUrl: setWooUrl, key: wooKey, setKey: setWooKey, secret: wooSecret, setSecret: setWooSecret, expanded: wooExpanded, setExpanded: setWooExpanded, submitting: wooSubmitting, saved: wooSaved, error: wooError, onSubmit: handleWooSubmit }}
                oc={{ url: ocUrl, setUrl: setOcUrl, username: ocUsername, setUsername: setOcUsername, apiKey: ocApiKey, setApiKey: setOcApiKey, expanded: ocExpanded, setExpanded: setOcExpanded, submitting: ocSubmitting, saved: ocSaved, error: ocError, onSubmit: handleOpenCartSubmit }}
                apiKeyForm={{ expanded: apiKeyFormPlatform === def.id, setExpanded: (v) => { const next = typeof v === "function" ? v(apiKeyFormPlatform === def.id) : v; setApiKeyFormPlatform(next ? (def.id as "omnisend" | "brevo") : null); if (!next) { setApiKeyValue(""); setApiKeyError(undefined); } }, value: apiKeyValue, setValue: setApiKeyValue, submitting: apiKeySubmitting, saved: apiKeySaved, error: apiKeyError, onSubmit: handleApiKeySubmit }}
              />
            </AnimatedSection>
          ))}
        </div>
      )}

      {!waiting && !connError && brands.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-white/50">
          Microsoft Ads is not wired. Bing last-click already appears on Attribution from Woo UTM / Order Attribution — that is a till tag, not Microsoft spend. Auction insights and competitor overlap need Google Ads Basic Access; this desk will not invent them.
        </div>
      )}

      {/* ── Bottom Section: Activity Log + Volume Chart ── */}
      {connectedCount > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Sync Activity Log */}
          <AnimatedSection delay={0.1} variant="fadeInUp" className="h-full">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Clock className="h-4 w-4 text-purple-300" /> Sync Activity Log
              </h3>
              <div className="space-y-2">
                {visibleSyncEvents.length === 0 ? (
                  <p className="py-6 text-center text-xs text-white/35">No syncs yet — trigger a sync to see activity here.</p>
                ) : (
                  visibleSyncEvents.map((ev, idx) => {
                    const plat = PLATFORMS.find((p) => p.id === ev.platform)!;
                    return (
                      <motion.div key={ev.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white", plat.accent)}>
                          {plat.initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/70">{plat.name}</p>
                          <p className="text-[10px] text-white/35">{relativeTime(ev.timestamp)}</p>
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-white/50">{ev.records} rec</span>
                        <span className="font-mono text-[10px] tabular-nums text-white/40">{ev.duration}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          ev.status === "success" && "bg-emerald-500/15 text-emerald-400",
                          ev.status === "partial" && "bg-amber-500/15 text-amber-400",
                          ev.status === "failed" && "bg-red-500/15 text-red-400",
                        )}>
                          {ev.status === "success" ? "Success" : ev.status === "partial" ? "Partial" : "Failed"}
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </AnimatedSection>

          {/* Records processed from real SyncJob rows */}
          <AnimatedSection delay={0.15} variant="fadeInUp" className="h-full">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4 text-blue-300" /> Records processed — last 7 days
              </h3>
              <p className="mb-4 text-[11px] text-white/40">
                Sum of completed SyncJob.recordsProcessed by UTC day. Not ad spend, not list growth, not a 24h pulse.
              </p>
              {volumeChart.keys.length === 0 ? (
                <p className="py-10 text-center text-xs text-white/35">
                  No completed syncs with records in the last 7 days. The activity log is the source of truth.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={volumeChart.rows} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={(props: TooltipContentProps<number, string>) => <ChartTooltip {...props} />} />
                    {volumeChart.keys.map((key) => {
                      const plat = PLATFORMS.find((p) => p.id === key);
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={plat?.name ?? key}
                          fill={plat?.barColor ?? "#71717a"}
                          radius={[3, 3, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </AnimatedSection>
        </div>
      )}

      {/* ── Connection Modal ── */}
      <AnimatePresence>
        {modalPlatform && (
          <ConnectionModal def={modalPlatform} onClose={() => setModalPlatform(null)} onConnect={() => { startPlatformConnect(modalPlatform); setModalPlatform(null); }} />
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-white/30">
        Snapchat and Pinterest are not in this desk.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PlatformCard                                                                */
/* -------------------------------------------------------------------------- */

interface WooProps {
  url: string; setUrl: (v: string) => void;
  key: string; setKey: (v: string) => void;
  secret: string; setSecret: (v: string) => void;
  expanded: boolean; setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  submitting: boolean; saved: boolean;
  error?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

interface OpenCartProps {
  url: string; setUrl: (v: string) => void;
  username: string; setUsername: (v: string) => void;
  apiKey: string; setApiKey: (v: string) => void;
  expanded: boolean; setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  submitting: boolean; saved: boolean;
  error?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

interface ApiKeyFormProps {
  expanded: boolean;
  setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  value: string;
  setValue: (v: string) => void;
  submitting: boolean;
  saved: boolean;
  error?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

interface PlatformCardProps {
  def: PlatformDef;
  state: PlatformState;
  timelineData: { label: string; records: number }[];
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  disconnecting?: boolean;
  hasAccount?: boolean;
  ga4BrandId?: string | null;
  gscBrandId?: string | null;
  gadsBrandId?: string | null;
  onGa4Picked?: () => void;
  onGscPicked?: () => void;
  onGadsPicked?: () => void;
  oauthReady?: boolean;
  woo: WooProps;
  oc: OpenCartProps;
  apiKeyForm: ApiKeyFormProps;
}

function Ga4PropertyPanel({
  brandId,
  needsPick,
  onPicked,
}: {
  brandId: string;
  needsPick: boolean;
  onPicked: () => void;
}) {
  const [draft, setDraft] = useState("");
  const query = api.connections.listGa4Properties.useQuery(
    { brandId },
    { enabled: Boolean(brandId) },
  );
  const save = api.connections.selectGa4Property.useMutation({
    onSuccess: (res) => {
      toast.success(`GA4 property set to ${res.name}. Syncing…`);
      setDraft("");
      onPicked();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setDraft("");
  }, [brandId]);

  const boundId = query.data?.selectedId ?? "";
  const selected = draft || boundId;
  const properties = query.data?.properties ?? [];

  return (
    <div className="rounded-xl border border-orange-400/20 bg-orange-500/[0.06] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-200/80">
        {needsPick ? "Choose a GA4 property" : "GA4 property"}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">
        This Google login can see every property the account can open. Keep this shop on its own
        property — switching here mixes another brand&apos;s traffic into this desk.
      </p>
      {query.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading properties…
        </p>
      ) : query.error ? (
        <p className="mt-2 text-xs text-red-200">{query.error.message}</p>
      ) : properties.length === 0 ? (
        <p className="mt-2 text-xs text-white/55">
          No GA4 properties on this Google account. Open Analytics, create a property, or reconnect with an account that can open the Bag to Bag property.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-gray-950/70 px-2 text-xs text-white/90 outline-none [&>option]:bg-gray-900"
          >
            <option value="">Select property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.accountName})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || save.isPending || selected === query.data?.selectedId}
            onClick={() => save.mutate({ brandId, propertyId: selected })}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={3} />}
            {needsPick ? "Save & sync" : "Switch property"}
          </button>
        </div>
      )}
    </div>
  );
}

function GscSitePanel({
  brandId,
  needsPick,
  onPicked,
}: {
  brandId: string;
  needsPick: boolean;
  onPicked: () => void;
}) {
  const [draft, setDraft] = useState("");
  const query = api.connections.listGscSites.useQuery(
    { brandId },
    { enabled: Boolean(brandId) },
  );
  const save = api.connections.selectGscSite.useMutation({
    onSuccess: (res) => {
      toast.success(`Search Console set to ${res.name}. Syncing…`);
      setDraft("");
      onPicked();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setDraft("");
  }, [brandId]);

  const boundUrl = query.data?.selectedUrl ?? "";
  const selected = draft || boundUrl;
  const sites = query.data?.sites ?? [];

  return (
    <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/80">
        {needsPick ? "Choose a Search Console property" : "Search Console property"}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">
        Keep this shop on its own property — switching here mixes another brand&apos;s queries into this desk.
      </p>
      {query.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sites…
        </p>
      ) : query.error ? (
        <p className="mt-2 text-xs text-red-200">{query.error.message}</p>
      ) : sites.length === 0 ? (
        <p className="mt-2 text-xs text-white/55">
          No verified Search Console properties on this Google account. Verify the shop in Search Console, then reconnect.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-gray-950/70 px-2 text-xs text-white/90 outline-none [&>option]:bg-gray-900"
          >
            <option value="">Select site…</option>
            {sites.map((site) => (
              <option key={site.siteUrl} value={site.siteUrl}>
                {site.displayName} ({site.siteUrl})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || save.isPending || selected === query.data?.selectedUrl}
            onClick={() => save.mutate({ brandId, siteUrl: selected })}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={3} />}
            {needsPick ? "Save & sync" : "Switch site"}
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleAdsAccountPanel({
  brandId,
  needsPick,
  onPicked,
}: {
  brandId: string;
  needsPick: boolean;
  onPicked: () => void;
}) {
  const [draft, setDraft] = useState("");
  const query = api.connections.listGoogleAdsCustomers.useQuery(
    { brandId },
    { enabled: Boolean(brandId) },
  );
  const save = api.connections.selectGoogleAdsCustomer.useMutation({
    onSuccess: (res) => {
      toast.success(`Google Ads set to ${res.name}. Syncing…`);
      setDraft("");
      onPicked();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    setDraft("");
  }, [brandId]);

  const boundId = query.data?.selectedId ?? "";
  const selected = draft || boundId;
  const customers = query.data?.customers ?? [];

  return (
    <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/[0.06] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-200/80">
        {needsPick ? "Choose a Google Ads account" : "Google Ads account"}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">
        Pick the spend account for this shop, not the MCC. Switching here mixes another brand&apos;s spend into Pixel ROAS.
        Spend appears on Dashboard only after Sync Now writes DailyMetric google rows. Woo last-click Google is till.
        If the last sync says the developer token is test-only, apply for{" "}
        <a
          href="https://ads.google.com/aw/apicenter"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-200/90 underline decoration-yellow-200/30 underline-offset-2 hover:text-yellow-100"
        >
          Basic Access in Ads API Center
        </a>
        .
      </p>
      {query.isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading accounts…
        </p>
      ) : query.error ? (
        <p className="mt-2 text-xs text-red-200">{query.error.message}</p>
      ) : customers.length === 0 ? (
        <p className="mt-2 text-xs text-white/55">
          No Google Ads customers on this login. If Sync Now says the developer token is test-only, apply for Basic Access in Ads API Center.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-gray-950/70 px-2 text-xs text-white/90 outline-none [&>option]:bg-gray-900"
          >
            <option value="">Select account…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.descriptiveName}
                {customer.manager ? " (MCC)" : ""} · {customer.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || save.isPending || selected === query.data?.selectedId}
            onClick={() => save.mutate({ brandId, customerId: selected })}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-500 to-yellow-500 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={3} />}
            {needsPick ? "Save & sync" : "Switch account"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlatformCredentialForms({ def, woo, oc, apiKeyForm }: { def: PlatformDef; woo: WooProps; oc: OpenCartProps; apiKeyForm: ApiKeyFormProps }) {
  if (def.kind !== "form") return null;
  return (
    <>
      {def.id === "woocommerce" && (
        <AnimatePresence initial={false}>
          {woo.expanded && (
            <motion.form key="woo-form" onSubmit={woo.onSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-3 overflow-hidden border-t border-white/5 pt-3">
              <Field id="woo-url" label="Store URL" type="url" value={woo.url} onChange={woo.setUrl} placeholder="https://store.example.com" />
              <Field id="woo-key" label="Consumer Key" type="text" value={woo.key} onChange={woo.setKey} placeholder="ck_••••••••••••••••" />
              <Field id="woo-secret" label="Consumer Secret" type="password" value={woo.secret} onChange={woo.setSecret} placeholder="cs_••••••••••••••••" />
              <p className="text-[11px] leading-relaxed text-white/40">
                Ads Pro calls <span className="text-white/55">/wp-json/wc/v3/</span> from the server.
                Cloudflare Bot Fight or “I&apos;m Under Attack” will block that even with a valid key — skip those checks for that path.
              </p>
              {woo.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{woo.error}</span>
                </div>
              )}
              <button type="submit" disabled={woo.submitting} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {woo.submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : woo.saved ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Connected</> : <><Plug className="h-3.5 w-3.5" /> Save credentials</>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      )}
      {def.id === "opencart" && (
        <AnimatePresence initial={false}>
          {oc.expanded && (
            <motion.form key="oc-form" onSubmit={oc.onSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-3 overflow-hidden border-t border-white/5 pt-3">
              <Field id="oc-url" label="Store URL" type="url" value={oc.url} onChange={oc.setUrl} placeholder="https://store.example.com" />
              <Field id="oc-username" label="API Username" type="text" value={oc.username} onChange={oc.setUsername} placeholder="API username" />
              <Field id="oc-api-key" label="API Key" type="password" value={oc.apiKey} onChange={oc.setApiKey} placeholder="API key" />
              {oc.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{oc.error}</span>
                </div>
              )}
              <button type="submit" disabled={oc.submitting} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {oc.submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : oc.saved ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Connected</> : <><Plug className="h-3.5 w-3.5" /> Save credentials</>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      )}
      {(def.id === "omnisend" || def.id === "brevo") && (
        <AnimatePresence initial={false}>
          {apiKeyForm.expanded && (
            <motion.form key={`${def.id}-form`} onSubmit={apiKeyForm.onSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-3 overflow-hidden border-t border-white/5 pt-3">
              <Field id={`${def.id}-api-key`} label="API Key" type="password" value={apiKeyForm.value} onChange={apiKeyForm.setValue} placeholder="Enter your API key" />
              {apiKeyForm.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{apiKeyForm.error}</span>
                </div>
              )}
              <button type="submit" disabled={apiKeyForm.submitting} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                {apiKeyForm.submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : apiKeyForm.saved ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Connected</> : <><Plug className="h-3.5 w-3.5" /> Save credentials</>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      )}
    </>
  );
}

function PlatformCard({ def, state, timelineData, onConnect, onSync, onDisconnect, disconnecting, hasAccount, ga4BrandId, gscBrandId, gadsBrandId, onGa4Picked, onGscPicked, onGadsPicked, oauthReady, woo, oc, apiKeyForm }: PlatformCardProps) {
  const isConnected = state.status === "connected";
  const isConnecting = state.status === "connecting";
  const isError = state.status === "error";
  const needsResourcePick = Boolean(
    state.needsGa4Property || state.needsGscSite || state.needsGoogleAdsAccount,
  );

  return (
    <div
      id={def.id}
      className={cn("group relative scroll-mt-24 overflow-hidden rounded-2xl border bg-white/5 p-5 backdrop-blur-xl transition-colors",
      isConnected && state.syncError ? "border-red-400/25" : isConnected ? "border-emerald-400/20" : isError ? "border-red-400/20" : "border-white/10 hover:border-white/20",
    )}>
      {/* corner glow */}
      <div aria-hidden className={cn("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40", def.accent)} />

      <div className="relative flex flex-col gap-5 lg:flex-row">
        {/* Left: identity + health */}
        <div className="flex items-start gap-4 lg:w-64 lg:shrink-0">
          <div className={cn("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-lg", def.accent, def.glow)}>
            {def.initial}
            {isConnected && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-950 bg-emerald-500 shadow"><Check className="h-3 w-3 text-white" strokeWidth={3} /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{def.name}</h3>
              <StatusBadge status={badgeStatus(state)} label={badgeLabel(state)} />
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{def.description}</p>
            {state.accountName && isConnected && (
              <p className="mt-1 text-[10px] text-white/35">Account: {state.accountName}</p>
            )}
            {(state.errorCount ?? 0) > 0 && isConnected && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                <AlertCircle className="h-3 w-3" /> {state.errorCount} errors
              </span>
            )}
          </div>
        </div>

        {isConnected ? (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* Sync feedback banner */}
            <AnimatePresence>
              {state.syncError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{state.syncError}</span>
                </motion.div>
              )}
              {state.syncSuccess && !state.syncError && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-200">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  <span>Sync completed successfully.</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Metrics row */}
            <div className="flex flex-wrap items-center gap-4">
              <HealthRing score={state.healthScore ?? 0} />
              <div className="flex flex-1 flex-wrap gap-3">
                {[
                  { label: "Last Run Records", value: <AnimatedCounter target={state.metric ?? 0} className="font-mono text-lg font-semibold tabular-nums text-white" /> },
                  { label: "Success Rate", value: <span className="font-mono text-lg font-semibold tabular-nums text-white">{(state.successRate ?? 0).toFixed(1)}%</span> },
                  { label: "Last Sync", value: <span className="text-sm text-white/70">{relativeTime(state.lastSync)}</span> },
                  { label: "Sync Mode", value: <span className="text-sm text-white/70">Manual</span> },
                ].map((m) => (
                  <div key={m.label} className="min-w-[100px] rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{m.label}</p>
                    <div className="mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync timeline from real jobs */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                Records per completed sync
              </p>
              {timelineData.length < 2 ? (
                <p className="py-4 text-center text-[11px] text-white/35">
                  Need two completed syncs for a sparkline.
                  {typeof state.metric === "number" ? ` Last run ${state.metric.toLocaleString("en-US")} rec.` : ""}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id={`grad-${def.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={def.barColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={def.barColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="records" stroke={def.barColor} strokeWidth={1.5} fill={`url(#grad-${def.id})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {def.syncPlatform && !needsResourcePick && (
                  <button type="button" onClick={onSync} disabled={state.syncing} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-70">
                    <RefreshCw className={cn("h-3 w-3", state.syncing && "animate-spin")} />
                    {state.syncing ? "Syncing…" : "Sync Now"}
                  </button>
                )}
                {def.kind === "oauth" && (
                  <button type="button" onClick={onConnect} disabled={isConnecting} className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-3 text-[11px] font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-70">
                    {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Reconnect
                  </button>
                )}
                {def.kind === "form" && def.id === "woocommerce" && (
                  <button type="button" onClick={() => woo.setExpanded((v) => !v)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/80 hover:bg-white/[0.06]">
                    <Key className="h-3 w-3" /> {woo.expanded ? "Hide form" : "Update credentials"}
                  </button>
                )}
                {def.kind === "form" && def.id === "opencart" && (
                  <button type="button" onClick={() => oc.setExpanded((v) => !v)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/80 hover:bg-white/[0.06]">
                    <Key className="h-3 w-3" /> {oc.expanded ? "Hide form" : "Update credentials"}
                  </button>
                )}
                {def.kind === "form" && (def.id === "omnisend" || def.id === "brevo") && (
                  <button type="button" onClick={() => apiKeyForm.setExpanded((v: boolean) => !v)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/80 hover:bg-white/[0.06]">
                    <Key className="h-3 w-3" /> {apiKeyForm.expanded ? "Hide form" : "Update API key"}
                  </button>
                )}
                {def.externalUrl && (
                  <a href={def.externalUrl} target="_blank" rel="noopener noreferrer" className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white">
                    <ExternalLink className="h-3 w-3" /> Open {def.name}
                  </a>
                )}
                <button type="button" onClick={onDisconnect} disabled={disconnecting} className="flex h-8 items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-[11px] font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-60">
                  <Unplug className="h-3 w-3" /> {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
            {def.id === "google-analytics" && ga4BrandId && (
              <Ga4PropertyPanel
                brandId={ga4BrandId}
                needsPick={Boolean(state.needsGa4Property)}
                onPicked={onGa4Picked ?? (() => undefined)}
              />
            )}
            {def.id === "google-search-console" && gscBrandId && (
              <GscSitePanel
                brandId={gscBrandId}
                needsPick={Boolean(state.needsGscSite)}
                onPicked={onGscPicked ?? (() => undefined)}
              />
            )}
            {def.id === "google-ads" && gadsBrandId && (
              <GoogleAdsAccountPanel
                brandId={gadsBrandId}
                needsPick={Boolean(state.needsGoogleAdsAccount)}
                onPicked={onGadsPicked ?? (() => undefined)}
              />
            )}
            <PlatformCredentialForms def={def} woo={woo} oc={oc} apiKeyForm={apiKeyForm} />
          </div>
        ) : (
          /* Disconnected / error state */
          <div className="flex flex-1 flex-col justify-center gap-3">
            {isError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            {oauthReady === false && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{oauthEnvHint(def.id)}</span>
              </div>
            )}
            <PlatformCredentialForms def={def} woo={woo} oc={oc} apiKeyForm={apiKeyForm} />
            <div className="flex flex-wrap items-center gap-2">
              {def.kind === "oauth" && (
                <button type="button" onClick={onConnect} disabled={isConnecting || oauthReady === false} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-70">
                  {isConnecting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : <><Plug className="h-3.5 w-3.5" /> {isError ? "Reconnect" : "Connect"}</>}
                </button>
              )}
              {def.kind === "form" && def.id === "woocommerce" && (
                <button type="button" onClick={() => woo.setExpanded((v) => !v)} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.06]">
                  <Key className="h-3.5 w-3.5" /> {woo.expanded ? "Hide form" : isError ? "Update credentials" : "Enter credentials"}
                </button>
              )}
              {def.kind === "form" && def.id === "opencart" && (
                <button type="button" onClick={() => oc.setExpanded((v) => !v)} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.06]">
                  <Key className="h-3.5 w-3.5" /> {oc.expanded ? "Hide form" : isError ? "Update credentials" : "Enter credentials"}
                </button>
              )}
              {def.kind === "form" && (def.id === "omnisend" || def.id === "brevo") && (
                <button type="button" onClick={() => apiKeyForm.setExpanded((v: boolean) => !v)} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.06]">
                  <Key className="h-3.5 w-3.5" /> {apiKeyForm.expanded ? "Hide form" : isError ? "Update API key" : "Enter API key"}
                </button>
              )}
              {isError && hasAccount && (
                <button type="button" onClick={onDisconnect} disabled={disconnecting} className="flex h-9 items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-60">
                  <Unplug className="h-3.5 w-3.5" /> {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              )}
              <span className="flex items-center gap-1 text-[10px] text-white/35">
                <ShieldCheck className="h-3 w-3" /> {def.kind === "oauth" ? "Secure OAuth" : "Encrypted API key"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ConnectionModal                                                             */
/* -------------------------------------------------------------------------- */

function ConnectionModal({ def, onClose, onConnect }: { def: PlatformDef; onClose: () => void; onConnect: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-gray-950/95 p-6 backdrop-blur-xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className={cn("mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-lg", def.accent, def.glow)}>
          {def.initial}
        </div>

        <h2 className={cn("mb-1 text-xl font-bold text-white", bricolage.className)}>Connect {def.name}</h2>
        <p className="mb-6 text-sm leading-relaxed text-white/50">{def.description}</p>

        <div className="mb-6 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">How it works</h4>
          {(def.kind === "oauth"
            ? [
                "You'll be redirected to the platform's authorization page",
                "Grant every requested permission — ads management is required to pause or scale ads",
                "We'll securely store your OAuth tokens",
                "Return here and reopen the operator desk when Meta is connected",
              ]
            : [
                "Enter API credentials on the platform card",
                "We encrypt the key and store it for this shop only",
                "Use Update credentials anytime without disconnecting",
                "Disconnect removes tokens and keeps synced history",
              ]
          ).map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/60">{i + 1}</span>
              <p className="text-xs leading-relaxed text-white/60">{step}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">Required Permissions</h4>
          {def.permissions.map((p) => (
            <div key={p} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <ChevronRight className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-white/70">{p}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <button type="button" onClick={onConnect} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40">
            <Plug className="h-4 w-4" /> {def.kind === "oauth" ? `Continue to ${def.name}` : `Enter ${def.name} credentials`}
          </button>
          <p className="mt-3 text-center text-[10px] text-white/30">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            {def.kind === "oauth" ? "Secured with OAuth 2.0 — we never store your password" : "Keys are encrypted at rest for this shop only"}
          </p>
        </div>
      </motion.div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

function Field({ id, label, type, value, onChange, placeholder }: { id: string; label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      <input id={id} type={type} required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-white placeholder:text-white/30 transition-colors focus:border-purple-400/40 focus:outline-none" />
    </div>
  );
}
