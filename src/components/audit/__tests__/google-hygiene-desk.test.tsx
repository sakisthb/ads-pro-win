import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleHygieneDesk } from '../google-hygiene-desk';

jest.mock('@/components/providers/trpc-provider', () => ({ api: { googleHygiene: { scan: { useQuery: jest.fn() } } } }));
import { api } from '@/components/providers/trpc-provider';

const scope = { brandId: 'fixture-brand', adAccountId: 'fixture-account' };
const audit = {
  schemaVersion: 1 as const, customerId: '1111111111', scannedAt: '2026-09-19T18:00:00.000Z', complete: true,
  coverage: { campaigns: { scanned: 1, limited: false }, ads: { scanned: 1, limited: false }, keywords: { scanned: 2, limited: false }, campaignAssets: { scanned: 3, limited: false }, conversionActions: { scanned: 4, limited: false } },
  counts: { detected: 0, repairable_in_adpd: 1, manual_google_action: 1, monitoring: 0 },
  findings: [
    { id: 'network:campaign:10', category: 'network' as const, severity: 'high' as const, disposition: 'repairable_in_adpd' as const, entityType: 'campaign' as const, entityId: '10', campaignId: '10', title: 'Search: Content Network is enabled', evidence: ['target_content_network=true'], rationale: 'Separate intent.', recommendedAction: 'Use exact Repair Desk preview.', supportedRepair: { kind: 'campaign_network_update' as const, campaignId: '10' } },
    { id: 'measurement:conversion:60', category: 'measurement' as const, severity: 'high' as const, disposition: 'manual_google_action' as const, entityType: 'conversion_action' as const, entityId: '60', campaignId: null, title: 'Lead form is not biddable', evidence: ['status=DISABLED'], rationale: 'Bidding cannot use it.', recommendedAction: 'Verify in Google Ads.', supportedRepair: null },
  ],
};
const refetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  refetch.mockResolvedValue({ data: audit });
  jest.mocked(api.googleHygiene.scan.useQuery).mockReturnValue({ data: undefined, error: null, isFetching: false, refetch } as never);
});

it('never scans automatically and labels the read-only boundary', () => {
  render(<GoogleHygieneDesk {...scope} />);
  expect(api.googleHygiene.scan.useQuery).toHaveBeenCalledWith(scope, expect.objectContaining({ enabled: false, retry: false }));
  expect(refetch).not.toHaveBeenCalled();
  expect(screen.getByText(/read-only native inventory/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /execute|apply|fix now/i })).not.toBeInTheDocument();
});

it('runs one explicit scan, shows coverage and separates ADPD repairs from manual actions', async () => {
  render(<GoogleHygieneDesk {...scope} />);
  await userEvent.click(screen.getByRole('button', { name: 'Run full native hygiene scan' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('Search: Content Network is enabled')).toBeInTheDocument();
  const summary = screen.getByRole('region', { name: 'Google hygiene summary' });
  expect(summary).toHaveTextContent('Repairable in ADPD1');
  expect(summary).toHaveTextContent('Manual Google action1');
  expect(screen.getByText('Lead form is not biddable')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Google Repair Desk' })).toHaveAttribute('href', '#google-repair-desk');
  const table = screen.getByRole('table', { name: 'Google hygiene findings' });
  expect(within(table).getByText('repairable in adpd')).toBeInTheDocument();
  expect(within(table).getByText('manual google action')).toBeInTheDocument();
});

it('withholds stale data after a scan error and reports that no empty-success audit exists', async () => {
  jest.mocked(api.googleHygiene.scan.useQuery).mockReturnValue({ data: audit, error: new Error('Unavailable'), isFetching: false, refetch } as never);
  refetch.mockResolvedValue({ data: audit, error: new Error('Unavailable') });
  render(<GoogleHygieneDesk {...scope} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Native Google hygiene scan unavailable');
  expect(screen.queryByText('Search: Content Network is enabled')).not.toBeInTheDocument();
});

it('clears a prior scan when account scope changes', async () => {
  const view = render(<GoogleHygieneDesk {...scope} />);
  await userEvent.click(screen.getByRole('button', { name: 'Run full native hygiene scan' }));
  expect(await screen.findByText('Search: Content Network is enabled')).toBeInTheDocument();
  view.rerender(<GoogleHygieneDesk brandId='fixture-brand' adAccountId='other-account' />);
  expect(screen.queryByText('Search: Content Network is enabled')).not.toBeInTheDocument();
});
