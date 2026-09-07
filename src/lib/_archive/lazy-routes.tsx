// Route-based Code Splitting Configuration - Phase 3 Week 9
import { ComponentType } from 'react';
import { createLazyComponent, LoadingFallback } from './code-splitting';

// Route definitions with lazy loading
export interface LazyRoute {
  path: string;
  component: ReturnType<typeof createLazyComponent>;
  preload?: boolean;
  title: string;
  description?: string;
}

// Create lazy route components
const routes = {
  // Dashboard routes
  dashboard: createLazyComponent(
    () => import('../components/optimized/OptimizedDashboard') as any,
    {
      fallback: <LoadingFallback skeleton="dashboard" message="Loading Dashboard..." />,
      preload: true, // Preload critical route
    }
  ),

  // Campaign management
  campaigns: createLazyComponent(
    () => import('../components/CampaignManager'),
    {
      fallback: <LoadingFallback skeleton="table" message="Loading Campaigns..." />,
      preload: false,
    }
  ),

  // Analytics
  analytics: createLazyComponent(
    () => import('../components/analytics/AdvancedAnalyticsDashboard'),
    {
      fallback: <LoadingFallback skeleton="dashboard" message="Loading Analytics..." />,
      preload: false,
    }
  ),

  // AI Agents - TEMPORARILY DISABLED FOR BUILD FIX
  // aiAgents: createLazyComponent(
  //   () => import('../components/ai-agents/AIAgentList') as any,
  //   {
  //     fallback: <LoadingFallback skeleton="list" message="Loading AI Agents..." />,
  //     preload: false,
  //   }
  // ),

  // Virtual Scrolling Demo
  virtualScroll: createLazyComponent(
    () => import('../components/virtualization/VirtualScrollDemo'),
    {
      fallback: <LoadingFallback skeleton="list" message="Loading Virtual Scroll Demo..." />,
      preload: false,
    }
  ),

  // Performance Monitor
  performance: createLazyComponent(
    () => import('../components/PerformanceMonitor'),
    {
      fallback: <LoadingFallback message="Loading Performance Monitor..." />,
      preload: false,
    }
  ),

  // Code Splitting Demo
  codeSplittingDemo: createLazyComponent(
    () => import('../components/lazy/LazyComponents'),
    {
      fallback: <LoadingFallback message="Loading Code Splitting Demo..." />,
      preload: false,
    }
  ),

  // Settings (rarely accessed) - TEMPORARILY DISABLED FOR BUILD FIX
  // settings: createLazyComponent(
  //   () => import('../components/Settings'),
  //   {
  //     fallback: <LoadingFallback message="Loading Settings..." />,
  //     preload: false,
  //     delay: 200, // Small delay for settings
  //   }
  // ),

  // Reports (heavy component) - TEMPORARILY DISABLED FOR BUILD FIX
  // reports: createLazyComponent(
  //   () => import('../components/Reports'),
  //   {
  //     fallback: <LoadingFallback skeleton="dashboard" message="Loading Reports..." showProgress />,
  //     preload: false,
  //     retryCount: 3,
  //   }
  // ),

  // User Profile - TEMPORARILY DISABLED FOR BUILD FIX
  // profile: createLazyComponent(
  //   () => import('../components/UserProfile'),
  //   {
  //     fallback: <LoadingFallback message="Loading Profile..." />,
  //     preload: false,
  //   }
  // ),
};

// Route configuration with metadata
export const lazyRoutes: LazyRoute[] = [
  {
    path: '/',
    component: routes.dashboard,
    preload: true,
    title: 'Dashboard',
    description: 'Main dashboard with campaign overview and key metrics',
  },
  {
    path: '/dashboard',
    component: routes.dashboard,
    preload: true,
    title: 'Dashboard',
    description: 'Main dashboard with campaign overview and key metrics',
  },
  {
    path: '/campaigns',
    component: routes.campaigns,
    preload: false,
    title: 'Campaigns',
    description: 'Manage and monitor your advertising campaigns',
  },
  {
    path: '/analytics',
    component: routes.analytics,
    preload: false,
    title: 'Analytics',
    description: 'Advanced analytics and reporting dashboard',
  },
  // TEMPORARILY DISABLED ROUTES FOR BUILD FIX
  // {
  //   path: '/ai-agents',
  //   component: routes.aiAgents,
  //   preload: false,
  //   title: 'AI Agents',
  //   description: 'Manage your AI marketing agents',
  // },
  // {
  //   path: '/virtual-scroll',
  //   component: routes.virtualScroll,
  //   preload: false,
  //   title: 'Virtual Scrolling',
  //   description: 'Virtual scrolling demonstration with large datasets',
  // },
  // {
  //   path: '/performance',
  //   component: routes.performance,
  //   preload: false,
  //   title: 'Performance Monitor',
  //   description: 'Application performance monitoring and metrics',
  // },
  // {
  //   path: '/code-splitting',
  //   component: routes.codeSplittingDemo,
  //   preload: false,
  //   title: 'Code Splitting Demo',
  //   description: 'Demonstration of lazy loading and code splitting techniques',
  // },
  // {
  //   path: '/settings',
  //   component: routes.settings,
  //   preload: false,
  //   title: 'Settings',
  //   description: 'Application settings and configuration',
  // },
  // {
  //   path: '/reports',
  //   component: routes.reports,
  //   preload: false,
  //   title: 'Reports',
  //   description: 'Comprehensive reporting and data export',
  // },
  // {
  //   path: '/profile',
  //   component: routes.profile,
  //   preload: false,
  //   title: 'Profile',
  //   description: 'User profile and account settings',
  // },
];

