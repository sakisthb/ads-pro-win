'use client';

import React from 'react';
import { 
  useAdvancedMemo, 
  useAdvancedCallback, 
  useRenderProfiler,
  useOptimizedState,
  withPerformanceOptimization 
} from '@/lib/react-optimization';

// Types for dashboard data
interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  avgROI: number;
  conversionRate: number;
  impressions: number;
  clicks: number;
  revenue: number;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: 'active' | 'paused' | 'draft';
  spend: number;
  roi: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

// Optimized Stats Card Component
const StatsCard = React.memo(({ 
  title, 
  value, 
  change, 
  changeType,
  icon 
}: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}) => {
  // Format large numbers efficiently
  const formattedValue = useAdvancedMemo(() => {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toString();
    }
    return value;
  }, [value]);

  const changeDisplay = useAdvancedMemo(() => {
    if (change === undefined) return null;
    
    const changeColor = 
      changeType === 'positive' ? 'text-green-600' :
      changeType === 'negative' ? 'text-red-600' :
      'text-gray-600';
    
    const changeIcon = 
      changeType === 'positive' ? '↗' :
      changeType === 'negative' ? '↘' :
      '→';
    
    return (
      <span className={`text-sm ${changeColor} flex items-center`}>
        {changeIcon} {Math.abs(change)}%
      </span>
    );
  }, [change, changeType]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formattedValue}</p>
            {changeDisplay}
          </div>
        </div>
        {icon && (
          <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
});

StatsCard.displayName = 'StatsCard';

// Optimized Campaign List Component
const CampaignList = React.memo(({ 
  campaigns, 
  onCampaignSelect 
}: {
  campaigns: Campaign[];
  onCampaignSelect: (campaign: Campaign) => void;
}) => {
  // Sort campaigns efficiently
  const sortedCampaigns = useAdvancedMemo(() => {
    return [...campaigns].sort((a, b) => {
      // Active campaigns first, then by ROI descending
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return b.roi - a.roi;
    });
  }, [campaigns], {
    keySerializer: (deps) => `campaigns-${campaigns.length}-${campaigns.map(c => `${c.id}-${c.status}-${c.roi}`).join('-')}`,
    ttl: 30000, // 30 seconds cache
  });

  // Optimized click handler
  const handleCampaignClick = useAdvancedCallback((campaign: Campaign) => {
    onCampaignSelect(campaign);
  }, [onCampaignSelect], { deepCompare: false });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Top Performing Campaigns
        </h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedCampaigns.slice(0, 5).map((campaign) => (
          <CampaignItem
            key={campaign.id}
            campaign={campaign}
            onClick={handleCampaignClick}
          />
        ))}
      </div>
    </div>
  );
});

CampaignList.displayName = 'CampaignList';

// Individual Campaign Item (heavily optimized)
const CampaignItem = React.memo(({ 
  campaign, 
  onClick 
}: {
  campaign: Campaign;
  onClick: (campaign: Campaign) => void;
}) => {
  const handleClick = useAdvancedCallback(() => {
    onClick(campaign);
  }, [campaign, onClick]);

  const statusBadge = useAdvancedMemo(() => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', text: 'Active' },
      paused: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', text: 'Paused' },
      draft: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', text: 'Draft' },
    };

    const config = statusConfig[campaign.status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  }, [campaign.status]);

  const metrics = useAdvancedMemo(() => ({
    ctr: campaign.clicks > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00',
    cpc: campaign.clicks > 0 ? (campaign.spend / campaign.clicks).toFixed(2) : '0.00',
    conversionRate: campaign.clicks > 0 ? ((campaign.conversions / campaign.clicks) * 100).toFixed(2) : '0.00',
  }), [campaign.clicks, campaign.impressions, campaign.spend, campaign.conversions]);

  return (
    <div 
      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {campaign.name}
            </h4>
            {statusBadge}
          </div>
          <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <span>{campaign.platform}</span>
            <span>CTR: {metrics.ctr}%</span>
            <span>CPC: ${metrics.cpc}</span>
            <span>Conv: {metrics.conversionRate}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            ${campaign.spend.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            ROI: {campaign.roi.toFixed(1)}x
          </div>
        </div>
      </div>
    </div>
  );
});

CampaignItem.displayName = 'CampaignItem';

