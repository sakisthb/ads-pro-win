"use client";

// Advanced Route-based Code Splitting & Lazy Loading - Phase 3 Week 9
import React, { 
  Suspense, 
  lazy, 
  ComponentType, 
  LazyExoticComponent,
  useEffect,
  useState,
  useRef,
  ReactElement,
  useMemo
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Loading states and error boundaries
interface LoadingComponentProps {
  delay?: number;
  timeout?: number;
  fallback?: ReactElement;
  error?: ReactElement;
}

interface LazyComponentOptions {
  ssr?: boolean;
  loading?: ComponentType<any>;
  suspense?: boolean;
  prefetch?: boolean;
  retries?: number;
  timeout?: number;
}

interface RouteModule {
  component: LazyExoticComponent<ComponentType<any>>;
  preload: () => Promise<any>;
  prefetch: () => void;
  isLoaded: boolean;
  loadingPromise?: Promise<any>;
}

// Advanced loading component with smart delays
const SmartLoader: React.FC<LoadingComponentProps> = ({ 
  delay = 300, 
  timeout = 10000,
  fallback,
  error 
}) => {
  const [showLoader, setShowLoader] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setShowLoader(true), delay);
    const timeoutTimer = setTimeout(() => setHasTimedOut(true), timeout);

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(timeoutTimer);
    };
  }, [delay, timeout]);

  if (hasTimedOut && error) {
    return error;
  }

  if (!showLoader) {
    return null;
  }

  if (fallback) {
    return fallback;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-600">Loading...</span>
    </div>
  );
};

// Route-based lazy loading manager
class LazyRouteManager {
  private static instance: LazyRouteManager;
  private routes = new Map<string, RouteModule>();
  private preloadQueue = new Set<string>();
  private loadingPromises = new Map<string, Promise<any>>();

  static getInstance(): LazyRouteManager {
    if (!LazyRouteManager.instance) {
      LazyRouteManager.instance = new LazyRouteManager();
    }
    return LazyRouteManager.instance;
  }

  // Register a lazy route
  registerRoute(
    path: string,
    importFn: () => Promise<{ default: ComponentType<any> }>,
    options: LazyComponentOptions = {}
  ): LazyExoticComponent<ComponentType<any>> {
    const lazyComponent = lazy(() => {
      const promise = importFn().catch(error => {
        console.error(`Failed to load route ${path}:`, error);
        throw error;
      });

      this.loadingPromises.set(path, promise);
      return promise;
    });

    const routeModule: RouteModule = {
      component: lazyComponent,
      preload: () => {
        if (!this.loadingPromises.has(path)) {
          const promise = importFn();
          this.loadingPromises.set(path, promise);
          return promise;
        }
        return this.loadingPromises.get(path)!;
      },
      prefetch: () => {
        if (!this.preloadQueue.has(path)) {
          this.preloadQueue.add(path);
          requestIdleCallback(() => {
            routeModule.preload();
          });
        }
      },
      isLoaded: false,
    };

    this.routes.set(path, routeModule);

    // Auto-prefetch if enabled
    if (options.prefetch) {
      routeModule.prefetch();
    }

    return lazyComponent;
  }

  // Get route component
  getRoute(path: string): RouteModule | undefined {
    return this.routes.get(path);
  }

  // Preload multiple routes
  preloadRoutes(paths: string[]): Promise<void[]> {
    const promises = paths.map(path => {
      const route = this.routes.get(path);
      return route ? route.preload() : Promise.resolve();
    });

    return Promise.all(promises);
  }

  // Get loading statistics
  getStats() {
    return {
      totalRoutes: this.routes.size,
      loadedRoutes: Array.from(this.routes.values()).filter(r => r.isLoaded).length,
      prefetchQueue: this.preloadQueue.size,
      loadingPromises: this.loadingPromises.size,
    };
  }
}

// Enhanced dynamic import with retry logic
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): LazyExoticComponent<T> {
  const {
    retries = 3,
    timeout = 10000,
  } = options;

  return lazy(() => {
    let attemptCount = 0;

    const loadWithRetry = async (): Promise<{ default: T }> => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Import timeout')), timeout)
        );

        const module = await Promise.race([importFn(), timeoutPromise]);
        return module;
      } catch (error) {
        attemptCount++;
        
        if (attemptCount >= retries) {
          console.error(`Failed to load component after ${retries} attempts:`, error);
          throw error;
        }

        console.warn(`Retrying component load (${attemptCount}/${retries}):`, error);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attemptCount - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return loadWithRetry();
      }
    };

    return loadWithRetry();
  });
}

