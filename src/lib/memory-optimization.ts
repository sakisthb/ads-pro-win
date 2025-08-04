// Memory Management & Garbage Collection Optimization - Phase 3 Week 9
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';

// Memory performance metrics
interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryUsage: number; // Percentage
  gcCollections: number;
  lastGCTime: number;
}

interface MemoryThresholds {
  warning: number; // MB
  critical: number; // MB
  gcTrigger: number; // MB
}

interface MemoryOptimizationConfig {
  enableMonitoring: boolean;
  autoCleanup: boolean;
  gcSuggestionThreshold: number;
  cleanupInterval: number;
  maxCacheSize: number;
  enableLeakDetection: boolean;
}

// Memory management utilities
class MemoryManager {
  private static instance: MemoryManager;
  private config: MemoryOptimizationConfig;
  private metrics: MemoryMetrics;
  private thresholds: MemoryThresholds;
  private cleanupTasks: Set<() => void> = new Set();
  private intervalId: number | null = null;
  private observers: Set<(metrics: MemoryMetrics) => void> = new Set();
  private cacheStore = new Map<string, { data: any; timestamp: number; size: number }>();
  private leakDetectionRefs = new WeakMap<object, string>();

  constructor() {
    this.config = {
      enableMonitoring: process.env.NODE_ENV === 'development',
      autoCleanup: true,
      gcSuggestionThreshold: 50, // MB
      cleanupInterval: 30000, // 30 seconds
      maxCacheSize: 100, // MB
      enableLeakDetection: process.env.NODE_ENV === 'development',
    };

    this.thresholds = {
      warning: 80, // MB
      critical: 150, // MB
      gcTrigger: 100, // MB
    };

    this.metrics = this.getInitialMetrics();
    this.initialize();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private getInitialMetrics(): MemoryMetrics {
    const performance = (window as any).performance;
    const memory = performance?.memory;

    return {
      usedJSHeapSize: memory?.usedJSHeapSize || 0,
      totalJSHeapSize: memory?.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
      memoryUsage: 0,
      gcCollections: 0,
      lastGCTime: 0,
    };
  }

  private initialize(): void {
    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }

    // Listen for memory pressure events
    if ('memory' in navigator) {
      (navigator as any).memory?.addEventListener?.('memorypressure', () => {
        this.performEmergencyCleanup();
      });
    }
  }

  private startMonitoring(): void {
    const monitor = () => {
      this.updateMetrics();
      this.checkThresholds();
    };

    // Monitor every 5 seconds
    this.intervalId = window.setInterval(monitor, 5000);
    
    // Initial measurement
    monitor();
  }

  private startAutoCleanup(): void {
    const cleanup = () => {
      this.performRoutineCleanup();
    };

    // Cleanup every 30 seconds
    setInterval(cleanup, this.config.cleanupInterval);
  }

