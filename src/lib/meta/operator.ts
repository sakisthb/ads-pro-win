/**
 * Live Meta Graph reads/writes for the operator desk.
 * Campaign / ad set / ad are independent objects (Marketing API v21+).
 */

import { META_GRAPH_VERSION, mapMetaCampaignStatus } from "@/lib/meta/actions";
import { friendlyPlatformError, metaActPath } from "@/lib/platform-launch/mapping";
import { safeFetch } from "@/lib/safe-fetch";
import {
  adCreateCreativeField,
  adsetSchedulePayload,
  amountToMetaCents,
  attributionSpecFromPreset,
  bidFieldsForStrategy,
  copiedIdFromBody,
  frequencyFromSpec,
  isMetaUserRateLimit,
  mapCtaToMeta,
  mergeAdsetTargeting,
  normalizeUrlTags,
  parseMetaCents,
  placementPatch,
  resolveBudgetEditTarget,
  specialAdCategoriesPayload,
  stripGraphField,
  unknownFieldFromGraphError,
  type AttributionPreset,
  type BidStrategy,
  type BudgetEditTarget,
  type WeekdaySchedule,
} from "@/lib/meta/operator-logic";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "objective",
  "daily_budget",
  "lifetime_budget",
  "spend_cap",
  "bid_strategy",
  "start_time",
  "stop_time",
  "special_ad_categories",
  "recommendations",
  "configured_status",
  "smart_promotion_type",
].join(",");

const ADSET_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "status",
  "effective_status",
  "daily_budget",
  "lifetime_budget",
  "spend_cap",
  "bid_strategy",
  "bid_amount",
  "optimization_goal",
  "billing_event",
  "promoted_object",
  "attribution_spec",
  "targeting",
  "start_time",
  "end_time",
  "adset_schedule",
  "pacing_type",
  "destination_type",
  "frequency_control_specs",
  "value_rule_set_id",
  "learning_stage_info",
  "recommendations",
].join(",");

const AD_FIELDS = [
  "id",
  "name",
  "adset_id",
  "campaign_id",
  "status",
  "effective_status",
  "preview_shareable_link",
  "recommendations",
  "issues_info",
  "creative{id,name,title,body,description,url_tags,call_to_action_type,instagram_user_id,object_story_spec,thumbnail_url,image_url,effective_object_story_id,degrees_of_freedom_spec}",
].join(",");

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_user_msg?: string; error_subcode?: number };
  id?: string;
  success?: boolean;
  copied_campaign_id?: string;
  copied_adset_id?: string;
  [key: string]: unknown;
};

export type MetaTreeCampaign = {
  id: string;
  name: string;
  status: string;
  configuredStatus: string | null;
  effectiveStatus: string | null;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spendCap: number | null;
  bidStrategy: string | null;
  startTime: string | null;
  stopTime: string | null;
  specialAdCategories: string[];
  recommendations: unknown[];
  cbo: boolean;
  smartPromotionType: string | null;
};

export type MetaTreeAdSet = {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spendCap: number | null;
  bidStrategy: string | null;
  bidAmount: number | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  attributionSpec: unknown;
  targeting: Record<string, unknown>;
  startTime: string | null;
  endTime: string | null;
  schedule: unknown;
  valueRuleSetId: string | null;
  learningStage: string | null;
  learning: boolean;
  pacingType: string | null;
  frequency: { intervalDays: number; maxFrequency: number } | null;
  recommendations: unknown[];
  ads: MetaTreeAd[];
};

export type MetaTreeAd = {
  id: string;
  adSetId: string;
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus: string | null;
  previewLink: string | null;
  recommendations: unknown[];
  issues: unknown;
  creative: {
    id: string | null;
    name: string | null;
    title: string | null;
    body: string | null;
    cta: string | null;
    pageId: string | null;
    link: string | null;
    thumbnail: string | null;
    description: string | null;
    urlTags: string | null;
    instagramUserId: string | null;
  };
};

