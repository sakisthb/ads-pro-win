/** @jest-environment node */
import type { WooSyncJobData, OpenCartSyncJobData } from "@/lib/workers/queues";

jest.mock("@/lib/config", () => ({
  config: {
    features: { mcpEnabled: true, woocommerceEnabled: true },
    marketing: { google: { developerToken: "dev-token" } },
  },
}));

jest.mock("@/lib/workers/redis-connection", () => ({
  createRedisConnection: jest.fn(() => ({})),
}));

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(function Worker(name: string) {
    this.name = name;
    this.close = jest.fn().mockResolvedValue(undefined);
  }),
  Queue: jest.fn().mockImplementation(function Queue(name: string) {
    this.name = name;
  }),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    adAccount: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    syncJob: {
      create: jest.fn().mockResolvedValue({ id: "sync-job-1" }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn(async (ops: unknown[]) => {
      for (const op of ops) await op;
    }),
  },
}));

jest.mock("@/lib/crypto", () => ({
  decrypt: jest.fn((cipher: string) => `decrypted:${cipher}`),
  encrypt: jest.fn((plain: string) => `encrypted:${plain}`),
}));

jest.mock("@/lib/sync/fetchers", () => ({
  persistWooCommerceSync: jest.fn().mockResolvedValue({ orderCount: 2, productCount: 3 }),
  fetchWooProducts: jest.fn().mockResolvedValue([{ productId: 1, name: "Widget" }]),
  upsertWooProducts: jest.fn().mockResolvedValue(1),
  upsertWooOrders: jest.fn().mockResolvedValue(2),
  upsertDailyMetrics: jest.fn().mockResolvedValue(1),
  fetchOpenCartData: jest.fn().mockResolvedValue({
    orders: [{ id: 10, total: "100.00" }],
    products: [{ productId: 20, name: "OC Widget" }],
    metrics: [{ date: "2026-09-01", conversions: 1, conversionValue: 100 }],
  }),
}));

jest.mock("@/lib/woo-orders", () => ({
  costMapFromProducts: jest.fn(() => new Map([[20, 30]])),
}));

import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import {
  persistWooCommerceSync,
  fetchWooProducts,
  upsertWooProducts,
  upsertWooOrders,
  upsertDailyMetrics,
  fetchOpenCartData,
} from "@/lib/sync/fetchers";
import { costMapFromProducts } from "@/lib/woo-orders";
import { processWooSync, processOpenCartSync } from "@/lib/workers/sync-processor";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

function makeWooJob(overrides: Partial<WooSyncJobData> = {}): { data: WooSyncJobData } {
  return {
    data: {
      brandId: "brand-1",
      adAccountId: "acc-woo-1",
      type: "orders",
      ...overrides,
    },
  } as { data: WooSyncJobData };
}

function makeOpenCartJob(overrides: Partial<OpenCartSyncJobData> = {}): { data: OpenCartSyncJobData } {
  return {
    data: {
      brandId: "brand-1",
      adAccountId: "acc-oc-1",
      type: "orders",
      ...overrides,
    },
  } as { data: OpenCartSyncJobData };
}

function makeAdAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-woo-1",
    brandId: "brand-1",
    platform: "woocommerce",
    accountId: "https://store.example.com",
    accessToken: "enc-key",
    refreshToken: "enc-secret",
    isActive: true,
    ...overrides,
  };
}

