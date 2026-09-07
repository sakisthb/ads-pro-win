import type { LaunchObjective, LaunchPlatform, LiveStatus } from "./mapping";

export interface LaunchCreative {
  headline: string;
  primaryText: string;
  cta: string;
  landingUrl?: string;
}

export interface LaunchAudience {
  countries: string[];
  ageMin: number;
  ageMax: number;
  interests: string[];
}

export interface LaunchSpec {
  name: string;
  description?: string;
  objective: LaunchObjective;
  dailyBudget: number;
  currency?: string;
  landingUrl?: string;
  pageId?: string;
  pixelId?: string;
  goLive: boolean;
  includeAd?: boolean;
  audience: LaunchAudience;
  creative: LaunchCreative;
}

export interface PlatformLaunchResult {
  platform: LaunchPlatform;
  ok: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  adsManagerUrl?: string;
  message: string;
  warnings: string[];
}

export interface ScaleResult {
  platform: LaunchPlatform;
  ok: boolean;
  campaignId: string;
  adSetId?: string;
  previousBudget?: number;
  nextBudget?: number;
  message: string;
}

export interface StatusResult {
  platform: LaunchPlatform;
  ok: boolean;
  campaignId: string;
  status: LiveStatus;
  message: string;
}

export interface MetaAssetPage {
  id: string;
  name: string;
  instagramUserId?: string;
  instagramUsername?: string;
}

export interface MetaAssetPixel {
  id: string;
  name: string;
}

export interface MetaAssetAudience {
  id: string;
  name: string;
  subtype?: string;
  size?: number;
}

export interface LaunchPlan {
  name: string;
  hypothesis: string;
  objective: LaunchObjective;
  platforms: LaunchPlatform[];
  suggestedDailyBudget: number;
  audience: LaunchAudience;
  creatives: LaunchCreative[];
  funnel: {
    cold: { label: string; share: number };
    warm: { label: string; share: number };
    hot: { label: string; share: number };
  };
}
