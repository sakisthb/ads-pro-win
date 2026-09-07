"use client";

import { Banknote, Check } from "lucide-react";
import { useCurrency } from "@/components/providers/currency";
import { useActiveOrg } from "@/hooks/use-active-org";
import { api } from "@/components/providers/trpc-provider";
import { CURRENCY_OPTIONS, type ReportingCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CurrencyPicker({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { currency, setCurrency } = useCurrency();
  const { isDemo } = useActiveOrg();
  const updateOrg = api.organizations.updateCurrency.useMutation();

  const choose = (next: ReportingCurrency) => {
    if (next === currency) return;
    setCurrency(next);
    if (!isDemo) updateOrg.mutate({ currency: next });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-emerald-300">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Display currency</p>
            <p className="mt-0.5 text-sm text-zinc-400">
              Choose euro or US dollar. Dashboards, reports, and exports use this
              currency.
            </p>
          </div>
        </div>
      )}
      <div className={cn("grid gap-3", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        {CURRENCY_OPTIONS.map((option) => {
          const active = currency === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              aria-pressed={active}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-300",
                active
                  ? "border-emerald-400/40 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold",
                  active
                    ? "bg-gradient-to-br from-emerald-500 to-sky-500 text-white"
                    : "bg-white/10 text-zinc-300",
                )}
              >
                {option.symbol}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {option.value} · {option.description}
                </span>
              </span>
              {active && (
                <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
