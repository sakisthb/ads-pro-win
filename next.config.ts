import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ['@radix-ui/react-slot', 'clsx', 'tailwind-merge'],
  },
  images: {
    domains: ['images.clerk.dev', 'img.clerk.com'],
    formats: ['image/webp', 'image/avif'],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Specify the source directory
  distDir: '.next',
  // Note: appDir is enabled by default in Next.js 13+ App Router
};

export default withBundleAnalyzer(nextConfig);
