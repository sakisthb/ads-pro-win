"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_CURRENCY,
  currencySymbol,
  formatMoney,
  formatMoneyAxis,
  formatMoneyExact,
  isReportingCurrency,
  type FormatMoneyOptions,
  type ReportingCurrency,
} from "@/lib/currency";

const STORAGE_KEY = "ads-pro-currency";
const EVENT = "adspro:currency";

type CurrencyValue = {
  currency: ReportingCurrency;
  symbol: string;
  setCurrency: (next: ReportingCurrency) => void;
  /** Apply a workspace default without writing localStorage. */
  hydrate: (next: ReportingCurrency) => void;
  format: (amount: number, options?: FormatMoneyOptions) => string;
  formatExact: (amount: number) => string;
  formatAxis: (amount: number) => string;
};

const CurrencyContext = createContext<CurrencyValue>({
  currency: DEFAULT_CURRENCY,
  symbol: currencySymbol(DEFAULT_CURRENCY),
  setCurrency: () => {},
  hydrate: () => {},
  format: (amount, options) => formatMoney(amount, DEFAULT_CURRENCY, options),
  formatExact: (amount) => formatMoneyExact(amount, DEFAULT_CURRENCY),
  formatAxis: (amount) => formatMoneyAxis(amount, DEFAULT_CURRENCY),
});

export function readStoredCurrency(): ReportingCurrency | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isReportingCurrency(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function persistCurrency(next: ReportingCurrency) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] =
    useState<ReportingCurrency>(DEFAULT_CURRENCY);

  useEffect(() => {
    const stored = readStoredCurrency();
    if (stored) setCurrencyState(stored);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ReportingCurrency>).detail;
      if (isReportingCurrency(detail)) setCurrencyState(detail);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setCurrency = useCallback((next: ReportingCurrency) => {
    setCurrencyState(next);
    persistCurrency(next);
  }, []);

  const hydrate = useCallback((next: ReportingCurrency) => {
    setCurrencyState(next);
  }, []);

  const value = useMemo<CurrencyValue>(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      setCurrency,
      hydrate,
      format: (amount, options) => formatMoney(amount, currency, options),
      formatExact: (amount) => formatMoneyExact(amount, currency),
      formatAxis: (amount) => formatMoneyAxis(amount, currency),
    }),
    [currency, setCurrency, hydrate],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
