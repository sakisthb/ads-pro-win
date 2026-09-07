"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Rocket, Palette, Scale, Users, FileText, Bot, ListChecks,
  Clock, Play, UserPlus, Mail, ArrowRight, Plug, Sparkles, Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedSection, StaggerContainer, fadeInUp } from "@/components/ui/animated-section";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { api } from "@/lib/trpc/react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket, withMarketQuery } from "@/hooks/use-active-market";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { formatMoney } from "@/lib/currency";
import { buildEspEmailExportRows } from "@/lib/email-desk";
import {
  downloadBlob,
  generateMultiSectionCSV,
} from "@/lib/export/csv-generator";
import { askAi } from "@/lib/ask-ai";
import { mergeConnectedPaidPlatforms, sumAccountSpendForPlatform } from "@/lib/paid-ad-metrics";
import { buildOperatorDesk, operatorDeskReady } from "@/lib/operator-clocks";
import { FiveClockStrip, OperatorBlockerBoard } from "@/components/dashboard/operator-board";
import {
  buildTeamPlanAsk,
  deriveTeamDesks,
  demoTeamDeskInput,
  type DeskId,
  type DeskStatus,
  type TeamDesk,
} from "@/lib/team-desks";

const DESK_UI: Record<DeskId, { icon: LucideIcon; color: string }> = {
  optimizer: { icon: Rocket, color: "#22D3EE" },
  creative: { icon: Palette, color: "#8B5CF6" },
  budget: { icon: Scale, color: "#10B981" },
  audience: { icon: Users, color: "#F59E0B" },
  reports: { icon: FileText, color: "#38BDF8" },
};

const STATUS_UI: Record<DeskStatus, { label: string; chip: string; text: string; dot: string; pulse: boolean }> = {
  ready: {
    label: "Ready",
    chip: "border-emerald-500/20 bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    pulse: true,
  },
  watching: {
    label: "Watching",
    chip: "border-sky-500/20 bg-sky-500/10",
    text: "text-sky-300",
    dot: "bg-sky-400",
    pulse: true,
  },
  needs_data: {
    label: "Needs data",
    chip: "border-zinc-500/20 bg-zinc-500/10",
    text: "text-zinc-400",
    dot: "bg-zinc-400",
    pulse: false,
  },
};

function deskAskHref(prompt: string) {
  return `/chat?ask=${encodeURIComponent(prompt)}`;
}

