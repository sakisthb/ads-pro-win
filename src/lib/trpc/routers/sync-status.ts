// Sync Status tRPC Router — read-only visibility into data-sync health.
//
// Returns the organization's ad accounts grouped by platform, each with its
// lastSyncAt and most recent SyncJob status, plus the recent SyncJob history
// (account-attached jobs and brand-level jobs such as WooCommerce
// orders/products runs). No mutations are performed.

import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../server";

// ----------------------------------------------------------------------------
// Input
// ----------------------------------------------------------------------------

const getStatusInputSchema = z
  .object({
    /** Narrow the results to a single brand (optional). */
    brandId: z.string().optional(),
    /** How many recent SyncJob rows to return per account (default 5). */
    jobsPerAccount: z.number().int().min(1).max(20).default(5),
  })
  .default({});

// ----------------------------------------------------------------------------
// Router
// ----------------------------------------------------------------------------

export const syncStatusRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // getStatus — recent SyncJobs for the org's brands/accounts, grouped by
  // platform, showing each account's lastSyncAt and job status. Read-only.
  // --------------------------------------------------------------------------
  getStatus: organizationProcedure
    .input(getStatusInputSchema)
    .query(async ({ input, ctx }) => {
      // 1. All ad accounts of the organization (optionally narrowed to one
      //    brand), ordered so that platform groups come out sorted.
      const accounts = await ctx.prisma.adAccount.findMany({
        where: {
          brand: {
            organizationId: ctx.organizationId,
            ...(input.brandId ? { id: input.brandId } : {}),
          },
        },
        select: {
          id: true,
          brandId: true,
          platform: true,
          accountId: true,
          name: true,
          isActive: true,
          lastSyncAt: true,
        },
        orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
      });

      // 2. Recent SyncJob rows for every account (single bounded query per
      //    account, executed in parallel).
      const jobsPerAccount = await Promise.all(
        accounts.map((account) =>
          ctx.prisma.syncJob.findMany({
            where: { adAccountId: account.id },
            orderBy: { createdAt: "desc" },
            take: input.jobsPerAccount,
            select: {
              id: true,
              adAccountId: true,
              brandId: true,
              type: true,
              platform: true,
              status: true,
              startedAt: true,
              completedAt: true,
              error: true,
              recordsProcessed: true,
              createdAt: true,
            },
          }),
        ),
      );

      // 3. Brand-level SyncJob rows (no adAccountId — e.g. the WooCommerce
      //    orders/products worker runs), used to build per-platform history
      //    for syncs that are not tied to a specific ad account.
      const brandIds = Array.from(new Set(accounts.map((a) => a.brandId)));
      const brandLevelJobs = brandIds.length
        ? await ctx.prisma.syncJob.findMany({
            where: {
              brandId: { in: brandIds },
              adAccountId: null,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              adAccountId: true,
              brandId: true,
              type: true,
              platform: true,
              status: true,
              startedAt: true,
              completedAt: true,
              error: true,
              recordsProcessed: true,
              createdAt: true,
            },
          })
        : [];

      // 4. Group accounts (and their jobs) by platform.
      const byPlatform = new Map<
        string,
        {
          platform: string;
          lastSyncAt: Date | null;
          accounts: Array<{
            id: string;
            brandId: string;
            name: string;
            accountId: string;
            isActive: boolean;
            lastSyncAt: Date | null;
            lastJobStatus: string | null;
            lastJobAt: Date | null;
            recentJobs: typeof jobsPerAccount[number];
          }>;
          brandJobs: typeof brandLevelJobs;
        }
      >();

      accounts.forEach((account, index) => {
        const recentJobs = jobsPerAccount[index] ?? [];
        const lastJob = recentJobs[0] ?? null;

        let group = byPlatform.get(account.platform);
        if (!group) {
          group = {
            platform: account.platform,
            lastSyncAt: account.lastSyncAt,
            accounts: [],
            brandJobs: brandLevelJobs.filter((j) => j.platform === account.platform),
          };
          byPlatform.set(account.platform, group);
        }

        // Track the most recent lastSyncAt across the platform's accounts.
        if (
          account.lastSyncAt &&
          (!group.lastSyncAt || account.lastSyncAt > group.lastSyncAt)
        ) {
          group.lastSyncAt = account.lastSyncAt;
        }

        group.accounts.push({
          id: account.id,
          brandId: account.brandId,
          name: account.name,
          accountId: account.accountId,
          isActive: account.isActive,
          lastSyncAt: account.lastSyncAt,
          lastJobStatus: lastJob?.status ?? null,
          lastJobAt: lastJob?.createdAt ?? null,
          recentJobs,
        });
      });

      return { platforms: Array.from(byPlatform.values()) };
    }),
});
