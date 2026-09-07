"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ElementType } from "react";
import { Mail, MousePointerClick, Send, Eye } from "lucide-react";
import { api } from "@/components/providers/trpc-provider";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { nonMppUniqueOpens } from "@/lib/email-desk";

const GLASS =
  "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

const fmtNumber = (n: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { date?: string; clicks?: number; sent?: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-950/90 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-xl">
      <p className="font-medium text-white/60">{d?.date}</p>
      <p className="font-semibold text-emerald-300 tabular-nums">
        {fmtNumber(d?.clicks ?? 0)} clicks · {fmtNumber(d?.sent ?? 0)} delivered
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ElementType;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          accent,
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">
          {label}
        </p>
        <p className="text-sm font-bold tracking-tight text-white tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

export function EmailMetricsPanel({
  startDate,
  endDate,
  brandId,
}: {
  startDate: string;
  endDate: string;
  brandId?: string;
}) {
  const query = api.emailCampaigns.getEmailMetrics.useQuery(
    {
      startDate,
      endDate,
      platform: "all",
      brandId: brandId || undefined,
    },
    { enabled: !!startDate && !!endDate },
  );

  const data = query.data?.data;
  const loading = query.isLoading;
  const error = query.isError;
  const hasData = Boolean(data && data.dailyData.length > 0);
  const lastSync = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <div className={cn(GLASS, "p-5 sm:p-6")}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg">
            <Mail className="h-5 w-5 text-white" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              Email Marketing
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              Brevo / Omnisend delivered and clicks. Not till revenue. Not pixel ROAS.
            </p>
          </div>
        </div>
        <Link href="/email" className="text-xs font-medium text-teal-300 hover:text-teal-200">
          Open Email desk
        </Link>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <span className="text-sm text-rose-400">
            Failed to load email metrics. Check your connection and try again.
          </span>
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Mail className="h-4 w-4 text-white/40" />
          </span>
          <p className="max-w-md text-sm text-white/50">
            {data?.connected
              ? lastSync
                ? `Email is connected. Last sync ${lastSync} wrote 0 sent campaigns in this window. Widen the date range (Email desk defaults to 180 days) — 0 delivered here is not 0 influence and not Pixel ROAS.`
                : "Email is connected but has not synced yet. Open Connections and Sync Now."
              : "No email campaign data yet. Connect Omnisend or Brevo and sync to see delivered and clicks here."}
          </p>
          <Link href="/connections" className="text-xs font-medium text-teal-300 hover:text-teal-200">
            Open Connections
          </Link>
        </div>
      )}

      {!loading && !error && hasData && data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox
              label="Delivered"
              value={fmtNumber(data.totalSent)}
              icon={Send}
              accent="bg-gradient-to-br from-blue-500 to-cyan-500"
            />
            <StatBox
              label="Click rate"
              value={fmtPct(data.clickRate)}
              icon={MousePointerClick}
              accent="bg-gradient-to-br from-violet-500 to-fuchsia-500"
            />
            <StatBox
              label="Unique opens"
              value={fmtNumber(data.totalOpens)}
              icon={Eye}
              accent="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
            <StatBox
              label="Open rate"
              value={fmtPct(data.openRate)}
              icon={Mail}
              accent="bg-gradient-to-br from-amber-500 to-orange-500"
            />
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            Click rate is clicks / delivered. Open rate is unique opens / delivered.
            Brevo does not report order revenue on this API — till stays on Woo.
            {data.desks?.retail?.delivered
              ? ` Retail ${data.desks.retail.delivered.toLocaleString("en-US")} delivered · wholesale ${data.desks.wholesale.delivered.toLocaleString("en-US")}.`
              : ""}
            {data.extras?.present && data.extras.appleMppOpens > 0
              ? ` ${nonMppUniqueOpens(data.totalOpens, data.extras.appleMppOpens).toLocaleString("en-US")} uniqueViews after Apple MPP — not proven human.`
              : ""}
              {data.till && data.till.orders > 0
              ? ` Woo last-click email: ${data.till.orders} orders (${data.till.brevoOrders ?? 0} Brevo UTM, ${data.till.gmailAppOrders ?? 0} Gmail app) — till, not Pixel ROAS.`
              : ""}
            {typeof data.archiveCampaignCount === "number" &&
            data.archiveCampaignCount > data.campaignCount
              ? ` ${data.archiveCampaignCount.toLocaleString("en-US")} sent in the ESP history vs ${data.campaignCount} in this window — archive, not a KPI mix.`
              : ""}
            {lastSync ? ` Last sync ${lastSync}.` : ""}
          </p>

          {data.dailyData.length > 1 && (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-white/40">
                Daily clicks
              </p>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.dailyData}
                    margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="emailRevGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#14b8a6"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="100%"
                          stopColor="#14b8a6"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={32}
                      tickFormatter={(v: string) => {
                        const d = new Date(`${v}T00:00:00Z`);
                        return Number.isNaN(d.getTime())
                          ? v
                          : d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            });
                      }}
                    />
                    <Tooltip content={<SparkTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill="url(#emailRevGrad)"
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0, fill: "#14b8a6" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