export type MetaOperatorTree = {
  campaign: MetaTreeCampaign;
  adSets: MetaTreeAdSet[];
  budgetTarget: BudgetEditTarget | null;
  budgetError: string | null;
  adSetError: string | null;
  adError: string | null;
  canWrite: boolean;
};

async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await safeFetch(url.toString());
  const body = (await res.json().catch(() => null)) as (T & GraphErrorBody) | null;
  if (!res.ok || body?.error) {
    const raw = body?.error?.error_user_msg || body?.error?.message || `GET ${path} failed (${res.status})`;
    if (unknownFieldFromGraphError(raw)) {
      throw new Error(raw);
    }
    throw new Error(friendlyMetaError(body?.error, raw));
  }
  return body as T;
}

async function graphGetWithFieldFallback<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  let fields = params.fields;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await graphGet<T>(path, accessToken, fields ? { ...params, fields } : params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const unknown = unknownFieldFromGraphError(message);
      const next = unknown && fields ? stripGraphField(fields, unknown) : null;
      if (!next) throw error;
      fields = next;
    }
  }
  throw new Error(`GET ${path} failed after stripping unknown Graph fields`);
}

async function graphPost(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
): Promise<GraphErrorBody> {
  const form = new URLSearchParams();
  form.set("access_token", accessToken);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const res = await safeFetch(`${GRAPH}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = (await res.json().catch(() => null)) as GraphErrorBody | null;
  if (!res.ok || body?.error) {
    throw new Error(friendlyMetaError(body?.error, `POST ${path} failed (${res.status})`));
  }
  return body ?? {};
}

function friendlyMetaError(
  error: GraphErrorBody["error"],
  fallback: string,
): string {
  const text = error?.error_user_msg || error?.message || fallback;
  if (isMetaUserRateLimit(text, error?.code, error?.error_subcode)) {
    return "Meta paused extra reads (user request limit). Wait a few minutes, then retry. Campaign fields may still load; ad sets and ads will not.";
  }
  if (error?.error_subcode === 1487225 || /1487225/.test(text)) {
    return "Meta locked this ad set for 60 minutes after too many budget edits (max 4 per hour). Wait, then try again.";
  }
  return friendlyPlatformError("meta", text);
}

async function paginate<T extends Record<string, unknown>>(
  path: string,
  accessToken: string,
  params: Record<string, string>,
  maxPages = 20,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const body = await graphGetWithFieldFallback<{
      data?: T[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(
      path,
      accessToken,
      { ...params, limit: params.limit ?? "50", ...(after ? { after } : {}) },
    );
    all.push(...(body.data ?? []));
    after = body.paging?.cursors?.after;
    if (!after || !body.paging?.next) break;
  }
  return all;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function learningStageOf(raw: unknown): string | null {
  const rec = asRecord(raw);
  return str(rec.status) ?? str(rec.stage) ?? null;
}

function parseCreative(raw: unknown): MetaTreeAd["creative"] {
  const c = asRecord(raw);
  const story = asRecord(c.object_story_spec);
  const link = asRecord(story.link_data);
  const video = asRecord(story.video_data);
  const template = asRecord(story.template_data);
  const ctaObj = asRecord(link.call_to_action ?? video.call_to_action);
  const ctaValue = asRecord(ctaObj.value);
  return {
    id: str(c.id),
    name: str(c.name),
    title: str(c.title) ?? str(link.name) ?? str(template.name),
    body: str(c.body) ?? str(link.message) ?? str(template.message),
    cta: str(c.call_to_action_type) ?? str(ctaObj.type),
    pageId: str(story.page_id),
    link: str(link.link) ?? str(ctaValue.link) ?? str(template.link),
    thumbnail: str(c.thumbnail_url) ?? str(c.image_url),
    description: str(c.description) ?? str(link.description) ?? str(template.description),
    urlTags: str(c.url_tags),
    instagramUserId: str(story.instagram_user_id) ?? str(c.instagram_user_id),
  };
}

function mapAd(row: Record<string, unknown>): MetaTreeAd {
  return {
    id: String(row.id),
    adSetId: String(row.adset_id ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    name: str(row.name) ?? String(row.id),
    status: mapMetaCampaignStatus(str(row.status), str(row.effective_status)),
    effectiveStatus: str(row.effective_status),
    previewLink: str(row.preview_shareable_link),
    recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
    issues: row.issues_info ?? null,
    creative: parseCreative(row.creative),
  };
}

function mapAdSet(row: Record<string, unknown>, ads: MetaTreeAd[]): MetaTreeAdSet {
  const stage = learningStageOf(row.learning_stage_info);
  const effective = str(row.effective_status);
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id ?? ""),
    name: str(row.name) ?? String(row.id),
    status: mapMetaCampaignStatus(str(row.status), effective),
    effectiveStatus: effective,
    dailyBudget: centsToEur(parseMetaCents(row.daily_budget as string | number | null)),
    lifetimeBudget: centsToEur(parseMetaCents(row.lifetime_budget as string | number | null)),
    spendCap: centsToEur(parseMetaCents(row.spend_cap as string | number | null)),
    bidStrategy: str(row.bid_strategy),
    bidAmount: centsToEur(parseMetaCents(row.bid_amount as string | number | null)),
    optimizationGoal: str(row.optimization_goal),
    billingEvent: str(row.billing_event),
    attributionSpec: row.attribution_spec ?? null,
    targeting: asRecord(row.targeting),
    startTime: str(row.start_time),
    endTime: str(row.end_time),
    schedule: row.adset_schedule ?? null,
    valueRuleSetId: row.value_rule_set_id != null ? String(row.value_rule_set_id) : null,
    learningStage: stage,
    learning: /LEARNING/i.test(`${effective ?? ""} ${stage ?? ""}`),
    pacingType: Array.isArray(row.pacing_type)
      ? row.pacing_type.map(String).join(",")
      : str(row.pacing_type),
    frequency: frequencyFromSpec(row.frequency_control_specs),
    recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
    ads: ads.filter((ad) => ad.adSetId === String(row.id)),
  };
}

function centsToEur(cents: number | null): number | null {
  if (cents == null) return null;
  return cents / 100;
}

export async function fetchMetaOperatorTree(
  accessToken: string,
  campaignId: string,
): Promise<MetaOperatorTree> {
  const campaign = await graphGetWithFieldFallback<Record<string, unknown>>(campaignId, accessToken, {
    fields: CAMPAIGN_FIELDS,
  });
  let adSetRows: Record<string, unknown>[] = [];
  let adRows: Record<string, unknown>[] = [];
  let adSetError: string | null = null;
  let adError: string | null = null;
  try {
    adSetRows = await paginate<Record<string, unknown>>(`${campaignId}/adsets`, accessToken, {
      fields: ADSET_FIELDS,
    });
  } catch (error) {
    adSetError = error instanceof Error ? error.message : "Failed to load ad sets.";
  }
  if (adSetError) {
    adError = adSetError;
  } else {
    try {
      adRows = await paginate<Record<string, unknown>>(`${campaignId}/ads`, accessToken, {
        fields: AD_FIELDS,
      });
    } catch (error) {
      adError = error instanceof Error ? error.message : "Failed to load ads.";
    }
  }

  const ads = adRows.filter((row) => row.id).map(mapAd);
  const adSets = adSetRows.filter((row) => row.id).map((row) => mapAdSet(row, ads));
  const dailyCents = parseMetaCents(campaign.daily_budget as string | number | null);
  const lifeCents = parseMetaCents(campaign.lifetime_budget as string | number | null);
  let budgetTarget: BudgetEditTarget | null = null;
  let budgetError: string | null = null;
  try {
    budgetTarget = resolveBudgetEditTarget({
      campaignId: String(campaign.id),
      campaignDailyCents: dailyCents,
      campaignLifetimeCents: lifeCents,
      adSets: adSets.map((row) => ({
        id: row.id,
        dailyCents: row.dailyBudget != null ? amountToMetaCents(row.dailyBudget) : null,
        lifetimeCents: row.lifetimeBudget != null ? amountToMetaCents(row.lifetimeBudget) : null,
      })),
    });
  } catch (error) {
    budgetError = error instanceof Error ? error.message : "No editable budget on this campaign.";
  }

  const mapped: MetaTreeCampaign = {
    id: String(campaign.id),
    name: str(campaign.name) ?? String(campaign.id),
    status: mapMetaCampaignStatus(str(campaign.status), str(campaign.effective_status)),
    configuredStatus: str(campaign.configured_status) ?? str(campaign.status),
    effectiveStatus: str(campaign.effective_status),
    objective: str(campaign.objective),
    dailyBudget: centsToEur(dailyCents),
    lifetimeBudget: centsToEur(lifeCents),
    spendCap: centsToEur(parseMetaCents(campaign.spend_cap as string | number | null)),
    bidStrategy: str(campaign.bid_strategy),
    startTime: str(campaign.start_time),
    stopTime: str(campaign.stop_time),
    specialAdCategories: Array.isArray(campaign.special_ad_categories)
      ? campaign.special_ad_categories.map(String)
      : [],
    recommendations: Array.isArray(campaign.recommendations) ? campaign.recommendations : [],
    cbo: budgetTarget?.cbo ?? false,
    smartPromotionType: str(campaign.smart_promotion_type),
  };

  if (adSetError) {
    budgetError = adSetError;
  }

  return { campaign: mapped, adSets, budgetTarget, budgetError, adSetError, adError, canWrite: true };
}

export async function setMetaObjectStatus(
  accessToken: string,
  objectId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
): Promise<void> {
  await graphPost(objectId, accessToken, { status });
}

export async function setMetaBudget(opts: {
  accessToken: string;
  objectId: string;
  kind: "daily" | "lifetime" | "spend_cap";
  amount: number;
}): Promise<void> {
  const cents = String(amountToMetaCents(opts.amount));
  const field =
    opts.kind === "daily" ? "daily_budget" : opts.kind === "lifetime" ? "lifetime_budget" : "spend_cap";
  await graphPost(opts.objectId, opts.accessToken, { [field]: cents });
}

export async function setMetaBid(opts: {
  accessToken: string;
  adSetId: string;
  strategy: BidStrategy;
  bidAmount?: number | null;
  minRoas?: number | null;
}): Promise<void> {
  await graphPost(opts.adSetId, opts.accessToken, bidFieldsForStrategy(opts));
}

export async function setMetaSchedule(opts: {
  accessToken: string;
  adSetId: string;
  startTime?: string | null;
  endTime?: string | null;
  schedule?: WeekdaySchedule | null;
}): Promise<void> {
  const fields: Record<string, string> = {};
  if (opts.startTime) fields.start_time = opts.startTime;
  if (opts.endTime) fields.end_time = opts.endTime;
  if (opts.schedule) fields.adset_schedule = adsetSchedulePayload(opts.schedule);
  if (Object.keys(fields).length === 0) {
    throw new Error("Set a start time, end time, or daypart first.");
  }
  await graphPost(opts.adSetId, opts.accessToken, fields);
}

export async function setMetaObjectName(accessToken: string, objectId: string, name: string): Promise<void> {
  const cleaned = name.trim().slice(0, 400);
  if (!cleaned) throw new Error("Name cannot be empty.");
  await graphPost(objectId, accessToken, { name: cleaned });
}

export async function setMetaSpecialAdCategories(opts: {
  accessToken: string;
  campaignId: string;
  categories: string[];
  countries: string[];
}): Promise<void> {
  await graphPost(opts.campaignId, opts.accessToken, specialAdCategoriesPayload(opts.categories, opts.countries));
}

export async function setMetaPacing(opts: {
  accessToken: string;
  adSetId: string;
  pacingType: "standard" | "day_parting" | "no_pacing";
}): Promise<void> {
  await graphPost(opts.adSetId, opts.accessToken, {
    pacing_type: JSON.stringify([opts.pacingType]),
  });
}

async function liveAdsetTargeting(adSetId: string, accessToken: string): Promise<Record<string, unknown>> {
  const row = await graphGetWithFieldFallback<Record<string, unknown>>(adSetId, accessToken, {
    fields: "targeting",
  });
  return asRecord(row.targeting);
}

export async function setMetaAudience(opts: {
  accessToken: string;
  adSetId: string;
  countries: string[];
  ageMin: number;
  ageMax: number;
  advantageAudience: boolean;
  includedAudienceIds?: string[];
  excludedAudienceIds?: string[];
  locales?: number[];
}): Promise<void> {
  const countries = opts.countries
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (countries.length === 0) throw new Error("Add at least one country code (e.g. GR, CY).");
  const existing = await liveAdsetTargeting(opts.adSetId, opts.accessToken);
  const patch: Record<string, unknown> = {
    geo_locations: { countries },
    age_min: Math.min(65, Math.max(18, Math.round(opts.ageMin))),
    age_max: Math.min(65, Math.max(opts.ageMin, Math.round(opts.ageMax))),
    targeting_automation: { advantage_audience: opts.advantageAudience ? 1 : 0 },
  };
  if (opts.includedAudienceIds) {
    patch.custom_audiences = opts.includedAudienceIds.map((id) => ({ id }));
  }
  if (opts.excludedAudienceIds) {
    patch.excluded_custom_audiences = opts.excludedAudienceIds.map((id) => ({ id }));
  }
  if (opts.locales) {
    patch.locales = opts.locales.length ? opts.locales : null;
  }
  const targeting = mergeAdsetTargeting(existing, patch);
  await graphPost(opts.adSetId, opts.accessToken, { targeting: JSON.stringify(targeting) });
}

export async function setMetaPlacements(opts: {
  accessToken: string;
  adSetId: string;
  automatic: boolean;
  platforms: string[];
}): Promise<void> {
  const existing = await liveAdsetTargeting(opts.adSetId, opts.accessToken);
  const targeting = mergeAdsetTargeting(existing, placementPatch(opts));
  if (!asRecord(targeting.geo_locations).countries && !asRecord(targeting.geo_locations).regions) {
    throw new Error("This ad set has no location targeting. Set countries first, then placements.");
  }
  await graphPost(opts.adSetId, opts.accessToken, { targeting: JSON.stringify(targeting) });
}

export async function setMetaFrequency(opts: {
  accessToken: string;
  adSetId: string;
  intervalDays: number;
  maxFrequency: number;
}): Promise<void> {
  if (opts.maxFrequency <= 0) {
    await graphPost(opts.adSetId, opts.accessToken, { frequency_control_specs: "[]" });
    return;
  }
  await graphPost(opts.adSetId, opts.accessToken, {
    frequency_control_specs: JSON.stringify([
      {
        event: "IMPRESSIONS",
        interval_days: Math.max(1, Math.min(90, Math.round(opts.intervalDays))),
        max_frequency: Math.max(1, Math.min(90, Math.round(opts.maxFrequency))),
      },
    ]),
  });
}

export async function setMetaOptimization(opts: {
  accessToken: string;
  adSetId: string;
  optimizationGoal: string;
  attributionPreset?: AttributionPreset;
}): Promise<void> {
  const fields: Record<string, string> = { optimization_goal: opts.optimizationGoal };
  if (opts.attributionPreset) {
    fields.attribution_spec = JSON.stringify(attributionSpecFromPreset(opts.attributionPreset));
  }
  await graphPost(opts.adSetId, opts.accessToken, fields);
}

export type ValueRuleDraft = {
  name: string;
  adjustSign: "INCREASE" | "DECREASE";
  adjustValue: number;
  criteriaType: "LOCATION" | "OS_TYPE" | "DEVICE_PLATFORM" | "PLACEMENT" | "GENDER" | "AGE";
  criteriaValues: string[];
};

export async function listMetaValueRuleSets(
  accessToken: string,
  accountId: string,
): Promise<Array<{ id: string; name: string }>> {
  try {
    const rows = await paginate<Record<string, unknown>>(
      `${metaActPath(accountId)}/value_rule_set`,
      accessToken,
      { fields: "id,name" },
      4,
    );
    return rows
      .filter((row) => row.id)
      .map((row) => ({ id: String(row.id), name: str(row.name) ?? String(row.id) }));
  } catch {
    return [];
  }
}

export async function createMetaValueRuleSet(opts: {
  accessToken: string;
  accountId: string;
  name: string;
  rules: ValueRuleDraft[];
}): Promise<string> {
  if (opts.rules.length === 0) throw new Error("Add at least one value rule.");
  const rules = opts.rules.slice(0, 10).map((rule, index) => ({
    name: rule.name || `Rule ${index + 1}`,
    adjust_sign: rule.adjustSign,
    adjust_value: Math.max(1, Math.min(rule.adjustSign === "DECREASE" ? 90 : 1000, Math.round(rule.adjustValue))),
    criteria: [
      {
        criteria_type: rule.criteriaType,
        operator: "CONTAINS",
        criteria_values: rule.criteriaValues,
        criteria_value_types:
          rule.criteriaType === "LOCATION"
            ? rule.criteriaValues.map(() => "LOCATION_COUNTRY")
            : rule.criteriaValues.map(() => "NONE"),
      },
    ],
  }));
  const body = await graphPost(`${metaActPath(opts.accountId)}/value_rule_set`, opts.accessToken, {
    name: opts.name,
    rules: JSON.stringify(rules),
  });
  const id = copiedIdFromBody(body);
  if (!id) throw new Error("Meta created the value rule set but did not return an id.");
  return id;
}

export async function attachMetaValueRules(opts: {
  accessToken: string;
  adSetId: string;
  valueRuleSetId: string;
}): Promise<void> {
  await graphPost(opts.adSetId, opts.accessToken, {
    value_rule_set_id: opts.valueRuleSetId,
    value_rules_applied: "true",
  });
}

export async function duplicateMetaObject(opts: {
  accessToken: string;
  objectId: string;
  kind: "campaign" | "adset" | "ad";
  deepCopy?: boolean;
}): Promise<string> {
  const body = await graphPost(`${opts.objectId}/copies`, opts.accessToken, {
    status_option: "PAUSED",
    ...(opts.kind === "campaign" || opts.deepCopy ? { deep_copy: "true" } : {}),
  });
  const id = copiedIdFromBody(body);
  if (!id) throw new Error("Meta copied the object but did not return the new id.");
  return id;
}

type CreativeWrite = {
  pageId: string;
  primaryText: string;
  headline: string;
  landingUrl: string;
  cta: string;
  description?: string;
  urlTags?: string;
  instagramUserId?: string;
  standardEnhancements?: boolean;
};

function creativeWriteSpec(opts: CreativeWrite): {
  object_story_spec: Record<string, unknown>;
  degrees_of_freedom_spec: Record<string, unknown>;
  url_tags?: string;
} {
  const cta = mapCtaToMeta(opts.cta);
  const linkData: Record<string, unknown> = {
    message: opts.primaryText,
    name: opts.headline,
    link: opts.landingUrl,
    call_to_action: { type: cta, value: { link: opts.landingUrl } },
  };
  if (opts.description?.trim()) linkData.description = opts.description.trim();
  const story: Record<string, unknown> = {
    page_id: opts.pageId,
    link_data: linkData,
  };
  if (opts.instagramUserId) story.instagram_user_id = opts.instagramUserId;
  const spec: {
    object_story_spec: Record<string, unknown>;
    degrees_of_freedom_spec: Record<string, unknown>;
    url_tags?: string;
  } = {
    object_story_spec: story,
    degrees_of_freedom_spec: {
      creative_features_spec: {
        standard_enhancements: { enroll_status: opts.standardEnhancements === false ? "OPT_OUT" : "OPT_IN" },
      },
    },
  };
  const tags = normalizeUrlTags(opts.urlTags ?? "");
  if (tags) spec.url_tags = tags;
  return spec;
}

async function createMetaCreative(opts: CreativeWrite & {
  accessToken: string;
  accountId: string;
}): Promise<string> {
  const spec = creativeWriteSpec(opts);
  const created = await graphPost(`${metaActPath(opts.accountId)}/adcreatives`, opts.accessToken, {
    name: opts.headline.slice(0, 80),
    object_story_spec: JSON.stringify(spec.object_story_spec),
    degrees_of_freedom_spec: JSON.stringify(spec.degrees_of_freedom_spec),
    ...(spec.url_tags ? { url_tags: spec.url_tags } : {}),
  });
  const creativeId = copiedIdFromBody(created);
  if (!creativeId) throw new Error("Meta created the creative but did not return an id.");
  return creativeId;
}

export async function swapMetaAdCreative(opts: CreativeWrite & {
  accessToken: string;
  accountId: string;
  adId: string;
}): Promise<string> {
  const creativeId = await createMetaCreative(opts);
  await graphPost(opts.adId, opts.accessToken, {
    creative: adCreateCreativeField(creativeId),
  });
  return creativeId;
}

export async function addPausedMetaAd(opts: CreativeWrite & {
  accessToken: string;
  accountId: string;
  adSetId: string;
  name: string;
}): Promise<string> {
  const creativeId = await createMetaCreative(opts);
  const created = await graphPost(`${metaActPath(opts.accountId)}/ads`, opts.accessToken, {
    name: opts.name,
    adset_id: opts.adSetId,
    status: "PAUSED",
    creative: adCreateCreativeField(creativeId),
  });
  const id = copiedIdFromBody(created);
  if (!id) throw new Error("Meta created the ad but did not return an id.");
  return id;
}

export async function killSwitchMeta(opts: {
  accessToken: string;
  campaignId: string;
  mode: "pause_adsets" | "pause_campaign" | "pause_ads" | "spend_cap";
  spendCap?: number;
}): Promise<{ paused: number }> {
  if (opts.mode === "pause_campaign") {
    await setMetaObjectStatus(opts.accessToken, opts.campaignId, "PAUSED");
    return { paused: 1 };
  }
  if (opts.mode === "spend_cap") {
    if (!opts.spendCap || opts.spendCap <= 0) throw new Error("Enter a spend cap greater than 0.");
    await setMetaBudget({
      accessToken: opts.accessToken,
      objectId: opts.campaignId,
      kind: "spend_cap",
      amount: opts.spendCap,
    });
    return { paused: 0 };
  }
  const path = opts.mode === "pause_ads" ? `${opts.campaignId}/ads` : `${opts.campaignId}/adsets`;
  const rows = await paginate<Record<string, unknown>>(path, opts.accessToken, {
    fields: "id,status",
    limit: "50",
  });
  let paused = 0;
  for (const row of rows) {
    if (!row.id) continue;
    const status = String(row.status ?? "").toUpperCase();
    if (status === "PAUSED" || status === "ARCHIVED" || status === "DELETED") continue;
    await setMetaObjectStatus(opts.accessToken, String(row.id), "PAUSED");
    paused += 1;
  }
  return { paused };
}

export async function fetchCampaignBudgetSnapshot(
  accessToken: string,
  campaignId: string,
): Promise<Parameters<typeof resolveBudgetEditTarget>[0]> {
  const [campaign, adSets] = await Promise.all([
    graphGet<Record<string, unknown>>(campaignId, accessToken, {
      fields: "id,daily_budget,lifetime_budget",
    }),
    paginate<Record<string, unknown>>(`${campaignId}/adsets`, accessToken, {
      fields: "id,daily_budget,lifetime_budget",
      limit: "25",
    }),
  ]);
  return {
    campaignId: String(campaign.id ?? campaignId),
    campaignDailyCents: parseMetaCents(campaign.daily_budget as string | number | null),
    campaignLifetimeCents: parseMetaCents(campaign.lifetime_budget as string | number | null),
    adSets: adSets
      .filter((row) => row.id)
      .map((row) => ({
        id: String(row.id),
        dailyCents: parseMetaCents(row.daily_budget as string | number | null),
        lifetimeCents: parseMetaCents(row.lifetime_budget as string | number | null),
      })),
  };
}
