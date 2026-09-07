"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Plug,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveOrg } from "@/hooks/use-active-org";
import { ACTIVE_BRAND_STORAGE_KEY, pickActiveBrandId } from "@/hooks/use-active-brand";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { consumeLaunchDraft } from "@/lib/creative-fatigue";
import { useCurrency } from "@/components/providers/currency";
import type { LaunchObjective, LaunchPlatform } from "@/lib/platform-launch/mapping";
import { canSubmitLaunch } from "@/lib/platform-launch/mapping";

type StudioMode = "create" | "launch" | "automation" | "scale";

const STEPS = [
  { id: 1, label: "Platform", icon: Layers },
  { id: 2, label: "Audience", icon: Users },
  { id: 3, label: "Creative", icon: ImageIcon },
  { id: 4, label: "Budget", icon: Wallet },
  { id: 5, label: "Review", icon: Rocket },
];

const OBJECTIVES: { id: LaunchObjective; label: string; hint: string }[] = [
  { id: "sales", label: "Sales", hint: "Purchases · catalog" },
  { id: "traffic", label: "Traffic", hint: "Site visits" },
  { id: "awareness", label: "Awareness", hint: "Reach" },
  { id: "leads", label: "Leads", hint: "Forms & signups" },
  { id: "engagement", label: "Engagement", hint: "Social proof" },
];

const COUNTRY_OPTIONS = ["GR", "CY", "DE", "AT", "CH", "US", "GB", "FR", "IT", "NL"];
const CTA_OPTIONS = ["Shop Now", "Learn More", "Sign Up", "Book Now"];

const PLATFORM_META: Record<LaunchPlatform, { name: string; color: string }> = {
  meta: { name: "Meta", color: "#1877F2" },
  google: { name: "Google", color: "#4285F4" },
  tiktok: { name: "TikTok", color: "#FF0050" },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: "easeOut" as const },
});

