import React, { useMemo, useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useAnalyticsDashboard } from '@/hooks/use-ai-agents';
import { useAIWebSocket } from '@/hooks/use-websocket';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, 
  Eye, MousePointer, Target, Download, RefreshCw,
  Activity, Zap, Brain, ArrowUp, ArrowDown, Minus
} from 'lucide-react';

// Performance optimized analytics widget with real-time AI integration
const AnalyticsWidget = React.memo(() => {
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');

  // Real-time campaign data
  const { campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useCampaigns({
    status: 'active',
    limit: 10,
  });

  // Real-time analytics dashboard data
  const { dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useAnalyticsDashboard(timeRange);

  // WebSocket connection for real-time updates
  const { isConnected, aiOperation } = useAIWebSocket("demo-org-123");

  // Memoize analytics data from real campaigns
  const analyticsData = useMemo(() => {
    if (campaignsLoading || !campaigns || campaigns.length === 0) {
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        totalSpend: 0,
        totalBudget: 0
      };
    }

    // Calculate aggregated metrics from actual campaigns
    const totals = campaigns.reduce((acc, campaign) => {
      const performance = campaign.performance as any || {};
      return {
        impressions: acc.impressions + (performance.impressions || 0),
        clicks: acc.clicks + (performance.clicks || 0),
        conversions: acc.conversions + (performance.conversions || 0),
        totalSpend: acc.totalSpend + (campaign.budgetSpent || 0),
        totalBudget: acc.totalBudget + (campaign.budget || 0),
      };
    }, {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      totalSpend: 0,
      totalBudget: 0,
    });

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
    const cpc = totals.clicks > 0 ? (totals.totalSpend / totals.clicks) : 0;
    const cpa = totals.conversions > 0 ? (totals.totalSpend / totals.conversions) : 0;

    return {
      ...totals,
      ctr,
      cpc,
      cpa
    };
  }, [campaigns, campaignsLoading]);

  // Memoize calculated metrics
  const performanceMetrics = useMemo(() => ({
    conversionRate: analyticsData.clicks > 0 ? (analyticsData.conversions / analyticsData.clicks * 100).toFixed(2) : '0.00',
    costPerConversion: analyticsData.cpa.toFixed(2),
    totalCost: analyticsData.totalSpend.toFixed(2),
    budgetUtilization: analyticsData.totalBudget > 0 ? (analyticsData.totalSpend / analyticsData.totalBudget * 100).toFixed(1) : '0.0',
    roi: analyticsData.totalSpend > 0 ? ((analyticsData.conversions * 50 - analyticsData.totalSpend) / analyticsData.totalSpend * 100).toFixed(1) : '0.0' // Assuming $50 value per conversion
  }), [analyticsData]);

  // Memoize AI insights from dashboard
  const aiInsights = useMemo(() => ({
    totalAnalyses: dashboard?.summary?.totalAnalyses || 0,
    totalOptimizations: dashboard?.summary?.totalOptimizations || 0,
    avgConfidence: dashboard?.summary?.avgConfidence || 0,
    recentActivities: dashboard?.analyses?.length || 0,
    isProcessing: aiOperation.isRunning
  }), [dashboard, aiOperation]);

  // Memoize callback functions
  const handleTimeRangeChange = useCallback((range: '1d' | '7d' | '30d' | '90d') => {
    setTimeRange(range);
  }, []);

  const handleRefresh = useCallback(async () => {
    console.log('Refreshing analytics data...');
    await Promise.all([
      refetchCampaigns(),
      refetchDashboard()
    ]);
  }, [refetchCampaigns, refetchDashboard]);

  const handleExport = useCallback(() => {
    console.log('Exporting analytics data...');
    // Create CSV data
    const csvData = [
      ['Metric', 'Value'],
      ['Impressions', analyticsData.impressions.toString()],
      ['Clicks', analyticsData.clicks.toString()],
      ['Conversions', analyticsData.conversions.toString()],
      ['CTR (%)', analyticsData.ctr.toFixed(2)],
      ['CPC ($)', analyticsData.cpc.toFixed(2)],
      ['CPA ($)', analyticsData.cpa.toFixed(2)],
      ['Total Spend ($)', analyticsData.totalSpend.toFixed(2)],
      ['Conversion Rate (%)', performanceMetrics.conversionRate],
      ['ROI (%)', performanceMetrics.roi]
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analyticsData, performanceMetrics, timeRange]);

  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }, []);

  const getTrendIcon = useCallback((value: number) => {
    if (value > 0) return ArrowUp;
    if (value < 0) return ArrowDown;
    return Minus;
  }, []);

  const getTrendColor = useCallback((value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-xl">Analytics Overview</CardTitle>
              <CardDescription>
                Real-time performance metrics with AI insights
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isConnected && aiInsights.isProcessing && (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                AI Processing
              </Badge>
            )}
            
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleRefresh}
              disabled={campaignsLoading || dashboardLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${(campaignsLoading || dashboardLoading) ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-500">Impressions</h3>
            </div>
            <p className="text-2xl font-bold">
              {campaignsLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-16 rounded" />
              ) : (
                formatNumber(analyticsData.impressions)
              )}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <MousePointer className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-gray-500">Clicks</h3>
            </div>
            <p className="text-2xl font-bold">
              {campaignsLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-12 rounded" />
              ) : (
                formatNumber(analyticsData.clicks)
              )}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-medium text-gray-500">Conversions</h3>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {campaignsLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-12 rounded" />
              ) : (
                formatNumber(analyticsData.conversions)
              )}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-medium text-gray-500">CTR</h3>
            </div>
            <p className="text-2xl font-bold">
              {campaignsLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-10 rounded" />
              ) : (
                `${analyticsData.ctr.toFixed(2)}%`
              )}
            </p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-green-600" />
              Performance Metrics
            </h3>
            {aiInsights.isProcessing && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <Zap className="h-3 w-3 mr-1 animate-pulse" />
                AI Analyzing
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</span>
                <span className="text-sm font-bold text-purple-600">{performanceMetrics.conversionRate}%</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Cost per Conversion</span>
                <span className="text-sm font-bold text-orange-600">${performanceMetrics.costPerConversion}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Budget Utilization</span>
                <span className="text-sm font-bold text-blue-600">{performanceMetrics.budgetUtilization}%</span>
              </div>
              <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">ROI</span>
                <div className="flex items-center space-x-1">
                  {(() => {
                    const roiValue = parseFloat(performanceMetrics.roi);
                    const TrendIcon = getTrendIcon(roiValue);
                    const trendColor = getTrendColor(roiValue);
                    return (
                      <>
                        <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                        <span className={`text-sm font-bold ${trendColor}`}>
                          {performanceMetrics.roi}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Brain className="h-5 w-5 mr-2 text-purple-600" />
              AI Insights
            </h3>
            <Badge variant="outline" className={isConnected ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}>
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {dashboardLoading ? (
                  <div className="animate-pulse bg-purple-200 dark:bg-purple-700 h-5 w-6 rounded mx-auto" />
                ) : (
                  aiInsights.totalAnalyses
                )}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300">Analyses</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                {dashboardLoading ? (
                  <div className="animate-pulse bg-orange-200 dark:bg-orange-700 h-5 w-6 rounded mx-auto" />
                ) : (
                  aiInsights.totalOptimizations
                )}
              </div>
              <div className="text-xs text-orange-700 dark:text-orange-300">Optimizations</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {dashboardLoading ? (
                  <div className="animate-pulse bg-green-200 dark:bg-green-700 h-5 w-8 rounded mx-auto" />
                ) : (
                  `${(aiInsights.avgConfidence * 100).toFixed(0)}%`
                )}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">Confidence</div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {dashboardLoading ? (
                  <div className="animate-pulse bg-blue-200 dark:bg-blue-700 h-5 w-6 rounded mx-auto" />
                ) : (
                  aiInsights.recentActivities
                )}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Activities</div>
            </div>
          </div>
        </div>

        {/* Real-time Performance Chart */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Performance Trends
          </h3>
          
          <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-700">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Real-time Performance Chart</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI-powered analytics visualization</p>
              {aiInsights.isProcessing && (
                <p className="text-xs text-blue-600 mt-1 flex items-center justify-center">
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  Processing live data...
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AnalyticsWidget.displayName = 'AnalyticsWidget';

export default AnalyticsWidget; 