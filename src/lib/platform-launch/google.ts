import {
  adsManagerUrl,
  dailyBudgetToMicros,
  friendlyPlatformError,
  type LiveStatus,
} from "./mapping";
import type { LaunchSpec, PlatformLaunchResult, ScaleResult, StatusResult } from "./types";
import { googleAdsLoginCustomerId, googleAdsSearchRows, parseGoogleAdsCustomerId } from "@/lib/google-ads-accounts";
import { safeFetch } from "@/lib/safe-fetch";

const GOOGLE_ADS_API_VERSION = "v25";

function googleHeaders(accessToken: string, accountId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  };
  const loginCustomerId = googleAdsLoginCustomerId(accountId ?? null);
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

function bareCustomerId(accountId: string): string {
  return parseGoogleAdsCustomerId(accountId) ?? accountId.replace(/-/g, "").replace(/^customers\//, "");
}

async function googleMutate(
  accessToken: string,
  customerId: string,
  resource: "campaignBudgets" | "campaigns",
  body: unknown,
): Promise<{ results?: Array<{ resourceName?: string }>; error?: { message?: string } }> {
  const cid = bareCustomerId(customerId);
  const res = await safeFetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cid}/${resource}:mutate`,
    {
      method: "POST",
      headers: googleHeaders(accessToken, customerId),
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json().catch(() => null)) as {
    results?: Array<{ resourceName?: string }>;
    error?: { message?: string };
    message?: string;
  } | null;
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Google Ads ${resource} mutate failed (${res.status})`);
  }
  return json ?? {};
}

async function googleSearch<T>(
  accessToken: string,
  customerId: string,
  query: string,
): Promise<T[]> {
  const cid = bareCustomerId(customerId);
  return googleAdsSearchRows<T>(
    accessToken,
    cid,
    query,
    googleAdsLoginCustomerId(customerId),
  );
}

export function googleWriteConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
}

export async function launchGoogleCampaign(
  accessToken: string,
  accountId: string,
  spec: LaunchSpec,
): Promise<PlatformLaunchResult> {
  if (!googleWriteConfigured()) {
    return {
      platform: "google",
      ok: false,
      message: "GOOGLE_ADS_DEVELOPER_TOKEN is not set, so Google campaign writes are disabled.",
      warnings: [],
    };
  }
  const cid = bareCustomerId(accountId);
  const status: LiveStatus = spec.goLive ? "ACTIVE" : "PAUSED";
  try {
    const budgetRes = await googleMutate(accessToken, accountId, "campaignBudgets", {
      operations: [
        {
          create: {
            name: `${spec.name} budget ${Date.now()}`,
            amountMicros: dailyBudgetToMicros(spec.dailyBudget),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    });
    const budgetName = budgetRes.results?.[0]?.resourceName;
    if (!budgetName) throw new Error("Google Ads did not return a campaign budget resource.");

    const campaignRes = await googleMutate(accessToken, accountId, "campaigns", {
      operations: [
        {
          create: {
            name: spec.name,
            status,
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetName,
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
            },
          },
        },
      ],
    });
    const resourceName = campaignRes.results?.[0]?.resourceName;
    const campaignId = resourceName?.split("/").pop();
    if (!campaignId) throw new Error("Google Ads did not return a campaign id.");

    return {
      platform: "google",
      ok: true,
      campaignId,
      adsManagerUrl: adsManagerUrl("google", cid, campaignId),
      message: spec.goLive
        ? "Search campaign created on Google Ads (live)."
        : "Search campaign created on Google Ads as PAUSED. Add keywords in Ads, then activate.",
      warnings: [
        "Google launch creates the campaign + daily budget. Ad groups and keywords still need a follow-up in Google Ads.",
      ],
    };
  } catch (error) {
    return {
      platform: "google",
      ok: false,
      message: friendlyPlatformError("google", error instanceof Error ? error.message : String(error)),
      warnings: [],
    };
  }
}

export async function updateGoogleCampaignStatus(
  accessToken: string,
  accountId: string,
  campaignId: string,
  status: LiveStatus,
): Promise<StatusResult> {
  const cid = bareCustomerId(accountId);
  try {
    await googleMutate(accessToken, accountId, "campaigns", {
      operations: [
        {
          update: {
            resourceName: `customers/${cid}/campaigns/${campaignId}`,
            status,
          },
          updateMask: "status",
        },
      ],
    });
    return {
      platform: "google",
      ok: true,
      campaignId,
      status,
      message: status === "ACTIVE" ? "Campaign enabled in Google Ads." : "Campaign paused in Google Ads.",
    };
  } catch (error) {
    return {
      platform: "google",
      ok: false,
      campaignId,
      status,
      message: friendlyPlatformError("google", error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function scaleGoogleCampaignBudget(
  accessToken: string,
  accountId: string,
  campaignId: string,
  multiplier: number,
): Promise<ScaleResult> {
  const cid = bareCustomerId(accountId);
  try {
    const rows = await googleSearch<{
      campaign?: { campaignBudget?: string };
      campaignBudget?: { resourceName?: string; amountMicros?: string };
    }>(
      accessToken,
      accountId,
      `SELECT campaign.campaign_budget, campaign_budget.amount_micros, campaign_budget.resource_name
       FROM campaign
       WHERE campaign.id = ${campaignId}
       LIMIT 1`,
    );
    const budgetName =
      rows[0]?.campaignBudget?.resourceName || rows[0]?.campaign?.campaignBudget;
    const currentMicros = parseInt(rows[0]?.campaignBudget?.amountMicros ?? "0", 10);
    if (!budgetName || !currentMicros) {
      throw new Error("Could not read this Google campaign budget.");
    }
    const nextMicros = Math.max(1_000_000, Math.round(currentMicros * multiplier));
    await googleMutate(accessToken, accountId, "campaignBudgets", {
      operations: [
        {
          update: {
            resourceName: budgetName,
            amountMicros: String(nextMicros),
          },
          updateMask: "amount_micros",
        },
      ],
    });
    return {
      platform: "google",
      ok: true,
      campaignId,
      previousBudget: currentMicros / 1_000_000,
      nextBudget: nextMicros / 1_000_000,
      message: `Daily budget moved from ${(currentMicros / 1_000_000).toFixed(2)} to ${(nextMicros / 1_000_000).toFixed(2)}.`,
    };
  } catch (error) {
    return {
      platform: "google",
      ok: false,
      campaignId,
      message: friendlyPlatformError("google", error instanceof Error ? error.message : String(error)),
    };
  }
}
