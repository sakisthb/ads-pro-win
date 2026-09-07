import {
  AI_PROVIDERS,
  AGENT_TYPES,
  createModelRegistry,
  getModel,
  parseAIResponse,
  updateAgentPerformance,
} from '../agent-base';
import { aiDbService } from '../../ai-database-service';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({ provider: 'openai' })),
}));

jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({ provider: 'anthropic' })),
}));

jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({ provider: 'google' })),
}));

jest.mock('../../ai-database-service', () => ({
  aiDbService: {
    getAIAgentsByOrganization: jest.fn(),
    createAIAgent: jest.fn(),
    updateAIAgentPerformance: jest.fn(),
  },
}));

describe('AI agent base', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  describe('createModelRegistry', () => {
    it('includes OpenAI when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';
      const models = createModelRegistry();
      expect(models.get(AI_PROVIDERS.OPENAI)).toEqual({ provider: 'openai' });
      expect(models.has(AI_PROVIDERS.ANTHROPIC)).toBe(false);
      expect(models.has(AI_PROVIDERS.GOOGLE)).toBe(false);
    });

    it('includes Anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-anthropic';
      const models = createModelRegistry();
      expect(models.get(AI_PROVIDERS.ANTHROPIC)).toEqual({ provider: 'anthropic' });
      expect(models.has(AI_PROVIDERS.OPENAI)).toBe(false);
    });

    it('includes Google when GOOGLE_API_KEY is set', () => {
      process.env.GOOGLE_API_KEY = 'sk-google';
      const models = createModelRegistry();
      expect(models.get(AI_PROVIDERS.GOOGLE)).toEqual({ provider: 'google' });
    });

    it('returns an empty registry when no keys are configured', () => {
      const models = createModelRegistry();
      expect(models.size).toBe(0);
    });
  });

  describe('getModel', () => {
    it('returns the model for a configured provider', () => {
      const models = new Map();
      const openaiModel = { provider: 'openai' };
      models.set(AI_PROVIDERS.OPENAI, openaiModel);

      expect(getModel(models, AI_PROVIDERS.OPENAI)).toBe(openaiModel);
    });

    it('throws when the provider is not configured', () => {
      const models = new Map();
      expect(() => getModel(models, AI_PROVIDERS.OPENAI)).toThrow(
        'AI provider openai not configured. Check your environment variables.',
      );
    });
  });

  describe('parseAIResponse', () => {
    it('extracts JSON from a plain object string', () => {
      expect(parseAIResponse('{"ok": true}')).toEqual({ ok: true });
    });

    it('extracts JSON from a markdown code block', () => {
      const content = '```json\n{"recommendations": ["a", "b"]}\n```';
      expect(parseAIResponse(content)).toEqual({ recommendations: ['a', 'b'] });
    });

    it('extracts the first JSON object when multiple exist', () => {
      const content = 'prefix {"a": 1} suffix {"b": 2}';
      expect(parseAIResponse(content)).toEqual({ a: 1 });
    });

    it('returns an empty object when no JSON is found', () => {
      expect(parseAIResponse('no json here')).toEqual({});
    });

    it('returns an empty object when JSON is malformed', () => {
      expect(parseAIResponse('{invalid')).toEqual({});
    });
  });

  describe('updateAgentPerformance', () => {
    const organizationId = 'org_123';
    const agentType = AGENT_TYPES.CAMPAIGN_ANALYST;

    it('creates a new agent when none exists', async () => {
      (aiDbService.getAIAgentsByOrganization as jest.Mock).mockResolvedValue([]);

      await updateAgentPerformance(organizationId, agentType, { calls: 5 });

      expect(aiDbService.createAIAgent).toHaveBeenCalledWith({
        name: 'CAMPAIGN ANALYST Agent',
        type: agentType,
        organizationId,
        configuration: { provider: AI_PROVIDERS.OPENAI },
      });
      expect(aiDbService.updateAIAgentPerformance).not.toHaveBeenCalled();
    });

    it('updates performance for an existing agent', async () => {
      const agent = {
        id: 'agent_1',
        performance: { calls: 3 },
      };
      (aiDbService.getAIAgentsByOrganization as jest.Mock).mockResolvedValue([agent]);

      await updateAgentPerformance(organizationId, agentType, { calls: 5 });

      expect(aiDbService.updateAIAgentPerformance).toHaveBeenCalledWith(
        'agent_1',
        organizationId,
        { calls: 5 },
      );
      expect(aiDbService.createAIAgent).not.toHaveBeenCalled();
    });

    it('merges new performance with existing performance', async () => {
      const agent = {
        id: 'agent_1',
        performance: { calls: 3, errors: 1 },
      };
      (aiDbService.getAIAgentsByOrganization as jest.Mock).mockResolvedValue([agent]);

      await updateAgentPerformance(organizationId, agentType, { calls: 5 });

      expect(aiDbService.updateAIAgentPerformance).toHaveBeenCalledWith(
        'agent_1',
        organizationId,
        { calls: 5, errors: 1 },
      );
    });

    it('does not throw when the database call fails', async () => {
      const error = new Error('db down');
      (aiDbService.getAIAgentsByOrganization as jest.Mock).mockRejectedValue(error);

      await expect(
        updateAgentPerformance(organizationId, agentType, { calls: 5 }),
      ).resolves.toBeUndefined();
    });
  });
});
