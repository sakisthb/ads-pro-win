import {
  adsManagerUrl,
  clampAge,
  dailyBudgetToCents,
  friendlyPlatformError,
  mapMetaObjective,
  mapMetaOptimization,
  metaActPath,
  normalizeCountries,
  stripActPrefix,
  type LaunchObjective,
  type LiveStatus,
} from "./mapping";
import type {
  LaunchSpec,
  MetaAssetAudience,
  MetaAssetPage,
  MetaAssetPixel,
  PlatformLaunchResult,
  ScaleResult,
  StatusResult,
} from "./types";
import { fetchCampaignBudgetSnapshot, setMetaBudget } from "@/lib/meta/operator";
import { META_GRAPH_VERSION } from "@/lib/meta/actions";
import { resolveBudgetEditTarget } from "@/lib/meta/operator-logic";
import { safeFetch } from "@/lib/safe-fetch";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_user_msg?: string };
  id?: string;
  success?: boolean;
}

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
    throw new Error(body?.error?.error_user_msg || body?.error?.message || `Meta GET ${path} failed (${res.status})`);
  }
  return body as T;
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
    throw new Error(body?.error?.error_user_msg || body?.error?.message || `Meta POST ${path} failed (${res.status})`);
  }
  return body ?? {};
}

export async function getMetaGrantedPermissions(accessToken: string): Promise<string[]> {
  try {
    const body = await graphGet<{ data?: Array<{ permission?: string; status?: string }> }>(
      "me/permissions",
      accessToken,
    );
    return (body.data ?? [])
      .filter((p) => p.status === "granted" && p.permission)
      .map((p) => p.permission as string);
  } catch {
    return [];
  }
}

