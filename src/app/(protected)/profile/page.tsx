"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bell, Check, CheckCircle, CreditCard, Download, Globe, Key, Laptop, Lock, LogOut, Mail,
  Monitor, Moon, Palette, Settings, Shield, Smartphone, Sun, Trash2, User,
} from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { createClient } from "@/lib/supabase/client";
import { CurrencyPicker } from "@/components/profile/currency-picker";
import { persistLocale, useChromeLocale } from "@/components/providers/chrome-locale";
import { useTheme } from "@/components/providers/theme-provider";

/* ------------------------------ Demo data --------------------------------- */

const DEMO_USER = {
  firstName: "Athanasios",
  lastName: "Vlachos",
  email: "athanasios@adspro.com",
  phone: "+30 694 123 4567",
  company: "Ads Pro Digital",
  title: "Founder & CEO",
  role: "Admin",
  plan: "Professional",
  memberSince: "March 2024",
};

const CONNECTED_ACCOUNTS = [
  { name: "Meta Ads", detail: "3 ad accounts · Business Manager", color: "#1877F2", connected: true },
  { name: "Google Ads", detail: "2 MCC accounts · Search & Shopping", color: "#4285F4", connected: true },
  { name: "TikTok Ads", detail: "Not connected", color: "#FF0050", connected: false },
  { name: "WooCommerce", detail: "adspro-store.myshopify… · 1 store", color: "#96588A", connected: true },
];

const ACTIVE_SESSIONS = [
  { device: "MacBook Pro 16″", location: "Athens, GR", browser: "Chrome 126", current: true, icon: Laptop },
  { device: "iPhone 15 Pro", location: "Athens, GR", browser: "Safari 17", current: false, icon: Smartphone },
  { device: "Windows Desktop", location: "Thessaloniki, GR", browser: "Edge 126", current: false, icon: Monitor },
];

const inputClasses = "border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500";

/* ------------------- Inline primitives (no Switch/Label in repo) ---------- */

