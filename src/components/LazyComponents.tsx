// Lazy Loading Components - Phase 3 Week 7 Performance Optimization
import React, { Suspense, lazy } from 'react';

// Loading component for lazy loaded components
const LoadingSpinner = React.memo(() => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-gray-600">Loading...</span>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Skeleton loading component
const ComponentSkeleton = React.memo(() => (
  <div className="animate-pulse space-y-4 p-6">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      <div className="h-4 bg-gray-200 rounded w-4/6"></div>
    </div>
    <div className="flex space-x-4">
      <div className="h-10 bg-gray-200 rounded w-20"></div>
      <div className="h-10 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
));

ComponentSkeleton.displayName = 'ComponentSkeleton';

// Higher Order Component for lazy loading with error boundary
const withLazyLoading = <P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  fallback: React.ComponentType = LoadingSpinner
) => {
  const WrappedComponent = React.memo((props: P) => (
    <Suspense fallback={<LoadingFallback FallbackComponent={fallback} />}>
      <ErrorBoundary>
        <LazyComponent {...props} />
      </ErrorBoundary>
    </Suspense>
  ));

  WrappedComponent.displayName = `withLazyLoading(Component)`;
  return WrappedComponent;
};

// Error boundary for lazy loaded components
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Component failed to load
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Please refresh the page or try again later.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading fallback component with customizable fallback
const LoadingFallback = React.memo<{ FallbackComponent: React.ComponentType }>(
  ({ FallbackComponent }) => <FallbackComponent />
);

LoadingFallback.displayName = 'LoadingFallback';

// Lazy loaded components for code splitting
export const LazyAnalyticsWidget = lazy(() => import('./AnalyticsWidget'));
export const LazyCampaignManager = lazy(() => import('./CampaignManager'));
export const LazyPerformanceMonitor = lazy(() => import('./PerformanceMonitor'));

// Advanced analytics components (heavier components)
export const LazyAdvancedAnalyticsDashboard = lazy(() => 
  import('./analytics/AdvancedAnalyticsDashboard')
);

// Wrapped components with lazy loading
export const AnalyticsWidget = withLazyLoading(LazyAnalyticsWidget, ComponentSkeleton);
export const CampaignManager = withLazyLoading(LazyCampaignManager, ComponentSkeleton);
export const PerformanceMonitor = withLazyLoading(LazyPerformanceMonitor, LoadingSpinner);
export const AdvancedAnalyticsDashboard = withLazyLoading(
  LazyAdvancedAnalyticsDashboard, 
  ComponentSkeleton
);

// Custom hook for lazy loading state
export const useLazyComponent = <P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  deps: React.DependencyList = []
) => {
  const [component, setComponent] = React.useState<React.ComponentType<P> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    importFunc()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [importFunc, ...deps]);

  return { component, loading, error };
};

// Virtual scrolling component for large lists
export const VirtualizedList = React.memo<{
  items: unknown[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: unknown, index: number) => React.ReactNode;
}>((props) => {
  const { items, itemHeight, containerHeight, renderItem } = props;
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleStartIndex = Math.floor(scrollTop / itemHeight);
  const visibleEndIndex = Math.min(
    visibleStartIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length - 1
  );

  const visibleItems = React.useMemo(() => 
    items.slice(visibleStartIndex, visibleEndIndex + 1),
    [items, visibleStartIndex, visibleEndIndex]
  );

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
      className="relative"
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleStartIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) =>
            renderItem(item, visibleStartIndex + index)
          )}
        </div>
      </div>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Image optimization component with lazy loading
export const OptimizedImage = React.memo<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}>((props) => {
  const { src, alt, width, height, className, priority = false } = props;
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (!priority) {
      // Lazy load non-priority images
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && imgRef.current) {
              imgRef.current.src = src;
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => observer.disconnect();
    }
  }, [src, priority]);

  const handleLoad = React.useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = React.useCallback(() => {
    setError(true);
  }, []);

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-gray-500 text-sm">Failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      )}
      <img
        ref={imgRef}
        src={priority ? src : undefined}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default withLazyLoading;