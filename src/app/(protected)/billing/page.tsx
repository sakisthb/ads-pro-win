"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, ArrowRight, Calendar, Check, CreditCard, Download, Globe, Receipt,
  Sparkles, Target, TrendingUp, Users, X, Bell, Plug,
} from "lucide-react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { api } from "@/components/providers/trpc-provider";

/* ------------------------------ Demo data --------------------------------- */

type PlanId = "free" | "starter" | "professional" | "enterprise";

interface UsageEntry {
  key: string;
  label: string;
  current: number;
  limit: number;
  icon: typeof Users;
  /** Complete Tailwind class applied to the Progress indicator. */
  barClass: string;
}

const USAGE: UsageEntry[] = [
  { key: "users", label: "Team members", current: 16, limit: 20, icon: Users, barClass: "[&>div]:bg-blue-500" },
  { key: "campaigns", label: "Campaigns", current: 47, limit: 999, icon: Target, barClass: "[&>div]:bg-violet-500" },
  { key: "platforms", label: "Connected platforms", current: 4, limit: 5, icon: Globe, barClass: "[&>div]:bg-emerald-500" },
  { key: "clients", label: "Client workspaces", current: 7, limit: 10, icon: Users, barClass: "[&>div]:bg-amber-500" },
];

const PLANS: {
  plan: PlanId; name: string; monthly: number; yearly: number; description: string;
  popular: boolean; features: { users: string; campaigns: string; platforms: string; ai: boolean; whiteLabel: boolean; api: boolean };
}[] = [
  {
    plan: "free", name: "Free", monthly: 0, yearly: 0, description: "Ideal for trying things out", popular: false,
    features: { users: "1 user", campaigns: "3 campaigns", platforms: "1 platform", ai: false, whiteLabel: false, api: false },
  },
  {
    plan: "starter", name: "Starter", monthly: 29, yearly: 23, description: "For small agencies & freelancers", popular: true,
    features: { users: "5 users", campaigns: "25 campaigns", platforms: "3 platforms", ai: false, whiteLabel: false, api: true },
  },
  {
    plan: "professional", name: "Professional", monthly: 99, yearly: 79, description: "For growing agencies", popular: false,
    features: { users: "20 users", campaigns: "Unlimited", platforms: "All platforms", ai: true, whiteLabel: false, api: true },
  },
  {
    plan: "enterprise", name: "Enterprise", monthly: 299, yearly: 239, description: "For large organizations", popular: false,
    features: { users: "Unlimited", campaigns: "Unlimited", platforms: "All platforms", ai: true, whiteLabel: true, api: true },
  },
];

const INVOICES = [
  { id: "INV-2026-014", date: "01 Aug 2026", amount: "€99.00", status: "Paid", plan: "Professional" },
  { id: "INV-2026-013", date: "01 Jul 2026", amount: "€99.00", status: "Paid", plan: "Professional" },
  { id: "INV-2026-012", date: "01 Jun 2026", amount: "€99.00", status: "Paid", plan: "Professional" },
  { id: "INV-2026-011", date: "01 May 2026", amount: "€29.00", status: "Paid", plan: "Starter" },
  { id: "INV-2026-010", date: "01 Apr 2026", amount: "€29.00", status: "Paid", plan: "Starter" },
  { id: "INV-2026-009", date: "01 Mar 2026", amount: "€29.00", status: "Refunded", plan: "Starter" },
];

const SPEND_HISTORY = [
  { month: "Mar", Meta: 4200, Google: 3100, TikTok: 1400, WooCommerce: 0 },
  { month: "Apr", Meta: 4800, Google: 3600, TikTok: 1900, WooCommerce: 800 },
  { month: "May", Meta: 5300, Google: 3900, TikTok: 2300, WooCommerce: 950 },
  { month: "Jun", Meta: 6100, Google: 4400, TikTok: 2600, WooCommerce: 1200 },
  { month: "Jul", Meta: 6800, Google: 5100, TikTok: 3100, WooCommerce: 1350 },
  { month: "Aug", Meta: 7400, Google: 5600, TikTok: 3500, WooCommerce: 1500 },
];

