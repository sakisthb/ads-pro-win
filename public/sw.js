// Service Worker for Advanced Caching - Phase 3 Week 8
const CACHE_NAME = 'ads-pro-enterprise-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/campaigns',
  '/_next/static/css/',
  '/_next/static/js/',
  '/fonts/',
  '/images/logo.png',
  '/manifest.json',
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
  '/api/campaigns',
  '/api/analytics',
  '/api/dashboard',
  '/api/organizations',
];

// Real-time endpoints that should always be fresh
const NETWORK_FIRST_ENDPOINTS = [
  '/api/real-time',
  '/api/notifications',
  '/api/live-metrics',
];

// Cache-first endpoints (static or rarely changing data)
const CACHE_FIRST_ENDPOINTS = [
  '/api/user/profile',
  '/api/organizations/settings',
  '/api/templates',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/_next/static/')) {
    // Static assets - cache first with long TTL
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - use appropriate strategy based on endpoint
    event.respondWith(handleAPIRequest(request));
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2)$/)) {
    // Other static assets - cache first
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else {
    // HTML pages - network first with fallback
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Return cached version and update in background
      fetchAndCache(request, cacheName);
      return cachedResponse;
    }
    
    // Not in cache, fetch and cache
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Network-first strategy for dynamic content
async function networkFirstStrategy(request, cacheName) {
  try {
    const response = await fetch(request);
    
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page if available
    return caches.match('/offline.html') || 
           new Response('Page not available offline', { status: 503 });
  }
}

// Handle API requests with different strategies
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Network-first for real-time endpoints
  if (NETWORK_FIRST_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint))) {
    return networkFirstStrategy(request, API_CACHE);
  }

  // Cache-first for static API endpoints
  if (CACHE_FIRST_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint))) {
    return cacheFirstWithTTL(request, API_CACHE, 10 * 60 * 1000); // 10 minutes
  }

  // Stale-while-revalidate for other API endpoints
  return staleWhileRevalidateStrategy(request, API_CACHE);
}

// Cache-first with TTL
async function cacheFirstWithTTL(request, cacheName, ttl) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const cachedDate = new Date(cachedResponse.headers.get('sw-cache-date'));
      const now = new Date();
      
      if (now - cachedDate < ttl) {
        return cachedResponse;
      }
    }
    
    // Cache expired or not found, fetch new
    const response = await fetch(request);
    if (response.status === 200) {
      const responseToCache = response.clone();
      responseToCache.headers.set('sw-cache-date', new Date().toISOString());
      cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    // Return cached version even if expired
    const cache = await caches.open(cacheName);
    return cache.match(request) || 
           new Response('API not available offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to fetch in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  });

  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Background fetch and cache
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
  } catch (error) {
    console.log('Background fetch failed:', error);
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Performing background sync...');
  // Handle offline actions like form submissions, data updates
  // This would integrate with your app's offline queue
}

// Push notifications (if needed)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/images/icon-192x192.png',
    badge: '/images/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close notification',
        icon: '/images/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Ads Pro Enterprise', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_INVALIDATE') {
    const { pattern } = event.data;
    invalidateCachePattern(pattern);
  }
});

// Cache invalidation helper
async function invalidateCachePattern(pattern) {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes(pattern)) {
        await cache.delete(request);
        console.log('Invalidated cache for:', request.url);
      }
    }
  }
}

// Periodic cache cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupOldCaches());
  }
});

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const currentTime = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const cacheDate = response?.headers.get('sw-cache-date');
      
      if (cacheDate && currentTime - new Date(cacheDate).getTime() > maxAge) {
        await cache.delete(request);
      }
    }
  }
  
  console.log('Cache cleanup completed');
}