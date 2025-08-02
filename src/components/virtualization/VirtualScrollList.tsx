'use client';

import React, { 
  useRef, 
  useEffect, 
  useState, 
  useMemo, 
  useCallback,
  CSSProperties 
} from 'react';
import { useVirtualizedList } from '@/lib/react-optimization';

// Types for virtual scrolling
interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  loadMore?: () => void;
  hasNextPage?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
}

interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  columnsCount: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  gap?: number;
  overscan?: number;
  className?: string;
}

// Virtual Scroll List Component
export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  overscan = 5,
  className = '',
  onScroll,
  loadMore,
  hasNextPage = false,
  isLoading = false,
  emptyMessage = 'No items to display',
  loadingMessage = 'Loading...',
}: VirtualScrollListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Use virtualization hook
  const { visibleItems, totalHeight, offsetY } = useVirtualizedList(
    items,
    itemHeight,
    containerHeight,
    overscan
  );

  // Scroll handler for performance  
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // Infinite loading
    if (loadMore && hasNextPage && !isLoading) {
      const scrollBottom = newScrollTop + containerHeight;
      const threshold = totalHeight - itemHeight * 5; // Load when 5 items from bottom
      
      if (scrollBottom >= threshold) {
        loadMore();
      }
    }
  }, [setScrollTop, onScroll, loadMore, hasNextPage, isLoading, containerHeight, totalHeight, itemHeight]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div 
        className={`flex items-center justify-center text-gray-500 dark:text-gray-400 ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div
              key={keyExtractor(item, index)}
              style={{
                height: itemHeight,
                position: 'relative',
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
        
        {/* Loading indicator */}
        {isLoading && (
          <div 
            className="flex items-center justify-center p-4 text-gray-500"
            style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: itemHeight 
            }}
          >
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>{loadingMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Virtual Grid Component for grid layouts
export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  columnsCount,
  renderItem,
  keyExtractor,
  gap = 0,
  overscan = 5,
  className = '',
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate grid dimensions
  const rowHeight = itemHeight + gap;
  const rowsCount = Math.ceil(items.length / columnsCount);
  const totalHeight = rowsCount * rowHeight;

  // Calculate visible range
  const { visibleRange, visibleItems } = useMemo(() => {
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(
      startRow + Math.ceil(containerHeight / rowHeight) + overscan,
      rowsCount
    );

    const start = Math.max(0, startRow - overscan);
    const end = endRow;

    const visible = [];
    for (let row = start; row < end; row++) {
      for (let col = 0; col < columnsCount; col++) {
        const index = row * columnsCount + col;
        if (index < items.length) {
          visible.push({
            item: items[index],
            index,
            row,
            col,
          });
        }
      }
    }

    return {
      visibleRange: { start, end },
      visibleItems: visible,
    };
  }, [items, scrollTop, rowHeight, containerHeight, overscan, rowsCount, columnsCount]);

  const offsetY = visibleRange.start * rowHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, [setScrollTop]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index, row, col }) => (
            <div
              key={keyExtractor(item, index)}
              style={{
                position: 'absolute',
                width: itemWidth,
                height: itemHeight,
                left: col * (itemWidth + gap),
                top: (row - visibleRange.start) * rowHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Optimized Campaign List with Virtual Scrolling
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
  createdAt: string;
}

export const VirtualizedCampaignList = React.memo<{
  campaigns: Campaign[];
  onCampaignClick: (campaign: Campaign) => void;
  containerHeight?: number;
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
}>(({ 
  campaigns, 
  onCampaignClick, 
  containerHeight = 400,
  isLoading = false,
  onLoadMore,
  hasNextPage = false 
}) => {
  const renderCampaignItem = useCallback((campaign: Campaign, index: number) => (
    <div
      className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      onClick={() => onCampaignClick(campaign)}
    >
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {campaign.name}
          </h4>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            campaign.status === 'active' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : campaign.status === 'paused'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {campaign.status}
          </span>
        </div>
        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
          <span>{campaign.platform}</span>
          <span>Impressions: {campaign.impressions.toLocaleString()}</span>
          <span>Clicks: {campaign.clicks.toLocaleString()}</span>
          <span>Conversions: {campaign.conversions}</span>
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
  ), [onCampaignClick]);

  const keyExtractor = useCallback((campaign: Campaign, index: number) => campaign.id, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Campaigns ({campaigns.length.toLocaleString()})
        </h3>
      </div>
      <VirtualScrollList
        items={campaigns}
        itemHeight={80}
        containerHeight={containerHeight}
        renderItem={renderCampaignItem}
        keyExtractor={keyExtractor}
        overscan={10}
        onScroll={(scrollTop) => {
          // Could add scroll position persistence here
        }}
        loadMore={onLoadMore}
        hasNextPage={hasNextPage}
        isLoading={isLoading}
        emptyMessage="No campaigns found"
        loadingMessage="Loading more campaigns..."
      />
    </div>
  );
});

VirtualizedCampaignList.displayName = 'VirtualizedCampaignList';

// Virtualized Table Component
interface VirtualTableColumn<T> {
  key: string;
  title: string;
  width: number;
  render: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight: number;
  containerHeight: number;
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  isLoading?: boolean;
  loadMore?: () => void;
  hasNextPage?: boolean;
}

export function VirtualTable<T>({
  data,
  columns,
  rowHeight,
  containerHeight,
  keyExtractor,
  onRowClick,
  sortBy,
  sortDirection,
  onSort,
  isLoading,
  loadMore,
  hasNextPage,
}: VirtualTableProps<T>) {
  const headerHeight = 48;
  const contentHeight = containerHeight - headerHeight;

  const renderRow = useCallback((item: T, index: number) => (
    <div
      className={`flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
        onRowClick ? 'cursor-pointer' : ''
      } transition-colors`}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className="px-4 py-3 text-sm"
          style={{ width: column.width, minWidth: column.width }}
        >
          {column.render(item, index)}
        </div>
      ))}
    </div>
  ), [columns, onRowClick]);

  const handleSort = useCallback((columnKey: string) => {
    if (!onSort) return;
    
    const newDirection = 
      sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  }, [sortBy, sortDirection, onSort]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Table Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700" style={{ height: headerHeight }}>
        {columns.map((column) => (
          <div
            key={column.key}
            className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
              column.sortable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
            }`}
            style={{ width: column.width, minWidth: column.width }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <div className="flex items-center space-x-1">
              <span>{column.title}</span>
              {column.sortable && sortBy === column.key && (
                <span className="text-blue-600">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Virtualized Table Body */}
      <VirtualScrollList
        items={data}
        itemHeight={rowHeight}
        containerHeight={contentHeight}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        overscan={10}
        loadMore={loadMore}
        hasNextPage={hasNextPage}
        isLoading={isLoading}
        emptyMessage="No data available"
        loadingMessage="Loading more data..."
      />
    </div>
  );
}

// Export all components
export default VirtualScrollList;