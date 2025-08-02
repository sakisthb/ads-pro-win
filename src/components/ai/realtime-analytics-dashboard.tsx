"use client";

// Real-Time Analytics Dashboard with AI Insights
// Live dashboard with WebSocket updates and AI-powered analytics

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnalyticsDashboard } from '@/hooks/use-ai-agents';
import { useAnalyticsWebSocket } from '@/hooks/use-websocket';
import { 
  BarChart3, Activity, TrendingUp, TrendingDown, DollarSign, 
  Users, Target, Clock, Zap, RefreshCw, Eye, MousePointer,
  ShoppingCart, Percent, Calendar, Filter, Download,
  AlertTriangle, CheckCircle, Minus, ArrowUp, ArrowDown
} from 'lucide-react';

interface RealTimeAnalyticsDashboardProps {
  organizationId?: string;
  timeframe?: '1d' | '7d' | '30d' | '90d';
}

interface MetricCardData {
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: any;
  color: string;
  description: string;
}

interface AnalyticsData {
  campaigns: any[];
  analyses: any[];
  optimizations: any[];
  predictions: any[];
  summary: {
    totalCampaigns: number;
    totalAnalyses: number;
    totalOptimizations: number;
    totalPredictions: number;
    avgConfidence: number;
  };
}

const timeframes = [
  { value: '1d', label: 'Last 24 Hours', description: 'Real-time data' },
  { value: '7d', label: 'Last 7 Days', description: 'Weekly overview' },
  { value: '30d', label: 'Last 30 Days', description: 'Monthly summary' },
  { value: '90d', label: 'Last 90 Days', description: 'Quarterly view' },
];

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up': return ArrowUp;
    case 'down': return ArrowDown;
    default: return Minus;
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'up': return 'text-green-600';
    case 'down': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const formatCurrency = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatPercentage = (num: number): string => {
  return `${(num * 100).toFixed(1)}%`;
};

