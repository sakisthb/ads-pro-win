"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  Gem,
  Palette,
  Sparkles,
  Telescope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readMystery,
  type MysteryCampaign,
  type MysteryMode,
  type MysteryReading,
} from "@/lib/mystery-insights";
import { useCurrency } from "@/components/providers/currency";

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

const MODES: { id: MysteryMode; label: string; icon: typeof Sparkles }[] = [
  { id: "fortune", label: "Fortune", icon: Sparkles },
  { id: "tarot", label: "Tarot", icon: Gem },
  { id: "crystal", label: "Crystal", icon: Telescope },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "spy", label: "Spy", icon: Eye },
];

const TONE: Record<MysteryReading["tone"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  info: "border-white/15 bg-white/5 text-white/80",
};

export function FortunePanel({
  campaigns,
  loading,
}: {
  campaigns: MysteryCampaign[];
  loading?: boolean;
}) {
  const [mode, setMode] = useState<MysteryMode>("fortune");
  const [selected, setSelected] = useState("all");
  const [reading, setReading] = useState<MysteryReading | null>(null);
  const { currency } = useCurrency();

  const names = useMemo(
    () => ["all", ...campaigns.map((c) => c.name)],
    [campaigns],
  );

  const run = () => {
    setReading(readMystery(mode, campaigns, selected, currency));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block text-xs text-white/45">
          Campaign
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setReading(null);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none sm:min-w-[260px]"
          >
            {names.map((name) => (
              <option key={name} value={name} className="bg-zinc-900">
                {name === "all" ? "All campaigns" : name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Read the numbers
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setReading(null);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                active
                  ? "border-violet-400/40 bg-violet-500/20 text-violet-100"
                  : "border-white/10 bg-white/5 text-white/55 hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={cn(GLASS, "h-32 animate-pulse")} />
      ) : reading ? (
        <div className={cn(GLASS, "p-5")}>
          <p
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              TONE[reading.tone],
            )}
          >
            {reading.title}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/85">{reading.message}</p>
          {reading.cards && reading.cards.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {reading.cards.map((card) => (
                <div
                  key={card.name}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <p className="text-xs font-semibold text-white">{card.name}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">{card.meaning}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] text-white/35">{reading.cited}</p>
        </div>
      ) : (
        <div className={cn(GLASS, "p-5 text-sm text-white/45")}>
          Pick a campaign and a method. Readings cite synced spend, pixel ROAS, and CTR — they are not till, not GA4, and not a forecast model.
          {campaigns.length === 0 && (
            <span>
              {" "}
              Nothing is synced yet.{" "}
              <Link href="/connections" className="text-violet-300 underline-offset-2 hover:underline">
                Open Connections
              </Link>
              .
            </span>
          )}
        </div>
      )}
    </div>
  );
}
