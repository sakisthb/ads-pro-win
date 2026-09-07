"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  Filter,
  Info,
  Mail,
  Search,
  Settings,
  Smartphone,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@/components/providers/trpc-provider";
import { formatDistanceToNow } from "date-fns";
import { useActiveOrg } from "@/hooks/use-active-org";

// ---------------------------------------------------------------------------
// Platform color system
// ---------------------------------------------------------------------------
const PLATFORMS = {
  Meta: { color: "#1877F2", label: "Meta" },
  Google: { color: "#4285F4", label: "Google" },
  TikTok: { color: "#FF0050", label: "TikTok" },
  WooCommerce: { color: "#96588A", label: "WooCommerce" },
} as const;

type PlatformKey = keyof typeof PLATFORMS;

const GLASS = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type NotificationType = "success" | "warning" | "error" | "info";
type NotificationCategory = "campaigns" | "integrations" | "features" | "system" | "billing";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  category: NotificationCategory;
  platform: PlatformKey | null;
}

type ChannelKey = "email" | "browser" | "mobile";

interface ChannelSettings {
  enabled: boolean;
  sound?: boolean;
  frequency?: string;
  categories: Record<NotificationCategory, boolean>;
}

// ---------------------------------------------------------------------------
// Demo data — inline, presentation only
// ---------------------------------------------------------------------------
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "success",
    title: "Campaign scaling opportunity detected",
    message:
      'TikTok Spark Ads "Creator Collab" is converting 34% above target — the AI recommends a 25% budget increase while the window stays open.',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    read: false,
    category: "campaigns",
    platform: "TikTok",
  },
  {
    id: "2",
    type: "warning",
    title: "Budget pacing alert",
    message:
      'Meta campaign "Q4 Retargeting — DPA" is pacing at 118% of its daily target and will exhaust budget 4 hours early.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    category: "campaigns",
    platform: "Meta",
  },
  {
    id: "3",
    type: "error",
    title: "Integration token expired",
    message:
      "The Google Ads refresh token has expired. Metrics have been frozen for 2 hours — reconnect to resume live syncing.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    read: true,
    category: "integrations",
    platform: "Google",
  },
  {
    id: "4",
    type: "info",
    title: "New feature available",
    message:
      "Predictive Budget Reallocation is now enabled on your workspace. Find it under Predictions → Budget AI.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
    read: true,
    category: "features",
    platform: null,
  },
  {
    id: "5",
    type: "success",
    title: "Weekly data sync complete",
    message:
      "All four platforms synchronized successfully — 2.4M rows of performance data processed with zero discrepancies.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22),
    read: true,
    category: "system",
    platform: null,
  },
  {
    id: "6",
    type: "warning",
    title: "WooCommerce catalog drift",
    message:
      "48 products have price mismatches between the storefront and the synced ad catalog. Dynamic product ads may show stale prices.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30),
    read: true,
    category: "integrations",
    platform: "WooCommerce",
  },
  {
    id: "7",
    type: "info",
    title: "Invoice available",
    message: "Your August invoice for the Professional plan is ready. Amount due: €249.00 — auto-pay scheduled for Sep 1.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 46),
    read: true,
    category: "billing",
    platform: null,
  },
  {
    id: "8",
    type: "success",
    title: "Anomaly resolved",
    message:
      "The CPM spike on Google PMax normalized after the asset refresh. Performance is back within the expected band.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 52),
    read: true,
    category: "system",
    platform: "Google",
  },
];

const INITIAL_CHANNELS: Record<ChannelKey, ChannelSettings> = {
  email: {
    enabled: true,
    frequency: "immediate",
    categories: {
      campaigns: true,
      integrations: true,
      features: true,
      system: true,
      billing: false,
    },
  },
  browser: {
    enabled: true,
    sound: true,
    categories: {
      campaigns: true,
      integrations: true,
      features: false,
      system: false,
      billing: false,
    },
  },
  mobile: {
    enabled: false,
    categories: {
      campaigns: true,
      integrations: true,
      features: false,
      system: false,
      billing: false,
    },
  },
};

const CATEGORY_LABELS: { id: NotificationCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "campaigns", label: "Campaigns" },
  { id: "integrations", label: "Integrations" },
  { id: "features", label: "Features" },
  { id: "system", label: "System" },
  { id: "billing", label: "Billing" },
];

