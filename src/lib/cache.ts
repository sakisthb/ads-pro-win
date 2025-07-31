import Redis from 'ioredis';
import { config } from './config';

// Redis client instance
let redis: Redis | null = null;

// Initialize Redis connection
export function initializeRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }
  return redis;
}

// Get Redis client
export function getRedisClient(): Redis {
  if (!redis) {
    return initializeRedis();
  }
  return redis;
}

// Cache operations
export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour

  constructor() {
    this.redis = getRedisClient();
  }

  // Set cache with TTL
  async set(key: string, value: unknown, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Get cache value
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Delete cache key
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Delete multiple cache keys
  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete multiple error:', error);
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<{ keys: number; memory: string }> {
    try {
      const info = await this.redis.info('memory');
      const keys = await this.redis.dbsize();
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : '0B';
      
      return { keys, memory };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { keys: 0, memory: '0B' };
    }
  }

  // Set cache with pattern-based invalidation
  async setWithPattern(key: string, value: unknown, pattern: string, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
      
      // Store pattern for invalidation
      const patternKey = `pattern:${pattern}`;
      await this.redis.sadd(patternKey, key);
      await this.redis.expire(patternKey, ttl);
    } catch (error) {
      console.error('Cache set with pattern error:', error);
    }
  }

  // Invalidate cache by pattern
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const patternKey = `pattern:${pattern}`;
      const keys = await this.redis.smembers(patternKey);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(patternKey);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  // Cache middleware for API routes
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }
}

// Cache key generators
export const cacheKeys = {
  // Organization cache keys
  organization: (id: string) => `org:${id}`,
  organizationBySlug: (slug: string) => `org:slug:${slug}`,
  
  // Campaign cache keys
  campaign: (id: string) => `campaign:${id}`,
  campaignsByOrg: (orgId: string) => `campaigns:org:${orgId}`,
  campaignsByStatus: (orgId: string, status: string) => `campaigns:org:${orgId}:status:${status}`,
  campaignsByPlatform: (orgId: string, platform: string) => `campaigns:org:${orgId}:platform:${platform}`,
  
  // AI Agent cache keys
  aiAgent: (id: string) => `aiagent:${id}`,
  aiAgentsByOrg: (orgId: string) => `aiagents:org:${orgId}`,
  aiAgentsByType: (orgId: string, type: string) => `aiagents:org:${orgId}:type:${type}`,
  
  // Analytics cache keys
  analytics: (orgId: string, type: string, params: string) => `analytics:${orgId}:${type}:${params}`,
  performanceMetrics: (orgId: string, dateRange: string) => `metrics:${orgId}:performance:${dateRange}`,
  platformAnalytics: (orgId: string, platform: string, dateRange: string) => `analytics:${orgId}:platform:${platform}:${dateRange}`,
  
  // Workflow cache keys
  workflow: (id: string) => `workflow:${id}`,
  workflowsByOrg: (orgId: string) => `workflows:org:${orgId}`,
  scheduledWorkflows: (orgId: string) => `workflows:org:${orgId}:scheduled`,
  
  // Predictions cache keys
  prediction: (id: string) => `prediction:${id}`,
  predictionsByOrg: (orgId: string) => `predictions:org:${orgId}`,
  performanceForecast: (orgId: string, campaignId: string, timeframe: string) => `forecast:${orgId}:${campaignId}:${timeframe}`,
  
  // User cache keys
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
};

// Cache invalidation patterns
export const cachePatterns = {
  organization: (orgId: string) => `org:${orgId}:*`,
  campaigns: (orgId: string) => `campaigns:org:${orgId}:*`,
  aiAgents: (orgId: string) => `aiagents:org:${orgId}:*`,
  analytics: (orgId: string) => `analytics:${orgId}:*`,
  workflows: (orgId: string) => `workflows:org:${orgId}:*`,
  predictions: (orgId: string) => `predictions:org:${orgId}:*`,
  users: (orgId: string) => `user:org:${orgId}:*`,
};

// Initialize cache service
export const cacheService = new CacheService();

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
}

export default cacheService; 