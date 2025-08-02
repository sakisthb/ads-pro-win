// Campaigns tRPC Router - Campaign Management API
// CRUD operations and campaign-related functionality

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure, protectedProcedure } from "../server";

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

export const campaignsRouter = createTRPCRouter({
  // Create Campaign
  create: organizationProcedure
    .input(createCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const campaign = await ctx.prisma.campaign.create({
          data: {
            ...input,
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
  update: organizationProcedure
    .input(updateCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...updateData } = input;

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
          data: updateData,
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
  delete: organizationProcedure
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
  updateStatus: organizationProcedure
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
  updatePerformance: organizationProcedure
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
  duplicate: organizationProcedure
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
            performance: {},
            userId: ctx.session.user.id,
          },
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
});