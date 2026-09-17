/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runCoverageDatabaseCheck, expectPermissionDenied } = require("../../../scripts/verify-google-coverage-db.cjs") as {
  runCoverageDatabaseCheck: (mode: string, env: Record<string, string | undefined>, createClient: () => unknown) => Promise<void>;
  expectPermissionDenied: (tx: unknown, role: string, sql: string) => Promise<void>;
};

const disposableEnv = {
  CI: "true", GITHUB_ACTIONS: "true",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/adspro_test",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/adspro_test",
};

describe("CI-only Google coverage database verification", () => {
  it.each([
    { CI: "false" }, { GITHUB_ACTIONS: "false" }, { DATABASE_URL: undefined },
    { DIRECT_DATABASE_URL: undefined }, { DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/adspro_test" },
    { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/production" },
    { DATABASE_URL: `${disposableEnv.DATABASE_URL}?schema=public` },
    { DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/production" },
  ])("refuses unsafe environment before constructing any database client (%j)", async (override) => {
    const createClient = jest.fn();
    await expect(runCoverageDatabaseCheck("verify", { ...disposableEnv, ...override }, createClient)).rejects.toThrow("disposable");
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["", "migrate", "production"])("rejects unsupported mode %s before database access", async (mode) => {
    const createClient = jest.fn();
    await expect(runCoverageDatabaseCheck(mode, disposableEnv, createClient)).rejects.toThrow("mode");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("prepares client roles and default grants only in the guarded disposable database", async () => {
    const execute = jest.fn().mockResolvedValue(0);
    const client = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) => callback({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ database: "adspro_test", user: "postgres" }]),
        $executeRawUnsafe: execute,
      })),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    await runCoverageDatabaseCheck("prepare", disposableEnv, () => client);
    const sql = execute.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("CREATE ROLE anon");
    expect(sql).toContain("CREATE ROLE authenticated");
    expect(sql).toContain("NOSUPERUSER NOBYPASSRLS");
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated");
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("rejects an unexpected connected database before creating roles", async () => {
    const execute = jest.fn();
    const client = {
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) => callback({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ database: "production", user: "postgres" }]),
        $executeRawUnsafe: execute,
      })),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    await expect(runCoverageDatabaseCheck("prepare", disposableEnv, () => client)).rejects.toThrow("disposable");
    expect(execute).not.toHaveBeenCalled();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("accepts only a PostgreSQL permission denial and recovers the transaction with a savepoint", async () => {
    const execute = jest.fn().mockResolvedValue(0);
    const tx = { $executeRawUnsafe: execute, $queryRawUnsafe: jest.fn().mockRejectedValue({ code: "P2010", meta: { code: "42501" } }) };
    await expectPermissionDenied(tx, "anon", 'SELECT * FROM "SyncCoverageReceipt"');
    expect(execute.mock.calls.map(([statement]) => statement)).toEqual([
      "SAVEPOINT coverage_permission_probe", "SET LOCAL ROLE anon",
      "ROLLBACK TO SAVEPOINT coverage_permission_probe", "RELEASE SAVEPOINT coverage_permission_probe",
    ]);
  });

  it.each([
    { code: "P2010", meta: { code: "42P01" } },
    { code: "P1001" },
  ])("does not mistake another database failure for denied access (%j)", async (error) => {
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(0), $queryRawUnsafe: jest.fn().mockRejectedValue(error) };
    await expect(expectPermissionDenied(tx, "authenticated", 'SELECT * FROM "SyncCoverageReceipt"')).rejects.toThrow("permission denial");
  });

  it("fails when a supposedly denied query succeeds", async () => {
    const tx = { $executeRawUnsafe: jest.fn().mockResolvedValue(0), $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    await expect(expectPermissionDenied(tx, "anon", 'SELECT * FROM "SyncCoverageReceipt"')).rejects.toThrow("permission denial");
  });

  it("places role preparation before migrations and runtime verification after drift validation in CI", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const migrationJob = workflow.split("  migration-validate:")[1].split("  build-production:")[0];
    const prepare = migrationJob.indexOf("node scripts/verify-google-coverage-db.cjs prepare");
    const migrate = migrationJob.indexOf("run: npx prisma migrate deploy");
    const drift = migrationJob.indexOf("--exit-code");
    const verify = migrationJob.indexOf("node scripts/verify-google-coverage-db.cjs verify");
    expect(prepare).toBeGreaterThan(-1);
    expect(prepare).toBeLessThan(migrate);
    expect(verify).toBeGreaterThan(drift);
  });

  it("migrates and verifies the same disposable database used by the smoke container", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const smokeMigration = workflow.split("      - name: Apply migrations to smoke database")[1].split("      - name: Build application image")[0];
    expect(smokeMigration).toContain("DATABASE_URL: ${{ env.SMOKE_DATABASE_URL }}");
    expect(smokeMigration).toContain("DIRECT_DATABASE_URL: ${{ env.SMOKE_DATABASE_URL }}");
    expect(smokeMigration.indexOf("npx prisma migrate status")).toBeGreaterThan(smokeMigration.indexOf("npx prisma migrate deploy"));
  });
});
