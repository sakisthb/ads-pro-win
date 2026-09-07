'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Activity,
  MessageSquare,
  Brain,
  GitBranch,
  Filter,
  Users,
  Layers,
  Zap,
  AlertTriangle,
  Rocket,
  ShieldAlert,
  Radar,
  FileText,
  Plug,
  UsersRound,
  Bell,
  ClipboardCheck,
  CreditCard,
  Settings,
  HelpCircle,
  UserCircle,
  Sparkles,
  Search,
  UserCheck,
  Wand2,
  Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChromeLocale } from '@/components/providers/chrome-locale';
import { api } from '@/components/providers/trpc-provider';

/* ------------------------------------------------------------------ */
/*  Nav item types & data                                             */
/* ------------------------------------------------------------------ */

interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  badge?: { text: string; color: 'green' | 'purple' | 'red' | 'blue' };
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'section.main',
    items: [
      { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
      { labelKey: 'nav.campaigns', href: '/campaigns', icon: Megaphone },
      { labelKey: 'nav.analytics', href: '/analytics', icon: BarChart3 },
      { labelKey: 'nav.studio', href: '/analytics-studio', icon: Sparkles, badge: { text: 'AI', color: 'purple' } },
      { labelKey: 'nav.realtime', href: '/realtime', icon: Activity, badge: { text: 'Live', color: 'green' } },
      { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare },
    ],
  },
  {
    titleKey: 'section.intelligence',
    items: [
      { labelKey: 'nav.predictions', href: '/predictions', icon: Brain, badge: { text: 'AI', color: 'purple' } },
      { labelKey: 'nav.mystery', href: '/mystery-ai', icon: Wand2 },
      { labelKey: 'nav.attribution', href: '/attribution', icon: GitBranch },
      { labelKey: 'nav.funnel', href: '/funnel', icon: Filter },
      { labelKey: 'nav.audiences', href: '/audiences', icon: Users },
      { labelKey: 'nav.cross', href: '/cross-platform', icon: Layers },
      { labelKey: 'nav.bidding', href: '/bidding', icon: Zap },
      { labelKey: 'nav.fatigue', href: '/creative-fatigue', icon: AlertTriangle },
      { labelKey: 'nav.seo', href: '/seo', icon: Search },
      { labelKey: 'nav.email', href: '/email', icon: Mail },
    ],
  },
  {
    titleKey: 'section.automation',
    items: [
      { labelKey: 'nav.onboarding', href: '/onboarding', icon: ClipboardCheck },
      { labelKey: 'nav.launcher', href: '/campaign-launcher', icon: Rocket, badge: { text: 'New', color: 'blue' } },
      { labelKey: 'nav.alerts', href: '/budget-alerts', icon: ShieldAlert },
      { labelKey: 'nav.mission', href: '/mission-control', icon: Radar },
    ],
  },
  {
    titleKey: 'section.tools',
    items: [
      { labelKey: 'nav.reports', href: '/reports', icon: FileText },
      { labelKey: 'nav.connections', href: '/connections', icon: Plug },
      { labelKey: 'nav.customers', href: '/customers', icon: UserCheck },
      { labelKey: 'nav.team', href: '/team', icon: UsersRound },
    ],
  },
  {
    titleKey: 'section.account',
    items: [
      { labelKey: 'nav.notifications', href: '/notifications', icon: Bell },
      { labelKey: 'nav.billing', href: '/billing', icon: CreditCard },
      { labelKey: 'nav.settings', href: '/settings', icon: Settings },
      { labelKey: 'nav.help', href: '/help', icon: HelpCircle },
      { labelKey: 'nav.profile', href: '/profile', icon: UserCircle },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Badge component                                                   */
/* ------------------------------------------------------------------ */

function Badge({ text, color }: { text: string; color: 'green' | 'purple' | 'red' | 'blue' }) {
  const styles = {
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <span
      className={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${styles[color]}`}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useChromeLocale();
  const unreadQuery = api.alerts.unreadCount.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-white/10 bg-gray-950/95 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-white/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25">
          <Zap className="h-4 w-4 text-white" />
        </span>
        <span className="text-base font-bold tracking-tight text-white">
          Ads Pro
        </span>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-white/10">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="mb-5">
            {/* Section header */}
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {t(section.titleKey)}
            </p>

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      active
                        ? 'border-l-2 border-purple-500 bg-white/10 text-white'
                        : 'border-l-2 border-transparent text-white/60 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active
                          ? 'text-purple-400'
                          : 'text-white/40 group-hover:text-white/70'
                      }`}
                    />
                    <span className="truncate">{t(item.labelKey)}</span>
                    {item.href === "/notifications" && unread > 0 ? (
                      <Badge text={unread > 99 ? "99+" : String(unread)} color="red" />
                    ) : (
                      item.badge && <Badge text={item.badge.text} color={item.badge.color} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
