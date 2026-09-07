"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/components/providers/trpc-provider";
import { cn } from "@/lib/utils";
import {
  LEARNING_RESET_MESSAGE,
  META_BID_STRATEGIES,
  META_CTA_OPTIONS,
  META_LOCALES,
  META_OPTIMIZATION_GOALS,
  META_PACING_TYPES,
  META_PUBLISHER_PLATFORMS,
  META_SCHEDULE_DAYS,
  META_SPECIAL_AD_CATEGORIES,
  advantageAudienceOn,
  audienceIdsFromTargeting,
  automaticPlacementsOn,
  clockToMinutes,
  countriesFromTargeting,
  formatMetaRecommendations,
  localesFromTargeting,
  metaWriteBlockedReason,
  minutesToClock,
  operatorBudgetAmount,
  parseAdsetSchedule,
  placementsFromTargeting,
} from "@/lib/meta/operator-logic";
import type { MetaOperatorTree, MetaTreeAd, MetaTreeAdSet } from "@/lib/meta/operator";

type ObjectType = "campaign" | "adset" | "ad";

type Props = {
  campaignId: string | null;
  brandId?: string;
  onClose: () => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/40";

export function MetaOperatorDesk({ campaignId, brandId, onClose }: Props) {
  const [selected, setSelected] = useState<{ type: ObjectType; id: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [killText, setKillText] = useState("");
  const [killMode, setKillMode] = useState<"pause_adsets" | "pause_campaign" | "pause_ads" | "spend_cap">("pause_adsets");
  const [spendCap, setSpendCap] = useState("50");
  const [confirmLive, setConfirmLive] = useState(false);

  useEffect(() => {
    setSelected(null);
    setConfirmReset(false);
    setKillText("");
    setConfirmLive(false);
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [campaignId, onClose]);

  const treeQuery = api.metaOps.tree.useQuery(
    { campaignId: campaignId ?? "", brandId: brandId || undefined },
    { enabled: Boolean(campaignId) },
  );
  const logsQuery = api.metaOps.logs.useQuery(
    { campaignId: campaignId ?? "", limit: 12 },
    { enabled: Boolean(campaignId) },
  );
  const assetsQuery = api.metaOps.assets.useQuery(
    {
      campaignId: campaignId ?? "",
      brandId: brandId || undefined,
      withValueRules: Boolean(treeQuery.data?.canWrite),
    },
    { enabled: Boolean(campaignId) && (selected?.type === "adset" || selected?.type === "ad") },
  );

  const invalidate = () => {
    void treeQuery.refetch();
    void logsQuery.refetch();
    void assetsQuery.refetch();
  };

  const onMutateError = (error: { message: string }) => {
    toast.error(error.message);
    if (error.message === LEARNING_RESET_MESSAGE) setConfirmReset(true);
  };

  const setStatus = api.metaOps.setStatus.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setName = api.metaOps.setName.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setSpecialAdCategories = api.metaOps.setSpecialAdCategories.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setBudget = api.metaOps.setBudget.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setBid = api.metaOps.setBid.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setSchedule = api.metaOps.setSchedule.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setAudience = api.metaOps.setAudience.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setPlacements = api.metaOps.setPlacements.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setPacing = api.metaOps.setPacing.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setFrequency = api.metaOps.setFrequency.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const setOptimization = api.metaOps.setOptimization.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const createRules = api.metaOps.createValueRules.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const attachRules = api.metaOps.attachValueRules.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const duplicate = api.metaOps.duplicate.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const swapCreative = api.metaOps.swapCreative.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const addAd = api.metaOps.addAd.useMutation({ onSuccess: (r) => { toast.success(r.message); invalidate(); }, onError: onMutateError });
  const killSwitch = api.metaOps.killSwitch.useMutation({
    onSuccess: (r) => { toast.success(r.message); setKillText(""); invalidate(); },
    onError: onMutateError,
  });
  const scaleBudget = api.campaigns.scaleBudget.useMutation({
    onSuccess: (r) => { toast.success(r.message); invalidate(); },
    onError: onMutateError,
  });

  const tree = treeQuery.data;
  const campaign = tree?.campaign;
  const adSets = tree?.adSets ?? [];
  const pages = assetsQuery.data?.pages ?? tree?.pages ?? [];
  const customAudiences = assetsQuery.data?.customAudiences ?? tree?.customAudiences ?? [];
  const valueRules = assetsQuery.data?.valueRules ?? tree?.valueRules ?? [];
  const writeBlocked = metaWriteBlockedReason(tree?.permissions ?? []);
  const selectedAdSet = adSets.find((row) => row.id === selected?.id && selected.type === "adset")
    ?? adSets.find((row) => row.ads.some((ad) => ad.id === selected?.id));
  const selectedAd = adSets.flatMap((row) => row.ads).find((ad) => ad.id === selected?.id);

  useEffect(() => {
    if (campaign && !selected) setSelected({ type: "campaign", id: campaign.id });
  }, [campaign, selected]);

  const pending = [
    setStatus, setName, setSpecialAdCategories, setBudget, setBid, setSchedule, setAudience, setPlacements, setPacing, setFrequency,
    setOptimization, createRules, attachRules, duplicate, swapCreative, addAd, killSwitch, scaleBudget,
  ].some((m) => m.isPending);

  const base = campaignId
    ? { campaignId, brandId: brandId || undefined, confirmLearningReset: confirmReset }
    : null;

  if (!campaignId) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Meta operator desk"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">Meta operator desk</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white">{campaign?.name ?? "Loading campaign…"}</h2>
            <p className="mt-1 text-xs text-white/45">
              {tree?.accountName} · {campaign?.objective ?? "—"}
              {campaign?.smartPromotionType === "AUTOMATED_SHOPPING_ADS" ? " · Advantage+ shopping" : ""}
              {" · "}
              {tree?.budgetTarget?.cbo ? "Campaign budget (CBO)" : "Ad set budget"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {campaign?.id && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(campaign.id);
                  toast.success("Copied campaign id");
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                Copy ID
              </button>
            )}
            {tree?.adsManagerUrl && (
              <a
                href={tree.adsManagerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                Ads Manager <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {treeQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-white/50">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading live Meta objects…
          </div>
        ) : treeQuery.error ? (
          <div className="p-6 text-sm text-red-300">{treeQuery.error.message}</div>
        ) : !tree || !campaign || !base ? null : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
            <aside className="min-h-0 overflow-y-auto border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
              <TreeRow
                active={selected?.type === "campaign"}
                label={campaign.name}
                meta={campaign.effectiveStatus ?? campaign.status}
                onClick={() => setSelected({ type: "campaign", id: campaign.id })}
              />
              {adSets.map((set) => (
                <div key={set.id} className="mt-2 pl-2">
                  <TreeRow
                    active={selected?.type === "adset" && selected.id === set.id}
                    label={set.name}
                    meta={`${set.effectiveStatus ?? set.status}${set.learning ? " · learning" : ""}`}
                    onClick={() => setSelected({ type: "adset", id: set.id })}
                  />
                  {set.ads.map((ad) => (
                    <TreeRow
                      key={ad.id}
                      nested
                      active={selected?.type === "ad" && selected.id === ad.id}
                      label={ad.name}
                      meta={ad.effectiveStatus ?? ad.status}
                      onClick={() => setSelected({ type: "ad", id: ad.id })}
                    />
                  ))}
                </div>
              ))}
              {adSets.length === 0 && (
                <p className="mt-3 px-2.5 text-[11px] text-white/40">
                  {tree.adSetError ? "Ad sets did not load." : "No ad sets on this campaign."}
                </p>
              )}
            </aside>

            <section className="min-h-0 overflow-y-auto p-5">
              {writeBlocked && (
                <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {writeBlocked}{" "}
                  <Link href="/connections" className="font-semibold underline">
                    Open Connections
                  </Link>
                </p>
              )}
              {(tree.adSetError || tree.adError) && (
                <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <p>{tree.adSetError || tree.adError}</p>
                  <button
                    type="button"
                    onClick={() => void treeQuery.refetch()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/10"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry load
                  </button>
                </div>
              )}
              <label className="mb-2 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} className="mt-0.5" />
                Confirm before setting any object Active.
              </label>
              <label className="mb-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                <input type="checkbox" checked={confirmReset} onChange={(e) => setConfirmReset(e.target.checked)} className="mt-0.5" />
                I know significant edits reset learning (~50 events / 7 days). Required for budget jumps over 20%, targeting, bid, optimization, and creative.
              </label>

              {selected?.type === "campaign" && (
                <CampaignPanel
                  tree={tree}
                  pending={pending || !tree.canWrite}
                  confirmLive={confirmLive}
                  killText={killText}
                  setKillText={setKillText}
                  killMode={killMode}
                  setKillMode={setKillMode}
                  spendCap={spendCap}
                  setSpendCap={setSpendCap}
                  onStatus={(status) => setStatus.mutate({ ...base, objectId: campaign.id, objectType: "campaign", status })}
                  onRename={(name) => setName.mutate({ ...base, objectId: campaign.id, objectType: "campaign", name })}
                  onSpecialCategories={(categories, countries) =>
                    setSpecialAdCategories.mutate({ ...base, categories, countries })
                  }
                  onBudget={(amount, kind) =>
                    setBudget.mutate({
                      ...base,
                      objectId: tree.budgetTarget?.layer === "campaign" ? campaign.id : tree.budgetTarget?.id ?? campaign.id,
                      kind,
                      amount,
                      currentAmount: tree.budgetTarget
                        ? tree.budgetTarget.currentCents / 100
                        : kind === "daily"
                          ? campaign.dailyBudget ?? undefined
                          : campaign.lifetimeBudget ?? undefined,
                    })
                  }
                  onDuplicate={() => duplicate.mutate({ ...base, objectId: campaign.id, kind: "campaign" })}
                  onScale={() =>
                    scaleBudget.mutate({
                      platform: "meta",
                      platformCampaignId: campaign.id,
                      multiplier: 1.2,
                      brandId: brandId || undefined,
                    })
                  }
                  onKill={() =>
                    killSwitch.mutate({
                      campaignId: campaign.id,
                      brandId: brandId || undefined,
                      mode: killMode,
                      spendCap: killMode === "spend_cap" ? Number(spendCap) : undefined,
                      confirmText: killText,
                    })
                  }
                />
              )}

              {selected?.type === "adset" && selectedAdSet && (
                <AdSetPanel
                  adSet={selectedAdSet}
                  pending={pending || !tree.canWrite}
                  confirmLive={confirmLive}
                  valueRules={valueRules}
                  customAudiences={customAudiences}
                  onStatus={(status) => setStatus.mutate({ ...base, objectId: selectedAdSet.id, objectType: "adset", status })}
                  onRename={(name) => setName.mutate({ ...base, objectId: selectedAdSet.id, objectType: "adset", name })}
                  onBudget={(amount, kind) =>
                    setBudget.mutate({
                      ...base,
                      objectId: selectedAdSet.id,
                      kind,
                      amount,
                      currentAmount: kind === "daily" ? selectedAdSet.dailyBudget ?? undefined : selectedAdSet.lifetimeBudget ?? undefined,
                      learning: selectedAdSet.learning,
                    })
                  }
                  onBid={(strategy, bidAmount, minRoas) =>
                    setBid.mutate({ ...base, adSetId: selectedAdSet.id, strategy, bidAmount, minRoas, learning: selectedAdSet.learning })
                  }
                  onSchedule={(payload) => setSchedule.mutate({ ...base, adSetId: selectedAdSet.id, learning: selectedAdSet.learning, ...payload })}
                  onAudience={(payload) => setAudience.mutate({ ...base, adSetId: selectedAdSet.id, learning: selectedAdSet.learning, ...payload })}
                  onPlacements={(payload) => setPlacements.mutate({ ...base, adSetId: selectedAdSet.id, learning: selectedAdSet.learning, ...payload })}
                  onPacing={(pacingType) => setPacing.mutate({ ...base, adSetId: selectedAdSet.id, pacingType })}
                  onFrequency={(intervalDays, maxFrequency) =>
                    setFrequency.mutate({ ...base, adSetId: selectedAdSet.id, intervalDays, maxFrequency, learning: selectedAdSet.learning })
                  }
                  onOptimization={(optimizationGoal, attributionPreset) =>
                    setOptimization.mutate({ ...base, adSetId: selectedAdSet.id, optimizationGoal, attributionPreset, learning: selectedAdSet.learning })
                  }
                  onCreateRules={(name, rules) => createRules.mutate({ ...base, adSetId: selectedAdSet.id, name, rules })}
                  onAttach={(valueRuleSetId) => attachRules.mutate({ ...base, adSetId: selectedAdSet.id, valueRuleSetId })}
                  onDuplicate={() => duplicate.mutate({ ...base, objectId: selectedAdSet.id, kind: "adset" })}
                />
              )}

              {selected?.type === "ad" && selectedAd && selectedAdSet && (
                <AdPanel
                  ad={selectedAd}
                  pages={pages}
                  pending={pending || !tree.canWrite}
                  confirmLive={confirmLive}
                  onStatus={(status) => setStatus.mutate({ ...base, objectId: selectedAd.id, objectType: "ad", status })}
                  onRename={(name) => setName.mutate({ ...base, objectId: selectedAd.id, objectType: "ad", name })}
                  onDuplicate={() => duplicate.mutate({ ...base, objectId: selectedAd.id, kind: "ad" })}
                  onSwap={(payload) => swapCreative.mutate({ ...base, adId: selectedAd.id, learning: selectedAdSet.learning, ...payload })}
                  onAdd={(payload) => addAd.mutate({ ...base, adSetId: selectedAdSet.id, learning: selectedAdSet.learning, ...payload })}
                />
              )}

              <div className="mt-8">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Write log</h3>
                <ul className="mt-2 space-y-1.5">
                  {(logsQuery.data?.logs ?? []).map((row) => (
                    <li key={row.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-white/60">
                      <span className={row.ok ? "text-emerald-400" : "text-red-400"}>{row.action}</span>
                      {" · "}
                      {row.message}
                    </li>
                  ))}
                  {(logsQuery.data?.logs ?? []).length === 0 && (
                    <li className="text-[11px] text-white/35">No operator writes yet for this workspace.</li>
                  )}
                </ul>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeRow({
  label,
  meta,
  active,
  nested,
  onClick,
}: {
  label: string;
  meta: string;
  active: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg px-2.5 py-2 text-left",
        nested && "ml-3 w-[calc(100%-0.75rem)]",
        active ? "bg-blue-500/15 text-white" : "text-white/70 hover:bg-white/5",
      )}
    >
      <p className="truncate text-xs font-medium">{label}</p>
      <p className="truncate text-[10px] uppercase tracking-wide text-white/35">{meta}</p>
    </button>
  );
}

function RenameRow({
  value,
  pending,
  onSave,
}: {
  value: string;
  pending: boolean;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(value);
  useEffect(() => setName(value), [value]);
  return (
    <div className="flex gap-2">
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      <button
        type="button"
        disabled={pending || !name.trim()}
        onClick={() => onSave(name.trim())}
        className="rounded-lg border border-white/10 px-3 text-xs text-white disabled:opacity-40"
      >
        Rename
      </button>
    </div>
  );
}

function StatusButtons({
  onStatus,
  pending,
  confirmLive,
}: {
  onStatus: (status: "ACTIVE" | "PAUSED" | "ARCHIVED") => void;
  pending: boolean;
  confirmLive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirmLive) {
            toast.error("Check Confirm before setting any object Active.");
            return;
          }
          onStatus("ACTIVE");
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-white/5 disabled:opacity-40"
      >
        <Play className="h-3 w-3" /> Active
      </button>
      <button type="button" disabled={pending} onClick={() => onStatus("PAUSED")} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-yellow-300 hover:bg-white/5 disabled:opacity-40">
        <Pause className="h-3 w-3" /> Paused
      </button>
      <button type="button" disabled={pending} onClick={() => onStatus("ARCHIVED")} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 disabled:opacity-40">
        <Archive className="h-3 w-3" /> Archive
      </button>
    </div>
  );
}

function CampaignPanel({
  tree,
  pending,
  confirmLive,
  killText,
  setKillText,
  killMode,
  setKillMode,
  spendCap,
  setSpendCap,
  onStatus,
  onRename,
  onSpecialCategories,
  onBudget,
  onDuplicate,
  onScale,
  onKill,
}: {
  tree: MetaOperatorTree & { canWrite: boolean };
  pending: boolean;
  confirmLive: boolean;
  killText: string;
  setKillText: (v: string) => void;
  killMode: "pause_adsets" | "pause_campaign" | "pause_ads" | "spend_cap";
  setKillMode: (v: "pause_adsets" | "pause_campaign" | "pause_ads" | "spend_cap") => void;
  spendCap: string;
  setSpendCap: (v: string) => void;
  onStatus: (status: "ACTIVE" | "PAUSED" | "ARCHIVED") => void;
  onRename: (name: string) => void;
  onSpecialCategories: (categories: string[], countries: string[]) => void;
  onBudget: (amount: number, kind: "daily" | "lifetime" | "spend_cap") => void;
  onDuplicate: () => void;
  onScale: () => void;
  onKill: () => void;
}) {
  const currentBudget = operatorBudgetAmount({
    campaignDaily: tree.campaign.dailyBudget,
    campaignLifetime: tree.campaign.lifetimeBudget,
    budgetTarget: tree.budgetTarget,
  });
  const [amount, setAmount] = useState(currentBudget != null ? String(currentBudget) : "");
  const kind = tree.budgetTarget?.kind === "lifetime" ? "lifetime" : "daily";
  useEffect(() => {
    setAmount(currentBudget != null ? String(currentBudget) : "");
  }, [tree.campaign.id, currentBudget]);
  const canSaveBudget = Boolean(tree.canWrite && tree.budgetTarget && Number(amount) > 0);
  const liveCats = tree.campaign.specialAdCategories.filter((row) => row && row !== "NONE");
  const [categories, setCategories] = useState<string[]>(liveCats);
  const [sacCountries, setSacCountries] = useState("GR");
  useEffect(() => {
    setCategories(tree.campaign.specialAdCategories.filter((row) => row && row !== "NONE"));
  }, [tree.campaign.id, tree.campaign.specialAdCategories]);
  return (
    <div className="space-y-6">
      <StatusButtons onStatus={onStatus} pending={pending} confirmLive={confirmLive} />
      <RenameRow value={tree.campaign.name} pending={pending} onSave={onRename} />
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Special ad categories</h3>
        <p className="mt-1 text-xs text-white/45">
          Housing, credit, employment, and elections ads need this declared. Leave all off for NONE.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {META_SPECIAL_AD_CATEGORIES.filter((row) => row.value !== "NONE").map((row) => {
            const on = categories.includes(row.value);
            return (
              <button
                key={row.value}
                type="button"
                onClick={() =>
                  setCategories((current) =>
                    current.includes(row.value)
                      ? current.filter((value) => value !== row.value)
                      : [...current, row.value],
                  )
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px] font-semibold",
                  on ? "border-blue-400/40 bg-blue-500/15 text-blue-100" : "border-white/10 text-white/50",
                )}
              >
                {row.label}
              </button>
            );
          })}
        </div>
        <Field label="Declared countries">
          <input className={inputClass} value={sacCountries} onChange={(e) => setSacCountries(e.target.value)} placeholder="GR, CY" />
        </Field>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSpecialCategories(
              categories,
              sacCountries.split(/[,\s]+/).filter(Boolean),
            )
          }
          className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save categories
        </button>
      </div>
      {formatMetaRecommendations(tree.campaign.recommendations).map((row) => (
        <p key={row} className="text-xs text-amber-200">{row}</p>
      ))}
      {tree.campaign.smartPromotionType === "AUTOMATED_SHOPPING_ADS" && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
          Existing-customer budget % is deprecated on Advantage+. Cap returning buyers with include/exclude audiences on the ad set.
        </p>
      )}
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Budget</h3>
        <p className="mt-1 text-xs text-white/45">
          {tree.adSetError
            ? tree.adSetError
            : tree.budgetError ?? (tree.campaign.smartPromotionType === "AUTOMATED_SHOPPING_ADS" && !tree.budgetTarget?.cbo
            ? "Advantage+ shopping — Graph currently holds the daily budget on the ad set, not the campaign. Scale and Save write that ad set."
            : tree.budgetTarget?.cbo
            ? "CBO is on — this writes the campaign budget."
            : tree.budgetTarget
            ? `ABO — Save writes the ad set daily/lifetime budget (€${(tree.budgetTarget.currentCents / 100).toFixed(0)} live).`
            : "ABO — this writes the selected ad set daily/lifetime budget.")}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className={inputClass}
            value={amount}
            placeholder="Live budget unknown"
            onChange={(e) => setAmount(e.target.value)}
            disabled={!tree.budgetTarget}
          />
          <button
            type="button"
            disabled={pending || !canSaveBudget}
            onClick={() => onBudget(Number(amount), kind)}
            className="rounded-lg bg-blue-500 px-4 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save {kind}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:text-white disabled:opacity-40">
          <Copy className="h-3.5 w-3.5" /> Duplicate campaign as paused
        </button>
        <button type="button" disabled={pending || !tree.canWrite || !tree.budgetTarget} onClick={onScale} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:text-white disabled:opacity-40">
          Scale +20%
        </button>
      </div>
      <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-200">
          <ShieldAlert className="h-4 w-4" /> Kill switch
        </h3>
        <select className={`${inputClass} mt-3`} value={killMode} onChange={(e) => setKillMode(e.target.value as typeof killMode)}>
          <option value="pause_adsets">Pause all ad sets (keep campaign)</option>
          <option value="pause_ads">Pause all ads (keep campaign + ad sets)</option>
          <option value="pause_campaign">Pause campaign</option>
          <option value="spend_cap">Set campaign spend cap</option>
        </select>
        {killMode === "spend_cap" && (
          <input className={`${inputClass} mt-2`} value={spendCap} onChange={(e) => setSpendCap(e.target.value)} />
        )}
        <input className={`${inputClass} mt-2`} placeholder="Type PAUSE" value={killText} onChange={(e) => setKillText(e.target.value)} />
        <button type="button" disabled={pending || !tree.canWrite} onClick={onKill} className="mt-3 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          Run kill switch
        </button>
      </div>
    </div>
  );
}

function AdSetPanel({
  adSet,
  pending,
  confirmLive,
  valueRules,
  customAudiences,
  onStatus,
  onRename,
  onBudget,
  onBid,
  onSchedule,
  onAudience,
  onPlacements,
  onPacing,
  onFrequency,
  onOptimization,
  onCreateRules,
  onAttach,
  onDuplicate,
}: {
  adSet: MetaTreeAdSet;
  pending: boolean;
  confirmLive: boolean;
  valueRules: Array<{ id: string; name: string }>;
  customAudiences: Array<{ id: string; name: string }>;
  onStatus: (status: "ACTIVE" | "PAUSED" | "ARCHIVED") => void;
  onRename: (name: string) => void;
  onBudget: (amount: number, kind: "daily" | "lifetime" | "spend_cap") => void;
  onBid: (strategy: (typeof META_BID_STRATEGIES)[number]["value"], bidAmount?: number, minRoas?: number) => void;
  onSchedule: (payload: { startTime?: string; endTime?: string; startMinute?: number; endMinute?: number; days?: number[] }) => void;
  onAudience: (payload: {
    countries: string[];
    ageMin: number;
    ageMax: number;
    advantageAudience: boolean;
    includedAudienceIds: string[];
    excludedAudienceIds: string[];
    locales: number[];
  }) => void;
  onPlacements: (payload: { automatic: boolean; platforms: string[] }) => void;
  onPacing: (pacingType: "standard" | "day_parting" | "no_pacing") => void;
  onFrequency: (intervalDays: number, maxFrequency: number) => void;
  onOptimization: (goal: string, preset?: "7d_click_1d_view" | "1d_click" | "7d_click") => void;
  onCreateRules: (name: string, rules: Array<{ name: string; adjustSign: "INCREASE" | "DECREASE"; adjustValue: number; criteriaType: "LOCATION" | "OS_TYPE"; criteriaValues: string[] }>) => void;
  onAttach: (id: string) => void;
  onDuplicate: () => void;
}) {
  const [budget, setBudget] = useState(String(adSet.dailyBudget ?? adSet.lifetimeBudget ?? 20));
  const [strategy, setStrategy] = useState(adSet.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState(String(adSet.bidAmount ?? 12));
  const [minRoas, setMinRoas] = useState("2");
  const [countries, setCountries] = useState(countriesFromTargeting(adSet.targeting).join(",") || "GR,CY");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [advantage, setAdvantage] = useState(advantageAudienceOn(adSet.targeting));
  const [goal, setGoal] = useState(adSet.optimizationGoal ?? "OFFSITE_CONVERSIONS");
  const [attr, setAttr] = useState<"7d_click_1d_view" | "1d_click" | "7d_click">("7d_click_1d_view");
  const [start, setStart] = useState(adSet.startTime?.slice(0, 16) ?? "");
  const [end, setEnd] = useState(adSet.endTime?.slice(0, 16) ?? "");
  const parsedSchedule = parseAdsetSchedule(adSet.schedule);
  const [daypartStart, setDaypartStart] = useState(minutesToClock(parsedSchedule.startMinute));
  const [daypartEnd, setDaypartEnd] = useState(minutesToClock(parsedSchedule.endMinute));
  const [days, setDays] = useState<number[]>(parsedSchedule.days);
  const [applyDaypart, setApplyDaypart] = useState(Array.isArray(adSet.schedule) && adSet.schedule.length > 0);
  const [ruleCountry, setRuleCountry] = useState("GR");
  const [rulePct, setRulePct] = useState("20");
  const [ruleSign, setRuleSign] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [attachId, setAttachId] = useState(valueRules[0]?.id ?? "");
  const [automaticPlacements, setAutomaticPlacements] = useState(automaticPlacementsOn(adSet.targeting));
  const [platforms, setPlatforms] = useState<string[]>(placementsFromTargeting(adSet.targeting));
  const [includedIds, setIncludedIds] = useState<string[]>(audienceIdsFromTargeting(adSet.targeting, "custom_audiences"));
  const [excludedIds, setExcludedIds] = useState<string[]>(audienceIdsFromTargeting(adSet.targeting, "excluded_custom_audiences"));
  const [pacing, setPacing] = useState<"standard" | "day_parting" | "no_pacing">(
    adSet.pacingType?.includes("day_parting")
      ? "day_parting"
      : adSet.pacingType?.includes("no_pacing")
        ? "no_pacing"
        : "standard",
  );
  const [locales, setLocales] = useState<number[]>(localesFromTargeting(adSet.targeting));
  const [freqDays, setFreqDays] = useState(String(adSet.frequency?.intervalDays ?? 7));
  const [freqCap, setFreqCap] = useState(String(adSet.frequency?.maxFrequency ?? 0));

  useEffect(() => {
    setBudget(String(adSet.dailyBudget ?? adSet.lifetimeBudget ?? 20));
    setStrategy(adSet.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP");
    setBidAmount(String(adSet.bidAmount ?? 12));
    setCountries(countriesFromTargeting(adSet.targeting).join(",") || "GR,CY");
    setAdvantage(advantageAudienceOn(adSet.targeting));
    setGoal(adSet.optimizationGoal ?? "OFFSITE_CONVERSIONS");
    setStart(adSet.startTime?.slice(0, 16) ?? "");
    setEnd(adSet.endTime?.slice(0, 16) ?? "");
    const next = parseAdsetSchedule(adSet.schedule);
    setDaypartStart(minutesToClock(next.startMinute));
    setDaypartEnd(minutesToClock(next.endMinute));
    setDays(next.days);
    setApplyDaypart(Array.isArray(adSet.schedule) && adSet.schedule.length > 0);
    setAutomaticPlacements(automaticPlacementsOn(adSet.targeting));
    setPlatforms(placementsFromTargeting(adSet.targeting));
    setIncludedIds(audienceIdsFromTargeting(adSet.targeting, "custom_audiences"));
    setExcludedIds(audienceIdsFromTargeting(adSet.targeting, "excluded_custom_audiences"));
    setPacing(
      adSet.pacingType?.includes("day_parting")
        ? "day_parting"
        : adSet.pacingType?.includes("no_pacing")
          ? "no_pacing"
          : "standard",
    );
    setLocales(localesFromTargeting(adSet.targeting));
    setFreqDays(String(adSet.frequency?.intervalDays ?? 7));
    setFreqCap(String(adSet.frequency?.maxFrequency ?? 0));
  }, [adSet.id]);

  useEffect(() => {
    setAttachId(valueRules[0]?.id ?? "");
  }, [valueRules]);

  return (
    <div className="space-y-6">
      <StatusButtons onStatus={onStatus} pending={pending} confirmLive={confirmLive} />
      <RenameRow value={adSet.name} pending={pending} onSave={onRename} />
      {formatMetaRecommendations(adSet.recommendations).map((row) => (
        <p key={row} className="text-xs text-amber-200">{row}</p>
      ))}
      {adSet.learning && (
        <p className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
          This ad set is in {adSet.learningStage ?? "LEARNING"}. Duplicate instead of mutating if you can.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Ad set budget</h3>
          <div className="mt-3 flex gap-2">
            <input className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button type="button" disabled={pending} onClick={() => onBudget(Number(budget), adSet.lifetimeBudget ? "lifetime" : "daily")} className="rounded-lg bg-blue-500 px-3 text-xs font-semibold text-white disabled:opacity-40">Save</button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Bid</h3>
          <select className={`${inputClass} mt-3`} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
            {META_BID_STRATEGIES.map((row) => (
              <option key={row.value} value={row.value}>{row.label}</option>
            ))}
          </select>
          {strategy !== "LOWEST_COST_WITHOUT_CAP" && strategy !== "LOWEST_COST_WITH_MIN_ROAS" && (
            <input className={`${inputClass} mt-2`} value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
          )}
          {strategy === "LOWEST_COST_WITH_MIN_ROAS" && (
            <input className={`${inputClass} mt-2`} value={minRoas} onChange={(e) => setMinRoas(e.target.value)} />
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => onBid(strategy as (typeof META_BID_STRATEGIES)[number]["value"], Number(bidAmount), Number(minRoas))}
            className="mt-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save bid
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Audience</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Countries"><input className={inputClass} value={countries} onChange={(e) => setCountries(e.target.value)} /></Field>
          <Field label="Age min"><input className={inputClass} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></Field>
          <Field label="Age max"><input className={inputClass} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={advantage} onChange={(e) => setAdvantage(e.target.checked)} />
          Advantage+ audience
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {META_LOCALES.map((row) => {
            const on = locales.includes(row.id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  setLocales((current) =>
                    current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id],
                  )
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px] font-semibold",
                  on ? "border-blue-400/40 bg-blue-500/15 text-blue-100" : "border-white/10 text-white/50",
                )}
              >
                {row.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-white/35">Leave languages empty for all languages.</p>
        {customAudiences.length > 0 && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Include audiences</p>
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs text-white/70">
                {customAudiences.slice(0, 20).map((row) => (
                  <label key={`in-${row.id}`} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includedIds.includes(row.id)}
                      onChange={(e) =>
                        setIncludedIds((current) =>
                          e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                        )
                      }
                    />
                    {row.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Exclude audiences</p>
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs text-white/70">
                {customAudiences.slice(0, 20).map((row) => (
                  <label key={`ex-${row.id}`} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludedIds.includes(row.id)}
                      onChange={(e) =>
                        setExcludedIds((current) =>
                          e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                        )
                      }
                    />
                    {row.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => onAudience({
            countries: countries.split(/[,\s]+/).filter(Boolean),
            ageMin: Number(ageMin),
            ageMax: Number(ageMax),
            advantageAudience: advantage,
            includedAudienceIds: includedIds,
            excludedAudienceIds: excludedIds,
            locales,
          })}
          className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save audience
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Optimization + attribution</h3>
          <select className={`${inputClass} mt-3`} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {META_OPTIMIZATION_GOALS.map((row) => <option key={row} value={row}>{row}</option>)}
          </select>
          <select className={`${inputClass} mt-2`} value={attr} onChange={(e) => setAttr(e.target.value as typeof attr)}>
            <option value="7d_click_1d_view">7-day click or 1-day view</option>
            <option value="7d_click">7-day click</option>
            <option value="1d_click">1-day click</option>
          </select>
          <button type="button" disabled={pending} onClick={() => onOptimization(goal, attr)} className="mt-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Save delivery</button>
          <Field label="Pacing">
            <select className={`${inputClass} mt-1`} value={pacing} onChange={(e) => setPacing(e.target.value as typeof pacing)}>
              {META_PACING_TYPES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </Field>
          <button type="button" disabled={pending} onClick={() => onPacing(pacing)} className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40">Save pacing</button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Freq / days"><input className={inputClass} value={freqDays} onChange={(e) => setFreqDays(e.target.value)} /></Field>
            <Field label="Max impressions"><input className={inputClass} value={freqCap} onChange={(e) => setFreqCap(e.target.value)} /></Field>
          </div>
          <p className="mt-1 text-[10px] text-white/35">0 max impressions clears the cap. Advantage+ shopping may reject this.</p>
          <button type="button" disabled={pending} onClick={() => onFrequency(Number(freqDays), Number(freqCap))} className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40">Save frequency</button>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Placements</h3>
          <p className="mt-1 text-xs text-white/45">Writes merge into the live targeting spec so countries and audiences stay. Advantage+ shopping may reject a manual list.</p>
          <label className="mt-3 flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={automaticPlacements} onChange={(e) => setAutomaticPlacements(e.target.checked)} />
            Advantage+ placements (all)
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {META_PUBLISHER_PLATFORMS.map((row) => {
              const on = platforms.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  disabled={automaticPlacements}
                  onClick={() =>
                    setPlatforms((current) =>
                      current.includes(row.value) ? current.filter((value) => value !== row.value) : [...current, row.value],
                    )
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px] font-semibold disabled:opacity-40",
                    on && !automaticPlacements ? "border-blue-400/40 bg-blue-500/15 text-blue-100" : "border-white/10 text-white/50",
                  )}
                >
                  {row.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onPlacements({ automatic: automaticPlacements, platforms })}
            className="mt-3 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save placements
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Schedule</h3>
          <Field label="Start"><input className={inputClass} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <div className="mt-2" />
          <Field label="End"><input className={inputClass} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Daypart start">
            <input className={inputClass} type="time" value={daypartStart} onChange={(e) => setDaypartStart(e.target.value)} />
          </Field>
          <Field label="Daypart end">
            <input className={inputClass} type="time" value={daypartEnd} onChange={(e) => setDaypartEnd(e.target.value)} />
          </Field>
          <label className="mt-3 flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={applyDaypart} onChange={(e) => setApplyDaypart(e.target.checked)} />
            Limit delivery to these hours and days
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {META_SCHEDULE_DAYS.map((day) => {
              const on = days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() =>
                    setDays((current) =>
                      current.includes(day.value)
                        ? current.filter((value) => value !== day.value)
                        : [...current, day.value].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)),
                    )
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px] font-semibold",
                    on ? "border-blue-400/40 bg-blue-500/15 text-blue-100" : "border-white/10 text-white/50",
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSchedule({
              startTime: start ? new Date(start).toISOString() : undefined,
              endTime: end ? new Date(end).toISOString() : undefined,
              ...(applyDaypart
                ? {
                    startMinute: clockToMinutes(daypartStart),
                    endMinute: clockToMinutes(daypartEnd),
                    days: days.length ? days : [1, 2, 3, 4, 5],
                  }
                : {}),
            })}
            className="mt-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save schedule
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Value rules</h3>
        <p className="mt-1 text-xs text-white/45">Bid more or less for a country without splitting the ad set. Max 6 sets / account, 10 rules, first match wins.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${inputClass} max-w-[80px]`} value={ruleCountry} onChange={(e) => setRuleCountry(e.target.value)} />
          <select className={`${inputClass} max-w-[120px]`} value={ruleSign} onChange={(e) => setRuleSign(e.target.value as typeof ruleSign)}>
            <option value="INCREASE">Boost +%</option>
            <option value="DECREASE">Reduce −%</option>
          </select>
          <input className={`${inputClass} max-w-[80px]`} value={rulePct} onChange={(e) => setRulePct(e.target.value)} />
          <button
            type="button"
            disabled={pending}
            onClick={() => onCreateRules(`${ruleSign === "DECREASE" ? "Cut" : "Boost"} ${ruleCountry}`, [{
              name: `${ruleSign === "DECREASE" ? "−" : "+"}${rulePct}% ${ruleCountry}`,
              adjustSign: ruleSign,
              adjustValue: Number(rulePct),
              criteriaType: "LOCATION",
              criteriaValues: [ruleCountry.toUpperCase()],
            }])}
            className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Create + attach
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onCreateRules("Boost iOS", [{
              name: "+15% iOS",
              adjustSign: "INCREASE",
              adjustValue: 15,
              criteriaType: "OS_TYPE",
              criteriaValues: ["iOS"],
            }])}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40"
          >
            +15% iOS
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onCreateRules("Cut Android", [{
              name: "−10% Android",
              adjustSign: "DECREASE",
              adjustValue: 10,
              criteriaType: "OS_TYPE",
              criteriaValues: ["Android"],
            }])}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40"
          >
            −10% Android
          </button>
        </div>
        {valueRules.length > 0 && (
          <div className="mt-3 flex gap-2">
            <select className={inputClass} value={attachId} onChange={(e) => setAttachId(e.target.value)}>
              {valueRules.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <button type="button" disabled={pending || !attachId} onClick={() => onAttach(attachId)} className="rounded-lg border border-white/10 px-3 text-xs text-white disabled:opacity-40">Attach existing</button>
          </div>
        )}
      </div>
      <button type="button" disabled={pending} onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80">
        <Copy className="h-3.5 w-3.5" /> Duplicate ad set as paused
      </button>
    </div>
  );
}

function AdPanel({
  ad,
  pages,
  pending,
  confirmLive,
  onStatus,
  onRename,
  onDuplicate,
  onSwap,
  onAdd,
}: {
  ad: MetaTreeAd;
  pages: Array<{ id: string; name: string; instagramUserId?: string }>;
  pending: boolean;
  confirmLive: boolean;
  onStatus: (status: "ACTIVE" | "PAUSED" | "ARCHIVED") => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onSwap: (payload: {
    pageId: string;
    primaryText: string;
    headline: string;
    landingUrl: string;
    cta: string;
    description?: string;
    urlTags?: string;
    instagramUserId?: string;
    standardEnhancements: boolean;
  }) => void;
  onAdd: (payload: {
    name: string;
    pageId: string;
    primaryText: string;
    headline: string;
    landingUrl: string;
    cta: string;
    description?: string;
    urlTags?: string;
    instagramUserId?: string;
    standardEnhancements: boolean;
  }) => void;
}) {
  const defaultPage = ad.creative.pageId || pages[0]?.id || "";
  const [pageId, setPageId] = useState(defaultPage);
  const [headline, setHeadline] = useState(ad.creative.title ?? "");
  const [body, setBody] = useState(ad.creative.body ?? "");
  const [url, setUrl] = useState(ad.creative.link ?? "");
  const [cta, setCta] = useState(ad.creative.cta ?? "SHOP_NOW");
  const [description, setDescription] = useState(ad.creative.description ?? "");
  const [urlTags, setUrlTags] = useState(ad.creative.urlTags ?? "utm_source=meta&utm_medium=paid");
  const [instagramUserId, setInstagramUserId] = useState(ad.creative.instagramUserId || pages.find((p) => p.id === defaultPage)?.instagramUserId || "");
  const [enhancements, setEnhancements] = useState(true);
  const [newName, setNewName] = useState(`${ad.name} · new hook`);

  useEffect(() => {
    setPageId(ad.creative.pageId || pages[0]?.id || "");
    setHeadline(ad.creative.title ?? "");
    setBody(ad.creative.body ?? "");
    setUrl(ad.creative.link ?? "");
    setCta(ad.creative.cta ?? "SHOP_NOW");
    setDescription(ad.creative.description ?? "");
    setUrlTags(ad.creative.urlTags ?? "utm_source=meta&utm_medium=paid");
    setInstagramUserId(ad.creative.instagramUserId || pages.find((p) => p.id === (ad.creative.pageId || pages[0]?.id))?.instagramUserId || "");
  }, [ad, pages]);

  return (
    <div className="space-y-6">
      <StatusButtons onStatus={onStatus} pending={pending} confirmLive={confirmLive} />
      <RenameRow value={ad.name} pending={pending} onSave={onRename} />
      {ad.previewLink && (
        <a href={ad.previewLink} target="_blank" rel="noreferrer" className="text-xs text-blue-300 hover:underline">Open Meta preview</a>
      )}
      {Boolean(ad.issues) && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {JSON.stringify(ad.issues).slice(0, 280)}
        </p>
      )}
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Replace creative</h3>
        <p className="mt-1 text-xs text-white/45">Creates a new creative and attaches it. The old one is not rewritten.</p>
        <div className="mt-3 space-y-3">
          <Field label="Page">
            <select
              className={inputClass}
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                const page = pages.find((row) => row.id === e.target.value);
                if (page?.instagramUserId) setInstagramUserId(page.instagramUserId);
              }}
            >
              {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
            </select>
          </Field>
          <Field label="Headline"><input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
          <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Primary text"><textarea className={`${inputClass} min-h-[90px]`} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <Field label="Destination URL"><input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
          <Field label="URL tags"><input className={inputClass} value={urlTags} onChange={(e) => setUrlTags(e.target.value)} /></Field>
          <Field label="Instagram actor ID"><input className={inputClass} value={instagramUserId} onChange={(e) => setInstagramUserId(e.target.value)} /></Field>
          <Field label="CTA">
            <select className={inputClass} value={cta} onChange={(e) => setCta(e.target.value)}>
              {META_CTA_OPTIONS.map((row) => <option key={row} value={row}>{row}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={enhancements} onChange={(e) => setEnhancements(e.target.checked)} />
            Advantage+ Creative standard enhancements
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !pageId}
            onClick={() => onSwap({
              pageId,
              primaryText: body,
              headline,
              landingUrl: url,
              cta,
              description,
              urlTags,
              instagramUserId: instagramUserId || undefined,
              standardEnhancements: enhancements,
            })}
            className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Attach new creative to this ad
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={onDuplicate} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80">
          <Copy className="h-3.5 w-3.5" /> Duplicate this ad as paused
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">Add a paused ad (new hook)</h3>
        <Field label="Ad name"><input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
        <button
          type="button"
          disabled={pending || !pageId}
          onClick={() => onAdd({
            name: newName,
            pageId,
            primaryText: body,
            headline,
            landingUrl: url,
            cta,
            description,
            urlTags,
            instagramUserId: instagramUserId || undefined,
            standardEnhancements: enhancements,
          })}
          className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40"
        >
          Create paused ad in this ad set
        </button>
      </div>
    </div>
  );
}
