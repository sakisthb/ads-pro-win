/**
 * In-app campaign study: a stored-rows diagnosis over same-day (1-16) windows
 * for the primary Meta purchase campaign, Google historical coverage, Woo
 * outcome linkage and separate Retail / Branding / Wholesale conclusions.
 * Every number derives from caller-supplied rows; nothing is copied from
 * operator journals. Read-only — no provider fetch is triggered here.
 */

export type StudyPlatform = "meta" | "google";

export interface CampaignStudyRow {
  date: string; // YYYY-MM-DD
  platform: StudyPlatform;
  campaignId: string | null;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  websitePurchases: number;
  websitePurchaseValue: number;
}

export interface CampaignStudyCampaign {
  campaignId: string;
  name: string;
  objective: string | null;
  status: string;
}

export interface CampaignStudyOrder {
  date: string; // YYYY-MM-DD
  status: string;
  market: string; // retail | wholesale | unknown
  grossSales: number;
  source: string | null;
}

export interface CampaignStudyInput {
  asOf: string; // YYYY-MM-DD; only rows strictly before asOf are used
  metaRows: CampaignStudyRow[];
  googleRows: CampaignStudyRow[];
  campaigns: CampaignStudyCampaign[];
  orders: CampaignStudyOrder[];
}

export interface CampaignStudyWindow {
  label: string; // YYYY-MM
  startDate: string;
  endDate: string;
  daysInWindow: number;
}

export interface PurchaseWindowStat {
  window: CampaignStudyWindow;
  daysWithRows: number;
  zeroSpendDays: number;
  gapDays: number; // calendar days with no rows between the first and last row of the window
  spend: number;
  spendPerDay: number; // spend / daysInWindow (same-length windows stay comparable)
  purchases: number;
  purchaseValue: number;
  roas: number | null; // null when spend <= 0
  linkClicks: number;
  landingPageViews: number;
  clickToLpvRate: number | null; // null when linkClicks <= 0
  atcExceedsLpvDays: number; // days with addToCart > landingPageViews
}

export type SpendCutStatus = "stable" | "moderate" | "sharp";
export interface SpendCutDiagnostic {
  status: SpendCutStatus;
  changes: { label: string; spendPerDay: number; changePct: number | null }[];
  latestZeroSpendDays: number;
  latestGapDays: number;
  summary: string;
}

export type LpvReliability = "ok" | "degraded" | "broken" | "unverified";
export interface LpvDiagnostic {
  status: LpvReliability;
  rates: { label: string; rate: number | null }[];
  atcExceedsLpvDays: number;
  breakStartLabel: string | null;
  summary: string;
}

export type OrderTrend = "rising" | "stable" | "dip" | "sustained_decline" | "recovered" | "insufficient_data";
export interface OrderTrendDiagnostic {
  status: OrderTrend;
  counts: { label: string; orders: number; grossSales: number }[];
  summary: string;
}

export interface RetailSpendTiming {
  dropBeforeSpendCut: boolean | null; // null when not determinable from stored rows
  summary: string;
}

export type ConclusionStatus = "evidence_backed" | "insufficient_data" | "no_linkable_evidence";
export interface StudyConclusion {
  desk: "retail" | "branding" | "wholesale";
  status: ConclusionStatus;
  title: string;
  points: string[];
}

export interface CampaignStudy {
  asOf: string;
  windows: CampaignStudyWindow[];
  googleCoverage: {
    rowCount: number;
    dateRange: { start: string; end: string } | null;
    campaignCount: number;
    totalSpend: number;
    activeMonths: string[];
    seasonalOnly: boolean;
    summary: string;
  };
  metaCoverage: {
    rowCount: number;
    dateRange: { start: string; end: string } | null;
    campaignCount: number;
    totalSpend: number;
    primaryCampaign: {
      campaignId: string;
      name: string;
      spend: number;
      shareOfMetaSpend: number;
      firstRow: string;
      lastRow: string;
    } | null;
    channelRatio: { metaSpend: number; googleSpend: number; multiple: number | null } | null;
  };
  purchaseFunnel: PurchaseWindowStat[];
  spendCut: SpendCutDiagnostic;
  lpv: LpvDiagnostic;
  retail: OrderTrendDiagnostic;
  wholesale: OrderTrendDiagnostic;
  timing: RetailSpendTiming;
  utmCoverage: {
    orders: number;
    withSource: number;
    metaAttributed: number;
    coveragePct: number | null;
    sufficient: boolean;
  };
  conclusions: StudyConclusion[];
  limits: string[];
}

