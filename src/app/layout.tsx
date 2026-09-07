import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCReactProvider } from "@/components/providers/trpc-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { CurrencyProvider } from "@/components/providers/currency";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ads Pro Enterprise - Advanced Attribution Analytics",
  description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
  keywords: "attribution analytics, digital marketing, cross-channel reporting, marketing automation, ROI tracking",
  authors: [{ name: "Ads Pro Enterprise" }],
  openGraph: {
    title: "Ads Pro Enterprise - Advanced Attribution Analytics",
    description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
    type: "website",
    url: "https://ads-pro-enterprise.vercel.app",
    siteName: "Ads Pro Enterprise",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ads Pro Enterprise - Advanced Attribution Analytics",
    description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/*
            TRPCReactProvider wraps AuthProvider so the auth context can call
            tRPC hooks (e.g. organizations.ensureMembership) right after the
            session resolves. Auth state itself is still read from the
            http-only Supabase cookies, so ordering does not affect tRPC auth.
          */}
          <TRPCReactProvider>
            <AuthProvider>
              <CurrencyProvider>{children}</CurrencyProvider>
            </AuthProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
