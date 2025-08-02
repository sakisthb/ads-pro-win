'use client';

import React, { Suspense, useState } from 'react';
import { 
  withLazyLoading, 
  LoadingFallback, 
  useLazyComponent,
  useLazyLoadOnView,
  preloadOnInteraction 
} from '@/lib/code-splitting';

// Define lazy-loaded components
const LazyAnalyticsDashboard = withLazyLoading(
  () => import('../analytics/AdvancedAnalyticsDashboard'),
  {
    fallback: <LoadingFallback skeleton="dashboard" message="Loading Analytics Dashboard..." />,
    preload: false,
    delay: 500, // Simulate network delay
  }
);

const LazyCampaignManager = withLazyLoading(
  () => import('../CampaignManager'),
  {
    fallback: <LoadingFallback skeleton="table" message="Loading Campaign Manager..." />,
    preload: false,
  }
);

const LazyVirtualScrollDemo = withLazyLoading(
  () => import('../virtualization/VirtualScrollDemo'),
  {
    fallback: <LoadingFallback skeleton="list" message="Loading Virtual Scroll Demo..." />,
    preload: false,
  }
);

const LazyPerformanceMonitor = withLazyLoading(
  () => import('../PerformanceMonitor'),
  {
    fallback: <LoadingFallback message="Loading Performance Monitor..." />,
    preload: false,
  }
);