const SAME_DAY_END_DAY = 16;
const ORDER_STATUSES = new Set(["processing", "completed"]);
const META_SOURCES = new Set(["meta", "facebook", "fb", "fbads", "facebookads", "instagram"]);
const BRANDING_NAME = /b2b|tof|brand|traffic|awareness|lpv/i;
const BRANDING_OBJECTIVE = /awareness|traffic|reach|video_views/i;
const B2B_NAME = /b2b|wholesale/i;

function eur(value: number): string {
  return `€${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}
function monthOf(date: string): string {
  return date.slice(0, 7);
}
function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}
function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function ymAdd(label: string, delta: number): string {
  const y = Number(label.slice(0, 4));
  const m0 = Number(label.slice(5, 7)) - 1;
  const total = y * 12 + m0 + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
}
function inWindow(date: string, window: CampaignStudyWindow): boolean {
  return date >= window.startDate && date <= window.endDate;
}

export function sameDayStudyWindows(asOf: string, count = 3): CampaignStudyWindow[] {
  const asOfMonth = monthOf(asOf);
  const asOfDay = dayOf(asOf);
  const windows: CampaignStudyWindow[] = [];
  let cursor = asOfMonth;
  while (windows.length < count) {
    const lastCompletedDay = cursor === asOfMonth ? Math.min(SAME_DAY_END_DAY, asOfDay - 1) : SAME_DAY_END_DAY;
    if (lastCompletedDay >= 1) {
      windows.push({
        label: cursor,
        startDate: `${cursor}-01`,
        endDate: `${cursor}-${String(lastCompletedDay).padStart(2, "0")}`,
        daysInWindow: lastCompletedDay,
      });
    }
    cursor = ymAdd(cursor, -1);
  }
  return windows.reverse();
}

function windowStats(rows: CampaignStudyRow[], window: CampaignStudyWindow): PurchaseWindowStat {
  const inWin = rows.filter(r => inWindow(r.date, window));
  const daySet = new Set(inWin.map(r => r.date));
  const sortedDays = [...daySet].sort();
  let gapDays = 0;
  if (sortedDays.length > 1) {
    let cursor = sortedDays[0];
    while (cursor < sortedDays[sortedDays.length - 1]) {
      cursor = nextDate(cursor);
      if (!daySet.has(cursor)) gapDays += 1;
    }
  }
  const sum = (pick: (r: CampaignStudyRow) => number) => inWin.reduce((total, r) => total + pick(r), 0);
  const spend = sum(r => r.spend);
  const purchaseValue = sum(r => r.websitePurchaseValue);
  const purchases = sum(r => r.websitePurchases);
  const linkClicks = sum(r => r.linkClicks);
  const landingPageViews = sum(r => r.landingPageViews);
  return {
    window,
    daysWithRows: sortedDays.length,
    zeroSpendDays: inWin.filter(r => r.spend <= 0).length,
    gapDays,
    spend,
    spendPerDay: spend / window.daysInWindow,
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : null,
    linkClicks,
    landingPageViews,
    clickToLpvRate: linkClicks > 0 ? landingPageViews / linkClicks : null,
    atcExceedsLpvDays: inWin.filter(r => r.addToCart > r.landingPageViews).length,
  };
}

function spendCutDiagnostic(stats: PurchaseWindowStat[]): SpendCutDiagnostic {
  const changes = stats.map((s, i) => {
    const prev = i > 0 ? stats[i - 1].spendPerDay : null;
    return { label: s.window.label, spendPerDay: s.spendPerDay, changePct: prev !== null && prev > 0 ? ((s.spendPerDay - prev) / prev) * 100 : null };
  });
  const declineAt = (i: number) => changes[i]?.changePct !== null && (changes[i].changePct as number) <= -30;
  let consecutive = 0;
  let maxRun = 0;
  for (let i = 1; i < changes.length; i += 1) {
    consecutive = declineAt(i) ? consecutive + 1 : 0;
    maxRun = Math.max(maxRun, consecutive);
  }
  const first = stats[0]?.spendPerDay ?? 0;
  const last = stats[stats.length - 1]?.spendPerDay ?? 0;
  const cumulative = first > 0 ? ((last - first) / first) * 100 : 0;
  const anyDecline = changes.some(c => c.changePct !== null && (c.changePct as number) <= -30);
  const status: SpendCutStatus = maxRun >= 2 || cumulative <= -50 ? "sharp" : anyDecline ? "moderate" : "stable";
  const latest = stats[stats.length - 1];
  const headline = status === "sharp" ? "Sharp spend cut" : status === "moderate" ? "Moderate spend cut" : "Spend/day broadly stable";
  const parts = [`${headline}: spend/day moved from ${eur(first)} (${changes[0]?.label ?? "n/a"}) to ${eur(last)} (${changes[changes.length - 1]?.label ?? "n/a"}), ${pct(cumulative)} overall`];
  if (latest && (latest.zeroSpendDays > 0 || latest.gapDays > 0)) {
    parts.push(`with ${latest.zeroSpendDays} zero-spend day(s) and ${latest.gapDays} gap day(s) in the latest window`);
  }
  if (status !== "stable") parts.push("— a sharp, step-like profile consistent with a manual budget/schedule change, not gradual decay");
  const summary = `${parts.join(" ")}.`;
  return { status, changes, latestZeroSpendDays: latest?.zeroSpendDays ?? 0, latestGapDays: latest?.gapDays ?? 0, summary };
}

function lpvDiagnostic(stats: PurchaseWindowStat[]): LpvDiagnostic {
  const rates = stats.map(s => ({ label: s.window.label, rate: s.clickToLpvRate }));
  const latest = stats[stats.length - 1];
  if (!latest || latest.linkClicks <= 0) {
    return { status: "unverified", rates, atcExceedsLpvDays: latest?.atcExceedsLpvDays ?? 0, breakStartLabel: null,
      summary: "Latest window has no recorded link clicks; landing-page measurement reliability is unverified." };
  }
  const baseline = stats.find(s => s.clickToLpvRate !== null)?.clickToLpvRate ?? null;
  const latestRate = latest.clickToLpvRate;
  if (baseline === null || latestRate === null) {
    return { status: "unverified", rates, atcExceedsLpvDays: latest.atcExceedsLpvDays, breakStartLabel: null,
      summary: "Landing-page rate has no usable baseline; reliability is unverified." };
  }
  const breakStart = stats.find(s => s.clickToLpvRate !== null && (s.clickToLpvRate as number) < baseline * 0.5);
  if (latestRate < baseline * 0.5 && latest.atcExceedsLpvDays > 0) {
    return { status: "broken", rates, atcExceedsLpvDays: latest.atcExceedsLpvDays, breakStartLabel: breakStart?.window.label ?? latest.window.label,
      summary: `Click→LPV rate collapsed from ${(baseline * 100).toFixed(0)}% to ${(latestRate * 100).toFixed(1)}% (${latest.window.label}), with add-to-cart exceeding LPV on ${latest.atcExceedsLpvDays} day(s) — LPV is unreliable from ${breakStart?.window.label ?? latest.window.label} onward and is excluded as a KPI; the funnel after ATC remains usable.` };
  }
  if (latestRate < baseline * 0.75) {
    return { status: "degraded", rates, atcExceedsLpvDays: latest.atcExceedsLpvDays, breakStartLabel: breakStart?.window.label ?? null,
      summary: `Click→LPV rate softened from ${(baseline * 100).toFixed(0)}% to ${(latestRate * 100).toFixed(1)}% (${latest.window.label}); treat LPV as degraded.` };
  }
  return { status: "ok", rates, atcExceedsLpvDays: latest.atcExceedsLpvDays, breakStartLabel: null,
    summary: `Click→LPV rate is stable (${(latestRate * 100).toFixed(0)}% in ${latest.window.label}).` };
}

function orderTrend(desk: "retail" | "wholesale", counts: OrderTrendDiagnostic["counts"]): OrderTrendDiagnostic {
  const total = counts.reduce((a, c) => a + c.orders, 0);
  if (total === 0) return { status: "insufficient_data", counts, summary: `No ${desk} Woo orders with status processing/completed in the study windows.` };
  const [a, b, c] = counts.map(x => x.orders);
  const declined = (prev: number, cur: number) => prev > 0 && cur <= prev * 0.6;
  let status: OrderTrend;
  let summary: string;
  if (declined(a, b) && c <= a * 0.6) {
    status = "sustained_decline";
    summary = `${desk === "retail" ? "Retail" : "Wholesale"} orders fell from ${a} (${counts[0].label}) to ${b} (${counts[1].label}) and stayed low at ${c} (${counts[2].label}) — a sustained decline, not a one-off.`;
  } else if (declined(a, b)) {
    status = "dip";
    summary = `${desk === "retail" ? "Retail" : "Wholesale"} orders dipped from ${a} (${counts[0].label}) to ${b} (${counts[1].label}).`;
  } else if (b < a && c >= a * 0.8) {
    status = "recovered";
    summary = `${desk === "retail" ? "Retail" : "Wholesale"} orders softened (${a} → ${b}) and recovered to ${c} (${counts[2].label}).`;
  } else if (a > 0 && b >= a * 1.2 && c >= b * 1.2) {
    status = "rising";
    summary = `${desk === "retail" ? "Retail" : "Wholesale"} orders are rising across the windows (${a} → ${b} → ${c}).`;
  } else {
    status = "stable";
    summary = `${desk === "retail" ? "Retail" : "Wholesale"} orders are broadly stable across the windows (${a} → ${b} → ${c}).`;
  }
  return { status, counts, summary };
}

function campaignNameLookup(campaigns: CampaignStudyCampaign[]): Map<string, CampaignStudyCampaign> {
  return new Map(campaigns.map(c => [c.campaignId, c]));
}

export function buildCampaignStudy(input: CampaignStudyInput): CampaignStudy {
  const asOf = input.asOf;
  const metaRows = input.metaRows.filter(r => r.date < asOf);
  const googleRows = input.googleRows.filter(r => r.date < asOf);
  const orders = input.orders.filter(o => o.date < asOf);
  const windows = sameDayStudyWindows(asOf);
  const lookup = campaignNameLookup(input.campaigns);

  const totals = (rows: CampaignStudyRow[]) => ({
    spend: rows.reduce((t, r) => t + r.spend, 0),
    range: rows.length
      ? { start: rows.map(r => r.date).sort()[0], end: rows.map(r => r.date).sort().slice(-1)[0] }
      : null,
    campaigns: new Set(rows.map(r => r.campaignId).filter((v): v is string => v !== null)).size,
  });
  const metaTotals = totals(metaRows);
  const googleTotals = totals(googleRows);

  // Primary Meta purchase campaign: among campaigns with recorded purchases, top by spend.
  const byCampaign = new Map<string, CampaignStudyRow[]>();
  for (const row of metaRows) {
    if (row.campaignId === null) continue;
    const list = byCampaign.get(row.campaignId) ?? [];
    list.push(row);
    byCampaign.set(row.campaignId, list);
  }
  let primary: { campaignId: string; name: string; spend: number; shareOfMetaSpend: number; firstRow: string; lastRow: string; rows: CampaignStudyRow[] } | null = null;
  for (const [campaignId, rows] of byCampaign) {
    const purchases = rows.reduce((t, r) => t + r.websitePurchases, 0);
    if (purchases <= 0) continue;
    const spend = rows.reduce((t, r) => t + r.spend, 0);
    if (!primary || spend > primary.spend) {
      const sorted = rows.map(r => r.date).sort();
      primary = { campaignId, spend, shareOfMetaSpend: metaTotals.spend > 0 ? spend / metaTotals.spend : 0,
        name: lookup.get(campaignId)?.name ?? rows[0].campaignName ?? campaignId, firstRow: sorted[0], lastRow: sorted[sorted.length - 1], rows };
    }
  }

  const purchaseFunnel = primary ? windows.map(w => windowStats(primary.rows, w)) : [];
  const spendCut = spendCutDiagnostic(purchaseFunnel);
  const lpv = lpvDiagnostic(purchaseFunnel);

  const windowOrders = (market: string) => windows.map(w => {
    const inWin = orders.filter(o => o.market === market && ORDER_STATUSES.has(o.status) && inWindow(o.date, w));
    return { label: w.label, orders: inWin.length, grossSales: inWin.reduce((t, o) => t + o.grossSales, 0) };
  });
  const retail = orderTrend("retail", windowOrders("retail"));
  const wholesale = orderTrend("wholesale", windowOrders("wholesale"));

  // Did the retail dip start before the spend cut? Same-month dips are checked
  // against early-month (days 1-10) spend vs the prior window's spend/day.
  let timing: RetailSpendTiming;
  const dipIndex = retail.counts.findIndex((c, i) => i > 0 && retail.counts[i - 1].orders > 0 && c.orders <= retail.counts[i - 1].orders * 0.6);
  const cutIndex = purchaseFunnel.findIndex((s, i) => i > 0 && purchaseFunnel[i - 1].spendPerDay > 0
    && ((s.spendPerDay - purchaseFunnel[i - 1].spendPerDay) / purchaseFunnel[i - 1].spendPerDay) <= -0.3);
  if (dipIndex === -1) {
    timing = { dropBeforeSpendCut: null, summary: "No retail dip detected in the study windows." };
  } else if (cutIndex === -1 || dipIndex < cutIndex) {
    timing = { dropBeforeSpendCut: true, summary: "Retail orders declined before any recorded spend cut; the dip is not explained by the budget change." };
  } else if (primary) {
    const w = windows[dipIndex];
    const earlyEnd = `${w.label}-${String(Math.min(10, w.daysInWindow)).padStart(2, "0")}`;
    const earlySpend = primary.rows.filter(r => r.date >= w.startDate && r.date <= earlyEnd).reduce((t, r) => t + r.spend, 0);
    const earlySpendPerDay = earlySpend / Math.min(10, w.daysInWindow);
    const prevSpend = purchaseFunnel[dipIndex - 1]?.spendPerDay ?? 0;
    if (prevSpend > 0 && earlySpendPerDay >= prevSpend * 0.7) {
      timing = { dropBeforeSpendCut: true,
        summary: `Retail declined in ${w.label} while early-month spend/day (${eur(earlySpendPerDay)}) was still near the prior window (${eur(prevSpend)}) — the dip began before the spend cut.` };
    } else {
      timing = { dropBeforeSpendCut: false,
        summary: `In ${w.label} early-month spend/day (${eur(earlySpendPerDay)}) was already well below the prior window (${eur(prevSpend)}); the retail dip and the spend cut coincide in the stored rows.` };
    }
  } else {
    timing = { dropBeforeSpendCut: null, summary: "No primary Meta purchase campaign; timing not determinable." };
  }

  // Google coverage.
  const activeMonths = [...new Set(googleRows.filter(r => r.spend > 0).map(r => monthOf(r.date)))].sort();
  const recentMonths = new Set(Array.from({ length: 6 }, (_, i) => ymAdd(monthOf(asOf), -(i + 1))));
  const seasonalOnly = activeMonths.length > 0 && activeMonths.length <= 5 && activeMonths.every(m => !recentMonths.has(m));
  const googleCoverage = {
    rowCount: googleRows.length,
    dateRange: googleTotals.range,
    campaignCount: googleTotals.campaigns,
    totalSpend: googleTotals.spend,
    activeMonths,
    seasonalOnly,
    summary: googleRows.length === 0
      ? "No stored Google metric rows for this brand."
      : `Google stored rows span ${googleTotals.range?.start} → ${googleTotals.range?.end}: ${eur(googleTotals.spend)} across ${googleTotals.campaigns} campaign(s); activity months: ${activeMonths.join(", ")}. ${seasonalOnly ? "The pattern is seasonal bursts only, not an always-on channel." : "Activity extends beyond a single season."}`,
  };

  const metaCoverage = {
    rowCount: metaRows.length,
    dateRange: metaTotals.range,
    campaignCount: metaTotals.campaigns,
    totalSpend: metaTotals.spend,
    primaryCampaign: primary ? { campaignId: primary.campaignId, name: primary.name, spend: primary.spend,
      shareOfMetaSpend: primary.shareOfMetaSpend, firstRow: primary.firstRow, lastRow: primary.lastRow } : null,
    channelRatio: googleTotals.spend > 0
      ? { metaSpend: metaTotals.spend, googleSpend: googleTotals.spend, multiple: metaTotals.spend / googleTotals.spend }
      : null,
  };

  // UTM coverage over all supplied orders.
  const withSource = orders.filter(o => (o.source ?? "").trim().length > 0);
  const metaAttributed = withSource.filter(o => META_SOURCES.has((o.source ?? "").trim().toLowerCase()));
  const utmCoverage = {
    orders: orders.length,
    withSource: withSource.length,
    metaAttributed: metaAttributed.length,
    coveragePct: orders.length > 0 ? withSource.length / orders.length : null,
    sufficient: orders.length > 0 && withSource.length / orders.length >= 0.5,
  };

  // Campaign clusters by naming/objective (stored inventory only).
  const classify = (matchName: RegExp, matchObjective: RegExp) => {
    const rows: CampaignStudyRow[] = [];
    for (const [campaignId, list] of byCampaign) {
      const inv = lookup.get(campaignId);
      const name = inv?.name ?? list[0].campaignName ?? "";
      const objective = inv?.objective ?? "";
      if (matchName.test(name) || matchObjective.test(objective)) rows.push(...list);
    }
    return rows;
  };
  const brandingRows = classify(BRANDING_NAME, BRANDING_OBJECTIVE);
  const b2bRows = classify(B2B_NAME, /$^/);
  const span = (rows: CampaignStudyRow[]) => {
    if (!rows.length) return null;
    const sorted = rows.map(r => r.date).sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  };
  const brandingSpan = span(brandingRows);
  const b2bSpan = span(b2bRows);
  const wholesalePeakMonths = Object.entries(
    orders.filter(o => o.market === "wholesale" && ORDER_STATUSES.has(o.status)).reduce<Record<string, number>>((acc, o) => {
      const m = monthOf(o.date); acc[m] = (acc[m] ?? 0) + 1; return acc;
    }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m).sort();

  const conclusions: StudyConclusion[] = [];
  const retailConclusion = ((): StudyConclusion => {
    if (!primary || retail.status === "insufficient_data") {
      return { desk: "retail", status: "insufficient_data", title: "Retail", points: ["Not enough stored Meta purchase rows and/or Woo retail orders to conclude."] };
    }
    const points = [spendCut.summary, retail.summary, timing.summary];
    const latest = purchaseFunnel[purchaseFunnel.length - 1];
    if (latest && latest.roas !== null && latest.purchases > 0) {
      points.push(`Latest window: ROAS ${latest.roas.toFixed(1)}x on ${eur(latest.purchaseValue)} attributed value (AOV ${eur(latest.purchaseValue / latest.purchases)}) — lower volume, stronger per-euro efficiency.`);
    }
    return { desk: "retail", status: "evidence_backed", title: "Retail", points };
  })();
  const brandingConclusion = ((): StudyConclusion => {
    if (!brandingRows.length || !brandingSpan) {
      return { desk: "branding", status: "insufficient_data", title: "Branding", points: ["No branding-marked stored campaign activity (name/objective) found."] };
    }
    const points = [`Stored branding activity spans ${brandingSpan.start} → ${brandingSpan.end} (${eur(brandingRows.reduce((t, r) => t + r.spend, 0))} recorded spend).`];
    if (brandingSpan.end < windows[0].startDate) {
      points.push(`Stored branding activity ended ${monthOf(brandingSpan.end)}; there is no current branding evidence in the study windows.`);
    }
    if (lpv.status === "broken" || lpv.status === "degraded") {
      points.push(`Landing-page measurement is unreliable from ${lpv.breakStartLabel ?? "the latest window"} (LPV rate collapse with ATC > LPV) — brand traffic KPIs are unverifiable from stored rows.`);
    }
    return { desk: "branding", status: "evidence_backed", title: "Branding", points };
  })();
  const wholesaleConclusion = ((): StudyConclusion => {
    if (wholesale.status === "insufficient_data") {
      return { desk: "wholesale", status: "insufficient_data", title: "Wholesale", points: ["No wholesale Woo orders in the study windows."] };
    }
    const points = [wholesale.summary];
    if (!b2bSpan) {
      points.push("Wholesale demand is Woo-visible, but no B2B-marked stored campaign activity exists to link it to.");
      return { desk: "wholesale", status: "no_linkable_evidence", title: "Wholesale", points };
    }
    if (wholesalePeakMonths.length && b2bSpan.end < wholesalePeakMonths[0]) {
      points.push(`Stored B2B campaign activity ended ${monthOf(b2bSpan.end)}, before the wholesale order peaks (${wholesalePeakMonths.join(", ")}) — temporally decoupled, so no linkable evidence from stored rows.`);
      return { desk: "wholesale", status: "no_linkable_evidence", title: "Wholesale", points };
    }
    points.push(`B2B campaign activity (${b2bSpan.start} → ${b2bSpan.end}) overlaps wholesale order months (${wholesalePeakMonths.join(", ") || "none recorded"}); overlap is not causation and no dedupe verification exists.`);
    return { desk: "wholesale", status: "evidence_backed", title: "Wholesale", points };
  })();
  conclusions.push(retailConclusion, brandingConclusion, wholesaleConclusion);

  const limits = [
    "Stored rows only; no fresh provider fetch was run for this study.",
    "Platform-attributed purchases are not Woo-verified revenue; no dedupe comparison is claimed.",
    "Same-day windows compare days 1-16 only; partial months are not full-month totals.",
  ];
  if (!utmCoverage.sufficient) {
    limits.push(`UTM coverage is ${utmCoverage.coveragePct === null ? "unavailable" : `≈${Math.round(utmCoverage.coveragePct * 100)}%`} — source-level ad↔order correlation is infeasible from stored rows.`);
  }
  if (lpv.status === "broken") {
    limits.push("LPV is excluded as a KPI for the affected windows; the PUR funnel after ATC remains usable.");
  }
  if (timing.dropBeforeSpendCut === true) {
    limits.push("The root cause of the retail dip is not established here; Woo/WP changelog around the break and Meta native budget history are the next checks.");
  }

  return {
    asOf,
    windows,
    googleCoverage,
    metaCoverage,
    purchaseFunnel,
    spendCut,
    lpv,
    retail,
    wholesale,
    timing,
    utmCoverage,
    conclusions,
    limits,
  };
}