const FREQUENCIES = ["Immediate", "Hourly digest", "Daily digest", "Weekly digest"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TYPE_STYLES: Record<NotificationType, { icon: typeof Info; iconColor: string; badge: string; label: string }> = {
  success: {
    icon: CheckCircle,
    iconColor: "text-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    label: "Success",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-yellow-400",
    badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    label: "Warning",
  },
  error: {
    icon: X,
    iconColor: "text-red-400",
    badge: "border-red-500/30 bg-red-500/10 text-red-300",
    label: "Error",
  },
  info: {
    icon: Info,
    iconColor: "text-blue-400",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    label: "Info",
  },
};

function getTimeAgo(timestamp: Date): string {
  const diff = Date.now() - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-amber-500/50 bg-amber-500/30" : "border-white/15 bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full transition-all",
          checked ? "left-[22px] bg-amber-400" : "left-0.5 bg-zinc-400",
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium capitalize text-white">{label}</div>
        {description && <div className="text-xs text-zinc-500">{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function NotificationsPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const utils = api.useUtils();

  const triggeredQuery = api.alerts.listTriggered.useQuery(undefined, {
    enabled: !isDemo && !isLoading,
    retry: false,
  });
  const markRead = api.alerts.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.alerts.listTriggered.invalidate(),
        utils.alerts.unreadCount.invalidate(),
      ]);
    },
  });
  const markAllRead = api.alerts.markAllRead.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.alerts.listTriggered.invalidate(),
        utils.alerts.unreadCount.invalidate(),
      ]);
      setToast(
        result.updated === 0
          ? "Nothing unread"
          : `Marked ${result.updated} notification${result.updated === 1 ? "" : "s"} as read`,
      );
      window.setTimeout(() => setToast(null), 2200);
    },
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [channels, setChannels] = useState<Record<ChannelKey, ChannelSettings>>(INITIAL_CHANNELS);
  const [filter, setFilter] = useState<"all" | NotificationCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) setNotifications(DEMO_NOTIFICATIONS);
  }, [isDemo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    showToast("Notification marked as read");
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast("All notifications marked as read");
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    showToast("Notification deleted");
  };

  const clearAll = () => {
    setNotifications([]);
    showToast("All notifications cleared");
  };

  const updateChannel = (channel: ChannelKey, patch: Partial<ChannelSettings>) => {
    setChannels((prev) => ({ ...prev, [channel]: { ...prev[channel], ...patch } }));
    showToast(isDemo ? "Channel settings updated" : "Not saved — channel prefs are not persisted yet");
  };

  const updateCategory = (channel: ChannelKey, category: NotificationCategory, enabled: boolean) => {
    setChannels((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        categories: { ...prev[channel].categories, [category]: enabled },
      },
    }));
    showToast(
      isDemo
        ? `${category} notifications ${enabled ? "enabled" : "disabled"}`
        : "Not saved — channel prefs are not persisted yet",
    );
  };

  const filteredNotifications = notifications.filter((notification) => {
    const matchesFilter = filter === "all" || notification.category === filter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      notification.title.toLowerCase().includes(term) || notification.message.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const channelCards: {
    key: ChannelKey;
    title: string;
    description: string;
    icon: typeof Mail;
    iconColor: string;
  }[] = [
    {
      key: "email",
      title: "Email Notifications",
      description: "Digests and critical alerts delivered to your inbox",
      icon: Mail,
      iconColor: "text-blue-400",
    },
    {
      key: "browser",
      title: "Browser Notifications",
      description: "Desktop push notifications while the app is open",
      icon: Bell,
      iconColor: "text-violet-400",
    },
    {
      key: "mobile",
      title: "Mobile Notifications",
      description: "Push notifications on iOS and Android devices",
      icon: Smartphone,
      iconColor: "text-emerald-400",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Inline transient feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-zinc-900/95 px-4 py-3 text-sm text-emerald-300 shadow-lg backdrop-blur-xl"
          >
            <CheckCircle className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
            <Bell className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-xs font-semibold text-amber-300">Notification Center</span>
          </div>
          <h1 className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Notifications
          </h1>
          <p className="text-sm text-zinc-400">
            {isDemo
              ? "Demo theater — sample alerts including a fake 2.4M-row sync. Not BAGTOBAG."
              : "Budget-rule and creative-fatigue alerts for this workspace"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && unreadCount > 0 && (
            <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">{unreadCount} unread</Badge>
          )}
          {!isDemo && (triggeredQuery.data?.filter((n) => !n.isRead).length ?? 0) > 0 && (
            <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">
              {triggeredQuery.data?.filter((n) => !n.isRead).length} unread
            </Badge>
          )}
          {isDemo ? (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => markAllRead.mutate()}
              disabled={
                markAllRead.isPending ||
                !(triggeredQuery.data?.some((n) => !n.isRead) ?? false)
              }
              className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="history" className="space-y-6">
        {isDemo && (
        <TabsList className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {[
            { value: "history", label: "History", icon: Bell },
            { value: "settings", label: "Settings", icon: Settings },
            { value: "preferences", label: "Preferences", icon: Filter },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white md:text-sm"
            >
              <tab.icon className="mr-1.5 h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        )}

        {/* History tab */}
        <TabsContent value="history" className="space-y-6">
          {!isDemo && (
            <div className={cn(GLASS, "p-6")}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Alerts</h3>
                  <p className="text-sm text-zinc-400">Alerts triggered by your budget rules and monitors</p>
                </div>
                <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">
                  {triggeredQuery.data?.length ?? 0} total
                </Badge>
              </div>

              {triggeredQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
                </div>
              ) : !triggeredQuery.data?.length ? (
                <div className="py-12 text-center">
                  <Bell className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                  <h3 className="text-lg font-medium text-white">No alerts yet</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    When a budget rule or creative-fatigue monitor fires, alerts appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {triggeredQuery.data.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "rounded-xl border p-4",
                        alert.isRead
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-amber-500/25 bg-white/[0.06]",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <h4 className={cn("font-medium", alert.isRead ? "text-zinc-200" : "text-white")}>
                          {alert.title}
                        </h4>
                        {!alert.isRead && (
                          <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Unread" />
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{alert.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                        </span>
                        {(alert.data as { kind?: string; href?: string } | null)?.href?.startsWith(
                          "/creative-fatigue",
                        ) && (
                          <Link
                            href={
                              (alert.data as { href?: string } | null)?.href ??
                              "/creative-fatigue"
                            }
                            className="text-amber-300 hover:text-amber-200"
                          >
                            Open Creative Fatigue
                          </Link>
                        )}
                        {!alert.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead.mutate({ id: alert.id })}
                            disabled={markRead.isPending}
                            className="text-amber-300 hover:text-amber-200 disabled:opacity-50"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isDemo && (
          <div className={cn(GLASS, "p-6")}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Notification History</h3>
                <p className="text-sm text-zinc-400">Your recent alerts and activity feed</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="border-white/15 bg-transparent text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear All
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Search notifications…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-amber-500/30"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORY_LABELS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilter(cat.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      filter === cat.id
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* List */}
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredNotifications.map((notification) => {
                  const style = TYPE_STYLES[notification.type];
                  const TypeIcon = style.icon;
                  return (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "group rounded-xl border p-4 transition-colors",
                        notification.read
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-amber-500/25 bg-white/[0.06]",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "mt-0.5 shrink-0 rounded-xl border border-white/10 bg-white/5 p-2",
                            !notification.read && "bg-white/10",
                          )}
                        >
                          <TypeIcon className={cn("h-5 w-5", style.iconColor)} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={cn("font-medium", notification.read ? "text-zinc-200" : "text-white")}>
                              {notification.title}
                            </h4>
                            <Badge className={cn("border", style.badge)}>{style.label}</Badge>
                            {notification.platform && (
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                                style={{
                                  backgroundColor: `${PLATFORMS[notification.platform].color}2e`,
                                  border: `1px solid ${PLATFORMS[notification.platform].color}59`,
                                }}
                              >
                                {PLATFORMS[notification.platform].label}
                              </span>
                            )}
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Unread" />
                            )}
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{notification.message}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getTimeAgo(notification.timestamp)}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/5 text-xs capitalize text-zinc-300"
                            >
                              {notification.category}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
                            >
                              Mark as read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:bg-red-500/15 hover:text-red-400"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredNotifications.length === 0 && (
                <div className="py-12 text-center">
                  <Bell className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                  <h3 className="text-lg font-medium text-white">No notifications found</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Try adjusting your search or category filters
                  </p>
                </div>
              )}
            </div>
          </div>
          )}
        </TabsContent>

        {/* Settings tab — Demo org only. Live BAGTOBAG does not invent channel prefs. */}
        {isDemo && (
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {channelCards.map((channel) => {
              const config = channels[channel.key];
              return (
                <Card key={channel.key} className={cn(GLASS, "border-white/10 bg-white/5 p-0")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <channel.icon className={cn("h-5 w-5", channel.iconColor)} />
                      </div>
                      {channel.title}
                    </CardTitle>
                    <CardDescription className="text-zinc-400">{channel.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <span className="text-sm font-medium text-white">Enable channel</span>
                      <Toggle
                        checked={config.enabled}
                        onChange={() => updateChannel(channel.key, { enabled: !config.enabled })}
                        label={`Enable ${channel.title}`}
                      />
                    </div>

                    {config.enabled && (
                      <>
                        {channel.key === "email" && (
                          <div className="space-y-2 border-b border-white/10 pb-3">
                            <span className="text-sm font-medium text-white">Frequency</span>
                            <div className="flex flex-wrap gap-1.5">
                              {FREQUENCIES.map((freq) => {
                                const value = freq.toLowerCase().replace(" ", "-");
                                const selected = config.frequency === value;
                                return (
                                  <button
                                    key={freq}
                                    type="button"
                                    onClick={() => updateChannel("email", { frequency: value })}
                                    className={cn(
                                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                      selected
                                        ? "border-blue-500/50 bg-blue-500/20 text-blue-200"
                                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
                                    )}
                                  >
                                    {freq}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {channel.key === "browser" && (
                          <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              {config.sound ? (
                                <Volume2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <VolumeX className="h-4 w-4 text-zinc-500" />
                              )}
                              Play sound
                            </span>
                            <Toggle
                              checked={Boolean(config.sound)}
                              onChange={() => updateChannel("browser", { sound: !config.sound })}
                              label="Play sound"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Categories
                          </span>
                          {(Object.keys(config.categories) as NotificationCategory[]).map((category) => (
                            <div key={category} className="flex items-center justify-between py-1.5">
                              <span className="text-sm capitalize text-zinc-300">{category}</span>
                              <Toggle
                                checked={config.categories[category]}
                                onChange={() => updateCategory(channel.key, category, !config.categories[category])}
                                label={`${category} ${channel.key} notifications`}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quiet hours summary */}
          <div className={cn(GLASS, "flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5">
                <BellOff className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Quiet hours active</div>
                <p className="text-sm text-zinc-400">
                  Notifications are muted daily between 22:00 and 08:00 — critical alerts still break through
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
              <Archive className="mr-1.5 h-3 w-3" /> Low-priority digested
            </Badge>
          </div>
        </TabsContent>
        )}

        {isDemo && (
        <TabsContent value="preferences" className="space-y-6">
          <Card className={cn(GLASS, "border-white/10 bg-white/5 p-0")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Notification Preferences</CardTitle>
              <CardDescription className="text-zinc-400">
                Fine-tune how and when notifications reach you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Quiet hours */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-white">Quiet Hours</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-xs text-zinc-500">Start time</span>
                      <Input
                        type="time"
                        defaultValue="22:00"
                        aria-label="Quiet hours start"
                        className="border-white/10 bg-white/5 text-white [color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-zinc-500">End time</span>
                      <Input
                        type="time"
                        defaultValue="08:00"
                        aria-label="Quiet hours end"
                        className="border-white/10 bg-white/5 text-white [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <ToggleRow
                    label="Enable quiet hours"
                    description="Mute non-critical notifications overnight"
                    checked
                    onChange={() => showToast("Quiet hours toggled")}
                  />
                </div>

                {/* Priority settings */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-white">Priority Settings</h4>
                  <ToggleRow
                    label="High-priority alerts"
                    description="Budget risks, expired tokens, anomalies"
                    checked
                    onChange={() => showToast("High-priority alerts toggled")}
                  />
                  <ToggleRow
                    label="Campaign performance"
                    description="Pacing and scaling opportunities"
                    checked
                    onChange={() => showToast("Campaign performance toggled")}
                  />
                  <ToggleRow
                    label="System maintenance"
                    description="Scheduled maintenance windows"
                    checked={false}
                    onChange={() => showToast("System maintenance toggled")}
                  />
                  <ToggleRow
                    label="Feature updates"
                    description="New capabilities in your workspace"
                    checked={false}
                    onChange={() => showToast("Feature updates toggled")}
                  />
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="space-y-4">
                <h4 className="font-semibold text-white">Advanced Settings</h4>
                <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                  <ToggleRow
                    label="Group similar notifications"
                    description="Bundle repeated alerts into one"
                    checked
                    onChange={() => showToast("Grouping toggled")}
                  />
                  <ToggleRow
                    label="Show preview text"
                    description="Display message body in the alert"
                    checked
                    onChange={() => showToast("Preview text toggled")}
                  />
                  <ToggleRow
                    label="Auto-dismiss after 5s"
                    description="Clear transient alerts automatically"
                    checked={false}
                    onChange={() => showToast("Auto-dismiss toggled")}
                  />
                  <ToggleRow
                    label="Include user avatar"
                    description="Show who triggered team actions"
                    checked
                    onChange={() => showToast("Avatar toggled")}
                  />
                  <ToggleRow
                    label="Show action buttons"
                    description="Quick actions inside the notification"
                    checked
                    onChange={() => showToast("Action buttons toggled")}
                  />
                  <ToggleRow
                    label="Persistent notifications"
                    description="Keep unread alerts pinned"
                    checked={false}
                    onChange={() => showToast("Persistence toggled")}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() =>
                    showToast(isDemo ? "Preferences saved" : "Not saved — preferences are not persisted yet")
                  }
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400"
                >
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
