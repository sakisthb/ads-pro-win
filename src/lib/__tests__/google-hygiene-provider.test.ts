/** @jest-environment node */
jest.mock('@/lib/oauth/google-refresh', () => ({ ensureFreshGoogleAccessToken: jest.fn() }));
jest.mock('@/lib/google-ads-accounts', () => ({ ...jest.requireActual('@/lib/google-ads-accounts'), googleAdsSearchRows: jest.fn() }));

import { googleAdsSearchRows } from '@/lib/google-ads-accounts';
import { ensureFreshGoogleAccessToken } from '@/lib/oauth/google-refresh';
import { googleHygieneProvider } from '../google-hygiene-provider';

const account = { id: 'fixture', accountId: '1111111111', accessToken: 'encrypted-fixture', refreshToken: null, tokenExpiry: null };

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(ensureFreshGoogleAccessToken).mockResolvedValue('PRIVATE-fixture-token');
});

it('reads a bounded current native inventory and never returns credentials', async () => {
  jest.mocked(googleAdsSearchRows).mockImplementation(async (_token, _customer, query) => {
    if (query.includes('FROM customer')) return [{ customer: { id: '1111111111', manager: false, status: 'ENABLED' } }];
    if (query.includes('FROM ad_group_ad')) return [{ campaign: { id: '10', name: 'Search', status: 'ENABLED', advertisingChannelType: 'SEARCH' }, adGroup: { id: '20', name: 'Wallets', status: 'PAUSED' }, adGroupAd: { status: 'ENABLED', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['AD_GROUP_AD_DISAPPROVED'], policySummary: { approvalStatus: 'DISAPPROVED', policyTopicEntries: [{ topic: 'DESTINATION_NOT_WORKING' }] }, ad: { id: '30', type: 'RESPONSIVE_SEARCH_AD', finalUrls: ['https://shop.example/old'] } } }];
    if (query.includes('FROM ad_group_criterion')) return [];
    if (query.includes('FROM campaign_asset')) return [];
    if (query.includes('FROM conversion_action')) return [{ conversionAction: { id: '60', name: 'Purchase', status: 'ENABLED', category: 'PURCHASE', type: 'WEBPAGE', primaryForGoal: true, includeInConversionsMetric: true } }];
    if (query.includes('FROM campaign')) return [{ campaign: { id: '10', name: 'Search', status: 'ENABLED', advertisingChannelType: 'SEARCH', primaryStatus: 'ELIGIBLE', primaryStatusReasons: [], networkSettings: { targetContentNetwork: true } } }];
    throw new Error(`Unexpected query: ${query}`);
  });
  const result = await (await googleHygieneProvider(account)).scan(new Date('2026-09-19T18:00:00Z'));
  expect(result).toMatchObject({ customerId: '1111111111', scannedAt: '2026-09-19T18:00:00.000Z', campaigns: [{ id: '10', targetContentNetwork: true }], ads: [{ id: '30', policyTopics: ['DESTINATION_NOT_WORKING'] }] });
  expect(result.coverage).toMatchObject({ campaigns: { scanned: 1, limited: false }, ads: { scanned: 1, limited: false }, conversionActions: { scanned: 1, limited: false } });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|encrypted-fixture/);
  const inventoryQueries = jest.mocked(googleAdsSearchRows).mock.calls.map(call => call[2]).filter(query => !query.includes('FROM customer'));
  expect(inventoryQueries).toHaveLength(5);
  for (const query of inventoryQueries) expect(query).toContain('LIMIT 10001');
  for (const query of inventoryQueries.filter(query => !query.includes('FROM conversion_action'))) expect(query).toMatch(/status IN \('ENABLED','PAUSED'\)/);
  expect(inventoryQueries.find(query => query.includes('FROM ad_group_criterion'))).toContain('ad_group_criterion.negative = FALSE');
});

it('withholds the scan for a manager or wrong customer before inventory reads', async () => {
  jest.mocked(googleAdsSearchRows).mockResolvedValue([{ customer: { id: '9999999999', manager: true, status: 'ENABLED' } }]);
  await expect(googleHygieneProvider(account)).rejects.toThrow(/Wrong or manager customer/);
  expect(googleAdsSearchRows).toHaveBeenCalledTimes(1);
});

it('does not turn a failed inventory query into an empty-success scan', async () => {
  jest.mocked(googleAdsSearchRows)
    .mockResolvedValueOnce([{ customer: { id: '1111111111', manager: false, status: 'ENABLED' } }])
    .mockRejectedValueOnce(new Error('provider unavailable'));
  const provider = await googleHygieneProvider(account);
  await expect(provider.scan()).rejects.toThrow('provider unavailable');
});
