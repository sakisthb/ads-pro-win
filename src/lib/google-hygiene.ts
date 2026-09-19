export type GoogleHygieneDisposition = 'detected' | 'repairable_in_adpd' | 'manual_google_action' | 'monitoring';
export type GoogleHygieneCategory = 'policy' | 'destination' | 'network' | 'asset' | 'measurement' | 'delivery';
export type GoogleHygieneSeverity = 'critical' | 'high' | 'medium' | 'low';

type Coverage = { scanned: number; limited: boolean };
export type GoogleHygieneCampaign = {
  id: string; name: string; status: string; channelType: string; primaryStatus: string;
  primaryStatusReasons: string[]; targetContentNetwork: boolean;
};
export type GoogleHygieneAd = {
  campaignId: string; campaignName: string; campaignStatus: string; channelType: string;
  adGroupId: string; adGroupName: string; adGroupStatus: string; id: string; type: string; status: string;
  finalUrls: string[]; approvalStatus: string; primaryStatus: string; primaryStatusReasons: string[]; policyTopics: string[];
};
export type GoogleHygieneKeyword = {
  campaignId: string; campaignName: string; campaignStatus: string; channelType: string;
  adGroupId: string; adGroupName: string; adGroupStatus: string; id: string; text: string; matchType: string;
  status: string; negative: boolean; finalUrls: string[]; approvalStatus: string; primaryStatus: string; primaryStatusReasons: string[]; policyTopics: string[];
};
export type GoogleHygieneCampaignAsset = {
  campaignId: string; campaignName: string; campaignStatus: string; channelType: string;
  assetId: string; fieldType: string; status: string; primaryStatus: string; primaryStatusReasons: string[]; finalUrls: string[];
};
export type GoogleHygieneConversionAction = {
  id: string; name: string; status: string; category: string; type: string;
  primaryForGoal: boolean; includeInConversionsMetric: boolean;
};

export type GoogleHygieneSnapshot = {
  customerId: string;
  scannedAt: string;
  coverage: {
    campaigns: Coverage; ads: Coverage; keywords: Coverage; campaignAssets: Coverage; conversionActions: Coverage;
  };
  campaigns: GoogleHygieneCampaign[];
  ads: GoogleHygieneAd[];
  keywords: GoogleHygieneKeyword[];
  campaignAssets: GoogleHygieneCampaignAsset[];
  conversionActions: GoogleHygieneConversionAction[];
};

export type GoogleHygieneSupportedRepair =
  | { kind: 'campaign_network_update'; campaignId: string }
  | { kind: 'rsa_update'; campaignId: string; adGroupId: string; adId: string }
  | { kind: 'keyword_pause'; campaignId: string; adGroupId: string; criterionId: string }
  | { kind: 'sitelink_pause'; campaignId: string; assetId: string };

export type GoogleHygieneFinding = {
  id: string;
  category: GoogleHygieneCategory;
  severity: GoogleHygieneSeverity;
  disposition: GoogleHygieneDisposition;
  entityType: 'campaign' | 'ad' | 'keyword' | 'campaign_asset' | 'conversion_action';
  entityId: string;
  campaignId: string | null;
  title: string;
  evidence: string[];
  rationale: string;
  recommendedAction: string;
  supportedRepair: GoogleHygieneSupportedRepair | null;
};

const bad = (value: string) => ['NOT_ELIGIBLE', 'DISAPPROVED'].includes(value);
const deliveryAttention = (value: string) => ['LIMITED', 'MISCONFIGURED', 'NOT_ELIGIBLE', 'DISAPPROVED'].includes(value);

