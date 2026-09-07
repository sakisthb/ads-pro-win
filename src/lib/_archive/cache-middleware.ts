// API Caching Middleware - Phase 3 Week 7 Performance Optimization
import { NextRequest, NextResponse } from 'next/server';
import { cache, getCachedAPIResponse, cacheAPIResponse } from './cache';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: NextRequest) => string;
  shouldCache?: (req: NextRequest, res: NextResponse) => boolean;
}

// Default cache key generator
const defaultKeyGenerator = (req: NextRequest): string => {
  const url = new URL(req.url);
  const params = url.searchParams.toString();
  return `${url.pathname}${params ? `?${params}` : ''}`;
};

// Default cache condition checker
const defaultShouldCache = (req: NextRequest, res: NextResponse): boolean => {
  return req.method === 'GET' && res.status === 200;
};

// Cache middleware wrapper
export function withCache(options: CacheOptions = {}) {
  return function cacheMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      const {
        ttl = 300, // 5 minutes default
        keyGenerator = defaultKeyGenerator,
        shouldCache = defaultShouldCache,
      } = options;

      // Generate cache key
      const cacheKey = keyGenerator(req);

      // Try to get cached response for GET requests
      if (req.method === 'GET') {
        const cachedResponse = await getCachedAPIResponse('api', cacheKey);
        if (cachedResponse) {
          return NextResponse.json(cachedResponse, {
            headers: {
              'X-Cache': 'HIT',
              'Cache-Control': `public, max-age=${ttl}`,
            },
          });
        }
      }

      // Execute the handler
      const response = await handler(req);

      // Cache the response if conditions are met
      if (shouldCache(req, response)) {
        try {
          const responseData = await response.clone().json();
          await cacheAPIResponse('api', cacheKey, responseData);
          
          // Add cache headers
          response.headers.set('X-Cache', 'MISS');
          response.headers.set('Cache-Control', `public, max-age=${ttl}`);
        } catch (error) {
          console.error('Failed to cache API response:', error);
        }
      }

      return response;
    };
  };
}

// Campaign-specific caching middleware
export const withCampaignCache = withCache({
  ttl: 300, // 5 minutes for campaign data
  keyGenerator: (req: NextRequest) => {
    const url = new URL(req.url);
    const organizationId = req.headers.get('x-organization-id') || 'default';
    return `campaigns:${organizationId}:${url.pathname}:${url.searchParams.toString()}`;
  },
});

// Analytics caching middleware
export const withAnalyticsCache = withCache({
  ttl: 600, // 10 minutes for analytics data
  keyGenerator: (req: NextRequest) => {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId') || 'all';
    return `analytics:${campaignId}:${url.pathname}:${url.searchParams.toString()}`;
  },
});

// User session caching middleware
export const withSessionCache = withCache({
  ttl: 1800, // 30 minutes for session data
  keyGenerator: (req: NextRequest) => {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    return `session:${userId}:${req.url}`;
  },
});

// AI response caching (longer TTL for expensive AI operations)
export const withAICache = withCache({
  ttl: 3600, // 1 hour for AI responses
  keyGenerator: (req: NextRequest) => {
    const url = new URL(req.url);
    // Include request body hash for POST requests
    return `ai:${url.pathname}:${url.searchParams.toString()}`;
  },
  shouldCache: (req: NextRequest, res: NextResponse) => {
    // Cache both GET and POST for AI endpoints
    return ['GET', 'POST'].includes(req.method) && res.status === 200;
  },
});

// Cache invalidation helpers
export const invalidateAPICache = async (pattern: string): Promise<void> => {
  await cache.deletePattern(`api:*${pattern}*`);
};

export const invalidateCampaignAPICache = async (organizationId: string): Promise<void> => {
  await cache.deletePattern(`campaigns:${organizationId}:*`);
};

export const invalidateAnalyticsAPICache = async (campaignId: string): Promise<void> => {
  await cache.deletePattern(`analytics:${campaignId}:*`);
};

export const invalidateUserAPICache = async (userId: string): Promise<void> => {
  await cache.deletePattern(`session:${userId}:*`);
};

// Response compression for large payloads
export const withCompression = (
  handler: (req: NextRequest) => Promise<NextResponse>
) => {
  return async (req: NextRequest): Promise<NextResponse> => {
    const response = await handler(req);
    
    // Add compression headers for large responses
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024) {
      response.headers.set('Content-Encoding', 'gzip');
      response.headers.set('Vary', 'Accept-Encoding');
    }
    
    return response;
  };
};

// Rate limiting with cache
export const withRateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return async (req: NextRequest): Promise<NextResponse> => {
      const clientId = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const rateLimitKey = `rate_limit:${clientId}`;
      
      const currentCount = await cache.increment(rateLimitKey);
      
      if (currentCount === 1) {
        // Set expiration for new key
        await cache.expire(rateLimitKey, Math.floor(windowMs / 1000));
      }
      
      if (currentCount > maxRequests) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString(),
            },
          }
        );
      }
      
      const response = await handler(req);
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', (maxRequests - currentCount).toString());
      
      return response;
    };
  };
};

// Import compression middleware (withCompression is defined locally above)
import { withSmartCompression } from './compression-middleware';

// Combined performance middleware
export const withPerformanceOptimizations = (
  handler: (req: NextRequest) => Promise<NextResponse>
) => {
  return withCache()(
    withCompression(
      withRateLimit()(handler)
    )
  );
};

// Advanced performance middleware with smart compression
export const withAdvancedPerformance = (
  handler: (req: NextRequest) => Promise<NextResponse>
) => {
  return async (req: NextRequest) => {
    // First apply caching
    const cachedHandler = withCache()(handler);
    
    // Then apply smart compression based on content type
    const response = await cachedHandler(req);
    const contentType = response.headers.get('content-type') || '';
    
    // Apply appropriate compression
    const compressionMiddleware = withSmartCompression(contentType);
    return compressionMiddleware(() => Promise.resolve(response))(req);
  };
};

export default withCache;