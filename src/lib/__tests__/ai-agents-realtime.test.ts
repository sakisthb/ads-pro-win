/**
 * @jest-environment node
 */
import { createRealTimeAIAgents } from '../ai-agents-realtime';
import { aiDbService } from '../ai-database-service';
import { getWebSocketServer } from '../websocket/websocket-server';

const mockBroadcastAIProgress = jest.fn();
const mockBroadcastAIComplete = jest.fn();
const mockBroadcastAIError = jest.fn();

jest.mock('../websocket/websocket-server', () => ({
  getWebSocketServer: jest.fn(() => ({
    broadcastAIProgress: mockBroadcastAIProgress,
    broadcastAIComplete: mockBroadcastAIComplete,
    broadcastAIError: mockBroadcastAIError,
  })),
}));

jest.mock('@/lib/db', () => ({ prisma: {} }));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({ provider: 'openai' })),
}));

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({ provider: 'anthropic' })),
}));

jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({ provider: 'google' })),
}));

jest.mock('../ai-database-service', () => ({
  aiDbService: {
    storeCampaignAnalysis: jest.fn(),
    storeOptimizationResult: jest.fn(),
    getAIAgentsByOrganization: jest.fn().mockResolvedValue([]),
    createAIAgent: jest.fn(),
    updateAIAgentPerformance: jest.fn(),
  },
}));

describe('RealTimeAIAgents', () => {
  const organizationId = 'org_123';
  const campaignData = {
    id: 'camp_123',
    name: 'Test Campaign',
    platform: 'facebook',
    status: 'active',
    budget: 1000,
    budgetSpent: 500,
    performance: { impressions: 10000, clicks: 300, conversions: 15 },
    targetAudience: { age: '25-34', interests: ['technology'] },
    adCreatives: [],
    organizationId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-openai';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('analyzeAudience', () => {
    it('invokes the model, stores the result, and broadcasts progress', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      (model as any).invoke = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          insights: ['Audience is highly engaged'],
          recommendations: ['Expand lookalike audience'],
          performanceScore: 0.85,
          confidence: 0.9,
          segments: ['Tech enthusiasts'],
        }),
      });

      (aiDbService.storeCampaignAnalysis as jest.Mock).mockResolvedValue({ id: 'analysis_1' });

      const result = await agents.analyzeAudience(campaignData, {
        provider: 'openai',
        organizationId,
      });

      expect(model.invoke).toHaveBeenCalledWith(
        expect.stringContaining('Audience Analysis AI Agent'),
      );
      expect(aiDbService.storeCampaignAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'camp_123',
          analysisType: 'audience_analysis',
          insights: ['Audience is highly engaged'],
          recommendations: ['Expand lookalike audience'],
          performanceScore: 0.85,
          confidence: 0.9,
        }),
      );
      expect(result).toMatchObject({
        campaignId: 'camp_123',
        analysisType: 'audience_analysis',
        performanceScore: 0.85,
        confidence: 0.9,
      });
      expect(mockBroadcastAIProgress).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'analysis', stage: 'initializing' }),
        organizationId,
        undefined,
      );
      expect(mockBroadcastAIProgress).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'analysis', stage: 'completed', progress: 100 }),
        organizationId,
        undefined,
      );
      expect(mockBroadcastAIComplete).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp_123' }),
        organizationId,
        undefined,
      );
    });

    it('falls back to defaults when the model response has no JSON', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      (model as any).invoke = jest.fn().mockResolvedValue({ content: 'no json' });
      (aiDbService.storeCampaignAnalysis as jest.Mock).mockResolvedValue({ id: 'analysis_2' });

      const result = await agents.analyzeAudience(campaignData, {
        provider: 'openai',
        organizationId,
      });

      expect(result.insights).toEqual(['Audience analysis completed']);
      expect(result.recommendations).toEqual(['Review audience targeting strategy']);
      expect(result.performanceScore).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('broadcasts errors and re-throws on model failure', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      const error = new Error('model failed');
      (model as any).invoke = jest.fn().mockRejectedValue(error);

      await expect(
        agents.analyzeAudience(campaignData, { provider: 'openai', organizationId }),
      ).rejects.toThrow('model failed');

      expect(mockBroadcastAIError).toHaveBeenCalledWith(error, organizationId, undefined);
    });
  });

  describe('manageBudget', () => {
    it('invokes the model, stores the result, and broadcasts progress', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      (model as any).invoke = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          insights: ['Budget utilization is on track'],
          recommendations: ['Increase daily budget by 15%'],
          performanceScore: 0.82,
          confidence: 0.88,
          projectedSpend: 650,
        }),
      });

      (aiDbService.storeCampaignAnalysis as jest.Mock).mockResolvedValue({ id: 'budget_1' });

      const result = await agents.manageBudget(campaignData, {
        provider: 'openai',
        organizationId,
      });

      expect(model.invoke).toHaveBeenCalledWith(
        expect.stringContaining('Budget Management AI Agent'),
      );
      expect(aiDbService.storeCampaignAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'camp_123',
          analysisType: 'budget_management',
          insights: ['Budget utilization is on track'],
          recommendations: ['Increase daily budget by 15%'],
          performanceScore: 0.82,
          confidence: 0.88,
        }),
      );
      expect(result).toMatchObject({
        campaignId: 'camp_123',
        analysisType: 'budget_management',
        performanceScore: 0.82,
        confidence: 0.88,
      });
      expect(mockBroadcastAIProgress).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'optimization', stage: 'initializing' }),
        organizationId,
        undefined,
      );
      expect(mockBroadcastAIProgress).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'optimization', stage: 'completed', progress: 100 }),
        organizationId,
        undefined,
      );
      expect(mockBroadcastAIComplete).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp_123' }),
        organizationId,
        undefined,
      );
    });

    it('falls back to defaults when the model response has no JSON', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      (model as any).invoke = jest.fn().mockResolvedValue({ content: 'no json' });
      (aiDbService.storeCampaignAnalysis as jest.Mock).mockResolvedValue({ id: 'budget_2' });

      const result = await agents.manageBudget(campaignData, {
        provider: 'openai',
        organizationId,
      });

      expect(result.insights).toEqual(['Budget analysis completed']);
      expect(result.recommendations).toEqual(['Review budget allocation']);
      expect(result.performanceScore).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('broadcasts errors and re-throws on model failure', async () => {
      const agents = createRealTimeAIAgents(organizationId);
      const model = (agents as any).models.get('openai');
      const error = new Error('model failed');
      (model as any).invoke = jest.fn().mockRejectedValue(error);

      await expect(
        agents.manageBudget(campaignData, { provider: 'openai', organizationId }),
      ).rejects.toThrow('model failed');

      expect(mockBroadcastAIError).toHaveBeenCalledWith(error, organizationId, undefined);
    });
  });
});
