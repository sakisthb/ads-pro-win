/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findMany: jest.fn(), findFirst: jest.fn() },
  adAccount: { findMany: jest.fn() }, wooProduct: { findMany: jest.fn() },
  campaign: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  metaWriteLog: { create: jest.fn(), findMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({
  OrganizationAuthorizationError: class extends Error {}, organizationRoles: ["owner", "admin", "member", "viewer"],
  requireOrganizationRoleForUser: jest.fn().mockResolvedValue({ organizationId: "org-1", membership: { role: "owner" } }),
}));
jest.mock("@/lib/platform-launch", () => ({
  resolveLaunchAccount: jest.fn(), googleWriteConfigured: jest.fn(() => true),
  generateLaunchPlan: jest.fn(),
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
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ id: "brand-1" } as never);
  jest.mocked(prisma.metaWriteLog.findMany).mockResolvedValue([] as never);
  jest.mocked(launch.getMetaGrantedPermissions).mockResolvedValue(["ads_management"] as never);
});

it("does not send another brand's legacy context to a scoped planner", async () => {
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org-1", slug: "fixture", settings: {
    projectContext: { objective: "sales", targetResult: "Other brand legacy target" },
  } } as never);
  await caller().generatePlan({ prompt: "Fixture planning question", objective: "sales", platforms: ["google"], brandId: "brand-1" });
  expect(launch.generateLaunchPlan).toHaveBeenCalledWith(expect.objectContaining({ brandId: "brand-1", projectContext: undefined }));
  expect(prisma.brand.findFirst).toHaveBeenCalledWith({ where: { id: "brand-1", organizationId: "org-1" }, select: { id: true } });
  expect(launch.resolveLaunchAccount).not.toHaveBeenCalled();
});
it("refuses a foreign planner brand before any generation or provider resolution", async () => {
  jest.mocked(prisma.brand.findFirst).mockResolvedValue(null);
  await expect(caller().generatePlan({ prompt: "Fixture planning question", objective: "sales", platforms: ["google"], brandId: "foreign" }))
    .rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(launch.generateLaunchPlan).not.toHaveBeenCalled();
  expect(launch.resolveLaunchAccount).not.toHaveBeenCalled();
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

describe("Meta writes through the launcher routes honor the ADR 0002 contract", () => {
  const resolvedMeta = { accessToken: "fixture-token", account: { id: "acc-row-1", accountId: "fixture-meta" } } as never;

  it("refuses a Meta status write when the token lacks ads_management", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.getMetaGrantedPermissions).mockResolvedValue(["ads_read"] as never);
    await expect(caller().updateLiveStatus({ platform: "meta", platformCampaignId: "123", status: "ACTIVE" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/ads_management/i) });
    expect(launch.updateMetaCampaignStatus).not.toHaveBeenCalled();
    expect(prisma.metaWriteLog.create).not.toHaveBeenCalled();
  });

  it("audits a successful Meta status write to metaWriteLog", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.updateMetaCampaignStatus).mockResolvedValue({ platform: "meta", ok: true, campaignId: "123", status: "PAUSED", message: "Paused" });
    await expect(caller().updateLiveStatus({ platform: "meta", platformCampaignId: "123", status: "PAUSED" }))
      .resolves.toMatchObject({ ok: true });
    expect(prisma.metaWriteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        adAccountId: "acc-row-1",
        objectType: "campaign",
        objectId: "123",
        action: "setStatus",
        ok: true,
      }),
    });
  });

  it("audits a failed Meta status write with ok false", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.updateMetaCampaignStatus).mockResolvedValue({ platform: "meta", ok: false, campaignId: "123", status: "ACTIVE", message: "Fixture failure" });
    await expect(caller().updateLiveStatus({ platform: "meta", platformCampaignId: "123", status: "ACTIVE" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/fixture failure/i) });
    expect(prisma.metaWriteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ objectId: "123", action: "setStatus", ok: false, message: expect.stringMatching(/fixture failure/i) }),
    });
  });

  it("audits a Meta budget scale and flags learning risk above 20 percent", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.scaleMetaCampaignBudget).mockResolvedValue({ platform: "meta", ok: true, campaignId: "123", previousBudget: 20, nextBudget: 30, message: "Scaled" });
    await expect(caller().scaleBudget({ platform: "meta", platformCampaignId: "123", multiplier: 1.5 }))
      .resolves.toMatchObject({ ok: true });
    expect(prisma.metaWriteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adAccountId: "acc-row-1",
        objectType: "campaign",
        objectId: "123",
        action: "scaleBudget",
        ok: true,
        learningRisk: true,
      }),
    });
  });

  it("does not flag learning risk for a small Meta budget scale", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.scaleMetaCampaignBudget).mockResolvedValue({ platform: "meta", ok: true, campaignId: "123", previousBudget: 20, nextBudget: 22, message: "Scaled" });
    await expect(caller().scaleBudget({ platform: "meta", platformCampaignId: "123", multiplier: 1.1 }))
      .resolves.toMatchObject({ ok: true });
    expect(prisma.metaWriteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "scaleBudget", ok: true, learningRisk: false }),
    });
  });

  it("refuses a fifth Meta budget edit within the same hour across scale and set routes", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(prisma.metaWriteLog.findMany).mockResolvedValue([
      { createdAt: new Date() }, { createdAt: new Date() }, { createdAt: new Date() }, { createdAt: new Date() },
    ] as never);
    await expect(caller().scaleBudget({ platform: "meta", platformCampaignId: "123", multiplier: 1.2 }))
      .rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(launch.scaleMetaCampaignBudget).not.toHaveBeenCalled();
    expect(prisma.metaWriteLog.create).not.toHaveBeenCalled();
  });

  it("audits a failed Meta budget scale with ok false", async () => {
    jest.mocked(launch.resolveLaunchAccount).mockResolvedValue(resolvedMeta);
    jest.mocked(launch.scaleMetaCampaignBudget).mockResolvedValue({ platform: "meta", ok: false, campaignId: "123", message: "Fixture scale failure" });
    await expect(caller().scaleBudget({ platform: "meta", platformCampaignId: "123", multiplier: 1.2 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/scale failure/i) });
    expect(prisma.metaWriteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ objectId: "123", action: "scaleBudget", ok: false }),
    });
  });
});
