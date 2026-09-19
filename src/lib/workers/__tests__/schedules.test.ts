/** @jest-environment node */
jest.mock("@/lib/db", () => ({ prisma: { adAccount: { findMany: jest.fn() } } }));
jest.mock("@/lib/config", () => ({ config: { features: { mcpEnabled: false, reportingSyncEnabled: true, woocommerceEnabled: false, reportingSyncAccountIds: [] } } }));
jest.mock("@/lib/workers/queues", () => ({
  metaSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  googleSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  tiktokSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  wooSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  emailSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  opencartSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
  alertQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn(), getJobSchedulers: jest.fn() },
}));

import { prisma } from "@/lib/db";
import {
  alertQueue,
  emailSyncQueue,
  googleSyncQueue,
  metaSyncQueue,
  tiktokSyncQueue,
} from "@/lib/workers/queues";
import { setupSchedules } from "@/lib/workers/schedules";

const mockedConfig = jest.requireMock("@/lib/config").config as {
  features: {
    mcpEnabled: boolean;
    reportingSyncEnabled: boolean;
    woocommerceEnabled: boolean;
    reportingSyncAccountIds: string[];
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedConfig.features.mcpEnabled = false;
  mockedConfig.features.reportingSyncEnabled = true;
  mockedConfig.features.reportingSyncAccountIds = [];
  for (const queue of [metaSyncQueue, googleSyncQueue, tiktokSyncQueue, emailSyncQueue]) {
    jest.mocked(queue.getJobSchedulers).mockResolvedValue([]);
  }
  jest.mocked(prisma.adAccount.findMany).mockImplementation(((args: unknown) => {
    const where = (args as { where?: { platform?: unknown } })?.where ?? {};
    if (where.platform !== undefined) return Promise.resolve([]);
    return Promise.resolve([{ id: "acc-meta-1", platform: "meta" }]);
  }) as never);
});

it("schedules metric syncs when reporting sync is enabled, without MCP_ENABLED", async () => {
  await setupSchedules();
  expect(metaSyncQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
  expect(metaSyncQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "sync:acc-meta-1:daily",
    { pattern: "0 4 * * *" },
    expect.objectContaining({ name: "sync:acc-meta-1:daily" }),
  );
});

it("skips metric syncs only when reporting sync is explicitly disabled", async () => {
  mockedConfig.features.reportingSyncEnabled = false;
  mockedConfig.features.mcpEnabled = true;
  await setupSchedules();
  expect(metaSyncQueue.upsertJobScheduler).not.toHaveBeenCalled();
});

it("restricts metric sync schedules to the account allowlist when set", async () => {
  mockedConfig.features.reportingSyncAccountIds = ["acc-meta-1"];
  jest.mocked(prisma.adAccount.findMany).mockImplementation(((args: unknown) => {
    const where = (args as { where?: { platform?: unknown; id?: { in: string[] } } })?.where ?? {};
    if (where.platform !== undefined) return Promise.resolve([]);
    const all = [
      { id: "acc-meta-1", platform: "meta" },
      { id: "acc-google-1", platform: "google" },
      { id: "acc-tiktok-1", platform: "tiktok" },
    ];
    if (where.id?.in) return Promise.resolve(all.filter((a) => where.id!.in.includes(a.id)));
    return Promise.resolve(all);
  }) as never);

  await setupSchedules();

  expect(prisma.adAccount.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ id: { in: ["acc-meta-1"] } }) }),
  );
  expect(metaSyncQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
  expect(googleSyncQueue.upsertJobScheduler).not.toHaveBeenCalled();
  expect(tiktokSyncQueue.upsertJobScheduler).not.toHaveBeenCalled();
});

it("schedules every active ad account when the allowlist is empty", async () => {
  jest.mocked(prisma.adAccount.findMany).mockImplementation(((args: unknown) => {
    const where = (args as { where?: { platform?: unknown } })?.where ?? {};
    if (where.platform !== undefined) return Promise.resolve([]);
    return Promise.resolve([
      { id: "acc-meta-1", platform: "meta" },
      { id: "acc-google-1", platform: "google" },
    ]);
  }) as never);

  await setupSchedules();

  expect(prisma.adAccount.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }),
  );
  expect(metaSyncQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
  expect(googleSyncQueue.upsertJobScheduler).toHaveBeenCalledTimes(2);
});

it("always registers the hourly budget alert check", async () => {
  mockedConfig.features.reportingSyncEnabled = false;
  await setupSchedules();
  expect(alertQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "alerts-budget:hourly",
    { pattern: "30 * * * *" },
    expect.objectContaining({ name: "alerts-budget:hourly" }),
  );
});

it("removes persisted metric schedulers for accounts outside the allowlist", async () => {
  mockedConfig.features.reportingSyncAccountIds = ["acc-meta-1"];
  jest.mocked(metaSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-meta-1:daily", name: "sync:acc-meta-1:daily" },
    { key: "sync:acc-meta-1:hourly", name: "sync:acc-meta-1:hourly" },
    { key: "sync:acc-stale:daily", name: "sync:acc-stale:daily" },
    { key: "sync:acc-stale:hourly", name: "sync:acc-stale:hourly" },
  ]);
  jest.mocked(googleSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-google-stale:daily", name: "sync:acc-google-stale:daily" },
  ]);

  await setupSchedules();

  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledTimes(2);
  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-stale:daily");
  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-stale:hourly");
  expect(metaSyncQueue.removeJobScheduler).not.toHaveBeenCalledWith("sync:acc-meta-1:daily");
  expect(metaSyncQueue.removeJobScheduler).not.toHaveBeenCalledWith("sync:acc-meta-1:hourly");
  expect(googleSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-google-stale:daily");
});

it("removes all persisted metric schedulers when reporting sync is disabled, without touching email schedulers", async () => {
  mockedConfig.features.reportingSyncEnabled = false;
  jest.mocked(metaSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-meta-1:daily", name: "sync:acc-meta-1:daily" },
    { key: "sync:acc-meta-1:hourly", name: "sync:acc-meta-1:hourly" },
  ]);
  jest.mocked(googleSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-google-1:daily", name: "sync:acc-google-1:daily" },
  ]);
  jest.mocked(emailSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-email:sixhourly", name: "sync:acc-email:sixhourly" },
  ]);

  await setupSchedules();

  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledTimes(2);
  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-meta-1:daily");
  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-meta-1:hourly");
  expect(googleSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-google-1:daily");
  expect(tiktokSyncQueue.removeJobScheduler).not.toHaveBeenCalled();
  expect(emailSyncQueue.removeJobScheduler).not.toHaveBeenCalled();
});

it("keeps schedulers of all active accounts when the allowlist is empty", async () => {
  jest.mocked(metaSyncQueue.getJobSchedulers).mockResolvedValue([
    { key: "sync:acc-meta-1:daily", name: "sync:acc-meta-1:daily" },
    { key: "sync:acc-orphan:daily", name: "sync:acc-orphan:daily" },
  ]);

  await setupSchedules();

  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledTimes(1);
  expect(metaSyncQueue.removeJobScheduler).toHaveBeenCalledWith("sync:acc-orphan:daily");
  expect(metaSyncQueue.removeJobScheduler).not.toHaveBeenCalledWith("sync:acc-meta-1:daily");
});
