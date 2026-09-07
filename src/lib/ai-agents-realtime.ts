// Real-Time AI Agents with WebSocket Integration
// Enhanced AI agents that send live progress updates

import { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  aiDbService,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
} from "./ai-database-service";
import { getWebSocketServer, AIProgressData } from "./websocket/websocket-server";
import {
  AI_PROVIDERS,
  AGENT_TYPES,
  createModelRegistry,
  getModel,
  parseAIResponse,
  updateAgentPerformance,
  type AIProvider,
  type AgentType,
  type CampaignData,
  type AIAgentConfig,
} from "./ai/agent-base";

interface RealTimeAIAgentConfig extends AIAgentConfig {
  sessionId?: string; // For targeted WebSocket updates
}

export class RealTimeAIAgents {
  private models: Map<AIProvider, BaseLanguageModel> = createModelRegistry();
  private organizationId: string;
  private wsServer = getWebSocketServer();

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  private getModel(provider: AIProvider): BaseLanguageModel {
    return getModel(this.models, provider);
  }

  private sendProgress(data: AIProgressData, config: RealTimeAIAgentConfig) {
    this.wsServer?.broadcastAIProgress(
      data,
      config.organizationId,
      config.sessionId
    );
  }

  private sendComplete(result: any, config: RealTimeAIAgentConfig) {
    this.wsServer?.broadcastAIComplete(
      result,
      config.organizationId,
      config.sessionId
    );
  }

  private sendError(error: unknown, config: RealTimeAIAgentConfig) {
    this.wsServer?.broadcastAIError(
      error,
      config.organizationId,
      config.sessionId
    );
  }

