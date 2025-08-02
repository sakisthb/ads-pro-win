import React, { useMemo, useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AIAnalysisPanel, CreativeGenerationPanel } from '@/components/ai';
import { useCampaigns, useCreateCampaign, useUpdateCampaign } from '@/hooks/use-campaigns';
import { useCampaignAnalysis, useOptimization } from '@/hooks/use-ai-agents';
import { useAIWebSocket } from '@/hooks/use-websocket';
import { 
  Plus, PlayCircle, PauseCircle, StopCircle, Edit, 
  BarChart3, Zap, Brain, Target, TrendingUp, 
  DollarSign, Activity, Users, Eye, MousePointer,
  Palette, Settings, MoreVertical, Calendar,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';

// Performance optimized campaign manager with AI integration
const CampaignManager = React.memo(() => {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelType, setAIPanelType] = useState<'analysis' | 'creative' | 'optimization'>('analysis');

  // Real-time campaign data
  const { 
    campaigns, 
    isLoading: campaignsLoading, 
    refetch: refetchCampaigns 
  } = useCampaigns({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 50,
  });

  // Campaign CRUD operations
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  // AI operations for selected campaign
  const { analyze, isAnalyzing } = useCampaignAnalysis();
  const { optimize, isOptimizing } = useOptimization();

  // WebSocket connection for real-time updates
  const { isConnected, aiOperation } = useAIWebSocket("demo-org-123");

  // Memoize filtered campaigns
  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    return statusFilter === 'all' 
      ? campaigns 
      : campaigns.filter(campaign => campaign.status === statusFilter);
  }, [campaigns, statusFilter]);

  // Memoize campaign stats
  const campaignStats = useMemo(() => {
    if (!campaigns || campaigns.length === 0) {
      return {
        total: 0,
        active: 0,
        paused: 0,
        draft: 0,
        totalSpend: 0,
        avgROI: 0
      };
    }

    const stats = campaigns.reduce((acc, campaign) => {
      acc.total += 1;
      acc[campaign.status as keyof typeof acc] = (acc[campaign.status as keyof typeof acc] || 0) + 1;
      acc.totalSpend += campaign.budgetSpent || 0;
      return acc;
    }, {
      total: 0,
      active: 0,
      paused: 0,
      draft: 0,
      totalSpend: 0,
      avgROI: 0
    });

    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    stats.avgROI = totalBudget > 0 ? (stats.totalSpend / totalBudget) * 100 : 0;

    return stats;
  }, [campaigns]);

  // Memoize callback functions
  const handleCampaignSelect = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId);
  }, []);

  const handleStatusChange = useCallback(async (campaignId: string, newStatus: string) => {
    try {
      await updateCampaign.mutateAsync({
        id: campaignId,
        status: newStatus as any,
      });
      console.log(`Campaign ${campaignId} status changed to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update campaign status:', error);
    }
  }, [updateCampaign]);

  const handleCreateCampaign = useCallback(() => {
    // This would typically open a modal or navigate to a creation page
    console.log('Creating new campaign...');
  }, []);

  const handleAIAnalysis = useCallback(async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setAIPanelType('analysis');
    setShowAIPanel(true);
    
    try {
      await analyze({
        campaignId,
        analysisType: 'comprehensive',
        provider: 'openai',
      });
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  }, [analyze]);

  const handleOptimization = useCallback(async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setAIPanelType('optimization');
    setShowAIPanel(true);
    
    try {
      await optimize({
        campaignId,
        optimizationType: 'comprehensive',
        provider: 'openai',
      });
    } catch (error) {
      console.error('AI optimization failed:', error);
    }
  }, [optimize]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active': return PlayCircle;
      case 'paused': return PauseCircle;
      case 'stopped': return StopCircle;
      default: return Edit;
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 border-green-600';
      case 'paused': return 'text-yellow-600 border-yellow-600';
      case 'stopped': return 'text-red-600 border-red-600';
      default: return 'text-gray-600 border-gray-600';
    }
  }, []);

  const getTrendIcon = useCallback((change: number) => {
    if (change > 0) return ArrowUp;
    if (change < 0) return ArrowDown;
    return Minus;
  }, []);

  const getTrendColor = useCallback((change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  }, []);

  return (
    <div className="space-y-6">
      {/* Campaign Manager Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Campaign Manager</CardTitle>
                <CardDescription>
                  Manage campaigns with AI-powered insights and optimization
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {isConnected && aiOperation.isRunning && (
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  AI Processing
                </Badge>
              )}
              
              <Button
                onClick={handleCreateCampaign}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Campaign Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaign Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {campaignsLoading ? (
                  <div className="animate-pulse bg-blue-200 dark:bg-blue-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  campaignStats.total
                )}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Total Campaigns</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {campaignsLoading ? (
                  <div className="animate-pulse bg-green-200 dark:bg-green-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  campaignStats.active
                )}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Active</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {campaignsLoading ? (
                  <div className="animate-pulse bg-yellow-200 dark:bg-yellow-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  campaignStats.paused
                )}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Paused</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {campaignsLoading ? (
                  <div className="animate-pulse bg-purple-200 dark:bg-purple-700 h-6 w-12 rounded mx-auto" />
                ) : (
                  formatCurrency(campaignStats.totalSpend)
                )}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">Total Spend</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Filters and List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">Campaigns</CardTitle>
              <Badge variant="secondary">
                {filteredCampaigns.length} campaigns
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={() => setShowAIPanel(!showAIPanel)}
                variant={showAIPanel ? "default" : "outline"}
                size="sm"
              >
                <Brain className="h-4 w-4 mr-2" />
                AI Tools
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {campaignsLoading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : filteredCampaigns.length > 0 ? (
              filteredCampaigns.map(campaign => {
                const StatusIcon = getStatusIcon(campaign.status);
                const statusColor = getStatusColor(campaign.status);
                const performance = campaign.performance as any || {};
                
                return (
                  <div 
                    key={campaign.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedCampaign === campaign.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => handleCampaignSelect(campaign.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <StatusIcon className={`h-4 w-4 ${statusColor.split(' ')[0]}`} />
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {campaign.name}
                          </h3>
                          <Badge variant="outline" className={statusColor}>
                            {campaign.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(campaign.budgetSpent || 0)} spent
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Eye className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {performance.impressions ? `${(performance.impressions / 1000).toFixed(0)}K` : '0'} impressions
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <MousePointer className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {performance.clicks || 0} clicks
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {performance.ctr ? `${performance.ctr.toFixed(2)}%` : '0%'} CTR
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAIAnalysis(campaign.id);
                          }}
                          disabled={isAnalyzing}
                          variant="outline"
                          size="sm"
                        >
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Analyze
                        </Button>
                        
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOptimization(campaign.id);
                          }}
                          disabled={isOptimizing}
                          variant="outline"
                          size="sm"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Optimize
                        </Button>
                        
                        <Select 
                          value={campaign.status}
                          onValueChange={(newStatus) => handleStatusChange(campaign.id, newStatus)}
                        >
                          <SelectTrigger className="w-20" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="stopped">Stopped</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No campaigns found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Create your first campaign to get started with AI-powered advertising.
                </p>
                <Button onClick={handleCreateCampaign} className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Panel Integration */}
      {showAIPanel && selectedCampaign && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Brain className="h-5 w-5 mr-2 text-purple-600" />
                AI Campaign Tools
              </CardTitle>
              <Button 
                onClick={() => setShowAIPanel(false)}
                variant="ghost"
                size="sm"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 mb-4">
              <Button
                onClick={() => setAIPanelType('analysis')}
                variant={aiPanelType === 'analysis' ? 'default' : 'outline'}
                size="sm"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analysis
              </Button>
              <Button
                onClick={() => setAIPanelType('creative')}
                variant={aiPanelType === 'creative' ? 'default' : 'outline'}
                size="sm"
              >
                <Palette className="h-4 w-4 mr-2" />
                Creative
              </Button>
              <Button
                onClick={() => setAIPanelType('optimization')}
                variant={aiPanelType === 'optimization' ? 'default' : 'outline'}
                size="sm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Optimize
              </Button>
            </div>
            
            {aiPanelType === 'analysis' && (
              <AIAnalysisPanel 
                campaignId={selectedCampaign}
                organizationId="demo-org-123"
              />
            )}
            
            {aiPanelType === 'creative' && (
              <CreativeGenerationPanel 
                campaignId={selectedCampaign}
                organizationId="demo-org-123"
              />
            )}
            
            {aiPanelType === 'optimization' && (
              <div className="text-center py-8 text-gray-500">
                <Zap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p>Optimization panel will be implemented here</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

CampaignManager.displayName = 'CampaignManager';

export default CampaignManager; 