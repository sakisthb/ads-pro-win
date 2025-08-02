// AI Components Export Index
// Centralized exports for all AI-powered UI components

// Main AI Feature Components
export { default as AIAnalysisPanel } from './ai-analysis-panel';
export { default as CreativeGenerationPanel } from './creative-generation-panel';
export { default as OptimizationDashboard } from './optimization-dashboard';
export { default as RealTimeAnalyticsDashboard } from './realtime-analytics-dashboard';

// Integrated Workspace Component
export { default as AIWorkspace } from './ai-workspace';

// Utility Components
export { default as WebSocketStatus, WebSocketStatusBadge } from './websocket-status';

// Named exports for specific use cases (removed to avoid duplicates)

// Component types for external usage
export type { 
  AIAnalysisPanelProps 
} from './ai-analysis-panel';

export type { 
  CreativeGenerationPanelProps 
} from './creative-generation-panel';

export type { 
  OptimizationDashboardProps 
} from './optimization-dashboard';

export type { 
  RealTimeAnalyticsDashboardProps 
} from './realtime-analytics-dashboard';

export type { 
  WebSocketStatusProps 
} from './websocket-status';

// Component groupings for organized imports
export const AnalysisComponents = {
  AIAnalysisPanel,
  OptimizationDashboard,
  RealTimeAnalyticsDashboard,
};

export const CreativeComponents = {
  CreativeGenerationPanel,
};

export const WorkspaceComponents = {
  AIWorkspace,
};

export const StatusComponents = {
  WebSocketStatus,
  WebSocketStatusBadge,
};

export const AllAIComponents = {
  ...AnalysisComponents,
  ...CreativeComponents,
  ...WorkspaceComponents,
  ...StatusComponents,
};

// Component categories for dynamic rendering
export const AI_COMPONENT_CATEGORIES = {
  ANALYSIS: 'analysis',
  CREATIVE: 'creative',
  OPTIMIZATION: 'optimization',
  ANALYTICS: 'analytics',
  WORKSPACE: 'workspace',
  STATUS: 'status',
} as const;

// Component metadata for documentation and dynamic usage
export const AI_COMPONENT_METADATA = {
  AIAnalysisPanel: {
    category: AI_COMPONENT_CATEGORIES.ANALYSIS,
    title: 'AI Campaign Analysis',
    description: 'Comprehensive AI-powered campaign analysis with real-time progress',
    features: ['Real-time analysis', 'Multiple AI providers', 'Confidence scoring', 'Detailed insights'],
    requiresWebSocket: true,
    requiresCampaignId: true,
  },
  CreativeGenerationPanel: {
    category: AI_COMPONENT_CATEGORIES.CREATIVE,
    title: 'AI Creative Generation',
    description: 'Generate compelling ad creative content with AI assistance',
    features: ['Multiple creative types', 'Platform-specific optimization', 'Variant generation', 'Real-time progress'],
    requiresWebSocket: true,
    requiresCampaignId: false,
  },
  OptimizationDashboard: {
    category: AI_COMPONENT_CATEGORIES.OPTIMIZATION,
    title: 'AI Performance Optimization',
    description: 'Get AI-powered optimization recommendations to improve campaign performance',
    features: ['Performance metrics', 'Optimization recommendations', 'Impact projections', 'Implementation guides'],
    requiresWebSocket: true,
    requiresCampaignId: true,
  },
  RealTimeAnalyticsDashboard: {
    category: AI_COMPONENT_CATEGORIES.ANALYTICS,
    title: 'Real-Time Analytics Dashboard',
    description: 'Live campaign performance and AI insights with real-time updates',
    features: ['Real-time updates', 'Multiple timeframes', 'Activity tracking', 'Performance metrics'],
    requiresWebSocket: true,
    requiresCampaignId: false,
  },
  AIWorkspace: {
    category: AI_COMPONENT_CATEGORIES.WORKSPACE,
    title: 'AI-Powered Campaign Workspace',
    description: 'Complete suite of AI tools for campaign analysis, optimization, and creative generation',
    features: ['Integrated AI tools', 'Campaign management', 'Real-time updates', 'Tabbed interface'],
    requiresWebSocket: true,
    requiresCampaignId: false,
  },
  WebSocketStatus: {
    category: AI_COMPONENT_CATEGORIES.STATUS,
    title: 'WebSocket Connection Status',
    description: 'Real-time connection status display with detailed connection info',
    features: ['Connection monitoring', 'Error handling', 'Connection controls', 'Detailed diagnostics'],
    requiresWebSocket: false,
    requiresCampaignId: false,
  },
} as const;

// Helper functions for component usage
export const getComponentsByCategory = (category: string) => {
  return Object.entries(AI_COMPONENT_METADATA)
    .filter(([_, metadata]) => metadata.category === category)
    .map(([componentName]) => componentName);
};

export const getComponentMetadata = (componentName: string) => {
  return AI_COMPONENT_METADATA[componentName as keyof typeof AI_COMPONENT_METADATA];
};

export const getComponentsRequiringWebSocket = () => {
  return Object.entries(AI_COMPONENT_METADATA)
    .filter(([_, metadata]) => metadata.requiresWebSocket)
    .map(([componentName]) => componentName);
};

export const getComponentsRequiringCampaign = () => {
  return Object.entries(AI_COMPONENT_METADATA)
    .filter(([_, metadata]) => metadata.requiresCampaignId)
    .map(([componentName]) => componentName);
};

// Default configurations for components
export const DEFAULT_AI_CONFIG = {
  provider: 'openai' as const,
  autoConnect: true,
  showProgress: true,
  enableRealTime: true,
  timeframe: '7d' as const,
};

// Export version information
export const AI_COMPONENTS_VERSION = '1.0.0';

// Feature flags for component capabilities
export const AI_FEATURE_FLAGS = {
  REAL_TIME_ANALYSIS: true,
  CREATIVE_GENERATION: true,
  PERFORMANCE_OPTIMIZATION: true,
  ANALYTICS_DASHBOARD: true,
  WEBSOCKET_STATUS: true,
  MULTI_PROVIDER_SUPPORT: true,
  CONFIDENCE_SCORING: true,
  PROGRESS_TRACKING: true,
} as const;