export const RealTimeAnalyticsDashboard: React.FC<RealTimeAnalyticsDashboardProps> = ({
  organizationId,
  timeframe: initialTimeframe = '7d',
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1d' | '7d' | '30d' | '90d'>(initialTimeframe);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Analytics data hook
  const { dashboard, isLoading, error, refetch } = useAnalyticsDashboard(selectedTimeframe);

  // WebSocket for real-time updates
  const { analyticsData, isConnected } = useAnalyticsWebSocket(organizationId);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      refetch();
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, refetch]);

  // Handle real-time analytics updates
  useEffect(() => {
    if (analyticsData) {
      setLastUpdate(new Date());
      // Trigger a refetch to get the latest data
      refetch();
    }
  }, [analyticsData, refetch]);

  // Create metric cards from analytics data
  const metricCards: MetricCardData[] = useMemo(() => {
    if (!dashboard) return [];

    // Calculate sample metrics (in real implementation, these would come from the API)
    const totalBudget = dashboard.campaigns.reduce((sum: number, campaign: any) => sum + (campaign.budget || 0), 0);
    const totalSpent = dashboard.campaigns.reduce((sum: number, campaign: any) => sum + (campaign.budgetSpent || 0), 0);
    const activeCampaigns = dashboard.campaigns.filter((c: any) => c.status === 'active').length;
    
    return [
      {
        title: 'Active Campaigns',
        value: activeCampaigns,
        change: 12.5,
        trend: 'up',
        icon: Target,
        color: 'text-blue-600',
        description: 'Currently running campaigns',
      },
      {
        title: 'Total Budget',
        value: formatCurrency(totalBudget),
        change: 8.3,
        trend: 'up',
        icon: DollarSign,
        color: 'text-green-600',
        description: 'Allocated campaign budget',
      },
      {
        title: 'Budget Spent',
        value: formatCurrency(totalSpent),
        change: -5.2,
        trend: 'down',
        icon: TrendingDown,
        color: 'text-orange-600',
        description: 'Budget utilization',
      },
      {
        title: 'AI Analyses',
        value: dashboard.summary.totalAnalyses,
        change: 25.8,
        trend: 'up',
        icon: BarChart3,
        color: 'text-purple-600',
        description: 'AI insights generated',
      },
      {
        title: 'Optimizations',
        value: dashboard.summary.totalOptimizations,
        change: 15.4,
        trend: 'up',
        icon: Zap,
        color: 'text-yellow-600',
        description: 'AI optimization recommendations',
      },
      {
        title: 'Avg Confidence',
        value: formatPercentage(dashboard.summary.avgConfidence || 0),
        change: 3.1,
        trend: 'up',
        icon: CheckCircle,
        color: 'text-emerald-600',
        description: 'AI prediction confidence',
      },
    ];
  }, [dashboard]);

  // Recent activities from analyses and optimizations
  const recentActivities = useMemo(() => {
    if (!dashboard) return [];

    const activities = [
      ...dashboard.analyses.map((analysis: any) => ({
        type: 'analysis',
        title: `Campaign Analysis: ${analysis.campaign?.name || 'Unknown'}`,
        description: `${analysis.type} analysis completed`,
        time: new Date(analysis.createdAt),
        confidence: analysis.confidence,
        platform: analysis.campaign?.platform,
      })),
      ...dashboard.optimizations.map((optimization: any) => ({
        type: 'optimization',
        title: `Optimization: ${optimization.campaign?.name || 'Unknown'}`,
        description: `${optimization.type} optimization generated`,
        time: new Date(optimization.createdAt),
        platform: optimization.campaign?.platform,
      })),
    ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);

    return activities;
  }, [dashboard]);

  const handleManualRefresh = () => {
    refetch();
    setLastUpdate(new Date());
  };

  const handleTimeframeChange = (newTimeframe: '1d' | '7d' | '30d' | '90d') => {
    setSelectedTimeframe(newTimeframe);
  };

  const selectedTimeframeData = timeframes.find(t => t.value === selectedTimeframe);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading analytics dashboard...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Real-Time Analytics Dashboard</CardTitle>
                <CardDescription>
                  Live campaign performance and AI insights with real-time updates
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <div className="w-2 h-2 bg-red-600 rounded-full mr-2" />
                  Offline
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <Select value={selectedTimeframe} onValueChange={handleTimeframeChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeframes.map((timeframe) => (
                      <SelectItem key={timeframe.value} value={timeframe.value}>
                        <div>
                          <div className="font-medium">{timeframe.label}</div>
                          <div className="text-xs text-gray-500">{timeframe.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isAutoRefresh ? 'animate-spin' : ''}`} />
                  Auto Refresh: {isAutoRefresh ? 'On' : 'Off'}
                </Button>
                
                <Button variant="outline" size="sm" onClick={handleManualRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Now
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">Dashboard Error</h4>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Failed to load analytics data. Please try refreshing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((metric, index) => {
          const TrendIcon = getTrendIcon(metric.trend);
          
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <metric.icon className={`h-5 w-5 ${metric.color}`} />
                    <span className="text-sm font-medium text-gray-600">{metric.title}</span>
                  </div>
                  {metric.trend !== 'stable' && (
                    <div className={`flex items-center space-x-1 ${getTrendColor(metric.trend)}`}>
                      <TrendIcon className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {Math.abs(metric.change).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <div className="text-xs text-gray-500">{metric.description}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Performance Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Campaign Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.campaigns && dashboard.campaigns.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.campaigns.slice(0, 5).map((campaign: any, index: number) => (
                    <div key={campaign.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          campaign.status === 'active' ? 'bg-green-500' :
                          campaign.status === 'paused' ? 'bg-yellow-500' :
                          campaign.status === 'completed' ? 'bg-blue-500' : 'bg-gray-500'
                        }`} />
                        <div>
                          <h4 className="font-medium">{campaign.name}</h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>{campaign.platform}</span>
                            <span>•</span>
                            <span className="capitalize">{campaign.status}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(campaign.budgetSpent || 0)} / {formatCurrency(campaign.budget || 0)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {((campaign.budgetSpent || 0) / (campaign.budget || 1) * 100).toFixed(1)}% spent
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No campaign data available</p>
                  <p className="text-sm">Create campaigns to see performance metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent AI Activities */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Recent AI Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        activity.type === 'analysis' ? 'bg-purple-500' : 'bg-orange-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{activity.title}</h4>
                        <p className="text-xs text-gray-600">{activity.description}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">
                            {activity.time.toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Live
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent AI activities</p>
                  <p className="text-sm">Run AI analysis to see activity history</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Run Campaign Analysis
              </Button>
              
              <Button variant="outline" className="w-full" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Optimize Performance
              </Button>
              
              <Button variant="outline" className="w-full" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Insights Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{dashboard?.summary.totalAnalyses || 0}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300">AI Analyses</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{dashboard?.summary.totalOptimizations || 0}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300">Optimizations</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{dashboard?.summary.totalPredictions || 0}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Predictions</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(dashboard?.summary.avgConfidence || 0)}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Avg Confidence</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeAnalyticsDashboard;