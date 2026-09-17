"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Syne } from "next/font/google";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  Loader2,
  PartyPopper,
  Plug,
  Plus,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/components/providers/trpc-provider";
import { useActiveOrg } from "@/hooks/use-active-org";
import { ACTIVE_BRAND_STORAGE_KEY, pickActiveBrandId } from "@/hooks/use-active-brand";
import {
  PROJECT_OBJECTIVES,
  emptyProjectContext,
  type ProjectObjective,
} from "@/lib/project-context";

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"] });

const STEPS = ["Welcome", "Connect", "Context", "Audit", "Done"] as const;
const STEP_ICONS = [Building2, Plug, Sparkles, ClipboardCheck, PartyPopper] as const;

const CONNECT_PLATFORMS = [
  { id: "meta", name: "Meta Ads", hint: "Facebook & Instagram", color: "#1877F2", authPath: "/api/auth/meta", sync: "meta" },
  { id: "google", name: "Google Ads", hint: "Search, Shopping, YouTube", color: "#4285F4", authPath: "/api/auth/google-ads", sync: "google" },
  { id: "tiktok", name: "TikTok Ads", hint: "For Business", color: "#FF0050", authPath: "/api/auth/tiktok", sync: "tiktok" },
  { id: "google-analytics", name: "Google Analytics", hint: "GA4 traffic and conversions", color: "#F97316", authPath: "/api/auth/google-analytics", sync: "google-analytics" },
  { id: "google-search-console", name: "Search Console", hint: "Queries, clicks, impressions", color: "#0EA5E9", authPath: "/api/auth/google-search-console", sync: "google-search-console" },
] as const;

