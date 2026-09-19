import { z } from 'zod';
import { ensureFreshGoogleAccessToken } from '@/lib/oauth/google-refresh';
import { googleAdsLoginCustomerId, googleAdsSearchRows, parseGoogleAdsCustomerId } from '@/lib/google-ads-accounts';
import type { GoogleHygieneSnapshot } from '@/lib/google-hygiene';

type StoredAccount = { id: string; accountId: string; accessToken: string; refreshToken: string | null; tokenExpiry: Date | null };
const id = z.union([z.string(), z.number()]).transform(String);
const campaign = z.object({
  id, name: z.string().optional(), status: z.string(), advertisingChannelType: z.string(), primaryStatus: z.string().default('UNKNOWN'),
  primaryStatusReasons: z.array(z.string()).default([]), networkSettings: z.object({ targetContentNetwork: z.boolean().default(false) }).passthrough().default({ targetContentNetwork: false }),
}).passthrough();
const adGroup = z.object({ id, name: z.string().optional(), status: z.string() }).passthrough();
const policySummary = z.object({ approvalStatus: z.string().default('UNKNOWN'), policyTopicEntries: z.array(z.object({ topic: z.string() }).passthrough()).default([]) }).passthrough().default({ approvalStatus: 'UNKNOWN', policyTopicEntries: [] });
const campaignRow = z.object({ campaign }).passthrough();
const adRow = z.object({ campaign, adGroup, adGroupAd: z.object({
  status: z.string(), primaryStatus: z.string().default('UNKNOWN'), primaryStatusReasons: z.array(z.string()).default([]), policySummary,
  ad: z.object({ id, type: z.string(), finalUrls: z.array(z.string()).default([]) }).passthrough(),
}).passthrough() }).passthrough();
const keywordRow = z.object({ campaign, adGroup, adGroupCriterion: z.object({
  criterionId: id, status: z.string(), negative: z.boolean().default(false), finalUrls: z.array(z.string()).default([]),
  primaryStatus: z.string().default('UNKNOWN'), primaryStatusReasons: z.array(z.string()).default([]), policySummary,
  keyword: z.object({ text: z.string(), matchType: z.string() }).passthrough(),
}).passthrough() }).passthrough();
const assetRow = z.object({ campaign, campaignAsset: z.object({
  status: z.string(), fieldType: z.string(), primaryStatus: z.string().default('UNKNOWN'), primaryStatusReasons: z.array(z.string()).default([]),
}).passthrough(), asset: z.object({ id, finalUrls: z.array(z.string()).default([]) }).passthrough() }).passthrough();
const conversionRow = z.object({ conversionAction: z.object({
  id, name: z.string(), status: z.string(), category: z.string(), type: z.string(), primaryForGoal: z.boolean().default(false), includeInConversionsMetric: z.boolean().default(false),
}).passthrough() }).passthrough();

const MAX_ROWS = 10000;
const CURRENT_CAMPAIGNS = "campaign.status IN ('ENABLED','PAUSED')";
const queries = {
  campaigns: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.primary_status, campaign.primary_status_reasons, campaign.network_settings.target_content_network FROM campaign WHERE ${CURRENT_CAMPAIGNS} ORDER BY campaign.id LIMIT 10001`,
  ads: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.primary_status, campaign.primary_status_reasons, ad_group.id, ad_group.name, ad_group.status, ad_group_ad.status, ad_group_ad.primary_status, ad_group_ad.primary_status_reasons, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.policy_topic_entries, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ${CURRENT_CAMPAIGNS} AND ad_group.status IN ('ENABLED','PAUSED') AND ad_group_ad.status IN ('ENABLED','PAUSED') ORDER BY campaign.id, ad_group.id, ad_group_ad.ad.id LIMIT 10001`,
  // Google Ads v25 rejects policy_summary fields from ad_group_criterion in this account.
  // primary_status_reasons remains the native policy/eligibility signal; never turn the rejected query into empty success.
  keywords: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.primary_status, campaign.primary_status_reasons, ad_group.id, ad_group.name, ad_group.status, ad_group_criterion.criterion_id, ad_group_criterion.status, ad_group_criterion.negative, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.final_urls, ad_group_criterion.primary_status, ad_group_criterion.primary_status_reasons FROM ad_group_criterion WHERE ${CURRENT_CAMPAIGNS} AND ad_group.status IN ('ENABLED','PAUSED') AND ad_group_criterion.status IN ('ENABLED','PAUSED') AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE ORDER BY campaign.id, ad_group.id, ad_group_criterion.criterion_id LIMIT 10001`,
  campaignAssets: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.primary_status, campaign.primary_status_reasons, campaign_asset.status, campaign_asset.field_type, campaign_asset.primary_status, campaign_asset.primary_status_reasons, asset.id, asset.final_urls FROM campaign_asset WHERE ${CURRENT_CAMPAIGNS} AND campaign_asset.status IN ('ENABLED','PAUSED') ORDER BY campaign.id, asset.id LIMIT 10001`,
  conversionActions: `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category, conversion_action.type, conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric FROM conversion_action ORDER BY conversion_action.id LIMIT 10001`,
};

