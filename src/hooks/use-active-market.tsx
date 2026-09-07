"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import {
  defaultMarketFilter,
  parseMarketMode,
  resolveMarketMode,
  visibleMarketFilters,
  type MarketFilter,
  type MarketMode,
} from "@/lib/market-desk";

export const ACTIVE_MARKET_STORAGE_KEY = "adspro:active-market";

export type MarketDesksHint = {
  retail?: { orders?: number };
  wholesale?: { orders?: number };
};

type MarketContextValue = {
  market: MarketFilter;
  setMarket: (next: MarketFilter) => void;
  mode: MarketMode;
  visible: MarketFilter[];
  setDesks: (desks: MarketDesksHint | undefined) => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

function readStoredMarket(orgId: string | undefined): MarketFilter | null {
  if (!orgId) return null;
  try {
    const raw = window.sessionStorage.getItem(`${ACTIVE_MARKET_STORAGE_KEY}:${orgId}`);
    if (raw === "all" || raw === "retail" || raw === "wholesale") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredMarket(orgId: string | undefined, market: MarketFilter) {
  if (!orgId) return;
  try {
    window.sessionStorage.setItem(`${ACTIVE_MARKET_STORAGE_KEY}:${orgId}`, market);
  } catch {
    /* ignore */
  }
}

export function withMarketQuery(brandId: string | undefined | null, market: MarketFilter) {
  return {
    ...(brandId ? { brandId } : {}),
    ...(market !== "all" ? { market } : {}),
  };
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const { org } = useActiveOrg();
  const { selected, brands } = useActiveBrand();
  const [market, setMarketState] = useState<MarketFilter>("all");
  const [desks, setDesks] = useState<MarketDesksHint | undefined>();

  const mode = useMemo<MarketMode>(() => {
    const orgMode = parseMarketMode(org?.marketMode);
    if (brands.length === 0) return orgMode;
    if (selected) return resolveMarketMode(selected.marketMode, orgMode);
    const resolved = brands.map((b) => resolveMarketMode(b.marketMode, orgMode));
    const unique = new Set(resolved);
    if (unique.size === 1) return resolved[0] ?? orgMode;
    return "mixed";
  }, [org?.marketMode, selected, brands]);

  const visible = useMemo(() => visibleMarketFilters(mode, desks), [mode, desks]);

  useEffect(() => {
    const saved = readStoredMarket(org?.id);
    const next = saved && visibleMarketFilters(mode).includes(saved)
      ? saved
      : defaultMarketFilter(mode);
    setMarketState(next);
    setDesks(undefined);
  }, [org?.id, selected?.id, mode]);

  useEffect(() => {
    if (!visible.includes(market)) {
      setMarketState(defaultMarketFilter(mode));
    }
  }, [visible, market, mode]);

  const setMarket = useCallback(
    (next: MarketFilter) => {
      setMarketState(next);
      writeStoredMarket(org?.id, next);
    },
    [org?.id],
  );

  const value = useMemo(
    () => ({ market, setMarket, mode, visible, setDesks }),
    [market, setMarket, mode, visible],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useActiveMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) {
    return {
      market: "all" as MarketFilter,
      setMarket: (_next: MarketFilter) => {},
      mode: "mixed" as MarketMode,
      visible: ["all", "retail", "wholesale"] as MarketFilter[],
      setDesks: (_desks: MarketDesksHint | undefined) => {},
    };
  }
  return ctx;
}