const PLATFORM_COLORS: Record<string, string> = {
  Meta: "#1877F2",
  Google: "#4285F4",
  TikTok: "#FF0050",
  WooCommerce: "#96588A",
};

/* --------------------------------- Page ----------------------------------- */

export default function BillingPage() {
  const { isDemo, isLoading, org } = useActiveOrg();

  const [currentPlan, setCurrentPlan] = useState<PlanId>("professional");
  const [yearly, setYearly] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState<PlanId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const usageQuery = api.organizations.getWorkspaceUsage.useQuery(undefined, {
    enabled: !isDemo && !isLoading,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    const orgPlan = org?.plan ?? usageQuery.data?.plan ?? "free";
    const planMeta = PLANS.find((p) => p.plan === orgPlan);
    const usage = usageQuery.data;
    const platformLabel =
      usage?.connectedPlatforms.length
        ? usage.connectedPlatforms.join(" · ")
        : "None connected";

    const liveUsage = [
      {
        key: "users",
        label: "Team members",
        value: usage?.memberCount ?? 0,
                    hint: "Seats on this workspace",
        icon: Users,
      },
      {
        key: "brands",
        label: "Brands",
        value: usage?.brandCount ?? 0,
        hint: "Stores / brands under this org",
        icon: Globe,
      },
      {
        key: "campaigns",
        label: "Synced campaigns",
        value: usage?.campaignCount ?? 0,
        hint: "AdCampaign rows from connected accounts",
        icon: Target,
      },
      {
        key: "alerts",
        label: "Budget alert rules",
        value: usage?.alertRuleCount ?? 0,
        hint: "Rules on Budget Alerts",
        icon: Bell,
      },
    ];

    return (
      <div className="space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">Subscription & usage</span>
          </div>
          <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Billing
          </h1>
          <p className="text-lg text-zinc-400">
            Workspace usage for this org. Invoices and checkout are not in Ads Pro.
          </p>
        </motion.div>

        {/* Current plan — sourced from the active organization */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
          <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/5 to-blue-500/15 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-2.5 shadow-lg">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Current plan</p>
                    <h2 className="text-2xl font-bold capitalize text-white">{orgPlan}</h2>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-zinc-400">
                  {planMeta?.description ?? "Subscription for this workspace"}
                  {org?.name ? ` · ${org.name}` : ""}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {liveUsage.map((entry) => {
              const Icon = entry.icon;
              return (
                <Card key={entry.key} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <Icon className="h-4 w-4 text-zinc-300" />
                    </div>
                    {usageQuery.isLoading ? (
                      <span className="h-7 w-10 animate-pulse rounded bg-white/10" />
                    ) : (
                      <span className="text-2xl font-bold tabular-nums text-white">{entry.value}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{entry.hint}</p>
                </Card>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <Plug className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">Connected platforms</h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {usageQuery.isLoading
                    ? "Loading connection state…"
                    : `${usage?.connectedAccountCount ?? 0} account${(usage?.connectedAccountCount ?? 0) === 1 ? "" : "s"} · ${platformLabel}. OAuth needs a token with a future expiry; Woo uses a REST key with no expiry.`}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
          <Card className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white">Billing is managed externally</h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  Invoices, payment methods, and plan changes are not stored in this app. There is no Stripe checkout here. Seat and connection counts above are live workspace rows, not a billed quota.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const currentPlanData = PLANS.find((p) => p.plan === currentPlan)!;

  const handleUpgrade = (plan: PlanId) => {
    const target = PLANS.find((p) => p.plan === plan)!;
    setIsLoadingPlan(plan);
    // Simulated checkout — demo mode only, no external payment calls.
    window.setTimeout(() => {
      setCurrentPlan(plan);
      setIsLoadingPlan(null);
      notify(`Successfully switched to the ${target.name} plan! 🎉`);
    }, 1600);
  };

  const getUsagePercentage = (current: number, limit: number) =>
    limit >= 999 ? 8 : Math.min((current / limit) * 100, 100);

  const formatLimit = (limit: number) => (limit >= 999 ? "Unlimited" : String(limit));

  const nearLimit = USAGE.some((u) => u.limit < 999 && (u.current / u.limit) * 100 >= 80);

  return (
    <div className="space-y-8">
      {/* Inline toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 shadow-2xl backdrop-blur-xl"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">{toast}</span>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
          <CreditCard className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">Subscription & usage</span>
        </div>
        <h1 className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Billing
        </h1>
        <p className="text-lg text-zinc-400">
          Manage your subscription, track usage and download invoices.
        </p>
      </motion.div>

      {/* Current plan hero */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
        <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/5 to-blue-500/15 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 p-2.5 shadow-lg">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Current plan</p>
                  <h2 className="text-2xl font-bold text-white">{currentPlanData.name}</h2>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  Active
                </Badge>
              </div>
              <p className="text-sm text-zinc-400">{currentPlanData.description}</p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Next charge: 01 Sep 2026
                </span>
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4" /> Invoices: 6 this year
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-white">
                €{yearly ? currentPlanData.yearly : currentPlanData.monthly}
                {currentPlanData.monthly > 0 && (
                  <span className="text-base font-normal text-zinc-400">/month</span>
                )}
              </p>
              {yearly && currentPlanData.monthly > 0 && (
                <p className="mt-1 text-sm text-emerald-400">
                  Saving €{((currentPlanData.monthly - currentPlanData.yearly) * 12).toFixed(0)} per year
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setYearly(false)}
                  className={`rounded-xl ${!yearly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/15 text-zinc-400 hover:bg-white/10"}`}
                >
                  Monthly
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setYearly(true)}
                  className={`rounded-xl ${yearly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/15 text-zinc-400 hover:bg-white/10"}`}
                >
                  Yearly −20%
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Usage + spend chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-white">Resource usage</CardTitle>
              <CardDescription className="text-sm text-zinc-400">
                How close you are to your plan limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {USAGE.map((entry) => {
                const Icon = entry.icon;
                const pct = getUsagePercentage(entry.current, entry.limit);
                const danger = entry.limit < 999 && pct >= 80;
                return (
                  <div key={entry.key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <Icon className="h-4 w-4 text-zinc-500" />
                        {entry.label}
                      </span>
                      <span className={`font-medium ${danger ? "text-amber-400" : "text-white"}`}>
                        {entry.key === "campaigns" ? entry.current : entry.current} / {formatLimit(entry.limit)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 bg-white/10 ${entry.barClass}`}
                    />
                  </div>
                );
              })}

              {nearLimit && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  You are approaching your client workspace limit. Consider upgrading to Enterprise
                  for unlimited clients.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
          <Card className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Managed ad spend by platform
              </CardTitle>
              <CardDescription className="text-sm text-zinc-400">
                Last 6 months · €37,700 under management
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SPEND_HISTORY} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      backgroundColor: "rgba(24,24,27,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                  {Object.keys(PLATFORM_COLORS).map((platform) => (
                    <Bar key={platform} dataKey={platform} stackId="spend" fill={PLATFORM_COLORS[platform]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Available plans */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Available plans</h2>
          <Badge variant="outline" className="border-white/15 bg-white/5 text-zinc-400">
            Billed {yearly ? "yearly" : "monthly"}
          </Badge>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.plan === currentPlan;
            const price = yearly ? plan.yearly : plan.monthly;
            return (
              <Card
                key={plan.plan}
                className={`relative rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${
                  isCurrent
                    ? "border-blue-500/60 bg-blue-500/10 shadow-xl shadow-blue-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg">
                      Popular
                    </Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-3">
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg">
                      Current
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold text-white">
                    €{price}
                    {price > 0 && <span className="text-base font-normal text-zinc-400">/mo</span>}
                  </div>
                  <CardDescription className="text-xs text-zinc-400">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Users className="h-4 w-4 text-zinc-500" /> {plan.features.users}
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Target className="h-4 w-4 text-zinc-500" /> {plan.features.campaigns}
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Globe className="h-4 w-4 text-zinc-500" /> {plan.features.platforms}
                    </div>
                    {[
                      { label: "AI Predictions", included: plan.features.ai },
                      { label: "White label", included: plan.features.whiteLabel },
                      { label: "API access", included: plan.features.api },
                    ].map((feature) => (
                      <div key={feature.label} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-600" />
                        )}
                        <span className={feature.included ? "text-zinc-300" : "text-zinc-500 line-through"}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-white/10" />

                  {isCurrent ? (
                    <Button disabled className="w-full rounded-xl border border-white/10 bg-white/5 text-zinc-400">
                      <Check className="mr-2 h-4 w-4" /> Current plan
                    </Button>
                  ) : plan.plan === "free" ? (
                    <Button
                      variant="outline" className="w-full rounded-xl border-white/15 text-zinc-300 hover:bg-white/10"
                      onClick={() => handleUpgrade(plan.plan)} disabled={isLoadingPlan !== null}
                    >
                      Downgrade to Free
                    </Button>
                  ) : (
                    <Button
                      className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-violet-500"
                      onClick={() => handleUpgrade(plan.plan)} disabled={isLoadingPlan !== null}
                    >
                      {isLoadingPlan === plan.plan ? (
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Payment method + invoice history */}
      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
          <Card className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <CreditCard className="h-5 w-5 text-blue-400" /> Payment method
            </h2>
            <p className="mb-5 mt-1 text-sm text-zinc-400">Manage how you pay for your subscription.</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-bold text-white shadow-lg">
                    VISA
                  </div>
                  <div>
                    <p className="font-medium text-white">Visa ending in 4242</p>
                    <p className="text-xs text-zinc-500">Expires 12/2027</p>
                  </div>
                </div>
                <Button
                  variant="outline" size="sm"
                  className="rounded-lg border-white/15 text-zinc-300 hover:bg-white/10"
                  onClick={() => notify("Payment method editor opened (demo)")}
                >
                  Edit
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-zinc-500">Next charge</p>
                  <p className="mt-1 font-medium text-white">01 Sep 2026</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-zinc-500">Amount (incl. 24% VAT)</p>
                  <p className="mt-1 font-medium text-white">
                    €{((yearly ? currentPlanData.yearly : currentPlanData.monthly) * 1.24).toFixed(2)}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full rounded-xl border-white/15 text-zinc-300 hover:bg-white/10"
                onClick={() => notify("Billing portal opened (demo)")}
              >
                Manage billing portal
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.34 }} className="lg:col-span-3"
        >
          <Card className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Receipt className="h-5 w-5 text-violet-400" /> Invoice history
              </h2>
              <Badge variant="outline" className="border-white/15 bg-white/5 text-zinc-400">
                {INVOICES.length} invoices
              </Badge>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-zinc-300">{invoice.id}</td>
                      <td className="px-4 py-3 text-zinc-400">{invoice.date}</td>
                      <td className="px-4 py-3 text-zinc-300">{invoice.plan}</td>
                      <td className="px-4 py-3 font-medium text-white">{invoice.amount}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            invoice.status === "Paid"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                          onClick={() => notify(`Downloading ${invoice.id}.pdf (demo)`)}
                          aria-label={`Download ${invoice.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Invoices are generated automatically on the 1st of each billing cycle and emailed to
              billing@adspro.com.
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
