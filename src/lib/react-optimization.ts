// Advanced React Optimization Utilities - Phase 3 Week 9
import React, { 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect, 
  useState,
  MutableRefObject,
} from 'react';

// Types for optimization utilities
interface MemoizeOptions {
  maxSize?: number;
  ttl?: number;
  keySerializer?: (...args: unknown[]) => string;
}

interface UseOptimizedStateOptions<T> {
  equalityFn?: (prev: T, next: T) => boolean;
  debounceMs?: number;
  shouldUpdate?: (prev: T, next: T) => boolean;
}

interface RenderProfilerData {
  componentName: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
  slowRenders: number;
}

// Advanced memoization with cache size and TTL
export function useAdvancedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: MemoizeOptions = {}
): T {
  const { maxSize = 100, ttl = 5 * 60 * 1000, keySerializer } = options;
  
  const cacheRef = useRef(new Map<string, { value: T; timestamp: number }>());
  const cache = cacheRef.current;

  return useMemo(() => {
    // Generate cache key
    const key = keySerializer ? keySerializer(...deps) : JSON.stringify(deps);
    
    // Check if cached value exists and is still valid
    const cached = cache.get(key);
    const now = Date.now();
    
    if (cached && (ttl === 0 || now - cached.timestamp < ttl)) {
      return cached.value;
    }

    // Compute new value
    const value = factory();
    
    // Store in cache
    cache.set(key, { value, timestamp: now });
    
    // Clean up old entries if cache is too large
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 25% of entries
      const toRemove = Math.floor(maxSize * 0.25);
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
    
    return value;
  }, deps);
}

// Advanced callback memoization with dependency comparison
export function useAdvancedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList,
  options: { deepCompare?: boolean } = {}
): T {
  const { deepCompare = false } = options;
  const prevDepsRef = useRef<React.DependencyList>();
  const callbackRef = useRef<T>();

  // Custom dependency comparison
  const depsChanged = useMemo(() => {
    if (!prevDepsRef.current) return true;
    
    if (prevDepsRef.current.length !== deps.length) return true;
    
    for (let i = 0; i < deps.length; i++) {
      const prev = prevDepsRef.current[i];
      const current = deps[i];
      
      if (deepCompare) {
        if (JSON.stringify(prev) !== JSON.stringify(current)) return true;
      } else {
        if (prev !== current) return true;
      }
    }
    
    return false;
  }, deps);

  if (depsChanged || !callbackRef.current) {
    callbackRef.current = callback;
    prevDepsRef.current = deps;
  }

  return callbackRef.current!;
}

// Optimized state with custom equality and debouncing
export function useOptimizedState<T>(
  initialState: T | (() => T),
  options: UseOptimizedStateOptions<T> = {}
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { equalityFn, debounceMs = 0, shouldUpdate } = options;
  
  const [state, setState] = useState<T>(initialState);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<T>(state);

  const optimizedSetState = useCallback((value: React.SetStateAction<T>) => {
    const nextValue = typeof value === 'function' 
      ? (value as (prevState: T) => T)(lastUpdateRef.current)
      : value;

    // Check if update should proceed
    if (shouldUpdate && !shouldUpdate(lastUpdateRef.current, nextValue)) {
      return;
    }

    // Check equality
    if (equalityFn && equalityFn(lastUpdateRef.current, nextValue)) {
      return;
    }

    // Default equality check
    if (!equalityFn && lastUpdateRef.current === nextValue) {
      return;
    }

    lastUpdateRef.current = nextValue;

    // Debounce if specified
    if (debounceMs > 0) {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
      
      pendingUpdateRef.current = setTimeout(() => {
        setState(nextValue);
        pendingUpdateRef.current = null;
      }, debounceMs);
    } else {
      setState(nextValue);
    }
  }, [equalityFn, debounceMs, shouldUpdate]);

  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, []);

  return [state, optimizedSetState];
}

