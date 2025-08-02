'use client'

import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ProfessionalNavbar } from './ProfessionalNavbar';
import { Loader2 } from 'lucide-react';

interface ProtectedLayoutProps {
  children: ReactNode;
  isLoading?: boolean;
}

export function ProtectedLayout({ children, isLoading = false }: ProtectedLayoutProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading Ads Pro Enterprise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <SidebarProvider>
        <div className="flex flex-col w-full min-h-screen">
          {/* Professional Navbar */}
          <ProfessionalNavbar />
          
          {/* Main Content Area */}
          <div className="flex flex-1">
            {/* Collapsible Sidebar */}
            <AppSidebar />
            
            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-6 overflow-auto">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}