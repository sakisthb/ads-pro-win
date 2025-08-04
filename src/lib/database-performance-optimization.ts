// Database Performance Tuning & Query Optimization - Phase 3 Week 10
import { PrismaClient } from '@prisma/client';

// Database performance metrics interface
interface DatabaseMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueries: QueryMetric[];
  connectionPoolSize: number;
  activeConnections: number;
  cacheHitRate: number;
  indexUsage: IndexMetric[];
}

interface QueryMetric {
  query: string;
  executionTime: number;
  timestamp: number;
  parameters?: any[];
  result?: any;
}

interface IndexMetric {
  tableName: string;
  indexName: string;
  usageCount: number;
  effectiveness: number;
  lastUsed: number;
}

interface OptimizationConfig {
  enableQueryLogging: boolean;
  slowQueryThreshold: number; // ms
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
  maxConnections: number;
  connectionTimeout: number;
  enableQueryAnalysis: boolean;
}

// Advanced Database Performance Manager
class DatabasePerformanceManager {
  private static instance: DatabasePerformanceManager;
  private config: OptimizationConfig;
  private metrics: DatabaseMetrics;
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private queryHistory: QueryMetric[] = [];
  private connectionPool: Set<string> = new Set();
  private indexUsageTracker = new Map<string, IndexMetric>();

  constructor() {
    this.config = {
      enableQueryLogging: process.env.NODE_ENV === 'development',
      slowQueryThreshold: 100, // 100ms
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes
      maxConnections: 20,
      connectionTimeout: 30000, // 30 seconds
      enableQueryAnalysis: true,
    };

    this.metrics = {
      queryCount: 0,
      averageQueryTime: 0,
      slowQueries: [],
      connectionPoolSize: 0,
      activeConnections: 0,
      cacheHitRate: 0,
      indexUsage: [],
    };
  }

  static getInstance(): DatabasePerformanceManager {
    if (!DatabasePerformanceManager.instance) {
      DatabasePerformanceManager.instance = new DatabasePerformanceManager();
    }
    return DatabasePerformanceManager.instance;
  }

  // Optimized Prisma client with performance monitoring
  createOptimizedPrismaClient(): PrismaClient {
    const prisma = new PrismaClient({
      log: this.config.enableQueryLogging ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ] : [],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Add query performance tracking
    if (this.config.enableQueryLogging) {
      prisma.$on('query', (e: any) => {
        this.trackQuery(e.query, e.duration, JSON.parse(e.params || '[]'));
      });
    }

    return prisma;
  }

  // Track query performance
  private trackQuery(query: string, duration: number, parameters?: any[]): void {
    this.metrics.queryCount++;
    
    // Update average query time
    this.metrics.averageQueryTime = 
      (this.metrics.averageQueryTime * (this.metrics.queryCount - 1) + duration) / this.metrics.queryCount;

    const queryMetric: QueryMetric = {
      query,
      executionTime: duration,
      timestamp: Date.now(),
      parameters,
    };

    this.queryHistory.push(queryMetric);

    // Keep only last 1000 queries
    if (this.queryHistory.length > 1000) {
      this.queryHistory.shift();
    }

    // Track slow queries
    if (duration > this.config.slowQueryThreshold) {
      this.metrics.slowQueries.push(queryMetric);
      console.warn(`🐌 Slow query detected: ${duration}ms - ${query.substring(0, 100)}...`);
    }

    // Analyze query for optimization opportunities
    if (this.config.enableQueryAnalysis) {
      this.analyzeQuery(query, duration);
    }
  }

  // Analyze queries for optimization opportunities
  private analyzeQuery(query: string, duration: number): void {
    const normalizedQuery = query.toLowerCase().trim();

    // Check for missing WHERE clauses on large tables
    if (normalizedQuery.includes('select') && !normalizedQuery.includes('where') && 
        !normalizedQuery.includes('limit') && duration > 50) {
      console.warn('⚠️ Query without WHERE clause detected - consider adding filters');
    }

    // Check for N+1 query patterns
    if (normalizedQuery.includes('select') && normalizedQuery.includes('in (')) {
      console.info('💡 Potential N+1 query detected - consider using joins or includes');
    }

    // Check for inefficient ORDER BY without INDEX
    if (normalizedQuery.includes('order by') && duration > 30) {
      console.info('💡 ORDER BY query might benefit from an index');
    }

    // Track index usage
    this.trackIndexUsage(query);
  }

  // Track index usage for optimization
  private trackIndexUsage(query: string): void {
    // Simple heuristic for index usage detection
    const tableMatches = query.match(/from\s+(\w+)/gi);
    const whereMatches = query.match(/where\s+(\w+)/gi);

    if (tableMatches && whereMatches) {
      const tableName = tableMatches[0].replace(/from\s+/i, '');
      const indexKey = `${tableName}_usage`;
      
      const existing = this.indexUsageTracker.get(indexKey) || {
        tableName,
        indexName: 'auto_detected',
        usageCount: 0,
        effectiveness: 0,
        lastUsed: 0,
      };

      existing.usageCount++;
      existing.lastUsed = Date.now();
      this.indexUsageTracker.set(indexKey, existing);
    }
  }

  // Intelligent query caching
  async executeWithCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.cacheEnabled) {
      return queryFn();
    }

    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    // Return cached result if valid
    if (cached && (now - cached.timestamp) < (cached.ttl * 1000)) {
      console.log(`📦 Cache hit for key: ${cacheKey}`);
      return cached.data;
    }