// Performance profiler hook
export function useRenderProfiler(componentName: string): RenderProfilerData {
  const profileDataRef = useRef<RenderProfilerData>({
    componentName,
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    slowRenders: 0,
  });

  const startTimeRef = useRef<number>(0);

  // Mark render start
  startTimeRef.current = performance.now();

  useEffect(() => {
    // Mark render end
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    
    const data = profileDataRef.current;
    data.renderCount++;
    data.lastRenderTime = renderTime;
    data.totalRenderTime += renderTime;
    data.averageRenderTime = data.totalRenderTime / data.renderCount;
    
    // Track slow renders (> 16ms for 60fps)
    if (renderTime > 16) {
      data.slowRenders++;
    }

    // Log performance warnings in development
    if (process.env.NODE_ENV === 'development') {
      if (renderTime > 50) {
        console.warn(
          `🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
        );
      }
      
      if (data.renderCount % 10 === 0) {
        console.log(
          `📊 ${componentName} performance:`,
          `Renders: ${data.renderCount}`,
          `Avg: ${data.averageRenderTime.toFixed(2)}ms`,
          `Slow: ${data.slowRenders}`
        );
      }
    }
  });

  return profileDataRef.current;
}

// Intersection observer hook for virtualization
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [MutableRefObject<Element | null>, IntersectionObserverEntry | null] {
  const elementRef = useRef<Element | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [options.threshold, options.rootMargin]);

  return [elementRef, entry];
}

// Optimized list rendering hook
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    return {
      start: Math.max(0, start - overscan),
      end,
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
    }));
  }, [items, visibleRange.start, visibleRange.end]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
  };
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
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
}

// Throttled callback hook
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;
}

// Memory usage monitoring hook
export function useMemoryMonitor(): {
  memoryInfo: MemoryInfo | null;
  isLowMemory: boolean;
} {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [isLowMemory, setIsLowMemory] = useState(false);

  useEffect(() => {
    if (!('memory' in performance)) {
      return;
    }

    const checkMemory = () => {
      const memory = (performance as Performance & { memory: MemoryInfo }).memory;
      setMemoryInfo(memory);
      
      // Consider low memory if used heap is > 80% of heap limit
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      setIsLowMemory(usageRatio > 0.8);
    };

    // Check memory usage every 5 seconds
    const interval = setInterval(checkMemory, 5000);
    checkMemory(); // Initial check

    return () => clearInterval(interval);
  }, []);

  return { memoryInfo, isLowMemory };
}

// Component lazy loading with preload
export function useLazyComponent<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  preload: boolean = false
): {
  Component: React.LazyExoticComponent<T> | null;
  isLoading: boolean;
  error: Error | null;
  preloadComponent: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const componentRef = useRef<React.LazyExoticComponent<T> | null>(null);

  const preloadComponent = useCallback(() => {
    if (componentRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    importFn()
      .then(() => {
        if (!componentRef.current) {
          componentRef.current = React.lazy(importFn);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, [importFn]);

  useEffect(() => {
    if (preload) {
      preloadComponent();
    }
  }, [preload, preloadComponent]);

  return {
    Component: componentRef.current,
    isLoading,
    error,
    preloadComponent,
  };
}

// Higher-order component for performance optimization
export function withPerformanceOptimization<P extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    name?: string;
    shouldUpdate?: (prevProps: P, nextProps: P) => boolean;
    profileRenders?: boolean;
  } = {}
) {
  const { name, shouldUpdate, profileRenders = false } = options;
  const componentName = name || WrappedComponent.displayName || WrappedComponent.name;

  const OptimizedComponent = React.memo((props: P) => {
    const profileData = profileRenders ? useRenderProfiler(componentName) : null;
    
    if (profileData && process.env.NODE_ENV === 'development') {
      // Add performance data to component for debugging
      (OptimizedComponent as unknown as { _performanceData: RenderProfilerData })._performanceData = profileData;
    }

    return React.createElement(WrappedComponent, props);
  }, shouldUpdate);

  OptimizedComponent.displayName = `withPerformanceOptimization(${componentName})`;

  return OptimizedComponent;
}

// Export all optimization utilities
export const ReactOptimization = {
  useAdvancedMemo,
  useAdvancedCallback,
  useOptimizedState,
  useRenderProfiler,
  useIntersectionObserver,
  useVirtualizedList,
  useDebounce,
  useThrottle,
  useMemoryMonitor,
  useLazyComponent,
  withPerformanceOptimization,
};

export default ReactOptimization;