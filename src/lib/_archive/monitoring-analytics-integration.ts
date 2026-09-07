// Monitoring & Analytics Integration - Phase 3 Week 10
import { performance } from 'perf_hooks';

// Analytics and monitoring interfaces
interface AnalyticsEvent {
  name: string;
  category: 'user' | 'system' | 'business' | 'performance' | 'error';
  properties: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  tags: Record<string, string>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

interface ErrorEvent {
  message: string;
  stack?: string;
  context: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

interface MonitoringConfig {
  enableAnalytics: boolean;
  enablePerformanceMonitoring: boolean;
  enableErrorTracking: boolean;
  enableRealUserMonitoring: boolean;
  sampleRate: number;
  bufferSize: number;
  flushInterval: number;
  endpoints: {
    analytics?: string;
    performance?: string;
    errors?: string;
  };
}

// Advanced Monitoring & Analytics Manager
class MonitoringAnalyticsManager {
  private static instance: MonitoringAnalyticsManager;
  private config: MonitoringConfig;
  private eventBuffer: AnalyticsEvent[] = [];
  private performanceBuffer: PerformanceMetric[] = [];
  private errorBuffer: ErrorEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private pageLoadTime: number;

  constructor() {
    this.config = {
      enableAnalytics: process.env.NODE_ENV === 'production',
      enablePerformanceMonitoring: true,
      enableErrorTracking: true,
      enableRealUserMonitoring: true,
      sampleRate: 1.0, // 100% sampling in development
      bufferSize: 100,
      flushInterval: 30000, // 30 seconds
      endpoints: {
        analytics: process.env.ANALYTICS_ENDPOINT || '/api/analytics',
        performance: process.env.PERFORMANCE_ENDPOINT || '/api/performance',
        errors: process.env.ERROR_ENDPOINT || '/api/errors',
      },
    };

    this.sessionId = this.generateSessionId();
    this.pageLoadTime = Date.now();
    this.initialize();
  }

  static getInstance(): MonitoringAnalyticsManager {
    if (!MonitoringAnalyticsManager.instance) {
      MonitoringAnalyticsManager.instance = new MonitoringAnalyticsManager();
    }
    return MonitoringAnalyticsManager.instance;
  }

  private initialize(): void {
    // Start automatic flushing
    this.startAutoFlush();

    // Set up performance observers
    this.setupPerformanceObservers();

    // Set up error handlers
    this.setupErrorHandlers();

    // Track page load metrics
    this.trackPageLoad();

    console.log('📊 Monitoring & Analytics initialized');
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics event tracking
  trackEvent(name: string, properties: Record<string, any> = {}, category: AnalyticsEvent['category'] = 'user'): void {
    if (!this.config.enableAnalytics || Math.random() > this.config.sampleRate) {
      return;
    }

    const event: AnalyticsEvent = {
      name,
      category,
      properties: {
        ...properties,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      metadata: {
        buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
        environment: process.env.NODE_ENV,
      },
    };

    this.eventBuffer.push(event);
    this.checkAndFlush('events');
  }

  // Performance metric tracking
  trackPerformance(name: string, value: number, unit: PerformanceMetric['unit'] = 'ms', tags: Record<string, string> = {}): void {
    if (!this.config.enablePerformanceMonitoring) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags: {
        ...tags,
        sessionId: this.sessionId,
        environment: process.env.NODE_ENV || 'development',
      },
    };

    // Set thresholds based on metric type
    if (name.includes('response_time') || name.includes('duration')) {
      metric.threshold = { warning: 1000, critical: 3000 };
    } else if (name.includes('memory') || name.includes('heap')) {
      metric.threshold = { warning: 100 * 1024 * 1024, critical: 250 * 1024 * 1024 }; // MB
    }

    this.performanceBuffer.push(metric);
    this.checkAndFlush('performance');

    // Log warnings for critical metrics
    if (metric.threshold) {
      if (value > metric.threshold.critical) {
        console.error(`🚨 Critical performance metric: ${name} = ${value}${unit}`);
      } else if (value > metric.threshold.warning) {
        console.warn(`⚠️ Performance warning: ${name} = ${value}${unit}`);
      }
    }
  }

  // Error tracking
  trackError(error: Error | string, context: Record<string, any> = {}, severity: ErrorEvent['severity'] = 'medium'): void {
    if (!this.config.enableErrorTracking) {
      return;
    }

    const errorEvent: ErrorEvent = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      context: {
        ...context,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      severity,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.errorBuffer.push(errorEvent);
    this.checkAndFlush('errors');

    // Immediate console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${errorEvent.message}`, errorEvent.context);
    }
  }

  // Real User Monitoring (RUM) setup
  private setupPerformanceObservers(): void {
    if (typeof window === 'undefined' || !this.config.enableRealUserMonitoring) {
      return;
    }

    // Navigation Timing
    if ('PerformanceNavigationTiming' in window) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const navEntry = entry as PerformanceNavigationTiming;
          
          this.trackPerformance('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart, 'ms', {
            type: 'navigation',
            navigationType: navEntry.type,
          });

          this.trackPerformance('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'ms', {
            type: 'navigation',
          });

