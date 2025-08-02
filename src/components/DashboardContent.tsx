'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, Zap, TrendingUp, DollarSign, Target,
  Activity, Brain, Palette, RefreshCw, Settings, 
  Globe, Users, Eye, MousePointer
} from 'lucide-react';

// Performance optimized dashboard content with AI integration
const DashboardContent = React.memo(() => {
  const [showAIWorkspace, setShowAIWorkspace] = useState(false);
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demonstration (replace with real API calls when ready)
  const dashboardStats = useMemo(() => ({
    totalCampaigns: 15,
    activeCampaigns: 12,
    totalSpend: 45231,
    totalImpressions: 2100000,
    conversionRate: 8.4,
    avgROI: 127.5
  }), []);

  // Mock AI stats for demonstration
  const aiStats = useMemo(() => ({
    totalAnalyses: 24,
    totalOptimizations: 18,
    avgConfidence: 0.92,
    recentActivities: 6
  }), []);

  // Memoize callback functions
  const handleRefresh = useCallback(async () => {
    console.log('Refreshing dashboard...');
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const handleShowAIWorkspace = useCallback(() => {
    setShowAIWorkspace(!showAIWorkspace);
  }, [showAIWorkspace]);

  return (
    <div className="space-y-6">
      {/* Header with AI Features Toggle */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Ads Pro Enterprise Dashboard</CardTitle>
                <CardDescription>
                  Real-time campaign analytics with AI-powered insights
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                WebSocket Connected
              </Badge>
              
              <Button
                onClick={handleRefresh}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                onClick={handleShowAIWorkspace}
                variant={showAIWorkspace ? "default" : "outline"}
                size="sm"
              >
                <Brain className="h-4 w-4 mr-2" />
                {showAIWorkspace ? 'Hide AI Tools' : 'Show AI Tools'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Campaign Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Campaigns</h3>
                <p className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-12 rounded" />
                  ) : (
                    dashboardStats.totalCampaigns
                  )}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
                <p className="text-2xl font-bold text-green-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-12 rounded" />
                  ) : (
                    dashboardStats.activeCampaigns
                  )}
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Spend</h3>
                <p className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-16 rounded" />
                  ) : (
                    `$${dashboardStats.totalSpend.toLocaleString()}`
                  )}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Conversion Rate</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-14 rounded" />
                  ) : (
                    `${dashboardStats.conversionRate}%`
                  )}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Impressions</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-14 rounded" />
                  ) : (
                    `${(dashboardStats.totalImpressions / 1000000).toFixed(1)}M`
                  )}
                </p>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            AI-Powered Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {isLoading ? (
                  <div className="animate-pulse bg-purple-200 dark:bg-purple-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  aiStats.totalAnalyses
                )}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">AI Analyses</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {isLoading ? (
                  <div className="animate-pulse bg-orange-200 dark:bg-orange-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  aiStats.totalOptimizations
                )}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">Optimizations</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? (
                  <div className="animate-pulse bg-green-200 dark:bg-green-700 h-6 w-12 rounded mx-auto" />
                ) : (
                  `${(aiStats.avgConfidence * 100).toFixed(0)}%`
                )}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Avg Confidence</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {isLoading ? (
                  <div className="animate-pulse bg-blue-200 dark:bg-blue-700 h-6 w-8 rounded mx-auto" />
                ) : (
                  aiStats.recentActivities
                )}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Recent Activities</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Workspace Integration */}
      {showAIWorkspace && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Zap className="h-5 w-5 mr-2 text-orange-600" />
                AI-Powered Campaign Workspace
              </CardTitle>
              <Button 
                onClick={handleShowAIWorkspace}
                variant="ghost"
                size="sm"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* AI Workspace Tabs */}
              <div className="flex space-x-4 border-b border-gray-200">
                <button className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                  Analytics
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                  Optimization
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                  Creative Generation
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                  Predictions
                </button>
              </div>
              
              {/* AI Workspace Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Real-time Analysis</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Analyzing Campaign Performance...</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Budget Efficiency</span>
                        <span className="font-medium text-green-600">+15% improvement</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Audience Targeting</span>
                        <span className="font-medium text-blue-600">92% accuracy</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Creative Performance</span>
                        <span className="font-medium text-orange-600">Needs optimization</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">AI Recommendations</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <p className="text-sm font-medium text-blue-800">Budget Reallocation</p>
                      <p className="text-xs text-blue-600">Shift 12% budget from Campaign A to Campaign C for +$2,400 revenue</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                      <p className="text-sm font-medium text-green-800">Audience Expansion</p>
                      <p className="text-xs text-green-600">Target new segment: Tech professionals aged 25-35 (+18% conversion rate)</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                      <p className="text-sm font-medium text-orange-800">Creative Testing</p>
                      <p className="text-xs text-orange-600">Test video vs. carousel ads for 30% engagement improvement</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => setShowAIWorkspace(true)}
              className="w-full"
              variant="outline"
            >
              <Brain className="h-4 w-4 mr-2" />
              Launch AI Analysis
            </Button>
            
            <Button 
              onClick={() => setShowAIWorkspace(true)}
              className="w-full"
              variant="outline"
            >
              <Palette className="h-4 w-4 mr-2" />
              Generate Creatives
            </Button>
            
            <Button 
              onClick={() => setShowAIWorkspace(true)}
              className="w-full"
              variant="outline"
            >
              <Zap className="h-4 w-4 mr-2" />
              Optimize Performance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

DashboardContent.displayName = 'DashboardContent';

export default DashboardContent; 