export async function listMetaPages(accessToken: string): Promise<MetaAssetPage[]> {
  const mapPages = (
    data: Array<{
      id?: string;
      name?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>,
  ): MetaAssetPage[] =>
    data
      .filter((p) => p.id)
      .map((p) => ({
        id: String(p.id),
        name: p.name?.trim() || String(p.id),
        instagramUserId: p.instagram_business_account?.id,
        instagramUsername: p.instagram_business_account?.username,
      }));
  try {
    const body = await graphGet<{ data?: Array<{ id?: string; name?: string; instagram_business_account?: { id?: string; username?: string } }> }>(
      "me/accounts",
      accessToken,
      { fields: "id,name,instagram_business_account{id,username}", limit: "50" },
    );
    return mapPages(body.data ?? []);
  } catch {
    try {
      const body = await graphGet<{ data?: Array<{ id?: string; name?: string }> }>(
        "me/accounts",
        accessToken,
        { fields: "id,name", limit: "50" },
      );
      return mapPages(body.data ?? []);
    } catch {
      return [];
    }
  }
}

export async function listMetaPixels(
  accessToken: string,
  accountId: string,
): Promise<MetaAssetPixel[]> {
  try {
    const body = await graphGet<{ data?: Array<{ id?: string; name?: string }> }>(
      `${metaActPath(accountId)}/adspixels`,
      accessToken,
      { fields: "id,name", limit: "25" },
    );
    return (body.data ?? [])
      .filter((p) => p.id)
      .map((p) => ({ id: String(p.id), name: p.name?.trim() || String(p.id) }));
  } catch {
    return [];
  }
}

export async function listMetaCustomAudiences(
  accessToken: string,
  accountId: string,
): Promise<MetaAssetAudience[]> {
  try {
    const body = await graphGet<{
      data?: Array<{
        id?: string;
        name?: string;
        subtype?: string;
        approximate_count?: number;
      }>;
    }>(`${metaActPath(accountId)}/customaudiences`, accessToken, {
      fields: "id,name,subtype,approximate_count",
      limit: "50",
    });
    return (body.data ?? [])
      .filter((a) => a.id)
      .map((a) => ({
        id: String(a.id),
        name: a.name?.trim() || String(a.id),
        subtype: a.subtype,
        size: a.approximate_count,
      }));
  } catch {
    return [];
  }
}

function effectiveObjective(spec: LaunchSpec): LaunchObjective {
  if (spec.objective === "sales" && !spec.pixelId) return "traffic";
  return spec.objective;
}

export async function launchMetaCampaign(
  accessToken: string,
  accountId: string,
  spec: LaunchSpec,
): Promise<PlatformLaunchResult> {
  const warnings: string[] = [];
  const status: LiveStatus = spec.goLive ? "ACTIVE" : "PAUSED";
  const objective = effectiveObjective(spec);
  if (objective !== spec.objective) {
    warnings.push("No Meta pixel on this account — launched as Traffic instead of Sales.");
  }

  try {
    const campaign = await graphPost(`${metaActPath(accountId)}/campaigns`, accessToken, {
      name: spec.name,
      objective: mapMetaObjective(objective),
      status,
      special_ad_categories: "[]",
      buying_type: "AUCTION",
    });
    const campaignId = campaign.id;
    if (!campaignId) throw new Error("Meta created a campaign without an id.");

    const { optimizationGoal, billingEvent } = mapMetaOptimization(objective);
    const { ageMin, ageMax } = clampAge(spec.audience.ageMin, spec.audience.ageMax);
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: normalizeCountries(spec.audience.countries) },
      age_min: ageMin,
      age_max: ageMax,
    };

    const adsetFields: Record<string, string> = {
      name: `${spec.name} — Prospecting`,
      campaign_id: campaignId,
      status,
      daily_budget: String(dailyBudgetToCents(spec.dailyBudget)),
      billing_event: billingEvent,
      optimization_goal: optimizationGoal,
      targeting: JSON.stringify(targeting),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    };
    if (objective === "sales" && spec.pixelId) {
      adsetFields.promoted_object = JSON.stringify({
        pixel_id: spec.pixelId,
        custom_event_type: "PURCHASE",
      });
    } else if (spec.landingUrl) {
      adsetFields.destination_type = "WEBSITE";
    }

    const adset = await graphPost(`${metaActPath(accountId)}/adsets`, accessToken, adsetFields);
    const adSetId = adset.id;
    if (!adSetId) throw new Error("Meta created an ad set without an id.");

    let adId: string | undefined;
    const landingUrl = spec.creative.landingUrl || spec.landingUrl;
    if (spec.includeAd === false) {
      warnings.push("Ad layer was left unchecked — campaign + ad set only, still PAUSED.");
    } else if (spec.pageId && landingUrl) {
      try {
        const ctaType = spec.creative.cta.replace(/\s+/g, "_").toUpperCase() || "SHOP_NOW";
        const ad = await graphPost(`${metaActPath(accountId)}/ads`, accessToken, {
          name: `${spec.name} — Ad 1`,
          adset_id: adSetId,
          status,
          creative: JSON.stringify({
            object_story_spec: {
              page_id: spec.pageId,
              link_data: {
                message: spec.creative.primaryText,
                link: landingUrl,
                name: spec.creative.headline,
                call_to_action: { type: ctaType, value: { link: landingUrl } },
              },
            },
          }),
        });
        adId = ad.id;
      } catch (error) {
        warnings.push(
          `Campaign + ad set created, but the ad creative failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      warnings.push(
        "Campaign + ad set launched. Add a Facebook Page (reconnect Meta) to push the first ad from here.",
      );
    }

    return {
      platform: "meta",
      ok: true,
      campaignId,
      adSetId,
      adId,
      adsManagerUrl: adsManagerUrl("meta", accountId, campaignId),
      message: spec.goLive
        ? "Live on Meta — spending starts as soon as the ad reviews."
        : "Created on Meta as PAUSED. Activate when you are ready to spend.",
      warnings,
    };
  } catch (error) {
    return {
      platform: "meta",
      ok: false,
      message: friendlyPlatformError("meta", error instanceof Error ? error.message : String(error)),
      warnings,
    };
  }
}

export async function updateMetaCampaignStatus(
  accessToken: string,
  campaignId: string,
  status: LiveStatus,
): Promise<StatusResult> {
  try {
    await graphPost(campaignId, accessToken, { status });
    return {
      platform: "meta",
      ok: true,
      campaignId,
      status,
      message: status === "ACTIVE" ? "Campaign is now active on Meta." : "Campaign paused on Meta.",
    };
  } catch (error) {
    return {
      platform: "meta",
      ok: false,
      campaignId,
      status,
      message: friendlyPlatformError("meta", error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function scaleMetaCampaignBudget(
  accessToken: string,
  campaignId: string,
  multiplier: number,
): Promise<ScaleResult> {
  try {
    const snap = await fetchCampaignBudgetSnapshot(accessToken, campaignId);
    const target = resolveBudgetEditTarget(snap);
    const nextCents = Math.max(100, Math.round(target.currentCents * multiplier));
    const nextAmount = nextCents / 100;
    await setMetaBudget({
      accessToken,
      objectId: target.id,
      kind: target.kind === "lifetime" ? "lifetime" : "daily",
      amount: nextAmount,
    });
    const previous = target.currentCents / 100;
    const layer = target.cbo ? "Campaign" : "Ad set";
    return {
      platform: "meta",
      ok: true,
      campaignId,
      adSetId: target.layer === "adset" ? target.id : undefined,
      previousBudget: previous,
      nextBudget: nextAmount,
      message: `${layer} ${target.kind} budget moved from ${previous.toFixed(2)} to ${nextAmount.toFixed(2)}.`,
    };
  } catch (error) {
    return {
      platform: "meta",
      ok: false,
      campaignId,
      message: friendlyPlatformError("meta", error instanceof Error ? error.message : String(error)),
    };
  }
}

export function metaAccountNumericId(accountId: string): string {
  return stripActPrefix(accountId);
}
