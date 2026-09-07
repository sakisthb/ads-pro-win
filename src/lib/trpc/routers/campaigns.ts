// Campaigns tRPC Router - Campaign Management API
// CRUD operations and campaign-related functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import {
  generateLaunchPlan,
  getMetaGrantedPermissions,
  googleWriteConfigured,
  launchGoogleCampaign,
  launchMetaCampaign,
  launchTikTokCampaign,
  listMetaCustomAudiences,
  listMetaPages,
  listMetaPixels,
  mapPrismaPlatform,
  resolveLaunchAccount,
  scaleGoogleCampaignBudget,
  scaleMetaCampaignBudget,
  scaleTikTokCampaignBudget,
  updateGoogleCampaignStatus,
  updateMetaCampaignStatus,
  updateTikTokCampaignStatus,
  type LaunchPlatform,
  type LaunchSpec,
  type LiveStatus,
  type PlatformLaunchResult,
} from "@/lib/platform-launch";
import { contextForBrand, contextToPromptBlock, parseOrgSettings } from "@/lib/project-context";

// Input validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  platform: z.enum(['facebook', 'google', 'tiktok', 'instagram', 'linkedin']),
  budget: z.number().min(0),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  targetAudience: z.record(z.any()).optional().default({}),
  adCreatives: z.array(z.any()).optional().default([]),
  settings: z.record(z.any()).optional().default({}),
});

const updateCampaignSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  budget: z.number().min(0).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  targetAudience: z.record(z.any()).optional(),
  adCreatives: z.array(z.any()).optional(),
  performance: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

const campaignFiltersSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  platform: z.enum(['facebook', 'google', 'tiktok', 'instagram', 'linkedin']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

const launchPlatformSchema = z.enum(["meta", "google", "tiktok"]);
const launchObjectiveSchema = z.enum([
  "sales",
  "traffic",
  "awareness",
  "leads",
  "engagement",
]);

const launchInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  objective: launchObjectiveSchema,
  platforms: z.array(launchPlatformSchema).min(1),
  dailyBudget: z.number().min(1),
  goLive: z.boolean().default(false),
  brandId: z.string().optional(),
  accountIds: z.record(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  ageMin: z.number().optional(),
  ageMax: z.number().optional(),
  interests: z.array(z.string()).optional(),
  headline: z.string().min(1).max(80),
  primaryText: z.string().min(1).max(2000),
  cta: z.string().default("Shop Now"),
  landingUrl: z.string().url().optional().or(z.literal("")),
  pageId: z.string().optional(),
  pixelId: z.string().optional(),
  includeAd: z.boolean().default(true),
});

function assertNotDemoOrg(slug: string) {
  if (slug === "demo") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Switch out of the Demo workspace to create or edit live campaigns.",
    });
  }
}

function toLaunchSpec(input: z.infer<typeof launchInputSchema>): LaunchSpec {
  return {
    name: input.name.trim(),
    description: input.description,
    objective: input.objective,
    dailyBudget: input.dailyBudget,
    landingUrl: input.landingUrl || undefined,
    pageId: input.pageId,
    pixelId: input.pixelId,
    goLive: input.goLive,
    includeAd: input.includeAd,
    audience: {
      countries: input.countries ?? [],
      ageMin: input.ageMin ?? 18,
      ageMax: input.ageMax ?? 65,
      interests: input.interests ?? [],
    },
    creative: {
      headline: input.headline,
      primaryText: input.primaryText,
      cta: input.cta,
      landingUrl: input.landingUrl || undefined,
    },
  };
}