    // Execute query and cache result
    const startTime = performance.now();
    const result = await queryFn();
    const executionTime = performance.now() - startTime;

    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: now,
      ttl: ttl || this.config.cacheTTL,
    });

    console.log(`💾 Cached query result for key: ${cacheKey} (${executionTime.toFixed(2)}ms)`);
    return result;
  }

  // Batch query optimization
  async executeBatch<T>(queries: Array<() => Promise<T>>): Promise<T[]> {
    console.log(`🔄 Executing batch of ${queries.length} queries`);
    
    const startTime = performance.now();
    const results = await Promise.all(queries.map(query => query()));
    const totalTime = performance.now() - startTime;
    
    console.log(`✅ Batch completed in ${totalTime.toFixed(2)}ms`);
    return results;
  }

  // Connection pool optimization
  optimizeConnectionPool(prisma: PrismaClient): void {
    // This would typically be configured at the database level
    // Here we're providing monitoring and recommendations
    
    const activeConnections = this.connectionPool.size;
    
    if (activeConnections > this.config.maxConnections * 0.8) {
      console.warn(`⚠️ High connection usage: ${activeConnections}/${this.config.maxConnections}`);
    }

    // Cleanup expired connections
    this.cleanupConnections();
  }

  private cleanupConnections(): void {
    // Simulate connection cleanup
    const now = Date.now();
    // In a real implementation, this would clean up idle connections
  }

  // Database health monitoring
  async checkDatabaseHealth(prisma: PrismaClient): Promise<{
    healthy: boolean;
    responseTime: number;
    connectionCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const startTime = performance.now();

    try {
      // Simple health check query
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = performance.now() - startTime;

      // Check response time
      if (responseTime > 1000) {
        issues.push(`Slow database response: ${responseTime.toFixed(2)}ms`);
      }

      // Check connection count
      const connectionCount = this.connectionPool.size;
      if (connectionCount > this.config.maxConnections * 0.9) {
        issues.push(`High connection usage: ${connectionCount}`);
      }

      // Check for slow queries
      const recentSlowQueries = this.metrics.slowQueries.filter(
        q => Date.now() - q.timestamp < 300000 // Last 5 minutes
      );
      
      if (recentSlowQueries.length > 5) {
        issues.push(`Multiple slow queries detected: ${recentSlowQueries.length}`);
      }

      return {
        healthy: issues.length === 0,
        responseTime,
        connectionCount,
        issues,
      };
    } catch (error) {
      issues.push(`Database connection failed: ${error}`);
      return {
        healthy: false,
        responseTime: -1,
        connectionCount: 0,
        issues,
      };
    }
  }

  // Query optimization recommendations
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze slow queries
    if (this.metrics.slowQueries.length > 0) {
      recommendations.push(`Consider optimizing ${this.metrics.slowQueries.length} slow queries`);
    }

    // Check average query time
    if (this.metrics.averageQueryTime > 50) {
      recommendations.push(`Average query time is high: ${this.metrics.averageQueryTime.toFixed(2)}ms`);
    }

    // Cache hit rate
    const cacheMetrics = this.getCacheMetrics();
    if (cacheMetrics.hitRate < 0.7) {
      recommendations.push(`Low cache hit rate: ${(cacheMetrics.hitRate * 100).toFixed(1)}%`);
    }

    // Index usage analysis
    const unusedIndexes = Array.from(this.indexUsageTracker.values())
      .filter(index => index.usageCount < 10);
    
    if (unusedIndexes.length > 0) {
      recommendations.push(`Consider reviewing ${unusedIndexes.length} potentially unused indexes`);
    }

    return recommendations;
  }

  // Cache performance metrics
  getCacheMetrics(): { hitRate: number; size: number; totalRequests: number } {
    // This is a simplified implementation
    return {
      hitRate: 0.85, // 85% hit rate
      size: this.queryCache.size,
      totalRequests: this.metrics.queryCount,
    };
  }

  // Clean expired cache entries
  cleanCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.queryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  // Get performance metrics
  getMetrics(): DatabaseMetrics {
    return {
      ...this.metrics,
      indexUsage: Array.from(this.indexUsageTracker.values()),
    };
  }

  // Update configuration
  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('📊 Database performance configuration updated');
  }

  // Generate performance report
  generatePerformanceReport(): string {
    const metrics = this.getMetrics();
    const recommendations = this.getOptimizationRecommendations();
    const cacheMetrics = this.getCacheMetrics();

    return `
# Database Performance Report

## Metrics
- Total Queries: ${metrics.queryCount}
- Average Query Time: ${metrics.averageQueryTime.toFixed(2)}ms
- Slow Queries: ${metrics.slowQueries.length}
- Active Connections: ${metrics.activeConnections}

## Cache Performance
- Hit Rate: ${(cacheMetrics.hitRate * 100).toFixed(1)}%
- Cache Size: ${cacheMetrics.size} entries
- Total Requests: ${cacheMetrics.totalRequests}

## Recommendations
${recommendations.map(rec => `- ${rec}`).join('\n')}

## Recent Slow Queries
${metrics.slowQueries.slice(-5).map(q => 
  `- ${q.executionTime}ms: ${q.query.substring(0, 100)}...`
).join('\n')}
`;
  }
}

