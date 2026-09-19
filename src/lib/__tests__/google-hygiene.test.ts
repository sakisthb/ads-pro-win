/** @jest-environment node */
import { buildGoogleHygieneAudit, type GoogleHygieneSnapshot } from '../google-hygiene';

const snapshot = (overrides: Partial<GoogleHygieneSnapshot> = {}): GoogleHygieneSnapshot => ({
  customerId: '1111111111',
  scannedAt: '2026-09-19T18:00:00.000Z',
  coverage: {
    campaigns: { scanned: 0, limited: false },
    ads: { scanned: 0, limited: false },
    keywords: { scanned: 0, limited: false },
    campaignAssets: { scanned: 0, limited: false },
    conversionActions: { scanned: 0, limited: false },
  },
  campaigns: [], ads: [], keywords: [], campaignAssets: [], conversionActions: [],
  ...overrides,
});

it('classifies Search Content Network expansion as an existing ADPD repair', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    campaigns: [{ id: '10', name: 'Wholesale Search', status: 'ENABLED', channelType: 'SEARCH', primaryStatus: 'ELIGIBLE', primaryStatusReasons: [], targetContentNetwork: true }],
  }));
  expect(audit.findings).toEqual(expect.arrayContaining([expect.objectContaining({
    id: 'network:campaign:10', category: 'network', disposition: 'repairable_in_adpd',
    supportedRepair: { kind: 'campaign_network_update', campaignId: '10' },
  })]));
});

it('routes an existing disapproved Search RSA to ADR 0003 without claiming policy resubmission', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    ads: [{ campaignId: '10', campaignName: 'Search', campaignStatus: 'ENABLED', channelType: 'SEARCH', adGroupId: '20', adGroupName: 'Wallets', adGroupStatus: 'PAUSED', id: '30', type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', finalUrls: ['https://shop.example/old'], approvalStatus: 'DISAPPROVED', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['AD_GROUP_AD_DISAPPROVED'], policyTopics: ['DESTINATION_NOT_WORKING'] }],
  }));
  const finding = audit.findings.find(item => item.id === 'policy:ad:30');
  expect(finding).toMatchObject({ disposition: 'repairable_in_adpd', supportedRepair: { kind: 'rsa_update', campaignId: '10', adGroupId: '20', adId: '30' } });
  expect(finding?.recommendedAction).toMatch(/exact Repair Desk preview/i);
  expect(finding?.recommendedAction).toMatch(/resubmission remains/i);
});

it('keeps unsupported PMax assets and conversion-goal conflicts manual', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    campaignAssets: [{ campaignId: '40', campaignName: 'PMax', campaignStatus: 'ENABLED', channelType: 'PERFORMANCE_MAX', assetId: '50', fieldType: 'YOUTUBE_VIDEO', status: 'ENABLED', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['ASSET_DISAPPROVED'], finalUrls: [] }],
    conversionActions: [{ id: '60', name: 'Wholesale form', status: 'DISABLED', category: 'SUBMIT_LEAD_FORM', type: 'WEBPAGE', primaryForGoal: true, includeInConversionsMetric: false }],
  }));
  expect(audit.findings).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'asset:campaign:40:50:YOUTUBE_VIDEO', disposition: 'manual_google_action', supportedRepair: null }),
    expect.objectContaining({ id: 'measurement:conversion:60', disposition: 'manual_google_action', supportedRepair: null }),
  ]));
});

it('uses Monitoring for limited campaign delivery and never invents an executable repair', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    campaigns: [{ id: '70', name: 'Limited Shopping', status: 'ENABLED', channelType: 'SHOPPING', primaryStatus: 'LIMITED', primaryStatusReasons: ['BUDGET_CONSTRAINED'], targetContentNetwork: false }],
  }));
  expect(audit.findings).toContainEqual(expect.objectContaining({ id: 'delivery:campaign:70', disposition: 'monitoring', supportedRepair: null }));
});

it('does not misclassify paused-parent NOT_ELIGIBLE ads or keywords as policy repairs', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    ads: [{ campaignId: '80', campaignName: 'Paused Search', campaignStatus: 'PAUSED', channelType: 'SEARCH', adGroupId: '81', adGroupName: 'Group', adGroupStatus: 'ENABLED', id: '82', type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', finalUrls: ['https://shop.example/'], approvalStatus: 'APPROVED', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['CAMPAIGN_PAUSED'], policyTopics: [] }],
    keywords: [{ campaignId: '80', campaignName: 'Paused Search', campaignStatus: 'PAUSED', channelType: 'SEARCH', adGroupId: '81', adGroupName: 'Group', adGroupStatus: 'ENABLED', id: '83', text: 'wallet', matchType: 'PHRASE', status: 'ENABLED', negative: false, finalUrls: [], approvalStatus: 'UNKNOWN', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['CAMPAIGN_PAUSED'], policyTopics: [] }],
  }));
  expect(audit.findings.filter(item => item.entityId === '82' || item.entityId === '83')).toEqual([]);
});

it('keeps an active low-quality keyword under monitoring instead of presenting a pause as a proven repair', () => {
  const audit = buildGoogleHygieneAudit(snapshot({
    keywords: [{ campaignId: '90', campaignName: 'Active Search', campaignStatus: 'ENABLED', channelType: 'SEARCH', adGroupId: '91', adGroupName: 'Group', adGroupStatus: 'ENABLED', id: '92', text: 'generic bags', matchType: 'BROAD', status: 'ENABLED', negative: false, finalUrls: [], approvalStatus: 'UNKNOWN', primaryStatus: 'NOT_ELIGIBLE', primaryStatusReasons: ['AD_GROUP_CRITERION_LOW_QUALITY'], policyTopics: [] }],
  }));
  expect(audit.findings).toContainEqual(expect.objectContaining({ id: 'delivery:keyword:91:92', disposition: 'monitoring', supportedRepair: null }));
});

it('reports all four disposition counters and propagates incomplete coverage', () => {
  const audit = buildGoogleHygieneAudit(snapshot({ coverage: {
    campaigns: { scanned: 1000, limited: true }, ads: { scanned: 3, limited: false }, keywords: { scanned: 4, limited: false },
    campaignAssets: { scanned: 5, limited: false }, conversionActions: { scanned: 6, limited: false },
  } }));
  expect(audit.complete).toBe(false);
  expect(audit.counts).toEqual({ detected: 0, repairable_in_adpd: 0, manual_google_action: 0, monitoring: 0 });
});
