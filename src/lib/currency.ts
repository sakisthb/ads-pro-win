export const REPORTING_CURRENCIES = ["EUR", "USD"] as const;
export type ReportingCurrency = (typeof REPORTING_CURRENCIES)[number];

export const DEFAULT_CURRENCY: ReportingCurrency = "EUR";

export const CURRENCY_OPTIONS: {
  value: ReportingCurrency;
  label: string;
  symbol: string;
  description: string;
}[] = [
  {
    value: "EUR",
    label: "Euro",
    symbol: "€",
    description: "Amounts shown as euros",
  },
  {
    value: "USD",
    label: "US Dollar",
    symbol: "$",
    description: "Amounts shown as US dollars",
  },
];

export function isReportingCurrency(value: unknown): value is ReportingCurrency {
  return value === "EUR" || value === "USD";
}

export function parseReportingCurrency(value: unknown): ReportingCurrency {
  return isReportingCurrency(value) ? value : DEFAULT_CURRENCY;
}

export function currencyFromSettings(settings: unknown): ReportingCurrency {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return parseReportingCurrency(
      (settings as Record<string, unknown>).currency,
    );
  }
  return DEFAULT_CURRENCY;
}

export function currencySymbol(
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): string {
  return currency === "USD" ? "$" : "€";
}

export interface FormatMoneyOptions {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

export function formatMoney(
  amount: number,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
  options: FormatMoneyOptions = {},
): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const { maximumFractionDigits = 0, minimumFractionDigits } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
    ...(minimumFractionDigits != null ? { minimumFractionDigits } : {}),
  }).format(n);
}

export function formatMoneyExact(
  amount: number,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): string {
  return formatMoney(amount, currency, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyAxis(
  amount: number,
  currency: ReportingCurrency = DEFAULT_CURRENCY,
): string {
  const symbol = currencySymbol(currency);
  const n = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(n) >= 1000) return `${symbol}${(n / 1000).toFixed(1)}k`;
  return `${symbol}${Math.round(n)}`;
}