          this.trackPerformance('first_byte', navEntry.responseStart - navEntry.fetchStart, 'ms', {
            type: 'navigation',
          });
        });
      }).observe({ entryTypes: ['navigation'] });
    }

    // Resource Timing
    if ('PerformanceResourceTiming' in window) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          if (resourceEntry.duration > 1000) { // Only track slow resources
            this.trackPerformance('resource_load_time', resourceEntry.duration, 'ms', {
              type: 'resource',
              resourceType: resourceEntry.initiatorType,
              url: resourceEntry.name,
            });
          }
        });
      }).observe({ entryTypes: ['resource'] });
    }

    // Paint Timing
    if ('PerformancePaintTiming' in window) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.trackPerformance(entry.name.replace('-', '_'), entry.startTime, 'ms', {
            type: 'paint',
          });
        });
      }).observe({ entryTypes: ['paint'] });
    }

    // Layout Shift (CLS)
    if ('LayoutShift' in window) {
      new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });
        
        if (clsValue > 0) {
          this.trackPerformance('cumulative_layout_shift', clsValue, 'count', {
            type: 'web_vital',
          });
        }
      }).observe({ entryTypes: ['layout-shift'] });
    }

    // Memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        this.trackPerformance('heap_used', memInfo.usedJSHeapSize, 'bytes', {
          type: 'memory',
        });
        this.trackPerformance('heap_total', memInfo.totalJSHeapSize, 'bytes', {
          type: 'memory',
        });
      }, 30000); // Every 30 seconds
    }
  }

  private setupErrorHandlers(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }, 'high');
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(event.reason, {
        type: 'unhandled_promise_rejection',
      }, 'high');
    });
  }

  private trackPageLoad(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const loadTime = Date.now() - this.pageLoadTime;
        this.trackPerformance('page_load_complete', loadTime, 'ms', {
          type: 'page_load',
        });

        // Track initial page view
        this.trackEvent('page_view', {
          path: window.location.pathname,
          search: window.location.search,
          title: document.title,
        });
      });
    }
  }

  // Custom Web Vitals tracking
  trackWebVital(name: string, value: number, id: string): void {
    this.trackPerformance(`web_vital_${name}`, value, name === 'CLS' ? 'count' : 'ms', {
      type: 'web_vital',
      id,
    });

    // Web Vitals thresholds
    const thresholds: Record<string, { good: number; poor: number }> = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[name];
    if (threshold) {
      let rating = 'good';
      if (value > threshold.poor) {
        rating = 'poor';
      } else if (value > threshold.good) {
        rating = 'needs-improvement';
      }

      this.trackEvent('web_vital', {
        name,
        value,
        rating,
        id,
      }, 'performance');
    }
  }

  // Business metrics tracking
  trackBusinessMetric(name: string, value: number, attributes: Record<string, any> = {}): void {
    this.trackEvent('business_metric', {
      metric_name: name,
      metric_value: value,
      ...attributes,
    }, 'business');
  }

  // User journey tracking
  trackUserAction(action: string, target?: string, value?: number): void {
    this.trackEvent('user_action', {
      action,
      target,
      value,
      timestamp: Date.now(),
    });
  }

  // A/B test tracking
  trackExperiment(experimentName: string, variant: string, converted?: boolean): void {
    this.trackEvent('experiment', {
      experiment_name: experimentName,
      variant,
      converted: converted || false,
    }, 'business');
  }

  // Feature usage tracking
  trackFeatureUsage(feature: string, context: Record<string, any> = {}): void {
    this.trackEvent('feature_usage', {
      feature,
      ...context,
    });
  }

  private checkAndFlush(type: 'events' | 'performance' | 'errors'): void {
    const buffer = type === 'events' ? this.eventBuffer : 
                   type === 'performance' ? this.performanceBuffer : 
                   this.errorBuffer;

    if (buffer.length >= this.config.bufferSize) {
      this.flush(type);
    }
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushAll();
    }, this.config.flushInterval);
  }

  // Flush data to endpoints
  private async flush(type: 'events' | 'performance' | 'errors'): Promise<void> {
    const buffer = type === 'events' ? this.eventBuffer : 
                   type === 'performance' ? this.performanceBuffer : 
                   this.errorBuffer;

    if (buffer.length === 0) return;

    const endpoint = this.config.endpoints[type === 'events' ? 'analytics' : type];
    if (!endpoint) return;

    const data = [...buffer];
    buffer.length = 0; // Clear buffer

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
          sessionId: this.sessionId,
        }),
      });

      console.log(`📤 Flushed ${data.length} ${type} records`);
    } catch (error) {
      console.error(`Failed to flush ${type} data:`, error);
      // Re-add data to buffer for retry
      if (type === 'events') {
        this.eventBuffer.unshift(...(data as AnalyticsEvent[]));
      } else if (type === 'performance') {
        this.performanceBuffer.unshift(...(data as PerformanceMetric[]));
      } else {
        this.errorBuffer.unshift(...(data as ErrorEvent[]));
      }
    }
  }

  // Flush all buffers
  async flushAll(): Promise<void> {
    await Promise.all([
      this.flush('events'),
      this.flush('performance'),
      this.flush('errors'),
    ]);
  }

  // Get current session metrics
  getSessionMetrics(): {
    sessionId: string;
    duration: number;
    eventCount: number;
    errorCount: number;
    performanceMetrics: number;
  } {
    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.pageLoadTime,
      eventCount: this.eventBuffer.length,
      errorCount: this.errorBuffer.length,
      performanceMetrics: this.performanceBuffer.length,
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Monitoring configuration updated');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down monitoring...');

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Final flush
    await this.flushAll();
    
    console.log('✅ Monitoring shutdown complete');
  }
}

