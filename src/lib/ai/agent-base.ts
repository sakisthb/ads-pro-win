import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  aiDbService,
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
} from "../ai-database-service";

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
} as const;

export const AGENT_TYPES = {
  CAMPAIGN_ANALYST: 'campaign_analyst',
  CREATIVE_SPECIALIST: 'creative_specialist',
  AUDIENCE_EXPERT: 'audience_expert',
  PERFORMANCE_OPTIMIZER: 'performance_optimizer',
  BUDGET_MANAGER: 'budget_manager',
  COMPETITIVE_ANALYST: 'competitive_analyst',
} as const;

export type AIProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];
export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

export interface CampaignData {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  budgetSpent: number;
  performance: Record<string, any>;
  targetAudience: Record<string, any>;
  adCreatives: any[];
  organizationId: string;
}

export interface AIAgentConfig {
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  organizationId: string;
  campaignId?: string;
}

export function createModelRegistry(): Map<AIProvider, BaseLanguageModel> {
  const models = new Map<AIProvider, BaseLanguageModel>();

  if (process.env.OPENAI_API_KEY) {
    models.set(AI_PROVIDERS.OPENAI, new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4-turbo-preview",
      temperature: 0.3,
      maxTokens: 2000,
    }));
  }

  if (process.env.ANTHROPIC_API_KEY) {
    models.set(AI_PROVIDERS.ANTHROPIC, new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: "claude-3-sonnet-20240229",
      temperature: 0.3,
      maxTokens: 2000,
    }));
  }

  if (process.env.GOOGLE_API_KEY) {
    models.set(AI_PROVIDERS.GOOGLE, new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-pro",
      temperature: 0.3,
    }));
  }

  return models;
}

export function getModel(
  models: Map<AIProvider, BaseLanguageModel>,
  provider: AIProvider,
): BaseLanguageModel {
  const model = models.get(provider);
  if (!model) {
    throw new Error(`AI provider ${provider} not configured. Check your environment variables.`);
  }
  return model;
}

export function parseAIResponse(content: string): unknown {
  try {
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {};
  }
}

export async function updateAgentPerformance(
  organizationId: string,
  agentType: AgentType,
  performance: Record<string, any>,
): Promise<void> {
  try {
    const agents = await aiDbService.getAIAgentsByOrganization(organizationId, agentType);

    if (agents.length === 0) {
      await aiDbService.createAIAgent({
        name: `${agentType.replace('_', ' ').toUpperCase()} Agent`,
        type: agentType,
        organizationId,
        configuration: { provider: AI_PROVIDERS.OPENAI },
      });
    } else {
      const agent = agents[0];
      const updatedPerformance = {
        ...(agent.performance as unknown as Record<string, unknown>),
        ...performance,
      };

      await aiDbService.updateAIAgentPerformance(
        agent.id,
        organizationId,
        updatedPerformance,
      );
    }
  } catch (error) {
    console.error('Error updating agent performance:', error);
  }
}

export type {
  CampaignAnalysisResult,
  CreativeGenerationResult,
  OptimizationResult,
};