// Heavy computation component (simulates expensive operations)
const HeavyComputationComponent = React.memo(() => {
  const [result, setResult] = useState<string>('');

  React.useEffect(() => {
    // Simulate heavy computation
    const heavyWork = () => {
      let sum = 0;
      for (let i = 0; i < 10000000; i++) {
        sum += Math.sqrt(i);
      }
      return `Computed result: ${sum.toFixed(2)}`;
    };

    // Use setTimeout to avoid blocking the UI
    const timer = setTimeout(() => {
      setResult(heavyWork());
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-gradient-to-r from-purple-400 to-pink-600 p-6 rounded-lg text-white">
      <h3 className="text-lg font-semibold mb-2">Heavy Computation Component</h3>
      <p className="text-sm opacity-90">
        This component performs expensive calculations and is loaded lazily.
      </p>
      <div className="mt-4 p-3 bg-white/20 rounded text-sm font-mono">
        {result || 'Computing...'}
      </div>
    </div>
  );
});

HeavyComputationComponent.displayName = 'HeavyComputationComponent';

const LazyHeavyComponent = withLazyLoading(
  () => Promise.resolve({ default: HeavyComputationComponent }),
  {
    fallback: <LoadingFallback message="Loading Heavy Component..." showProgress />,
    delay: 1000,
  }
);

// Component that loads on intersection
const IntersectionLazyComponent: React.FC = () => {
  const {
    elementRef,
    Component,
    isVisible,
    isLoaded,
    isLoading,
    error,
    retry
  } = useLazyLoadOnView(
    () => Promise.resolve({ default: HeavyComputationComponent }),
    {
      threshold: 0.1,
      rootMargin: '100px',
      fallback: <LoadingFallback message="Component will load when visible..." />,
    }
  );

  return (
    <div ref={elementRef} className="min-h-[200px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
      {error ? (
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load component</p>
          <button onClick={retry} className="px-4 py-2 bg-red-600 text-white rounded">
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <LoadingFallback message="Loading on intersection..." />
      ) : isLoaded && Component ? (
        <Suspense fallback={<LoadingFallback />}>
          <Component />
        </Suspense>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>👁️ Component will load when you scroll here</p>
          <p className="text-sm mt-1">Visible: {isVisible ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
};

// Main demo component
export default function LazyComponentsDemo() {
  const [activeTab, setActiveTab] = useState<string>('analytics');
  const [showHeavy, setShowHeavy] = useState(false);

  // Use lazy loading hook for manual control
  const {
    Component: ManualLazyComponent,
    loadComponent,
    isLoaded: isManualLoaded,
    isLoading: isManualLoading,
    error: manualError,
    retry: retryManual
  } = useLazyComponent(
    () => import('../analytics/AdvancedAnalyticsDashboard'),
    {
      fallback: <LoadingFallback skeleton="dashboard" />,
    }
  );

  // Tab configurations with preload setup
  const tabs = [
    {
      id: 'analytics',
      label: 'Analytics Dashboard',
      component: LazyAnalyticsDashboard,
      preloadFn: (LazyAnalyticsDashboard as unknown as { preload: () => Promise<void> }).preload,
    },
    {
      id: 'campaigns',
      label: 'Campaign Manager',
      component: LazyCampaignManager,
      preloadFn: (LazyCampaignManager as unknown as { preload: () => Promise<void> }).preload,
    },
    {
      id: 'virtual',
      label: 'Virtual Scrolling',
      component: LazyVirtualScrollDemo,
      preloadFn: (LazyVirtualScrollDemo as unknown as { preload: () => Promise<void> }).preload,
    },
    {
      id: 'performance',
      label: 'Performance Monitor',
      component: LazyPerformanceMonitor,
      preloadFn: (LazyPerformanceMonitor as unknown as { preload: () => Promise<void> }).preload,
    },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Code Splitting & Lazy Loading Demo
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Demonstration of various lazy loading techniques for optimal performance
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Route-based Splitting</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">Components loaded on demand</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-900 dark:text-green-100">Intersection Loading</h3>
          <p className="text-sm text-green-700 dark:text-green-300">Load when component is visible</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Preload on Hover</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">Smart preloading strategies</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <h3 className="font-semibold text-orange-900 dark:text-orange-100">Error Boundaries</h3>
          <p className="text-sm text-orange-700 dark:text-orange-300">Graceful failure handling</p>
        </div>
      </div>

      {/* Tab Navigation with Preloading */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              {...preloadOnInteraction.onMouseEnter(tab.preloadFn)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div className="min-h-[400px]">
        {ActiveComponent && <ActiveComponent />}
      </div>

      {/* Manual Loading Demo */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Manual Lazy Loading
          </h2>
          <div className="space-x-2">
            <button
              onClick={loadComponent}
              disabled={isManualLoaded || isManualLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isManualLoading ? 'Loading...' : isManualLoaded ? 'Loaded' : 'Load Component'}
            </button>
            {manualError && (
              <button
                onClick={retryManual}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[200px]">
          {manualError ? (
            <div className="text-center text-red-500">
              <p>Error: {manualError.message}</p>
            </div>
          ) : (isManualLoaded || isManualLoading) && ManualLazyComponent ? (
            <Suspense fallback={<LoadingFallback skeleton="dashboard" />}>
              <ManualLazyComponent />
            </Suspense>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>👆 Click "Load Component" to manually load the analytics dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Heavy Component Demo */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Heavy Component Loading
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Components with expensive operations loaded on demand
            </p>
          </div>
          <button
            onClick={() => setShowHeavy(!showHeavy)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {showHeavy ? 'Hide' : 'Show'} Heavy Component
          </button>
        </div>

        {showHeavy && <LazyHeavyComponent />}
      </div>

      {/* Intersection Observer Demo */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Intersection Observer Loading
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Scroll down to see the component load when it comes into view:
        </p>
        
        {/* Add some space to demonstrate scrolling */}
        <div className="h-96 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg flex items-center justify-center mb-8">
          <p className="text-gray-500 dark:text-gray-400">👇 Scroll down to see intersection loading</p>
        </div>

        <IntersectionLazyComponent />
        
        <div className="h-96 bg-gradient-to-t from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg flex items-center justify-center mt-8">
          <p className="text-gray-500 dark:text-gray-400">End of demo</p>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
          🚀 Performance Tips
        </h3>
        <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
          <li>• Use hover-based preloading for critical user paths</li>
          <li>• Implement intersection-based loading for below-the-fold content</li>
          <li>• Add retry mechanisms for failed chunk loads</li>
          <li>• Use skeleton loading states for better perceived performance</li>
          <li>• Monitor chunk sizes and loading times in production</li>
          <li>• Consider route-based splitting for major application sections</li>
        </ul>
      </div>
    </div>
  );
}