// React hooks for monitoring
export function useAnalytics() {
  const manager = MonitoringAnalyticsManager.getInstance();

  return {
    trackEvent: (name: string, properties?: Record<string, any>, category?: AnalyticsEvent['category']) => 
      manager.trackEvent(name, properties, category),
    trackUserAction: (action: string, target?: string, value?: number) => 
      manager.trackUserAction(action, target, value),
    trackFeatureUsage: (feature: string, context?: Record<string, any>) => 
      manager.trackFeatureUsage(feature, context),
    trackBusinessMetric: (name: string, value: number, attributes?: Record<string, any>) => 
      manager.trackBusinessMetric(name, value, attributes),
    trackExperiment: (experimentName: string, variant: string, converted?: boolean) => 
      manager.trackExperiment(experimentName, variant, converted),
  };
}

export function usePerformanceMonitoring() {
  const manager = MonitoringAnalyticsManager.getInstance();

  return {
    trackPerformance: (name: string, value: number, unit?: PerformanceMetric['unit'], tags?: Record<string, string>) => 
      manager.trackPerformance(name, value, unit, tags),
    trackWebVital: (name: string, value: number, id: string) => 
      manager.trackWebVital(name, value, id),
    measureFunction: <T>(name: string, fn: () => T | Promise<T>): T | Promise<T> => {
      const start = performance.now();
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          manager.trackPerformance(name, duration, 'ms', { type: 'function' });
        });
      } else {
        const duration = performance.now() - start;
        manager.trackPerformance(name, duration, 'ms', { type: 'function' });
        return result;
      }
    },
  };
}

export function useErrorTracking() {
  const manager = MonitoringAnalyticsManager.getInstance();

  return {
    trackError: (error: Error | string, context?: Record<string, any>, severity?: ErrorEvent['severity']) => 
      manager.trackError(error, context, severity),
    withErrorTracking: <T>(fn: () => T | Promise<T>, context?: Record<string, any>): T | Promise<T> => {
      try {
        const result = fn();
        
        if (result instanceof Promise) {
          return result.catch((error) => {
            manager.trackError(error, context, 'high');
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        manager.trackError(error as Error, context, 'high');
        throw error;
      }
    },
  };
}

// Export singleton instance
export const monitoringAnalytics = MonitoringAnalyticsManager.getInstance();

// Export types and utilities
export {
  MonitoringAnalyticsManager,
  type AnalyticsEvent,
  type PerformanceMetric,
  type ErrorEvent,
  type MonitoringConfig,
};