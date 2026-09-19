/** @jest-environment node */
jest.mock("@/lib/safe-fetch", () => ({ safeFetch: jest.fn() }));

import { safeFetch } from "@/lib/safe-fetch";
import { googleWriteConfigured, launchGoogleCampaign, scaleGoogleCampaignBudget, updateGoogleCampaignStatus } from "@/lib/platform-launch/google";
import { launchTikTokCampaign, scaleTikTokCampaignBudget, updateTikTokCampaignStatus } from "@/lib/platform-launch/tiktok";
import { launchMetaCampaign } from "@/lib/platform-launch/meta";
import type { LaunchSpec } from "@/lib/platform-launch/types";
import { readOnlyAdWriteReason } from '@/lib/platform-launch/write-policy';

const spec: LaunchSpec = {
  name: "Fixture draft", objective: "traffic", dailyBudget: 20, goLive: false,
  audience: { countries: ["GR"], ageMin: 18, ageMax: 65, interests: [] },
  creative: { headline: "Fixture", primaryText: "Fixture copy", cta: "Shop Now" },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(safeFetch).mockResolvedValue({ ok: true, json: async () => ({
    results: [{ resourceName: "customers/1111111111/campaigns/123" }],
    code: 0, data: { campaign_id: "123" }, id: "123",
  }), text: async () => JSON.stringify([{ results: [{ campaign: { campaignBudget: "customers/1111111111/campaignBudgets/123" },
    campaignBudget: { amountMicros: "20000000", resourceName: "customers/1111111111/campaignBudgets/123" } }] }]) } as Response);
});

it("does not advertise Google writes as configured", () => {
  expect(googleWriteConfigured()).toBe(false);
});

it('routes existing-target repairs to ADR 0003 without opening generic campaign writes', () => {
  expect(readOnlyAdWriteReason('google')).toMatch(/Google Repair Desk.*ADR 0003/);
});

it.each([
  ["Google launch", () => launchGoogleCampaign("fixture-token", "1111111111", spec)],
  ["Google status", () => updateGoogleCampaignStatus("fixture-token", "1111111111", "123", "ACTIVE")],
  ["Google budget", () => scaleGoogleCampaignBudget("fixture-token", "1111111111", "123", 1.2)],
  ["TikTok launch", () => launchTikTokCampaign("fixture-token", "fixture-advertiser", spec)],
  ["TikTok status", () => updateTikTokCampaignStatus("fixture-token", "fixture-advertiser", "123", "ACTIVE")],
  ["TikTok budget", () => scaleTikTokCampaignBudget("fixture-token", "fixture-advertiser", "123", 24)],
] as const)("blocks %s before provider reads or writes", async (_label, call) => {
  expect(await call()).toMatchObject({ ok: false, message: expect.stringMatching(/read.only/i) });
  expect(safeFetch).not.toHaveBeenCalled();
});

it("blocks new Meta creation without changing the existing-object operator desk", async () => {
  expect(await launchMetaCampaign("fixture-token", "fixture-account", spec)).toMatchObject({
    ok: false, message: expect.stringMatching(/existing.*objects|creation.*not authorized/i),
  });
  expect(safeFetch).not.toHaveBeenCalled();
});