  private updateMetrics(): void {
    const performance = (window as any).performance;
    const memory = performance?.memory;

    if (memory) {
      const previousUsed = this.metrics.usedJSHeapSize;
      
      this.metrics = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        memoryUsage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        gcCollections: this.metrics.gcCollections + (memory.usedJSHeapSize < previousUsed ? 1 : 0),
        lastGCTime: memory.usedJSHeapSize < previousUsed ? Date.now() : this.metrics.lastGCTime,
      };

      // Notify observers
      this.observers.forEach(observer => observer(this.metrics));
    }
  }

  private checkThresholds(): void {
    const usedMB = this.metrics.usedJSHeapSize / 1024 / 1024;

    if (usedMB > this.thresholds.critical) {
      console.error(`🚨 Critical memory usage: ${usedMB.toFixed(2)}MB`);
      this.performEmergencyCleanup();
    } else if (usedMB > this.thresholds.warning) {
      console.warn(`⚠️ High memory usage: ${usedMB.toFixed(2)}MB`);
      this.performRoutineCleanup();
    }

    if (usedMB > this.thresholds.gcTrigger) {
      this.suggestGarbageCollection();
    }
  }

  performRoutineCleanup(): void {
    console.log('🧹 Performing routine memory cleanup...');
    
    // Execute registered cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    });

    // Clean expired cache entries
    this.cleanExpiredCache();
    
    // Trigger minor GC if needed
    this.triggerMinorGC();
  }

  private performEmergencyCleanup(): void {
    console.log('🚨 Performing emergency memory cleanup...');
    
    // Clear all non-essential caches
    this.clearCache();
    
    // Execute all cleanup tasks
    this.performRoutineCleanup();
    
    // Force garbage collection if possible
    this.triggerMajorGC();
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    let cleanedSize = 0;

    for (const [key, entry] of this.cacheStore.entries()) {
      if (now - entry.timestamp > maxAge) {
        cleanedSize += entry.size;
        this.cacheStore.delete(key);
      }
    }

    if (cleanedSize > 0) {
      console.log(`🗑️ Cleaned ${(cleanedSize / 1024 / 1024).toFixed(2)}MB of expired cache`);
    }
  }

  private clearCache(): void {
    const totalSize = Array.from(this.cacheStore.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    this.cacheStore.clear();
    
    if (totalSize > 0) {
      console.log(`🗑️ Cleared ${(totalSize / 1024 / 1024).toFixed(2)}MB of cache`);
    }
  }

  private triggerMinorGC(): void {
    // Trigger minor GC by creating and discarding objects
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    } else {
      // Fallback: create temporary large objects to trigger GC
      try {
        const temp = new Array(1000).fill(0).map(() => ({ data: new Array(1000) }));
        temp.length = 0; // Clear reference
      } catch (error) {
        // Ignore errors
      }
    }
  }

  private triggerMajorGC(): void {
    // Force major GC
    this.triggerMinorGC();
    
    // Additional cleanup
    if (typeof window !== 'undefined') {
      // Clear all timers that might be holding references
      let id = window.setTimeout(() => {}, 0);
      while (id > 0) {
        window.clearTimeout(id--);
      }
    }
  }

  private suggestGarbageCollection(): void {
    const usedMB = this.metrics.usedJSHeapSize / 1024 / 1024;
    
    if (usedMB > this.config.gcSuggestionThreshold) {
      console.log(`💡 Suggesting garbage collection (${usedMB.toFixed(2)}MB used)`);
      this.triggerMinorGC();
    }
  }

  // Public API
  getMetrics(): MemoryMetrics {
    return { ...this.metrics };
  }

  getConfig(): MemoryOptimizationConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  registerCleanupTask(task: () => void): () => void {
    this.cleanupTasks.add(task);
    return () => this.cleanupTasks.delete(task);
  }

  subscribe(observer: (metrics: MemoryMetrics) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  // Cache management
  setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    const size = this.estimateSize(data);
    const totalCacheSize = Array.from(this.cacheStore.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    // Check cache size limit
    if (totalCacheSize + size > this.config.maxCacheSize * 1024 * 1024) {
      this.cleanExpiredCache();
    }

    this.cacheStore.set(key, {
      data,
      timestamp: Date.now(),
      size,
    });
  }

  getCache(key: string): any | null {
    const entry = this.cacheStore.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
      this.cacheStore.delete(key);
      return null;
    }

    return entry.data;
  }

  private estimateSize(obj: any): number {
    // Rough estimation of object size in bytes
    const jsonStr = JSON.stringify(obj);
    return new Blob([jsonStr]).size;
  }

  // Leak detection
  trackPotentialLeak(obj: object, identifier: string): void {
    if (this.config.enableLeakDetection) {
      this.leakDetectionRefs.set(obj, identifier);
    }
  }

  checkForLeaks(): string[] {
    const leaks: string[] = [];
    
    // This is a simplified leak detection
    // In practice, you'd want more sophisticated tracking
    
    return leaks;
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.cleanupTasks.clear();
    this.observers.clear();
    this.cacheStore.clear();
  }
}

