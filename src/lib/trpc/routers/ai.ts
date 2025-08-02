// AI Features tRPC Router - Complete AI API Integration
// Campaign Analysis, Creative Generation, Optimization, and Agent Management

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure, protectedProcedure } from "../server";
import { createRealTimeAIAgents, AGENT_TYPES, AI_PROVIDERS } from "@/lib/ai-agents-realtime";
import { createIntegratedAIAgents } from "@/lib/ai-agents-integrated";
import { aiDbService } from "@/lib/ai-database-service";

// Input validation schemas
const campaignAnalysisSchema = z.object({
  campaignId: z.string(),
  analysisType: z.enum(['comprehensive', 'performance', 'audience', 'budget']).optional().default('comprehensive'),
  provider: z.enum(['openai', 'anthropic', 'google']).optional().default('openai'),
  sessionId: z.string().optional(), // For WebSocket targeting
});

const creativeGenerationSchema = z.object({
  campaignId: z.string().optional(),
  platform: z.string(),
  audience: z.array(z.string()),
  goals: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  creativeType: z.enum(['text', 'image', 'video', 'carousel']).optional().default('text'),
  provider: z.enum(['openai', 'anthropic', 'google']).optional().default('openai'),
  sessionId: z.string().optional(), // For WebSocket targeting
});

const optimizationSchema = z.object({
  campaignId: z.string(),
  optimizationType: z.enum(['performance', 'budget', 'audience', 'creative']).optional().default('performance'),
  provider: z.enum(['openai', 'anthropic', 'google']).optional().default('openai'),
  sessionId: z.string().optional(), // For WebSocket targeting
});

const analyticsFilterSchema = z.object({
  timeframe: z.enum(['1d', '7d', '30d', '90d']).optional().default('7d'),
  campaignId: z.string().optional(),
  analysisType: z.string().optional(),
  confidenceMin: z.number().min(0).max(1).optional(),
});

