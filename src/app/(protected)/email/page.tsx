"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Mail,
  MousePointerClick,
  Send,
  Eye,
  Plug,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Store,
} from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";
import {
  DateRangePicker,
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { useCurrency } from "@/components/providers/currency";
import { EMAIL_DESK_LABEL, buildNextSendBrief, nonMppUniqueOpens, uniqueListIds, type EmailListDesk } from "@/lib/email-desk";
import { useActiveMarket } from "@/hooks/use-active-market";

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtUtc = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"
    : null;

function platformLabel(platform: string) {
  if (platform === "brevo") return "Brevo";
  if (platform === "omnisend") return "Omnisend";
  return platform;
}

type DeskFilter = "all" | EmailListDesk;

export default function EmailDeskPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId } = useActiveBrand();
  const { market } = useActiveMarket();
  const { format } = useCurrency();
  const [dateRange, setDateRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });
  const [deskFilter, setDeskFilter] = useState<DeskFilter>("all");

  useEffect(() => {
    setDateRange({ startDate: isoDaysAgo(180), endDate: todayIso() });
  }, []);

  const datesValid = dateRange.startDate !== "";
  const metricsQuery = api.emailCampaigns.getEmailMetrics.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      brandId: brandId || undefined,
      platform: "all",
      ...(market !== "all" ? { market } : {}),
    },
    { enabled: !isDemo && !isLoading && datesValid && Boolean(brandId), retry: false },
  );
  const campaignsQuery = api.emailCampaigns.listCampaigns.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      brandId: brandId || undefined,
      platform: "all",
      ...(market !== "all" ? { market } : {}),
      limit: 80,
    },
    { enabled: !isDemo && !isLoading && datesValid && Boolean(brandId), retry: false },
  );

  const metrics = metricsQuery.data?.data;
  const campaigns = campaignsQuery.data?.data?.campaigns ?? [];
  const visibleCampaigns = useMemo(
    () => (deskFilter === "all" ? campaigns : campaigns.filter((row) => row.desk === deskFilter)),
    [campaigns, deskFilter],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-400" />
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="mx-auto max-w-3xl px-1 py-16 text-center">
        <Mail className="mx-auto h-8 w-8 text-teal-400" />
        <h1 className="mt-4 text-2xl font-bold text-white">Email desk is live-shop only</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Switch out of the demo workspace to see Brevo / Omnisend delivered, opens, and clicks.
          This desk never invents email revenue.
        </p>
      </div>
    );
  }

  const connected = Boolean(metrics?.connected);
  const lastSync = fmtUtc(metrics?.lastSyncAt);
  const platforms = (metrics?.platforms ?? []).map(platformLabel);
  const hasRows = Boolean(metrics && metrics.dailyData.length > 0);
  const desks = metrics?.desks;
  const extras = metrics?.extras;
  const nextSend = desks ? buildNextSendBrief(desks) : [];
  const lists = metrics?.lists ?? [];
  const listIds = lists.length > 0 ? lists.map((row) => row.listId) : uniqueListIds(campaigns);
  const till = metrics?.till;
  const insights = metrics?.insights ?? [];
  const leftoverOpens =
    extras?.present && extras.appleMppOpens > 0
      ? nonMppUniqueOpens(metrics?.totalOpens ?? 0, extras.appleMppOpens)
      : null;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <AnimatedSection>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-teal-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                  Email · Brevo / Omnisend
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                  Email desk
                </span>
              </h1>
              <p className="max-w-2xl text-sm text-zinc-400">
                Delivered, unique opens, and clicks from the ESP. Retail and wholesale are separate
                lists. Woo last-click email is till. None of this enters Pixel ROAS.
                {typeof metrics?.archiveCampaignCount === "number" &&
                metrics.archiveCampaignCount > (metrics.campaignCount ?? 0)
                  ? ` ${fmtInt(metrics.archiveCampaignCount)} sent campaigns exist in the ESP history; this window shows ${fmtInt(metrics.campaignCount ?? 0)}. Archive is not a KPI mix.`
                  : ""}
              </p>
              <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker
                value={datesValid ? dateRange : { startDate: isoDaysAgo(180), endDate: todayIso() }}
                onChange={setDateRange}
                presets={[30, 90, 180, 360]}
              />
              <Link
                href="/connections#brevo"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 hover:border-white/20"
              >
                <Plug className="h-4 w-4" />
                Connections · Brevo
              </Link>
            </div>
          </div>
        </AnimatedSection>

        {metricsQuery.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-400" />
          </div>
        ) : metricsQuery.isError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">
            Email metrics failed: {metricsQuery.error.message}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Delivered"
                value={connected ? fmtInt(metrics?.totalSent ?? 0) : "—"}
                hint={connected ? `${metrics?.campaignCount ?? 0} sent campaigns in this window` : "Not connected"}
                icon={Send}
              />
              <Stat
                label="Unique opens"
                value={connected ? fmtInt(metrics?.totalOpens ?? 0) : "—"}
                hint={
                  leftoverOpens != null
                    ? `${fmtInt(extras?.appleMppOpens ?? 0)} Apple MPP inside this · ${fmtInt(leftoverOpens)} left after MPP (not proven human) · ${fmtPct(metrics?.openRate ?? 0)}`
                    : connected
                      ? `Open rate ${fmtPct(metrics?.openRate ?? 0)} · not proven human`
                      : "Connect Brevo first"
                }
                icon={Eye}
              />
              <Stat
                label="Clicks"
                value={connected ? fmtInt(metrics?.totalClicks ?? 0) : "—"}
                hint={connected ? `Click rate ${fmtPct(metrics?.clickRate ?? 0)}` : "Then Sync Now"}
                icon={MousePointerClick}
              />
              <Stat
                label="Woo last-click email"
                value={till && till.orders > 0 ? `${till.orders} orders` : "—"}
                hint={
                  till && till.orders > 0
                    ? `${format(till.netSales)} till · ${till.brevoOrders ?? 0} Brevo UTM · ${till.gmailAppOrders ?? 0} Gmail app · not Pixel ROAS`
                    : "No utm_source=Brevo on paid Woo orders in this window"
                }
                icon={Store}
              />
            </div>

            {typeof metrics?.archiveCampaignCount === "number" &&
              metrics.archiveCampaignCount > (metrics.campaignCount ?? 0) && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                  {fmtInt(metrics.archiveCampaignCount)} sent campaigns in the ESP history. This window
                  shows {fmtInt(metrics.campaignCount ?? 0)}. Older sends are an archive — not this
                  week&apos;s opens, clicks, or Woo last-click.
                </div>
              )}

            {!connected ? (
              <EmptyCard
                title="Brevo is not connected on this shop"
                body="Open Connections, scroll to Brevo, paste the API key, then Sync Now. Metrics will land here — they will not appear on Campaigns or Pixel ROAS."
                href="/connections#brevo"
                cta="Open Brevo on Connections"
              />
            ) : !hasRows ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold text-amber-100">Connected, but this window has 0 sent campaigns</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Last sync {lastSync ?? "has not run"}. Widen the date range, or hit Sync Now on Connections.
                    </p>
                    <Link
                      href="/connections#brevo"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-teal-300 hover:text-teal-200"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync Brevo on Connections
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {insights.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {insights.map((insight) => (
                      <div key={insight.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
                              {insight.impact === "high" ? "Do this first" : "Cited"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">{insight.title}</p>
                          </div>
                          <Link
                            href={insight.href}
                            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-teal-300 hover:text-teal-200"
                          >
                            {insight.actionLabel}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {desks && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {(["retail", "wholesale", "other"] as const).map((desk) => {
                      const row = desks[desk];
                      if (row.campaigns === 0) return null;
                      return (
                        <button
                          key={desk}
                          type="button"
                          onClick={() => setDeskFilter(deskFilter === desk ? "all" : desk)}
                          className={`rounded-xl border p-4 text-left transition-colors ${
                            deskFilter === desk
                              ? "border-teal-400/40 bg-teal-500/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20"
                          }`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{row.label}</p>
                          <p className="mt-2 text-xl font-bold tabular-nums text-white">{fmtInt(row.delivered)}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {row.campaigns} sends · open {fmtPct(row.openRate)} · click {fmtPct(row.clickRate)}
                            {row.minDelivered > 0
                              ? ` · band ${fmtInt(row.minDelivered)}–${fmtInt(row.maxDelivered)}`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {nextSend.length > 0 && (
                  <div className="rounded-xl border border-teal-400/20 bg-teal-500/[0.06] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
                      Next send · cited band
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Delivered-per-send run-rate from this window. Not list growth, not Woo, not Pixel ROAS.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {nextSend.map((row) => (
                        <div key={row.desk} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{row.label}</p>
                          <p className="mt-1 text-sm text-white">
                            Next send should land {fmtInt(row.bandMin)}–{fmtInt(row.bandMax)} delivered
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            Last send {fmtInt(row.lastDelivered)} · {row.sends} sends in window. Outside the band
                            only if they added or lost subscribers.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lists.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Brevo list ids
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Campaign delivered on each listId from the extra payload. If a send targets two
                      lists, that send is counted on both — do not add these rows to match window
                      delivered.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-white/30">
                            <th className="py-2 pr-4 font-medium">List</th>
                            <th className="py-2 pr-4 font-medium">Desk from campaign name</th>
                            <th className="py-2 text-right font-medium">Sends</th>
                            <th className="py-2 text-right font-medium">Delivered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lists.map((row) => (
                            <tr key={row.listId} className="border-t border-white/5">
                              <td className="py-2 pr-4 tabular-nums text-white/85">{row.listId}</td>
                              <td className="py-2 pr-4 text-zinc-400">
                                {row.desks.map((desk) => EMAIL_DESK_LABEL[desk]).join(" · ")}
                                {row.multiListSends > 0
                                  ? ` · ${row.multiListSends} multi-list send${row.multiListSends === 1 ? "" : "s"}`
                                  : ""}
                              </td>
                              <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.campaigns)}</td>
                              <td className="py-2 text-right tabular-nums text-white/70">{fmtInt(row.delivered)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {extras && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-zinc-400">
                    {extras.present ? (
                      <p>
                        ESP health on these rows: attempted {fmtInt(extras.sent || metrics?.totalAttempted || 0)} ·
                        hard bounces {fmtInt(extras.hardBounces)} · soft {fmtInt(extras.softBounces)} · unsubs{" "}
                        {fmtInt(extras.unsubscriptions)} · complaints {fmtInt(extras.complaints)} · Apple MPP{" "}
                        {fmtInt(extras.appleMppOpens)}
                        {leftoverOpens != null
                          ? ` · uniqueViews minus Apple MPP ${fmtInt(leftoverOpens)} (not proven human)`
                          : ""}
                        . {platforms.join(" · ")}
                        {lastSync ? ` · last sync ${lastSync}` : ""}.
                        {listIds.length > 0
                          ? ` Brevo list ids on these rows: ${listIds.join(", ")}.`
                          : " No listId on these rows yet — name classification is ΛΙΑΝΙΚΗ vs χονδρικη."}
                      </p>
                    ) : (
                      <p>
                        Bounces, unsubs, Apple MPP, and subject lines are not on these rows yet. Sync Now on
                        Connections writes them. {lastSync ? `Last sync ${lastSync}.` : ""}
                      </p>
                    )}
                  </div>
                )}

                {(metrics?.dailyData.length ?? 0) > 1 && (
                  <AnimatedSection>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                      <h2 className="text-sm font-semibold text-white/80">Daily delivered and clicks</h2>
                      <p className="mt-1 text-xs text-zinc-400">
                        Each point is a send day, not a drip of daily opens, and not subscriber growth.
                        Revenue is not on this chart.
                      </p>
                      <div className="mt-4 h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metrics?.dailyData ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                              <linearGradient id="emailSentGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v: string) => {
                                const d = new Date(`${v}T00:00:00Z`);
                                return Number.isNaN(d.getTime())
                                  ? v
                                  : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                              }}
                            />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(9,9,11,0.95)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 12,
                                fontSize: 12,
                              }}
                            />
                            <Area type="monotone" dataKey="sent" name="Delivered" stroke="#2DD4BF" fill="url(#emailSentGrad)" strokeWidth={2} />
                            <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#A78BFA" fill="none" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AnimatedSection>
                )}

                <AnimatedSection>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-6 pb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-white/80">Sent campaigns</h2>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Desk is inferred from the campaign name. Conversion / revenue stay 0 — Brevo does not send till.
                        </p>
                      </div>
                      {deskFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => setDeskFilter("all")}
                          className="text-[11px] font-semibold text-teal-300 hover:text-teal-200"
                        >
                          Show all lists
                        </button>
                      )}
                    </div>
                    {visibleCampaigns.length === 0 ? (
                      <p className="px-6 py-8 text-sm text-zinc-400">No campaign rows in this list after the last sync.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left text-sm">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-white/30">
                              <th className="px-6 py-3 font-medium">Campaign</th>
                              <th className="px-4 py-3 font-medium">Desk</th>
                              <th className="px-4 py-3 text-right font-medium">Delivered</th>
                              <th className="px-4 py-3 text-right font-medium">Opens</th>
                              <th className="px-4 py-3 text-right font-medium">Open %</th>
                              <th className="px-4 py-3 text-right font-medium">Clicks</th>
                              <th className="px-4 py-3 text-right font-medium">Click %</th>
                              {extras?.present && (
                                <>
                                  <th className="px-4 py-3 text-right font-medium">Unsubs</th>
                                  <th className="px-6 py-3 text-right font-medium">MPP</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleCampaigns.map((row) => (
                              <tr key={`${row.platform}-${row.id}`} className="border-t border-white/5">
                                <td className="px-6 py-2.5 text-white/85">
                                  <p>{row.name}</p>
                                  {row.subject ? <p className="mt-0.5 text-[11px] text-zinc-500">{row.subject}</p> : null}
                                  {row.extra?.tags && row.extra.tags.length > 0 ? (
                                    <p className="mt-0.5 text-[10px] text-zinc-600">{row.extra.tags.join(" · ")}</p>
                                  ) : null}
                                  {row.extra?.listIds && row.extra.listIds.length > 0 ? (
                                    <p className="mt-0.5 text-[10px] text-zinc-600">
                                      list {row.extra.listIds.join(", ")}
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2.5 text-white/50">{EMAIL_DESK_LABEL[row.desk]}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtInt(row.metrics.sent)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtInt(row.metrics.opens)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtPct(row.metrics.openRate)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtInt(row.metrics.clicks)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-white/70">{fmtPct(row.metrics.clickRate)}</td>
                                {extras?.present && (
                                  <>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-white/70">
                                      {fmtInt(row.metrics.unsubscriptions)}
                                    </td>
                                    <td className="px-6 py-2.5 text-right tabular-nums text-white/70">
                                      {fmtInt(row.metrics.appleMppOpens)}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Mail;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-teal-300/80" />
        <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function EmptyCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">{body}</p>
      <Link href={href} className="mt-4 inline-flex text-xs font-semibold text-teal-300 hover:text-teal-200">
        {cta}
      </Link>
    </div>
  );
}
