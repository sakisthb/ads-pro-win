import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { DevAuthProvider } from "@/components/providers/dev-auth-provider";

// Lazy load performance monitor for better initial load (Client Component)
const PerformanceMonitor = dynamic(() => import("@/components/PerformanceMonitor"), {
  loading: () => null,
});

export const metadata: Metadata = {
  title: "Ads Pro Enterprise - AI-Powered Marketing Intelligence",
  description: "Advanced marketing intelligence platform with AI-driven campaign optimization, predictive analytics, and automated workflows.",
  keywords: "marketing, AI, analytics, campaigns, optimization, enterprise",
  authors: [{ name: "Ads Pro Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Ads Pro Enterprise",
    description: "AI-Powered Marketing Intelligence Platform",
    type: "website",
  },
};

// Separate viewport export (Next.js 14+ requirement)
export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#3B82F6',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="//images.clerk.dev" />
        <link rel="dns-prefetch" href="//img.clerk.com" />
        
        {/* Modern mobile web app meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ads Pro Enterprise" />
      </head>
      <body className="h-full antialiased">
        <DevAuthProvider>
          <TRPCProvider>
            {children}
            
            {/* Performance monitoring in development */}
            {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
          </TRPCProvider>
        </DevAuthProvider>
        
        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Performance monitoring
              if (typeof window !== 'undefined') {
                window.addEventListener('load', () => {
                  const navigation = performance.getEntriesByType('navigation')[0];
                  if (navigation) {
                    console.log('Page Load Time:', navigation.loadEventEnd - navigation.loadEventStart, 'ms');
                    console.log('DOM Content Loaded:', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart, 'ms');
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
