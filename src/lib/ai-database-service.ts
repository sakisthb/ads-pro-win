// AI Database Service - Connect AI Agents to Prisma Database
// Integrated AI agent operations with persistent storage

import { prisma } from "./db";
import { Prisma } from "@prisma/client";

export interface AIAgentResult {
  agentType: string;
  result: string;
  confidence: number;
  suggestions: string[];
  metadata?: Record<string, any>;
  processingTime?: number;
  prompt?: string;
}

export interface CampaignAnalysisResult {
  campaignId: string;
  analysisType: string;
  insights: string[];
  recommendations: string[];
  performanceScore: number;
  confidence: number;
  generatedAt: Date;
}

export interface CreativeGenerationResult {
  campaignId?: string;
  creativeType: 'image' | 'video' | 'text' | 'carousel';
  content: {
    title: string;
    description: string;
    cta?: string;
    targetAudience?: string[];
  };
  variants: any[];
  confidence: number;
}

export interface OptimizationResult {
  campaignId: string;
  optimizationType: string;
  currentMetrics: Record<string, number>;
  recommendations: {
    action: string;
    expectedImpact: string;
    confidence: number;
    implementation: string;
  }[];
  projectedMetrics: Record<string, number>;
}

export class AIAgentDatabaseService {
  
  // Create AI Agent in database
  async createAIAgent(data: {
    name: string;
    type: string;
    organizationId: string;
    campaignId?: string;
    configuration?: Record<string, any>;
  }) {
    try {
      const agent = await prisma.aIAgent.create({
        data: {
          name: data.name,
          type: data.type,
          organizationId: data.organizationId,
          campaignId: data.campaignId,
          configuration: data.configuration || {},
          status: 'active',
          performance: {},
        },
      });
      return agent;
    } catch (error) {
      console.error('Error creating AI agent:', error);
      throw error;
    }
  }

  // Get AI Agents by organization
  async getAIAgentsByOrganization(organizationId: string, type?: string) {
    try {
      const where: Prisma.AIAgentWhereInput = {
        organizationId,
        status: 'active',
      };
      
      if (type) {
        where.type = type;
      }

      const agents = await prisma.aIAgent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return agents;
    } catch (error) {
      console.error('Error fetching AI agents:', error);
      throw error;
    }
  }

  // Store campaign analysis result
  async storeCampaignAnalysis(data: CampaignAnalysisResult) {
    try {
      const analysis = await prisma.analysis.create({
        data: {
          type: data.analysisType,
          result: {
            insights: data.insights,
            recommendations: data.recommendations,
            performanceScore: data.performanceScore,
            confidence: data.confidence,
            generatedAt: data.generatedAt,
          },
          confidence: data.confidence,
          campaignId: data.campaignId,
          organizationId: await this.getOrganizationIdFromCampaign(data.campaignId),
        },
      });
      return analysis;
    } catch (error) {
      console.error('Error storing campaign analysis:', error);
      throw error;
    }
  }

  // Store optimization result
  async storeOptimizationResult(data: OptimizationResult) {
    try {
      const optimization = await prisma.optimization.create({
        data: {
          type: data.optimizationType,
          result: {
            currentMetrics: data.currentMetrics,
            recommendations: data.recommendations,
            projectedMetrics: data.projectedMetrics,
          },
          status: 'pending',
          campaignId: data.campaignId,
          organizationId: await this.getOrganizationIdFromCampaign(data.campaignId),
        },
      });
      return optimization;
    } catch (error) {
      console.error('Error storing optimization result:', error);
      throw error;
    }
  }

  // Store prediction result
  async storePredictionResult(data: {
    campaignId: string;
    predictionType: string;
    result: Record<string, any>;
    confidence: number;
    timeframe: string;
  }) {
    try {
      const prediction = await prisma.prediction.create({
        data: {
          type: data.predictionType,
          result: data.result,
          confidence: data.confidence,
          timeframe: data.timeframe,
          campaignId: data.campaignId,
          organizationId: await this.getOrganizationIdFromCampaign(data.campaignId),
        },
      });
      return prediction;
    } catch (error) {
      console.error('Error storing prediction result:', error);
      throw error;
    }
  }