// React hooks for memory optimization
export function useMemoryOptimization(options: {
  enableMonitoring?: boolean;
  cleanupOnUnmount?: boolean;
  trackComponent?: boolean;
} = {}) {
  const manager = MemoryManager.getInstance();
  const componentRef = useRef<string>(`Component_${Date.now()}_${Math.random()}`);
  
  const {
    enableMonitoring = false,
    cleanupOnUnmount = true,
    trackComponent = false,
  } = options;

  // Register cleanup tasks
  const registerCleanup = useCallback((task: () => void) => {
    return manager.registerCleanupTask(task);
  }, [manager]);

  // Memory-efficient state management
  const createOptimizedState = useCallback(<T>(initialValue: T) => {
    const stateRef = useRef<T>(initialValue);
    
    const setState = (newValue: T | ((prev: T) => T)) => {
      const value = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(stateRef.current)
        : newValue;
      
      stateRef.current = value;
    };

    return [() => stateRef.current, setState] as const;
  }, []);

  // Track component for leak detection
  useEffect(() => {
    if (trackComponent) {
      const componentObj = { componentId: componentRef.current };
      manager.trackPotentialLeak(componentObj, componentRef.current);
    }
  }, [manager, trackComponent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupOnUnmount) {
        // Cleanup component-specific resources
        manager.registerCleanupTask(() => {
          // Component-specific cleanup logic
        })();
      }
    };
  }, [manager, cleanupOnUnmount]);

  return {
    registerCleanup,
    createOptimizedState,
    getMetrics: () => manager.getMetrics(),
    triggerCleanup: () => manager.performRoutineCleanup(),
  };
}

// Memory-efficient event handler management
export function useOptimizedEventHandlers() {
  const handlersRef = useRef<Map<string, any>>(new Map());
  const manager = MemoryManager.getInstance();

  const createHandler = useCallback(<T extends (...args: any[]) => any>(
    key: string,
    handler: T,
    deps: any[] = []
  ): T => {
    const depsKey = `${key}_${JSON.stringify(deps)}`;
    
    if (!handlersRef.current.has(depsKey)) {
      handlersRef.current.set(depsKey, handler);
    }
    
    return handlersRef.current.get(depsKey);
  }, []);

  // Cleanup old handlers
  const cleanupHandlers = useCallback(() => {
    handlersRef.current.clear();
  }, []);

  useEffect(() => {
    const unregister = manager.registerCleanupTask(cleanupHandlers);
    return unregister;
  }, [manager, cleanupHandlers]);

  return { createHandler, cleanupHandlers };
}

// Memory monitoring hook
export function useMemoryMonitor() {
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null);
  const manager = MemoryManager.getInstance();

  useEffect(() => {
    const unsubscribe = manager.subscribe(setMetrics);
    setMetrics(manager.getMetrics());
    return unsubscribe;
  }, [manager]);

  return metrics;
}

// Optimized large list handling
export function useMemoryEfficientList<T>(
  items: T[],
  options: {
    pageSize?: number;
    preloadPages?: number;
    cacheKey?: string;
  } = {}
) {
  const { pageSize = 50, preloadPages = 2, cacheKey } = options;
  const [currentPage, setCurrentPage] = useState(0);
  const manager = MemoryManager.getInstance();

  const paginatedItems = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize * (preloadPages + 1);
    return items.slice(start, end);
  }, [items, currentPage, pageSize, preloadPages]);

  // Cache frequently accessed items
  useEffect(() => {
    if (cacheKey && paginatedItems.length > 0) {
      manager.setCache(`list_${cacheKey}_${currentPage}`, paginatedItems);
    }
  }, [manager, cacheKey, currentPage, paginatedItems]);

  const loadMore = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(0);
  }, []);

  return {
    items: paginatedItems,
    currentPage,
    hasMore: (currentPage + 1) * pageSize < items.length,
    loadMore,
    reset,
  };
}

// Export manager instance
export const memoryManager = MemoryManager.getInstance();

// Export utilities
export {
  MemoryManager,
};