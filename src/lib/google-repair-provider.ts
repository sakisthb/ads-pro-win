import { z } from 'zod';
import { safeFetch } from '@/lib/safe-fetch';
import { ensureFreshGoogleAccessToken } from '@/lib/oauth/google-refresh';
import { GOOGLE_ADS_API_VERSION, googleAdsHeaders, googleAdsLoginCustomerId, googleAdsSearchRows, parseGoogleAdsCustomerId } from '@/lib/google-ads-accounts';
import { buildRepairMutation, repairRequestSchema, repairStateSchema, type RepairRequest, type RepairState } from '@/lib/google-repair';

const entity = z.object({ id: z.string(), name: z.string().optional(), status: z.enum(['ENABLED', 'PAUSED']), advertisingChannelType: z.literal('SEARCH') }).passthrough();
const group = z.object({ id: z.string(), name: z.string().optional(), status: z.enum(['ENABLED', 'PAUSED']) }).passthrough();
const textAsset = z.object({ text: z.string(), pinnedField: z.string().optional() }).passthrough();
const adRow = z.object({ campaign: entity, adGroup: group, adGroupAd: z.object({ status: z.enum(['ENABLED', 'PAUSED']), ad: z.object({
  id: z.string(), resourceName: z.string(), type: z.literal('RESPONSIVE_SEARCH_AD'), finalUrls: z.array(z.string()).default([]), finalMobileUrls: z.array(z.string()).default([]),
  responsiveSearchAd: z.object({ headlines: z.array(textAsset), descriptions: z.array(textAsset) }).passthrough(),
}).passthrough() }).passthrough() }).passthrough();
const keywordRow = z.object({ campaign: entity, adGroup: group, adGroupCriterion: z.object({
  criterionId: z.string(), resourceName: z.string(), type: z.literal('KEYWORD'), status: z.enum(['ENABLED', 'PAUSED']), negative: z.boolean().default(false),
  finalUrls: z.array(z.string()).default([]), finalMobileUrls: z.array(z.string()).default([]), keyword: z.object({ text: z.string(), matchType: z.string() }),
}).passthrough() }).passthrough();
const linkRow = z.object({ campaign: entity, campaignAsset: z.object({ resourceName: z.string(), status: z.enum(['ENABLED', 'PAUSED']), fieldType: z.literal('SITELINK') }).passthrough(),
  asset: z.object({ id: z.string(), finalUrls: z.array(z.string()).default([]), finalMobileUrls: z.array(z.string()).default([]), sitelinkAsset: z.object({ linkText: z.string(), description1: z.string().optional(), description2: z.string().optional() }).passthrough() }).passthrough(),
}).passthrough();
const networkRow = z.object({ campaign: entity.extend({ resourceName: z.string(), networkSettings: z.object({
  targetGoogleSearch: z.boolean(), targetSearchNetwork: z.boolean(), targetContentNetwork: z.boolean(), targetPartnerSearchNetwork: z.boolean(),
}).passthrough() }) }).passthrough();
const parentFields = 'campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type';
const groupFields = 'ad_group.id, ad_group.name, ad_group.status';
const queries = {
  campaign_network_update: `SELECT ${parentFields}, campaign.resource_name, campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network FROM campaign`,
  rsa_update: `SELECT ${parentFields}, ${groupFields}, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.resource_name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.final_mobile_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions FROM ad_group_ad`,
  keyword_pause: `SELECT ${parentFields}, ${groupFields}, ad_group_criterion.criterion_id, ad_group_criterion.resource_name, ad_group_criterion.type, ad_group_criterion.status, ad_group_criterion.negative, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.final_urls, ad_group_criterion.final_mobile_urls FROM ad_group_criterion`,
  sitelink_pause: `SELECT ${parentFields}, campaign_asset.resource_name, campaign_asset.status, campaign_asset.field_type, asset.id, asset.final_urls, asset.final_mobile_urls, asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2 FROM campaign_asset`,
};
type InventoryTarget = { label: string; request: RepairRequest; before: RepairState };
type StoredAccount = { id: string; accountId: string; accessToken: string; refreshToken: string | null; tokenExpiry: Date | null };

/** A fixed, public-safe failure category; never expose raw provider bodies or credentials. */
export class GoogleDestinationPreflightError extends Error {
  constructor(status?: number) {
    super(status ? `Destination preflight blocked: HTTP ${status}. A 403 may be an edge challenge, not a missing page. Review the trusted shop read path; no live repair was attempted.`
      : 'Destination preflight blocked: HTML/title is unverified or a soft-404. Review the canonical landing page; no live repair was attempted.');
  }
}