export function buildGoogleHygieneAudit(snapshot: GoogleHygieneSnapshot) {
  const findings: GoogleHygieneFinding[] = [];
  for (const campaign of snapshot.campaigns) {
    if (campaign.channelType === 'SEARCH' && campaign.targetContentNetwork) {
      findings.push({
        id: `network:campaign:${campaign.id}`, category: 'network', severity: 'high', disposition: 'repairable_in_adpd',
        entityType: 'campaign', entityId: campaign.id, campaignId: campaign.id,
        title: `${campaign.name}: Content Network is enabled on a Search campaign`,
        evidence: [`campaign.status=${campaign.status}`, 'campaign.network_settings.target_content_network=true'],
        rationale: 'Search and Display traffic should not be mixed when their intent and measurement are evaluated separately.',
        recommendedAction: 'Use the exact Google Repair Desk preview to change only targetContentNetwork true → false.',
        supportedRepair: { kind: 'campaign_network_update', campaignId: campaign.id },
      });
    }
    if (deliveryAttention(campaign.primaryStatus)) {
      findings.push({
        id: `delivery:campaign:${campaign.id}`, category: 'delivery', severity: campaign.primaryStatus === 'MISCONFIGURED' ? 'high' : 'medium', disposition: 'monitoring',
        entityType: 'campaign', entityId: campaign.id, campaignId: campaign.id,
        title: `${campaign.name}: delivery status ${campaign.primaryStatus}`,
        evidence: [`campaign.status=${campaign.status}`, `campaign.primary_status=${campaign.primaryStatus}`, ...campaign.primaryStatusReasons.map(reason => `reason=${reason}`)],
        rationale: 'A delivery label identifies a condition to investigate, but does not by itself prove the profitable change to make.',
        recommendedAction: 'Review the linked policy, asset, bidding and measurement findings before changing budget, status or bidding.',
        supportedRepair: null,
      });
    }
  }

  for (const ad of snapshot.ads) {
    const policyFailure = ad.approvalStatus === 'DISAPPROVED' || ad.primaryStatusReasons.some(reason => reason.includes('DISAPPROVED'));
    if (policyFailure) {
      const supported = ad.channelType === 'SEARCH' && ad.type === 'RESPONSIVE_SEARCH_AD' && ['ENABLED', 'PAUSED'].includes(ad.status)
        && ['ENABLED', 'PAUSED'].includes(ad.campaignStatus) && ['ENABLED', 'PAUSED'].includes(ad.adGroupStatus);
      findings.push({
        id: `policy:ad:${ad.id}`, category: ad.policyTopics.some(topic => /DESTINATION/i.test(topic)) ? 'destination' : 'policy', severity: 'high',
        disposition: supported ? 'repairable_in_adpd' : 'manual_google_action', entityType: 'ad', entityId: ad.id, campaignId: ad.campaignId,
        title: `${ad.campaignName} / ${ad.adGroupName}: ad ${ad.id} is not approved`,
        evidence: [`approval_status=${ad.approvalStatus}`, `primary_status=${ad.primaryStatus}`, ...ad.primaryStatusReasons.map(reason => `reason=${reason}`), ...ad.policyTopics.map(topic => `policy=${topic}`), ...ad.finalUrls.map(url => `final_url=${url}`)],
        rationale: supported ? 'ADR 0003 can update this existing Search RSA copy or final URL without changing its status or parent campaign.' : 'This target is outside the currently accepted Google repair contract.',
        recommendedAction: supported
          ? 'Prepare an exact Repair Desk preview after choosing the verified replacement fields. Google policy resubmission remains a separate manual action.'
          : 'Review and repair this target in Google Ads; do not infer an ADPD write contract.',
        supportedRepair: supported ? { kind: 'rsa_update', campaignId: ad.campaignId, adGroupId: ad.adGroupId, adId: ad.id } : null,
      });
    }
  }

  for (const keyword of snapshot.keywords) {
    const policyFailure = keyword.approvalStatus === 'DISAPPROVED' || keyword.primaryStatusReasons.some(reason => reason.includes('DISAPPROVED'));
    if (policyFailure) {
      const canPause = !keyword.negative && keyword.channelType === 'SEARCH' && ['ENABLED', 'PAUSED'].includes(keyword.status);
      findings.push({
        id: `policy:keyword:${keyword.adGroupId}:${keyword.id}`, category: keyword.policyTopics.some(topic => /DESTINATION/i.test(topic)) ? 'destination' : 'policy', severity: 'medium',
        disposition: canPause ? 'repairable_in_adpd' : 'manual_google_action', entityType: 'keyword', entityId: keyword.id, campaignId: keyword.campaignId,
        title: `${keyword.campaignName}: keyword “${keyword.text}” has a policy or eligibility issue`,
        evidence: [`status=${keyword.status}`, `approval_status=${keyword.approvalStatus}`, `primary_status=${keyword.primaryStatus}`, ...keyword.primaryStatusReasons.map(reason => `reason=${reason}`), ...keyword.policyTopics.map(topic => `policy=${topic}`)],
        rationale: canPause ? 'ADR 0003 can pause this positive Search keyword or replace its own final URL; it cannot edit keyword text, match type or resubmit policy.' : 'This keyword is outside the accepted repair target set.',
        recommendedAction: canPause ? 'Use an exact Repair Desk preview only if pause or keyword-level destination replacement is the intended action.' : 'Resolve manually in Google Ads.',
        supportedRepair: canPause ? { kind: 'keyword_pause', campaignId: keyword.campaignId, adGroupId: keyword.adGroupId, criterionId: keyword.id } : null,
      });
    } else if (keyword.campaignStatus === 'ENABLED' && keyword.adGroupStatus === 'ENABLED' && keyword.status === 'ENABLED'
      && keyword.primaryStatusReasons.some(reason => /LOW_QUALITY|RARELY_SERVED|LOW_SEARCH_VOLUME/.test(reason))) {
      findings.push({
        id: `delivery:keyword:${keyword.adGroupId}:${keyword.id}`, category: 'delivery', severity: 'low', disposition: 'monitoring',
        entityType: 'keyword', entityId: keyword.id, campaignId: keyword.campaignId,
        title: `${keyword.campaignName}: keyword “${keyword.text}” has limited eligibility`,
        evidence: [`status=${keyword.status}`, `primary_status=${keyword.primaryStatus}`, ...keyword.primaryStatusReasons.map(reason => `reason=${reason}`)],
        rationale: 'Low quality or rarely served is a diagnostic signal, not proof that pausing the keyword will improve account performance.',
        recommendedAction: 'Observe search terms, quality components, landing-page relevance and conversion evidence before proposing a keyword change.',
        supportedRepair: null,
      });
    }
  }

  for (const asset of snapshot.campaignAssets) {
    if (bad(asset.primaryStatus) || asset.primaryStatusReasons.some(reason => reason.includes('DISAPPROVED'))) {
      const canPause = asset.channelType === 'SEARCH' && asset.fieldType === 'SITELINK' && ['ENABLED', 'PAUSED'].includes(asset.status);
      findings.push({
        id: `asset:campaign:${asset.campaignId}:${asset.assetId}:${asset.fieldType}`, category: 'asset', severity: 'medium',
        disposition: canPause ? 'repairable_in_adpd' : 'manual_google_action', entityType: 'campaign_asset', entityId: asset.assetId, campaignId: asset.campaignId,
        title: `${asset.campaignName}: ${asset.fieldType} asset ${asset.assetId} is not eligible`,
        evidence: [`link_status=${asset.status}`, `primary_status=${asset.primaryStatus}`, ...asset.primaryStatusReasons.map(reason => `reason=${reason}`), ...asset.finalUrls.map(url => `final_url=${url}`)],
        rationale: canPause ? 'ADR 0003 can pause this one campaign-sitelink association, but cannot edit the shared asset.' : 'Asset editing, creation and policy resubmission are not supported ADPD writes.',
        recommendedAction: canPause ? 'Use the Repair Desk only to pause this exact association. Edit or resubmit the asset manually in Google Ads.' : 'Repair or replace this asset in Google Ads or Merchant Center as appropriate.',
        supportedRepair: canPause ? { kind: 'sitelink_pause', campaignId: asset.campaignId, assetId: asset.assetId } : null,
      });
    }
  }

  for (const action of snapshot.conversionActions) {
    if (action.primaryForGoal && (action.status !== 'ENABLED' || !action.includeInConversionsMetric)) {
      findings.push({
        id: `measurement:conversion:${action.id}`, category: 'measurement', severity: 'high', disposition: 'manual_google_action',
        entityType: 'conversion_action', entityId: action.id, campaignId: null,
        title: `${action.name}: primary conversion is not fully biddable`,
        evidence: [`status=${action.status}`, `category=${action.category}`, `type=${action.type}`, `primary_for_goal=${action.primaryForGoal}`, `include_in_conversions_metric=${action.includeInConversionsMetric}`],
        rationale: 'A primary goal that is disabled or excluded can distort bidding and campaign evaluation.',
        recommendedAction: 'Verify the conversion action and account goal in Google Ads. Goal changes are not an ADPD write contract yet.',
        supportedRepair: null,
      });
    }
  }

  const dispositions: GoogleHygieneDisposition[] = ['detected', 'repairable_in_adpd', 'manual_google_action', 'monitoring'];
  const counts = Object.fromEntries(dispositions.map(disposition => [disposition, findings.filter(item => item.disposition === disposition).length])) as Record<GoogleHygieneDisposition, number>;
  const complete = Object.values(snapshot.coverage).every(item => !item.limited);
  return { schemaVersion: 1 as const, customerId: snapshot.customerId, scannedAt: snapshot.scannedAt, complete, coverage: snapshot.coverage, counts, findings };
}

export type GoogleHygieneAudit = ReturnType<typeof buildGoogleHygieneAudit>;