function withHttps(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function CampaignLauncherStudio() {
  const { isDemo, isLoading } = useActiveOrg();
  const { format, symbol } = useCurrency();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<StudioMode>(() => {
    const q = searchParams.get("mode");
    if (q === "create" || q === "launch" || q === "automation" || q === "scale") return q;
    return "create";
  });
  const [step, setStep] = useState(1);
  const [fromFatigue, setFromFatigue] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<LaunchObjective>("sales");
  const [platforms, setPlatforms] = useState<LaunchPlatform[]>(["meta"]);
  const [brandId, setBrandId] = useState("");
  const [accountIds, setAccountIds] = useState<Partial<Record<LaunchPlatform, string>>>({});
  const [countries, setCountries] = useState<string[]>(["GR", "DE"]);
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(54);
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [cta, setCta] = useState("Shop Now");
  const [landingUrl, setLandingUrl] = useState("");
  const [pageId, setPageId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [budget, setBudget] = useState("80");
  const [goLive, setGoLive] = useState(false);
  const [includeAd, setIncludeAd] = useState(true);
  const [hypothesis, setHypothesis] = useState("");
  const [pending, setPending] = useState<
    | { kind: "launch" }
    | { kind: "status"; platform: LaunchPlatform; campaignId: string; status: "PAUSED" | "ACTIVE" }
    | {
        kind: "scale";
        platform: LaunchPlatform;
        campaignId: string;
        multiplier: number;
        currentDailyBudget?: number;
      }
    | null
  >(null);

  useEffect(() => {
    const draft = consumeLaunchDraft();
    if (!draft) return;
    setName(draft.name);
    setPrimaryText(draft.description);
    setPrompt(draft.description);
    setFromFatigue(true);
    setMode("launch");
  }, []);

  const contextQuery = api.campaigns.getLaunchContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const ctx = contextQuery.data;
  const brands = ctx?.brands ?? [];
  const shopConnections = (ctx?.connections ?? []).filter((c) => !brandId || c.brandId === brandId);
  const connections = shopConnections;
  const products = (ctx?.products ?? []).filter((p) => !brandId || p.brandId === brandId);
  const drafts = ctx?.drafts ?? [];
  const metaAccountId = accountIds.meta || shopConnections.find((c) => c.platform === "meta")?.id;
  const assetsQuery = api.campaigns.getMetaAssets.useQuery(
    { adAccountId: metaAccountId },
    { enabled: Boolean(metaAccountId) && !isDemo, retry: false },
  );
  const syncedQuery = api.marketing.getCampaignPerformance.useQuery(
    { limit: 30, brandId: brandId || undefined },
    { enabled: (mode === "scale" || mode === "automation" || mode === "launch") && Boolean(brandId || isDemo), retry: false },
  );

  const generatePlan = api.campaigns.generatePlan.useMutation({
    onSuccess: (plan) => {
      setName(plan.name);
      setHypothesis(plan.hypothesis);
      setObjective(plan.objective);
      setPlatforms(plan.platforms);
      setCountries(plan.audience.countries);
      setAgeMin(plan.audience.ageMin);
      setAgeMax(plan.audience.ageMax);
      setBudget(String(Math.round(plan.suggestedDailyBudget)));
      const first = plan.creatives[0];
      if (first) {
        setHeadline(first.headline);
        setPrimaryText(first.primaryText);
        setCta(first.cta);
        if (first.landingUrl) setLandingUrl(first.landingUrl);
      }
      setMode("automation");
      setStep(5);
      toast.success("Plan ready — review the hierarchy, then apply paused");
    },
    onError: (err) => toast.error(err.message),
  });

  const launch = api.campaigns.launch.useMutation({
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok);
      const fail = res.results.filter((r) => !r.ok);
      if (ok.length) toast.success(`Launched on ${ok.map((r) => r.platform).join(", ")}`);
      if (fail.length) toast.error(fail.map((r) => r.message).join(" · "));
      contextQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const liveStatus = api.campaigns.updateLiveStatus.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });
  const scaleBudget = api.campaigns.scaleBudget.useMutation({
    onSuccess: (res) => toast.success(res.message),
    onError: (err) => toast.error(err.message),
  });

  const pages = assetsQuery.data?.pages ?? [];
  const pixels = assetsQuery.data?.pixels ?? [];
  const synced = syncedQuery.data?.data?.campaigns ?? [];

  useEffect(() => {
    if (brandId || brands.length === 0) return;
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    } catch {
      saved = null;
    }
    const preferred = pickActiveBrandId(brands, null, saved);
    if (preferred) setBrandId(preferred);
  }, [brandId, brands]);

  useEffect(() => {
    if (!brandId) return;
    try {
      window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, brandId);
    } catch {
      /* ignore */
    }
    const b = brands.find((x) => x.id === brandId);
    if (b?.website) setLandingUrl(b.website);
    const nextIds: Partial<Record<LaunchPlatform, string>> = {};
    for (const c of shopConnections) {
      if (c.isConnected) nextIds[c.platform] = c.id;
    }
    setAccountIds(nextIds);
    const shopCtx = ctx?.brandContexts?.[brandId] ?? ctx?.projectContext;
    if (shopCtx?.objective) {
      setObjective((current) => (current === "sales" ? shopCtx.objective : current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, ctx?.connections, ctx?.brandContexts]);

  useEffect(() => {
    if (pages[0] && !pageId) setPageId(pages[0].id);
    if (pixels[0] && !pixelId) setPixelId(pixels[0].id);
  }, [pages, pixels, pageId, pixelId]);

  const connectionsHref = brandId ? `/connections?brand=${encodeURIComponent(brandId)}` : "/connections";
  const selectedBrand = brands.find((b) => b.id === brandId);
  const writeByPlatform = useMemo(() => {
    const map: Record<LaunchPlatform, { connected: boolean; canWrite: boolean; name?: string }> = {
      meta: { connected: false, canWrite: false },
      google: { connected: false, canWrite: false },
      tiktok: { connected: false, canWrite: false },
    };
    for (const c of connections) {
      if (c.isConnected) {
        map[c.platform] = { connected: true, canWrite: c.canWrite, name: c.name };
      }
    }
    return map;
  }, [connections]);

  const canLaunch = canSubmitLaunch({
    name,
    headline,
    primaryText,
    dailyBudget: Number(budget),
    platformCount: platforms.length,
    includeAd,
    isDemo,
    pending: launch.isPending,
  });

  const togglePlatform = (id: LaunchPlatform) =>
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const toggleCountry = (code: string) =>
    setCountries((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const handleGenerate = () => {
    if (prompt.trim().length < 3) {
      toast.error("Describe the product or offer first.");
      return;
    }
    generatePlan.mutate({
      prompt: prompt.trim(),
      objective,
      platforms,
      productName: selectedBrand?.name || products[0]?.name,
      website: withHttps(landingUrl) || selectedBrand?.website || undefined,
      dailyBudget: Number(budget) || undefined,
      brandId: brandId || undefined,
    });
  };

  const handleLaunch = (forcePaused = false) => {
    if (!canLaunch) return;
    launch.mutate({
      name: name.trim(),
      description: hypothesis || primaryText,
      objective,
      platforms,
      dailyBudget: Number(budget),
      goLive: forcePaused ? false : goLive,
      brandId: brandId || undefined,
      accountIds: accountIds as Record<string, string>,
      countries,
      ageMin,
      ageMax,
      headline: headline.trim(),
      primaryText: primaryText.trim(),
      cta,
      landingUrl: withHttps(landingUrl) ?? "",
      pageId: pageId || undefined,
      pixelId: pixelId || undefined,
      includeAd,
    });
  };

  if (isLoading || contextQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        <motion.div {...fadeUp()} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-400" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                Create · Automation · Scale
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Campaign{" "}
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                Studio
              </span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Live create, paused review, and confirm-before-scale for the selected shop. Demo workspace is StyleVault sample data only.
            </p>
            {!isDemo && (
              <div className="mt-3">
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
            )}
          </div>
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {(["create", "launch", "automation", "scale"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-all ${
                  mode === id ? "bg-sky-500/20 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {id === "launch" ? "Plan" : id}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.06)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["meta", "google", "tiktok"] as LaunchPlatform[]).map((p) => {
            const info = writeByPlatform[p];
            return (
              <div key={p} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_META[p].color }} />
                  <span className="text-sm font-semibold text-white">{PLATFORM_META[p].name}</span>
                </div>
                {isDemo ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Demo</span>
                ) : info.canWrite ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Can write</span>
                ) : info.connected ? (
                  <Link href={connectionsHref} className="text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:underline">
                    Reconnect to write
                  </Link>
                ) : (
                  <Link href={connectionsHref} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:underline">
                    Connect
                  </Link>
                )}
              </div>
            );
          })}
        </motion.div>

        {isDemo && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            This is the Demo workspace (StyleVault sample). Switch to your real workspace to launch for live shops.
          </div>
        )}

        {fromFatigue && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
            <p>Prefills from Creative Fatigue. Review the copy, then launch a replacement campaign as paused.</p>
            <Link href="/creative-fatigue" className="shrink-0 text-xs font-semibold text-sky-200 hover:underline">
              Back to fatigue
            </Link>
          </div>
        )}

        {mode === "create" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <motion.div {...fadeUp(0.1)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <h2 className="text-base font-semibold text-white">Describe what to advertise</h2>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="e.g. Leather tote for working women in Athens, 20% off first order, free shipping over €80…"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-500/50"
              />
              {brands.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBrandId(b.id);
                        if (b.website) setLandingUrl(b.website);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        brandId === b.id
                          ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                          : "border-white/10 text-zinc-500"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs text-white/50">
                  Objective
                  <select
                    value={objective}
                    onChange={(e) => setObjective(e.target.value as LaunchObjective)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                  >
                    {OBJECTIVES.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-white/50">
                  Landing page
                  <input
                    value={landingUrl}
                    onChange={(e) => setLandingUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-500/50"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["meta", "google", "tiktok"] as LaunchPlatform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      platforms.includes(p)
                        ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                        : "border-white/10 text-zinc-500"
                    }`}
                  >
                    {PLATFORM_META[p].name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generatePlan.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {generatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate campaign plan
              </button>
            </motion.div>
            <motion.div {...fadeUp(0.16)} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
              <h2 className="text-base font-semibold text-white">Catalog · {selectedBrand?.name ?? "shop"}</h2>
              {products.length === 0 ? (
                <p className="text-xs text-zinc-500">Sync WooCommerce for this shop to pull product names into the plan.</p>
              ) : (
                products.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPrompt((prev) => prev || `Promote ${p.name}${p.sku ? ` (${p.sku})` : ""} at ${format(p.price)}.`);
                      setName(`${p.name} — Prospecting`);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-left hover:border-white/15"
                  >
                    <span className="truncate text-xs font-medium text-white">{p.name}</span>
                    <span className="text-xs tabular-nums text-zinc-400">{format(p.price)}</span>
                  </button>
                ))
              )}
            </motion.div>
          </div>
        )}

        {mode === "launch" && (
          <>
            <motion.div {...fadeUp(0.08)} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = s.id < step;
                  const current = s.id === step;
                  return (
                    <div key={s.id} className="flex flex-1 items-center last:flex-none">
                      <button type="button" onClick={() => setStep(s.id)} className="flex flex-col items-center gap-1.5">
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                            current
                              ? "border-sky-400 bg-sky-400/15 text-sky-300"
                              : done
                                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                                : "border-white/10 bg-white/5 text-zinc-500"
                          }`}
                        >
                          {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </span>
                        <span className={`text-[11px] font-medium ${current ? "text-white" : "text-zinc-500"}`}>
                          {s.label}
                        </span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className={`mx-3 mb-5 h-0.5 flex-1 rounded-full ${s.id < step ? "bg-sky-400/50" : "bg-white/10"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <motion.div {...fadeUp(0.12)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
                {step === 1 && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-white/50">Campaign name</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Autumn Drop — Prospecting"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-500/50"
                      />
                    </label>
                    <div>
                      <p className="mb-2 text-xs font-medium text-white/50">Objective</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {OBJECTIVES.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setObjective(o.id)}
                            className={`rounded-xl border p-3 text-left ${
                              objective === o.id ? "border-sky-400/40 bg-sky-400/10" : "border-white/10 bg-white/[0.03]"
                            }`}
                          >
                            <p className="text-sm font-semibold text-white">{o.label}</p>
                            <p className="text-[11px] text-zinc-500">{o.hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-white/50">Launch on</p>
                      <div className="space-y-2">
                        {(["meta", "google", "tiktok"] as LaunchPlatform[]).map((p) => {
                          const conn = connections.find((c) => c.platform === p && c.isConnected);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePlatform(p)}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                                platforms.includes(p) ? "border-white/20 bg-white/[0.06]" : "border-white/5"
                              }`}
                            >
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
                                style={{ backgroundColor: PLATFORM_META[p].color }}
                              >
                                {PLATFORM_META[p].name[0]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white">{PLATFORM_META[p].name}</p>
                                <p className="text-[11px] text-zinc-500">
                                  {conn ? conn.name : "Not connected"}
                                  {conn && !conn.canWrite ? " · reconnect for write access" : ""}
                                </p>
                              </div>
                              {platforms.includes(p) && <Check className="h-4 w-4 text-sky-300" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-white/50">Brand</span>
                      <select
                        value={brandId}
                        onChange={(e) => {
                          setBrandId(e.target.value);
                          const b = brands.find((x) => x.id === e.target.value);
                          if (b?.website) setLandingUrl(b.website);
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                      >
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {step === 2 && (
                  <>
                    <p className="text-xs font-medium text-white/50">Countries</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COUNTRY_OPTIONS.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleCountry(code)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            countries.includes(code)
                              ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                              : "border-white/10 text-zinc-500"
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-white/50">
                        Age min
                        <input
                          type="number"
                          min={18}
                          max={65}
                          value={ageMin}
                          onChange={(e) => setAgeMin(Number(e.target.value))}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-white/50">
                        Age max
                        <input
                          type="number"
                          min={18}
                          max={65}
                          value={ageMax}
                          onChange={(e) => setAgeMax(Number(e.target.value))}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                        />
                      </label>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-500">
                      Meta launches with Advantage-style broad targeting (geo + age). Interest names are stored on the draft; Meta no longer wants you to pick 40 interest IDs by hand.
                    </p>
                  </>
                )}

                {step === 3 && (
                  <>
                    <label className="block text-xs text-white/50">
                      Headline
                      <input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        maxLength={40}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
                      />
                    </label>
                    <label className="block text-xs text-white/50">
                      Primary text
                      <textarea
                        value={primaryText}
                        onChange={(e) => setPrimaryText(e.target.value)}
                        rows={5}
                        className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs text-white/50">
                        CTA
                        <select
                          value={cta}
                          onChange={(e) => setCta(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                        >
                          {CTA_OPTIONS.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-white/50">
                        Landing URL
                        <input
                          value={landingUrl}
                          onChange={(e) => setLandingUrl(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
                        />
                      </label>
                    </div>
                    {platforms.includes("meta") && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-xs text-white/50">
                          Facebook Page
                          <select
                            value={pageId}
                            onChange={(e) => setPageId(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                          >
                            <option value="">Campaign + ad set only</option>
                            {pages.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-white/50">
                          Pixel (Sales)
                          <select
                            value={pixelId}
                            onChange={(e) => setPixelId(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                          >
                            <option value="">None — launch as Traffic</option>
                            {pixels.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </>
                )}

                {step === 4 && (
                  <>
                    <label className="block text-xs text-white/50">
                      Daily budget ({symbol})
                      <input
                        type="number"
                        min="1"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
                      />
                    </label>
                    <p className="text-xs text-zinc-500">
                      ≈ {format(Number(budget || 0) * 30)} / month across selected platforms (same daily budget per platform).
                    </p>
                    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <input
                        type="checkbox"
                        checked={goLive}
                        onChange={(e) => setGoLive(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-white">Go live immediately</span>
                        <span className="text-xs text-zinc-500">
                          Off = create as PAUSED (recommended). On = start spending as soon as the platforms approve the ads.
                        </span>
                      </span>
                    </label>
                  </>
                )}

                {step === 5 && (
                  <div className="space-y-3 text-sm">
                    <Row label="Name" value={name || "—"} />
                    <Row label="Objective" value={objective} />
                    <Row label="Platforms" value={platforms.map((p) => PLATFORM_META[p].name).join(", ")} />
                    <Row label="Audience" value={`${countries.join(", ")} · ${ageMin}–${ageMax}`} />
                    <Row label="Budget" value={`${format(Number(budget || 0))} / day`} />
                    <Row label="Status" value={goLive ? "ACTIVE on push" : "PAUSED on push"} />
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ad preview</p>
                      <p className="mt-2 font-semibold text-white">{headline || "Headline"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-300">{primaryText || "Primary text"}</p>
                      <p className="mt-3 text-xs text-sky-300">{cta} → {landingUrl || "landing URL"}</p>
                    </div>
                    {hypothesis && <p className="text-xs text-zinc-500">{hypothesis}</p>}
                    <button
                      type="button"
                      onClick={() => setPending({ kind: "launch" })}
                      disabled={!canLaunch}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {launch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      {goLive ? "Confirm live launch" : "Review & create paused"}
                    </button>
                  </div>
                )}
              </motion.div>

              <div className="space-y-4 lg:col-span-2">
                {launch.data && (
                  <motion.div {...fadeUp(0.14)} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-white">Launch result</h3>
                    {launch.data.results.map((r) => (
                      <div key={r.platform} className="rounded-xl border border-white/10 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold capitalize text-white">{r.platform}</span>
                          {r.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase text-rose-300">Failed</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">{r.message}</p>
                        {r.warnings.map((w) => (
                          <p key={w} className="mt-1 text-[11px] text-amber-300/80">{w}</p>
                        ))}
                        {r.ok && r.campaignId && (
                          <button
                            type="button"
                            disabled={isDemo || liveStatus.isPending}
                            onClick={() =>
                              setPending({
                                kind: "status",
                                platform: r.platform,
                                campaignId: r.campaignId!,
                                status: "ACTIVE",
                              })
                            }
                            className="mt-2 block text-[11px] font-semibold text-emerald-300"
                          >
                            Confirm activate
                          </button>
                        )}
                        {r.adsManagerUrl && (
                          <a
                            href={r.adsManagerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300"
                          >
                            Open ads manager <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                    <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300">
                      View in Campaigns <ArrowRight className="h-3 w-3" />
                    </Link>
                  </motion.div>
                )}

                <motion.div {...fadeUp(0.18)} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">Workspace drafts</h3>
                  </div>
                  {drafts.length === 0 ? (
                    <p className="text-xs text-zinc-500">Launched campaigns land here and on the Campaigns page.</p>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {drafts.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">{d.name}</p>
                            <p className="text-[10px] capitalize text-zinc-500">{d.status} · {d.platform}</p>
                          </div>
                          <span className="text-xs tabular-nums text-zinc-400">{format(d.budget)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            <motion.div {...fadeUp(0.2)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(5, s + 1))}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <span className="text-xs text-zinc-500">Review, then launch above.</span>
              )}
            </motion.div>
          </>
        )}

        {mode === "automation" && (
          <motion.div {...fadeUp(0.1)} className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-sky-400" />
                <h2 className="text-base font-semibold text-white">Hierarchy review</h2>
              </div>
              <p className="text-xs text-zinc-500">
                Same order as Ads Manager. New structures stay PAUSED. Tick only the layers to apply, then confirm.
              </p>
              {[
                { key: "campaign", label: "Campaign", detail: `${name || "Untitled"} · ${objective} · ${format(Number(budget || 0))}/day`, locked: true },
                { key: "adset", label: "Ad set / Ad group", detail: `${countries.join(", ") || "—"} · ages ${ageMin}–${ageMax}`, locked: true },
                { key: "ad", label: "Ad", detail: headline || "No headline yet", locked: false },
              ].map((row) => (
                <label key={row.key} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <input
                    type="checkbox"
                    checked={row.key !== "ad" || includeAd}
                    disabled={row.locked}
                    onChange={() => row.key === "ad" && setIncludeAd((v) => !v)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">{row.label}</span>
                    <span className="text-xs text-zinc-500">{row.detail}</span>
                  </span>
                </label>
              ))}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <p className="font-semibold text-white">{headline || "Headline"}</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-300">{primaryText || "Generate a plan in Create first."}</p>
              </div>
              <button
                type="button"
                disabled={!canLaunch}
                onClick={() => setPending({ kind: "launch" })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {launch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Apply selected layers as paused
              </button>
            </div>
            <div className="space-y-4 lg:col-span-2">
              {ctx?.projectContext && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project setup</p>
                  <p className="mt-2 text-sm font-semibold capitalize text-white">{ctx.projectContext.objective}</p>
                  <p className="mt-1 text-xs text-zinc-400">{ctx.projectContext.targetResult || ctx.projectContext.priorities || "Add context in Onboarding."}</p>
                  <Link href="/onboarding" className="mt-3 inline-block text-xs font-semibold text-sky-300">Edit context</Link>
                </div>
              )}
              {launch.data && (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white">Apply result</h3>
                  {launch.data.results.map((r) => (
                    <p key={r.platform} className="text-xs text-zinc-400">
                      {r.platform}: {r.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {mode === "scale" && (
          <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Scale winners on the live accounts</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Pause, resume, or raise daily budget on synced campaigns. Meta needs ads_management — reconnect if a write fails.
              </p>
            </div>
            {syncedQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-sky-400" /></div>
            ) : synced.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-zinc-500">
                No synced campaigns yet.{" "}
                <Link href={connectionsHref} className="font-semibold text-sky-300">
                  Connect and sync
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {synced.map((c) => {
                  const platform = (c.platform === "facebook" ? "meta" : c.platform) as LaunchPlatform;
                  if (platform !== "meta" && platform !== "google" && platform !== "tiktok") return null;
                  return (
                    <div key={c.campaignId} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{c.campaignName}</p>
                        <p className="text-[11px] text-zinc-500">
                          {PLATFORM_META[platform].name} · {format(c.totalSpend)} spend · {c.roas.toFixed(2)}x ROAS
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isDemo || liveStatus.isPending}
                          onClick={() =>
                            setPending({
                              platform,
                              kind: "status",
                              campaignId: c.campaignId,
                              status: "PAUSED",
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white disabled:opacity-40"
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </button>
                        <button
                          type="button"
                          disabled={isDemo || liveStatus.isPending}
                          onClick={() =>
                            setPending({
                              platform,
                              kind: "status",
                              campaignId: c.campaignId,
                              status: "ACTIVE",
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white disabled:opacity-40"
                        >
                          <Play className="h-3 w-3" /> Resume
                        </button>
                        {[1.2, 1.5, 2].map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={isDemo || scaleBudget.isPending}
                            onClick={() =>
                              setPending({
                                kind: "scale",
                                platform,
                                campaignId: c.campaignId,
                                multiplier: m,
                                currentDailyBudget: Number(c.totalSpend) > 0 ? Number(c.totalSpend) / 7 : undefined,
                              })
                            }
                            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
                          >
                            +{Math.round((m - 1) * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {connections.every((c) => !c.isConnected) && !isDemo && (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Plug className="h-4 w-4" /> Connect Meta, Google, or TikTok to launch for real.
            </div>
            <Link href={connectionsHref} className="text-sm font-semibold text-sky-300">
              Open Connections
            </Link>
          </div>
        )}

        {pending && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white">Confirm before it hits the platform</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {pending.kind === "launch" &&
                  (mode === "automation" || !goLive
                    ? "Create this structure as PAUSED. Nothing spends until you confirm activate."
                    : "This will create the campaign as ACTIVE. Spend can start after platform review.")}
                {pending.kind === "status" &&
                  (pending.status === "PAUSED"
                    ? "Pause this campaign on the live ad account?"
                    : "Activate this campaign on the live ad account? Spend can start after review.")}
                {pending.kind === "scale" &&
                  `Raise the live daily budget by ${Math.round((pending.multiplier - 1) * 100)}%? This writes to the ad platform.`}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pending.kind === "launch") handleLaunch(mode === "automation");
                    if (pending.kind === "status") {
                      liveStatus.mutate({
                        platform: pending.platform,
                        platformCampaignId: pending.campaignId,
                        status: pending.status,
                        adAccountId: accountIds[pending.platform],
                        brandId: brandId || undefined,
                      });
                    }
                    if (pending.kind === "scale") {
                      scaleBudget.mutate({
                        platform: pending.platform,
                        platformCampaignId: pending.campaignId,
                        multiplier: pending.multiplier,
                        currentDailyBudget: pending.currentDailyBudget ?? (Number(budget) || 50),
                        adAccountId: accountIds[pending.platform],
                        brandId: brandId || undefined,
                      });
                    }
                    setPending(null);
                  }}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 px-3 py-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-right text-xs font-semibold capitalize text-white">{value}</span>
    </div>
  );
}

export function CampaignLauncherFallbackIcon() {
  return <Target className="h-4 w-4" />;
}
