"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  BellRing,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Bell,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useCurrency } from "@/components/providers/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertRule = {
  id: string;
  organizationId: string;
  brandId: string | null;
  platform: string | null;
  thresholdAmount: number | { toNumber: () => number };
  period: string;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

type TriggeredAlert = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data: Record<string, unknown>;
  createdAt: Date;
};

function thresholdNum(v: number | { toNumber: () => number }): number {
  return typeof v === "number" ? v : v.toNumber();
}

const PLATFORM_OPTIONS = [
  { value: "", label: "All platforms" },
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
] as const;

const PERIOD_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" as const },
});

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-300"
      style={{ backgroundColor: on ? "#fb923c" : "rgba(255,255,255,0.08)" }}
    >
      <span
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: on ? 26 : 4 }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BudgetAlertsPage() {
  const { isLoading } = useActiveOrg();
  const { formatExact, symbol } = useCurrency();

  const utils = api.useUtils();

  // Queries
  const { data: rules, isLoading: rulesLoading } = api.alerts.listRules.useQuery();
  const { data: triggered, isLoading: triggeredLoading } = api.alerts.listTriggered.useQuery();

  // Mutations
  const createRule = api.alerts.createRule.useMutation({
    onSuccess: () => {
      toast.success("Alert rule created");
      utils.alerts.listRules.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message || "Failed to create rule"),
  });

  const updateRule = api.alerts.updateRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to update rule"),
  });

  const deleteRule = api.alerts.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Alert rule deleted");
      utils.alerts.listRules.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to delete rule"),
  });

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formThreshold, setFormThreshold] = useState("");
  const [formPeriod, setFormPeriod] = useState<"daily" | "weekly">("daily");
  const [formPlatform, setFormPlatform] = useState("");
  const [formBrandId, setFormBrandId] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  function resetForm() {
    setFormThreshold("");
    setFormPeriod("daily");
    setFormPlatform("");
    setFormBrandId("");
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(formThreshold);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid threshold amount");
      return;
    }
    createRule.mutate({
      thresholdAmount: amount,
      period: formPeriod,
      platform: formPlatform || undefined,
      brandId: formBrandId || undefined,
    });
  }

  function handleToggle(rule: AlertRule) {
    updateRule.mutate({ id: rule.id, isActive: !rule.isActive });
  }

  function handleDelete(id: string) {
    deleteRule.mutate({ id });
  }

  const activeCount = rules?.filter((r) => r.isActive).length ?? 0;

  return (
    <div className="relative">
      {/* Background glow */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <motion.div
          {...fadeUp()}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-orange-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                Budget guardrails
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Budget{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Alerts
              </span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Monitor spend thresholds and receive alerts when budgets are exceeded.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              {activeCount} active rule{activeCount !== 1 ? "s" : ""} · checked hourly
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Create Alert
            </button>
          </div>
        </motion.div>

        {/* Alert Rules */}
        <motion.div
          {...fadeUp(0.1)}
          className="border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl"
        >
          <div className="mb-5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Alert Rules</h2>
          </div>

          {rulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : !rules?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm font-medium text-zinc-400">No alert rules yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Create a rule to get notified when spend exceeds your threshold.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rules.map((rule, i) => {
                const threshold = thresholdNum(rule.thresholdAmount);
                return (
                  <motion.div
                    key={rule.id}
                    {...fadeUp(0.15 + i * 0.05)}
                    className="rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-white/15"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                          <BellRing className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-medium capitalize text-zinc-400">
                          {rule.period}
                        </span>
                      </div>
                      <Toggle on={rule.isActive} onToggle={() => handleToggle(rule as AlertRule)} />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white tabular-nums">
                      {formatExact(threshold)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">threshold</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rule.platform && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium capitalize text-zinc-300">
                          {rule.platform}
                        </span>
                      )}
                      {rule.brandId && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                          Brand: {rule.brandId.slice(0, 8)}…
                        </span>
                      )}
                      {!rule.platform && !rule.brandId && (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          All accounts
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-[10px] text-zinc-500">
                        {rule.lastTriggeredAt
                          ? `Last triggered ${formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true })}`
                          : "Never triggered"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Triggered Alerts */}
        <motion.div
          {...fadeUp(0.3)}
          className="border border-white/10 bg-white/5 p-6 backdrop-blur-xl rounded-2xl"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h2 className="text-base font-semibold text-white">Recent Alerts</h2>
            </div>
            <span className="text-xs text-zinc-500">
              {triggered?.length ?? 0} notification{(triggered?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>

          {triggeredLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
            </div>
          ) : !triggered?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-10 w-10 text-zinc-600 mb-3" />
              <p className="text-sm font-medium text-zinc-400">No triggered alerts</p>
              <p className="mt-1 text-xs text-zinc-500">
                When a budget threshold is exceeded, notifications will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {triggered.map((alert, i) => {
                const alertData = alert.data as Record<string, unknown>;
                return (
                  <motion.div
                    key={alert.id}
                    {...fadeUp(0.35 + i * 0.03)}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      alert.isRead
                        ? "border-white/5 bg-white/[0.02]"
                        : "border-amber-400/20 bg-amber-400/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                          alert.isRead ? "bg-zinc-600" : "bg-amber-400 animate-pulse"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {alert.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-zinc-500">
                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {alert.message}
                        </p>
                        {alertData.spend != null && alertData.threshold != null && (
                          <div className="mt-2 flex items-center gap-3 text-[10px]">
                            <span className="rounded-full bg-rose-400/10 px-2 py-0.5 font-medium text-rose-300">
                              Spent: {formatExact(Number(alertData.spend))}
                            </span>
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-medium text-zinc-400">
                              Limit: {formatExact(Number(alertData.threshold))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Alert Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-gray-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create Budget Alert</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Get notified when daily or weekly spend exceeds your threshold.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Threshold Amount ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                placeholder="e.g. 500"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Period
              </label>
              <select
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value as "daily" | "weekly")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-gray-950">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Platform Filter (optional)
              </label>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              >
                {PLATFORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-gray-950">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Brand ID (optional)
              </label>
              <input
                type="text"
                value={formBrandId}
                onChange={(e) => setFormBrandId(e.target.value)}
                placeholder="Leave empty for all brands"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRule.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:brightness-110 disabled:opacity-50"
              >
                {createRule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
