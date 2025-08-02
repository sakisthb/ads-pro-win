/** @type {import('next').NextConfig} */
const nextConfig = {
  // Simple configuration for development
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // External packages that should not be bundled
  serverExternalPackages: ['@prisma/client'],
  
  // Image optimization - simplified
  images: {
    domains: ['localhost'],
  },

  // Basic settings
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Disable source maps in development for faster builds
  productionBrowserSourceMaps: false,
  
  // Webpack configuration - minimal
  webpack: (config, { dev }) => {
    if (dev) {
      // Speed up development builds
      config.optimization = {
        ...config.optimization,
        usedExports: false,
        sideEffects: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;