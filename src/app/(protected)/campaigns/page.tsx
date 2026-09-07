"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Target,
  Plus,
  TrendingUp,
  Activity,
  DollarSign,
  Search,
  Pause,
  Play,
  ChevronDown,
  X,
  Pencil,
  Filter,
  MoreHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AnimatedSection,
  StaggerContainer,
  fadeInUp,
} from "@/components/ui/animated-section";
import {
  CardSkeleton,
  EmptyDataState,
  DataLoadingState,
} from "@/components/ui/data-state";
import { api } from "@/components/providers/trpc-provider";
import { useCurrency } from "@/components/providers/currency";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket } from "@/hooks/use-active-market";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { fromPrismaPlatform } from "@/lib/platform-launch/mapping";
import { labelMetaResultType } from "@/lib/meta/labels";
import { MetaOperatorDesk } from "@/components/campaigns/meta-operator-desk";

function parseCampaignSettings(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function liveCampaignIdFromSettings(raw: unknown): string | undefined {
  const id = parseCampaignSettings(raw).platformCampaignId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------
const PLATFORMS = {
  Meta: { color: "#1877F2", icon: "\u{1F4D8}" },
  Google: { color: "#4285F4", icon: "\u{1F50D}" },
  TikTok: { color: "#FF0050", icon: "\u{1F3B5}" },
  facebook: { color: "#1877F2", icon: "\u{1F4D8}" },
  google: { color: "#4285F4", icon: "\u{1F50D}" },
  tiktok: { color: "#FF0050", icon: "\u{1F3B5}" },
  instagram: { color: "#E4405F", icon: "\u{1F4F7}" },
  linkedin: { color: "#0A66C2", icon: "\u{1F4BC}" },
} as Record<string, { color: string; icon: string }>;

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
type CampaignStatus = "active" | "paused" | "learning" | "ended" | "draft" | "completed";
const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  paused: { label: "Paused", dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  archived: { label: "Archived", dot: "bg-zinc-400", text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  learning: { label: "Learning", dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  ended: { label: "Ended", dot: "bg-gray-400", text: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  draft: { label: "Draft", dot: "bg-gray-400", text: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  unknown: { label: "Unknown", dot: "bg-gray-400", text: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  completed: { label: "Completed", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${cfg.bg} ${cfg.border} ${cfg.text} border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function normalizePlatform(p: string): string {
  if (PLATFORMS[p]) return p;
  const cap = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  return PLATFORMS[cap] ? cap : p;
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORMS[platform] ?? { color: "#888", icon: "\u{1F4E2}" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
      <span>{cfg.icon}</span>
      {platform}
    </span>
  );
}

function Sparkline({ data, color }: { data: { day: number; value: number }[]; color: string }) {
  const trend = data.length >= 2 ? data[data.length - 1].value - data[0].value : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-8 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TrendingUp
        className={`h-3 w-3 shrink-0 ${trend >= 0 ? "text-emerald-400" : "text-red-400 rotate-180"}`}
      />
    </div>
  );
}

interface KpiCardProps { label: string; icon: React.ElementType; iconColor: string; children: React.ReactNode }
function KpiCard({ label, icon: Icon, iconColor, children }: KpiCardProps) {
  return (
    <motion.div variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-colors hover:border-white/20">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${iconColor}20` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{children}</div>
    </motion.div>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <div className="relative flex items-center">
      <Filter className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-8 text-xs font-medium text-white/70 outline-none transition-colors hover:border-white/20 focus:border-blue-500/40">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">{opt.label}</option>
        ))}
      </select>
      <MoreHorizontal className="pointer-events-none absolute right-2 h-3.5 w-3.5 rotate-90 text-white/30" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function CampaignsPage() {
  const { format: fmtEuro, formatExact: fmtEuroExact, symbol } = useCurrency();
  const { brands, brandId, setBrandId } = useActiveBrand();
  const { market } = useActiveMarket();
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [syncedView, setSyncedView] = useState<"cards" | "table">("cards");
  const [pendingLive, setPendingLive] = useState<{
    kind: "status" | "scale";
    platform: "meta" | "google" | "tiktok";
    campaignId: string;
    status?: "PAUSED" | "ACTIVE";
    localCampaignId?: string;
    name: string;
    label: string;
  } | null>(null);
  const [deskCampaignId, setDeskCampaignId] = useState<string | null>(null);

  // tRPC queries
  const statsQuery = api.campaigns.getStatistics.useQuery();
  const campaignsQuery = api.campaigns.getAll.useQuery({
    limit: 100,
    ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
    ...(platformFilter !== "all" ? { platform: platformFilter as any } : {}),
  });

  // Org-scoped synced campaign performance (Meta pull from task #37).
  const syncedQuery = api.marketing.getCampaignPerformance.useQuery({
    limit: 200,
    brandId: brandId || undefined,
    ...(market !== "all" ? { market } : {}),
  });

  const liveStatus = api.campaigns.updateLiveStatus.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      void syncedQuery.refetch();
      void campaignsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const scaleBudget = api.campaigns.scaleBudget.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      void syncedQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const campaigns = campaignsQuery.data?.data?.campaigns ?? [];
  const stats = statsQuery.data?.data?.totals;
  const syncedCampaigns = syncedQuery.data?.data?.campaigns ?? [];

  const headerKpis = useMemo(() => {
    const localCount = Number(stats?.campaigns ?? 0);
    const localSpend = Number(stats?.spent ?? 0);
    if (localCount > 0 || localSpend > 0) {
      return {
        campaigns: localCount,
        active: Number(stats?.active ?? 0),
        spent: localSpend,
        budget: Number(stats?.budget ?? 0),
        fromSync: false,
      };
    }
    const spent = syncedCampaigns.reduce(
      (a: number, c: { totalSpend?: number }) => a + Number(c.totalSpend ?? 0),
      0,
    );
    const active = syncedCampaigns.filter(
      (c: { status?: string }) => c.status === "active",
    ).length;
    return {
      campaigns: syncedCampaigns.length,
      active,
      spent,
      budget: syncedCampaigns.reduce(
        (a: number, c: { dailyBudget?: number | null }) => a + Number(c.dailyBudget ?? 0),
        0,
      ),
      fromSync: syncedCampaigns.length > 0,
    };
  }, [stats, syncedCampaigns]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Filtered campaigns (client-side search)
  const filtered = useMemo(() => {
    if (!search) return campaigns;
    return campaigns.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [campaigns, search]);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(filtered.map((c: any) => c.id))); }
  }, [selectedIds.size, filtered]);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const isLoading = campaignsQuery.isLoading || statsQuery.isLoading;

  const requestLiveStatus = (
    platformRaw: string,
    campaignId: string | undefined,
    status: "PAUSED" | "ACTIVE",
    localCampaignId?: string,
    campaignName?: string,
  ) => {
    const platform = fromPrismaPlatform(platformRaw);
    if (!platform || !campaignId) {
      toast.error("This campaign is not linked to a live platform ID yet.");
      return;
    }
    const name = campaignName?.trim() || campaignId;
    setPendingLive({
      kind: "status",
      platform,
      campaignId,
      status,
      localCampaignId,
      name,
      label:
        status === "PAUSED"
          ? `Pause "${name}" on the live ad account?`
          : `Activate "${name}" on the live ad account?`,
    });
  };

  const requestLiveScale = (
    platformRaw: string,
    campaignId: string | undefined,
    campaignName?: string,
  ) => {
    const platform = fromPrismaPlatform(platformRaw);
    if (!platform || !campaignId) {
      toast.error("This campaign is not linked to a live platform ID yet.");
      return;
    }
    const name = campaignName?.trim() || campaignId;
    setPendingLive({
      kind: "scale",
      platform,
      campaignId,
      name,
      label: `Raise daily budget +20% on "${name}"? This writes the live campaign or ad set. One +20% step only.`,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-28">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Campaigns
            </h1>
            {brands.length > 0 && (
              <div className="mt-3">
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
            )}
            <p className="mt-1 text-sm text-white/40">Synced campaigns for this shop — pixel purchases are not till orders</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setShowBulkMenu((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/70 backdrop-blur-xl transition-colors hover:border-white/20 hover:text-white">
                Bulk Actions <ChevronDown className={`h-4 w-4 transition-transform ${showBulkMenu ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showBulkMenu && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
                    {(["pause", "resume"] as const).map((action) => {
                      const ActionIcon = action === "pause" ? Pause : Play;
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => {
                            setShowBulkMenu(false);
                            const first = filtered.find((c: { id: string }) => selectedIds.has(c.id));
                            if (!first) {
                              toast.error("Select a campaign first.");
                              return;
                            }
                            requestLiveStatus(
                              first.platform,
                              liveCampaignIdFromSettings(first.settings),
                              action === "pause" ? "PAUSED" : "ACTIVE",
                              first.id,
                              first.name,
                            );
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium capitalize text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          {action}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link
              href="/campaign-launcher"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-blue-500/40 hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Create Campaign
            </Link>
          </div>
        </div>
      </AnimatedSection>

      {/* KPI bar */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : (
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Campaigns" icon={Target} iconColor="#1877F2">
            <AnimatedCounter target={headerKpis.campaigns} className="tabular-nums" />
          </KpiCard>
          <KpiCard label="Active" icon={Activity} iconColor="#10B981">
            <span className="flex items-baseline gap-2">
              <AnimatedCounter target={headerKpis.active} className="tabular-nums" />
              <span className="text-sm font-medium text-emerald-400/70">
                {headerKpis.fromSync ? "synced" : "running"}
              </span>
            </span>
          </KpiCard>
          <KpiCard label="Total Spend" icon={DollarSign} iconColor="#F59E0B">
            <AnimatedCounter target={headerKpis.spent} prefix={symbol} className="tabular-nums" />
          </KpiCard>
          <KpiCard label="Budget" icon={TrendingUp} iconColor="#8B5CF6">
            {headerKpis.fromSync ? (
              <span className="text-lg font-semibold text-white/40">—</span>
            ) : (
              <AnimatedCounter target={headerKpis.budget} prefix={symbol} className="tabular-nums" />
            )}
          </KpiCard>
        </StaggerContainer>
      )}

      {/* Filters */}
      <AnimatedSection>
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect label="Platform" value={platformFilter} onChange={setPlatformFilter} options={[
              { value: "all", label: "All Platforms" }, { value: "facebook", label: "Meta" }, { value: "google", label: "Google" }, { value: "tiktok", label: "TikTok" },
            ]} />
            <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[
              { value: "all", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "draft", label: "Draft" }, { value: "completed", label: "Completed" },
            ]} />
          </div>
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..." aria-label="Search campaigns"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-xs font-medium text-white/70 placeholder-white/30 outline-none transition-colors hover:border-white/20 focus:border-blue-500/40 sm:w-64" />
          </div>
        </div>
      </AnimatedSection>

      {/* Synced Campaigns (Meta) — real org-scoped data from ad platform sync */}
      <AnimatedSection>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Synced Campaigns (Meta)</h2>
              <p className="mt-0.5 text-xs text-white/40">
                Campaign objects + daily insights. Open Edit on Meta for campaign, ad set, and ad writes.
              </p>
            </div>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
              Synced data
            </span>
            {syncedCampaigns.length > 0 && (
              <div className="flex rounded-lg border border-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setSyncedView("cards")}
                  className={`rounded-md p-1.5 ${syncedView === "cards" ? "bg-white/10 text-white" : "text-white/40"}`}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSyncedView("table")}
                  className={`rounded-md p-1.5 ${syncedView === "table" ? "bg-white/10 text-white" : "text-white/40"}`}
                  aria-label="Table view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {syncedQuery.isLoading ? (
            <DataLoadingState message="Loading synced campaigns..." />
          ) : syncedCampaigns.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-white/40">
              No synced campaigns yet — run a sync from{" "}
              <span className="font-semibold text-white/70">Connections</span>.
            </p>
          ) : syncedView === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                    <th className="px-4 py-3 font-medium text-right">Spend</th>
                    <th className="px-4 py-3 font-medium text-right">Reach</th>
                    <th className="px-4 py-3 font-medium text-right">Freq</th>
                    <th className="px-4 py-3 font-medium text-right">Link CTR</th>
                    <th className="px-4 py-3 font-medium text-right">Pixel ROAS</th>
                    <th className="px-4 py-3 font-medium text-right">Pixel purchases</th>
                    <th className="px-4 py-3 font-medium text-right">Results</th>
                    <th className="px-4 py-3 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {syncedCampaigns.map((c: any) => {
                    const spend = Number(c.totalSpend ?? 0);
                    const impressions = Number(c.totalImpressions ?? 0);
                    const clicks = Number(c.totalClicks ?? 0);
                    const conversions = Number(c.totalConversions ?? 0);
                    const roas = Number(c.roas ?? 0);
                    const linkClicks = Number(c.totalLinkClicks ?? 0);
                    const linkCtr = Number(c.linkCtr ?? (impressions > 0 ? (linkClicks / impressions) * 100 : 0));
                    const reach = Number(c.totalReach ?? 0);
                    const frequency = Number(c.frequency ?? 0);
                    const results = Number(c.totalResults ?? conversions);
                    return (
                      <tr key={`${c.platform}-${c.campaignId || c.campaignName}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-medium text-white">{c.campaignName}</p>
                          {c.attributionSetting ? (
                            <p className="mt-0.5 truncate text-[10px] text-white/35">{c.attributionSetting}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={c.status || "unknown"} /></td>
                        <td className="px-4 py-3 text-white/60">{normalizePlatform(c.platform)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{fmtEuro(spend)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{reach.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{frequency.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{linkCtr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-400">{roas.toFixed(2)}x</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">{conversions.toFixed(0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">
                          <span>{results.toFixed(0)}</span>
                          <p className="text-[10px] text-white/35">Meta result · {labelMetaResultType(c.resultType)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => c.campaignId && setDeskCampaignId(String(c.campaignId))}
                            className="text-[11px] font-semibold text-blue-300 hover:text-blue-200"
                          >
                            Edit
                          </button>
                          {" · "}
                          <a href="/chat" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">AI</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {syncedCampaigns.map((c: any) => {
                const spend = Number(c.totalSpend ?? 0);
                const impressions = Number(c.totalImpressions ?? 0);
                const clicks = Number(c.totalClicks ?? 0);
                const conversions = Number(c.totalConversions ?? 0);
                const roas = Number(c.roas ?? 0);
                const ctr = Number(c.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0));
                const cpc = Number(c.cpc ?? (clicks > 0 ? spend / clicks : 0));
                const reach = Number(c.totalReach ?? 0);
                const frequency = Number(c.frequency ?? 0);
                const lpv = Number(c.totalLandingPageViews ?? 0);
                const maxSpend = Math.max(
                  ...syncedCampaigns.map((row: any) => Number(row.totalSpend ?? 0)),
                  1,
                );
                const share = (spend / maxSpend) * 100;
                const platform = normalizePlatform(c.platform);
                const color = (PLATFORMS[platform] ?? PLATFORMS[c.platform] ?? { color: "#888" }).color;

                return (
                  <div
                    key={`${c.platform}-${c.campaignId || c.campaignName}`}
                    className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{c.campaignName}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <PlatformBadge platform={platform} />
                          <StatusBadge status={c.status || "unknown"} />
                        </div>
                        {c.attributionSetting ? (
                          <p className="mt-1 truncate text-[10px] text-white/35">{c.attributionSetting}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] uppercase tracking-wider text-white/35">Pixel ROAS</p>
                        <p className="text-sm font-bold tabular-nums text-emerald-400">
                          {roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[10px] text-white/40">
                        <span>Share of synced spend</span>
                        <span>{share.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, share)}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-white/35">Spend</p>
                        <p className="text-xs font-semibold text-white/80">{fmtEuro(spend)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">Reach</p>
                        <p className="text-xs font-semibold text-white/80">{reach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">Freq</p>
                        <p className="text-xs font-semibold text-white/80">{frequency.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">Pixel purchases</p>
                        <p className="text-xs font-semibold text-white/80">{conversions.toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-white/35">CTR</p>
                        <p className="text-xs font-semibold text-white/80">{ctr.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">CPC</p>
                        <p className="text-xs font-semibold text-white/80">{fmtEuroExact(cpc)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">LPV</p>
                        <p className="text-xs font-semibold text-white/80">{lpv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/35">Meta result · {labelMetaResultType(c.resultType)}</p>
                        <p className="text-xs font-semibold text-white/80">{Number(c.totalResults ?? 0).toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => c.campaignId && setDeskCampaignId(String(c.campaignId))}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-400/20 bg-blue-500/10 py-1.5 text-[11px] font-semibold text-blue-200 hover:border-blue-400/40"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit on Meta
                      </button>
                      <button
                        type="button"
                        disabled={liveStatus.isPending}
                        onClick={() => requestLiveStatus(c.platform, c.campaignId, "PAUSED", undefined, c.campaignName)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-[11px] font-semibold text-white/70 hover:border-white/20 hover:text-white disabled:opacity-40"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                      <button
                        type="button"
                        disabled={liveStatus.isPending}
                        onClick={() => requestLiveStatus(c.platform, c.campaignId, "ACTIVE", undefined, c.campaignName)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-[11px] font-semibold text-white/70 hover:border-white/20 hover:text-white disabled:opacity-40"
                      >
                        <Play className="h-3.5 w-3.5" /> Resume
                      </button>
                      <button
                        type="button"
                        disabled={scaleBudget.isPending}
                        onClick={() => requestLiveScale(c.platform, c.campaignId, c.campaignName)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-[11px] font-semibold text-white/70 hover:border-white/20 hover:text-white disabled:opacity-40"
                      >
                        <TrendingUp className="h-3.5 w-3.5" /> +20%
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AnimatedSection>

      {/* Campaign cards */}
      {isLoading ? (
        <DataLoadingState message="Loading campaigns..." />
      ) : filtered.length === 0 && syncedCampaigns.length === 0 ? (
        <div className="space-y-4">
          <EmptyDataState
            title="No campaigns found"
            description="Create your first campaign to start advertising across Meta, Google, and TikTok."
          />
          <div className="flex justify-center">
            <Link href="/campaign-launcher" className="text-sm font-semibold text-sky-300">
              Open Campaign Studio
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-1 text-xs text-white/40">
          No launcher campaigns in this workspace — synced platform campaigns are listed above.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-1">
            <button onClick={selectAll} className="flex items-center gap-2 text-[11px] font-medium text-white/40 transition-colors hover:text-white/70">
              <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${allSelected ? "border-blue-500 bg-blue-500" : "border-white/20"}`}>
                {allSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              Select all ({filtered.length})
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.map((c: any, idx: number) => {
              const isSelected = selectedIds.has(c.id);
              const platform = PLATFORMS[c.platform] ?? { color: "#888", icon: "\u{1F4E2}" };
              const budget = c.budget ?? 0;
              const spent = c.budgetSpent ?? 0;
              const budgetPct = budget > 0 ? (spent / budget) * 100 : 0;

              return (
                <motion.div key={c.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, delay: Math.min(0.03 * idx, 0.15) }}
                  className={`group relative rounded-2xl border bg-white/[0.03] p-5 backdrop-blur-xl transition-colors hover:border-white/20 ${isSelected ? "border-blue-500/40 bg-blue-500/[0.04]" : "border-white/10"}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    {/* Checkbox + name block */}
                    <div className="flex items-center gap-3 lg:w-80 lg:shrink-0">
                      <button onClick={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${isSelected ? "border-blue-500 bg-blue-500" : "border-white/20 hover:border-white/40"}`}>
                        {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                          <PlatformBadge platform={c.platform} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                    </div>

                    {/* Budget pacing */}
                    <div className="flex-1 min-w-0 lg:max-w-52">
                      <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                        <span>Budget</span>
                        <span>{budgetPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${Math.min(budgetPct, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          style={{ backgroundColor: platform.color }} />
                      </div>
                      <p className="mt-1 text-[10px] text-white/30">{fmtEuro(spent)} / {fmtEuro(budget)}</p>
                    </div>

                    {/* Status info */}
                    <div className="grid grid-cols-3 gap-4 lg:w-56 lg:shrink-0 text-center">
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">CTR</p>
                        <p className="text-xs font-semibold text-white/80">
                          {c.ctr != null ? `${Number(c.ctr).toFixed(2)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">CPC</p>
                        <p className="text-xs font-semibold text-white/80">
                          {c.cpc != null ? fmtEuro(Number(c.cpc)) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 mb-0.5">Budget</p>
                        <p className="text-xs font-semibold text-white/80">{fmtEuro(budget)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 lg:shrink-0">
                      <button
                        type="button"
                        title="Pause"
                        aria-label="Pause campaign"
                        disabled={liveStatus.isPending}
                        onClick={() =>
                          requestLiveStatus(
                            c.platform,
                            liveCampaignIdFromSettings(c.settings),
                            "PAUSED",
                            c.id,
                            c.name,
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Resume"
                        aria-label="Resume campaign"
                        disabled={liveStatus.isPending}
                        onClick={() =>
                          requestLiveStatus(
                            c.platform,
                            liveCampaignIdFromSettings(c.settings),
                            "ACTIVE",
                            c.id,
                            c.name,
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href="/campaign-launcher"
                        title="Edit in Campaign Studio"
                        aria-label="Edit campaign"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-white/20 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Bulk actions toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gray-900/90 px-6 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-xs font-bold text-blue-400">{selectedIds.size}</div>
                <span className="text-xs font-medium text-white/60">selected</span>
                <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-white/30 hover:text-white/60 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-yellow-400 transition-colors hover:bg-white/[0.08]"
                  onClick={() => {
                    const first = filtered.find((c: { id: string }) => selectedIds.has(c.id));
                    if (!first) return;
                    requestLiveStatus(
                      first.platform,
                      liveCampaignIdFromSettings(first.settings),
                      "PAUSED",
                      first.id,
                      first.name,
                    );
                  }}
                >
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-white/[0.08]"
                  onClick={() => {
                    const first = filtered.find((c: { id: string }) => selectedIds.has(c.id));
                    if (!first) return;
                    requestLiveStatus(
                      first.platform,
                      liveCampaignIdFromSettings(first.settings),
                      "ACTIVE",
                      first.id,
                      first.name,
                    );
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> Resume
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {pendingLive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Confirm before it hits the platform</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{pendingLive.label}</p>
            {pendingLive.name && (
              <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                {pendingLive.name}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLive(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={liveStatus.isPending || scaleBudget.isPending}
                onClick={() => {
                  if (pendingLive.kind === "scale") {
                    scaleBudget.mutate({
                      platform: pendingLive.platform,
                      platformCampaignId: pendingLive.campaignId,
                      multiplier: 1.2,
                      brandId: brandId || undefined,
                    });
                  } else if (pendingLive.status) {
                    liveStatus.mutate({
                      platform: pendingLive.platform,
                      platformCampaignId: pendingLive.campaignId,
                      status: pendingLive.status,
                      localCampaignId: pendingLive.localCampaignId,
                      brandId: brandId || undefined,
                    });
                  }
                  setPendingLive(null);
                }}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <MetaOperatorDesk
        campaignId={deskCampaignId}
        brandId={brandId || undefined}
        onClose={() => setDeskCampaignId(null)}
      />
    </div>
  );
}
