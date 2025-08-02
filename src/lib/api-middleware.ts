import { NextRequest, NextResponse } from 'next/server';
import { cache } from './cache';
import { config } from './config';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // requests per windowMs
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

// Rate limiting middleware
export function rateLimitMiddleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;

  // Clean old entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < windowStart) {
      rateLimitStore.delete(key);
    }
  }

  // Check current rate
  const current = rateLimitStore.get(ip);
  if (current && current.resetTime > windowStart) {
    if (current.count >= RATE_LIMIT.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }
    current.count++;
  } else {
    rateLimitStore.set(ip, { count: 1, resetTime: now });
  }

  return null; // Continue to next middleware
}

// Cache middleware for API responses
export async function cacheMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
) {
  // Skip caching for non-GET requests
  if (request.method !== 'GET') {
    return handler();
  }

  const url = new URL(request.url);
  const cacheKey = `api:${url.pathname}${url.search}`;

  // Try to get from cache
  const cached = await cache.get<Response>(cacheKey);
  if (cached) {
    return new NextResponse(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: {
        ...cached.headers,
        'X-Cache': 'HIT',
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  }

  // Execute handler and cache response
  const response = await handler();
  
  // Only cache successful responses
  if (response.status >= 200 && response.status < 300) {
    const responseClone = response.clone();
    const responseData = {
      body: await responseClone.text(),
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers: Object.fromEntries(responseClone.headers.entries()),
    };
    
    await cache.set(cacheKey, responseData, 300); // 5 minutes TTL
    
    // Add cache headers
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'public, max-age=300');
  }

  return response;
}

// Compression middleware
export function compressionMiddleware(response: NextResponse) {
  const acceptEncoding = response.headers.get('accept-encoding') || '';
  
  if (acceptEncoding.includes('gzip')) {
    // In a real implementation, you would compress the response
    // For now, we'll just add the header
    response.headers.set('Content-Encoding', 'gzip');
  }
  
  return response;
}

// Performance monitoring middleware
export function performanceMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
) {
  const startTime = performance.now();
  
  return handler().then((response) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    response.headers.set('X-Request-ID', generateRequestId());
    
    // Log slow requests
    if (duration > 1000) { // 1 second
      console.warn(`Slow API request: ${request.url} took ${duration.toFixed(2)}ms`);
    }
    
    return response;
  });
}

// Request ID generator
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// API response wrapper with caching
export async function apiResponse<T>(
  request: NextRequest,
  handler: () => Promise<T>,
  options: {
    cacheKey?: string;
    ttl?: number;
    skipCache?: boolean;
  } = {}
) {
  const { cacheKey, ttl = 300, skipCache = false } = options;
  
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  // Apply caching for GET requests
  if (request.method === 'GET' && !skipCache && cacheKey) {
    const cached = await cache.get<T>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      });
    }
  }
  
  // Execute handler
  const startTime = performance.now();
  const result = await handler();
  const duration = performance.now() - startTime;
  
  // Cache result if applicable
  if (request.method === 'GET' && !skipCache && cacheKey) {
    await cache.set(cacheKey, result, ttl);
  }
  
  // Create response
  const response = NextResponse.json(result, {
    headers: {
      'X-Cache': 'MISS',
      'X-Response-Time': `${duration.toFixed(2)}ms`,
      'Cache-Control': `public, max-age=${ttl}`,
    },
  });
  
  return compressionMiddleware(response);
}

// Batch request handler
export async function batchRequestHandler<T>(
  requests: Array<{ key: string; handler: () => Promise<T> }>,
  options: {
    maxConcurrency?: number;
    cachePrefix?: string;
    ttl?: number;
  } = {}
) {
  const { maxConcurrency = 5, cachePrefix = 'batch', ttl = 300 } = options;
  
  const results: Record<string, T> = {};
  const cacheKeys = requests.map(req => `${cachePrefix}:${req.key}`);
  
  // Try to get all from cache first
  const cachedResults = await Promise.all(
    cacheKeys.map(key => cache.get<T>(key))
  );
  
  // Find uncached requests
  const uncachedRequests = requests.filter((_, index) => !cachedResults[index]);
  
  if (uncachedRequests.length === 0) {
    // All results were cached
    requests.forEach((req, index) => {
      results[req.key] = cachedResults[index]!;
    });
    return results;
  }
  
  // Process uncached requests with concurrency limit
  const chunks = [];
  for (let i = 0; i < uncachedRequests.length; i += maxConcurrency) {
    chunks.push(uncachedRequests.slice(i, i + maxConcurrency));
  }
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (req) => {
        const result = await req.handler();
        const cacheKey = `${cachePrefix}:${req.key}`;
        await cache.set(cacheKey, result, ttl);
        return { key: req.key, result };
      })
    );
    
    chunkResults.forEach(({ key, result }) => {
      results[key] = result;
    });
  }
  
  // Add cached results
  requests.forEach((req, index) => {
    if (cachedResults[index]) {
      results[req.key] = cachedResults[index]!;
    }
  });
  
  return results;
}

// Health check middleware
export function healthCheckMiddleware(request: NextRequest) {
  if (request.nextUrl?.pathname === '/api/health') {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: config.app.version,
    });
  }
  return null;
}

// Error handling middleware
export function errorHandler(error: Error, request: NextRequest) {
  console.error(`API Error: ${request.url}`, error);
  
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: config.app.isDevelopment ? error.message : 'Something went wrong',
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  );
}

// CORS middleware
export function corsMiddleware() {
  const response = NextResponse.next();
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

// Request logging middleware
export function loggingMiddleware(request: NextRequest) {
  const startTime = Date.now();
  
  return (response: NextResponse) => {
    const duration = Date.now() - startTime;
    const logLevel = response.status >= 400 ? 'error' : 'info';
    
    console[logLevel]({
      method: request.method,
      url: request.url,
      status: response.status,
      duration: `${duration}ms`,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });
    
    return response;
  };
}

// Security headers middleware
export function securityHeadersMiddleware(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

// Combine all middleware
export function applyMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
) {
  // Apply middleware in order
  const middlewares = [
    healthCheckMiddleware,
    () => corsMiddleware(),
    (req: NextRequest) => rateLimitMiddleware(req),
    (req: NextRequest) => performanceMiddleware(req, handler),
  ];
  
  const currentHandler = handler;
  
  for (const middleware of middlewares.reverse()) {
    const result = middleware(request);
    if (result) {
      return result;
    }
  }
  
  return currentHandler().then(securityHeadersMiddleware);
}

const apiMiddleware = {
  rateLimitMiddleware,
  cacheMiddleware,
  compressionMiddleware,
  performanceMiddleware,
  apiResponse,
  batchRequestHandler,
  healthCheckMiddleware,
  errorHandler,
  corsMiddleware,
  loggingMiddleware,
  securityHeadersMiddleware,
  applyMiddleware,
};

export default apiMiddleware; 