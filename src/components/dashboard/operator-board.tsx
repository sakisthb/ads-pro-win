"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { OperatorBlocker, OperatorClock } from "@/lib/operator-clocks";

const CLOCK_TONE: Record<OperatorClock["id"], string> = {
  pixel: "border-violet-500/20 bg-violet-500/5",
  till: "border-emerald-500/20 bg-emerald-500/5",
  ga4: "border-amber-500/20 bg-amber-500/5",
  gsc: "border-sky-500/20 bg-sky-500/5",
  email: "border-teal-500/20 bg-teal-500/5",
};

export function FiveClockStrip({
  clocks,
  caption = "Pixel, till, GA4, Search Console, and email. Name them. Do not add them.",
  ready = true,
}: {
  clocks: OperatorClock[];
  caption?: string;
  ready?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Five clocks</h2>
          <p className="text-xs text-white/40">{caption}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ready
          ? clocks.map((clock) => (
              <Link
                key={clock.id}
                href={clock.href}
                className={`rounded-xl border p-3 transition-colors hover:border-white/25 ${CLOCK_TONE[clock.id]}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{clock.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{clock.primary}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/55">{clock.secondary}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-white/30">{clock.not}</p>
              </Link>
            ))
          : ["pixel", "till", "ga4", "gsc", "email"].map((id) => (
              <div
                key={id}
                className="animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="h-2.5 w-12 rounded bg-white/10" />
                <div className="mt-3 h-6 w-20 rounded bg-white/10" />
                <div className="mt-2 h-3 w-28 rounded bg-white/10" />
              </div>
            ))}
      </div>
    </div>
  );
}

export function OperatorBlockerBoard({
  blockers,
  ready = true,
}: {
  blockers: OperatorBlocker[];
  ready?: boolean;
}) {
  if (!ready || blockers.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <div>
          <h2 className="text-sm font-semibold text-white">Open blockers</h2>
          <p className="text-xs text-white/40">
            Shop-side jobs. Ads Pro reads the clocks — it does not fire CAPI, tax, or Google Ads tokens.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {blockers.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-white">{row.title}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  row.severity === "high"
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {row.severity}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/50">{row.detail}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300">
              {row.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
