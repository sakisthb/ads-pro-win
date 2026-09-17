/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findMany: jest.fn() },
  adAccount: { findMany: jest.fn() }, wooProduct: { findMany: jest.fn() },
  campaign: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {}, organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn().mockResolvedValue({ organizationId: "org-1", membership: { role: "owner" } }),
}));
jest.mock("@/lib/platform-launch", () => ({
  resolveLaunchAccount: jest.fn(), googleWriteConfigured: jest.fn(() => true),
  launchGoogleCampaign: jest.fn(), launchMetaCampaign: jest.fn(), launchTikTokCampaign: jest.fn(),
  updateGoogleCampaignStatus: jest.fn(), updateMetaCampaignStatus: jest.fn(), updateTikTokCampaignStatus: jest.fn(),
  scaleGoogleCampaignBudget: jest.fn(), scaleMetaCampaignBudget: jest.fn(), scaleTikTokCampaignBudget: jest.fn(),
  getMetaGrantedPermissions: jest.fn(async () => ["ads_management"]),
  mapPrismaPlatform: (p: string) => p === "meta" ? "facebook" : p,
}));

import { prisma } from "@/lib/db";
import * as launch from "@/lib/platform-launch";
import { campaignsRouter } from "@/lib/trpc/routers/campaigns";

const caller = () => campaignsRouter.createCaller({
  session: { user: { id: "user-1" }, expires: "2099-01-01" }, prisma,
});
const launchInput = { name: "Fixture draft", objective: "traffic" as const, dailyBudget: 20,
  headline: "Fixture", primaryText: "Fixture copy" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-1", slug: "fixture", settings: null } as never);
  jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(null);
  jest.mocked(prisma.campaign.create).mockResolvedValue({ id: "draft-1" } as never);
});

it.each(["google", "tiktok"] as const)("refuses %s status before credential/account resolution", async (platform) => {
  await expect(caller().updateLiveStatus({ platform, platformCampaignId: "123", status: "ACTIVE" }))
    .rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/read.only/i) });
  expect(launch.resolveLaunchAccount).not.toHaveBeenCalled();
  expect(prisma.campaign.updateMany).not.toHaveBeenCalled();
});

it.each(["google", "tiktok"] as const)("refuses %s budget before credential/account resolution", async (platform) => {
  await expect(caller().scaleBudget({ platform, platformCampaignId: "123" }))
    .rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/read.only/i) });
  expect(launch.resolveLaunchAccount).not.toHaveBeenCalled();
});

it.each([["google"], ["tiktok"], ["meta"], ["meta", "google"]] as Array<Array<"meta" | "google" | "tiktok">>)
("refuses the entire creation request %j without partial launches or draft writes", async (...platforms) => {
  await expect(caller().launch({ ...launchInput, platforms }))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(launch.resolveLaunchAccount).not.toHaveBeenCalled();
  expect(launch.launchMetaCampaign).not.toHaveBeenCalled();
  expect(launch.launchGoogleCampaign).not.toHaveBeenCalled();
  expect(launch.launchTikTokCampaign).not.toHaveBeenCalled();
  expect(prisma.campaign.create).not.toHaveBeenCalled();
});

it("reports connected read-only platforms as connected but unable to write", async () => {
  jest.mocked(prisma.brand.findMany).mockResolvedValue([]);
  jest.mocked(prisma.adAccount.findMany).mockResolvedValue(["google", "tiktok"].map((platform) => ({
    id: `fixture-${platform}`, platform, accessToken: "fixture-ciphertext", tokenExpiry: new Date("2099-01-01"),
  })) as never);
  jest.mocked(prisma.campaign.findMany).mockResolvedValue([]);
  const result = await caller().getLaunchContext();
  expect(result.connections).toEqual(expect.arrayContaining([
    expect.objectContaining({ platform: "google", isConnected: true, canWrite: false }),
    expect.objectContaining({ platform: "tiktok", isConnected: true, canWrite: false }),
  ]));
});

it("preserves the existing Meta status path and explicit account context", async () => {
  jest.mocked(launch.resolveLaunchAccount).mockResolvedValue({ accessToken: "fixture-token", account: { accountId: "fixture-meta" } } as never);
  jest.mocked(launch.updateMetaCampaignStatus).mockResolvedValue({ platform: "meta", ok: true, campaignId: "123", status: "PAUSED", message: "Fixture status" });
  await expect(caller().updateLiveStatus({ platform: "meta", platformCampaignId: "123", status: "PAUSED", adAccountId: "acc-meta" })).resolves.toMatchObject({ ok: true });
  expect(launch.resolveLaunchAccount).toHaveBeenCalledWith(prisma, "org-1", "meta", "acc-meta", undefined);
  expect(launch.updateMetaCampaignStatus).toHaveBeenCalledWith("fixture-token", "123", "PAUSED");
});

it("preserves the existing Meta budget path without opening other platforms", async () => {
  jest.mocked(launch.resolveLaunchAccount).mockResolvedValue({ accessToken: "fixture-token", account: { accountId: "fixture-meta" } } as never);
  jest.mocked(launch.scaleMetaCampaignBudget).mockResolvedValue({ platform: "meta", ok: true, campaignId: "123", nextBudget: 24, message: "Fixture budget" });
  await expect(caller().scaleBudget({ platform: "meta", platformCampaignId: "123", multiplier: 1.2 })).resolves.toMatchObject({ ok: true });
  expect(launch.scaleMetaCampaignBudget).toHaveBeenCalledWith("fixture-token", "123", 1.2);
});