// Next.js dynamic imports with advanced options
export function createAdvancedDynamic<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions & {
    loadingComponent?: ComponentType<any>;
  } = {}
) {
  const {
    ssr = false,
    loading,
    loadingComponent,
    ...dynamicOptions
  } = options;

  return dynamic(importFn, {
    ssr,
    loading: loading || loadingComponent || (() => <SmartLoader />),
    ...dynamicOptions,
  } as any);
}

// Intersection Observer based lazy loading
export function useIntersectionLazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    threshold?: number;
    rootMargin?: string;
    once?: boolean;
  } = {}
): [LazyExoticComponent<T> | null, React.RefObject<HTMLDivElement | null>] {
  const [component, setComponent] = useState<LazyExoticComponent<T> | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { threshold = 0.1, rootMargin = '50px', once = true } = options;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsIntersecting(false);
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  useEffect(() => {
    if (isIntersecting && !component) {
      const lazyComponent = createLazyComponent(importFn);
      setComponent(lazyComponent);
    }
  }, [isIntersecting, component, importFn]);

  return [component, ref];
}

// Route prefetching hook
export function useRoutePrefetch() {
  const router = useRouter();
  const manager = LazyRouteManager.getInstance();

  const prefetchRoute = useMemo(
    () => (path: string) => {
      const route = manager.getRoute(path);
      if (route) {
        route.prefetch();
      }
    },
    [manager]
  );

  const preloadRoute = useMemo(
    () => (path: string) => {
      const route = manager.getRoute(path);
      return route ? route.preload() : Promise.resolve();
    },
    [manager]
  );

  return { prefetchRoute, preloadRoute };
}

// Optimized lazy component wrapper
export function withLazyLoading<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentOptions & {
    fallback?: ReactElement;
    errorBoundary?: ComponentType<{ error: Error; retry: () => void }>;
  } = {}
): ComponentType<P> {
  const LazyComponent = createLazyComponent(importFn, options);
  const { fallback, errorBoundary: ErrorBoundary } = options;

  return function LazyWrapper(props: P) {
    const [error, setError] = useState<Error | null>(null);

    const retry = () => {
      setError(null);
    };

    if (error && ErrorBoundary) {
      return <ErrorBoundary error={error} retry={retry} />;
    }

    return (
      <Suspense
        fallback={
          fallback || (
            <SmartLoader
              delay={200}
              timeout={10000}
              error={
                error ? (
                  <div className="p-4 text-center text-red-600">
                    Failed to load component
                    <button 
                      onClick={retry}
                      className="ml-2 px-3 py-1 bg-red-100 rounded"
                    >
                      Retry
                    </button>
                  </div>
                ) : undefined
              }
            />
          )
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Bundle splitting utilities
export const bundleSplitter = {
  // Create chunks for specific features
  createFeatureChunk: <T extends ComponentType<any>>(
    feature: string,
    importFn: () => Promise<{ default: T }>
  ) => {
    return createAdvancedDynamic(importFn, {
      ssr: false,
      loading: () => <SmartLoader delay={150} />,
    });
  },

  // Create vendor chunks
  createVendorChunk: <T extends ComponentType<any>>(
    vendor: string,
    importFn: () => Promise<{ default: T }>
  ) => {
    return createAdvancedDynamic(importFn, {
      ssr: true,
      loading: () => <SmartLoader delay={100} />,
    });
  },

  // Create page chunks
  createPageChunk: <T extends ComponentType<any>>(
    page: string,
    importFn: () => Promise<{ default: T }>
  ) => {
    const manager = LazyRouteManager.getInstance();
    return manager.registerRoute(page, importFn, {
      prefetch: true,
      retries: 2,
    });
  },
};

// Performance monitoring for lazy loading
export function useLazyLoadingMetrics() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    chunkSize: 0,
    cacheHit: false,
    retryCount: 0,
  });

  const trackLoad = (startTime: number, endTime: number, retries = 0) => {
    setMetrics(prev => ({
      ...prev,
      loadTime: endTime - startTime,
      retryCount: retries,
    }));
  };

  return { metrics, trackLoad };
}

// Export manager instance
export const lazyRouteManager = LazyRouteManager.getInstance();

// Export utilities
export { SmartLoader };
export default {
  createLazyComponent,
  createAdvancedDynamic,
  useIntersectionLazyLoad,
  useRoutePrefetch,
  withLazyLoading,
  bundleSplitter,
  lazyRouteManager,
};