const bounded = <T>(rows: T[]) => ({ rows: rows.slice(0, MAX_ROWS), coverage: { scanned: Math.min(rows.length, MAX_ROWS), limited: rows.length > MAX_ROWS } });
const baseCampaign = (value: z.infer<typeof campaign>) => ({
  id: value.id, name: value.name ?? value.id, status: value.status, channelType: value.advertisingChannelType,
  primaryStatus: value.primaryStatus, primaryStatusReasons: value.primaryStatusReasons, targetContentNetwork: value.networkSettings.targetContentNetwork,
});

/** Read-only native inventory. No mutation endpoint or write helper is reachable from this provider. */
export async function googleHygieneProvider(account: StoredAccount) {
  const customerId = parseGoogleAdsCustomerId(account.accountId);
  if (!customerId) throw new Error('A selected Google Ads spend account is required');
  const selectedCustomerId = customerId;
  const token = await ensureFreshGoogleAccessToken(account, 'ads');
  const login = googleAdsLoginCustomerId(account.accountId);
  const search = (query: string) => googleAdsSearchRows<unknown>(token, selectedCustomerId, query, login);
  const customers = await search('SELECT customer.id, customer.manager, customer.status FROM customer LIMIT 2');
  const selected = z.object({ customer: z.object({ id, manager: z.boolean().default(false), status: z.literal('ENABLED') }) }).parse(customers.length === 1 ? customers[0] : null).customer;
  if (selected.id !== selectedCustomerId || selected.manager) throw new Error('Wrong or manager customer; hygiene scan withheld');

  async function scan(now = new Date()): Promise<GoogleHygieneSnapshot> {
    const [campaignRows, adRows, keywordRows, assetRows, conversionRows] = await Promise.all([
      search(queries.campaigns), search(queries.ads), search(queries.keywords), search(queries.campaignAssets), search(queries.conversionActions),
    ]);
    const campaignResult = bounded(campaignRows.map(row => campaignRow.parse(row)));
    const adResult = bounded(adRows.map(row => adRow.parse(row)));
    const keywordResult = bounded(keywordRows.map(row => keywordRow.parse(row)));
    const assetResult = bounded(assetRows.map(row => assetRow.parse(row)));
    const conversionResult = bounded(conversionRows.map(row => conversionRow.parse(row)));
    return {
      customerId: selectedCustomerId, scannedAt: now.toISOString(),
      coverage: { campaigns: campaignResult.coverage, ads: adResult.coverage, keywords: keywordResult.coverage, campaignAssets: assetResult.coverage, conversionActions: conversionResult.coverage },
      campaigns: campaignResult.rows.map(row => baseCampaign(row.campaign)),
      ads: adResult.rows.map(row => ({
        campaignId: row.campaign.id, campaignName: row.campaign.name ?? row.campaign.id, campaignStatus: row.campaign.status, channelType: row.campaign.advertisingChannelType,
        adGroupId: row.adGroup.id, adGroupName: row.adGroup.name ?? row.adGroup.id, adGroupStatus: row.adGroup.status,
        id: row.adGroupAd.ad.id, type: row.adGroupAd.ad.type, status: row.adGroupAd.status, finalUrls: row.adGroupAd.ad.finalUrls,
        approvalStatus: row.adGroupAd.policySummary.approvalStatus, primaryStatus: row.adGroupAd.primaryStatus, primaryStatusReasons: row.adGroupAd.primaryStatusReasons,
        policyTopics: row.adGroupAd.policySummary.policyTopicEntries.map(entry => entry.topic),
      })),
      keywords: keywordResult.rows.map(row => ({
        campaignId: row.campaign.id, campaignName: row.campaign.name ?? row.campaign.id, campaignStatus: row.campaign.status, channelType: row.campaign.advertisingChannelType,
        adGroupId: row.adGroup.id, adGroupName: row.adGroup.name ?? row.adGroup.id, adGroupStatus: row.adGroup.status,
        id: row.adGroupCriterion.criterionId, text: row.adGroupCriterion.keyword.text, matchType: row.adGroupCriterion.keyword.matchType,
        status: row.adGroupCriterion.status, negative: row.adGroupCriterion.negative, finalUrls: row.adGroupCriterion.finalUrls,
        approvalStatus: row.adGroupCriterion.policySummary.approvalStatus, primaryStatus: row.adGroupCriterion.primaryStatus, primaryStatusReasons: row.adGroupCriterion.primaryStatusReasons,
        policyTopics: row.adGroupCriterion.policySummary.policyTopicEntries.map(entry => entry.topic),
      })),
      campaignAssets: assetResult.rows.map(row => ({
        campaignId: row.campaign.id, campaignName: row.campaign.name ?? row.campaign.id, campaignStatus: row.campaign.status, channelType: row.campaign.advertisingChannelType,
        assetId: row.asset.id, fieldType: row.campaignAsset.fieldType, status: row.campaignAsset.status, primaryStatus: row.campaignAsset.primaryStatus,
        primaryStatusReasons: row.campaignAsset.primaryStatusReasons, finalUrls: row.asset.finalUrls,
      })),
      conversionActions: conversionResult.rows.map(row => ({
        id: row.conversionAction.id, name: row.conversionAction.name, status: row.conversionAction.status, category: row.conversionAction.category, type: row.conversionAction.type,
        primaryForGoal: row.conversionAction.primaryForGoal, includeInConversionsMetric: row.conversionAction.includeInConversionsMetric,
      })),
    };
  }
  return { customerId: selectedCustomerId, scan };
}
