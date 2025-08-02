// Mock definitions for Ads Pro Enterprise tests
// TEMPORARILY SIMPLIFIED FOR BUILD FIX

import { jest } from '@jest/globals'

// ALL MOCKS SIMPLIFIED DUE TO TYPESCRIPT COMPILATION ISSUES
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
};

export const mockAIAgentsService = {
  generateCampaignInsights: jest.fn(),
  optimizeCampaignPerformance: jest.fn(),
  generateAdCreatives: jest.fn(),
  analyzeCampaignData: jest.fn(),
  generateRecommendations: jest.fn(),
};

export const mockCampaignService = {
  getCampaigns: jest.fn(),
  getCampaignById: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  getCampaignMetrics: jest.fn(),
  updateCampaignStatus: jest.fn(),
};

export const mockPrisma = {
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
};

// Mock Next Auth
export const mockNextAuth = {
  getServerSession: jest.fn(),
  useSession: jest.fn(),
};

// Mock React Query
export const mockUseQuery = jest.fn();
export const mockUseMutation = jest.fn();

// Test Utilities
export const createMockCampaign = (overrides = {}) => ({
  id: 'test-campaign-1',
  name: 'Test Campaign',
  platform: 'facebook',
  status: 'active',
  budget: 1000,
  budgetSpent: 250,
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

export const createMockOrganization = (overrides = {}) => ({
  id: 'test-org-1',
  name: 'Test Organization',
  ...overrides,
});