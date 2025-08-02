// AI Agents React Hooks
// Custom hooks for AI operations with React Query integration

import { api } from "@/lib/trpc/client";
import { type CampaignAnalysisResult, type CreativeGenerationResult, type OptimizationResult } from "@/lib/ai-database-service";

// Campaign Analysis Hook
export function useCampaignAnalysis() {
  const analyzeMutation = api.ai.analyzeCampaign.useMutation({
    onSuccess: (data) => {
      console.log("Campaign analysis completed:", data);
    },
    onError: (error) => {
      console.error("Campaign analysis failed:", error);
    },
  });

  const bulkAnalyzeMutation = api.ai.bulkAnalyzeCampaigns.useMutation({
    onSuccess: (data) => {
      console.log("Bulk campaign analysis completed:", data);
    },
    onError: (error) => {
      console.error("Bulk campaign analysis failed:", error);
    },
  });

  return {
    analyze: analyzeMutation.mutate,
    analyzeAsync: analyzeMutation.mutateAsync,
    bulkAnalyze: bulkAnalyzeMutation.mutate,
    bulkAnalyzeAsync: bulkAnalyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending || bulkAnalyzeMutation.isPending,
    error: analyzeMutation.error || bulkAnalyzeMutation.error,
  };
}

// Creative Generation Hook
export function useCreativeGeneration() {
  const generateMutation = api.ai.generateCreative.useMutation({
    onSuccess: (data) => {
      console.log("Creative generation completed:", data);
    },
    onError: (error) => {
      console.error("Creative generation failed:", error);
    },
  });

  return {
    generate: generateMutation.mutate,
    generateAsync: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    error: generateMutation.error,
    data: generateMutation.data?.result as CreativeGenerationResult | undefined,
  };
}

// Campaign Optimization Hook
export function useCampaignOptimization() {
  const optimizeMutation = api.ai.optimizeCampaign.useMutation({
    onSuccess: (data) => {
      console.log("Campaign optimization completed:", data);
    },
    onError: (error) => {
      console.error("Campaign optimization failed:", error);
    },
  });

  return {
    optimize: optimizeMutation.mutate,
    optimizeAsync: optimizeMutation.mutateAsync,
    isOptimizing: optimizeMutation.isPending,
    error: optimizeMutation.error,
    data: optimizeMutation.data?.result as OptimizationResult | undefined,
  };
}

// Analytics Dashboard Hook
export function useAnalyticsDashboard(timeframe: '1d' | '7d' | '30d' | '90d' = '7d') {
  const { data, isLoading, error, refetch } = api.ai.getAnalyticsDashboard.useQuery(
    { timeframe },
    {
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    }
  );

  return {
    dashboard: data?.data,
    isLoading,
    error,
    refetch,
  };
}

// Campaign Analyses History Hook
export function useCampaignAnalyses(campaignId: string, options?: {
  limit?: number;
  type?: string;
}) {
  const { data, isLoading, error, refetch } = api.ai.getCampaignAnalyses.useQuery(
    {
      campaignId,
      limit: options?.limit || 20,
      type: options?.type,
    },
    {
      enabled: !!campaignId,
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  return {
    analyses: data?.data || [],
    isLoading,
    error,
    refetch,
  };
}

// AI Agents Management Hook
export function useAIAgents(filters?: {
  type?: string;
  status?: string;
}) {
  const { data, isLoading, error, refetch } = api.ai.getAIAgents.useQuery(
    filters,
    {
      staleTime: 60 * 1000, // 1 minute
    }
  );

  return {
    agents: data?.data || [],
    isLoading,
    error,
    refetch,
  };
}

// AI Agent Performance Hook
export function useAIAgentPerformance(agentId?: string) {
  const { data, isLoading, error, refetch } = api.ai.getAgentPerformance.useQuery(
    { agentId: agentId! },
    {
      enabled: !!agentId,
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  return {
    performance: data?.data,
    isLoading,
    error,
    refetch,
  };
}

// Search Analyses Hook
export function useSearchAnalyses(filters?: {
  campaignId?: string;
  type?: string;
  confidenceMin?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const { data, isLoading, error, refetch } = api.ai.searchAnalyses.useQuery(
    filters || {},
    {
      enabled: !!filters,
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  return {
    analyses: data?.data || [],
    isLoading,
    error,
    refetch,
  };
}

// Campaign with AI Context Hook
export function useCampaignWithAIContext(campaignId?: string) {
  const { data, isLoading, error, refetch } = api.ai.getCampaignWithAIContext.useQuery(
    { campaignId: campaignId! },
    {
      enabled: !!campaignId,
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  return {
    campaign: data?.data,
    isLoading,
    error,
    refetch,
  };
}

// Analytics Dashboard Hook (Enhanced)
export function useAnalyticsDashboardEnhanced(timeframe: '1d' | '7d' | '30d' | '90d' = '7d') {
  const { data, isLoading, error, refetch } = api.ai.getAnalyticsDashboard.useQuery(
    { timeframe },
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Auto-refresh every minute
    }
  );

  return {
    dashboard: data?.data || {
      campaigns: [],
      analyses: [],
      optimizations: [],
      predictions: [],
      summary: {
        totalCampaigns: 0,
        totalAnalyses: 0,
        totalOptimizations: 0,
        totalPredictions: 0,
        avgConfidence: 0,
      },
    },
    isLoading,
    error,
    refetch,
  };
}

// AI Provider Status Hook
export function useAIProviderStatus() {
  const { data, isLoading, error } = api.ai.getAIProviderStatus.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  });

  return {
    providers: data?.providers || { openai: false, anthropic: false, google: false },
    isLoading,
    error,
  };
}

// Data Cleanup Hook
export function useDataCleanup() {
  const cleanupMutation = api.ai.cleanupOldAIData.useMutation({
    onSuccess: (data) => {
      console.log("Data cleanup completed:", data);
    },
    onError: (error) => {
      console.error("Data cleanup failed:", error);
    },
  });

  return {
    cleanup: cleanupMutation.mutate,
    cleanupAsync: cleanupMutation.mutateAsync,
    isCleaningUp: cleanupMutation.isPending,
    error: cleanupMutation.error,
    result: cleanupMutation.data?.data,
  };
}

// Combined AI Operations Hook
export function useAIOperations() {
  const analysis = useCampaignAnalysis();
  const creative = useCreativeGeneration();
  const optimization = useCampaignOptimization();
  const dashboard = useAnalyticsDashboard();
  const providerStatus = useAIProviderStatus();

  return {
    analysis,
    creative,
    optimization,
    dashboard,
    providerStatus,
    isAnyOperationRunning: 
      analysis.isAnalyzing || 
      creative.isGenerating || 
      optimization.isOptimizing,
  };
}