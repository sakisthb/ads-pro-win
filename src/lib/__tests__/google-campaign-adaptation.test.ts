import { auditMarkdown, buildPerformanceAudit, precedingAuditWindow, type AuditCampaign, type AuditSnapshot } from '../performance-audit';
import { googleResearchProposals } from '../google-audit-research';

const window = { startDate: '2026-08-18', endDate: '2026-09-16' };
const campaign = (extra: Partial<AuditCampaign> = {}): AuditCampaign => ({
  reportRowId: 'row', adAccountId: 'account', campaignId: 'campaign', campaignName: 'Historical candidate',
  platform: 'google', currency: 'EUR', status: 'paused', metricState: 'stored_metrics',
  totalSpend: 10, totalConversionValue: 310, totalConversions: 2, totalClicks: 20, totalImpressions: 100, ...extra,
});
const snapshot = (campaigns: AuditCampaign[] = [], extra: Partial<AuditSnapshot> = {}): AuditSnapshot => ({
  window, campaigns, truncated: false, coverage: 'stored_only_not_provider_verified',
  totals: { campaigns: campaigns.length, active: 0, storedMetricCampaigns: campaigns.length, unverifiedCampaigns: 0 }, ...extra,
});
const build = (current = snapshot(), previous?: AuditSnapshot, goal: 'sales' | 'branding' | 'wholesale' = 'sales', platform = 'google') =>
  buildPerformanceAudit({ current, previous, goal, asOf: '2026-09-18', adAccountId: 'account', platform });

it('shows a baseline-only candidate without inventing today\'s performance or claiming a small high-ROAS sample is a winner', () => {
  const audit = build(snapshot(), snapshot([campaign()], { window: precedingAuditWindow(window) }));
  expect(audit.adaptation?.candidates).toHaveLength(1);
  expect(audit.adaptation?.candidates[0]).toMatchObject({ campaignId: 'campaign', currentStatus: 'unverified',
    assessment: 'research_only', periods: [{ source: 'baseline', window: precedingAuditWindow(window), spend: 10, value: 310,
      conversions: 2, roas: 31, observedDays: null }] });
  expect(audit.adaptation?.caution).toMatch(/not.*winner/i);
  expect(audit.adaptation?.checks.every(c => c.status === 'unverified')).toBe(true);
  expect(audit.activationAllowed).toBe(false);
});

it('keeps both selected windows and currencies separate and uses current inventory status rather than old serving status', () => {
  const audit = build(snapshot([campaign({ status: 'archived', totalSpend: 100, totalConversionValue: 400 }), campaign({ currency: 'USD' })]),
    snapshot([campaign({ status: 'active' })], { window: precedingAuditWindow(window) }));
  const eur = audit.adaptation?.candidates.find(c => c.currency === 'EUR');
  expect(eur).toMatchObject({ currentStatus: 'archived', assessment: 'historical_learning_only' });
  expect(eur?.periods).toHaveLength(2);
  expect(eur?.proposedAdaptation).toMatch(/never.*reactivate.*REMOVED/i);
  expect(audit.adaptation?.candidates.find(c => c.currency === 'USD')?.periods).toHaveLength(1);
});

it.each([
  snapshot([campaign()], { truncated: true }), snapshot([campaign({ totalSpend: NaN })]),
  snapshot([campaign({ adAccountId: 'other' })]), snapshot([campaign(), campaign()]),
])('withholds candidate review for malformed, duplicate, out-of-scope or limited current observations', current => {
  expect(build(current).adaptation?.candidates).toEqual([]);
});

it('does not manufacture prior evidence when the baseline dates or scope fail validation', () => {
  expect(build(snapshot(), snapshot([campaign()])).adaptation?.candidates).toEqual([]);
  expect(build(snapshot(), snapshot([campaign({ adAccountId: 'other' })], { window: precedingAuditWindow(window) })).adaptation?.candidates).toEqual([]);
});

it.each(['sales', 'branding', 'wholesale'] as const)('prescribes objective-aware study for %s without claiming any unavailable family is measured', goal => {
  const review = build(snapshot([campaign()]), undefined, goal).adaptation!;
  expect(review.goal).toBe(goal);
  expect(review.checks.map(c => c.id)).toEqual(expect.arrayContaining(['history', 'network', 'budget', 'landing', 'ai_expansion']));
  expect(review.checks.find(c => c.id === 'ai_expansion')?.requiredEvidence).toMatch(/URL.*Retail.*Wholesale/i);
  expect(review.candidates[0].proposedAdaptation).toMatch(goal === 'wholesale' ? /qualified.*paid.*repeat/i : goal === 'branding' ? /lift|incrementality/i : /stock.*margin/i);
  expect(review.candidates[0].risk).toMatch(/attribution|lag/i);
});

it('does not relabel zero or missing values as past effectiveness, and does not attach Google guidance to another platform', () => {
  expect(build(snapshot([campaign({ totalConversionValue: 0 })])).adaptation?.candidates).toEqual([]);
  expect(build(snapshot([campaign({ metricState: 'no_stored_metrics' })])).adaptation?.candidates).toEqual([]);
  expect(build(snapshot([campaign({ platform: 'meta' })]), undefined, 'sales', 'meta').adaptation).toBeNull();
});

it('bounds review to 20 candidates by observed spend, discloses the omitted count and never calls this a winner ranking', () => {
  const review = build(snapshot(Array.from({ length: 22 }, (_, i) => campaign({ campaignId: `${i}`, totalSpend: i + 1 })))).adaptation!;
  expect(review.candidates).toHaveLength(20);
  expect(review.omittedCount).toBe(2);
  expect(review.ordering).toMatch(/spend.*not.*winner/i);
  expect(review.candidates[0].campaignId).toBe('21');
});

it('includes the exact same adaptation evidence and checks in Markdown and saved-research proposals', () => {
  const audit = build(snapshot([campaign({ campaignName: 'Unsafe | name\n## fake' })]));
  const md = auditMarkdown(audit, { brand: 'Shop', account: 'Account', providerAccountId: '1', market: 'all' });
  expect(md).toContain('## Campaign adaptation review');
  expect(md).toContain('Before');
  expect(md).toContain(audit.adaptation!.candidates[0].proposedAdaptation);
  expect(md).toContain('https://support.google.com/google-ads/answer/15910187?hl=en');
  expect(md).not.toContain('\n## fake');
  expect(googleResearchProposals(audit)).toContainEqual(expect.objectContaining({ id: 'adaptation:sales',
    kind: 'measurement', executionAllowed: false, nextCheck: expect.stringMatching(/network|CONTENT/i) }));
});
