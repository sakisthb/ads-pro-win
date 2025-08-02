// Advanced Prisma Query Optimization - Phase 3 Week 8
import { PrismaClient } from '@prisma/client';
import { db } from './database';

interface QueryOptimizationConfig {
  batchSize: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  indexHints: boolean;
  selectOptimization: boolean;
  parallelQueries: boolean;
}

interface OptimizedQuery<T> {
  result: T;
  executionTime: number;
  optimizations: string[];
  cacheHit: boolean;
}

class QueryOptimizer {
  private config: QueryOptimizationConfig;
  private queryCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.config = {
      batchSize: 100,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      indexHints: true,
      selectOptimization: true,
      parallelQueries: true,
      ...config,
    };
  }

  // Optimized campaign queries
  async getCampaignsWithMetrics(organizationId: string): Promise<OptimizedQuery<unknown[]>> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    const cacheKey = `campaigns_metrics_${organizationId}`;

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          result: cached,
          executionTime: Date.now() - startTime,
          optimizations: ['cache_hit'],
          cacheHit: true,
        };
      }
    }

    const result = await db.query(async (client) => {
      // Optimized query with selective fields and proper joins
      const campaigns = await client.campaign.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          platform: true,
          createdAt: true,
          // Only include metrics if needed
          metrics: {
            select: {
              impressions: true,
              clicks: true,
              conversions: true,
              cost: true,
              revenue: true,
            },
          },
          // Include targeting only essential fields
          targeting: {
            select: {
              demographics: true,
              interests: true,
              locations: true,
            },
          },
        },
        // Order by created date for consistency
        orderBy: { createdAt: 'desc' },
      });

      optimizations.push('selective_fields', 'optimized_joins', 'proper_ordering');
      return campaigns;
    });

    // Cache the result
    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, result, this.config.cacheTTL);
      optimizations.push('cached_result');
    }

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Batch operations for bulk updates
  async batchUpdateCampaigns(
    updates: Array<{ id: string; data: unknown }>
  ): Promise<OptimizedQuery<number>> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    // Split into batches to avoid overwhelming the database
    const batches = this.chunkArray(updates, this.config.batchSize);
    let totalUpdated = 0;

    const result = await db.query(async (client) => {
      // Use transaction for consistency
      return client.$transaction(async (tx) => {
        for (const batch of batches) {
          const batchPromises = batch.map(update =>
            tx.campaign.update({
              where: { id: update.id },
              data: update.data,
            })
          );

          await Promise.all(batchPromises);
          totalUpdated += batch.length;
        }

        return totalUpdated;
      });
    });

    optimizations.push('batch_operations', 'transaction_safety', 'parallel_execution');

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Optimized analytics aggregation
  async getAnalyticsAggregation(
    organizationId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<OptimizedQuery<unknown>> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    const cacheKey = `analytics_agg_${organizationId}_${dateRange.start.getTime()}_${dateRange.end.getTime()}`;

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          result: cached,
          executionTime: Date.now() - startTime,
          optimizations: ['cache_hit'],
          cacheHit: true,
        };
      }
    }

    const result = await db.query(async (client) => {
      // Use raw query for complex aggregations
      const aggregation = await client.$queryRaw`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          platform,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(conversions) as total_conversions,
          SUM(cost) as total_cost,
          SUM(revenue) as total_revenue,
          AVG(ctr) as avg_ctr,
          AVG(cpc) as avg_cpc,
          AVG(roas) as avg_roas
        FROM campaign_metrics cm
        JOIN campaigns c ON c.id = cm.campaign_id
        WHERE c.organization_id = ${organizationId}
        AND cm.created_at BETWEEN ${dateRange.start} AND ${dateRange.end}
        GROUP BY DATE_TRUNC('day', created_at), platform
        ORDER BY date DESC, platform
      `;

      optimizations.push('raw_query', 'aggregation_optimization', 'index_usage');
      return aggregation;
    });

    // Cache the result
    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, result, this.config.cacheTTL);
      optimizations.push('cached_result');
    }

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Optimized search with full-text search
  async searchCampaigns(
    organizationId: string,
    searchTerm: string,
    filters: {
      platform?: string;
      status?: string;
      dateRange?: { start: Date; end: Date };
    } = {}
  ): Promise<OptimizedQuery<unknown[]>> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    const result = await db.query(async (client) => {
      // Build dynamic where clause
      const whereClause: unknown = {
        organizationId,
        AND: [
          // Full-text search
          searchTerm
            ? {
                OR: [
                  { name: { contains: searchTerm, mode: 'insensitive' } },
                  { description: { contains: searchTerm, mode: 'insensitive' } },
                ],
              }
            : {},
          // Platform filter
          filters.platform ? { platform: filters.platform } : {},
          // Status filter
          filters.status ? { status: filters.status } : {},
          // Date range filter
          filters.dateRange
            ? {
                createdAt: {
                  gte: filters.dateRange.start,
                  lte: filters.dateRange.end,
                },
              }
            : {},
        ],
      };

      const campaigns = await client.campaign.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          platform: true,
          status: true,
          createdAt: true,
          metrics: {
            select: {
              impressions: true,
              clicks: true,
              conversions: true,
              cost: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // Active campaigns first
          { createdAt: 'desc' },
        ],
        take: 50, // Limit results for performance
      });

      optimizations.push('dynamic_filtering', 'full_text_search', 'result_limiting');
      return campaigns;
    });

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Parallel query execution for dashboard data
  async getDashboardData(organizationId: string): Promise<OptimizedQuery<{
    campaigns: unknown[];
    metrics: unknown;
    alerts: unknown[];
    recentActivity: unknown[];
  }>> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    const result = await db.query(async (client) => {
      // Execute multiple queries in parallel
      const [campaigns, metrics, alerts, recentActivity] = await Promise.all([
        // Active campaigns
        client.campaign.findMany({
          where: { organizationId, status: 'active' },
          select: { id: true, name: true, platform: true, status: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),

        // Aggregated metrics
        client.campaignMetrics.aggregate({
          where: {
            campaign: { organizationId },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
          },
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            cost: true,
            revenue: true,
          },
          _avg: {
            ctr: true,
            cpc: true,
            roas: true,
          },
        }),

        // Recent alerts
        client.alert.findMany({
          where: { organizationId, resolved: false },
          select: { id: true, type: true, message: true, severity: true, createdAt: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),

        // Recent activity
        client.activityLog.findMany({
          where: { organizationId },
          select: { id: true, action: true, details: true, createdAt: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      optimizations.push('parallel_execution', 'selective_fields', 'limited_results');
      
      return {
        campaigns,
        metrics,
        alerts,
        recentActivity,
      };
    });

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Optimized upsert operations
  async upsertCampaignMetrics(
    campaignId: string,
    metricsData: unknown[]
  ): Promise<OptimizedQuery<number>> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    const result = await db.query(async (client) => {
      // Use upsert for better performance than insert/update logic
      const upsertPromises = metricsData.map((metrics: unknown) =>
        client.campaignMetrics.upsert({
          where: {
            campaignId_date: {
              campaignId,
              date: (metrics as { date: Date }).date,
            },
          },
          update: metrics,
          create: {
            campaignId,
            ...metrics,
          },
        })
      );

      const results = await Promise.all(upsertPromises);
      optimizations.push('upsert_optimization', 'parallel_operations');
      
      return results.length;
    });

    return {
      result,
      executionTime: Date.now() - startTime,
      optimizations,
      cacheHit: false,
    };
  }

  // Cache management
  private getFromCache(key: string): unknown | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup old cache entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  // Utility function to chunk arrays
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.queryCache.size,
      config: this.config,
    };
  }

  // Clear cache
  clearCache(): void {
    this.queryCache.clear();
  }
}

// Singleton instance
let queryOptimizer: QueryOptimizer | null = null;

export function getQueryOptimizer(): QueryOptimizer {
  if (!queryOptimizer) {
    queryOptimizer = new QueryOptimizer({
      batchSize: parseInt(process.env.QUERY_BATCH_SIZE || '100'),
      cacheEnabled: process.env.QUERY_CACHE_ENABLED !== 'false',
      cacheTTL: parseInt(process.env.QUERY_CACHE_TTL || '300000'),
    });
  }
  return queryOptimizer;
}

// Export optimized query functions
export const optimizedQueries = {
  getCampaignsWithMetrics: (organizationId: string) =>
    getQueryOptimizer().getCampaignsWithMetrics(organizationId),
  
  batchUpdateCampaigns: (updates: Array<{ id: string; data: unknown }>) =>
    getQueryOptimizer().batchUpdateCampaigns(updates),
  
  getAnalyticsAggregation: (organizationId: string, dateRange: { start: Date; end: Date }) =>
    getQueryOptimizer().getAnalyticsAggregation(organizationId, dateRange),
  
  searchCampaigns: (organizationId: string, searchTerm: string, filters?: unknown) =>
    getQueryOptimizer().searchCampaigns(organizationId, searchTerm, filters as Parameters<QueryOptimizer['searchCampaigns']>[2]),
  
  getDashboardData: (organizationId: string) =>
    getQueryOptimizer().getDashboardData(organizationId),
  
  upsertCampaignMetrics: (campaignId: string, metricsData: unknown[]) =>
    getQueryOptimizer().upsertCampaignMetrics(campaignId, metricsData),
};

export { QueryOptimizer };
export default getQueryOptimizer;