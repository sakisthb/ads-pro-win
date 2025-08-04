/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages that should not be bundled (moved from experimental)
  serverExternalPackages: ['@prisma/client'],
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: [
      'localhost',
      'vercel.app',
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
  },

  // Enhanced Compression - Phase 3 Week 8
  compress: true,
  
  // Experimental features for performance - Phase 3 Week 9
  experimental: {
    // Enable optimized package imports for tree shaking
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      'framer-motion',
      'date-fns',
      'lodash-es',
      'react-hook-form',
      '@tanstack/react-query'
    ],
    // Enable modern build optimizations
    esmExternals: true,
  },
  
  // Turbopack configuration (stable)
  turbopack: {
    rules: {
      '*.svg': ['@svgr/webpack'],
    },
    // Enable tree shaking optimizations
    resolveAlias: {
      // Optimize common libraries
      'lodash': 'lodash-es',
    },
  },
  
  // TypeScript and ESLint configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Production optimizations
  productionBrowserSourceMaps: false,
  
  // Advanced Webpack configuration - Phase 3 Week 9
  webpack: (config, { dev, isServer, buildId }) => {
    // Development optimizations
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }

    // Production optimizations
    if (!dev && !isServer) {
      // Advanced bundle splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Framework code (React, Next.js)
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            priority: 40,
            enforce: true,
          },
          // Common vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 30,
            minChunks: 2,
            maxSize: 244000, // ~240KB
          },
          // UI components
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 35,
          },
          // Utility libraries
          utils: {
            test: /[\\/]node_modules[\\/](date-fns|lodash-es|clsx)[\\/]/,
            name: 'utils-vendor',
            chunks: 'all',
            priority: 25,
          },
          // Default group
          default: {
            minChunks: 2,
            priority: 20,
            reuseExistingChunk: true,
            maxSize: 244000,
          },
        },
      };

      // Enable tree shaking optimizations
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Module concatenation for better tree shaking
      config.optimization.concatenateModules = true;
    }

    // Tree shaking for specific libraries
    config.resolve.alias = {
      ...config.resolve.alias,
      // Use ES modules for better tree shaking
      'lodash': 'lodash-es',
    };

    // Ignore moment locales for smaller bundle
    config.plugins.push(
      new (require('webpack')).IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      })
    );

    return config;
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;