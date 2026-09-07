"use client";

import { Loader2, Database, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Loading skeleton for data sections
// ---------------------------------------------------------------------------
export function DataLoadingState({ message = "Loading data..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      <p className="text-sm text-white/40">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton row for card grids
// ---------------------------------------------------------------------------
export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-3 w-16 rounded bg-white/10" />
            <div className="h-8 w-8 rounded-lg bg-white/10" />
          </div>
          <div className="h-7 w-24 rounded bg-white/10" />
          <div className="mt-2 h-3 w-20 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — no data yet
// ---------------------------------------------------------------------------
export function EmptyDataState({
  title = "No data available",
  description = "Connect your ad accounts and start running campaigns to see real performance data here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center backdrop-blur-xl">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05]">
        <Database className="h-6 w-6 text-white/30" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-white/70">{title}</h3>
        <p className="max-w-sm text-xs leading-relaxed text-white/40">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coming Soon badge — for sections without endpoints
// ---------------------------------------------------------------------------
export function ComingSoonSection({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-white/30" />
        <h2 className="text-sm font-semibold text-white/50">{title}</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          Coming Soon
        </span>
      </div>
      {description && (
        <p className="text-xs text-white/30">{description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range helper — compute YYYY-MM-DD strings for last N days
// ---------------------------------------------------------------------------
export function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
