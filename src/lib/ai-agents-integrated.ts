// Integrated AI Agents with Database Persistence
// Enhanced AI agent system with full database integration

import { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  aiDbService,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
} from "./ai-database-service";
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

export class IntegratedAIAgents {
  private models: Map<AIProvider, BaseLanguageModel> = createModelRegistry();
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  private getModel(provider: AIProvider): BaseLanguageModel {
    return getModel(this.models, provider);
  }

  // Campaign Analysis Agent with Database Integration
  async analyzeCampaign(
    campaignData: CampaignData,
    config: AIAgentConfig = { provider: AI_PROVIDERS.OPENAI, organizationId: this.organizationId }
  ): Promise<CampaignAnalysisResult> {
    const startTime = Date.now();
    const model = this.getModel(config.provider);

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

    try {
      const response = await model.invoke(prompt);
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

      return result;
    } catch (error) {
      console.error('Campaign analysis error:', error);
      throw error;
    }
  }

  // Creative Generation Agent with Database Integration
  async generateCreative(
    briefData: {
      campaignId?: string;
      platform: string;
      audience: string[];
      goals: string[];
      constraints?: string[];
    },
    config: AIAgentConfig = { provider: AI_PROVIDERS.OPENAI, organizationId: this.organizationId }
  ): Promise<CreativeGenerationResult> {
    const startTime = Date.now();
    const model = this.getModel(config.provider);

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

    try {
      const response = await model.invoke(prompt);
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

      return result;
    } catch (error) {
      console.error('Creative generation error:', error);
      throw error;
    }
  }

  // Performance Optimization Agent with Database Integration
  async optimizePerformance(
    campaignData: CampaignData,
    config: AIAgentConfig = { provider: AI_PROVIDERS.OPENAI, organizationId: this.organizationId }
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const model = this.getModel(config.provider);

    const currentMetrics = campaignData.performance as Record<string, number>;

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

    try {
      const response = await model.invoke(prompt);
      const optimization = parseAIResponse(response.content as string);

      const result: OptimizationResult = {
        campaignId: campaignData.id,
        optimizationType: 'performance_optimization',
        currentMetrics,
        recommendations: (optimization as any).recommendations || [],
        projectedMetrics: (optimization as any).projectedMetrics || {},
      };

      // Store in database
      await aiDbService.storeOptimizationResult(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.PERFORMANCE_OPTIMIZER, {
        lastOptimization: new Date(),
        processingTime,
        campaignsOptimized: 1,
      });

      return result;
    } catch (error) {
      console.error('Performance optimization error:', error);
      throw error;
    }
  }

  // Audience Analysis Agent
  async analyzeAudience(
    campaignData: CampaignData,
    config: AIAgentConfig = { provider: AI_PROVIDERS.ANTHROPIC, organizationId: this.organizationId }
  ) {
    const startTime = Date.now();
    const model = this.getModel(config.provider);

    const prompt = `
    As an Audience Analysis AI Agent, analyze the target audience for this campaign:

    Campaign: ${campaignData.name}
    Platform: ${campaignData.platform}
    Current Targeting: ${JSON.stringify(campaignData.targetAudience, null, 2)}
    Performance: ${JSON.stringify(campaignData.performance, null, 2)}

    Provide audience analysis in JSON format:
    {
      "audienceInsights": ["insight1", "insight2"],
      "suggestions": ["suggestion1", "suggestion2"],
      "expandOpportunities": ["opportunity1", "opportunity2"],
      "excludeRecommendations": ["exclude1", "exclude2"],
      "confidence": 0.87
    }
    `;

    try {
      const response = await model.invoke(prompt);
      const analysis = parseAIResponse(response.content as string);

      const result: CampaignAnalysisResult = {
        campaignId: campaignData.id,
        analysisType: 'audience_analysis',
        insights: (analysis as any).audienceInsights || [],
        recommendations: (analysis as any).suggestions || [],
        performanceScore: (analysis as any).confidence || 0,
        confidence: (analysis as any).confidence || 0,
        generatedAt: new Date(),
      };

      await aiDbService.storeCampaignAnalysis(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.AUDIENCE_EXPERT, {
        lastAnalysis: new Date(),
        processingTime,
        confidence: result.confidence,
        audiencesAnalyzed: 1,
      });

      return result;
    } catch (error) {
      console.error('Audience analysis error:', error);
      throw error;
    }
  }