  // Enhanced Campaign Analysis with Real-Time Updates
  async analyzeCampaignRealTime(
    campaignData: CampaignData,
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId
    }
  ): Promise<CampaignAnalysisResult> {
    const startTime = Date.now();

    try {
      // Send initial progress
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 0,
        stage: 'initializing',
        message: 'Starting campaign analysis...',
      }, config);

      const model = this.getModel(config.provider);

      // Send progress: preparing data
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 10,
        stage: 'preparing',
        message: 'Preparing campaign data for analysis...',
      }, config);

      const prompt = `
      As a Campaign Analysis AI Agent, analyze the following campaign data and provide detailed insights:

      Campaign: ${campaignData.name}
      Platform: ${campaignData.platform}
      Budget: $${campaignData.budget} (Spent: $${campaignData.budgetSpent})
      Status: ${campaignData.status}
      Performance: ${JSON.stringify(campaignData.performance, null, 2)}
      Target Audience: ${JSON.stringify(campaignData.targetAudience, null, 2)}

      Provide analysis in the following JSON format:
      {
        "insights": ["insight1", "insight2", "insight3"],
        "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
        "performanceScore": 0.85,
        "confidence": 0.92,
        "keyFindings": ["finding1", "finding2"],
        "actionItems": ["action1", "action2"]
      }

      Focus on:
      - Performance metrics analysis
      - Budget efficiency
      - Audience targeting effectiveness
      - Creative performance
      - Optimization opportunities
      `;

      // Send progress: analyzing with AI
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 30,
        stage: 'analyzing',
        message: 'AI is analyzing campaign performance...',
      }, config);

      const response = await model.invoke(prompt);

      // Send progress: processing results
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 70,
        stage: 'processing',
        message: 'Processing analysis results...',
      }, config);

      const analysis = parseAIResponse(response.content as string);

      const result: CampaignAnalysisResult = {
        campaignId: campaignData.id,
        analysisType: 'comprehensive_analysis',
        insights: (analysis as any).insights || [],
        recommendations: (analysis as any).recommendations || [],
        performanceScore: (analysis as any).performanceScore || 0,
        confidence: (analysis as any).confidence || 0,
        generatedAt: new Date(),
      };

      // Send progress: saving to database
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 90,
        stage: 'saving',
        message: 'Saving analysis to database...',
        confidence: result.confidence,
      }, config);

      // Store in database
      await aiDbService.storeCampaignAnalysis(result);

      // Update AI agent performance
      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.CAMPAIGN_ANALYST, {
        lastAnalysis: new Date(),
        processingTime,
        confidence: result.confidence,
        campaignsAnalyzed: 1,
      });

      // Send completion
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 100,
        stage: 'completed',
        message: 'Campaign analysis completed successfully!',
        confidence: result.confidence,
      }, config);

      this.sendComplete(result, config);

      return result;
    } catch (error) {
      console.error('Real-time campaign analysis error:', error);
      this.sendError(error, config);
      throw error;
    }
  }

  // Enhanced Creative Generation with Real-Time Updates
  async generateCreativeRealTime(
    briefData: {
      campaignId?: string;
      platform: string;
      audience: string[];
      goals: string[];
      constraints?: string[];
    },
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId
    }
  ): Promise<CreativeGenerationResult> {
    const startTime = Date.now();

    try {
      // Send initial progress
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 0,
        stage: 'initializing',
        message: 'Starting creative generation...',
      }, config);

      const model = this.getModel(config.provider);

      // Send progress: analyzing brief
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 15,
        stage: 'analyzing',
        message: 'Analyzing creative brief and requirements...',
      }, config);

      const prompt = `
      As a Creative Generation AI Agent, create compelling ad creative based on:

      Platform: ${briefData.platform}
      Target Audience: ${briefData.audience.join(', ')}
      Campaign Goals: ${briefData.goals.join(', ')}
      Constraints: ${briefData.constraints?.join(', ') || 'None'}

      Generate creative in this JSON format:
      {
        "content": {
          "title": "Compelling headline",
          "description": "Engaging description",
          "cta": "Strong call-to-action",
          "targetAudience": ["audience1", "audience2"]
        },
        "variants": [
          {
            "title": "Alternative headline 1",
            "description": "Alternative description 1",
            "cta": "Alternative CTA 1"
          },
          {
            "title": "Alternative headline 2",
            "description": "Alternative description 2",
            "cta": "Alternative CTA 2"
          }
        ],
        "confidence": 0.88,
        "rationale": "Explanation of creative decisions"
      }

      Optimize for:
      - Platform-specific best practices
      - Audience engagement
      - Goal achievement
      - Brand consistency
      `;

      // Send progress: generating creative
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 40,
        stage: 'generating',
        message: 'AI is generating creative content...',
      }, config);

      const response = await model.invoke(prompt);

      // Send progress: creating variants
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 70,
        stage: 'variants',
        message: 'Creating creative variants...',
      }, config);

      const creative = parseAIResponse(response.content as string);

      const result: CreativeGenerationResult = {
        campaignId: briefData.campaignId,
        creativeType: 'text',
        content: (creative as any).content || {
          title: "Generated Creative",
          description: "AI-generated creative content",
          targetAudience: briefData.audience,
        },
        variants: (creative as any).variants || [],
        confidence: (creative as any).confidence || 0,
      };

      // Send progress: saving results
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 90,
        stage: 'saving',
        message: 'Saving creative to database...',
        confidence: result.confidence,
      }, config);

      // Store in database as analysis
      if (briefData.campaignId) {
        await aiDbService.storeCampaignAnalysis({
          campaignId: briefData.campaignId,
          analysisType: 'creative_generation',
          insights: [(creative as any).rationale || 'Creative generated'],
          recommendations: [`Use generated creative: ${result.content.title}`],
          performanceScore: result.confidence,
          confidence: result.confidence,
          generatedAt: new Date(),
        });
      }

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.CREATIVE_SPECIALIST, {
        lastGeneration: new Date(),
        processingTime,
        confidence: result.confidence,
        creativesGenerated: 1,
      });

      // Send completion
      this.sendProgress({
        operationType: 'generation',
        campaignId: briefData.campaignId,
        progress: 100,
        stage: 'completed',
        message: 'Creative generation completed successfully!',
        confidence: result.confidence,
      }, config);

      this.sendComplete(result, config);

      return result;
    } catch (error) {
      console.error('Real-time creative generation error:', error);
      this.sendError(error, config);
      throw error;
    }
  }

  // Enhanced Optimization with Real-Time Updates
  async optimizePerformanceRealTime(
    campaignData: CampaignData,
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId
    }
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      // Send initial progress
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 0,
        stage: 'initializing',
        message: 'Starting performance optimization...',
      }, config);

      const model = this.getModel(config.provider);
      const currentMetrics = campaignData.performance as Record<string, number>;

      // Send progress: analyzing current performance
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 20,
        stage: 'analyzing',
        message: 'Analyzing current campaign performance...',
      }, config);

      const prompt = `
      As a Performance Optimization AI Agent, analyze this campaign and provide optimization recommendations:

      Campaign: ${campaignData.name}
      Platform: ${campaignData.platform}
      Current Metrics: ${JSON.stringify(currentMetrics, null, 2)}
      Budget Utilization: ${((campaignData.budgetSpent / campaignData.budget) * 100).toFixed(1)}%

      Provide optimization in this JSON format:
      {
        "recommendations": [
          {
            "action": "Specific optimization action",
            "expectedImpact": "Expected improvement description",
            "confidence": 0.85,
            "implementation": "How to implement this change"
          }
        ],
        "projectedMetrics": {
          "ctr": 0.035,
          "cpc": 0.85,
          "conversions": 45,
          "roas": 3.2
        },
        "priorityActions": ["action1", "action2"],
        "riskAssessment": "Low|Medium|High"
      }

      Focus on:
      - Cost efficiency improvements
      - Conversion rate optimization
      - Audience targeting refinement
      - Creative performance enhancement
      - Budget reallocation
      `;

      // Send progress: generating recommendations
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 50,
        stage: 'optimizing',
        message: 'Generating optimization recommendations...',
      }, config);

      const response = await model.invoke(prompt);

      // Send progress: calculating projections
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 80,
        stage: 'projecting',
        message: 'Calculating performance projections...',
      }, config);

      const optimization = parseAIResponse(response.content as string);

      const result: OptimizationResult = {
        campaignId: campaignData.id,
        optimizationType: 'performance_optimization',
        currentMetrics,
        recommendations: (optimization as any).recommendations || [],
        projectedMetrics: (optimization as any).projectedMetrics || {},
      };

      // Send progress: saving optimization
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 95,
        stage: 'saving',
        message: 'Saving optimization plan...',
      }, config);

      // Store in database
      await aiDbService.storeOptimizationResult(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.PERFORMANCE_OPTIMIZER, {
        lastOptimization: new Date(),
        processingTime,
        campaignsOptimized: 1,
      });

      // Send completion
      this.sendProgress({
        operationType: 'optimization',
        campaignId: campaignData.id,
        progress: 100,
        stage: 'completed',
        message: 'Performance optimization completed successfully!',
      }, config);

      this.sendComplete(result, config);

      return result;
    } catch (error) {
      console.error('Real-time optimization error:', error);
      this.sendError(error, config);
      throw error;
    }
  }

  // Multi-Agent Comprehensive Analysis with Real-Time Updates
  async comprehensiveAnalysisRealTime(
    campaignData: CampaignData,
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId
    }
  ) {
    try {
      // Send initial progress
      this.sendProgress({
        operationType: 'analysis',
        campaignId: campaignData.id,
        progress: 0,
        stage: 'initializing',
        message: 'Starting comprehensive multi-agent analysis...',
      }, config);

      // Run all analyses in parallel with progress updates
      const [
        campaignAnalysis,
        audienceAnalysis,
        budgetAnalysis,
        optimization
      ] = await Promise.all([
        this.analyzeCampaignRealTime(campaignData, { ...config, sessionId: undefined }),
        this.analyzeAudience(campaignData, config),
        this.manageBudget(campaignData, config),
        this.optimizePerformanceRealTime(campaignData, { ...config, sessionId: undefined })
      ]);

      const comprehensiveResult = {
        campaignAnalysis,
        audienceAnalysis,
        budgetAnalysis,
        optimization,
        summary: {
          overallScore: (
            ((campaignAnalysis as any)?.performanceScore || 8.5) +
            ((audienceAnalysis as any)?.performanceScore || 8.2) +
            ((budgetAnalysis as any)?.performanceScore || 8.8)
          ) / 3,
          totalRecommendations:
            (Array.isArray(campaignAnalysis.recommendations) ? campaignAnalysis.recommendations.length : 0) +
            (Array.isArray(audienceAnalysis.recommendations) ? audienceAnalysis.recommendations.length : 0) +
            (Array.isArray(budgetAnalysis.recommendations) ? budgetAnalysis.recommendations.length : 0) +
            (Array.isArray(optimization.recommendations) ? optimization.recommendations.length : 0),
          generatedAt: new Date(),
        }
      };

      this.sendComplete(comprehensiveResult, config);
      return comprehensiveResult;
    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      this.sendError(error, config);
      throw error;
    }
  }

  // Audience Analysis with Real-Time Updates
  async analyzeAudience(
    campaignData: CampaignData,
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId,
    }
  ): Promise<CampaignAnalysisResult> {
    const startTime = Date.now();

    try {
      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 0,
          stage: 'initializing',
          message: 'Starting audience analysis...',
        },
        config
      );

      const model = this.getModel(config.provider);

      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 20,
          stage: 'preparing',
          message: 'Preparing audience data...',
        },
        config
      );

      const prompt = `
      As an Audience Analysis AI Agent, analyze the following campaign audience and provide actionable insights:

      Campaign: ${campaignData.name}
      Platform: ${campaignData.platform}
      Target Audience: ${JSON.stringify(campaignData.targetAudience, null, 2)}
      Performance: ${JSON.stringify(campaignData.performance, null, 2)}

      Provide analysis in the following JSON format:
      {
        "insights": ["insight1", "insight2"],
        "recommendations": ["recommendation1", "recommendation2"],
        "performanceScore": 0.85,
        "confidence": 0.92,
        "segments": ["segment1", "segment2"]
      }

      Focus on:
      - Audience segmentation quality
      - Targeting effectiveness
      - Reach vs. engagement trade-offs
      - Lookalike and expansion opportunities
      - Platform-specific audience best practices
      `;

      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 50,
          stage: 'analyzing',
          message: 'AI is analyzing audience performance...',
        },
        config
      );

      const response = await model.invoke(prompt);

      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 80,
          stage: 'processing',
          message: 'Processing audience analysis results...',
        },
        config
      );

      const audience = parseAIResponse(response.content as string);

      const result: CampaignAnalysisResult = {
        campaignId: campaignData.id,
        analysisType: 'audience_analysis',
        insights: (audience as any).insights || ['Audience analysis completed'],
        recommendations:
          (audience as any).recommendations || ['Review audience targeting strategy'],
        performanceScore: (audience as any).performanceScore || 0,
        confidence: (audience as any).confidence || 0,
        generatedAt: new Date(),
      };

      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 90,
          stage: 'saving',
          message: 'Saving audience analysis to database...',
          confidence: result.confidence,
        },
        config
      );

      await aiDbService.storeCampaignAnalysis(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.AUDIENCE_EXPERT, {
        lastAnalysis: new Date(),
        processingTime,
        confidence: result.confidence,
        audiencesAnalyzed: 1,
      });

      this.sendProgress(
        {
          operationType: 'analysis',
          campaignId: campaignData.id,
          progress: 100,
          stage: 'completed',
          message: 'Audience analysis completed successfully!',
          confidence: result.confidence,
        },
        config
      );

      this.sendComplete(result, config);

      return result;
    } catch (error) {
      console.error('Real-time audience analysis error:', error);
      this.sendError(error, config);
      throw error;
    }
  }

  // Budget Management with Real-Time Updates
  async manageBudget(
    campaignData: CampaignData,
    config: RealTimeAIAgentConfig = {
      provider: AI_PROVIDERS.OPENAI,
      organizationId: this.organizationId,
    }
  ): Promise<CampaignAnalysisResult> {
    const startTime = Date.now();

    try {
      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 0,
          stage: 'initializing',
          message: 'Starting budget analysis...',
        },
        config
      );

      const model = this.getModel(config.provider);
      const utilization =
        campaignData.budget > 0
          ? (campaignData.budgetSpent / campaignData.budget) * 100
          : 0;

      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 20,
          stage: 'preparing',
          message: 'Preparing budget utilization data...',
        },
        config
      );

      const prompt = `
      As a Budget Management AI Agent, analyze the following campaign budget and provide optimization recommendations:

      Campaign: ${campaignData.name}
      Platform: ${campaignData.platform}
      Total Budget: $${campaignData.budget}
      Spent: $${campaignData.budgetSpent}
      Utilization: ${utilization.toFixed(1)}%
      Performance: ${JSON.stringify(campaignData.performance, null, 2)}

      Provide analysis in the following JSON format:
      {
        "insights": ["insight1", "insight2"],
        "recommendations": ["recommendation1", "recommendation2"],
        "performanceScore": 0.82,
        "confidence": 0.88,
        "projectedSpend": 650
      }

      Focus on:
      - Budget utilization efficiency
      - Pacing and delivery analysis
      - Cost per result trends
      - Reallocation opportunities
      - Scale vs. profitability trade-offs
      `;

      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 50,
          stage: 'analyzing',
          message: 'AI is analyzing budget performance...',
        },
        config
      );

      const response = await model.invoke(prompt);

      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 80,
          stage: 'processing',
          message: 'Processing budget recommendations...',
        },
        config
      );

      const budget = parseAIResponse(response.content as string);

      const result: CampaignAnalysisResult = {
        campaignId: campaignData.id,
        analysisType: 'budget_management',
        insights: (budget as any).insights || ['Budget analysis completed'],
        recommendations: (budget as any).recommendations || ['Review budget allocation'],
        performanceScore: (budget as any).performanceScore || 0,
        confidence: (budget as any).confidence || 0,
        generatedAt: new Date(),
      };

      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 90,
          stage: 'saving',
          message: 'Saving budget analysis to database...',
          confidence: result.confidence,
        },
        config
      );

      await aiDbService.storeCampaignAnalysis(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.BUDGET_MANAGER, {
        lastOptimization: new Date(),
        processingTime,
        confidence: result.confidence,
        budgetsManaged: 1,
      });

      this.sendProgress(
        {
          operationType: 'optimization',
          campaignId: campaignData.id,
          progress: 100,
          stage: 'completed',
          message: 'Budget analysis completed successfully!',
          confidence: result.confidence,
        },
        config
      );

      this.sendComplete(result, config);

      return result;
    } catch (error) {
      console.error('Real-time budget management error:', error);
      this.sendError(error, config);
      throw error;
    }
  }
}

// Export factory function
export function createRealTimeAIAgents(organizationId: string) {
  return new RealTimeAIAgents(organizationId);
}

// Export types
export type {
  CampaignData,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
};

// Export constants for realtime agents
export { AI_PROVIDERS as AI_PROVIDERS_REALTIME, AGENT_TYPES as AGENT_TYPES_REALTIME };
