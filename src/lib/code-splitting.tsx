// Advanced Code Splitting and Lazy Loading - Phase 3 Week 9
import React, { 
  Suspense, 
  lazy, 
  ComponentType, 
  LazyExoticComponent,
  ReactNode,
  useEffect,
  useState,
  useRef,
  useMemo
} from 'react';

// Types for code splitting utilities
interface LazyLoadOptions {
  fallback?: ReactNode;
  delay?: number;
  preload?: boolean;
  retryCount?: number;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<unknown> }>;
  preload?: boolean;
  fallback?: ReactNode;
}

interface ChunkLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  error: Error | null;
  retryCount: number;
}

// Enhanced lazy loading with preloading and error handling
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): {
  Component: LazyExoticComponent<T>;
  preload: () => Promise<void>;
  isPreloaded: () => boolean;
} {
  const {
    delay = 0,
    preload = false,
    retryCount = 3,
    onError,
    onLoad,
  } = options;

  let preloadPromise: Promise<{ default: T }> | null = null;
  let isPreloaded = false;

  // Wrapper function with retry logic
  const wrappedImportFn = async (): Promise<{ default: T }> => {
    let lastError: Error | null = null;
    
    for (let i = 0; i <= retryCount; i++) {
      try {
        // Add artificial delay if specified
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await importFn();
        onLoad?.();
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to load component (attempt ${i + 1}/${retryCount + 1}):`, error);
        
        // Wait before retry
        if (i < retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }
    
    onError?.(lastError!);
    throw lastError;
  };

  const LazyComponent = lazy(wrappedImportFn);

  const preloadFn = async (): Promise<void> => {
    if (!preloadPromise) {
      preloadPromise = wrappedImportFn();
      try {
        await preloadPromise;
        isPreloaded = true;
      } catch (error) {
        preloadPromise = null;
        throw error;
      }
    }
    return preloadPromise.then(() => {});
  };

  // Auto-preload if specified
  if (preload) {
    preloadFn().catch(console.error);
  }

  return {
    Component: LazyComponent,
    preload: preloadFn,
    isPreloaded: () => isPreloaded,
  };
}

// Loading component with skeleton and progress
export const LoadingFallback: React.FC<{
  message?: string;
  showProgress?: boolean;
  skeleton?: 'card' | 'list' | 'table' | 'dashboard';
}> = ({ 
  message = 'Loading...', 
  showProgress = false,
  skeleton = 'card'
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!showProgress) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const increment = Math.random() * 20;
        return Math.min(prev + increment, 95);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [showProgress]);

  const renderSkeleton = () => {
    switch (skeleton) {
      case 'list':
        return (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <div className="rounded-full bg-gray-300 dark:bg-gray-600 h-10 w-10"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'table':
        return (
          <div className="animate-pulse">
            <div className="grid grid-cols-4 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded mb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            ))}
          </div>
        );
      
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            <div className="animate-pulse bg-gray-100 dark:bg-gray-800 p-6 rounded-lg h-64"></div>
          </div>
        );
      
      default: // card
        return (
          <div className="animate-pulse bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      {skeleton ? (
        renderSkeleton()
      ) : (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 dark:text-gray-400">{message}</p>
          {showProgress && (
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Error boundary for lazy components
export class LazyErrorBoundary extends React.Component<
  { 
    children: ReactNode; 
    fallback?: ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error) => void;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: LazyErrorBoundary['props']) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
    <div className="text-red-600 dark:text-red-400">
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <div className="text-center">
      <h3 className="text-lg font-medium text-red-900 dark:text-red-100">
        Failed to load component
      </h3>
      <p className="text-red-700 dark:text-red-300 text-sm mt-1">
        {error.message}
      </p>
    </div>
    <button
      onClick={retry}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
    >
      Try Again
    </button>
  </div>
);

// Higher-order component for lazy loading with enhanced features
export function withLazyLoading<P extends Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyLoadOptions = {}
) {
  const { Component, preload } = createLazyComponent(importFn as () => Promise<{ default: ComponentType<unknown> }>, options);
  const { fallback = <LoadingFallback />, onError } = options;

  const LazyWrapper: React.FC<P> = (props) => (
    <LazyErrorBoundary fallback={DefaultErrorFallback} onError={onError}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </LazyErrorBoundary>
  );

  LazyWrapper.displayName = `withLazyLoading(${(Component as any)?.displayName || 'Component'})`;
  (LazyWrapper as unknown as { preload: () => Promise<void> }).preload = preload;

  return LazyWrapper;
}

// Route-based code splitting
export function createLazyRoutes(routes: RouteConfig[]) {
  const lazyRoutes = routes.map(route => {
    const { Component, preload } = createLazyComponent(route.component, {
      preload: route.preload,
      fallback: route.fallback,
    });

    return {
      ...route,
      Component,
      preload,
    };
  });

  // Preload critical routes
  useEffect(() => {
    lazyRoutes.forEach(route => {
      if (route.preload) {
        route.preload().catch(console.error);
      }
    });
  }, []);

  return lazyRoutes;
}

// Hook for managing lazy component state
export function useLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const [state, setState] = useState<ChunkLoadingState>({
    isLoading: false,
    isLoaded: false,
    error: null,
    retryCount: 0,
  });

  const { Component, preload, isPreloaded } = useMemo(
    () => createLazyComponent(importFn, {
      ...options,
      onLoad: () => {
        setState(prev => ({ ...prev, isLoaded: true, isLoading: false }));
        options.onLoad?.();
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error, isLoading: false, retryCount: prev.retryCount + 1 }));
        options.onError?.(error);
      },
    }),
    [importFn]
  );

  const loadComponent = async () => {
    if (state.isLoaded || state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await preload();
    } catch (error) {
      // Error is handled by the onError callback
    }
  };

  const retry = () => {
    setState(prev => ({ 
      ...prev, 
      error: null, 
      isLoading: false,
      retryCount: 0 
    }));
    loadComponent();
  };

  return {
    Component,
    loadComponent,
    retry,
    isPreloaded: isPreloaded(),
    ...state,
  };
}

// Intersection Observer based lazy loading
export function useLazyLoadOnView<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions & { threshold?: number; rootMargin?: string } = {}
) {
  const { threshold = 0.1, rootMargin = '50px', ...lazyOptions } = options;
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const {
    Component,
    loadComponent,
    retry,
    isLoaded,
    isLoading,
    error,
  } = useLazyComponent(importFn, lazyOptions);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          loadComponent();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [threshold, rootMargin, isVisible, loadComponent]);

  return {
    elementRef,
    Component,
    retry,
    isVisible,
    isLoaded,
    isLoading,
    error,
  };
}

// Utility for preloading components based on user interaction
export const preloadOnInteraction = {
  onMouseEnter: <T extends ComponentType<unknown>>(
    preloadFn: () => Promise<void>
  ) => ({
    onMouseEnter: () => preloadFn().catch(console.error),
  }),

  onFocus: <T extends ComponentType<unknown>>(
    preloadFn: () => Promise<void>
  ) => ({
    onFocus: () => preloadFn().catch(console.error),
  }),

  onClick: <T extends ComponentType<unknown>>(
    preloadFn: () => Promise<void>
  ) => ({
    onClick: () => preloadFn().catch(console.error),
  }),
};

// Bundle analysis utilities
export const bundleUtils = {
  // Get chunk info
  getChunkInfo: () => {
    if (typeof window !== 'undefined' && 'webpackChunkName' in window) {
      return (window as unknown as { webpackChunkName: string }).webpackChunkName;
    }
    return null;
  },

  // Measure chunk load time
  measureChunkLoad: async (loadFn: () => Promise<any>): Promise<{ result: any; loadTime: number }> => {
    const startTime = performance.now();
    const result = await loadFn();
    const loadTime = performance.now() - startTime;
    
    console.log(`Chunk loaded in ${loadTime.toFixed(2)}ms`);
    return { result, loadTime };
  },
};

export default {
  createLazyComponent,
  LoadingFallback,
  LazyErrorBoundary,
  withLazyLoading,
  createLazyRoutes,
  useLazyComponent,
  useLazyLoadOnView,
  preloadOnInteraction,
  bundleUtils,
};