  // Budget Management Agent
  async manageBudget(
    campaignData: CampaignData,
    config: AIAgentConfig = { provider: AI_PROVIDERS.GOOGLE, organizationId: this.organizationId }
  ) {
    const startTime = Date.now();
    const model = this.getModel(config.provider);

    const budgetUtilization = (campaignData.budgetSpent / campaignData.budget) * 100;

    const prompt = `
    As a Budget Management AI Agent, analyze budget allocation and spending:

    Campaign: ${campaignData.name}
    Total Budget: $${campaignData.budget}
    Spent: $${campaignData.budgetSpent} (${budgetUtilization.toFixed(1)}%)
    Performance: ${JSON.stringify(campaignData.performance, null, 2)}

    Provide budget analysis in JSON format:
    {
      "budgetHealth": "Optimal|Warning|Critical",
      "spendingRate": "description of spending rate",
      "recommendations": ["recommendation1", "recommendation2"],
      "budgetAllocation": {
        "suggested_daily": 50,
        "suggested_total": 1500
      },
      "riskFactors": ["risk1", "risk2"],
      "confidence": 0.91
    }
    `;

    try {
      const response = await model.invoke(prompt);
      const analysis = parseAIResponse(response.content as string);

      const result: CampaignAnalysisResult = {
        campaignId: campaignData.id,
        analysisType: 'budget_management',
        insights: [`Budget Health: ${(analysis as any).budgetHealth}`, (analysis as any).spendingRate],
        recommendations: (analysis as any).recommendations || [],
        performanceScore: (analysis as any).confidence || 0,
        confidence: (analysis as any).confidence || 0,
        generatedAt: new Date(),
      };

      await aiDbService.storeCampaignAnalysis(result);

      const processingTime = Date.now() - startTime;
      await updateAgentPerformance(this.organizationId, AGENT_TYPES.BUDGET_MANAGER, {
        lastAnalysis: new Date(),
        processingTime,
        confidence: result.confidence,
        budgetsManaged: 1,
      });

      return result;
    } catch (error) {
      console.error('Budget management error:', error);
      throw error;
    }
  }

  // Multi-Agent Campaign Analysis
  async comprehensiveAnalysis(campaignData: CampaignData) {
    try {
      const [
        campaignAnalysis,
        audienceAnalysis,
        budgetAnalysis,
        optimization
      ] = await Promise.all([
        this.analyzeCampaign(campaignData),
        this.analyzeAudience(campaignData),
        this.manageBudget(campaignData),
        this.optimizePerformance(campaignData)
      ]);

      return {
        campaignAnalysis,
        audienceAnalysis,
        budgetAnalysis,
        optimization,
        summary: {
          overallScore: (
            campaignAnalysis.performanceScore +
            audienceAnalysis.performanceScore +
            budgetAnalysis.performanceScore
          ) / 3,
          totalRecommendations:
            campaignAnalysis.recommendations.length +
            audienceAnalysis.recommendations.length +
            budgetAnalysis.recommendations.length +
            optimization.recommendations.length,
          generatedAt: new Date(),
        }
      };
    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      throw error;
    }
  }

  // Get AI Agent Performance Data
  async getAgentPerformance(agentType: AgentType) {
    return await aiDbService.getAIAgentsByOrganization(this.organizationId, agentType);
  }

  // Get Organization Analytics Dashboard
  async getAnalyticsDashboard(timeframe = '7d') {
    return await aiDbService.getAnalyticsDashboardData(this.organizationId, timeframe);
  }
}

// Export factory function
export function createIntegratedAIAgents(organizationId: string) {
  return new IntegratedAIAgents(organizationId);
}

// Export types
export type {
  CampaignData,
  AIAgentConfig,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
};

// Export constants for integrated agents
export { AI_PROVIDERS as AI_PROVIDERS_INTEGRATED, AGENT_TYPES as AGENT_TYPES_INTEGRATED };
