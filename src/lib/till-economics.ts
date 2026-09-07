/**
 * CEO till math from Woo + ad spend already in the database.
 * MER is not incremental. aMER is not causal either — it only isolates first orders.
 */

export function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

/** New-customer net ÷ all ad spend in the same window. */
export function amer(newCustomerNet: number, spend: number): number {
  return ratio(newCustomerNet, spend);
}

/**
 * Woo `total` (and our netSales) is usually VAT-inclusive in Greece.
 * `tax` is the ΦΠΑ portion on those orders — subtract, never invent a second MER label in UI.
 */
export function netExVat(netSales: number, tax: number): number {
  if (!Number.isFinite(netSales) || netSales <= 0) return 0;
  if (!Number.isFinite(tax) || tax <= 0) return netSales;
  return Math.max(0, netSales - tax);
}

export function catalogMargin(grossProfit: number, netSales: number): number {
  return ratio(grossProfit, netSales);
}

/** Break-even MER at observed catalog GP margin. Null when COGS/margin is unknown. */
export function breakEvenMer(grossProfit: number, netSales: number): number | null {
  const margin = catalogMargin(grossProfit, netSales);
  if (margin <= 0) return null;
  return 1 / margin;
}

export interface MerInputs {
  totalSpend: number;
  totalClicks: number;
  totalAttributedRevenue: number;
  pixelConversions: number;
  totalRevenue: number;
  orderCount: number;
  costOfGoods: number;
  shipping: number;
  tax: number;
  refunds: number;
  grossProfit: number;
  newCustomerNet: number;
  newCustomerOrders: number;
}

export function buildMerSnapshot(input: MerInputs) {
  const cogsKnown = input.costOfGoods > 0;
  const mer = ratio(input.totalRevenue, input.totalSpend);
  const contributionAfterAds = input.totalRevenue - input.totalSpend;
  const profitAfterAds = cogsKnown ? input.grossProfit - input.totalSpend : contributionAfterAds;
  const netAfterVat = netExVat(input.totalRevenue, input.tax);
  const newCustomerShare = ratio(input.newCustomerNet, input.totalRevenue);
  return {
    totalSpend: input.totalSpend,
    totalClicks: input.totalClicks,
    totalAttributedRevenue: input.totalAttributedRevenue,
    pixelConversions: input.pixelConversions,
    totalRevenue: input.totalRevenue,
    orderCount: input.orderCount,
    costOfGoods: input.costOfGoods,
    shipping: input.shipping,
    tax: input.tax,
    refunds: input.refunds,
    grossProfit: input.grossProfit,
    cogsKnown,
    contributionAfterAds,
    mer,
    profitAfterAds,
    adSpendShare: input.totalRevenue > 0 ? (input.totalSpend / input.totalRevenue) * 100 : 0,
    attributionGap:
      input.totalRevenue > 0
        ? ((input.totalAttributedRevenue - input.totalRevenue) / input.totalRevenue) * 100
        : 0,
    platformROAS: ratio(input.totalAttributedRevenue, input.totalSpend),
    trueROAS: mer,
    amer: amer(input.newCustomerNet, input.totalSpend),
    newCustomerNet: input.newCustomerNet,
    newCustomerOrders: input.newCustomerOrders,
    newCustomerShare,
    repeatNet: Math.max(0, input.totalRevenue - input.newCustomerNet),
    repeatOrders: Math.max(0, input.orderCount - input.newCustomerOrders),
    netExVat: netAfterVat,
    merExVat: ratio(netAfterVat, input.totalSpend),
    breakEvenMer: cogsKnown ? breakEvenMer(input.grossProfit, input.totalRevenue) : null,
  };
}
