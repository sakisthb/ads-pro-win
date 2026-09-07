// Mock definitions for Ads Pro Enterprise tests

import { jest } from '@jest/globals'

// AI database service mocks
export const mockAIDatabaseService = {
  createAIAnalysis: jest.fn(),
  createCreativeGeneration: jest.fn(),
  createOptimization: jest.fn(),
  updateAIAnalysis: jest.fn(),
  getAIAnalysesByCampaign: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
  getCampaignInsights: jest.fn(),
  generateCampaignReport: jest.fn(),
  optimizeCampaignBudget: jest.fn(),
  runBulkAnalysis: jest.fn(),
}

export const mockAIAgentsService = {
  generateCampaignInsights: jest.fn(),
  optimizeCampaignPerformance: jest.fn(),
  generateAdCreatives: jest.fn(),
  analyzeCampaignData: jest.fn(),
  generateRecommendations: jest.fn(),
}

export const mockAIAgents = {
  analyzeCampaign: jest.fn(),
  generateCreative: jest.fn(),
  optimizeCampaign: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
}

export const mockCampaignService = {
  getCampaigns: jest.fn(),
  getCampaignById: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  getCampaignMetrics: jest.fn(),
  updateCampaignStatus: jest.fn(),
}

// Prisma mock with the models exercised by existing tests
export const mockPrismaClient = {
  aIAnalysis: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  creativeGeneration: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  optimization: {
    create: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

export const mockPrisma = mockPrismaClient

// Mock Next Auth
export const mockNextAuth = {
  getServerSession: jest.fn(),
  useSession: jest.fn(),
}

// tRPC context mock
export const mockTRPCContext = () => ({
  session: {
    user: { id: 'user_123', email: 'test@example.com' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  prisma: mockPrismaClient,
})

// React Query mocks
export const mockUseQuery = jest.fn()
export const mockUseMutation = jest.fn()

// Redis mock
export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  quit: jest.fn(),
}

// WebSocket server mock
export const mockWebSocketServer = {
  clients: new Set(),
  broadcast: jest.fn(),
}

// Test environment helpers
export function setupTestEnvironment() {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
}

export function cleanupMocks() {
  jest.useRealTimers()
  jest.clearAllMocks()
}

// Mock data generators
export const createMockCampaign = (overrides = {}) => ({
  id: 'test-campaign-1',
  name: 'Test Campaign',
  platform: 'facebook',
  status: 'active',
  budget: 1000,
  budgetSpent: 250,
  ...overrides,
})

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
})

export const createMockOrganization = (overrides = {}) => ({
  id: 'test-org-1',
  name: 'Test Organization',
  ...overrides,
})