/** Credentials remain in this server closure, never in previews or audit JSON. */
export async function googleRepairProvider(account: StoredAccount) {
  const customerId = parseGoogleAdsCustomerId(account.accountId);
  if (!customerId) throw new Error('A selected spend account is required');
  const token = await ensureFreshGoogleAccessToken(account, 'ads');
  const login = googleAdsLoginCustomerId(account.accountId);
  const search = (query: string) => googleAdsSearchRows<unknown>(token, customerId, query, login);
  const customers = await search('SELECT customer.id, customer.manager, customer.status FROM customer LIMIT 2');
  const customer = z.object({ customer: z.object({ id: z.string(), manager: z.boolean().default(false), status: z.literal('ENABLED') }) }).parse(customers.length === 1 ? customers[0] : null).customer;
  if (customer.id !== customerId || customer.manager) throw new Error('Wrong or manager customer; repairs withheld');

  function project(kind: keyof typeof queries, raw: unknown): InventoryTarget {
    let request: RepairRequest, before: RepairState, label: string;
    const reason = 'Operator review of an existing target';
    if (kind === 'campaign_network_update') {
      const row = networkRow.parse(raw), campaign = row.campaign;
      if (campaign.resourceName !== `customers/${customerId}/campaigns/${campaign.id}`) throw new Error('Foreign Search campaign');
      before = repairStateSchema.parse({ resourceName: campaign.resourceName, campaignStatus: campaign.status, status: campaign.status, type: 'SEARCH_CAMPAIGN', networkSettings: campaign.networkSettings });
      request = { kind, campaignId: campaign.id, reason, targetContentNetwork: false };
      label = `${campaign.name ?? campaign.id} / Content Network enabled`;
    } else if (kind === 'rsa_update') {
      const row = adRow.parse(raw), ad = row.adGroupAd.ad;
      if (ad.resourceName !== `customers/${customerId}/ads/${ad.id}`) throw new Error('Foreign ad resource');
      const assets = (list: typeof ad.responsiveSearchAd.headlines) => list.map(({ text, pinnedField }) => ({ text, ...(pinnedField && pinnedField !== 'UNSPECIFIED' ? { pinnedField } : {}) }));
      before = repairStateSchema.parse({ resourceName: ad.resourceName, campaignStatus: row.campaign.status, adGroupStatus: row.adGroup.status, status: row.adGroupAd.status, type: ad.type,
        finalUrls: ad.finalUrls, finalMobileUrls: ad.finalMobileUrls, headlines: assets(ad.responsiveSearchAd.headlines), descriptions: assets(ad.responsiveSearchAd.descriptions) });
      // Inventory identity only; the UI must supply an actual changed patch.
      request = { kind, campaignId: row.campaign.id, adGroupId: row.adGroup.id, adId: ad.id, reason, patch: { finalUrls: ad.finalUrls } };
      label = `${row.campaign.name ?? row.campaign.id} / ${row.adGroup.name ?? row.adGroup.id} / RSA ${ad.id}`;
    } else if (kind === 'keyword_pause') {
      const row = keywordRow.parse(raw), kw = row.adGroupCriterion;
      if (kw.negative || kw.resourceName !== `customers/${customerId}/adGroupCriteria/${row.adGroup.id}~${kw.criterionId}`) throw new Error('Foreign or negative keyword');
      before = repairStateSchema.parse({ resourceName: kw.resourceName, campaignStatus: row.campaign.status, adGroupStatus: row.adGroup.status, status: kw.status, type: kw.type, negative: kw.negative, keyword: kw.keyword, finalUrls: kw.finalUrls, finalMobileUrls: kw.finalMobileUrls });
      request = { kind, campaignId: row.campaign.id, adGroupId: row.adGroup.id, criterionId: kw.criterionId, reason };
      label = `${row.campaign.name ?? row.campaign.id} / ${kw.keyword.text} (${kw.keyword.matchType})`;
    } else {
      const row = linkRow.parse(raw), asset = row.asset;
      if (!row.campaignAsset.resourceName.startsWith(`customers/${customerId}/campaignAssets/${row.campaign.id}~${asset.id}~`)) throw new Error('Foreign sitelink association');
      before = repairStateSchema.parse({ resourceName: row.campaignAsset.resourceName, campaignStatus: row.campaign.status, status: row.campaignAsset.status, type: 'SITELINK', finalUrls: asset.finalUrls, finalMobileUrls: asset.finalMobileUrls, ...asset.sitelinkAsset });
      request = { kind, campaignId: row.campaign.id, assetId: asset.id, reason };
      label = `${row.campaign.name ?? row.campaign.id} / ${asset.sitelinkAsset.linkText}`;
    }
    return { label, request, before };
  }
  async function readTarget(input: RepairRequest) {
    const req = repairRequestSchema.parse(input);
    const kind = req.kind === 'keyword_destination' ? 'keyword_pause' : req.kind;
    const condition = req.kind === 'campaign_network_update' ? `campaign.id = ${req.campaignId}`
      : req.kind === 'rsa_update' ? `ad_group_ad.ad.id = ${req.adId}`
      : req.kind === 'sitelink_pause' ? `campaign.id = ${req.campaignId} AND asset.id = ${req.assetId} AND campaign_asset.field_type = 'SITELINK'`
        : `ad_group.id = ${req.adGroupId} AND ad_group_criterion.criterion_id = ${req.criterionId}`;
    // Do not filter an RSA by parent: reject legacy shared ads instead of editing other campaigns silently.
    const rows = await search(`${queries[kind]} WHERE ${condition} LIMIT 3`);
    if (rows.length !== 1) throw new Error('Target missing, ambiguous or shared; repair withheld');
    const target = project(kind, rows[0]);
    const identityMatches = req.kind === 'campaign_network_update' ? target.request.kind === 'campaign_network_update' && target.request.campaignId === req.campaignId
      : req.kind === 'rsa_update' ? target.request.kind === 'rsa_update' && target.request.adId === req.adId
      : req.kind === 'sitelink_pause' ? target.request.kind === 'sitelink_pause' && target.request.assetId === req.assetId
        : target.request.kind === 'keyword_pause' && target.request.criterionId === req.criterionId;
    if (!identityMatches) throw new Error('Native target identity mismatch');
    if (target.request.campaignId !== req.campaignId || ('adGroupId' in req && (!('adGroupId' in target.request) || target.request.adGroupId !== req.adGroupId))) throw new Error('Target parent changed');
    return target.before;
  }
  async function inventory(campaignId?: string) {
    if (campaignId) z.string().regex(/^\d{1,20}$/).parse(campaignId);
    const campaignRows = await search(`${queries.campaign_network_update} WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status IN ('ENABLED','PAUSED') ${campaignId ? `AND campaign.id = ${campaignId}` : ''} ORDER BY campaign.id LIMIT 201`);
    const parsedCampaigns = campaignRows.slice(0, 200).map(row => networkRow.parse(row));
    const campaigns = parsedCampaigns.map(({ campaign: { id, name, status } }) => ({ id, name: name ?? id, status }));
    const targets: InventoryTarget[] = parsedCampaigns.filter(row => row.campaign.networkSettings.targetContentNetwork).map(row => project('campaign_network_update', row));
    let limited = campaignRows.length > 200;
    for (const kind of ['rsa_update', 'keyword_pause', 'sitelink_pause'] as const) {
      const extra = kind === 'rsa_update' ? "AND ad_group.status IN ('ENABLED','PAUSED') AND ad_group_ad.status IN ('ENABLED','PAUSED') AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'"
        : kind === 'keyword_pause' ? "AND ad_group.status IN ('ENABLED','PAUSED') AND ad_group_criterion.status IN ('ENABLED','PAUSED') AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE"
          : "AND campaign_asset.status IN ('ENABLED','PAUSED') AND campaign_asset.field_type = 'SITELINK'";
      const rows = await search(`${queries[kind]} WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status IN ('ENABLED','PAUSED') ${campaignId ? `AND campaign.id = ${campaignId}` : ''} ${extra} LIMIT 201`);
      limited ||= rows.length > 200;
      targets.push(...rows.slice(0, 200).map(row => project(kind, row)));
    }
    return { customerId, campaigns, targets, limited };
  }
  async function checkDestinations(req: RepairRequest, desired: RepairState) {
    if (req.kind !== 'rsa_update' && req.kind !== 'keyword_destination') return;
    if (!desired.finalUrls.length) throw new Error('No canonical destination');
    for (const url of [...new Set([...desired.finalUrls, ...desired.finalMobileUrls])]) {
      // Validate inherited mobile URLs too; never follow redirects outside the reviewed URL.
      repairRequestSchema.parse({ kind: 'keyword_destination', campaignId: '1', adGroupId: '1', criterionId: '1', reason: 'Validate reviewed destination', finalUrls: [url] });
      const response = await safeFetch(url, { maxRedirects: 0, maxResponseSizeBytes: 2_000_000, timeoutMs: 15000 });
      const html = await response.text();
      if (!response.ok) throw new GoogleDestinationPreflightError(response.status);
      if (!/text\/html/i.test(response.headers.get('content-type') ?? '') || !/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html) || /<title\b[^>]*>[^<]*(?:page not found|404|δεν βρέθηκε)/i.test(html)) throw new GoogleDestinationPreflightError();
    }
  }
  async function mutate(req: RepairRequest, before: RepairState, validateOnly: boolean) {
    const { service, operation } = buildRepairMutation(req, before);
    const response = await safeFetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${service}:mutate`, {
      method: 'POST', headers: googleAdsHeaders(token, login), body: JSON.stringify({ operations: [operation], validateOnly, partialFailure: false }), timeoutMs: 20000,
    });
    if (!response.ok) throw new Error(`Google repair request rejected (${response.status})`);
    const json = z.object({ results: z.array(z.object({ resourceName: z.string() })).optional(), partialFailureError: z.object({ code: z.number().optional() }).optional() }).passthrough().parse(await response.json());
    if (json.partialFailureError?.code || (!validateOnly && (json.results?.length !== 1 || json.results[0].resourceName !== before.resourceName))) throw new Error('Google repair response could not be verified');
  }
  return { customerId, readTarget, inventory, checkDestinations, mutate };
}
