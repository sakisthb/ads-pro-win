'use client'

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OrgSwitcher } from './OrgSwitcher';
import { openCommandPalette } from '@/components/command-palette';
import { useChromeLocale } from '@/components/providers/chrome-locale';
import { useCurrency } from '@/components/providers/currency';
import { api } from '@/components/providers/trpc-provider';
import { useActiveOrg } from '@/hooks/use-active-org';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProfessionalNavbarProps {
  email?: string;
}

export function ProfessionalNavbar({ email }: ProfessionalNavbarProps) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { locale, setLocale, t } = useChromeLocale();
  const { currency } = useCurrency();
  const { org, isDemo } = useActiveOrg();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const unreadQuery = api.alerts.unreadCount.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const initials = email ? email[0]?.toUpperCase() ?? 'U' : 'U';

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left — Brand (visible above sidebar width only as accent) */}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25">
            <Zap className="h-4 w-4 text-white" />
          </span>
          <h1 className="hidden text-lg font-bold sm:block">
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Ads Pro
            </span>
          </h1>
          <span className="hidden sm:block h-5 w-px bg-white/15 mx-1" aria-hidden />
          <OrgSwitcher />
        </div>

        {/* Center — Search opens the command palette */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <button
            type="button"
            onClick={openCommandPalette}
            className="relative flex w-full items-center rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-left text-sm text-white/40 outline-none transition-colors hover:border-purple-500/40 hover:bg-white/10"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <span className="flex-1 truncate">{t("search.placeholder")}</span>
            <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40 lg:inline">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white md:hidden"
            aria-label={t("search.placeholder")}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "el" : "en")}
            className="hidden h-9 items-center rounded-lg px-2 text-[11px] font-semibold text-white/55 hover:bg-white/5 hover:text-white sm:flex"
            aria-label="Toggle language"
          >
            {locale === "en" ? "EN" : "ΕΛ"}
          </button>
          <Link
            href="/profile"
            className="hidden h-9 items-center rounded-lg px-2 text-[11px] font-semibold text-white/55 hover:bg-white/5 hover:text-white sm:flex"
            aria-label="Display currency — change on Profile"
          >
            {currency}
          </Link>
          <Link
            href="/chat"
            className="hidden items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/20 sm:flex"
          >
            {t("ask.ai")}
          </Link>
          {/* Notification bell */}
          <button
            onClick={() => router.push('/notifications')}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/80 to-blue-500/80 text-xs font-bold text-white transition-transform hover:scale-105 focus:outline-none">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-56 border border-white/10 bg-gray-900/95 backdrop-blur-xl text-white"
            >
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-white">{email ?? 'User'}</p>
                  <p className="text-xs text-white/50 capitalize">
                    {isDemo ? "Demo workspace" : `${org?.plan ?? "free"} plan`}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => router.push('/profile')}
                className="text-white/80 focus:text-white focus:bg-white/10 cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="text-white/80 focus:text-white focus:bg-white/10 cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