// Route preloading utilities
export const routePreloader = {
  // Preload critical routes
  preloadCriticalRoutes: async () => {
    const criticalRoutes = lazyRoutes.filter(route => route.preload);
    const preloadPromises = criticalRoutes.map(route => 
      route.component.preload().catch(error => 
        console.warn(`Failed to preload route ${route.path}:`, error)
      )
    );
    
    await Promise.allSettled(preloadPromises);
    console.log(`Preloaded ${criticalRoutes.length} critical routes`);
  },

  // Preload route by path
  preloadRoute: async (path: string) => {
    const route = lazyRoutes.find(r => r.path === path);
    if (route) {
      try {
        await route.component.preload();
        console.log(`Preloaded route: ${path}`);
      } catch (error) {
        console.warn(`Failed to preload route ${path}:`, error);
      }
    }
  },

  // Preload multiple routes
  preloadRoutes: async (paths: string[]) => {
    const preloadPromises = paths.map(path => routePreloader.preloadRoute(path));
    await Promise.allSettled(preloadPromises);
  },

  // Preload based on user behavior patterns
  preloadBasedOnUsage: async (userRoutes: string[]) => {
    // Sort by frequency and preload most used routes
    const sortedRoutes = userRoutes
      .reduce((acc, route) => {
        acc[route] = (acc[route] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
      
    const topRoutes = Object.entries(sortedRoutes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([route]) => route);

    await routePreloader.preloadRoutes(topRoutes);
    console.log('Preloaded routes based on usage:', topRoutes);
  },
};

// Route-based component resolver
export function getRouteComponent(path: string): LazyRoute | null {
  return lazyRoutes.find(route => route.path === path) || null;
}

// Get all available routes
export function getAllRoutes(): LazyRoute[] {
  return lazyRoutes;
}

// Route navigation utilities
export const routeUtils = {
  // Get route title
  getRouteTitle: (path: string): string => {
    const route = getRouteComponent(path);
    return route?.title || 'Ads Pro Enterprise';
  },

  // Get route description
  getRouteDescription: (path: string): string => {
    const route = getRouteComponent(path);
    return route?.description || '';
  },

  // Check if route should be preloaded
  shouldPreloadRoute: (path: string): boolean => {
    const route = getRouteComponent(path);
    return route?.preload || false;
  },

  // Get routes for sitemap/navigation
  getNavigationRoutes: () => {
    return lazyRoutes
      .filter(route => !route.path.includes(':')) // Exclude dynamic routes
      .map(route => ({
        path: route.path,
        title: route.title,
        description: route.description,
      }));
  },
};

// Bundle splitting recommendations
export const bundleOptimization = {
  // Vendor chunk configuration
  vendorChunks: {
    react: ['react', 'react-dom'],
    ui: ['@headlessui/react', '@heroicons/react'],
    charts: ['recharts', 'd3'],
    utils: ['lodash', 'date-fns', 'clsx'],
  },

  // Chunk size recommendations
  chunkSizeTargets: {
    initial: 200, // KB
    async: 100,   // KB
    vendor: 300,  // KB
  },

  // Critical resources
  criticalChunks: [
    'dashboard',
    'campaigns', // Most used features
  ],

  // Defer loading for these features
  deferredChunks: [
    'settings',
    'reports',
    'profile', // Less frequently accessed
  ],
};

export default {
  lazyRoutes,
  routePreloader,
  getRouteComponent,
  getAllRoutes,
  routeUtils,
  bundleOptimization,
};