function ToggleRow({ title, description, checked, onChange }: {
  title: string; description?: string; checked: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-transparent p-3 transition-all duration-300 hover:border-white/10 hover:bg-white/5">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-white/10 transition-colors duration-300 ${
          checked ? "bg-gradient-to-r from-blue-500 to-violet-500" : "bg-white/10"
        }`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

function FormField({ id, label, type = "text", defaultValue, placeholder }: {
  id: string; label: string; type?: string; defaultValue?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-white">{label}</label>
      <Input id={id} type={type} defaultValue={defaultValue} placeholder={placeholder} className={inputClasses} />
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function ProfilePage() {
  const { org, isDemo, isLoading } = useActiveOrg();
  const { locale, setLocale } = useChromeLocale();
  const { theme, setTheme } = useTheme();
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [authUser, setAuthUser] = useState<{ email: string; fullName: string } | null>(null);

  // Real workspaces: load the signed-in user from Supabase auth.
  useEffect(() => {
    if (isDemo) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const fullName =
        (u.user_metadata?.full_name as string | undefined) ||
        (u.user_metadata?.fullName as string | undefined) ||
        u.email?.split("@")[0] ||
        "User";
      setAuthUser({ email: u.email ?? "", fullName });
    });
  }, [isDemo]);

  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    mobile: false,
    performanceAlerts: true,
    weeklyReports: true,
    systemUpdates: true,
    marketingTips: false,
  });

  const [preferences, setPreferences] = useState({
    theme: "dark",
    language: "en",
    timezone: "Europe/Athens",
    welcomeMessage: true,
    autoRefresh: true,
    compactView: false,
  });

  const [savedTab, setSavedTab] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const handleSave = (tab: string) => {
    if (!isDemo) return;
    setSavedTab(tab);
    window.setTimeout(() => setSavedTab(null), 2400);
  };

  const sendPasswordReset = async () => {
    const email = authUser?.email;
    if (!email) {
      setResetNote("No email on this session.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResetNote(
      error
        ? "Could not send a reset email. Try signing in again from the login page."
        : `Password reset sent to ${email}.`,
    );
  };

  // Identity: demo persona for the sample workspace, real auth user otherwise.
  const nameParts = (authUser?.fullName ?? "").trim().split(/\s+/);
  const profile = isDemo
    ? {
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        email: DEMO_USER.email,
        phone: DEMO_USER.phone,
        title: DEMO_USER.title,
        company: DEMO_USER.company,
        role: DEMO_USER.role,
        plan: DEMO_USER.plan,
      }
    : {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" "),
        email: authUser?.email ?? "",
        phone: "",
        title: "",
        company: org?.name ?? "",
        role: org?.role ?? "member",
        plan: (org?.plan ?? "free").charAt(0).toUpperCase() + (org?.plan ?? "free").slice(1),
      };
  const initials = `${profile.firstName.charAt(0) || "U"}${profile.lastName.charAt(0) || ""}`.toUpperCase();

  const toggleNotification = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  const togglePreference = (key: keyof typeof preferences) =>
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5">
          <User className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-medium text-indigo-300">Account</span>
        </div>
        <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Profile Settings
        </h1>
        <p className="text-lg text-zinc-400">Manage your account settings and preferences.</p>
      </motion.div>

      {/* Identity summary */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
        <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-white/20">
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-violet-600 text-2xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-950 bg-emerald-500">
                  <Check className="h-3 w-3 text-white" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">
                    {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "User"}
                  </h2>
                  <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300">
                    {profile.role}
                  </Badge>
                  <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300">
                    {profile.plan} plan
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                  <Mail className="h-3.5 w-3.5" /> {profile.email}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {isDemo ? `Member since ${DEMO_USER.memberSince}` : `Workspace: ${org?.name ?? "—"}`}
                </p>
              </div>
            </div>
            {isDemo ? (
              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-1 sm:text-right">
                <div>
                  <p className="text-2xl font-bold text-white">47</p>
                  <p className="text-xs text-zinc-500">Campaigns</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">7</p>
                  <p className="text-xs text-zinc-500">Clients</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400">4.2×</p>
                  <p className="text-xs text-zinc-500">Avg ROAS</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-1 sm:text-right">
                <div>
                  <p className="text-2xl font-bold text-white">{org?.memberCount ?? 1}</p>
                  <p className="text-xs text-zinc-500">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white capitalize">{org?.plan ?? "free"}</p>
                  <p className="text-xs text-zinc-500">Plan</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-400 capitalize">{org?.role ?? "member"}</p>
                  <p className="text-xs text-zinc-500">Your role</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 rounded-xl border border-white/10 bg-white/5 p-1">
            {[
              { value: "profile", icon: User, label: "Profile" },
              { value: "notifications", icon: Bell, label: "Notifications" },
              { value: "preferences", icon: Settings, label: "Preferences" },
              { value: "security", icon: Shield, label: "Security" },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value} value={tab.value}
                  className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Profile tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Profile information</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  {isDemo
                    ? "Update your personal information and account details."
                    : "Name and email come from your login. Currency saves on this device and the workspace."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="firstName" label="First name" defaultValue={profile.firstName} />
                  <FormField id="lastName" label="Last name" defaultValue={profile.lastName} />
                </div>
                <FormField id="email" label="Email address" type="email" defaultValue={profile.email} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="phone" label="Phone number" type="tel" defaultValue={profile.phone || undefined} placeholder={isDemo ? undefined : "Not set"} />
                  <FormField id="title" label="Job title" defaultValue={profile.title || undefined} placeholder={isDemo ? undefined : "Not set"} />
                </div>
                <FormField id="company" label="Company / Workspace" defaultValue={profile.company} />
                {isDemo ? (
                <Button
                  onClick={() => handleSave("profile")}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-violet-500"
                >
                  {savedTab === "profile" ? (
                    <><CheckCircle className="mr-2 h-4 w-4" /> Saved!</>
                  ) : (
                    "Save profile changes"
                  )}
                </Button>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Phone, title, and company fields are display-only. They are not stored on this workspace.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Euro or US Dollar</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  Pick the currency used across dashboards, campaigns, and reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CurrencyPicker />
              </CardContent>
            </Card>

            {/* Connected accounts */}
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Globe className="h-5 w-5 text-blue-400" /> Connected accounts
                </CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  {isDemo
                    ? "Platforms linked to your personal account."
                    : "Ad and store connections belong to the workspace, not this login."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {isDemo ? (
                CONNECTED_ACCOUNTS.map((account) => (
                  <div
                    key={account.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ backgroundColor: `${account.color}33`, border: `1px solid ${account.color}66` }}
                      >
                        {account.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{account.name}</p>
                        <p className="text-xs text-zinc-500">{account.detail}</p>
                      </div>
                    </div>
                    {account.connected ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        Linked
                      </Badge>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        className="rounded-lg border-white/15 text-zinc-300 hover:bg-white/10"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                    <p className="text-sm font-medium text-white">Managed at workspace level</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Meta, Google, TikTok, and Woo REST keys live on Connections. This profile does not invent extra accounts.
                    </p>
                    <Link
                      href="/connections"
                      className="mt-3 inline-flex text-sm font-medium text-blue-300 hover:text-blue-200"
                    >
                      Open Connections
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Notification preferences</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  {isDemo
                    ? "Configure how you want to receive notifications."
                    : "Channel email/Slack toggles are not persisted. Alerts land in Notifications when a budget rule or fatigue monitor fires."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <ToggleRow
                    title="Email notifications" description="Receive alerts via email"
                    checked={notifications.email} onChange={() => toggleNotification("email")}
                  />
                  <ToggleRow
                    title="Browser notifications" description="Show desktop notifications in your browser"
                    checked={notifications.browser} onChange={() => toggleNotification("browser")}
                  />
                  <ToggleRow
                    title="Mobile push notifications" description="Receive push notifications on mobile devices"
                    checked={notifications.mobile} onChange={() => toggleNotification("mobile")}
                  />
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-2">
                  <p className="px-3 text-sm font-medium text-white">Notification types</p>
                  <ToggleRow
                    title="Campaign performance alerts" description="Instant alerts on ROAS or CTR shifts"
                    checked={notifications.performanceAlerts} onChange={() => toggleNotification("performanceAlerts")}
                  />
                  <ToggleRow
                    title="Weekly reports" description="Performance summary every Monday"
                    checked={notifications.weeklyReports} onChange={() => toggleNotification("weeklyReports")}
                  />
                  <ToggleRow
                    title="System updates" description="Platform maintenance and new features"
                    checked={notifications.systemUpdates} onChange={() => toggleNotification("systemUpdates")}
                  />
                  <ToggleRow
                    title="Marketing tips" description="Occasional best-practice guides"
                    checked={notifications.marketingTips} onChange={() => toggleNotification("marketingTips")}
                  />
                </div>

                {isDemo ? (
                <Button
                  onClick={() => handleSave("notifications")}
                  variant="outline"
                  className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                >
                  {savedTab === "notifications" ? (
                    <><CheckCircle className="mr-2 h-4 w-4 text-emerald-400" /> Saved!</>
                  ) : (
                    "Save notification preferences"
                  )}
                </Button>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                      <Link href="/notifications">Open Notifications</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                      <Link href="/budget-alerts">Open Budget Alerts</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">User preferences</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  Customize your application experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CurrencyPicker />

                <Separator className="bg-white/10" />

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Theme</label>
                    <Select
                      value={isDemo ? preferences.theme : (mounted && (theme === "light" || theme === "dark" || theme === "system") ? theme : "system")}
                      onValueChange={(value) => {
                        if (isDemo) setPreferences((p) => ({ ...p, theme: value }));
                        else setTheme(value);
                      }}
                    >
                      <SelectTrigger className={inputClasses}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-zinc-900/95 backdrop-blur-xl">
                        <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Light</span></SelectItem>
                        <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Dark</span></SelectItem>
                        <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> System</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Language</label>
                    <Select
                      value={isDemo ? preferences.language : locale}
                      onValueChange={(value) => {
                        if (isDemo) {
                          setPreferences((p) => ({ ...p, language: value }));
                          return;
                        }
                        const next = value === "el" ? "el" : "en";
                        setLocale(next);
                        persistLocale(next);
                      }}
                    >
                      <SelectTrigger className={inputClasses}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-zinc-900/95 backdrop-blur-xl">
                        <SelectItem value="en"><span className="flex items-center gap-2"><Globe className="h-4 w-4" /> English</span></SelectItem>
                        <SelectItem value="el"><span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Ελληνικά</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Timezone</label>
                    {isDemo ? (
                    <Select value={preferences.timezone} onValueChange={(value) => setPreferences((p) => ({ ...p, timezone: value }))}>
                      <SelectTrigger className={inputClasses}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-zinc-900/95 backdrop-blur-xl">
                        <SelectItem value="Europe/Athens">Europe/Athens (GMT+3)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT+1)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (GMT−4)</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles (GMT−7)</SelectItem>
                      </SelectContent>
                    </Select>
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400">
                        Dates use this browser&apos;s local timezone. A workspace timezone is not stored yet.
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="bg-white/10" />

                {isDemo && (
                <div className="space-y-2">
                  <p className="px-3 text-sm font-medium text-white">Dashboard preferences</p>
                  <ToggleRow
                    title="Show welcome message" description="Greeting banner on the dashboard"
                    checked={preferences.welcomeMessage} onChange={() => togglePreference("welcomeMessage")}
                  />
                  <ToggleRow
                    title="Auto-refresh data" description="Live metrics without manual reloads"
                    checked={preferences.autoRefresh} onChange={() => togglePreference("autoRefresh")}
                  />
                  <ToggleRow
                    title="Compact view" description="Denser tables and cards"
                    checked={preferences.compactView} onChange={() => togglePreference("compactView")}
                  />
                </div>
                )}

                {isDemo ? (
                <Button
                  onClick={() => handleSave("preferences")}
                  variant="outline"
                  className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                >
                  {savedTab === "preferences" ? (
                    <><CheckCircle className="mr-2 h-4 w-4 text-emerald-400" /> Saved!</>
                  ) : (
                    "Save preferences"
                  )}
                </Button>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Theme, language, and currency already save in this browser. Compact-view flags are not stored.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Security settings</CardTitle>
                <CardDescription className="text-sm text-zinc-400">
                  Manage your account security and privacy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="font-medium text-white">Two-factor authentication</p>
                      <p className="text-sm text-zinc-400">
                        {isDemo
                          ? "Add an extra layer of security to your account"
                          : "2FA is not configured in this app. Sign-in is email + password via Supabase."}
                      </p>
                      {isDemo && (
                      <Badge variant="outline" className="mt-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        Enabled via authenticator app
                      </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                    disabled={!isDemo}
                  >
                    Configure
                  </Button>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Active sessions</p>
                  {isDemo ? (
                  ACTIVE_SESSIONS.map((session) => {
                    const Icon = session.icon;
                    return (
                      <div
                        key={session.device}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-zinc-400" />
                          <div>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              {session.device}
                              {session.current && (
                                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                                  This device
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {session.location} · {session.browser}
                            </p>
                          </div>
                        </div>
                        {!session.current && (
                          <Button
                            variant="ghost" size="sm"
                            className="rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <LogOut className="mr-1.5 h-4 w-4" /> Revoke
                          </Button>
                        )}
                      </div>
                    );
                  })
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <Laptop className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium text-white">
                            This device
                            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                              Current session
                            </Badge>
                          </p>
                          <p className="text-xs text-zinc-500">Signed in via your workspace account</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="bg-white/10" />

                <div className="flex flex-col gap-3 sm:flex-row">
                  {isDemo ? (
                  <Button variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Key className="mr-2 h-4 w-4" /> Change password
                  </Button>
                  ) : (
                  <Button
                    variant="outline"
                    onClick={() => void sendPasswordReset()}
                    className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10"
                  >
                    <Key className="mr-2 h-4 w-4" /> Email password reset
                  </Button>
                  )}
                  {isDemo ? (
                  <Button variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Download className="mr-2 h-4 w-4" /> Export my data
                  </Button>
                  ) : (
                  <Button asChild variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Link href="/reports"><Download className="mr-2 h-4 w-4" /> Workspace CSV/PDF</Link>
                  </Button>
                  )}
                  <Button asChild variant="outline" className="rounded-xl border-white/15 text-zinc-200 hover:bg-white/10">
                    <Link href="/billing"><CreditCard className="mr-2 h-4 w-4" /> Billing</Link>
                  </Button>
                </div>
                {resetNote && <p className="text-sm text-zinc-400">{resetNote}</p>}

                <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Trash2 className="mt-0.5 h-5 w-5 text-red-400" />
                      <div>
                        <p className="font-medium text-red-300">Delete account</p>
                        <p className="text-sm text-red-400/80">
                          {isDemo
                            ? "Permanently delete your account and all associated data."
                            : "Account deletion is not self-serve. Ask a workspace admin."}
                        </p>
                      </div>
                    </div>
                    <Button variant="destructive" className="rounded-xl" disabled={!isDemo}>
                      Delete account
                    </Button>
                  </div>
                </div>

                {isDemo && (
                  <p className="flex items-center gap-2 text-xs text-zinc-500">
                    <Palette className="h-3.5 w-3.5" />
                    Demo environment — destructive actions are disabled for the investor presentation.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
