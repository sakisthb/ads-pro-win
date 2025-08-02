import Redis from 'ioredis';
import { performanceMonitor } from './database';

// Redis connection with connection pooling
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Cache configuration
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 3600, // 1 hour
  LONG: 86400, // 24 hours
  SESSION: 1800, // 30 minutes
};

// Cache keys
const CACHE_KEYS = {
  CAMPAIGNS: 'campaigns',
  ANALYTICS: 'analytics',
  USER_SESSION: 'user_session',
  API_RESPONSE: 'api_response',
} as const;

// Cache interface (for future use)
// interface CacheOptions {
//   ttl?: number;
//   prefix?: string;
// }

// Cache wrapper class
class CacheManager {
  private prefix: string;

  constructor(prefix = 'ads_pro') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const value = await redis.get(this.getKey(key));
      const duration = Date.now() - startTime;
      
      performanceMonitor.addMetric({
        query: 'cache_get',
        duration,
        timestamp: new Date(),
      });

      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      const startTime = Date.now();
      await redis.setex(this.getKey(key), ttl, JSON.stringify(value));
      const duration = Date.now() - startTime;
      
      performanceMonitor.addMetric({
        query: 'cache_set',
        duration,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(this.getKey(key));
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async increment(key: string, value = 1): Promise<number> {
    try {
      return await redis.incrby(this.getKey(key), value);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await redis.expire(this.getKey(key), ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }
}

// Create cache instance
export const cache = new CacheManager();

// Cache decorator for functions
export function withCache(
  fn: (...args: unknown[]) => Promise<unknown>,
  keyGenerator: (...args: unknown[]) => string,
  ttl: number = CACHE_TTL.MEDIUM
) {
  return async (...args: unknown[]) => {
    const cacheKey = keyGenerator(...args);
    
    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(cacheKey, result, ttl);
    
    return result;
  };
}

// Specific cache functions for common operations
export const cacheCampaigns = withCache(
  async (...args: unknown[]) => {
    const organizationId = args[0] as string;
    // This would be replaced with actual campaign fetching logic
    return { organizationId, campaigns: [] };
  },
  (...args: unknown[]) => `${CACHE_KEYS.CAMPAIGNS}:${args[0] as string}`,
  CACHE_TTL.SHORT
);

export const cacheAnalytics = withCache(
  async (...args: unknown[]) => {
    const campaignId = args[0] as string;
    // This would be replaced with actual analytics fetching logic
    return { campaignId, analytics: [] };
  },
  (...args: unknown[]) => `${CACHE_KEYS.ANALYTICS}:${args[0] as string}`,
  CACHE_TTL.MEDIUM
);

// Session cache functions
export const cacheUserSession = async (userId: string, sessionData: unknown): Promise<void> => {
  await cache.set(`${CACHE_KEYS.USER_SESSION}:${userId}`, sessionData, CACHE_TTL.SESSION);
};

export const getCachedUserSession = async (userId: string): Promise<unknown | null> => {
  return await cache.get(`${CACHE_KEYS.USER_SESSION}:${userId}`);
};

// API response cache
export const cacheAPIResponse = async (endpoint: string, params: unknown, response: unknown): Promise<void> => {
  const key = `${CACHE_KEYS.API_RESPONSE}:${endpoint}:${JSON.stringify(params)}`;
  await cache.set(key, response, CACHE_TTL.SHORT);
};

export const getCachedAPIResponse = async (endpoint: string, params: unknown): Promise<unknown | null> => {
  const key = `${CACHE_KEYS.API_RESPONSE}:${endpoint}:${JSON.stringify(params)}`;
  return await cache.get(key);
};

// Cache invalidation functions
export const invalidateCampaignCache = async (organizationId: string): Promise<void> => {
  await cache.deletePattern(`${CACHE_KEYS.CAMPAIGNS}:${organizationId}`);
};

export const invalidateAnalyticsCache = async (campaignId: string): Promise<void> => {
  await cache.deletePattern(`${CACHE_KEYS.ANALYTICS}:${campaignId}`);
};

export const invalidateUserSession = async (userId: string): Promise<void> => {
  await cache.delete(`${CACHE_KEYS.USER_SESSION}:${userId}`);
};

// Health check
export const checkCacheHealth = async () => {
  try {
    await redis.ping();
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error', 
      timestamp: new Date() 
    };
  }
};

// Cleanup function
export const cleanupCache = async () => {
  await redis.quit();
};

// Export Redis instance for direct access if needed
export { redis };

export default cache; 