const OBJECTIVE_COPY: Record<ProjectObjective, { label: string; hint: string }> = {
  sales: { label: "Sales", hint: "Purchases and ROAS" },
  leads: { label: "Leads", hint: "Forms and signups" },
  awareness: { label: "Awareness", hint: "Reach and recall" },
  traffic: { label: "Traffic", hint: "Site visits" },
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((label, i) => {
        const Icon = STEP_ICONS[i];
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500",
                  done
                    ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-300"
                    : active
                      ? "border-sky-400 bg-sky-400/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
                      : "border-white/10 text-zinc-600",
                ].join(" ")}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[11px] font-medium ${done ? "text-emerald-400/80" : active ? "text-sky-300" : "text-zinc-600"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 mb-5 h-px w-6 sm:w-10 ${i < current ? "bg-emerald-400/40" : "bg-white/8"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingClient() {
  const { isDemo, isLoading, org } = useActiveOrg();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [brandId, setBrandId] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [newShopWebsite, setNewShopWebsite] = useState("");

  const statusQuery = api.onboarding.getStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });
  const createBrand = api.brands.create.useMutation({
    onSuccess: (brand) => {
      setBrandId(brand.id);
      setNewShopName("");
      setNewShopWebsite("");
      void statusQuery.refetch();
      toast.success(`${brand.name} added — connect ads and Woo for this shop`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [objective, setObjective] = useState<ProjectObjective>("sales");
  const [targetResult, setTargetResult] = useState("");
  const [priorities, setPriorities] = useState("");
  const [constraints, setConstraints] = useState("");
  const [seasonality, setSeasonality] = useState("");
  const [notes, setNotes] = useState("");

  const status = statusQuery.data;
  const shops = useMemo(() => status?.brands ?? [], [status?.brands]);
  const selectedShop = shops.find((b) => b.id === brandId);
  const deskUrl = selectedShop ? `/account-audit?brand=${encodeURIComponent(selectedShop.id)}` : "/account-audit";

  useEffect(() => {
    if (brandId || shops.length === 0) return;
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const fromUrl = params?.get("brand");
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    } catch {
      saved = null;
    }
    const preferred = pickActiveBrandId(shops, fromUrl, saved);
    if (preferred) setBrandId(preferred);
  }, [brandId, shops]);

  useEffect(() => {
    if (!brandId) return;
    try {
      window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, brandId);
    } catch {
      /* ignore */
    }
    const shopCtx = (status?.brandContexts && Object.hasOwn(status.brandContexts, brandId)
      ? status.brandContexts[brandId] : null) ?? emptyProjectContext();
    setObjective(shopCtx.objective);
    setTargetResult(shopCtx.targetResult);
    setPriorities(shopCtx.priorities);
    setConstraints(shopCtx.constraints);
    setSeasonality(shopCtx.seasonality);
    setNotes(shopCtx.notes);
  }, [brandId, status?.brandContexts]);

  const saveContext = api.onboarding.saveContext.useMutation({
    onSuccess: () => {
      void statusQuery.refetch();
      setStep(3);
    },
    onError: (err) => toast.error(err.message),
  });
  const complete = api.onboarding.complete.useMutation({
    onSuccess: () => {
      try {
        window.localStorage.setItem("onboarding-completed", "true");
      } catch {
        /* ignore */
      }
      setStep(4);
    },
    onError: (err) => toast.error(err.message),
  });

  const connected = (status?.connections ?? []).filter((c) => Boolean(selectedShop) && c.brandId === brandId);
  const connectedCount = connected.filter((c) => c.isConnected).length;

  const handleConnect = (authPath: string) => {
    const qs = new URLSearchParams({ return: "/onboarding" });
    if (brandId) qs.set("brand", brandId);
    window.location.href = `${authPath}?${qs.toString()}`;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setStep(1);
  }, []);

  const handleSaveContext = () => {
    if (!selectedShop) {
      toast.error("Select an owned shop before saving context.");
      return;
    }
    if (!targetResult.trim() && !priorities.trim()) {
      toast.error("Add a target result or priorities for this shop. These are operator inputs, not validated KPIs.");
      return;
    }
    saveContext.mutate({
      brandId: selectedShop.id,
      objective,
      targetResult,
      priorities,
      constraints,
      seasonality,
      notes,
    });
  };

  const handleFinish = () => {
    complete.mutate();
  };

  if (isLoading || statusQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <Card className="overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" />
          <CardContent className="px-6 pb-8 pt-8 sm:px-10">
            <div className="mb-10">
              <StepIndicator current={step} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                {step === 0 && (
                  <div className="space-y-6 text-center">
                    <h2 className={`text-3xl font-extrabold text-white ${syne.className}`}>
                      Your ads desk, in one loop
                    </h2>
                    <p className="mx-auto max-w-lg text-sm leading-relaxed text-zinc-400">
                      Select a shop, review its connections and save its business context. Then inspect exact-account evidence in the Performance Marketing Desk. Setup alone does not verify data coverage or authorize campaign actions. The Demo workspace is StyleVault sample data only.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Workspace: {isDemo ? "Demo (StyleVault sample, read-only)" : org?.name ?? "Your brand"}
                    </p>
                    <Button
                      onClick={() => setStep(1)}
                      className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-8 text-sm font-semibold text-white"
                    >
                      Start first session <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <h2 className={`text-2xl font-extrabold text-white ${syne.className}`}>Shop & connect</h2>
                    <p className="text-sm text-zinc-400">
                      Pick a shop or add the next e-shop. Ads tokens and Woo sync attach to that shop only.
                    </p>
                    {shops.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {shops.map((shop) => (
                          <button
                            key={shop.id}
                            type="button"
                            onClick={() => setBrandId(shop.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                              shop.id === brandId
                                ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                                : "border-white/10 text-zinc-400"
                            }`}
                          >
                            {shop.name}
                            {shop.connectedCount > 0 ? ` · ${shop.connectedCount}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={newShopName}
                        onChange={(e) => setNewShopName(e.target.value)}
                        placeholder="New shop name"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                      />
                      <input
                        value={newShopWebsite}
                        onChange={(e) => setNewShopWebsite(e.target.value)}
                        placeholder="https://shop.example"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                      />
                      <Button
                        type="button"
                        disabled={createBrand.isPending || newShopName.trim().length < 2 || isDemo}
                        onClick={() =>
                          createBrand.mutate({
                            name: newShopName.trim(),
                            website: newShopWebsite.trim() || undefined,
                          })
                        }
                        className="rounded-xl bg-white/10 text-sm text-white"
                      >
                        {createBrand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add shop
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {CONNECT_PLATFORMS.map((p) => {
                        const row = connected.find((c) => c.platform === p.id && c.isConnected);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white">{p.name}</p>
                              <p className="truncate text-xs text-zinc-500">{row ? row.name : p.hint}</p>
                            </div>
                            {row ? (
                              <span className="text-[11px] font-bold uppercase text-emerald-400">Connected</span>
                            ) : (
                              <button
                                type="button"
                                disabled={!selectedShop || isDemo}
                                onClick={() => handleConnect(p.authPath)}
                                className="text-xs font-semibold text-sky-300 hover:underline disabled:opacity-40"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {brandId && !isDemo && !connected.some((c) => c.platform === "woocommerce" && c.isConnected) && (
                      <a href={`/connections?brand=${brandId}&connect=woocommerce`} className="block text-xs font-semibold text-sky-300">
                        Connect WooCommerce for {selectedShop?.name}
                      </a>
                    )}
                    {brandId && !isDemo && connected.some((c) => c.platform === "woocommerce" && c.isConnected) && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        WooCommerce connected for {selectedShop?.name}
                      </p>
                    )}
                    {isDemo && (
                      <p className="text-xs text-amber-300/80">Demo workspace cannot store live tokens. Switch to your real workspace for live shops.</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400">
                        Skip for now
                      </Button>
                      <Button
                        onClick={() => setStep(2)}
                        className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-sm font-semibold text-white"
                      >
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <h2 className={`text-2xl font-extrabold text-white ${syne.className}`}>Project setup</h2>
                    <p className="text-sm text-zinc-400">
                      Business context for {selectedShop?.name ?? "an owned shop"}. These are operator inputs, not measured results or validated commercial targets. Missing shop context never uses another shop’s saved goals.
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PROJECT_OBJECTIVES.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setObjective(id)}
                          className={`rounded-xl border p-3 text-left ${
                            objective === id ? "border-sky-400/40 bg-sky-400/10" : "border-white/10"
                          }`}
                        >
                          <p className="text-sm font-semibold text-white">{OBJECTIVE_COPY[id].label}</p>
                          <p className="text-[11px] text-zinc-500">{OBJECTIVE_COPY[id].hint}</p>
                        </button>
                      ))}
                    </div>
                    <input
                      value={targetResult}
                      onChange={(e) => setTargetResult(e.target.value)}
                      placeholder="Target result — e.g. 3x ROAS, 40 leads / week"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-500/50"
                    />
                    <textarea
                      value={priorities}
                      onChange={(e) => setPriorities(e.target.value)}
                      rows={2}
                      placeholder="Priorities — what must the AI protect or grow first?"
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <textarea
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      rows={2}
                      placeholder="Constraints — budget cap, brand rules, no discounting…"
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <input
                      value={seasonality}
                      onChange={(e) => setSeasonality(e.target.value)}
                      placeholder="Seasonality / promotions"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Anything else the next audit should know"
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <Button variant="outline" onClick={() => setStep(3)} className="w-full border-white/15 text-zinc-300">
                      Review audit readiness without saving
                    </Button>
                    <div className="flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400">Back</Button>
                      <Button
                        onClick={handleSaveContext}
                        disabled={saveContext.isPending || !selectedShop}
                        className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-sm font-semibold text-white"
                      >
                        {saveContext.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save context"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <h2 className={`text-2xl font-extrabold text-white ${syne.className}`}>Review account evidence</h2>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-zinc-300">
                      <p>Legacy Quick Audit is retired. There is no account-performance verdict on this setup page.</p>
                      <p className="mt-2 text-xs text-zinc-400">The Performance Marketing Desk requires an exact account, currency and completed current / comparison periods. Missing evidence stays unverified; generic conversions are not verified purchases.</p>
                    </div>
                    <div className="space-y-2 text-xs text-zinc-400">
                      <p>Shop: {selectedShop?.name ?? "No owned shop selected"}</p>
                      <p>Connection descriptors for this shop: {connectedCount}. Connected does not certify provider health or period coverage.</p>
                      <p>Saved context for this shop: {selectedShop?.contextComplete ? "goal or priorities supplied" : "missing or incomplete"}. Context is not action permission.</p>
                      <p>Workspace stored performance rows: {status?.hasPerformance ? "present" : "not present"}. This is not selected-account or selected-period coverage.</p>
                    </div>
                    <Link href={deskUrl} className="inline-flex rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-200">
                      Open Performance Marketing Desk
                    </Link>
                    <div className="flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400">Back</Button>
                      <Button
                        onClick={handleFinish}
                        disabled={complete.isPending}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-sm font-semibold text-white"
                      >
                        {complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Finish setup <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="rounded-full border border-emerald-400/30 bg-emerald-500/15 p-6">
                      <PartyPopper className="h-10 w-10 text-emerald-300" />
                    </div>
                    <h2 className={`text-3xl font-extrabold text-white ${syne.className}`}>Setup completed — not campaign action readiness</h2>
                    <p className="max-w-md text-sm text-zinc-400">
                      Review exact-account evidence before discussing campaign changes. Google and TikTok remain read-only. Supported Meta existing-object changes require account-scoped UI confirmation and an audit log; campaign creation is not enabled.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={() => router.push("/dashboard")}
                        variant="outline"
                        className="rounded-xl border-white/15 text-white"
                      >
                        Open dashboard
                      </Button>
                      <Button
                        onClick={() => router.push("/campaign-launcher")}
                        className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-sm font-semibold text-white"
                      >
                        <Rocket className="mr-2 h-4 w-4" /> Open Campaign Studio (planning only)
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
          <div className="border-t border-white/[0.06] px-6 py-3 text-center text-[11px] text-zinc-600">
            {isDemo ? "Demo workspace is StyleVault sample data — switch to your real workspace for live shops." : "Setup is not action readiness. Google / TikTok are read-only; supported Meta changes require scoped confirmation."}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