export const aiRouter = createTRPCRouter({
  // Campaign Analysis Endpoints
  analyzeCampaign: organizationProcedure
    .input(campaignAnalysisSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Get campaign data
        const campaign = await ctx.prisma.campaign.findUnique({
          where: { 
            id: input.campaignId,
            organizationId: ctx.organizationId,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        // Create Real-Time AI agents instance
        const aiAgents = createRealTimeAIAgents(ctx.organizationId);

        // Prepare campaign data for analysis
        const campaignData = {
          id: campaign.id,
          name: campaign.name,
          platform: campaign.platform,
          status: campaign.status,
          budget: campaign.budget,
          budgetSpent: campaign.budgetSpent,
          performance: campaign.performance as Record<string, any>,
          targetAudience: campaign.targetAudience as Record<string, any>,
          adCreatives: campaign.adCreatives as any[],
          organizationId: campaign.organizationId,
        };

        // Real-time AI config
        const aiConfig = {
          provider: input.provider,
          organizationId: ctx.organizationId,
          campaignId: input.campaignId,
          sessionId: input.sessionId,
        };

        // Run appropriate analysis with real-time updates
        let result;
        switch (input.analysisType) {
          case 'comprehensive':
            result = await aiAgents.comprehensiveAnalysisRealTime(campaignData, aiConfig);
            break;
          case 'audience':
            result = await aiAgents.analyzeAudience(campaignData, aiConfig);
            break;
          case 'budget':
            result = await aiAgents.manageBudget(campaignData, aiConfig);
            break;
          default:
            result = await aiAgents.analyzeCampaignRealTime(campaignData, aiConfig);
        }

        return {
          success: true,
          result,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Campaign analysis error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze campaign",
          cause: error,
        });
      }
    }),

  // Creative Generation Endpoint
  generateCreative: organizationProcedure
    .input(creativeGenerationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate campaign if provided
        if (input.campaignId) {
          const campaign = await ctx.prisma.campaign.findUnique({
            where: { 
              id: input.campaignId,
              organizationId: ctx.organizationId,
            },
          });

          if (!campaign) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Campaign not found",
            });
          }
        }

        // Create Real-Time AI agents instance
        const aiAgents = createRealTimeAIAgents(ctx.organizationId);

        // Real-time AI config
        const aiConfig = {
          provider: input.provider,
          organizationId: ctx.organizationId,
          campaignId: input.campaignId,
          sessionId: input.sessionId,
        };

        // Generate creative with real-time updates
        const result = await aiAgents.generateCreativeRealTime(
          {
            campaignId: input.campaignId,
            platform: input.platform,
            audience: input.audience,
            goals: input.goals,
            constraints: input.constraints,
          },
          aiConfig
        );

        return {
          success: true,
          result,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Creative generation error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate creative",
          cause: error,
        });
      }
    }),

  // Campaign Optimization Endpoint
  optimizeCampaign: organizationProcedure
    .input(optimizationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Get campaign data
        const campaign = await ctx.prisma.campaign.findUnique({
          where: { 
            id: input.campaignId,
            organizationId: ctx.organizationId,
          },
        });

        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        // Create Real-Time AI agents instance
        const aiAgents = createRealTimeAIAgents(ctx.organizationId);

        // Prepare campaign data
        const campaignData = {
          id: campaign.id,
          name: campaign.name,
          platform: campaign.platform,
          status: campaign.status,
          budget: campaign.budget,
          budgetSpent: campaign.budgetSpent,
          performance: campaign.performance as Record<string, any>,
          targetAudience: campaign.targetAudience as Record<string, any>,
          adCreatives: campaign.adCreatives as any[],
          organizationId: campaign.organizationId,
        };

        // Real-time AI config
        const aiConfig = {
          provider: input.provider,
          organizationId: ctx.organizationId,
          campaignId: input.campaignId,
          sessionId: input.sessionId,
        };

        // Run optimization with real-time updates
        const result = await aiAgents.optimizePerformanceRealTime(campaignData, aiConfig);

        return {
          success: true,
          result,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Campaign optimization error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to optimize campaign",
          cause: error,
        });
      }
    }),

  // Analytics Dashboard Endpoint
  getAnalyticsDashboard: organizationProcedure
    .input(analyticsFilterSchema.optional())
    .query(async ({ ctx, input = {} }) => {
      try {
        const aiAgents = createIntegratedAIAgents(ctx.organizationId);
        const dashboard = await aiAgents.getAnalyticsDashboard(input.timeframe);

        return {
          success: true,
          data: dashboard,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Analytics dashboard error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load analytics dashboard",
          cause: error,
        });
      }
    }),

  // Get Campaign Analyses History
  getCampaignAnalyses: organizationProcedure
    .input(z.object({
      campaignId: z.string(),
      limit: z.number().min(1).max(100).optional().default(20),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const analyses = await aiDbService.searchAnalyses(ctx.organizationId, {
          campaignId: input.campaignId,
          type: input.type,
          limit: input.limit,
        });

        return {
          success: true,
          data: analyses,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get campaign analyses error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaign analyses",
          cause: error,
        });
      }
    }),

  // Get Organization AI Agents
  getAIAgents: organizationProcedure
    .input(z.object({
      type: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      try {
        const agents = await aiDbService.getAIAgentsByOrganization(
          ctx.organizationId,
          input.type
        );

        return {
          success: true,
          data: agents,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get AI agents error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load AI agents",
          cause: error,
        });
      }
    }),

  // Get AI Agent Performance
  getAgentPerformance: organizationProcedure
    .input(z.object({
      agentId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const agentHistory = await aiDbService.getAIAgentHistory(input.agentId);

        return {
          success: true,
          data: agentHistory,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get agent performance error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load agent performance",
          cause: error,
        });
      }
    }),

  // Search Analyses with Filters
  searchAnalyses: organizationProcedure
    .input(z.object({
      campaignId: z.string().optional(),
      type: z.string().optional(),
      confidenceMin: z.number().min(0).max(1).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const analyses = await aiDbService.searchAnalyses(ctx.organizationId, input);

        return {
          success: true,
          data: analyses,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Search analyses error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search analyses",
          cause: error,
        });
      }
    }),

  // Get Campaign with Full Context
  getCampaignWithAIContext: organizationProcedure
    .input(z.object({
      campaignId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const campaignWithContext = await aiDbService.getCampaignWithContext(input.campaignId);

        if (!campaignWithContext || campaignWithContext.organizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Campaign not found",
          });
        }

        return {
          success: true,
          data: campaignWithContext,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Get campaign with AI context error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load campaign with AI context",
          cause: error,
        });
      }
    }),

  // Bulk Campaign Analysis
  bulkAnalyzeCampaigns: organizationProcedure
    .input(z.object({
      campaignIds: z.array(z.string()).min(1).max(10),
      analysisType: z.enum(['comprehensive', 'performance', 'audience', 'budget']).optional().default('comprehensive'),
      provider: z.enum(['openai', 'anthropic', 'google']).optional().default('openai'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get campaigns
        const campaigns = await ctx.prisma.campaign.findMany({
          where: { 
            id: { in: input.campaignIds },
            organizationId: ctx.organizationId,
          },
        });

        if (campaigns.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No campaigns found",
          });
        }

        // Create AI agents instance
        const aiAgents = createIntegratedAIAgents(ctx.organizationId);

        // Analyze campaigns in parallel
        const results = await Promise.allSettled(
          campaigns.map(async (campaign) => {
            const campaignData = {
              id: campaign.id,
              name: campaign.name,
              platform: campaign.platform,
              status: campaign.status,
              budget: campaign.budget,
              budgetSpent: campaign.budgetSpent,
              performance: campaign.performance as Record<string, any>,
              targetAudience: campaign.targetAudience as Record<string, any>,
              adCreatives: campaign.adCreatives as any[],
              organizationId: campaign.organizationId,
            };

            if (input.analysisType === 'comprehensive') {
              return aiAgents.comprehensiveAnalysis(campaignData);
            } else {
              return aiAgents.analyzeCampaign(campaignData, {
                provider: input.provider,
                organizationId: ctx.organizationId,
                campaignId: campaign.id,
              });
            }
          })
        );

        // Process results
        const successful = results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value);

        const failed = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason);

        return {
          success: true,
          results: {
            successful: successful.length,
            failed: failed.length,
            data: successful,
            errors: failed,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Bulk campaign analysis error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze campaigns",
          cause: error,
        });
      }
    }),

  // AI Provider Status Check
  getAIProviderStatus: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        const providers = {
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          google: !!process.env.GOOGLE_API_KEY,
        };

        return {
          success: true,
          providers,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('AI provider status error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check AI provider status",
          cause: error,
        });
      }
    }),

  // Data Cleanup Utility
  cleanupOldAIData: organizationProcedure
    .input(z.object({
      daysToKeep: z.number().min(1).max(365).optional().default(90),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const deletedCounts = await aiDbService.cleanupOldData(input.daysToKeep);

        return {
          success: true,
          data: deletedCounts,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Cleanup old AI data error:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cleanup old AI data",
          cause: error,
        });
      }
    }),
});