// Main Optimized Dashboard Component
const OptimizedDashboard = React.memo(() => {
  const profileData = useRenderProfiler('OptimizedDashboard');
  
  // Optimized state management
  const [selectedCampaign, setSelectedCampaign] = useOptimizedState<Campaign | null>(
    null,
    {
      equalityFn: (prev, next) => prev?.id === next?.id,
      debounceMs: 100, // Debounce rapid selections
    }
  );

  // Mock data with advanced memoization
  const dashboardStats = useAdvancedMemo((): DashboardStats => ({
    totalCampaigns: 24,
    activeCampaigns: 18,
    totalSpend: 45620.75,
    avgROI: 3.4,
    conversionRate: 4.2,
    impressions: 2450000,
    clicks: 102900,
    revenue: 155310.50,
  }), [], { ttl: 60000 }); // Cache for 1 minute

  const campaigns = useAdvancedMemo((): Campaign[] => [
    {
      id: '1',
      name: 'Summer Sale 2024',
      platform: 'Facebook',
      status: 'active',
      spend: 8500,
      roi: 4.2,
      impressions: 450000,
      clicks: 18900,
      conversions: 756,
    },
    {
      id: '2',
      name: 'Brand Awareness Q3',
      platform: 'Google',
      status: 'active',
      spend: 6200,
      roi: 3.8,
      impressions: 380000,
      clicks: 15200,
      conversions: 608,
    },
    {
      id: '3',
      name: 'Product Launch Campaign',
      platform: 'TikTok',
      status: 'active',
      spend: 4800,
      roi: 5.1,
      impressions: 620000,
      clicks: 31000,
      conversions: 1240,
    },
  ], [], { ttl: 30000 }); // Cache for 30 seconds

  // Optimized handlers
  const handleCampaignSelect = useAdvancedCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    console.log('Selected campaign:', campaign.name);
  }, [setSelectedCampaign]);

  const handleRefresh = useAdvancedCallback(() => {
    console.log('Refreshing dashboard data...');
    // In real app, this would invalidate caches and refetch data
  }, []);

  // Stats calculations
  const statsCards = useAdvancedMemo(() => [
    {
      title: 'Total Campaigns',
      value: dashboardStats.totalCampaigns,
      change: 12,
      changeType: 'positive' as const,
      icon: '📊',
    },
    {
      title: 'Active Campaigns',
      value: dashboardStats.activeCampaigns,
      change: 8,
      changeType: 'positive' as const,
      icon: '🚀',
    },
    {
      title: 'Total Spend',
      value: `$${dashboardStats.totalSpend.toLocaleString()}`,
      change: -3,
      changeType: 'negative' as const,
      icon: '💰',
    },
    {
      title: 'Average ROI',
      value: `${dashboardStats.avgROI}x`,
      change: 15,
      changeType: 'positive' as const,
      icon: '📈',
    },
    {
      title: 'Conversion Rate',
      value: `${dashboardStats.conversionRate}%`,
      change: 5,
      changeType: 'positive' as const,
      icon: '🎯',
    },
    {
      title: 'Total Revenue',
      value: `$${dashboardStats.revenue.toLocaleString()}`,
      change: 22,
      changeType: 'positive' as const,
      icon: '💎',
    },
  ], [dashboardStats]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Real-time insights and campaign performance
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Refresh Data
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statsCards.map((stat, index) => (
          <StatsCard
            key={`${stat.title}-${index}`}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            changeType={stat.changeType}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Campaign List */}
      <CampaignList
        campaigns={campaigns}
        onCampaignSelect={handleCampaignSelect}
      />

      {/* Selected Campaign Details */}
      {selectedCampaign && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            Selected: {selectedCampaign.name}
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Platform: {selectedCampaign.platform} | ROI: {selectedCampaign.roi}x | 
            Spend: ${selectedCampaign.spend.toLocaleString()}
          </p>
        </div>
      )}

      {/* Development Performance Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
          <strong>Performance:</strong> Renders: {profileData.renderCount}, 
          Avg: {profileData.averageRenderTime.toFixed(2)}ms, 
          Slow: {profileData.slowRenders}
        </div>
      )}
    </div>
  );
});

OptimizedDashboard.displayName = 'OptimizedDashboard';

// Export with additional performance optimization
export default withPerformanceOptimization(OptimizedDashboard, {
  name: 'OptimizedDashboard',
  profileRenders: process.env.NODE_ENV === 'development',
});