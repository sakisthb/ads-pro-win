// Test utilities for Ads Pro Enterprise
// Custom render function with providers and utilities

import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/nextjs'

// Mock providers for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

// Mock Clerk provider
const MockClerkProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider 
      publishableKey="pk_test_mock"
      appearance={{
        baseTheme: undefined,
      }}
    >
      {children}
    </ClerkProvider>
  )
}

// All providers wrapper
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const testQueryClient = createTestQueryClient()

  return (
    <MockClerkProvider>
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    </MockClerkProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Mock data generators
export const mockCampaign = (overrides = {}) => ({
  id: 'camp_123',
  name: 'Test Campaign',
  status: 'active',
  budget: 1000,
  spend: 450,
  impressions: 15000,
  clicks: 750,
  conversions: 45,
  ctr: 5.0,
  cpc: 0.6,
  cpa: 10.0,
  organizationId: 'org_123',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-08'),
  ...overrides,
})

export const mockAIAnalysisResult = (overrides = {}) => ({
  id: 'analysis_123',
  campaignId: 'camp_123',
  analysisType: 'comprehensive',
  insights: {
    performance: {
      score: 85,
      trend: 'improving',
      recommendations: ['Increase budget for high-performing keywords'],
    },
    audience: {
      topSegments: ['Male 25-34', 'Female 25-34'],
      engagementRate: 4.5,
    },
    budget: {
      efficiency: 78,
      recommendedBudget: 1200,
      projectedReturn: 2400,
    },
  },
  confidence: 92,
  createdAt: new Date('2025-01-08'),
  ...overrides,
})

export const mockUser = (overrides = {}) => ({
  id: 'user_123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  organizationId: 'org_123',
  role: 'admin',
  createdAt: new Date('2025-01-01'),
  ...overrides,
})

export const mockOrganization = (overrides = {}) => ({
  id: 'org_123',
  name: 'Test Organization',
  plan: 'professional',
  status: 'active',
  createdAt: new Date('2025-01-01'),
  ...overrides,
})

// WebSocket mock helpers - SIMPLIFIED FOR BUILD FIX
export const createMockWebSocket = (): any => {
  return {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1, // WebSocket.OPEN
    url: 'ws://localhost:8080',
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };
}

// Test helpers
export const waitFor = (ms: number) => 
  new Promise(resolve => setTimeout(resolve, ms))

export const waitForLoadingToFinish = () =>
  new Promise(resolve => setTimeout(resolve, 100))

// Mock tRPC client
export const createMockTRPCClient = () => ({
  ai: {
    analyzeCampaign: {
      useMutation: () => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
      }),
    },
    generateCreative: {
      useMutation: () => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
      }),
    },
    optimizeCampaign: {
      useMutation: () => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
      }),
    },
  },
  campaigns: {
    list: {
      useQuery: () => ({
        data: [mockCampaign()],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      }),
    },
    create: {
      useMutation: () => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
      }),
    },
    update: {
      useMutation: () => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isLoading: false,
        isError: false,
        error: null,
      }),
    },
  },
})