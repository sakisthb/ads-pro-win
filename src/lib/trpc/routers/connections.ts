// Connections tRPC Router — real ad-account & brand data for the Connections page
// Replaces the previous localStorage-based mock state with DB-backed status.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import { adAccountIsConnected, adAccountTokenExpired } from "@/lib/connection-status";
import { oauthReadiness } from "@/lib/oauth/platforms";
import { isGa4PropertyReady, listGa4Properties, ga4StoredAccountId, parseGa4PropertyId } from "@/lib/ga4";
import {
  gscStoredAccountId,
  isGscSiteReady,
  listGscSites,
  parseGscSiteUrl,
} from "@/lib/gsc";
import {
  googleAdsStoredAccountId,
  isGoogleAdsAccountReady,
  listGoogleAdsCustomers,
  parseGoogleAdsCustomerId,
} from "@/lib/google-ads-accounts";
import { ensureFreshGoogleAccessToken } from "@/lib/oauth/google-refresh";

// ============================================================================
// Router
// ============================================================================

export const connectionsRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // getBrands — all brands owned by the caller's organization.
  // Used by the brand selector on the Connections page and to resolve the
  // brandId required by the sync / WooCommerce-connect endpoints.
  // --------------------------------------------------------------------------
  getBrands: organizationProcedure.query(async ({ ctx }) => {
    const brands = await ctx.prisma.brand.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
      },
      orderBy: { name: "asc" },
    });

    return { brands };
  }),

  oauthReadiness: organizationProcedure.query(() => oauthReadiness()),

  // --------------------------------------------------------------------------
  // list — every AdAccount for the organization (optionally narrowed to one
  // brand) together with a derived "isConnected" flag. We intentionally select
  // `accessToken` so we can test for presence on the server, but never leak the
  // encrypted value to the client — only the boolean is returned.
  //
  // Connection rule:
  //   - OAuth platforms (meta / google / tiktok): accessToken non-null AND
  //     tokenExpiry in the future.
  //   - WooCommerce: stores long-lived API keys with no expiry, so a non-null
  //     accessToken alone means connected.
  // --------------------------------------------------------------------------
  list: organizationProcedure
    .input(z.object({ brandId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
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
          currency: true,
          isActive: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
          lastSyncAt: true,
        },
        orderBy: { platform: "asc" },
      });

      const recentJobs = accounts.length
        ? await ctx.prisma.syncJob.findMany({
            where: { adAccountId: { in: accounts.map((account) => account.id) } },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              adAccountId: true,
              platform: true,
              status: true,
              recordsProcessed: true,
              startedAt: true,
              completedAt: true,
              error: true,
              createdAt: true,
            },
          })
        : [];

      const connections = accounts.map((a) => {
        const isConnected = adAccountIsConnected(a);
        const tokenExpired = adAccountTokenExpired(a);
        const accountJobs = recentJobs.filter((job) => job.adAccountId === a.id);
        const latestJob = accountJobs[0] ?? null;
        const finishedJobs = accountJobs.filter(
          (job) => job.status === "completed" || job.status === "failed",
        );
        const successfulJobs = finishedJobs.filter((job) => job.status === "completed").length;
        // Only count failures newer than the last success so a completed sync
        // does not keep showing the previous createMany/timeout badges.
        const lastSuccessIndex = accountJobs.findIndex((job) => job.status === "completed");
        const unresolvedJobs =
          lastSuccessIndex === -1 ? accountJobs : accountJobs.slice(0, lastSuccessIndex);
        const errorCount = unresolvedJobs.filter((job) => job.status === "failed").length;

        return {
          id: a.id,
          brandId: a.brandId,
          platform: a.platform,
          accountId: a.accountId,
          name: a.name,
          currency: a.currency,
          isActive: a.isActive,
          isConnected,
          tokenExpired,
          tokenExpiry: a.tokenExpiry,
          lastSyncAt: a.lastSyncAt,
          latestJob: latestJob
            ? {
                id: latestJob.id,
                status: latestJob.status,
                recordsProcessed: latestJob.recordsProcessed,
                startedAt: latestJob.startedAt,
                completedAt: latestJob.completedAt,
                error: latestJob.error,
                createdAt: latestJob.createdAt,
              }
            : null,
          successRate:
            finishedJobs.length > 0 ? (successfulJobs / finishedJobs.length) * 100 : null,
          errorCount,
          needsGa4Property: a.platform === "google-analytics" && !isGa4PropertyReady(a.accountId),
          needsGscSite: a.platform === "google-search-console" && !isGscSiteReady(a.accountId),
          needsGoogleAdsAccount: a.platform === "google" && !isGoogleAdsAccountReady(a.accountId),
        };
      });

      return { connections, recentJobs };
    }),

  listGa4Properties: organizationAdminProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google-analytics",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accountId: true,
          name: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Google Analytics first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "analytics",
      );
      const properties = await listGa4Properties(accessToken);
      return {
        properties,
        selectedId: parseGa4PropertyId(account.accountId),
        accountName: account.name,
      };
    }),

  selectGa4Property: organizationAdminProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        propertyId: z.string().regex(/^\d+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === "demo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Switch out of the Demo workspace to change GA4 properties.",
        });
      }
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google-analytics",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Google Analytics first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "analytics",
      );
      const properties = await listGa4Properties(accessToken);
      const selected = properties.find((p) => p.id === input.propertyId);
      if (!selected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That GA4 property is not visible to this Google account.",
        });
      }
      await ctx.prisma.adAccount.update({
        where: { id: account.id },
        data: {
          accountId: ga4StoredAccountId(input.brandId, selected.id),
          name: selected.displayName,
          isActive: true,
        },
      });
      return { ok: true, name: selected.displayName, propertyId: selected.id };
    }),

  listGscSites: organizationAdminProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google-search-console",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accountId: true,
          name: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Search Console first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "analytics",
      );
      const sites = await listGscSites(accessToken);
      return {
        sites,
        selectedUrl: parseGscSiteUrl(account.accountId),
        accountName: account.name,
      };
    }),

  selectGscSite: organizationAdminProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        siteUrl: z
          .string()
          .min(8)
          .refine(
            (value) =>
              value.startsWith("http://") ||
              value.startsWith("https://") ||
              value.startsWith("sc-domain:"),
            "Invalid Search Console property",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === "demo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Switch out of the Demo workspace to change Search Console sites.",
        });
      }
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google-search-console",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Search Console first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "analytics",
      );
      const sites = await listGscSites(accessToken);
      const selected = sites.find((site) => site.siteUrl === input.siteUrl);
      if (!selected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That Search Console property is not visible to this Google account.",
        });
      }
      await ctx.prisma.adAccount.update({
        where: { id: account.id },
        data: {
          accountId: gscStoredAccountId(input.brandId, selected.siteUrl),
          name: selected.displayName,
          isActive: true,
        },
      });
      return { ok: true, name: selected.displayName, siteUrl: selected.siteUrl };
    }),

  listGoogleAdsCustomers: organizationAdminProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accountId: true,
          name: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Google Ads first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "ads",
      );
      const customers = await listGoogleAdsCustomers(accessToken);
      return {
        customers,
        selectedId: parseGoogleAdsCustomerId(account.accountId),
        accountName: account.name,
      };
    }),

  selectGoogleAdsCustomer: organizationAdminProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        customerId: z.string().regex(/^\d{6,}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === "demo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Switch out of the Demo workspace to change Google Ads accounts.",
        });
      }
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          brandId: input.brandId,
          platform: "google",
          brand: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiry: true,
        },
      });
      if (!account?.accessToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connect Google Ads first.",
        });
      }
      const accessToken = await ensureFreshGoogleAccessToken(
        {
          id: account.id,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiry: account.tokenExpiry,
        },
        "ads",
      );
      const customers = await listGoogleAdsCustomers(accessToken);
      const selected = customers.find((customer) => customer.id === input.customerId);
      if (!selected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That Google Ads account is not visible to this Google login.",
        });
      }
      await ctx.prisma.adAccount.update({
        where: { id: account.id },
        data: {
          accountId: googleAdsStoredAccountId(
            input.brandId,
            selected.id,
            selected.loginCustomerId,
          ),
          name: selected.descriptiveName,
          currency: selected.currencyCode || undefined,
          isActive: true,
        },
      });
      return { ok: true, name: selected.descriptiveName, customerId: selected.id };
    }),

  disconnect: organizationAdminProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        platform: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === "demo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Switch out of the Demo workspace to disconnect live accounts.",
        });
      }
      const account = await ctx.prisma.adAccount.findFirst({
        where: {
          platform: input.platform,
          brandId: input.brandId,
          brand: { organizationId: ctx.organizationId },
        },
        select: { id: true, name: true },
      });
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No connection found for this shop and platform.",
        });
      }
      await ctx.prisma.adAccount.update({
        where: { id: account.id },
        data: {
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
          isActive: false,
        },
      });
      return { ok: true, name: account.name };
    }),
});
