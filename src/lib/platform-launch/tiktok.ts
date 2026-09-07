import { adsManagerUrl, friendlyPlatformError, mapTikTokObjective, type LiveStatus } from "./mapping";
import type { LaunchSpec, PlatformLaunchResult, ScaleResult, StatusResult } from "./types";
import { safeFetch } from "@/lib/safe-fetch";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

interface TikTokBody {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
}

async function tiktokPost(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<TikTokBody> {
  const res = await safeFetch(`${TIKTOK_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as TikTokBody | null;
  if (!res.ok || !body || body.code !== 0) {
    throw new Error(body?.message || `TikTok ${path} failed (${res.status})`);
  }
  return body;
}

export async function launchTikTokCampaign(
  accessToken: string,
  advertiserId: string,
  spec: LaunchSpec,
): Promise<PlatformLaunchResult> {
  try {
    const body = await tiktokPost("/campaign/create/", accessToken, {
      advertiser_id: advertiserId,
      campaign_name: spec.name.slice(0, 512),
      objective_type: mapTikTokObjective(spec.objective),
      budget_mode: "BUDGET_MODE_DAY",
      budget: Math.max(20, Math.round(spec.dailyBudget * 100) / 100),
      operation_status: spec.goLive ? "ENABLE" : "DISABLE",
    });
    const campaignId = String(body.data?.campaign_id ?? "");
    if (!campaignId) throw new Error("TikTok created a campaign without an id.");
    return {
      platform: "tiktok",
      ok: true,
      campaignId,
      adsManagerUrl: adsManagerUrl("tiktok", advertiserId, campaignId),
      message: spec.goLive
        ? "Campaign created on TikTok (enabled)."
        : "Campaign created on TikTok as disabled. Add ad groups, then enable.",
      warnings: [
        "TikTok launch creates the campaign shell. Ad groups and creatives still need a follow-up in TikTok Ads Manager.",
      ],
    };
  } catch (error) {
    return {
      platform: "tiktok",
      ok: false,
      message: friendlyPlatformError("tiktok", error instanceof Error ? error.message : String(error)),
      warnings: [],
    };
  }
}

export async function updateTikTokCampaignStatus(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  status: LiveStatus,
): Promise<StatusResult> {
  try {
    await tiktokPost("/campaign/status/update/", accessToken, {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      operation_status: status === "ACTIVE" ? "ENABLE" : "DISABLE",
    });
    return {
      platform: "tiktok",
      ok: true,
      campaignId,
      status,
      message: status === "ACTIVE" ? "Campaign enabled on TikTok." : "Campaign disabled on TikTok.",
    };
  } catch (error) {
    return {
      platform: "tiktok",
      ok: false,
      campaignId,
      status,
      message: friendlyPlatformError("tiktok", error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function scaleTikTokCampaignBudget(
  accessToken: string,
  advertiserId: string,
  campaignId: string,
  nextDailyBudget: number,
): Promise<ScaleResult> {
  try {
    await tiktokPost("/campaign/update/", accessToken, {
      advertiser_id: advertiserId,
      campaign_id: campaignId,
      budget: Math.max(20, Math.round(nextDailyBudget * 100) / 100),
      budget_mode: "BUDGET_MODE_DAY",
    });
    return {
      platform: "tiktok",
      ok: true,
      campaignId,
      nextBudget: nextDailyBudget,
      message: `TikTok daily budget set to ${nextDailyBudget.toFixed(2)}.`,
    };
  } catch (error) {
    return {
      platform: "tiktok",
      ok: false,
      campaignId,
      message: friendlyPlatformError("tiktok", error instanceof Error ? error.message : String(error)),
    };
  }
}
