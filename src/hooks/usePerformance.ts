// Performance Optimization Hooks - Phase 3 Week 7
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Debounce hook for performance optimization
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Throttle hook for performance optimization
export const useThrottle = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const lastRan = useRef<number>(Date.now());

  return useCallback(
    ((...args: unknown[]) => {
      if (Date.now() - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = Date.now();
      }
    }) as T,
    [callback, delay]
  );
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      options
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options, hasIntersected]);

  return { isIntersecting, hasIntersected };
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const mountTime = useRef<number>(Date.now());
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
  });

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - mountTime.current;

    setPerformanceMetrics(prev => ({
      renderCount: renderCount.current,
      lastRenderTime: renderTime,
      averageRenderTime: prev.averageRenderTime 
        ? (prev.averageRenderTime + renderTime) / 2 
        : renderTime,
    }));

    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current} took ${renderTime}ms`);
    }

    mountTime.current = Date.now();
  }, [componentName]);

  return performanceMetrics;
};

// Memoized callback hook with dependencies
export const useStableCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T => {
  return useCallback(callback, deps);
};

// Virtual scrolling hook
export const useVirtualScrolling = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      itemCount - 1
    );

    return { startIndex, endIndex, totalHeight: itemCount * itemHeight };
  }, [scrollTop, itemHeight, containerHeight, itemCount]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    ...visibleRange,
    onScroll,
    scrollTop,
  };
};

// Async operation hook with caching
export const useAsyncWithCache = <T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList,
  cacheKey: string
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cache = useRef<Map<string, T>>(new Map());

  const execute = useCallback(async () => {
    // Check cache first
    if (cache.current.has(cacheKey)) {
      setData(cache.current.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      cache.current.set(cacheKey, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [asyncFn, cacheKey, ...deps]);

  useEffect(() => {
    execute();
  }, [execute]);

  const refetch = useCallback(() => {
    cache.current.delete(cacheKey);
    execute();
  }, [cacheKey, execute]);

  return { data, loading, error, refetch };
};

// Memory usage monitoring hook
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    if ('memory' in performance && (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
      const updateMemoryInfo = () => {
        const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      };

      updateMemoryInfo();
      const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, []);

  return memoryInfo;
};

// Optimized state update hook
export const useOptimizedState = <T>(initialState: T) => {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);

  const optimizedSetState = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prevState)
        : newValue;

      // Only update if value actually changed
      if (Object.is(nextState, prevState)) {
        return prevState;
      }

      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  return [state, optimizedSetState, stateRef] as const;
};

// Bundle size monitoring (development only)
export const useBundleMonitor = () => {
  const [bundleInfo, setBundleInfo] = useState<{
    size: number;
    chunks: number;
  } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // This would be populated by webpack bundle analyzer
      setBundleInfo({
        size: 105000, // 105kB - current bundle size
        chunks: 3,
      });
    }
  }, []);

  return bundleInfo;
};

// Performance timing hook using Navigation Timing API
export const usePagePerformance = () => {
  const [performanceTiming, setPerformanceTiming] = useState<{
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
    firstContentfulPaint: number;
  } | null>(null);

  useEffect(() => {
    const updatePerformanceTiming = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      if (navigation) {
        setPerformanceTiming({
          domContentLoaded: navigation.domContentLoadedEventEnd,
          loadComplete: navigation.loadEventEnd,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        });
      }
    };

    if (document.readyState === 'complete') {
      updatePerformanceTiming();
    } else {
      window.addEventListener('load', updatePerformanceTiming);
      return () => window.removeEventListener('load', updatePerformanceTiming);
    }
  }, []);

  return performanceTiming;
};

// Combined performance optimization hook
export const usePerformanceOptimizations = (componentName: string) => {
  const performanceMetrics = usePerformanceMonitor(componentName);
  const memoryInfo = useMemoryMonitor();
  const bundleInfo = useBundleMonitor();
  const pagePerformance = usePagePerformance();

  const optimizations = useMemo(() => ({
    shouldUseVirtualScrolling: memoryInfo && memoryInfo.usedJSHeapSize > 50000000, // 50MB
    shouldLazyLoad: pagePerformance && pagePerformance.loadComplete > 3000, // 3s
    shouldDebounce: performanceMetrics.renderCount > 10,
    shouldMemoize: performanceMetrics.averageRenderTime > 16, // 60fps = 16ms per frame
  }), [performanceMetrics, memoryInfo, pagePerformance]);

  return {
    performanceMetrics,
    memoryInfo,
    bundleInfo,
    pagePerformance,
    optimizations,
  };
};

const performanceHooks = {
  useDebounce,
  useThrottle,
  useIntersectionObserver,
  usePerformanceMonitor,
  useVirtualScrolling,
  useAsyncWithCache,
  useMemoryMonitor,
  useOptimizedState,
  useBundleMonitor,
  usePagePerformance,
  usePerformanceOptimizations,
};

export default performanceHooks;