/** @jest-environment node */
jest.mock("@/lib/db", () => ({ prisma: { adAccount: { findMany: jest.fn() } } }));
jest.mock("@/lib/config", () => ({ config: { features: { mcpEnabled: false, reportingSyncEnabled: true, woocommerceEnabled: false } } }));
jest.mock("@/lib/workers/queues", () => ({
  metaSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  googleSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  tiktokSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  wooSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  emailSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  opencartSyncQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
  alertQueue: { upsertJobScheduler: jest.fn(), removeJobScheduler: jest.fn() },
}));

import { prisma } from "@/lib/db";
import { alertQueue, metaSyncQueue } from "@/lib/workers/queues";
import { setupSchedules } from "@/lib/workers/schedules";

const mockedConfig = jest.requireMock("@/lib/config").config as {
  features: Record<string, boolean>;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedConfig.features.mcpEnabled = false;
  mockedConfig.features.reportingSyncEnabled = true;
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

it("always registers the hourly budget alert check", async () => {
  mockedConfig.features.reportingSyncEnabled = false;
  await setupSchedules();
  expect(alertQueue.upsertJobScheduler).toHaveBeenCalledWith(
    "alerts-budget:hourly",
    { pattern: "30 * * * *" },
    expect.objectContaining({ name: "alerts-budget:hourly" }),
  );
});
