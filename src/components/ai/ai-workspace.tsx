"use client";

// AI Workspace - Complete AI Features Integration
// Main workspace component that integrates all AI features with campaign management

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AIAnalysisPanel,
  CreativeGenerationPanel,
  OptimizationDashboard,
  RealTimeAnalyticsDashboard,
  WebSocketStatusBadge
} from './index';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useAIWebSocket } from '@/hooks/use-websocket';
import { 
  Brain, Palette, Zap, BarChart3, Settings, 
  Plus, Search, Filter, Clock, Users,
  Target, TrendingUp, Activity, RefreshCw
} from 'lucide-react';

interface AIWorkspaceProps {
  organizationId?: string;
  initialCampaignId?: string;
  defaultTab?: 'analysis' | 'creative' | 'optimization' | 'analytics';
}

const workspaceTabs = [
  {
    id: 'analysis',
    label: 'Campaign Analysis',
    icon: Brain,
    description: 'AI-powered campaign insights and recommendations',
    color: 'text-purple-600',
  },
  {
    id: 'creative',
    label: 'Creative Generation',
    icon: Palette,
    description: 'Generate compelling ad creative with AI',
    color: 'text-pink-600',
  },
  {
    id: 'optimization',
    label: 'Performance Optimization',
    icon: Zap,
    description: 'Optimize campaigns for better performance',
    color: 'text-orange-600',
  },
  {
    id: 'analytics',
    label: 'Real-Time Analytics',
    icon: BarChart3,
    description: 'Live performance metrics and insights',
    color: 'text-blue-600',
  },
];

export const AIWorkspace: React.FC<AIWorkspaceProps> = ({
  organizationId,
  initialCampaignId,
  defaultTab = 'analytics',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(initialCampaignId || '');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('active');
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  // Campaign data
  const { campaigns, isLoading: campaignsLoading } = useCampaigns({
    status: campaignFilter === 'all' ? undefined : campaignFilter,
    limit: 50,
  });

  // WebSocket connection for real-time updates
  const { isConnected, aiOperation } = useAIWebSocket(organizationId);

  // Initialize workspace when campaigns are loaded
  useEffect(() => {
    if (!campaignsLoading && campaigns.length > 0 && !selectedCampaignId) {
      // Auto-select first active campaign
      const activeCampaign = campaigns.find(c => c.status === 'active');
      if (activeCampaign) {
        setSelectedCampaignId(activeCampaign.id);
      }
    }
    
    if (!campaignsLoading) {
      setIsWorkspaceReady(true);
    }
  }, [campaigns, campaignsLoading, selectedCampaignId]);

  const handleCampaignSelect = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
  }, []);

  const handleAnalysisComplete = useCallback((result: any) => {
    console.log('Analysis completed:', result);
    // You could add notifications or update other components here
  }, []);

  const handleCreativeGenerated = useCallback((result: any) => {
    console.log('Creative generated:', result);
    // You could add the generated creative to a list or trigger other actions
  }, []);

  const handleOptimizationComplete = useCallback((result: any) => {
    console.log('Optimization completed:', result);
    // You could trigger campaign updates or show optimization suggestions
  }, []);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const activeTabData = workspaceTabs.find(tab => tab.id === activeTab);

  if (!isWorkspaceReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-medium mb-2">Loading AI Workspace</h3>
          <p className="text-gray-600">Preparing your AI-powered campaign management tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI-Powered Campaign Workspace</CardTitle>
                <CardDescription>
                  Complete suite of AI tools for campaign analysis, optimization, and creative generation
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* AI Operation Status */}
              {aiOperation.isRunning && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-800">
                  <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    AI Processing ({aiOperation.progress}%)
                  </span>
                </div>
              )}
              
              {/* WebSocket Status */}
              <WebSocketStatusBadge organizationId={organizationId} />
              
              {/* Workspace Settings */}
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Campaign Selection & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4 flex-1">
              {/* Campaign Selector */}
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Campaign:</span>
                <Select value={selectedCampaignId} onValueChange={handleCampaignSelect}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            campaign.status === 'active' ? 'bg-green-500' :
                            campaign.status === 'paused' ? 'bg-yellow-500' :
                            campaign.status === 'completed' ? 'bg-blue-500' : 'bg-gray-500'
                          }`} />
                          <span>{campaign.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {campaign.platform}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campaign Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <Select value={campaignFilter} onValueChange={(value: any) => setCampaignFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Stats */}
            {selectedCampaign && (
              <div className="flex items-center space-x-4 text-sm">
                <div className="text-center">
                  <div className="font-medium">${selectedCampaign.budgetSpent || 0}</div>
                  <div className="text-gray-500">Spent</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">${selectedCampaign.budget || 0}</div>
                  <div className="text-gray-500">Budget</div>
                </div>
                <div className="text-center">
                  <div className="font-medium capitalize">{selectedCampaign.status}</div>
                  <div className="text-gray-500">Status</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Workspace Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <Card>
          <CardHeader className="pb-3">
            <TabsList className="grid grid-cols-4 w-full">
              {workspaceTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${tab.color}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {/* Active Tab Description */}
            {activeTabData && (
              <div className="pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <activeTabData.icon className={`h-5 w-5 ${activeTabData.color}`} />
                  <div>
                    <h3 className="font-medium">{activeTabData.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activeTabData.description}</p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Tab Content */}
        <div className="mt-6">
          <TabsContent value="analysis" className="space-y-6">
            <AIAnalysisPanel
              campaignId={selectedCampaignId}
              organizationId={organizationId}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </TabsContent>

          <TabsContent value="creative" className="space-y-6">
            <CreativeGenerationPanel
              campaignId={selectedCampaignId}
              organizationId={organizationId}
              onCreativeGenerated={handleCreativeGenerated}
            />
          </TabsContent>

          <TabsContent value="optimization" className="space-y-6">
            <OptimizationDashboard
              campaignId={selectedCampaignId}
              organizationId={organizationId}
              onOptimizationComplete={handleOptimizationComplete}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <RealTimeAnalyticsDashboard
              organizationId={organizationId}
              timeframe="7d"
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Quick Actions Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium">Quick Actions</h4>
              {selectedCampaign && (
                <Badge variant="outline">
                  {selectedCampaign.name}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={!selectedCampaignId || !isConnected}
                onClick={() => setActiveTab('analysis')}
              >
                <Brain className="h-4 w-4 mr-1" />
                Quick Analysis
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                disabled={!selectedCampaignId || !isConnected}
                onClick={() => setActiveTab('optimization')}
              >
                <Zap className="h-4 w-4 mr-1" />
                Optimize Now
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('creative')}
              >
                <Palette className="h-4 w-4 mr-1" />
                Generate Creative
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Campaign Selected State */}
      {!selectedCampaignId && campaigns.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Select a Campaign</h3>
            <p className="text-gray-600 mb-4">
              Choose a campaign from the dropdown above to start using AI-powered tools
            </p>
            <Button onClick={() => handleCampaignSelect(campaigns[0].id)}>
              <Plus className="h-4 w-4 mr-2" />
              Select First Campaign
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No Campaigns State */}
      {campaigns.length === 0 && !campaignsLoading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Campaigns Found</h3>
            <p className="text-gray-600 mb-4">
              Create your first campaign to start using AI-powered optimization tools
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIWorkspace;