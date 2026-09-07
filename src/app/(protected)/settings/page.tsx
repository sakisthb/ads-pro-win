"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Bell, Brain, Building2, CheckCircle, ChevronRight, Database, Download,
  Globe, HelpCircle, Info, Keyboard, Monitor, Moon, Palette, Plug, RefreshCw,
  RotateCcw, Save, Sparkles, Sun, Users, Zap,
} from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { persistLocale, useChromeLocale } from "@/components/providers/chrome-locale";
import { persistCurrency, useCurrency } from "@/components/providers/currency";
import { CurrencyPicker } from "@/components/profile/currency-picker";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { useTheme } from "@/components/providers/theme-provider";
import { api } from "@/components/providers/trpc-provider";
import { MARKET_MODE_LABEL, parseMarketMode } from "@/lib/market-desk";

type ThemeMode = "light" | "dark" | "system";
type Language = "en" | "el";
type AiAutonomy = "manual" | "balanced" | "autonomous";

interface SettingsState {
  notifications: boolean;
  budgetAlerts: boolean;
  showAdvanced: boolean;
  debugMode: boolean;
  performanceMode: boolean;
  aiAutonomy: AiAutonomy;
}

const DEFAULT_SETTINGS: SettingsState = {
  notifications: true,
  budgetAlerts: true,
  showAdvanced: false,
  debugMode: false,
  performanceMode: true,
  aiAutonomy: "balanced",
};

const PLATFORM_CATALOG: Array<{
  id: string;
  name: string;
  description: string;
  color: string;
  cadence: string;
}> = [
  { id: "meta", name: "Meta Ads", description: "Facebook & Instagram campaigns, audiences and spend", color: "#1877F2", cadence: "Hourly delta · daily full at 04:00 UTC" },
  { id: "google", name: "Google Ads", description: "Search, Shopping, YouTube and Performance Max", color: "#4285F4", cadence: "Hourly delta · daily full at 04:00 UTC" },
  { id: "tiktok", name: "TikTok Ads", description: "TikTok For Business campaigns and creative insights", color: "#FF0050", cadence: "Hourly delta · daily full at 04:00 UTC" },
  { id: "woocommerce", name: "WooCommerce", description: "Store orders, products, revenue and customer LTV", color: "#96588A", cadence: "Orders every 2h · products daily at 03:00 UTC" },
  { id: "opencart", name: "OpenCart", description: "Store orders and catalog sync", color: "#23A8E0", cadence: "Every 6 hours" },
  { id: "omnisend", name: "Omnisend", description: "Email campaigns and list activity", color: "#0B99FF", cadence: "Every 6 hours" },
  { id: "brevo", name: "Brevo", description: "Email campaigns and list activity", color: "#0B996E", cadence: "Every 6 hours" },
];

const DEMO_PLATFORMS = [
  { id: "meta", name: "Meta Ads", description: "Facebook & Instagram campaigns, audiences and spend", color: "#1877F2", connected: true, accounts: 3, lastSync: "12 minutes ago" },
  { id: "google", name: "Google Ads", description: "Search, Shopping, YouTube and Performance Max", color: "#4285F4", connected: true, accounts: 2, lastSync: "8 minutes ago" },
  { id: "tiktok", name: "TikTok Ads", description: "TikTok For Business campaigns and creative insights", color: "#FF0050", connected: false, accounts: 0, lastSync: "—" },
  { id: "woocommerce", name: "WooCommerce", description: "Store orders, products, revenue and customer LTV", color: "#96588A", connected: true, accounts: 1, lastSync: "1 hour ago" },
];

const DEMO_USERS = [
  { role: "Admin", email: "admin@adspro.com", password: "admin123", name: "Athanasios Vlachos" },
  { role: "Agency", email: "maria@digitalagency.gr", password: "maria123", name: "Maria Papadopoulou" },
  { role: "Client", email: "nikos@techstartup.com", password: "nikos123", name: "Nikos Antoniou" },
];

const FETCH_STATS = [
  { label: "API calls today", value: "4,218 / 25,000", pct: 17, tone: "bg-emerald-500" },
  { label: "Rate limit usage", value: "38%", pct: 38, tone: "bg-blue-500" },
  { label: "Queue depth", value: "12 jobs", pct: 12, tone: "bg-violet-500" },
];

const THEME_OPTIONS: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "el", label: "Ελληνικά", flag: "🇬🇷" },
];

const AUTONOMY_OPTIONS: { value: AiAutonomy; label: string; hint: string }[] = [
  { value: "manual", label: "Manual", hint: "AI only suggests — you approve everything" },
  { value: "balanced", label: "Balanced", hint: "AI acts on safe optimizations, asks for the rest" },
  { value: "autonomous", label: "Autonomous", hint: "AI optimizes budgets and bids 24/7" },
];

function relativeSync(value: Date | string | null | undefined): string {
  if (!value) return "Never synced";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Never synced";
  return formatDistanceToNow(date, { addSuffix: true });
}

function ToggleSwitch({
  checked, onChange, accent = "from-blue-500 to-violet-500", label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: string;
  label: string;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border border-white/10 transition-colors duration-300 ${
        checked ? `bg-gradient-to-r ${accent}` : "bg-white/10"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`} />
    </button>
  );
}

function PillGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; icon?: typeof Sun; flag?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <Button
            key={option.value} size="sm" onClick={() => onChange(option.value)}
            className={`rounded-xl transition-all duration-300 ${
              active
                ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25"
                : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {Icon ? <Icon className="mr-1.5 h-4 w-4" /> : option.flag ? <span className="mr-1.5 text-base">{option.flag}</span> : null}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function SettingRow({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-transparent p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/5">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { isDemo, isLoading, org } = useActiveOrg();
  const { locale, setLocale } = useChromeLocale();
  const { setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const connectionsQuery = api.connections.list.useQuery(
    {},
    { enabled: !isDemo, retry: false, staleTime: 60_000 },
  );
  const syncQuery = api.syncStatus.getStatus.useQuery(
    {},
    { enabled: !isDemo, retry: false, staleTime: 60_000 },
  );
  const utils = api.useUtils();
  const updateMarketMode = api.organizations.updateMarketMode.useMutation({
    onSuccess: async () => {
      await utils.organizations.list.invalidate();
    },
  });

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [demoPlatforms, setDemoPlatforms] = useState(DEMO_PLATFORMS.map((p) => ({ ...p })));
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTheme: ThemeMode =
    mounted && (theme === "light" || theme === "dark" || theme === "system")
      ? theme
      : "system";

  const liveAccounts = useMemo(() => {
    const connections = connectionsQuery.data?.connections ?? [];
    const syncPlatforms = syncQuery.data?.platforms ?? [];
    const jobByAccount = new Map(
      syncPlatforms.flatMap((group) =>
        group.accounts.map((account) => [account.id, account] as const),
      ),
    );

    return connections.map((account) => {
      const catalog = PLATFORM_CATALOG.find((p) => p.id === account.platform);
      const job = jobByAccount.get(account.id);
      return {
        id: account.id,
        platform: account.platform,
        name: account.name || catalog?.name || account.platform,
        accountId: account.accountId,
        color: catalog?.color ?? "#71717a",
        cadence: catalog?.cadence ?? "Worker schedule depends on platform",
        isConnected: account.isConnected,
        lastSyncAt: job?.lastSyncAt ?? account.lastSyncAt,
        lastJobStatus: job?.lastJobStatus ?? null,
        failed: job?.lastJobStatus === "failed",
      };
    });
  }, [connectionsQuery.data, syncQuery.data]);

  const connectedCount = liveAccounts.filter((account) => account.isConnected).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const notify = (message: string, tone: "success" | "info" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLanguage = (value: Language) => {
    setLocale(value);
    persistLocale(value);
  };

  const handleSave = () => {
    persistLocale(locale);
    notify("Theme, language, and currency are stored in this browser");
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setTheme("system");
    setLocale("en");
    persistLocale("en");
    setCurrency(DEFAULT_CURRENCY);
    persistCurrency(DEFAULT_CURRENCY);
    setDemoPlatforms(DEMO_PLATFORMS.map((p) => ({ ...p })));
    notify("Browser preferences restored to defaults", "info");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({
      theme: currentTheme,
      language: locale,
      exportedAt: new Date().toISOString(),
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adspro-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Browser preferences exported as JSON");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as {
          theme?: ThemeMode;
          language?: Language;
        };
        if (parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system") {
          setTheme(parsed.theme);
        }
        if (parsed.language === "en" || parsed.language === "el") {
          handleLanguage(parsed.language);
        }
        notify("Browser preferences imported");
      } catch {
        notify("Invalid settings file — expected JSON", "info");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleDemoPlatform = (id: string) => {
    const platform = demoPlatforms.find((p) => p.id === id);
    setDemoPlatforms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, connected: !p.connected, lastSync: !p.connected ? "just now" : "—" } : p
      )
    );
    notify(`${platform?.name ?? "Platform"} ${platform?.connected ? "disconnected" : "connected"} (sample)`, "info");
  };

  return (
    <div className="space-y-8">
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-blue-500/30 bg-blue-500/10 text-blue-300"
          }`}
        >
          {toast.tone === "success" ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">Settings</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5">
            <Database className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">
              {isDemo ? "Sample workspace configuration" : "Workspace configuration"}
            </span>
          </div>
          <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Settings
          </h1>
          <p className="text-lg text-zinc-400">
            {isDemo
              ? "Sample controls for the Demo workspace. Live orgs use real connections and browser preferences."
              : "Theme, language, and currency save in this browser. Ad accounts connect on Connections."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleReset} variant="outline"
            className="rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-violet-500"
          >
            <Save className="mr-2 h-4 w-4" /> Save browser prefs
          </Button>
        </div>
      </motion.div>

      {!isDemo && org && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2 shadow-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Workspace</h2>
                <p className="text-sm text-zinc-400">The organization these settings apply to.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Name</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{org.name}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Slug</p>
                <p className="mt-1 truncate font-mono text-sm text-zinc-300">{org.slug}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Plan</p>
                <p className="mt-1 text-sm font-semibold capitalize text-white">{org.plan}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Your role</p>
                <p className="mt-1 text-sm font-semibold capitalize text-white">{org.role}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-white">Shop identity</p>
              <p className="text-xs text-zinc-500">
                Retail-only and wholesale-only workspaces inherit that desk for guests, registered
                customers, and unnamed ads. Mixed shops classify per order and leave unnamed ads
                unclassified. Sync Woo after changing this.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["mixed", "retail", "wholesale"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={updateMarketMode.isPending}
                    onClick={() => updateMarketMode.mutate({ marketMode: value })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      parseMarketMode(org.marketMode) === value
                        ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                        : "border-white/10 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {MARKET_MODE_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          {
            title: "General", description: "What this workspace is, and how metrics refresh",
            icon: <Database className="h-5 w-5 text-white" />, gradient: "from-blue-500 to-blue-600",
            body: isDemo ? (
              <>
                <SettingRow title="Demo mode" description="This is the sample workspace with StyleVault numbers">
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">On</Badge>
                </SettingRow>
                <Separator className="bg-white/10" />
                <SettingRow title="Auto-refresh" description="Dashboard live strip polls every 60 seconds">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">60s</Badge>
                </SettingRow>
              </>
            ) : (
              <>
                <SettingRow title="Workspace type" description="Sample numbers live on Demo — switch it from the org menu">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Live</Badge>
                </SettingRow>
                <Separator className="bg-white/10" />
                <SettingRow title="Metric refresh" description="Dashboard polls every 60s. Realtime polls every 15s when streaming.">
                  <Badge variant="outline" className="border-white/20 bg-white/5 text-zinc-300">Fixed</Badge>
                </SettingRow>
              </>
            ),
          },
          {
            title: "Appearance", description: "Theme, language, and currency preferences",
            icon: <Palette className="h-5 w-5 text-white" />, gradient: "from-violet-500 to-purple-600",
            body: (
              <>
                <SettingRow title="Theme" description="Applies to the entire dashboard">
                  <PillGroup options={THEME_OPTIONS} value={currentTheme} onChange={(v) => setTheme(v)} />
                </SettingRow>
                <Separator className="bg-white/10" />
                <SettingRow title="Language" description="Interface and report language">
                  <PillGroup options={LANGUAGE_OPTIONS} value={locale} onChange={handleLanguage} />
                </SettingRow>
                <Separator className="bg-white/10" />
                <div className="p-4">
                  <CurrencyPicker />
                </div>
              </>
            ),
          },
          {
            title: "Notifications", description: "Alerts that already have a page",
            icon: <Bell className="h-5 w-5 text-white" />, gradient: "from-emerald-500 to-green-600",
            body: isDemo ? (
              <>
                <SettingRow title="In-app notifications" description="Sample toggle — not persisted">
                  <ToggleSwitch checked={settings.notifications} onChange={(v) => update("notifications", v)} accent="from-emerald-500 to-green-500" label="In-app notifications" />
                </SettingRow>
                <Separator className="bg-white/10" />
                <SettingRow title="Budget alerts" description="Sample toggle — not persisted">
                  <ToggleSwitch checked={settings.budgetAlerts} onChange={(v) => update("budgetAlerts", v)} accent="from-orange-500 to-amber-500" label="Budget alerts" />
                </SettingRow>
              </>
            ) : (
              <>
                <SettingRow title="In-app notifications" description="Open the notifications inbox for this workspace">
                  <Button asChild size="sm" variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Link href="/notifications">Open</Link>
                  </Button>
                </SettingRow>
                <Separator className="bg-white/10" />
                <SettingRow title="Budget alerts" description="Rules and spend thresholds live on Budget Alerts">
                  <Button asChild size="sm" variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Link href="/budget-alerts">Open</Link>
                  </Button>
                </SettingRow>
              </>
            ),
          },
          {
            title: "Advanced", description: isDemo ? "Sample developer controls" : "No client debug flags are wired yet",
            icon: <Zap className="h-5 w-5 text-white" />, gradient: "from-orange-500 to-amber-600",
            body: isDemo ? (
              <>
                <SettingRow title="Show advanced settings" description="Reveal sample debug controls">
                  <ToggleSwitch checked={settings.showAdvanced} onChange={(v) => update("showAdvanced", v)} accent="from-orange-500 to-amber-500" label="Show advanced settings" />
                </SettingRow>
                {settings.showAdvanced && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                    <Separator className="my-2 bg-white/10" />
                    <SettingRow title="Debug mode" description="Sample only — does not change logging">
                      <ToggleSwitch checked={settings.debugMode} onChange={(v) => update("debugMode", v)} accent="from-red-500 to-rose-600" label="Debug mode" />
                    </SettingRow>
                    <Separator className="bg-white/10" />
                    <SettingRow title="Performance mode" description="Sample only — animations still run">
                      <ToggleSwitch checked={settings.performanceMode} onChange={(v) => update("performanceMode", v)} accent="from-emerald-500 to-green-500" label="Performance mode" />
                    </SettingRow>
                  </motion.div>
                )}
              </>
            ) : (
              <p className="px-4 py-3 text-sm text-zinc-400">
                Verbose request tracing and animation flags are not stored for this workspace. Worker logs live on the server.
              </p>
            ),
          },
        ].map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
          >
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-white">
                  <div className={`rounded-xl bg-gradient-to-br ${section.gradient} p-2 shadow-lg`}>{section.icon}</div>
                  {section.title}
                </CardTitle>
                <CardDescription className="text-sm text-zinc-400">{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">{section.body}</CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {isDemo ? (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
                  <div className="rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 p-2 shadow-lg">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  Platform Integrations
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Sample</Badge>
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Sample connect/disconnect for the Demo workspace. Live orgs use Connections.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                {demoPlatforms.filter((p) => p.connected).length} of {demoPlatforms.length} connected
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {demoPlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lg"
                      style={{ backgroundColor: `${platform.color}33`, border: `1px solid ${platform.color}66` }}
                    >
                      {platform.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{platform.name}</p>
                        {platform.connected ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Connected</Badge>
                        ) : (
                          <Badge variant="outline" className="border-white/20 bg-white/5 text-zinc-400">Offline</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{platform.description}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {platform.connected
                          ? `${platform.accounts} account${platform.accounts === 1 ? "" : "s"} · synced ${platform.lastSync}`
                          : "No accounts linked yet"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm" variant={platform.connected ? "outline" : "default"}
                    onClick={() => toggleDemoPlatform(platform.id)}
                    className={
                      platform.connected
                        ? "rounded-xl border-white/20 text-zinc-300 hover:bg-white/10"
                        : "rounded-xl text-white shadow-lg hover:opacity-90"
                    }
                    style={platform.connected ? undefined : { backgroundColor: platform.color }}
                  >
                    {platform.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
                  <div className="rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 p-2 shadow-lg">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  Platform Integrations
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Live accounts for this workspace. Connect, disconnect, and trigger sync on Connections.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  {connectedCount} connected
                </Badge>
                <Button asChild size="sm" className="rounded-xl bg-white/10 text-white hover:bg-white/15">
                  <Link href="/connections"><Plug className="mr-1.5 h-4 w-4" /> Manage</Link>
                </Button>
              </div>
            </div>

            {connectionsQuery.isLoading ? (
              <p className="text-sm text-zinc-400">Loading accounts…</p>
            ) : connectionsQuery.error ? (
              <p className="text-sm text-red-300">Could not load connections for this workspace.</p>
            ) : liveAccounts.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No ad or store accounts on this workspace yet. Connect them on Connections — this page will not invent extras.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {liveAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lg"
                        style={{ backgroundColor: `${account.color}33`, border: `1px solid ${account.color}66` }}
                      >
                        {account.platform.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{account.name}</p>
                          {account.failed ? (
                            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300">Last sync failed</Badge>
                          ) : account.isConnected ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Connected</Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/20 bg-white/5 text-zinc-400">Token expired</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-zinc-400">
                          {account.platform} · {account.accountId}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {account.isConnected
                            ? `Synced ${relativeSync(account.lastSyncAt)}`
                            : "Reconnect on Connections to resume sync"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">{account.cadence}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2 shadow-lg">
                <Download className="h-5 w-5 text-white" />
              </div>
              Data sync
              {isDemo && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Sample</Badge>}
            </h2>
            <p className="mb-6 mt-1 text-sm text-zinc-400">
              {isDemo
                ? "Sample fetch-manager numbers for the Demo workspace."
                : "Worker cadence is fixed. Last sync comes from this workspace’s jobs."}
            </p>

            {isDemo ? (
              <div className="space-y-3">
                {FETCH_STATS.map((row) => (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{row.label}</span>
                      <span className="font-medium text-white">{row.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(syncQuery.data?.platforms ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-400">No sync jobs yet. Connect an account, then sync from Connections.</p>
                ) : (
                  (syncQuery.data?.platforms ?? []).map((group) => (
                    <div key={group.platform} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold capitalize text-white">{group.platform}</p>
                        <span className="text-xs text-zinc-400">{relativeSync(group.lastSyncAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {group.accounts.length} account{group.accounts.length === 1 ? "" : "s"}
                        {group.accounts[0]?.lastJobStatus ? ` · last job ${group.accounts[0].lastJobStatus}` : ""}
                      </p>
                    </div>
                  ))
                )}
                <p className="text-xs text-zinc-500">
                  Ads: hourly delta and a daily full sync at 04:00 UTC. WooCommerce orders every 2 hours. Email and OpenCart every 6 hours.
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-2 shadow-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              AI Configuration
              {isDemo && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Sample</Badge>}
            </h2>
            <p className="mb-6 mt-1 text-sm text-zinc-400">
              {isDemo
                ? "Sample autonomy levels for the Demo workspace."
                : "Saki suggests from live metrics. Model keys live in server env, not this form."}
            </p>

            {isDemo ? (
              <div className="space-y-2">
                {AUTONOMY_OPTIONS.map((option) => {
                  const active = settings.aiAutonomy === option.value;
                  return (
                    <button
                      key={option.value} type="button" onClick={() => update("aiAutonomy", option.value)}
                      className={`w-full rounded-xl border p-3 text-left transition-all duration-300 ${
                        active ? "border-violet-500/50 bg-violet-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{option.label}</span>
                        {active && <Sparkles className="h-4 w-4 text-violet-400" />}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{option.hint}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Suggestions only</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Chat and Mystery AI read this workspace. Budget and bid writes are not enabled from Settings.
                  </p>
                </div>
                <Button asChild variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                  <Link href="/campaign-launcher">Open Campaign Studio</Link>
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
        <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h2 className="flex items-center justify-center gap-3 text-xl font-semibold text-white">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 p-2.5 shadow-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              Quick Actions
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Shortcuts that already exist in the app</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Keyboard, title: "Keyboard shortcuts", description: "Press ⌘K anywhere", gradient: "from-blue-500 to-blue-600", action: () => notify("Command palette: press ⌘K", "info") },
              { icon: HelpCircle, title: "First session", description: "Open onboarding again", gradient: "from-emerald-500 to-green-600", action: () => router.push("/onboarding") },
              { icon: Download, title: "Export prefs", description: "Theme and language JSON", gradient: "from-violet-500 to-purple-600", action: handleExport },
              { icon: RefreshCw, title: "Import prefs", description: "Restore theme and language", gradient: "from-orange-500 to-amber-600", action: () => fileInputRef.current?.click() },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.title} onClick={item.action}
                  className="group flex h-auto flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:bg-white/10"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{item.description}</p>
                  </div>
                </Button>
              );
            })}
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
        </Card>
      </motion.div>

      {isDemo && (
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.46 }}>
        <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Demo accounts</h3>
              <p className="mt-0.5 text-sm text-zinc-400">
                Sample logins for the Demo workspace only.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {DEMO_USERS.map((user) => (
              <div key={user.email} className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      user.role === "Admin"
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : user.role === "Agency"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    }
                  >
                    {user.role}
                  </Badge>
                  <span className="text-sm font-medium text-white">{user.name}</span>
                </div>
                <p className="mt-2 font-mono text-xs text-zinc-400">{user.email}</p>
                <p className="font-mono text-xs text-zinc-500">{user.password}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Demo data only — these accounts exist for presentations and never touch live ad platforms.
          </div>
        </Card>
      </motion.div>
      )}
    </div>
  );
}
