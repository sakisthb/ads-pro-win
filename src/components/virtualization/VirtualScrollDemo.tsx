'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  VirtualScrollList, 
  VirtualGrid, 
  VirtualizedCampaignList,
  VirtualTable 
} from './VirtualScrollList';
import { useAdvancedMemo, useRenderProfiler } from '@/lib/react-optimization';

// Generate large dataset for testing
function generateCampaigns(count: number) {
  const platforms = ['Facebook', 'Google', 'TikTok', 'Instagram', 'LinkedIn', 'Twitter', 'YouTube'];
  const statuses: ('active' | 'paused' | 'draft')[] = ['active', 'paused', 'draft'];
  const campaigns = [];

  for (let i = 0; i < count; i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const spend = Math.floor(Math.random() * 10000) + 500;
    const impressions = Math.floor(Math.random() * 500000) + 10000;
    const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
    const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));

    campaigns.push({
      id: `campaign-${i + 1}`,
      name: `Campaign ${i + 1} - ${platform} ${status}`,
      platform,
      status,
      spend,
      roi: Number((Math.random() * 4 + 1).toFixed(1)),
      impressions,
      clicks,
      conversions,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return campaigns;
}

// Simple Item Component for basic list
const SimpleItem = React.memo<{ item: { id: string; name: string; value: number } }>(
  ({ item }) => (
    <div className="flex justify-between items-center p-4 border-b border-gray-200 hover:bg-gray-50">
      <div>
        <h4 className="font-medium">{item.name}</h4>
        <p className="text-sm text-gray-500">ID: {item.id}</p>
      </div>
      <div className="text-lg font-bold text-blue-600">
        {item.value.toLocaleString()}
      </div>
    </div>
  )
);

SimpleItem.displayName = 'SimpleItem';

// Grid Item Component
const GridItem = React.memo<{ item: { id: string; title: string; color: string } }>(
  ({ item }) => (
    <div 
      className="p-4 rounded-lg shadow-sm border-2 hover:shadow-md transition-shadow"
      style={{ backgroundColor: item.color }}
    >
      <h3 className="font-semibold text-white mb-2">{item.title}</h3>
      <p className="text-white/80 text-sm">{item.id}</p>
    </div>
  )
);

GridItem.displayName = 'GridItem';

// Main Demo Component
export default function VirtualScrollDemo() {
  const profileData = useRenderProfiler('VirtualScrollDemo');
  const [selectedTab, setSelectedTab] = useState<'list' | 'grid' | 'campaigns' | 'table'>('list');
  const [dataSize, setDataSize] = useState(10000);

  // Generate test data
  const listData = useAdvancedMemo(() =>
    Array.from({ length: dataSize }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 1000000),
    })),
    [dataSize],
    { ttl: 60000 }
  );

  const gridData = useAdvancedMemo(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];
    return Array.from({ length: Math.min(dataSize, 5000) }, (_, i) => ({
      id: `grid-item-${i + 1}`,
      title: `Card ${i + 1}`,
      color: colors[i % colors.length],
    }));
  }, [dataSize], { ttl: 60000 });

  const campaignData = useAdvancedMemo(() => 
    generateCampaigns(Math.min(dataSize, 20000)),
    [dataSize],
    { ttl: 60000 }
  );

  // Table columns configuration
  const tableColumns = useMemo(() => [
    {
      key: 'name',
      title: 'Campaign Name',
      width: 250,
      render: (item: typeof campaignData[0]) => (
        <div className="font-medium text-gray-900 dark:text-white truncate">
          {item.name}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'platform',
      title: 'Platform',
      width: 120,
      render: (item: typeof campaignData[0]) => (
        <span className="text-gray-600 dark:text-gray-300">
          {item.platform}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'status',
      title: 'Status',
      width: 100,
      render: (item: typeof campaignData[0]) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.status === 'active' 
            ? 'bg-green-100 text-green-800'
            : item.status === 'paused'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {item.status}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'spend',
      title: 'Spend',
      width: 120,
      render: (item: typeof campaignData[0]) => (
        <span className="font-medium text-gray-900 dark:text-white">
          ${item.spend.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'roi',
      title: 'ROI',
      width: 80,
      render: (item: typeof campaignData[0]) => (
        <span className="font-medium text-green-600">
          {item.roi}x
        </span>
      ),
      sortable: true,
    },
    {
      key: 'impressions',
      title: 'Impressions',
      width: 120,
      render: (item: typeof campaignData[0]) => (
        <span className="text-gray-600 dark:text-gray-300">
          {item.impressions.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'clicks',
      title: 'Clicks',
      width: 100,
      render: (item: typeof campaignData[0]) => (
        <span className="text-gray-600 dark:text-gray-300">
          {item.clicks.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
  ], []);

  // Event handlers
  const handleItemClick = useCallback((item: unknown) => {
    console.log('Item clicked:', item);
  }, []);

  const handleCampaignClick = useCallback((campaign: typeof campaignData[0]) => {
    console.log('Campaign clicked:', campaign.name);
  }, []);

  const keyExtractor = useCallback((item: unknown, index: number) => {
    return (item as { id: string }).id || `item-${index}`;
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Virtual Scrolling Demo
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            High-performance rendering of large datasets ({dataSize.toLocaleString()} items)
          </p>
        </div>
        
        {/* Data Size Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Dataset Size:
          </label>
          <select
            value={dataSize}
            onChange={(e) => setDataSize(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value={1000}>1,000</option>
            <option value={5000}>5,000</option>
            <option value={10000}>10,000</option>
            <option value={50000}>50,000</option>
            <option value={100000}>100,000</option>
          </select>
        </div>
      </div>

      {/* Performance Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 dark:text-blue-300">Renders:</span>
              <span className="ml-2 font-mono">{profileData.renderCount}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Avg Time:</span>
              <span className="ml-2 font-mono">{profileData.averageRenderTime.toFixed(2)}ms</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Slow Renders:</span>
              <span className="ml-2 font-mono">{profileData.slowRenders}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Last Render:</span>
              <span className="ml-2 font-mono">{profileData.lastRenderTime.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {['list', 'grid', 'campaigns', 'table'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as typeof selectedTab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab} Demo
            </button>
          ))}
        </nav>
      </div>

      {/* Content based on selected tab */}
      <div className="space-y-6">
        {selectedTab === 'list' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Virtual List Demo</h2>
            <VirtualScrollList
              items={listData}
              itemHeight={73}
              containerHeight={500}
              renderItem={(item, index) => <SimpleItem item={item} />}
              keyExtractor={keyExtractor}
              overscan={10}
              className="border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>
        )}

        {selectedTab === 'grid' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Virtual Grid Demo</h2>
            <VirtualGrid
              items={gridData}
              itemWidth={200}
              itemHeight={120}
              containerWidth={800}
              containerHeight={500}
              columnsCount={4}
              gap={16}
              renderItem={(item, index) => <GridItem item={item} />}
              keyExtractor={keyExtractor}
              overscan={8}
              className="border border-gray-200 dark:border-gray-700 rounded-lg"
            />
          </div>
        )}

        {selectedTab === 'campaigns' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Virtual Campaign List Demo</h2>
            <VirtualizedCampaignList
              campaigns={campaignData}
              onCampaignClick={handleCampaignClick}
              containerHeight={500}
            />
          </div>
        )}

        {selectedTab === 'table' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Virtual Table Demo</h2>
            <VirtualTable
              data={campaignData}
              columns={tableColumns}
              rowHeight={60}
              containerHeight={500}
              keyExtractor={keyExtractor}
              onRowClick={handleCampaignClick}
              sortBy="name"
              sortDirection="asc"
              onSort={(key, direction) => {
                console.log(`Sort by ${key} ${direction}`);
              }}
            />
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">Instructions</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Try different dataset sizes to see performance differences</li>
          <li>• Scroll through the lists to see virtual rendering in action</li>
          <li>• Only visible items are rendered to maintain 60fps performance</li>
          <li>• Click on items to see interaction handling</li>
          <li>• Performance metrics show render times (development mode only)</li>
        </ul>
      </div>
    </div>
  );
}