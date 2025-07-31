import React from 'react';
import { cn } from '@/lib/utils';

// Base skeleton component
const Skeleton = React.memo(({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
});
Skeleton.displayName = "Skeleton";

// Card skeleton
export const CardSkeleton = React.memo(() => (
  <div className="rounded-lg border p-6 space-y-4">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-20 w-full" />
  </div>
));
CardSkeleton.displayName = "CardSkeleton";

// Table skeleton
export const TableSkeleton = React.memo(({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    <div className="flex space-x-4">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex space-x-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    ))}
  </div>
));
TableSkeleton.displayName = "TableSkeleton";

// Chart skeleton
export const ChartSkeleton = React.memo(() => (
  <div className="space-y-4">
    <div className="flex justify-between">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/6" />
    </div>
    <Skeleton className="h-64 w-full" />
    <div className="flex justify-center space-x-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
));
ChartSkeleton.displayName = "ChartSkeleton";

// Dashboard skeleton
export const DashboardSkeleton = React.memo(() => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton />
      <TableSkeleton rows={3} />
    </div>
  </div>
));
DashboardSkeleton.displayName = "DashboardSkeleton";

// Spinner component
export const Spinner = React.memo(({ 
  className, 
  size = 'md' 
}: { 
  className?: string; 
  size?: 'sm' | 'md' | 'lg' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
        sizeClasses[size],
        className
      )}
    />
  );
});
Spinner.displayName = "Spinner";

// Loading overlay
export const LoadingOverlay = React.memo(({ 
  isLoading, 
  children 
}: { 
  isLoading: boolean; 
  children: React.ReactNode 
}) => (
  <div className="relative">
    {children}
    {isLoading && (
      <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )}
  </div>
));
LoadingOverlay.displayName = "LoadingOverlay";

// Lazy loading component
export const LazyLoad = React.memo(({ 
  children, 
  fallback = <Skeleton className="h-32 w-full" /> 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode 
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
});
LazyLoad.displayName = "LazyLoad";

// Virtual list item
export const VirtualListItem = React.memo(({ 
  style, 
  children 
}: {
  index: number;
  style: React.CSSProperties;
  children: React.ReactNode;
}) => (
  <div style={style} className="flex items-center p-2 border-b">
    {children}
  </div>
));
VirtualListItem.displayName = "VirtualListItem";

// Performance monitoring hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = React.useState({
    renderTime: 0,
    componentCount: 0,
    memoryUsage: 0,
  });

  React.useEffect(() => {
    const startTime = performance.now();
    
    const updateMetrics = () => {
      const endTime = performance.now();
      setMetrics(prev => ({
        ...prev,
        renderTime: endTime - startTime,
        componentCount: document.querySelectorAll('[data-component]').length,
        memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0,
      }));
    };

    const timeoutId = setTimeout(updateMetrics, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  return metrics;
};

// Debounced input hook
export const useDebouncedInput = (initialValue: string, delay: number = 300) => {
  const [value, setValue] = React.useState(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState(initialValue);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return [value, setValue, debouncedValue] as const;
};

// Throttled scroll hook
export const useThrottledScroll = (callback: () => void, delay: number = 100) => {
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastRun = React.useRef(Date.now());

  const throttledCallback = React.useCallback(() => {
    if (Date.now() - lastRun.current >= delay) {
      callback();
      lastRun.current = Date.now();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback();
        lastRun.current = Date.now();
      }, delay - (Date.now() - lastRun.current));
    }
  }, [callback, delay]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};

// Default export
export default Skeleton;

 