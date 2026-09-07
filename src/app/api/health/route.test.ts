/** @jest-environment node */

import { GET as health } from "./route";
import { prisma } from "@/lib/db";
import IORedis from "ioredis";

jest.mock("@/lib/db", () => ({
  prisma: { $queryRaw: jest.fn() },
}));

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedQueryRaw = jest.mocked(prisma.$queryRaw);
const mockedIORedis = jest.mocked(IORedis);

const redisInstance = {
  connect: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
};

function request(url = "http://localhost/api/health") {
  return new Request(url);
}

function securityEvents(consoleSpy: jest.SpyInstance) {
  return consoleSpy.mock.calls
    .map((call) => JSON.parse(String(call[0])))
    .filter((record) => typeof record.event === "string");
}

describe("GET /api/health", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedIORedis.mockImplementation(() => redisInstance as unknown as IORedis);
    redisInstance.connect.mockResolvedValue(undefined);
    redisInstance.ping.mockResolvedValue("PONG");
    redisInstance.quit.mockResolvedValue(undefined);
    mockedQueryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      if (String(strings[0]).includes("_prisma_migrations")) {
        return [{ count: 0 }];
      }
      return [];
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("answers the liveness probe without touching dependencies", async () => {
    const response = await health(request("http://localhost/api/health?probe=live"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(mockedQueryRaw).not.toHaveBeenCalled();
    expect(mockedIORedis).not.toHaveBeenCalled();
  });

  it("reports healthy when db and redis respond and migrations are complete", async () => {
    const response = await health(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      db: true,
      redis: true,
      migrations: { failed: 0 },
      uptime: expect.any(Number),
    });
    expect(securityEvents(errorSpy)).toEqual([]);
  });

  it("emits readiness_failure and returns 503 when the database is down", async () => {
    mockedQueryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await health(request());

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "error", db: false, redis: true });
    expect(body.migrations).toEqual({ status: "unavailable" });
    const events = securityEvents(errorSpy);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "readiness_failure",
      level: "error",
      code: "db_unavailable",
      dependency: "db",
    });
  });

  it("emits readiness_failure and returns 503 when redis is down", async () => {
    redisInstance.ping.mockRejectedValue(new Error("ping timeout"));

    const response = await health(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "error", db: true, redis: false });
    const events = securityEvents(errorSpy);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "readiness_failure",
      level: "error",
      code: "redis_unavailable",
      dependency: "redis",
    });
  });

  it("emits migration_status without failing readiness when migrations are incomplete", async () => {
    mockedQueryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      if (String(strings[0]).includes("_prisma_migrations")) {
        return [{ count: 2 }];
      }
      return [];
    });

    const response = await health(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      db: true,
      redis: true,
      migrations: { failed: 2 },
    });
    const events = securityEvents(errorSpy);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "migration_status",
      level: "error",
      code: "failed_migrations",
      count: 2,
    });
  });

  it("reports migrations as unavailable when the migrations table is absent", async () => {
    mockedQueryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      if (String(strings[0]).includes("_prisma_migrations")) {
        throw new Error('relation "_prisma_migrations" does not exist');
      }
      return [];
    });

    const response = await health(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      migrations: { status: "unavailable" },
    });
    expect(securityEvents(errorSpy)).toEqual([]);
  });
});
