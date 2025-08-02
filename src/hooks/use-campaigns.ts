// Campaign Management React Hooks
// Custom hooks for campaign CRUD operations

import { api } from "@/lib/trpc/client";

// Create Campaign Hook
export function useCreateCampaign() {
  const createMutation = api.campaigns.create.useMutation({
    onSuccess: (data) => {
      console.log("Campaign created successfully:", data);
    },
    onError: (error) => {
      console.error("Campaign creation failed:", error);
    },
  });

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    error: createMutation.error,
    data: createMutation.data?.data,
  };
}

// Update Campaign Hook
export function useUpdateCampaign() {
  const updateMutation = api.campaigns.update.useMutation({
    onSuccess: (data) => {
      console.log("Campaign updated successfully:", data);
    },
    onError: (error) => {
      console.error("Campaign update failed:", error);
    },
  });

  return {
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error,
    data: updateMutation.data?.data,
  };
}

// Get Campaign Hook
export function useCampaign(campaignId?: string) {
  const { data, isLoading, error, refetch } = api.campaigns.getById.useQuery(
    { id: campaignId! },
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

// Get All Campaigns Hook
export function useCampaigns(filters?: {
  status?: 'draft' | 'active' | 'paused' | 'completed';
  platform?: 'facebook' | 'google' | 'tiktok' | 'instagram' | 'linkedin';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}) {
  const { data, isLoading, error, refetch } = api.campaigns.getAll.useQuery(
    filters,
    {
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  return {
    campaigns: data?.data.campaigns || [],
    pagination: data?.data.pagination,
    isLoading,
    error,
    refetch,
  };
}

// Delete Campaign Hook
export function useDeleteCampaign() {
  const deleteMutation = api.campaigns.delete.useMutation({
    onSuccess: (data) => {
      console.log("Campaign deleted successfully:", data);
    },
    onError: (error) => {
      console.error("Campaign deletion failed:", error);
    },
  });

  return {
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    error: deleteMutation.error,
  };
}

// Update Campaign Status Hook
export function useUpdateCampaignStatus() {
  const updateStatusMutation = api.campaigns.updateStatus.useMutation({
    onSuccess: (data) => {
      console.log("Campaign status updated:", data);
    },
    onError: (error) => {
      console.error("Campaign status update failed:", error);
    },
  });

  return {
    updateStatus: updateStatusMutation.mutate,
    updateStatusAsync: updateStatusMutation.mutateAsync,
    isUpdating: updateStatusMutation.isPending,
    error: updateStatusMutation.error,
  };
}

// Update Campaign Performance Hook
export function useUpdateCampaignPerformance() {
  const updatePerformanceMutation = api.campaigns.updatePerformance.useMutation({
    onSuccess: (data) => {
      console.log("Campaign performance updated:", data);
    },
    onError: (error) => {
      console.error("Campaign performance update failed:", error);
    },
  });

  return {
    updatePerformance: updatePerformanceMutation.mutate,
    updatePerformanceAsync: updatePerformanceMutation.mutateAsync,
    isUpdating: updatePerformanceMutation.isPending,
    error: updatePerformanceMutation.error,
  };
}

// Campaign Statistics Hook
export function useCampaignStatistics() {
  const { data, isLoading, error, refetch } = api.campaigns.getStatistics.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });

  return {
    statistics: data?.data,
    isLoading,
    error,
    refetch,
  };
}

// Duplicate Campaign Hook
export function useDuplicateCampaign() {
  const duplicateMutation = api.campaigns.duplicate.useMutation({
    onSuccess: (data) => {
      console.log("Campaign duplicated successfully:", data);
    },
    onError: (error) => {
      console.error("Campaign duplication failed:", error);
    },
  });

  return {
    duplicate: duplicateMutation.mutate,
    duplicateAsync: duplicateMutation.mutateAsync,
    isDuplicating: duplicateMutation.isPending,
    error: duplicateMutation.error,
    data: duplicateMutation.data?.data,
  };
}

// Combined Campaign Operations Hook
export function useCampaignOperations(campaignId?: string) {
  const campaign = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();
  const updateStatus = useUpdateCampaignStatus();
  const updatePerformance = useUpdateCampaignPerformance();
  const deleteCampaign = useDeleteCampaign();
  const duplicateCampaign = useDuplicateCampaign();

  return {
    campaign: campaign.campaign,
    isLoading: campaign.isLoading,
    error: campaign.error,
    refetch: campaign.refetch,
    update: updateCampaign.update,
    updateStatus: updateStatus.updateStatus,
    updatePerformance: updatePerformance.updatePerformance,
    delete: deleteCampaign.delete,
    duplicate: duplicateCampaign.duplicate,
    isUpdating: updateCampaign.isUpdating || updateStatus.isUpdating || updatePerformance.isUpdating,
    isDeleting: deleteCampaign.isDeleting,
    isDuplicating: duplicateCampaign.isDuplicating,
    operationError: updateCampaign.error || updateStatus.error || updatePerformance.error || deleteCampaign.error || duplicateCampaign.error,
  };
}

// Campaigns with AI Context Hook
export function useCampaignsWithAI(filters?: {
  status?: 'draft' | 'active' | 'paused' | 'completed';
  platform?: 'facebook' | 'google' | 'tiktok' | 'instagram' | 'linkedin';
  limit?: number;
}) {
  const campaigns = useCampaigns(filters);
  const statistics = useCampaignStatistics();

  return {
    campaigns: campaigns.campaigns,
    statistics: statistics.statistics,
    isLoading: campaigns.isLoading || statistics.isLoading,
    error: campaigns.error || statistics.error,
    refetch: () => {
      campaigns.refetch();
      statistics.refetch();
    },
  };
}