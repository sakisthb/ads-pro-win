'use client'

import { ReactNode, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { ProfessionalNavbar } from './ProfessionalNavbar';
import { Loader2 } from 'lucide-react';
import { ChromeLocaleProvider } from '@/components/providers/chrome-locale';
import { DemoWorkspaceBanner } from '@/components/demo-workspace-banner';
import { readStoredCurrency, useCurrency } from '@/components/providers/currency';
import { useActiveOrg } from '@/hooks/use-active-org';
import { MarketProvider } from '@/hooks/use-active-market';
import { parseReportingCurrency } from '@/lib/currency';

interface ProtectedLayoutProps {
  children: ReactNode;
  email?: string;
  isLoading?: boolean;
}

function CurrencyOrgSync() {
  const { org } = useActiveOrg();
  const { hydrate } = useCurrency();

  useEffect(() => {
    if (readStoredCurrency()) return;
    if (!org?.currency) return;
    hydrate(parseReportingCurrency(org.currency));
  }, [org?.currency, hydrate]);

  return null;
}

export function ProtectedLayout({ children, email, isLoading = false }: ProtectedLayoutProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <p className="text-sm text-white/60">Loading Ads Pro Enterprise…</p>
        </div>
      </div>
    );
  }

  return (
    <ChromeLocaleProvider>
    <MarketProvider>
    <CurrencyOrgSync />
    <div className="relative min-h-screen w-full bg-gray-950 text-white">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-purple-700/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-700/10 blur-3xl" />
      </div>

      {/* Fixed sidebar */}
      <AppSidebar />

      {/* Main content offset by sidebar width */}
      <div className="relative z-10 pl-64">
        <ProfessionalNavbar email={email} />
        <DemoWorkspaceBanner />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
    </MarketProvider>
    </ChromeLocaleProvider>
  );
}