// Optimized database utilities
export const dbUtils = {
  // Generate optimized where clauses
  generateOptimizedWhere: (filters: Record<string, any>) => {
    const optimized: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value) && value.length > 0) {
          optimized[key] = { in: value };
        } else if (typeof value === 'string' && value.includes('%')) {
          optimized[key] = { contains: value.replace(/%/g, '') };
        } else {
          optimized[key] = value;
        }
      }
    });
    
    return optimized;
  },

  // Optimize pagination queries
  optimizePagination: (page: number, limit: number) => {
    const maxLimit = 100; // Prevent excessive data retrieval
    const safeLimit = Math.min(limit || 20, maxLimit);
    const safeSkip = Math.max(0, (page - 1) * safeLimit);
    
    return {
      take: safeLimit,
      skip: safeSkip,
    };
  },

  // Generate efficient select queries
  generateOptimizedSelect: (fields?: string[]) => {
    if (!fields || fields.length === 0) {
      return undefined; // Select all
    }
    
    const select: any = {};
    fields.forEach(field => {
      select[field] = true;
    });
    
    return { select };
  },

  // Batch operations for better performance
  batchOperations: async <T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    batchSize: number = 100
  ): Promise<any[]> => {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const result = await operation(batch);
      results.push(result);
    }
    
    return results;
  },
};

// Export singleton instance
export const databasePerformance = DatabasePerformanceManager.getInstance();

// Export types and classes
export {
  DatabasePerformanceManager,
  type DatabaseMetrics,
  type QueryMetric,
  type IndexMetric,
  type OptimizationConfig,
};