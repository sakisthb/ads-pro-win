import { PrismaClient } from '@prisma/client';
import { memoize } from './utils';
import { getConnectionPool, withPooledConnection } from './database-pool';

// Legacy Prisma client for backward compatibility
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Enhanced database client with connection pooling
export const db = {
  // Execute query with pooled connection
  async query<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    return withPooledConnection(operation);
  },
  
  // Get pool statistics
  getPoolStats() {
    return getConnectionPool().getStats();
  },
  
  // Legacy prisma access
  get client() {
    return prisma;
  },
};

// Performance monitoring
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  table?: string;
}

class DatabasePerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private maxMetrics = 1000;

  addMetric(metric: QueryMetrics) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getAverageQueryTime(): number {
    if (this.metrics.length === 0) return 0;
    const totalDuration = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalDuration / this.metrics.length;
  }

  getSlowQueries(threshold: number = 100): QueryMetrics[] {
    return this.metrics.filter(metric => metric.duration > threshold);
  }

  getMetrics() {
    return this.metrics;
  }
}

export const performanceMonitor = new DatabasePerformanceMonitor();

// Optimized query functions with caching
export const getCampaigns = memoize(async (...args: unknown[]) => {
  const organizationId = args[0] as string;
  const startTime = Date.now();
  
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        budget: true,
        budgetSpent: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const duration = Date.now() - startTime;
    performanceMonitor.addMetric({
      query: 'getCampaigns',
      duration,
      timestamp: new Date(),
      table: 'campaigns',
    });

    return campaigns;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
});

export const getCampaignAnalytics = memoize(async (...args: unknown[]) => {
  const campaignId = args[0] as string;
  const startTime = Date.now();
  
  try {
    const analytics = await prisma.analysis.findMany({
      where: { campaignId },
      select: {
        id: true,
        type: true,
        title: true,
        data: true,
        insights: true,
        recommendations: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const duration = Date.now() - startTime;
    performanceMonitor.addMetric({
      query: 'getCampaignAnalytics',
      duration,
      timestamp: new Date(),
      table: 'analyses',
    });

    return analytics;
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    throw error;
  }
});

export const getOrganizationStats = memoize(async (...args: unknown[]) => {
  const organizationId = args[0] as string;
  const startTime = Date.now();
  
  try {
    const [campaigns, users, aiAgents] = await Promise.all([
      prisma.campaign.count({ where: { organizationId } }),
      prisma.user.count({ where: { organizationId } }),
      prisma.aIAgent.count({ where: { organizationId } }),
    ]);

    const activeCampaigns = await prisma.campaign.count({
      where: { 
        organizationId,
        status: 'active',
      },
    });

    const totalBudget = await prisma.campaign.aggregate({
      where: { organizationId },
      _sum: { budget: true },
    });

    const duration = Date.now() - startTime;
    performanceMonitor.addMetric({
      query: 'getOrganizationStats',
      duration,
      timestamp: new Date(),
    });

    return {
      totalCampaigns: campaigns,
      activeCampaigns,
      totalUsers: users,
      totalAIAgents: aiAgents,
      totalBudget: totalBudget._sum.budget || 0,
    };
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    throw error;
  }
});

// Batch operations for better performance
export const batchGetCampaigns = async (organizationIds: string[]) => {
  const startTime = Date.now();
  
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        organizationId: { in: organizationIds },
      },
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        budget: true,
        budgetSpent: true,
        organizationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const duration = Date.now() - startTime;
    performanceMonitor.addMetric({
      query: 'batchGetCampaigns',
      duration,
      timestamp: new Date(),
      table: 'campaigns',
    });

    return campaigns;
  } catch (error) {
    console.error('Error in batch get campaigns:', error);
    throw error;
  }
};

// Connection health check
export const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date() };
  }
};

// Cleanup function for graceful shutdown
export const cleanupDatabase = async () => {
  await prisma.$disconnect();
};

// Export performance monitoring utilities
export const getPerformanceMetrics = () => ({
  averageQueryTime: performanceMonitor.getAverageQueryTime(),
  slowQueries: performanceMonitor.getSlowQueries(),
  totalQueries: performanceMonitor.getMetrics().length,
});

export default prisma; 