"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/trpc/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface BrandSelectorProps {
  /** Currently selected brand id (controlled by the parent). */
  selectedBrandId?: string;
  /** Fired when the user picks a brand from the dropdown. */
  onSelect: (brandId: string) => void;
}

/**
 * Deterministic gradient palette — the same brand name always maps to the
 * same tile, so the selector feels stable across renders and pages.
 */
const AVATAR_GRADIENTS = [
  "from-indigo-500 via-violet-500 to-purple-600",
  "from-cyan-500 via-sky-500 to-blue-600",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-fuchsia-500 via-purple-500 to-indigo-600",
  "from-rose-400 via-pink-500 to-fuchsia-600",
] as const;

function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function BrandAvatar({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm",
        "bg-gradient-to-br",
        gradientForName(name),
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/**
 * Reusable brand picker for the active organization.
 *
 * Renders a glassmorphism dropdown of the org's brands (powered by
 * `api.brands.list`). The component is fully controlled — parents own the
 * selected id via `selectedBrandId` and receive changes through `onSelect`.
 */
export function BrandSelector({
  selectedBrandId,
  onSelect,
}: BrandSelectorProps) {
  const [open, setOpen] = useState(false);

  const {
    data: brands,
    isLoading,
    isError,
  } = api.brands.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const list = brands ?? [];
  const selected = list.find((b) => b.id === selectedBrandId) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select brand"
          className="group flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] pl-1.5 pr-2.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98] data-[state=open]:border-white/20 data-[state=open]:bg-white/[0.08]"
        >
          {selected ? (
            <BrandAvatar name={selected.name} />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/40">
              <ShoppingBag className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="min-w-0 max-w-[160px]">
            <span className="block truncate text-xs font-semibold leading-tight text-white">
              {selected ? selected.name : "Select brand"}
            </span>
            {selected && (
              <span className="block text-[10px] font-medium uppercase tracking-wide text-white/40">
                {selected._count.adAccounts}{" "}
                {selected._count.adAccounts === 1
                  ? "account"
                  : "accounts"}
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[280px] border border-white/10 bg-zinc-950/95 p-0 shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                  Brands
                </p>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/40">
                  {list.length}
                </span>
              </div>

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading brands…
                </div>
              )}

              {/* Error state */}
              {isError && !isLoading && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <AlertCircle className="h-5 w-5 text-red-400/70" />
                  <p className="text-xs text-white/40">
                    Failed to load brands
                  </p>
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !isError && list.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-inset ring-white/10">
                    <ShoppingBag className="h-4 w-4 text-purple-300" />
                  </span>
                  <p className="text-xs font-medium text-white/60">
                    No brands yet
                  </p>
                  <p className="max-w-[200px] text-[10px] leading-relaxed text-white/35">
                    Create your first brand to start connecting ad accounts.
                  </p>
                </div>
              )}

              {/* Brand list */}
              {!isLoading && !isError && list.length > 0 && (
                <div className="max-h-72 overflow-y-auto py-1.5">
                  {list.map((brand, index) => {
                    const isActive = brand.id === selectedBrandId;
                    const accounts = brand._count.adAccounts;
                    return (
                      <motion.button
                        key={brand.id}
                        type="button"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.03 * index,
                          duration: 0.15,
                          ease: "easeOut",
                        }}
                        onClick={() => {
                          onSelect(brand.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]",
                          isActive && "bg-white/[0.06]",
                        )}
                      >
                        <BrandAvatar name={brand.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-white">
                            {brand.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-white/35">
                            /{brand.slug}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold tabular-nums ring-1 ring-inset",
                            accounts > 0
                              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
                              : "bg-white/5 text-white/40 ring-white/10",
                          )}
                        >
                          {accounts}
                        </span>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-purple-400"
                              : "text-transparent group-hover:text-white/15",
                          )}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