describe("processWooSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a missing ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(null);

    await expect(processWooSync(makeWooJob() as unknown as Parameters<typeof processWooSync>[0])).rejects.toThrow(
      "AdAccount not found",
    );
  });

  it("rejects an inactive ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(makeAdAccount({ isActive: false }) as never);

    await expect(processWooSync(makeWooJob() as unknown as Parameters<typeof processWooSync>[0])).rejects.toThrow(
      "missing store URL or tokens",
    );
  });

  it("rejects a platform-mismatched ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(
      makeAdAccount({ platform: "opencart" }) as never,
    );

    await expect(processWooSync(makeWooJob() as unknown as Parameters<typeof processWooSync>[0])).rejects.toThrow(
      "not a WooCommerce account",
    );
  });

  it("decrypts credentials at process time and completes an orders sync", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(makeAdAccount() as never);

    await processWooSync(makeWooJob() as unknown as Parameters<typeof processWooSync>[0]);

    expect(mockedDecrypt).toHaveBeenCalledWith("enc-key");
    expect(mockedDecrypt).toHaveBeenCalledWith("enc-secret");
    expect(persistWooCommerceSync).toHaveBeenCalledWith(
      expect.objectContaining({
        storeUrl: "https://store.example.com",
        consumerKey: "decrypted:enc-key",
        consumerSecret: "decrypted:enc-secret",
        brandId: "brand-1",
      }),
    );
    expect(prisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed", recordsProcessed: 5 }),
      }),
    );
  });

  it("completes a products sync without credential fields in the job", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(makeAdAccount() as never);

    await processWooSync(
      makeWooJob({ type: "products" }) as unknown as Parameters<typeof processWooSync>[0],
    );

    expect(fetchWooProducts).toHaveBeenCalledWith(
      "https://store.example.com",
      "decrypted:enc-key",
      "decrypted:enc-secret",
    );
    expect(upsertWooProducts).toHaveBeenCalledWith([{ productId: 1, name: "Widget" }], "brand-1");
  });
});

describe("processOpenCartSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a missing ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(null);

    await expect(
      processOpenCartSync(makeOpenCartJob() as unknown as Parameters<typeof processOpenCartSync>[0]),
    ).rejects.toThrow("AdAccount not found");
  });

  it("rejects an inactive ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(
      makeAdAccount({
        id: "acc-oc-1",
        platform: "opencart",
        accountId: "https://oc.example.com",
        accessToken: "enc-user",
        refreshToken: "enc-key",
        isActive: false,
      }) as never,
    );

    await expect(
      processOpenCartSync(makeOpenCartJob() as unknown as Parameters<typeof processOpenCartSync>[0]),
    ).rejects.toThrow("inactive or missing store URL or tokens");
  });

  it("rejects a platform-mismatched ad account", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(makeAdAccount({ id: "acc-oc-1" }) as never);

    await expect(
      processOpenCartSync(makeOpenCartJob() as unknown as Parameters<typeof processOpenCartSync>[0]),
    ).rejects.toThrow("not an OpenCart account");
  });

  it("decrypts credentials at process time and completes an orders sync", async () => {
    mockedPrisma.adAccount.findUnique.mockResolvedValue(
      makeAdAccount({
        id: "acc-oc-1",
        platform: "opencart",
        accountId: "https://oc.example.com",
        accessToken: "enc-user",
        refreshToken: "enc-key",
      }) as never,
    );

    await processOpenCartSync(
      makeOpenCartJob() as unknown as Parameters<typeof processOpenCartSync>[0],
    );

    expect(mockedDecrypt).toHaveBeenCalledWith("enc-user");
    expect(mockedDecrypt).toHaveBeenCalledWith("enc-key");
    expect(fetchOpenCartData).toHaveBeenCalledWith(
      "decrypted:enc-user",
      "decrypted:enc-key",
      "https://oc.example.com",
      expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }),
    );
    expect(upsertWooProducts).toHaveBeenCalledWith([{ productId: 20, name: "OC Widget" }], "brand-1");
    expect(upsertWooOrders).toHaveBeenCalledWith(
      [{ id: 10, total: "100.00" }],
      "brand-1",
      expect.any(Map),
    );
    expect(costMapFromProducts).toHaveBeenCalledWith([{ productId: 20, name: "OC Widget" }]);
    expect(upsertDailyMetrics).toHaveBeenCalledWith(
      [{ date: "2026-09-01", conversions: 1, conversionValue: 100 }],
      "acc-oc-1",
      "opencart",
    );
    expect(prisma.adAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncAt: expect.any(Date) }) }),
    );
  });
});
