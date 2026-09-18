import { campaignReportKey } from './campaign-reporting';
import type { AuditCampaign, AuditGoal, AuditWindow } from './performance-audit';

export const GOOGLE_ADAPTATION_REFERENCES = [
  { label: 'Search Display Expansion', url: 'https://support.google.com/google-ads/answer/7193800?hl=en' },
  { label: 'PMax channel performance', url: 'https://support.google.com/google-ads/answer/16260130?hl=en' },
  { label: 'PMax policy diagnostics', url: 'https://developers.google.com/google-ads/api/performance-max/troubleshooting' },
  { label: 'Qualified and converted leads', url: 'https://support.google.com/google-ads/answer/11459091?hl=en' },
  { label: 'AI Max controls and URL expansion', url: 'https://support.google.com/google-ads/answer/15910187?hl=en' },
];

const objectivePlan: Record<AuditGoal, string> = {
  sales: 'Propose current in-stock product and landing-page alignment only after stock, margin, purchase deduplication and brand/non-brand checks; test one bounded acquisition change rather than restoring old budgets or ROAS targets.',
  branding: 'Propose a current audience/message/creative test with separate awareness economics and eligible lift or incrementality measurement; do not reuse purchase ROAS as proof of new demand.',
  wholesale: 'Propose B2B-intent keywords, truthful trade messaging and a dedicated Wholesale destination; validate qualified leads, first paid orders and repeat buyers rather than optimizing generic retail purchases.',
};
type Period = { source: 'current' | 'baseline'; window: AuditWindow; spend: number; value: number;
  conversions: number; roas: number | null; observedDays: null };
type Candidate = { id: string; campaignId: string; name: string; currency: string; currentStatus: string;
  assessment: 'research_only' | 'historical_learning_only'; periods: Period[]; proposedAdaptation: string; why: string; risk: string };

/** Receives only scope/metric/period-validated rows from the audit engine. No native calls or writes.
 * Aggregate windows cannot prove actual active days, monthly winners, goal definitions or serving readiness.
 */
export function googleCampaignAdaptation(input: {
  goal: AuditGoal; currentRows: AuditCampaign[]; baselineRows: AuditCampaign[];
  inventory: AuditCampaign[]; currentWindow: AuditWindow; baselineWindow: AuditWindow;
}) {
  const { goal } = input;
  const checks = [
    { id: 'history', label: 'Historical effectiveness', requiredEvidence: 'Actual active dates and observed days, monthly/weekly spend and mature conversion actions; same-season comparison and change history. A high ROAS with one or two credits is not a verified winner.' },
    { id: 'network', label: 'Traffic intent and network mix', requiredEvidence: 'Google Search vs Search Partners vs CONTENT/Display, device/geography and query/landing intent; PMax channel availability and policy diagnostics. A Search campaign name does not prove Search delivery.' },
    { id: 'budget', label: 'Exposure and shared budgets', requiredEvidence: 'Exact native shared-budget resource, members, current average daily amount, bidding target and recent changes; do not add one shared pool once per campaign.' },
    { id: 'landing', label: 'Destinations and current offer', requiredEvidence: 'Current ad, keyword override, sitelink and expanded destinations; machine reachability, tracking-template compatibility, Retail vs Wholesale intent and verified seasonal offer. Browser access alone is not provider preflight.' },
    { id: 'outcomes', label: 'Objective-specific outcomes', requiredEvidence: goal === 'wholesale'
      ? 'Campaign-specific goals and primary/custom-goal settings; qualified business lead → first paid order → repeat-order linkage, consent and deduplication. Generic purchase/call totals are not qualified-buyer proof.'
      : goal === 'branding' ? 'Deduplicated reach/frequency, creative trends and eligible lift measurement. Branded demand capture and CTR changes do not establish causal demand creation.'
      : 'Purchase actions, deduplication, conversion lag, returns/cost basis and product margin; distinguish existing brand demand capture from new-customer acquisition and incremental profit.' },
    { id: 'products', label: 'Current commercial readiness', requiredEvidence: 'Current collection, SKU-level stock and economics, Merchant Center eligibility and product/feed linkage; a seasonal collection label is not measured demand or product approval.' },
    { id: 'ai_expansion', label: 'AI expansion guardrails', requiredEvidence: 'Actual AI Max/PMax settings and eligibility, URL inclusion/exclusion boundaries between Retail and Wholesale, search-term/headline/landing combinations and tracking compatibility. Do not auto-enable expansion or sum overlapping report views.' },
  ].map(c => ({ ...c, status: 'unverified' as const }));

  const inventory = new Map(input.inventory.map(r => [campaignReportKey(r.adAccountId, r.platform, r.campaignId, r.currency), r]));
  const candidates = new Map<string, Candidate>();
  const add = (row: AuditCampaign, source: Period['source'], window: AuditWindow) => {
    const id = campaignReportKey(row.adAccountId, row.platform, row.campaignId, row.currency);
    let candidate = candidates.get(id);
    if (!candidate) {
      const current = inventory.get(id);
      const currentStatus = current?.status ?? 'unverified';
      const archived = ['archived', 'removed'].includes(currentStatus.toLowerCase());
      candidate = { id, campaignId: row.campaignId, name: current?.campaignName ?? row.campaignName,
        currency: row.currency, currentStatus, assessment: archived ? 'historical_learning_only' : 'research_only', periods: [],
        proposedAdaptation: archived ? 'Use historical learning only; never reactivate a REMOVED campaign. Any successor needs a separate creation contract and exact approval.' : objectivePlan[goal],
        why: 'Stored attributed value warrants study, not activation. Adapt the historic idea to current products, destinations and the selected business objective after validating the evidence gaps.',
        risk: 'Small samples, conversion lag, attribution/model changes and brand capture can inflate apparent effectiveness. No profitable sales, qualified buyers, current serving or future ROAS is proven.' };
      candidates.set(id, candidate);
    }
    candidate.periods.push({ source, window, spend: row.totalSpend, value: row.totalConversionValue,
      conversions: row.totalConversions, roas: row.totalSpend > 0 ? row.totalConversionValue / row.totalSpend : null, observedDays: null });
  };
  input.currentRows.forEach(r => add(r, 'current', input.currentWindow));
  input.baselineRows.forEach(r => add(r, 'baseline', input.baselineWindow));
  const eligible = [...candidates.values()].filter(c => c.periods.some(p => p.spend > 0 && p.value > 0 && p.conversions > 0));
  const exposure = (c: Candidate) => Math.max(...c.periods.map(p => p.spend));
  eligible.sort((a, b) => a.currency.localeCompare(b.currency) || exposure(b) - exposure(a) || a.id.localeCompare(b.id));
  return { engine: 'relaunch_review_v1' as const, goal, checks, candidates: eligible.slice(0, 20), omittedCount: Math.max(0, eligible.length - 20),
    ordering: 'Currency, then highest observed spend within that currency; up to 20 research candidates, not a winner ranking or FX comparison.',
    caution: 'Stored attributed value is a study signal, not a verified winner, profit or restart approval. Active days and monthly success periods cannot be inferred from aggregate windows. Every deeper evidence family below remains Unverified; nothing is auto-enabled.' };
}

export type GoogleCampaignAdaptation = ReturnType<typeof googleCampaignAdaptation>;
