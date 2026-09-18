import { render, screen, within } from '@testing-library/react';
import { GoogleCampaignAdaptationReview } from '../google-campaign-adaptation-review';
import { googleCampaignAdaptation } from '@/lib/google-campaign-adaptation';
import type { AuditCampaign } from '@/lib/performance-audit';

const window = { startDate: '2026-08-18', endDate: '2026-09-16' };
const row: AuditCampaign = { reportRowId: '1', adAccountId: '1', campaignId: 'candidate-id', campaignName: 'Candidate',
  platform: 'google', currency: 'EUR', status: 'paused', metricState: 'stored_metrics', totalSpend: 10,
  totalConversionValue: 310, totalConversions: 2, totalClicks: 20, totalImpressions: 100 };
const review = (rows: AuditCampaign[] = [], goal: 'sales' | 'wholesale' = 'sales') => googleCampaignAdaptation({
  goal, currentRows: rows, inventory: rows, baselineRows: [], currentWindow: window,
  baselineWindow: { startDate: '2026-07-19', endDate: '2026-08-17' },
});

it('exposes missing candidates and deeper evidence as Unverified, not an empty success or campaign action', () => {
  render(<GoogleCampaignAdaptationReview review={review()} />);
  const section = screen.getByRole('region', { name: 'Campaign adaptation review' });
  expect(within(section).getByText(/not proof.*no historical winners/i)).toBeVisible();
  expect(within(section).getAllByText(/Unverified/).length).toBeGreaterThan(5);
  expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  expect(within(section).getByRole('link', { name: 'AI Max controls and URL expansion' })).toHaveAttribute('href',
    'https://support.google.com/google-ads/answer/15910187?hl=en');
});

it('shows exact observed period, spend, credits and objective-specific proposed adaptation without a restart button', () => {
  render(<GoogleCampaignAdaptationReview review={review([row], 'wholesale')} />);
  const section = screen.getByRole('region', { name: 'Campaign adaptation review' });
  expect(within(section).getByText(/candidate-id/)).toBeVisible();
  expect(within(section).getByText(/2026-08-18.*2026-09-16/)).toBeVisible();
  expect(within(section).getByText(/31.00x/)).toBeVisible();
  expect(within(section).getByText(/Propose B2B-intent/)).toBeVisible();
  expect(within(section).getByText('Proposed adaptation')).toBeVisible();
  expect(within(section).getByText('Why')).toBeVisible();
  expect(within(section).getByText('Risk')).toBeVisible();
  expect(within(section).queryByRole('button')).not.toBeInTheDocument();
});

it('replaces rather than preserves campaign evidence when the review prop changes', () => {
  const { rerender } = render(<GoogleCampaignAdaptationReview review={review([row])} />);
  rerender(<GoogleCampaignAdaptationReview review={review()} />);
  expect(screen.queryByText(/candidate-id/)).not.toBeInTheDocument();
});
