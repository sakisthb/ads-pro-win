// Advanced React Performance Optimization - Phase 3 Week 9
import React, { 
  memo, 
  useMemo, 
  useCallback, 
  useRef, 
  useEffect, 
  useState,
  ComponentType,
  ReactElement,
  MutableRefObject
} from 'react';

// Performance monitoring utilities
interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  memoryUsage: number;
  reRenderReasons: string[];
}

interface OptimizationConfig {
  enableProfiling: boolean;
  memoryThreshold: number;
  renderTimeThreshold: number;
  debugMode: boolean;
}

// Global performance tracker
class ReactPerformanceTracker {
  private static instance: ReactPerformanceTracker;
  private metrics = new Map<string, PerformanceMetrics>();
  private config: OptimizationConfig = {
    enableProfiling: process.env.NODE_ENV === 'development',
    memoryThreshold: 50, // MB
    renderTimeThreshold: 16, // ms (60fps target)
    debugMode: false,
  };

  static getInstance(): ReactPerformanceTracker {
    if (!ReactPerformanceTracker.instance) {
      ReactPerformanceTracker.instance = new ReactPerformanceTracker();
    }
    return ReactPerformanceTracker.instance;
  }

  trackRender(componentName: string, renderTime: number, reason?: string) {
    if (!this.config.enableProfiling) return;

    const existing = this.metrics.get(componentName) || {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      reRenderReasons: [],
    };

    existing.renderCount++;
    existing.lastRenderTime = renderTime;
    existing.averageRenderTime = (existing.averageRenderTime * (existing.renderCount - 1) + renderTime) / existing.renderCount;
    
    if (reason) {
      existing.reRenderReasons.push(reason);
      if (existing.reRenderReasons.length > 10) {
        existing.reRenderReasons.shift();
      }
    }

    // Memory usage estimation
    if ('memory' in performance) {
      existing.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }

    this.metrics.set(componentName, existing);

    // Warning for performance issues
    if (renderTime > this.config.renderTimeThreshold) {
      console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime}ms`);
    }

    if (this.config.debugMode) {
      console.log(`📊 ${componentName} rendered in ${renderTime}ms (${existing.renderCount} total renders)`);
    }
  }

  getMetrics(componentName?: string) {
    if (componentName) {
      return this.metrics.get(componentName);
    }
    return Object.fromEntries(this.metrics);
  }

  clearMetrics() {
    this.metrics.clear();
  }

  setConfig(config: Partial<OptimizationConfig>) {
    this.config = { ...this.config, ...config };
  }
}

// Advanced memoization hooks
export function useStableMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | undefined>(undefined);
  
  if (!ref.current || !areEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
}

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | undefined>(undefined);
  
  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
}

// Intelligent re-render prevention
export function useShallowEqual<T extends object>(obj: T): T {
  const ref = useRef<T>(obj);
  
  if (!shallowEqual(ref.current, obj)) {
    ref.current = obj;
  }
  
  return ref.current;
}

// Advanced component memoization
export function withAdvancedMemo<P extends object>(
  Component: ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean,
  componentName?: string
): ComponentType<P> {
  const MemoizedComponent = memo(Component, propsAreEqual);
  
  // Add performance tracking
  const TrackedComponent = (props: P) => {
    const renderStartTime = useRef<number | undefined>(undefined);
    const tracker = ReactPerformanceTracker.getInstance();
    const name = componentName || Component.displayName || Component.name || 'Anonymous';

    useEffect(() => {
      renderStartTime.current = performance.now();
    });

    useEffect(() => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        tracker.trackRender(name, renderTime);
      }
    });

    return React.createElement(MemoizedComponent, props);
  };

  TrackedComponent.displayName = `withAdvancedMemo(${Component.displayName || Component.name || 'Component'})`;
  
  return TrackedComponent;
}

// Smart prop comparison functions
export const smartPropsEqual = {
  // Skip functions in comparison (useful for callback props)
  skipFunctions: <P extends object>(prevProps: P, nextProps: P): boolean => {
    const prevFiltered = filterObject(prevProps, (_, value) => typeof value !== 'function');
    const nextFiltered = filterObject(nextProps, (_, value) => typeof value !== 'function');
    return shallowEqual(prevFiltered, nextFiltered);
  },

  // Deep comparison for nested objects
  deep: <P extends object>(prevProps: P, nextProps: P): boolean => {
    return deepEqual(prevProps, nextProps);
  },

  // Custom comparison with specified keys
  keys: <P extends object>(keys: (keyof P)[]) => (prevProps: P, nextProps: P): boolean => {
    return keys.every(key => prevProps[key] === nextProps[key]);
  },

  // Ignore specific keys in comparison
  ignore: <P extends object>(ignoreKeys: (keyof P)[]) => (prevProps: P, nextProps: P): boolean => {
    const relevantKeys = Object.keys(prevProps).filter(key => !ignoreKeys.includes(key as keyof P));
    return relevantKeys.every(key => (prevProps as any)[key] === (nextProps as any)[key]);
  },
};

// Performance monitoring hook
export function useRenderTracker(componentName: string, props?: any) {
  const renderCount = useRef(0);
  const lastProps = useRef(props);
  const tracker = ReactPerformanceTracker.getInstance();

  useEffect(() => {
    renderCount.current++;
    
    let reason = 'Initial render';
    if (renderCount.current > 1) {
      if (props && lastProps.current) {
        const changedProps = findChangedProps(lastProps.current, props);
        reason = changedProps.length > 0 
          ? `Props changed: ${changedProps.join(', ')}`
          : 'Unknown reason';
      } else {
        reason = 'Props or state change';
      }
    }

    tracker.trackRender(componentName, 0, reason);
    lastProps.current = props;
  });

  return {
    renderCount: renderCount.current,
    getMetrics: () => tracker.getMetrics(componentName),
  };
}

// Memory-efficient list rendering
export function useVirtualizedRender<T>(
  items: T[],
  renderItem: (item: T, index: number) => ReactElement,
  options: {
    containerHeight: number;
    itemHeight: number;
    overscan?: number;
  }
) {
  const [scrollTop, setScrollTop] = useState(0);
  const { containerHeight, itemHeight, overscan = 5 } = options;

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + overscan,
    items.length
  );

  const visibleItems = useMemo(() => {
    return items.slice(Math.max(0, visibleStart - overscan), visibleEnd);
  }, [items, visibleStart, visibleEnd, overscan]);

  const totalHeight = items.length * itemHeight;
  const offsetY = Math.max(0, visibleStart - overscan) * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
  };
}

// Optimized event handlers
export function useOptimizedEventHandlers() {
  const handlersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  const createHandler = useCallback(<T extends (...args: any[]) => void>(
    key: string,
    handler: T
  ): T => {
    if (!handlersRef.current.has(key)) {
      handlersRef.current.set(key, handler);
    }
    return handlersRef.current.get(key) as T;
  }, []);

  const updateHandler = useCallback(<T extends (...args: any[]) => void>(
    key: string,
    handler: T
  ): T => {
    handlersRef.current.set(key, handler);
    return handler;
  }, []);

  return { createHandler, updateHandler };
}

// Component factory for optimized components
export function createOptimizedComponent<P extends object>(
  Component: ComponentType<P>,
  options: {
    memoization?: 'shallow' | 'deep' | 'custom';
    customPropsEqual?: (prevProps: P, nextProps: P) => boolean;
    trackPerformance?: boolean;
    componentName?: string;
  } = {}
): ComponentType<P> {
  const {
    memoization = 'shallow',
    customPropsEqual,
    trackPerformance = true,
    componentName,
  } = options;

  let propsAreEqual: ((prevProps: P, nextProps: P) => boolean) | undefined;

  switch (memoization) {
    case 'shallow':
      propsAreEqual = shallowEqual;
      break;
    case 'deep':
      propsAreEqual = deepEqual;
      break;
    case 'custom':
      propsAreEqual = customPropsEqual;
      break;
  }

  if (trackPerformance) {
    return withAdvancedMemo(Component, propsAreEqual, componentName);
  }

  return memo(Component, propsAreEqual);
}

// Utility functions
function areEqual(a: React.DependencyList, b: React.DependencyList): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

function filterObject<T extends object>(
  obj: T,
  predicate: (key: keyof T, value: T[keyof T]) => boolean
): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (predicate(key, obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
}

function findChangedProps(prevProps: any, nextProps: any): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]);

  for (const key of allKeys) {
    if (prevProps[key] !== nextProps[key]) {
      changed.push(key);
    }
  }

  return changed;
}

// Export performance tracker instance
export const performanceTracker = ReactPerformanceTracker.getInstance();

// Export debug utilities
export const debugUtils = {
  enableDebugMode: () => performanceTracker.setConfig({ debugMode: true }),
  disableDebugMode: () => performanceTracker.setConfig({ debugMode: false }),
  getAllMetrics: () => performanceTracker.getMetrics(),
  clearAllMetrics: () => performanceTracker.clearMetrics(),
  logSlowComponents: (threshold = 16) => {
    const allMetrics = performanceTracker.getMetrics();
    if (allMetrics && typeof allMetrics === 'object') {
      Object.entries(allMetrics).forEach(([name, metrics]) => {
        if (metrics && typeof metrics === 'object' && 'averageRenderTime' in metrics) {
          if (metrics.averageRenderTime > threshold) {
            console.warn(`🐌 ${name}: avg ${metrics.averageRenderTime.toFixed(2)}ms, ${metrics.renderCount} renders`);
          }
        }
      });
    }
  },
};