import type { NextConfig } from "next";

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
  // Ensure the app directory is properly configured
  appDir: true,
};

export default nextConfig;