  // Get campaign data with full context
  async getCampaignWithContext(campaignId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          organization: true,
          user: true,
          aiAgents: true,
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          predictions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          optimizations: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
      return campaign;
    } catch (error) {
      console.error('Error fetching campaign with context:', error);
      throw error;
    }
  }

  // Get organization campaigns for analysis
  async getOrganizationCampaigns(organizationId: string, status?: string) {
    try {
      const where: Prisma.CampaignWhereInput = {
        organizationId,
      };
      
      if (status) {
        where.status = status;
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        include: {
          aiAgents: true,
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 3,
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
        orderBy: { createdAt: 'desc' },
      });
      return campaigns;
    } catch (error) {
      console.error('Error fetching organization campaigns:', error);
      throw error;
    }
  }

  // Update AI agent performance metrics
  async updateAIAgentPerformance(
    agentId: string, 
    performanceData: Record<string, any>
  ) {
    try {
      const agent = await prisma.aIAgent.update({
        where: { id: agentId },
        data: {
          performance: performanceData,
          lastRunAt: new Date(),
        },
      });
      return agent;
    } catch (error) {
      console.error('Error updating AI agent performance:', error);
      throw error;
    }
  }

  // Get AI agent execution history
  async getAIAgentHistory(agentId: string, limit = 50) {
    try {
      const agent = await prisma.aIAgent.findUnique({
        where: { id: agentId },
        include: {
          campaign: {
            include: {
              analyses: {
                where: {
                  // Filter analyses that might be related to this agent
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
              },
              optimizations: {
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
              },
              predictions: {
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
              },
            },
          },
        },
      });
      return agent;
    } catch (error) {
      console.error('Error fetching AI agent history:', error);
      throw error;
    }
  }

  // Bulk operations for performance
  async bulkStoreAnalyses(analyses: CampaignAnalysisResult[]) {
    try {
      const dataToInsert = await Promise.all(
        analyses.map(async (analysis) => ({
          type: analysis.analysisType,
          result: {
            insights: analysis.insights,
            recommendations: analysis.recommendations,
            performanceScore: analysis.performanceScore,
            confidence: analysis.confidence,
            generatedAt: analysis.generatedAt,
          },
          confidence: analysis.confidence,
          campaignId: analysis.campaignId,
          organizationId: await this.getOrganizationIdFromCampaign(analysis.campaignId),
        }))
      );

      const result = await prisma.analysis.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
      return result;
    } catch (error) {
      console.error('Error bulk storing analyses:', error);
      throw error;
    }
  }

  // Get analytics and insights dashboard data
  async getAnalyticsDashboardData(organizationId: string, timeframe = '7d') {
    try {
      const daysBack = timeframe === '30d' ? 30 : timeframe === '7d' ? 7 : 1;
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const [campaigns, analyses, optimizations, predictions] = await Promise.all([
        // Active campaigns
        prisma.campaign.findMany({
          where: {
            organizationId,
            status: 'active',
          },
          select: {
            id: true,
            name: true,
            platform: true,
            budget: true,
            budgetSpent: true,
            performance: true,
            createdAt: true,
          },
        }),

        // Recent analyses
        prisma.analysis.findMany({
          where: {
            organizationId,
            createdAt: { gte: startDate },
          },
          include: {
            campaign: {
              select: { name: true, platform: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),

        // Recent optimizations
        prisma.optimization.findMany({
          where: {
            organizationId,
            createdAt: { gte: startDate },
          },
          include: {
            campaign: {
              select: { name: true, platform: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),

        // Recent predictions
        prisma.prediction.findMany({
          where: {
            organizationId,
            createdAt: { gte: startDate },
          },
          include: {
            campaign: {
              select: { name: true, platform: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return {
        campaigns,
        analyses,
        optimizations,
        predictions,
        summary: {
          totalCampaigns: campaigns.length,
          totalAnalyses: analyses.length,
          totalOptimizations: optimizations.length,
          totalPredictions: predictions.length,
          avgConfidence: analyses.reduce((acc, a) => acc + a.confidence, 0) / analyses.length || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching analytics dashboard data:', error);
      throw error;
    }
  }

  // Helper function to get organization ID from campaign
  private async getOrganizationIdFromCampaign(campaignId: string): Promise<string> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { organizationId: true },
    });
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    
    return campaign.organizationId;
  }

  // Search and filter functions
  async searchAnalyses(organizationId: string, filters: {
    campaignId?: string;
    type?: string;
    confidenceMin?: number;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  } = {}) {
    try {
      const where: Prisma.AnalysisWhereInput = {
        organizationId,
      };

      if (filters.campaignId) where.campaignId = filters.campaignId;
      if (filters.type) where.type = filters.type;
      if (filters.confidenceMin) where.confidence = { gte: filters.confidenceMin };
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
      }

      const analyses = await prisma.analysis.findMany({
        where,
        include: {
          campaign: {
            select: { name: true, platform: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
      });

      return analyses;
    } catch (error) {
      console.error('Error searching analyses:', error);
      throw error;
    }
  }

  // Clean up old data
  async cleanupOldData(daysToKeep = 90) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const deletedCounts = await Promise.all([
        prisma.analysis.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        }),
        prisma.prediction.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        }),
        prisma.optimization.deleteMany({
          where: { 
            createdAt: { lt: cutoffDate },
            status: 'completed',
          },
        }),
      ]);

      return {
        deletedAnalyses: deletedCounts[0].count,
        deletedPredictions: deletedCounts[1].count,
        deletedOptimizations: deletedCounts[2].count,
      };
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiDbService = new AIAgentDatabaseService();

// Export types for use in other files
export type {
  AIAgentResult,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
};