import {
  currencyFromSettings,
  currencySymbol,
  formatMoney,
  formatMoneyAxis,
  formatMoneyExact,
  parseReportingCurrency,
} from "@/lib/currency";

describe("currency helpers", () => {
  it("parses only EUR and USD", () => {
    expect(parseReportingCurrency("USD")).toBe("USD");
    expect(parseReportingCurrency("EUR")).toBe("EUR");
    expect(parseReportingCurrency("GBP")).toBe("EUR");
    expect(parseReportingCurrency(null)).toBe("EUR");
  });

  it("reads currency from organization settings JSON", () => {
    expect(currencyFromSettings({ currency: "USD" })).toBe("USD");
    expect(currencyFromSettings({ timezone: "UTC" })).toBe("EUR");
    expect(currencyFromSettings(null)).toBe("EUR");
  });

  it("formats whole amounts and exact amounts", () => {
    expect(formatMoney(1240, "EUR")).toBe("€1,240");
    expect(formatMoney(1240, "USD")).toBe("$1,240");
    expect(formatMoneyExact(12.5, "EUR")).toBe("€12.50");
    expect(formatMoneyExact(12.5, "USD")).toBe("$12.50");
  });

  it("formats chart axes with the chosen symbol", () => {
    expect(formatMoneyAxis(2400, "EUR")).toBe("€2.4k");
    expect(formatMoneyAxis(2400, "USD")).toBe("$2.4k");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
  });
});