export const campaignsRouter = createTRPCRouter({
  // Create Campaign
  create: organizationAdminProcedure
    .input(createCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.prisma.campaign.create({
          data: {
            ...input,
            // Stringify JSON fields for Prisma
            targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience : JSON.stringify(input.targetAudience),
            settings: typeof input.settings === 'string' ? input.settings : JSON.stringify(input.settings),
            adCreatives: typeof input.adCreatives === 'string' ? input.adCreatives : JSON.stringify(input.adCreatives || []),
            organizationId: ctx.organizationId,
            userId: ctx.session.user.id,
            status: 'draft',
          },
        });

        return {
          success: true,
          data: campaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Create campaign error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create campaign",
          cause: error,
        });
      }
    }),

  // Update Campaign
  update: organizationAdminProcedure
    .input(updateCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...rawUpdateData } = input;
        
        // Stringify JSON fields for Prisma
        const updateData = {
          ...rawUpdateData,
          ...(rawUpdateData.targetAudience && {
            targetAudience: typeof rawUpdateData.targetAudience === 'string' 
              ? rawUpdateData.targetAudience 
              : JSON.stringify(rawUpdateData.targetAudience)
          }),
          ...(rawUpdateData.settings && {
            settings: typeof rawUpdateData.settings === 'string' 
              ? rawUpdateData.settings 
              : JSON.stringify(rawUpdateData.settings)
          }),
          ...(rawUpdateData.adCreatives && {
            adCreatives: typeof rawUpdateData.adCreatives === 'string' 
              ? rawUpdateData.adCreatives 
              : JSON.stringify(rawUpdateData.adCreatives)
          }),
          ...(rawUpdateData.performance && {
            performance: typeof rawUpdateData.performance === 'string' 
              ? rawUpdateData.performance 
              : JSON.stringify(rawUpdateData.performance)
          }),
        };

        // Verify campaign belongs to organization
        const existingCampaign = await ctx.prisma.campaign.findUnique({
          where: { id },
        });

        if (!existingCampaign || existingCampaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        const campaign = await ctx.prisma.campaign.update({
          where: { id },
          data: updateData as any,
        });

        return {
          success: true,
          data: campaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Update campaign error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update campaign",
          cause: error,
        });
      }
    }),

  // Get Campaign by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.prisma.campaign.findUnique({
          where: { id: input.id },
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
            aiAgents: true,
            analyses: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            predictions: {
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
            optimizations: {
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
          },
        });

        if (!campaign || campaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        return {
          success: true,
          data: campaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get campaign error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaign",
          cause: error,
        });
      }
    }),

  // Get All Campaigns with Filters
  getAll: organizationProcedure
    .input(campaignFiltersSchema.optional())
    .query(async ({ ctx, input = {} }) => {
      try {
        const where: any = {
          organizationId: ctx.organizationId,
        };

        if (input.status) where.status = input.status;
        if (input.platform) where.platform = input.platform;
        if (input.dateFrom || input.dateTo) {
          where.createdAt = {};
          if (input.dateFrom) where.createdAt.gte = input.dateFrom;
          if (input.dateTo) where.createdAt.lte = input.dateTo;
        }

        const [campaigns, total] = await Promise.all([
          ctx.prisma.campaign.findMany({
            where,
            include: {
              user: {
                select: { id: true, fullName: true },
              },
              _count: {
                select: {
                  analyses: true,
                  optimizations: true,
                  predictions: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.prisma.campaign.count({ where }),
        ]);

        return {
          success: true,
          data: {
            campaigns,
            pagination: {
              total,
              limit: input.limit || 20,
              offset: input.offset || 0,
              hasMore: (input.offset || 0) + (input.limit || 20) < total,
            },
          },
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get campaigns error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaigns",
          cause: error,
        });
      }
    }),

  // Delete Campaign
  delete: organizationAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify campaign belongs to organization
        const existingCampaign = await ctx.prisma.campaign.findUnique({
          where: { id: input.id },
        });

        if (!existingCampaign || existingCampaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        await ctx.prisma.campaign.delete({
          where: { id: input.id },
        });

        return {
          success: true,
          message: "Campaign deleted successfully",
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Delete campaign error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete campaign",
          cause: error,
        });
      }
    }),

  // Update Campaign Status
  updateStatus: organizationAdminProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['draft', 'active', 'paused', 'completed']),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify campaign belongs to organization
        const existingCampaign = await ctx.prisma.campaign.findUnique({
          where: { id: input.id },
        });

        if (!existingCampaign || existingCampaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        const campaign = await ctx.prisma.campaign.update({
          where: { id: input.id },
          data: { status: input.status },
        });

        return {
          success: true,
          data: campaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Update campaign status error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update campaign status",
          cause: error,
        });
      }
    }),

  // Update Campaign Performance
  updatePerformance: organizationAdminProcedure
    .input(z.object({
      id: z.string(),
      performance: z.record(z.any()),
      budgetSpent: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify campaign belongs to organization
        const existingCampaign = await ctx.prisma.campaign.findUnique({
          where: { id: input.id },
        });

        if (!existingCampaign || existingCampaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        const updateData: any = {
          performance: input.performance,
        };

        if (input.budgetSpent !== undefined) {
          updateData.budgetSpent = input.budgetSpent;
        }

        const campaign = await ctx.prisma.campaign.update({
          where: { id: input.id },
          data: updateData,
        });

        return {
          success: true,
          data: campaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Update campaign performance error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update campaign performance",
          cause: error,
        });
      }
    }),

  // Get Campaign Statistics
  getStatistics: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          totalCampaigns,
          activeCampaigns,
          completedCampaigns,
          draftCampaigns,
          totalBudget,
          totalSpent,
        ] = await Promise.all([
          ctx.prisma.campaign.count({
            where: { organizationId: ctx.organizationId },
          }),
          ctx.prisma.campaign.count({
            where: { organizationId: ctx.organizationId, status: 'active' },
          }),
          ctx.prisma.campaign.count({
            where: { organizationId: ctx.organizationId, status: 'completed' },
          }),
          ctx.prisma.campaign.count({
            where: { organizationId: ctx.organizationId, status: 'draft' },
          }),
          ctx.prisma.campaign.aggregate({
            where: { organizationId: ctx.organizationId },
            _sum: { budget: true },
          }),
          ctx.prisma.campaign.aggregate({
            where: { organizationId: ctx.organizationId },
            _sum: { budgetSpent: true },
          }),
        ]);

        // Platform distribution
        const platformStats = await ctx.prisma.campaign.groupBy({
          by: ['platform'],
          where: { organizationId: ctx.organizationId },
          _count: { platform: true },
        });

        return {
          success: true,
          data: {
            totals: {
              campaigns: totalCampaigns,
              active: activeCampaigns,
              completed: completedCampaigns,
              draft: draftCampaigns,
              budget: totalBudget._sum.budget || 0,
              spent: totalSpent._sum.budgetSpent || 0,
            },
            platforms: platformStats.map(stat => ({
              platform: stat.platform,
              count: stat._count.platform,
            })),
          },
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get campaign statistics error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaign statistics",
          cause: error,
        });
      }
    }),

  // Duplicate Campaign
  duplicate: organizationAdminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get original campaign
        const originalCampaign = await ctx.prisma.campaign.findUnique({
          where: { id: input.id },
        });

        if (!originalCampaign || originalCampaign.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        // Create duplicate campaign
        const { id, createdAt, updatedAt, ...campaignData } = originalCampaign;
        
        const duplicatedCampaign = await ctx.prisma.campaign.create({
          data: {
            ...campaignData,
            name: input.name,
            status: 'draft',
            budgetSpent: 0,
            performance: JSON.stringify({}),
            userId: ctx.session.user.id,
          } as any,
        });

        return {
          success: true,
          data: duplicatedCampaign,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Duplicate campaign error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to duplicate campaign",
          cause: error,
        });
      }
    }),

  getLaunchContext: organizationAdminProcedure.query(async ({ ctx }) => {
    const isDemo = ctx.organization.slug === "demo";
    const brands = await ctx.prisma.brand.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, website: true },
      orderBy: { name: "asc" },
    });
    const brandIds = brands.map((b) => b.id);
    const accounts = await ctx.prisma.adAccount.findMany({
      where: {
        brand: { organizationId: ctx.organizationId },
        platform: { in: ["meta", "google", "tiktok"] },
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
        tokenExpiry: true,
        lastSyncAt: true,
      },
    });
    const now = new Date();
    const connections = await Promise.all(
      accounts.map(async (a) => {
        const isOAuth = a.platform === "meta" || a.platform === "google" || a.platform === "tiktok";
        const isConnected = isOAuth
          ? !!a.accessToken && !!a.tokenExpiry && a.tokenExpiry > now
          : !!a.accessToken;
        let canWrite = false;
        let granted: string[] = [];
        if (isConnected && a.platform === "meta") {
          try {
            const resolved = await resolveLaunchAccount(
              ctx.prisma,
              ctx.organizationId,
              "meta",
              a.id,
            );
            if (resolved) {
              granted = await getMetaGrantedPermissions(resolved.accessToken);
              canWrite = granted.includes("ads_management");
            }
          } catch {
            canWrite = false;
          }
        } else if (isConnected && a.platform === "google") {
          canWrite = googleWriteConfigured();
        } else if (isConnected && a.platform === "tiktok") {
          canWrite = true;
        }
        return {
          id: a.id,
          brandId: a.brandId,
          platform: a.platform as LaunchPlatform,
          accountId: a.accountId,
          name: a.name,
          currency: a.currency,
          isActive: a.isActive,
          isConnected,
          canWrite,
          lastSyncAt: a.lastSyncAt,
          grantedPermissions: granted,
        };
      }),
    );

    const products = brandIds.length
      ? await ctx.prisma.wooProduct.findMany({
          where: { brandId: { in: brandIds } },
          select: { id: true, brandId: true, name: true, sku: true, price: true },
          orderBy: { updatedAt: "desc" },
          take: 24,
        })
      : [];

    const drafts = await ctx.prisma.campaign.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        budget: true,
        createdAt: true,
        settings: true,
      },
    });

    return {
      isDemo,
      brands,
      connections,
      projectContext: parseOrgSettings(ctx.organization.settings).projectContext ?? null,
      brandContexts: parseOrgSettings(ctx.organization.settings).brandContexts ?? {},
      products: products.map((p) => ({
        id: p.id,
        brandId: p.brandId,
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
      })),
      drafts,
    };
  }),

  getMetaAssets: organizationAdminProcedure
    .input(z.object({ adAccountId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const resolved = await resolveLaunchAccount(
        ctx.prisma,
        ctx.organizationId,
        "meta",
        input.adAccountId,
      );
      if (!resolved) {
        return { pages: [], pixels: [], audiences: [], permissions: [] as string[] };
      }
      const [pages, pixels, audiences, permissions] = await Promise.all([
        listMetaPages(resolved.accessToken),
        listMetaPixels(resolved.accessToken, resolved.account.accountId),
        listMetaCustomAudiences(resolved.accessToken, resolved.account.accountId),
        getMetaGrantedPermissions(resolved.accessToken),
      ]);
      return { pages, pixels, audiences, permissions };
    }),

  generatePlan: organizationAdminProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(2000),
        objective: launchObjectiveSchema,
        platforms: z.array(launchPlatformSchema).min(1),
        productName: z.string().optional(),
        website: z.string().optional(),
        dailyBudget: z.number().optional(),
        brandId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const settings = parseOrgSettings(ctx.organization.settings);
      const projectContext = contextToPromptBlock(
        contextForBrand(settings, input.brandId) ?? settings.projectContext,
      );
      return generateLaunchPlan({ ...input, projectContext: projectContext || undefined });
    }),

  launch: organizationAdminProcedure
    .input(launchInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertNotDemoOrg(ctx.organization.slug);
      const spec = toLaunchSpec(input);
      const results: PlatformLaunchResult[] = [];

      for (const platform of input.platforms) {
        const resolved = await resolveLaunchAccount(
          ctx.prisma,
          ctx.organizationId,
          platform,
          input.accountIds?.[platform],
          input.brandId,
        );
        if (!resolved) {
          results.push({
            platform,
            ok: false,
            message: `No connected ${platform} ad account. Connect it on Connections first.`,
            warnings: [],
          });
          continue;
        }
        if (platform === "meta") {
          results.push(
            await launchMetaCampaign(resolved.accessToken, resolved.account.accountId, spec),
          );
        } else if (platform === "google") {
          results.push(
            await launchGoogleCampaign(resolved.accessToken, resolved.account.accountId, spec),
          );
        } else {
          results.push(
            await launchTikTokCampaign(resolved.accessToken, resolved.account.accountId, spec),
          );
        }
      }

      const primary = results.find((r) => r.ok) ?? results[0];
      const anyOk = results.some((r) => r.ok);
      const campaign = await ctx.prisma.campaign.create({
        data: {
          name: input.name.trim(),
          description: input.description,
          platform: mapPrismaPlatform(primary?.platform ?? input.platforms[0]),
          budget: input.dailyBudget,
          status: anyOk ? (input.goLive ? "active" : "paused") : "draft",
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          targetAudience: JSON.stringify(spec.audience),
          adCreatives: JSON.stringify([spec.creative]),
          settings: JSON.stringify({
            source: "campaign-launcher",
            objective: input.objective,
            goLive: input.goLive,
            landingUrl: input.landingUrl,
            brandId: input.brandId,
            writeResults: results,
            platformCampaignId: primary?.campaignId,
            platformAdSetId: primary?.adSetId,
            platformAdId: primary?.adId,
            adsManagerUrl: primary?.adsManagerUrl,
            launchedAt: new Date().toISOString(),
          }),
        },
      });

      return {
        success: anyOk,
        campaign,
        results,
      };
    }),

  updateLiveStatus: organizationAdminProcedure
    .input(
      z.object({
        platform: launchPlatformSchema,
        platformCampaignId: z.string().min(1),
        status: z.enum(["PAUSED", "ACTIVE"]),
        adAccountId: z.string().optional(),
        brandId: z.string().optional(),
        localCampaignId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertNotDemoOrg(ctx.organization.slug);
      const resolved = await resolveLaunchAccount(
        ctx.prisma,
        ctx.organizationId,
        input.platform,
        input.adAccountId,
        input.brandId,
      );
      if (!resolved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Connect a ${input.platform} ad account first.`,
        });
      }

      let result;
      if (input.platform === "meta") {
        result = await updateMetaCampaignStatus(
          resolved.accessToken,
          input.platformCampaignId,
          input.status as LiveStatus,
        );
      } else if (input.platform === "google") {
        result = await updateGoogleCampaignStatus(
          resolved.accessToken,
          resolved.account.accountId,
          input.platformCampaignId,
          input.status as LiveStatus,
        );
      } else {
        result = await updateTikTokCampaignStatus(
          resolved.accessToken,
          resolved.account.accountId,
          input.platformCampaignId,
          input.status as LiveStatus,
        );
      }
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
      }

      if (input.localCampaignId) {
        await ctx.prisma.campaign.updateMany({
          where: { id: input.localCampaignId, organizationId: ctx.organizationId },
          data: { status: input.status === "ACTIVE" ? "active" : "paused" },
        });
      }

      return result;
    }),

  scaleBudget: organizationAdminProcedure
    .input(
      z.object({
        platform: launchPlatformSchema,
        platformCampaignId: z.string().min(1),
        multiplier: z.number().min(1.05).max(3).default(1.2),
        adAccountId: z.string().optional(),
        brandId: z.string().optional(),
        currentDailyBudget: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertNotDemoOrg(ctx.organization.slug);
      const resolved = await resolveLaunchAccount(
        ctx.prisma,
        ctx.organizationId,
        input.platform,
        input.adAccountId,
        input.brandId,
      );
      if (!resolved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Connect a ${input.platform} ad account first.`,
        });
      }

      let result;
      if (input.platform === "meta") {
        result = await scaleMetaCampaignBudget(
          resolved.accessToken,
          input.platformCampaignId,
          input.multiplier,
        );
      } else if (input.platform === "google") {
        result = await scaleGoogleCampaignBudget(
          resolved.accessToken,
          resolved.account.accountId,
          input.platformCampaignId,
          input.multiplier,
        );
      } else {
        const next = (input.currentDailyBudget ?? 50) * input.multiplier;
        result = await scaleTikTokCampaignBudget(
          resolved.accessToken,
          resolved.account.accountId,
          input.platformCampaignId,
          next,
        );
      }
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
      }
      return result;
    }),
});