function DeskCard({
  desk,
  onExport,
  onAsk,
}: {
  desk: TeamDesk;
  onExport?: () => void;
  onAsk: (prompt: string) => void;
}) {
  const ui = DESK_UI[desk.id];
  const Icon = ui.icon;
  const st = STATUS_UI[desk.status];
  return (
    <motion.div
      variants={fadeInUp}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-white/20"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${ui.color}20` }}>
            <Icon className="h-5 w-5" style={{ color: ui.color }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{desk.name}</h3>
            <p className="text-[10px] text-white/40">{desk.role}</p>
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.chip} ${st.text}`}>
          <span className="relative flex h-1.5 w-1.5">
            {st.pulse && <span className={`absolute h-full w-full animate-ping rounded-full ${st.dot} opacity-60`} />}
            <span className={`relative h-1.5 w-1.5 rounded-full ${st.dot}`} />
          </span>
          {st.label}
        </span>
      </div>
      <div className="rounded-lg bg-white/[0.03] p-2.5">
        <p className="text-[10px] text-white/30">{desk.metricLabel}</p>
        <p className="text-base font-bold tabular-nums text-white">{desk.metricValue}</p>
      </div>
      <p className="mt-3 flex-1 text-[12px] leading-relaxed text-zinc-400">{desk.finding}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={desk.href}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/10"
        >
          {desk.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => onAsk(desk.askPrompt)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Run with Ask AI
        </button>
        <Link
          href={deskAskHref(desk.askPrompt)}
          className="text-center text-[10px] font-medium text-white/35 hover:text-white/60"
        >
          Open in full chat
        </Link>
        {desk.id === "reports" && onExport && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV now
          </button>
        )}
      </div>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: ui.color }} />
    </motion.div>
  );
}

export default function TeamPage() {
  const { org, isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const { currency } = useCurrency();
  const dateRange = useIsoDateRange(30);
  const shopQuery = withMarketQuery(brandId, market);
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));
  const live = !isDemo && !isLoading && dateRange.startDate !== "" && shopReady;

  const membersQuery = api.invitations.listMembers.useQuery(undefined, {
    enabled: live,
    retry: false,
  });
  const invitationsQuery = api.invitations.list.useQuery(undefined, {
    enabled: live,
    retry: false,
  });
  const connectionsQuery = api.connections.list.useQuery(
    {},
    { enabled: live, retry: false },
  );
  const accountQuery = api.marketing.getAccountSummary.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: live, retry: false },
  );
  const wastedQuery = api.marketing.findWastedSpend.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, roasThreshold: 1, minSpend: 50, ...shopQuery },
    { enabled: live, retry: false },
  );
  const topQuery = api.marketing.getTopCampaigns.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, metric: "spend", limit: 12, ...shopQuery },
    { enabled: live, retry: false },
  );
  const alertsQuery = api.alerts.listTriggered.useQuery(undefined, {
    enabled: live,
    retry: false,
  });
  const emailMetrics = api.emailCampaigns.getEmailMetrics.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, platform: "all", ...shopQuery },
    { enabled: live, retry: false },
  );
  const merQuery = api.commerce.compareAdSpendToRevenue.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: live, retry: false, refetchOnWindowFocus: false },
  );
  const ga4Mix = api.marketing.getGa4ChannelMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: live, retry: false, refetchOnWindowFocus: false },
  );
  const gscQuery = api.marketing.getSearchConsole.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, ...shopQuery },
    { enabled: live, retry: false, refetchOnWindowFocus: false },
  );

  const liveBriefing = useMemo(() => {
    if (isDemo) return demoTeamDeskInput(currency);
    const accounts = accountQuery.data?.data?.accounts ?? [];
    const totals = accountQuery.data?.data?.totals;
    const wasted = wastedQuery.data?.data;
    const campaigns = (topQuery.data?.data?.campaigns ?? []).map((c) => ({
      name: c.campaignName,
      spend: c.totalSpend,
      roas: c.roas,
      impressions: c.totalImpressions,
      clicks: c.totalClicks,
      platform: c.platform,
    }));
    const connected = (connectionsQuery.data?.connections ?? []).filter((c) => c.isConnected).length;
    return {
      currency,
      connectedAccounts: connected,
      accounts: accounts.map((a) => ({
        name: a.name,
        platform: a.platform,
        totalSpend: a.totalSpend,
        roas: a.roas,
      })),
      campaigns,
      wasted: {
        count: wasted?.count ?? 0,
        totalWastedSpend: wasted?.totalWastedSpend ?? 0,
        topName: wasted?.wastedCampaigns[0]?.campaignName,
        topRoas: wasted?.wastedCampaigns[0]?.roas,
      },
      totals: totals
        ? {
            spend: totals.totalSpend,
            revenue: totals.totalConversionValue,
            roas: totals.blendedROAS,
            conversions: totals.totalConversions,
            ctr: totals.blendedCTR,
          }
        : null,
      alertCount: alertsQuery.data?.length ?? 0,
      email: emailMetrics.data?.data
        ? {
            connected: Boolean(emailMetrics.data.data.connected),
            delivered: emailMetrics.data.data.totalSent,
            uniqueOpens: emailMetrics.data.data.totalOpens,
            clicks: emailMetrics.data.data.totalClicks,
          }
        : null,
      googleAds: {
        connected: mergeConnectedPaidPlatforms(
          (connectionsQuery.data?.connections ?? [])
            .filter((c) => c.isConnected)
            .map((c) => c.platform),
        ).includes("google"),
        spend: sumAccountSpendForPlatform(accounts, "google"),
      },
    };
  }, [
    isDemo,
    currency,
    accountQuery.data,
    wastedQuery.data,
    topQuery.data,
    connectionsQuery.data,
    alertsQuery.data,
    emailMetrics.data,
  ]);

  const { desks, tasks } = useMemo(
    () => deriveTeamDesks(liveBriefing),
    [liveBriefing],
  );

  const operatorDesk = useMemo(
    () =>
      buildOperatorDesk({
        totals: liveBriefing.totals
          ? {
              totalSpend: liveBriefing.totals.spend,
              totalConversionValue: liveBriefing.totals.revenue,
              totalConversions: liveBriefing.totals.conversions,
              blendedROAS: liveBriefing.totals.roas,
            }
          : null,
        mer: merQuery.data?.data,
        ga4: ga4Mix.data?.data,
        gsc: gscQuery.data,
        email: emailMetrics.data?.data,
        googleAdsConnected: liveBriefing.googleAds?.connected ?? false,
        googleAdsSpend: liveBriefing.googleAds?.spend ?? 0,
        currency,
      }),
    [liveBriefing, merQuery.data, ga4Mix.data, gscQuery.data, emailMetrics.data, currency],
  );
  const deskReady = operatorDeskReady(merQuery, ga4Mix, gscQuery, emailMetrics);

  const handleExportReports = () => {
    const totals = liveBriefing.totals;
    const accounts = liveBriefing.accounts;
    const campaigns = liveBriefing.campaigns;
    const email = liveBriefing.email;
    const money = (n: number) =>
      formatMoney(n, currency, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const blob = generateMultiSectionCSV([
      {
        title: "Summary",
        headers: ["Metric", "Value"],
        rows: [
          ["Spend", money(totals?.spend ?? 0)],
          ["Pixel conversion value", money(totals?.revenue ?? 0)],
          ["Pixel ROAS", `${(totals?.roas ?? 0).toFixed(2)}x`],
          ["Pixel conversions", String(Math.round(totals?.conversions ?? 0))],
          ["CTR", `${(totals?.ctr ?? 0).toFixed(2)}%`],
        ],
      },
      {
        title: "Accounts",
        headers: ["Account", "Platform", "Spend", "Pixel ROAS"],
        rows: accounts.map((a) => [a.name, a.platform, money(a.totalSpend), a.roas.toFixed(2)]),
      },
      {
        title: "Top campaigns",
        headers: ["Campaign", "Platform", "Spend", "Pixel ROAS"],
        rows: campaigns.map((c) => [c.name, c.platform ?? "", money(c.spend), c.roas.toFixed(2)]),
      },
      ...(email && email.connected
        ? [
            {
              title: "ESP email (not till, not pixel)",
              headers: ["Metric", "Value"],
              rows: buildEspEmailExportRows({
                delivered: email.delivered,
                uniqueOpens: email.uniqueOpens,
                clicks: email.clicks,
                extrasPresent: false,
                appleMppOpens: 0,
                retailDelivered: 0,
                wholesaleDelivered: 0,
              }),
            },
          ]
        : []),
    ]);
    downloadBlob(blob, `ai-team-brief-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  const liveQueriesLoading =
    live &&
    (accountQuery.isLoading ||
      wastedQuery.isLoading ||
      topQuery.isLoading ||
      connectionsQuery.isLoading);

  const members = membersQuery.data?.data ?? [];
  const pendingInvitations = (invitationsQuery.data?.data ?? []).filter(
    (inv) => inv.status === "pending",
  );
  const readyCount = desks.filter((d) => d.status === "ready").length;
  const needsCount = desks.filter((d) => d.status === "needs_data").length;

  const roleChip = (role: string) =>
    role === "admin" || role === "owner"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
      : role === "viewer"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                  {isDemo ? "Demo briefing · last 30 days" : "Last 30 days · grounded in this workspace"}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  AI Team
                </span>
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400">
                Five desks that read your ads data. Open the matching tool to act, or run Ask AI here.
                They do not change bids on Meta, Google, or TikTok from this page. Conversion value is pixel, not till. Five clocks — do not add them.
              </p>
              {!isDemo && (
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                {readyCount} ready · {needsCount} waiting on data
              </span>
              <button
                type="button"
                onClick={() => askAi(buildTeamPlanAsk(desks))}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-[1.02]"
              >
                <Play className="h-4 w-4" />
                Ask AI for a plan
              </button>
            </div>
          </div>
        </AnimatedSection>

        {!isDemo && (
          <>
            <FiveClockStrip clocks={operatorDesk.clocks} ready={deskReady} />
            <OperatorBlockerBoard blockers={operatorDesk.blockers} ready={deskReady} />
          </>
        )}

        {liveQueriesLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-400" />
          </div>
        ) : (
          <>
            <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {desks.map((desk) => (
                <DeskCard
                  key={desk.id}
                  desk={desk}
                  onAsk={askAi}
                  onExport={desk.id === "reports" ? handleExportReports : undefined}
                />
              ))}
            </StaggerContainer>

            <AnimatedSection>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white/80">Work queue</h2>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      One job per desk. Ask AI here, or open the desk to act — nothing is auto-applied to the ad platforms.
                    </p>
                  </div>
                  <span className="flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold text-sky-300">
                    <ListChecks className="h-3 w-3" />
                    {readyCount} to do
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                        <th className="px-6 py-3 font-medium">Desk</th>
                        <th className="px-4 py-3 font-medium">Job</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 text-right font-medium">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const ts = STATUS_UI[t.status];
                        const color = DESK_UI[t.deskId].color;
                        return (
                          <tr key={t.deskId} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                            <td className="px-6 py-3">
                              <span className="flex items-center gap-2 font-medium text-white">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                {t.agent}
                              </span>
                            </td>
                            <td className="max-w-xl px-4 py-3 text-zinc-400">{t.task}</td>
                            <td className="px-4 py-3">
                              <span className={`flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ts.chip} ${ts.text}`}>
                                {ts.label}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => askAi(t.askPrompt)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-300 hover:text-fuchsia-200"
                                >
                                  Ask AI
                                </button>
                                <Link href={t.href} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">
                                  Go <ArrowRight className="h-3 w-3" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </AnimatedSection>
          </>
        )}

        {!isDemo && (
          <AnimatedSection delay={0.08}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white/80">Workspace members</h2>
                </div>
                <Link
                  href="/team-members"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-violet-200"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite teammate
                </Link>
              </div>
              {membersQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-zinc-500">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No members found for this workspace.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map((member) => {
                    const initials = (member.fullName || member.email)
                      .split(/\s+/)
                      .map((part: string) => part.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <div key={member.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-bold text-white">
                          {initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{member.fullName || "—"}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${roleChip(member.role)}`}>
                              {member.role}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-zinc-400">{member.email}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {pendingInvitations.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <Mail className="h-3.5 w-3.5" />
                        {inv.email}
                      </span>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        Awaiting {inv.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AnimatedSection>
        )}

        {live && (connectionsQuery.data?.connections?.length ?? 0) === 0 && (
          <AnimatedSection>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Plug className="h-4 w-4 text-zinc-500" />
                No ad accounts connected — desks stay on “Needs data” until a sync lands.
              </div>
              <Link href="/connections" className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                Open Connections
              </Link>
            </div>
          </AnimatedSection>
        )}

        <div className="flex items-center gap-2 text-[11px] text-white/30">
          <Clock className="h-3.5 w-3.5" />
          Briefing for {org?.name ?? "this workspace"} · {dateRange.startDate} → {dateRange.endDate}
          {isDemo ? " · sample StyleVault numbers" : ""}
        </div>
      </div>
    </div>
  );
}
