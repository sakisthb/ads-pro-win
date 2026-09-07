"use client";

import { ShopChips } from "@/components/brands/shop-chips";
import { useActiveMarket } from "@/hooks/use-active-market";
import { useCurrency } from "@/components/providers/currency";
import {
  MARKET_DESK_LABEL,
  MARKET_FILTER_LABEL,
  MARKET_MODE_LABEL,
  marketModeConflict,
  type MarketDesk,
  type MarketFilter,
  type MarketMode,
  type MarketAdSlice,
  type MarketTillSlice,
} from "@/lib/market-desk";

type ShopChip = { id: string; name: string };

export function DeskFilterRow({
  brands,
  brandId,
  onSelect,
}: {
  brands: ShopChip[];
  brandId: string;
  onSelect: (id: string) => void;
}) {
  const { market, setMarket, mode, visible } = useActiveMarket();
  const showChips = visible.length > 1;
  const identity =
    mode === "retail" ? "Retail shop · ΛΙΑΝΙΚΗ" : mode === "wholesale" ? "Wholesale shop · χονδρική" : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ShopChips brands={brands} brandId={brandId} onSelect={onSelect} />
      {identity && !showChips ? (
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-zinc-400">
          {identity}
        </span>
      ) : null}
      {showChips ? (
        <MarketChips value={market} options={visible} onSelect={setMarket} />
      ) : null}
    </div>
  );
}

export function MarketChips({
  value,
  options,
  onSelect,
}: {
  value: MarketFilter;
  options: MarketFilter[];
  onSelect: (next: MarketFilter) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            value === option
              ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
              : "border-white/10 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {MARKET_FILTER_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

export function MarketSplitStrip({
  markets,
  adMarkets,
  marketMode,
  unnamedAdSpend,
}: {
  markets?: Record<MarketDesk, MarketTillSlice> | null;
  adMarkets?: Record<MarketDesk, MarketAdSlice> | null;
  marketMode?: MarketMode | null;
  unnamedAdSpend?: number;
}) {
  const { format } = useCurrency();
  if (!markets) return null;
  const mode = marketMode ?? "mixed";
  const conflict = marketModeConflict(mode, markets);
  const showRetail = mode === "mixed" || mode === "retail" || markets.retail.orders > 0;
  const showWholesale = mode === "mixed" || mode === "wholesale" || markets.wholesale.orders > 0;
  const showUnknown = mode === "mixed" && markets.unknown.orders > 0;
  if (!showRetail && !showWholesale && !showUnknown && !conflict) return null;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-2">
        {showRetail ? (
          <DeskCard
            title={MARKET_DESK_LABEL.retail}
            orders={markets.retail.orders}
            net={format(markets.retail.netSales)}
            spend={adMarkets ? format(adMarkets.retail.spend) : null}
          />
        ) : null}
        {showWholesale ? (
          <DeskCard
            title={MARKET_DESK_LABEL.wholesale}
            orders={markets.wholesale.orders}
            net={format(markets.wholesale.netSales)}
            spend={adMarkets ? format(adMarkets.wholesale.spend) : null}
          />
        ) : null}
      </div>
      {showUnknown ? (
        <p className="text-xs text-zinc-500">
          {markets.unknown.orders.toLocaleString("en-US")} unclassified paid orders (
          {format(markets.unknown.netSales)}). Mixed shops leave unnamed ads out of a desk MER.
          {typeof unnamedAdSpend === "number" && unnamedAdSpend > 0
            ? ` Unnamed ad spend ${format(unnamedAdSpend)} stays unclassified.`
            : ""}
        </p>
      ) : null}
      {conflict ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          This shop is set to {MARKET_MODE_LABEL[conflict.mode]}, but {conflict.orders}{" "}
          {MARKET_DESK_LABEL[conflict.opposite]} orders ({format(conflict.netSales)}) still landed.
          Explicit opposite signals stay visible.
        </p>
      ) : null}
    </div>
  );
}

function DeskCard({
  title,
  orders,
  net,
  spend,
}: {
  title: string;
  orders: number;
  net: string;
  spend: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{title}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-white">{net}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        {orders.toLocaleString("en-US")} paid orders
        {spend ? ` · named ad spend ${spend}` : ""}
      </p>
    </div>
  );
}
