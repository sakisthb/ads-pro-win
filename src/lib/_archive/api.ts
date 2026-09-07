import { NextRequest, NextResponse } from 'next/server';
import { getCachedAPIResponse, cacheAPIResponse } from './cache';
import { performanceMonitor } from './database';

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 100, // requests per window
  BURST_LIMIT: 10, // burst requests
};

// Rate limiter class
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.WINDOW_MS;
    
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, [now]);
      return true;
    }

    const clientRequests = this.requests.get(clientId)!;
    const recentRequests = clientRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= RATE_LIMIT.MAX_REQUESTS) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    return true;
  }

  getRemainingRequests(clientId: string): number {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.WINDOW_MS;
    
    if (!this.requests.has(clientId)) {
      return RATE_LIMIT.MAX_REQUESTS;
    }

    const clientRequests = this.requests.get(clientId)!;
    const recentRequests = clientRequests.filter(time => time > windowStart);
    
    return Math.max(0, RATE_LIMIT.MAX_REQUESTS - recentRequests.length);
  }

  // Clean up old entries
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.WINDOW_MS;
    
    for (const [clientId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => time > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(clientId);
      } else {
        this.requests.set(clientId, recentRequests);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Clean up rate limiter every minute
setInterval(() => rateLimiter.cleanup(), 60000);

// Get client ID from request
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return ip;
}

// API response wrapper with performance monitoring
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  duration: number;
  cached?: boolean;
}

// API handler with caching and rate limiting
export async function apiHandler<T>(
  request: NextRequest,
  handler: () => Promise<T>,
  options: {
    cacheKey?: string;
    cacheTTL?: number;
    enableRateLimit?: boolean;
    enableCompression?: boolean;
  } = {}
): Promise<NextResponse<APIResponse<T>>> {
  const startTime = Date.now();
  const clientId = getClientId(request);
  
  try {
    // Rate limiting
    if (options.enableRateLimit !== false) {
      if (!rateLimiter.isAllowed(clientId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          },
          { status: 429 }
        );
      }
    }

    // Check cache first
    let cachedResponse: T | null = null;
    if (options.cacheKey) {
      cachedResponse = await getCachedAPIResponse(request.url, {}) as T | null;
      if (cachedResponse) {
        return NextResponse.json(
          {
            success: true,
            data: cachedResponse,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            cached: true,
          },
          { status: 200 }
        );
      }
    }

    // Execute handler
    const result = await handler();

    // Cache response
    if (options.cacheKey && result) {
      await cacheAPIResponse(request.url, {}, result);
    }

    const duration = Date.now() - startTime;
    
    // Add performance metric
    performanceMonitor.addMetric({
      query: 'api_request',
      duration,
      timestamp: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        duration,
        cached: false,
      },
      { 
        status: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimiter.getRemainingRequests(clientId).toString(),
          'X-Response-Time': `${duration}ms`,
          ...(options.enableCompression !== false && {
            'Content-Encoding': 'gzip',
          }),
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        duration,
      },
      { status: 500 }
    );
  }
}

// Optimized API functions
export const apiFunctions = {
  // Get campaigns with caching
  getCampaigns: async (organizationId: string) => {
    return await apiHandler(
      new NextRequest('http://localhost/api/campaigns'),
      async () => {
        // This would be replaced with actual database query
        return { campaigns: [], organizationId };
      },
      {
        cacheKey: `campaigns:${organizationId}`,
        cacheTTL: 300, // 5 minutes
        enableRateLimit: true,
      }
    );
  },

  // Get analytics with caching
  getAnalytics: async (campaignId: string) => {
    return await apiHandler(
      new NextRequest('http://localhost/api/analytics'),
      async () => {
        // This would be replaced with actual analytics query
        return { analytics: [], campaignId };
      },
      {
        cacheKey: `analytics:${campaignId}`,
        cacheTTL: 600, // 10 minutes
        enableRateLimit: true,
      }
    );
  },

  // Update campaign (no caching)
  updateCampaign: async (campaignId: string, data: unknown) => {
    return await apiHandler(
      new NextRequest('http://localhost/api/campaigns'),
      async () => {
        // This would be replaced with actual update logic
        return { success: true, campaignId, data };
      },
      {
        enableRateLimit: true,
        enableCompression: true,
      }
    );
  },
};

// Middleware for API routes
export function withAPIMiddleware() {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const clientId = getClientId(request);

    // Add CORS headers
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Add performance headers
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-RateLimit-Remaining', rateLimiter.getRemainingRequests(clientId).toString());

    return response;
  };
}

// Health check endpoint
export async function healthCheck(): Promise<APIResponse> {
  const startTime = Date.now();
  
  try {
    const [dbHealth, cacheHealth] = await Promise.all([
      import('./database').then(m => m.checkDatabaseHealth()),
      import('./cache').then(m => m.checkCacheHealth()),
    ]);

    const duration = Date.now() - startTime;
    
    return {
      success: dbHealth.status === 'healthy' && cacheHealth.status === 'healthy',
      data: {
        database: dbHealth,
        cache: cacheHealth,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }
}

export default apiHandler; 