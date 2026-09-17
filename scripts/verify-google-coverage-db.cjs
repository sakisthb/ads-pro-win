"use strict";

// CI fixture executor only. Never load dotenv or use an operator database URL.
const assert = require("node:assert/strict");
const DISPOSABLE_URL = "postgresql://postgres:postgres@localhost:5432/adspro_test";
const CLIENT_ROLES = ["anon", "authenticated"];
const JOB_ID = "coverage-db-fixture";
const LEGACY_JOB_ID = "coverage-db-legacy-fixture";

function assertDisposableEnvironment(env) {
  if (env.CI !== "true" || env.GITHUB_ACTIONS !== "true"
      || env.DATABASE_URL !== DISPOSABLE_URL || env.DIRECT_DATABASE_URL !== DISPOSABLE_URL) {
    throw new Error("Refusing coverage verification outside the guarded disposable CI database");
  }
}

async function assertConnectedDatabase(tx) {
  const [identity] = await tx.$queryRawUnsafe('SELECT current_database()::text AS "database", current_user::text AS "user"');
  assert(identity?.database === "adspro_test" && identity?.user === "postgres", "Unexpected disposable database identity");
}

async function prepareCoverageRoles(client) {
  await client.$transaction(async (tx) => {
    await assertConnectedDatabase(tx);
    // Deliberately reproduce broad default grants BEFORE migration execution.
    for (const role of [...CLIENT_ROLES, "coverage_rls_probe", "coverage_rls_owner"]) {
      await tx.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`);
    }
    await tx.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO anon, authenticated, coverage_rls_probe, coverage_rls_owner");
    await tx.$executeRawUnsafe("GRANT CREATE ON SCHEMA public TO coverage_rls_owner");
    await tx.$executeRawUnsafe("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated");
  });
}

async function expectPermissionDenied(tx, role, sql) {
  assert([...CLIENT_ROLES, "coverage_rls_probe"].includes(role), "Unsupported coverage permission role");
  await tx.$executeRawUnsafe("SAVEPOINT coverage_permission_probe");
  await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
  let denied = false;
  try {
    await tx.$queryRawUnsafe(sql);
  } catch (error) {
    denied = error?.code === "P2010" && error?.meta?.code === "42501";
  }
  // Also undo any unexpectedly successful write and restore the previous role.
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT coverage_permission_probe");
  await tx.$executeRawUnsafe("RELEASE SAVEPOINT coverage_permission_probe");
  assert(denied, "Expected PostgreSQL permission denial, not success or another database failure");
}

async function receiptSecurity(tx) {
  const [security] = await tx.$queryRawUnsafe(`
    SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
           pg_get_userbyid(c.relowner)::text AS owner,
           (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
           (SELECT count(*)::int FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner)))
            WHERE grantee = 0) AS "publicGrants"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'SyncCoverageReceipt'
  `);
  assert(security?.rls && !security.forced && security.owner === "postgres", "Unexpected receipt RLS/owner configuration");
  assert(security.policies === 0 && security.publicGrants === 0, "Receipt table has client policies or PUBLIC privileges");
}

async function verifyCoverageDatabase(client) {
  const rollbackFixtures = new Error("coverage-fixtures-rollback");
  try {
    await client.$transaction(async (tx) => {
      await assertConnectedDatabase(tx);
      await receiptSecurity(tx);
      console.log("Coverage DB: checking restricted roles and revoked grants.");
      const roles = await tx.$queryRawUnsafe(`
        SELECT rolname::text AS rolname, rolsuper, rolbypassrls FROM pg_roles
        WHERE rolname IN ('anon', 'authenticated', 'coverage_rls_probe', 'coverage_rls_owner')
      `);
      assert(roles.length === 4 && roles.every((role) => !role.rolsuper && !role.rolbypassrls), "Missing/nonrestricted fixture roles");
      for (const role of CLIENT_ROLES) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
          const [grant] = await tx.$queryRawUnsafe('SELECT has_table_privilege($1::name, \'public."SyncCoverageReceipt"\', $2::text) AS allowed', role, privilege);
          assert(grant?.allowed === false, "Client role retained receipt table privileges");
        }
      }

      // Native Prisma CRUD, defaults, nullable unknown counts, and legacy relation.
      console.log("Coverage DB: checking Prisma defaults, CRUD and legacy relation.");
      for (const id of [JOB_ID, LEGACY_JOB_ID]) {
        await tx.syncJob.create({ data: { id, type: "metrics", platform: "google", status: "completed" } });
      }
      const receiptData = {
        customerId: "1111111111", startDate: "2026-01-01", endDate: "2026-01-02", executionPath: "manual",
      };
      const initial = await tx.syncCoverageReceipt.create({ data: { syncJobId: JOB_ID, ...receiptData } });
      assert(initial.version === 1 && initial.queryScope === "non_removed_campaigns", "Receipt defaults drifted");
      assert(initial.metricRowsFetched === null && initial.metricRowsPersisted === null, "Unknown counts became zero");
      assert(initial.startedAt instanceof Date && initial.completedAt === null, "Receipt timestamps drifted");
      await tx.syncCoverageReceipt.update({ where: { syncJobId: JOB_ID }, data: {
        status: "completed", stage: "completed", providerTimezone: "UTC", providerCurrency: "EUR",
        metricRowsFetched: 0, campaignRowsFetched: 1, metricRowsPersisted: 0, campaignRowsPersisted: 1,
        completedAt: new Date(),
      } });
      const withReceipt = await tx.syncJob.findUnique({ where: { id: JOB_ID }, include: { coverageReceipt: true } });
      const legacy = await tx.syncJob.findUnique({ where: { id: LEGACY_JOB_ID }, include: { coverageReceipt: true } });
      assert(withReceipt?.coverageReceipt?.campaignRowsPersisted === 1 && legacy?.coverageReceipt === null, "Receipt/legacy relation failed");

      const insertSql = `INSERT INTO "SyncCoverageReceipt" ("syncJobId", "customerId", "startDate", "endDate", "executionPath")
        VALUES ('${LEGACY_JOB_ID}', '1111111111', '2026-01-01', '2026-01-02', 'manual') RETURNING "syncJobId"`;
      console.log("Coverage DB: checking denied client CRUD.");
      for (const role of CLIENT_ROLES) {
        for (const sql of [
          'SELECT * FROM "SyncCoverageReceipt"', insertSql,
          'UPDATE "SyncCoverageReceipt" SET stage = \'client-probe\' RETURNING "syncJobId"',
          'DELETE FROM "SyncCoverageReceipt" RETURNING "syncJobId"',
        ]) await expectPermissionDenied(tx, role, sql);
      }

      // Independent RLS proof: temporarily grant CRUD to a nonsuperuser nonowner.
      console.log("Coverage DB: checking independent RLS filtering and insert rejection.");
      await tx.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON "SyncCoverageReceipt" TO coverage_rls_probe');
      await tx.$executeRawUnsafe("SET LOCAL ROLE coverage_rls_probe");
      assert((await tx.$queryRawUnsafe('SELECT * FROM "SyncCoverageReceipt"')).length === 0, "RLS exposed receipt rows");
      assert(await tx.$executeRawUnsafe('UPDATE "SyncCoverageReceipt" SET stage = \'rls-probe\'') === 0, "RLS allowed update");
      assert(await tx.$executeRawUnsafe('DELETE FROM "SyncCoverageReceipt"') === 0, "RLS allowed delete");
      await tx.$executeRawUnsafe("RESET ROLE");
      await expectPermissionDenied(tx, "coverage_rls_probe", insertSql);

      // Owner-access proof without SUPERUSER/BYPASSRLS, also rolled back below.
      console.log("Coverage DB: checking nonsuperuser owner access and cascade.");
      await tx.$executeRawUnsafe('ALTER TABLE "SyncCoverageReceipt" OWNER TO coverage_rls_owner');
      await tx.$executeRawUnsafe("SET LOCAL ROLE coverage_rls_owner");
      assert((await tx.syncCoverageReceipt.findUnique({ where: { syncJobId: JOB_ID } }))?.customerId === receiptData.customerId, "Trusted owner read failed");
      await tx.syncCoverageReceipt.update({ where: { syncJobId: JOB_ID }, data: { stage: "owner-probe" } });
      await tx.syncCoverageReceipt.create({ data: { syncJobId: LEGACY_JOB_ID, ...receiptData } });
      await tx.syncCoverageReceipt.delete({ where: { syncJobId: LEGACY_JOB_ID } });
      await tx.$executeRawUnsafe("RESET ROLE");

      await tx.syncJob.delete({ where: { id: JOB_ID } });
      assert(await tx.syncCoverageReceipt.findUnique({ where: { syncJobId: JOB_ID } }) === null, "Job delete did not cascade to receipt");
      throw rollbackFixtures;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollbackFixtures) throw error;
  }
  // Prove fixture/ownership/grant cleanup, not merely request a rollback.
  console.log("Coverage DB: checking fixture, grant and ownership rollback.");
  assert(await client.syncJob.count({ where: { id: { in: [JOB_ID, LEGACY_JOB_ID] } } }) === 0, "Fixture jobs survived rollback");
  assert(await client.syncCoverageReceipt.count({ where: { syncJobId: { in: [JOB_ID, LEGACY_JOB_ID] } } }) === 0, "Fixture receipts survived rollback");
  await receiptSecurity(client);
  const [probeGrant] = await client.$queryRawUnsafe('SELECT has_table_privilege(\'coverage_rls_probe\', \'public."SyncCoverageReceipt"\', \'SELECT\') AS allowed');
  assert(probeGrant?.allowed === false, "Temporary RLS probe grants survived rollback");
}

async function runCoverageDatabaseCheck(mode, env, createClient = () => {
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } }, log: [] });
}) {
  if (mode !== "prepare" && mode !== "verify") throw new Error("Unsupported coverage database check mode");
  assertDisposableEnvironment(env);
  const client = createClient();
  try {
    if (mode === "prepare") await prepareCoverageRoles(client);
    else await verifyCoverageDatabase(client);
  } finally {
    await client.$disconnect();
  }
}

module.exports = { runCoverageDatabaseCheck, expectPermissionDenied };

if (require.main === module) {
  runCoverageDatabaseCheck(process.argv[2], process.env)
    .then(() => console.log("Coverage receipt disposable database check passed."))
    .catch(() => {
      // Never print raw Prisma errors, database URLs, or environment values.
      console.error("Coverage receipt disposable database check failed.");
      process.exitCode = 1;
    });
}
