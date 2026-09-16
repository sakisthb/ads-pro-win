import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCReactProvider } from "@/components/providers/trpc-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { CurrencyProvider } from "@/components/providers/currency";
import { brandMetadata } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = brandMetadata();

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
