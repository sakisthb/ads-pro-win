'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Eye,
  MousePointer,
  ShoppingCart,
  Activity
} from 'lucide-react';

// Types for analytics data
interface AnalyticsData {
  id: string;
  organizationId: string;
  period: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
  };
  breakdown: {
    byPlatform: PlatformData[];
    byAudience: AudienceData[];
    byCreative: CreativeData[];
    byTime: TimeData[];
  };
  aiInsights: AIInsight[];
  timestamp: Date;
}

interface PlatformData {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface AudienceData {
  segment: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface CreativeData {
  creativeId: string;
  name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface TimeData {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

interface AIInsight {
  id: string;
  type: 'performance' | 'opportunity' | 'warning' | 'trend';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  recommendations: string[];
}

// Mock data for demonstration
const mockAnalyticsData: AnalyticsData = {
  id: 'analytics_1',
  organizationId: 'org_1',
  period: 'last_30_days',
  metrics: {
    impressions: 1250000,
    clicks: 45000,
    conversions: 2250,
    spend: 15000,
    revenue: 67500,
    ctr: 3.6,
    cpc: 0.33,
    cpa: 6.67,
    roas: 4.5,
  },
  breakdown: {
    byPlatform: [
      { platform: 'Facebook', impressions: 500000, clicks: 18000, conversions: 900, spend: 6000, revenue: 27000, ctr: 3.6, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { platform: 'Google', impressions: 400000, clicks: 15000, conversions: 750, spend: 5000, revenue: 22500, ctr: 3.75, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { platform: 'TikTok', impressions: 200000, clicks: 8000, conversions: 400, spend: 2500, revenue: 12000, ctr: 4.0, cpc: 0.31, cpa: 6.25, roas: 4.8 },
      { platform: 'LinkedIn', impressions: 150000, clicks: 4000, conversions: 200, spend: 1500, revenue: 6000, ctr: 2.67, cpc: 0.38, cpa: 7.5, roas: 4.0 },
    ],
    byAudience: [
      { segment: '25-34', impressions: 400000, clicks: 15000, conversions: 750, spend: 5000, revenue: 22500, ctr: 3.75, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { segment: '35-44', impressions: 350000, clicks: 12000, conversions: 600, spend: 4000, revenue: 18000, ctr: 3.43, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { segment: '45-54', impressions: 250000, clicks: 9000, conversions: 450, spend: 3000, revenue: 13500, ctr: 3.6, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { segment: '18-24', impressions: 250000, clicks: 9000, conversions: 450, spend: 3000, revenue: 13500, ctr: 3.6, cpc: 0.33, cpa: 6.67, roas: 4.5 },
    ],
    byCreative: [
      { creativeId: 'creative_1', name: 'Video Ad - Product Demo', impressions: 300000, clicks: 12000, conversions: 600, spend: 4000, revenue: 18000, ctr: 4.0, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { creativeId: 'creative_2', name: 'Image Ad - Testimonial', impressions: 250000, clicks: 9000, conversions: 450, spend: 3000, revenue: 13500, ctr: 3.6, cpc: 0.33, cpa: 6.67, roas: 4.5 },
      { creativeId: 'creative_3', name: 'Carousel Ad - Features', impressions: 200000, clicks: 7000, conversions: 350, spend: 2500, revenue: 10500, ctr: 3.5, cpc: 0.36, cpa: 7.14, roas: 4.2 },
    ],
    byTime: [
      { date: '2024-01-01', impressions: 45000, clicks: 1600, conversions: 80, spend: 550, revenue: 2400 },
      { date: '2024-01-02', impressions: 42000, clicks: 1500, conversions: 75, spend: 520, revenue: 2250 },
      { date: '2024-01-03', impressions: 48000, clicks: 1700, conversions: 85, spend: 580, revenue: 2550 },
      { date: '2024-01-04', impressions: 44000, clicks: 1550, conversions: 78, spend: 540, revenue: 2340 },
      { date: '2024-01-05', impressions: 46000, clicks: 1650, conversions: 83, spend: 560, revenue: 2490 },
    ],
  },
  aiInsights: [
    {
      id: 'insight_1',
      type: 'opportunity',
      title: 'High-Performing Audience Segment',
      description: 'The 25-34 age group shows 15% higher ROAS than average. Consider increasing budget allocation.',
      impact: 'high',
      confidence: 0.92,
      recommendations: ['Increase budget by 20% for 25-34 segment', 'Create similar audience lookalikes', 'Develop targeted creative for this segment'],
    },
    {
      id: 'insight_2',
      type: 'warning',
      title: 'Declining CTR on LinkedIn',
      description: 'LinkedIn CTR has decreased by 12% over the last 7 days. Review creative and targeting.',
      impact: 'medium',
      confidence: 0.87,
      recommendations: ['Refresh LinkedIn creative assets', 'Review audience targeting', 'Test new ad formats'],
    },
    {
      id: 'insight_3',
      type: 'trend',
      title: 'Positive Revenue Trend',
      description: 'Revenue has increased by 8% week-over-week, driven by improved conversion rates.',
      impact: 'high',
      confidence: 0.95,
      recommendations: ['Maintain current optimization strategies', 'Scale successful campaigns', 'Monitor for seasonality'],
    },
  ],
  timestamp: new Date(),
};

const AdvancedAnalyticsDashboard = React.memo(() => {
  const [analyticsData] = useState<AnalyticsData>(mockAnalyticsData);
  const [selectedPeriod, setSelectedPeriod] = useState('last_30_days');
  const [selectedMetric, setSelectedMetric] = useState('roas');
  const [isLoading, setIsLoading] = useState(false);

  // Memoized calculations
  const performanceMetrics = useMemo(() => {
    const { metrics } = analyticsData;
    return [
      {
        label: 'Impressions',
        value: metrics.impressions.toLocaleString(),
        change: '+12.5%',
        trend: 'up',
        icon: Eye,
      },
      {
        label: 'Clicks',
        value: metrics.clicks.toLocaleString(),
        change: '+8.3%',
        trend: 'up',
        icon: MousePointer,
      },
      {
        label: 'Conversions',
        value: metrics.conversions.toLocaleString(),
        change: '+15.2%',
        trend: 'up',
        icon: ShoppingCart,
      },
      {
        label: 'Revenue',
        value: `$${metrics.revenue.toLocaleString()}`,
        change: '+18.7%',
        trend: 'up',
        icon: DollarSign,
      },
      {
        label: 'ROAS',
        value: metrics.roas.toFixed(2),
        change: '+12.3%',
        trend: 'up',
        icon: TrendingUp,
      },
      {
        label: 'CPA',
        value: `$${metrics.cpa.toFixed(2)}`,
        change: '-8.1%',
        trend: 'down',
        icon: Target,
      },
    ];
  }, [analyticsData]);

  const platformPerformance = useMemo(() => {
    return analyticsData.breakdown.byPlatform.map(platform => ({
      name: platform.platform,
      [selectedMetric]: platform[selectedMetric as keyof PlatformData],
      impressions: platform.impressions,
      clicks: platform.clicks,
      conversions: platform.conversions,
      spend: platform.spend,
      revenue: platform.revenue,
    }));
  }, [analyticsData, selectedMetric]);

  const audiencePerformance = useMemo(() => {
    return analyticsData.breakdown.byAudience.map(audience => ({
      name: audience.segment,
      [selectedMetric]: audience[selectedMetric as keyof AudienceData],
      impressions: audience.impressions,
      clicks: audience.clicks,
      conversions: audience.conversions,
      spend: audience.spend,
      revenue: audience.revenue,
    }));
  }, [analyticsData, selectedMetric]);

  const timeSeriesData = useMemo(() => {
    return analyticsData.breakdown.byTime.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      impressions: item.impressions,
      clicks: item.clicks,
      conversions: item.conversions,
      spend: item.spend,
      revenue: item.revenue,
    }));
  }, [analyticsData]);

  // Event handlers
  const handlePeriodChange = useCallback((period: string) => {
    setSelectedPeriod(period);
    // In a real app, this would fetch new data
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const handleMetricChange = useCallback((metric: string) => {
    setSelectedMetric(metric);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    // In a real app, this would refresh data
    setTimeout(() => setIsLoading(false), 2000);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Real-time performance insights and AI-powered recommendations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={isLoading}>
            <Activity className="h-4 w-4 mr-2" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performanceMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center space-x-2">
                <Badge variant={metric.trend === 'up' ? 'default' : 'secondary'}>
                  {metric.change}
                </Badge>
                <TrendingUp className={`h-4 w-4 ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platform Performance</TabsTrigger>
          <TabsTrigger value="audience">Audience Analysis</TabsTrigger>
          <TabsTrigger value="creative">Creative Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue vs Spend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue vs Spend</CardTitle>
                <CardDescription>Daily revenue and spend trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="spend" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Impressions to conversions flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Impressions</span>
                    <span className="font-bold">{analyticsData.metrics.impressions.toLocaleString()}</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span>Clicks</span>
                    <span className="font-bold">{analyticsData.metrics.clicks.toLocaleString()}</span>
                  </div>
                  <Progress value={(analyticsData.metrics.clicks / analyticsData.metrics.impressions) * 100} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span>Conversions</span>
                    <span className="font-bold">{analyticsData.metrics.conversions.toLocaleString()}</span>
                  </div>
                  <Progress value={(analyticsData.metrics.conversions / analyticsData.metrics.clicks) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Platform Performance Tab */}
        <TabsContent value="platforms" className="space-y-4">
          <div className="flex items-center space-x-4">
            <Select value={selectedMetric} onValueChange={handleMetricChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roas">ROAS</SelectItem>
                <SelectItem value="ctr">CTR</SelectItem>
                <SelectItem value="cpc">CPC</SelectItem>
                <SelectItem value="cpa">CPA</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
              <CardDescription>Performance metrics by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={platformPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey={selectedMetric} fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audience Analysis Tab */}
        <TabsContent value="audience" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audience Performance</CardTitle>
              <CardDescription>Performance by audience segment</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={audiencePerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey={selectedMetric} fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creative Performance Tab */}
        <TabsContent value="creative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Creative Performance</CardTitle>
              <CardDescription>Performance by creative asset</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.breakdown.byCreative.map((creative) => (
                  <div key={creative.creativeId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-semibold">{creative.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {creative.impressions.toLocaleString()} impressions • {creative.clicks.toLocaleString()} clicks
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${creative.revenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        ROAS: {creative.roas.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Daily performance trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="impressions" stroke="#8884d8" />
                  <Line type="monotone" dataKey="clicks" stroke="#82ca9d" />
                  <Line type="monotone" dataKey="conversions" stroke="#ffc658" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai-insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.aiInsights.map((insight) => (
              <Card key={insight.id} className={`border-l-4 ${
                insight.type === 'opportunity' ? 'border-l-green-500' :
                insight.type === 'warning' ? 'border-l-yellow-500' :
                insight.type === 'trend' ? 'border-l-blue-500' :
                'border-l-red-500'
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{insight.title}</CardTitle>
                    <Badge variant={
                      insight.impact === 'high' ? 'default' :
                      insight.impact === 'medium' ? 'secondary' :
                      'outline'
                    }>
                      {insight.impact}
                    </Badge>
                  </div>
                  <CardDescription>{insight.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Confidence</span>
                      <span className="font-bold">{(insight.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Recommendations:</p>
                                             <ul className="text-xs space-y-1">
                         {insight.recommendations.map((rec, index) => (
                           <li key={`${rec}-${index}`} className="text-muted-foreground">• {rec}</li>
                         ))}
                       </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

AdvancedAnalyticsDashboard.displayName = 'AdvancedAnalyticsDashboard';

export default AdvancedAnalyticsDashboard; 