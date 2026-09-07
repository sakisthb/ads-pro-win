"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  GitCompare,
  HelpCircle,
  Inbox,
  Rocket,
  Shield,
  ShoppingBag,
  Star,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DIAGNOSIS_COLOR,
  DIAGNOSIS_LABEL,
  DIAGNOSIS_PLAYBOOK,
  PLATFORM_LABEL,
  adsManagerUrl,
  cadenceLabel,
  cadenceProgress,
  canonicalizeShopUrl,
  fatigueCsv,
  stashLaunchDraft,
  type FatigueAd,
  type FatigueCalendarEntry,
  type FatigueDiagnosis,
  type FatigueDiagnosisMix,
  type FatigueEconomics,
  type FatigueInboxItem,
  type FatigueLaunchDraft,
  type FatigueWinnerSwap,
  type FatigueHealthReport,
  type FatigueRewrite,
} from "@/lib/creative-fatigue";
import { useCurrency } from "@/components/providers/currency";

export const WATCHLIST_KEY = "creative-fatigue-watchlist";

export function useWatchlist() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) setIds(new Set(parsed.filter((id) => typeof id === "string")));
    } catch {
      /* ignore corrupt watchlist */
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { ids, toggle, watching: (id: string) => ids.has(id) };
}

export function downloadFatigueCsv(ads: FatigueAd[]) {
  const blob = new Blob([fatigueCsv(ads)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creative-fatigue-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyBrief(brief: string) {
  await navigator.clipboard.writeText(brief);
  toast.success("Production brief copied");
}

export function CadenceBar({ ad }: { ad: FatigueAd }) {
  const pct = cadenceProgress(ad);
  const color =
    ad.daysUntilRefresh < 0 ? "#fb7185" : ad.daysUntilRefresh <= 3 ? "#fbbf24" : "#34d399";
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Cadence</span>
        <span className="tabular-nums" style={{ color }}>
          {cadenceLabel(ad)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function DiagnosisMixBar({
  mix,
  selected = "all",
  onSelect,
}: {
  mix: FatigueDiagnosisMix[];
  selected?: FatigueDiagnosis | "all";
  onSelect?: (diagnosis: FatigueDiagnosis | "all") => void;
}) {
  const { format } = useCurrency();
  const totalSpend = mix.reduce((s, r) => s + r.spend, 0);
  if (mix.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="mb-3 text-sm font-semibold text-white">Spend by diagnosis</h2>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
        {mix.map((row) => (
          <button
            key={row.diagnosis}
            type="button"
            title={`${DIAGNOSIS_LABEL[row.diagnosis]} · ${format(row.spend)}`}
            onClick={() =>
              onSelect?.(selected === row.diagnosis ? "all" : row.diagnosis)
            }
            className="h-full min-w-[4px] transition-opacity hover:opacity-80"
            style={{
              width: `${totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0}%`,
              backgroundColor: DIAGNOSIS_COLOR[row.diagnosis],
              opacity: selected === "all" || selected === row.diagnosis ? 1 : 0.35,
            }}
            aria-pressed={selected === row.diagnosis}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {mix.map((row) => {
          const active = selected === row.diagnosis;
          return (
            <button
              key={row.diagnosis}
              type="button"
              onClick={() => onSelect?.(active ? "all" : row.diagnosis)}
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: DIAGNOSIS_COLOR[row.diagnosis] }}
              />
              {DIAGNOSIS_LABEL[row.diagnosis]} · {row.count} · {format(row.spend)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ActionInbox({
  items,
  onOpen,
}: {
  items: FatigueInboxItem[];
  onOpen: (adId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-rose-400" />
        <h2 className="text-sm font-semibold text-white">Today&apos;s action inbox</h2>
        <span className="ml-auto text-[11px] text-zinc-500">Ranked by spend × fatigue</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing urgent in this window — keep the rotation.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.adId)}
                className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-left hover:border-white/15"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[11px] font-bold text-rose-300">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">{item.why}</span>
                  <span className="mt-1 block text-[11px] text-zinc-400">{item.playbook}</span>
                </span>
                <span
                  className="mt-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: DIAGNOSIS_COLOR[item.diagnosis],
                    backgroundColor: `${DIAGNOSIS_COLOR[item.diagnosis]}22`,
                  }}
                >
                  {DIAGNOSIS_LABEL[item.diagnosis]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function RefreshCalendar({
  entries,
  onOpen,
}: {
  entries: FatigueCalendarEntry[];
  onOpen: (adId: string) => void;
}) {
  const { format } = useCurrency();
  const overdue = entries.filter((e) => e.bucket === "overdue");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-white">Refresh calendar</h2>
        <span className="ml-auto text-[11px] text-zinc-500">Next 14 days + overdue</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No cadence deadlines in the next two weeks.</p>
      ) : (
        <div className="space-y-2">
          {overdue.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-300">
              {overdue.length} overdue
            </p>
          )}
              {entries.map((entry) => (
            <button
              key={entry.adId}
              type="button"
              onClick={() => onOpen(entry.adId)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-left hover:border-white/15"
            >
              <span
                className={`w-20 shrink-0 text-[11px] font-semibold tabular-nums ${
                  entry.bucket === "overdue"
                    ? "text-rose-300"
                    : entry.bucket === "today"
                      ? "text-amber-300"
                      : "text-zinc-400"
                }`}
              >
                {entry.dateLabel}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">{entry.name}</span>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {PLATFORM_LABEL[entry.platform]} · {format(entry.spend)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WinnerSwaps({
  swaps,
  onOpen,
}: {
  swaps: FatigueWinnerSwap[];
  onOpen: (adId: string) => void;
}) {
  const { format } = useCurrency();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-emerald-300" />
        <h2 className="text-sm font-semibold text-white">Winner swaps</h2>
      </div>
      {swaps.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No dying ad has a same-platform winner with {"25%+"} higher CTR yet.
        </p>
      ) : (
        <div className="space-y-2">
          {swaps.map((swap) => (
            <div
              key={`${swap.tiredAdId}-${swap.winnerAdId}`}
              className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
            >
              <p className="text-xs text-zinc-400">
                Replace{" "}
                <button type="button" className="text-rose-300 hover:underline" onClick={() => onOpen(swap.tiredAdId)}>
                  {swap.tiredName}
                </button>{" "}
                with{" "}
                <button
                  type="button"
                  className="text-emerald-300 hover:underline"
                  onClick={() => onOpen(swap.winnerAdId)}
                >
                  {swap.winnerName}
                </button>
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {PLATFORM_LABEL[swap.platform]} · {`${swap.tiredCtr.toFixed(2)}%`} → {`${swap.winnerCtr.toFixed(2)}%`} CTR
                {" · "}
                {`+${swap.liftPct.toFixed(0)}%`} lift · {format(swap.spend)} at risk
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExportButtons({
  ads,
  brief,
  launchDraft,
}: {
  ads: FatigueAd[];
  brief: string;
  launchDraft?: FatigueLaunchDraft;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => {
          downloadFatigueCsv(ads);
          toast.success(`Exported ${ads.length} ads`);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" /> CSV
      </button>
      <button
        type="button"
        onClick={() => copyBrief(brief)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
      >
        <ClipboardCopy className="h-3.5 w-3.5" /> Copy brief
      </button>
      {launchDraft ? (
        <Link
          href="/campaign-launcher"
          onClick={() => stashLaunchDraft(launchDraft)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
        >
          <Rocket className="h-3.5 w-3.5" /> Open in launcher
        </Link>
      ) : null}
    </div>
  );
}

const CHECK_ICON = {
  pass: CheckCircle2,
  warn: HelpCircle,
  fail: XCircle,
  unknown: HelpCircle,
} as const;

const CHECK_COLOR = {
  pass: "text-emerald-300",
  warn: "text-amber-300",
  fail: "text-rose-300",
  unknown: "text-zinc-400",
} as const;

export function EconomicsPanel({ economics }: { economics: FatigueEconomics }) {
  const { format } = useCurrency();
  const { funnel, store, landing, checks, cvrChangePct, pixelGapPct } = economics;
  const landingHref = canonicalizeShopUrl(landing.url ?? store.website);
  const hrefFor = (id: string) => {
    if (id === "pixel" && !store.connected) return "/connections?connect=woocommerce";
    if (id === "mer") return "/attribution";
    if (id === "stock") return "/customers";
    if (id === "landing" || id === "offer") return landingHref;
    return null;
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-orange-300" />
        <h2 className="text-sm font-semibold text-white">CPA forensics</h2>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Click → purchase</p>
          <p className="mt-1 text-sm font-semibold text-white">{funnel.clickToPurchasePct.toFixed(2)}%</p>
          <p className={`text-[11px] ${cvrChangePct < 0 ? "text-rose-300" : "text-zinc-500"}`}>
            {cvrChangePct >= 0 ? "+" : ""}
            {cvrChangePct.toFixed(0)}% vs week 1
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Meta vs store</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {funnel.purchases.toFixed(0)} / {store.connected ? store.orders : "—"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {pixelGapPct == null
              ? "Woo not synced"
              : `${pixelGapPct >= 0 ? "+" : ""}${pixelGapPct.toFixed(0)}% vs orders`}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {economics.mer != null && funnel.roas != null
              ? "Pixel vs till MER"
              : store.connected && store.aov > 0
                ? "Store AOV"
                : "Reported ROAS"}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {economics.mer != null && funnel.roas != null
              ? `${funnel.roas.toFixed(1)}x / ${economics.mer.toFixed(1)}x`
              : store.connected && store.aov > 0
                ? format(store.aov)
                : funnel.roas != null
                  ? `${funnel.roas.toFixed(2)}x`
                  : "—"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {economics.mer != null && funnel.roas != null
              ? "Pixel ROAS / store MER — do not scale from MER"
              : store.connected && store.aovBaseline > 0
                ? `${store.aovRecent >= store.aovBaseline ? "+" : ""}${(((store.aovRecent - store.aovBaseline) / store.aovBaseline) * 100).toFixed(0)}% vs first half`
                : funnel.roas != null
                  ? `${format(funnel.purchaseValue)} purchase value`
                  : "No purchase value in insights"}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Live sale</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {landing.maxDiscountPct != null
              ? `−${landing.maxDiscountPct}%`
              : landing.fetched
                ? "No % found"
                : landing.catalogAttempted
                  ? "Unread"
                  : "—"}
          </p>
          <p className="text-[11px] text-zinc-500">
            {landing.onSaleCount > 0
              ? `${landing.onSaleCount} on-sale SKUs`
              : landing.catalogAttempted
                ? "Meta catalog empty"
                : funnel.landingRatePct != null
                  ? `${funnel.landingRatePct.toFixed(0)}% LPV`
                  : "Need landing or catalog"}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {checks.map((check) => {
          const Icon = CHECK_ICON[check.status];
          const href = hrefFor(check.id);
          return (
            <li key={check.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CHECK_COLOR[check.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">{check.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{check.detail}</p>
              </div>
              {href ? (
                <Link
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-sky-300 hover:underline"
                >
                  {check.id === "stock" ? (
                    <>
                      <ShoppingBag className="h-3 w-3" /> Catalog
                    </>
                  ) : check.id === "pixel" ? (
                    <>
                      Connect Woo <ExternalLink className="h-3 w-3" />
                    </>
                  ) : check.id === "offer" ? (
                    <>
                      Open landing <ExternalLink className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Open <ExternalLink className="h-3 w-3" />
                    </>
                  )}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FatigueTable({
  ads,
  watching,
  compareIds,
  onOpen,
  onToggleWatch,
  onToggleCompare,
}: {
  ads: FatigueAd[];
  watching: (id: string) => boolean;
  compareIds: string[];
  onOpen: (adId: string) => void;
  onToggleWatch: (adId: string) => void;
  onToggleCompare: (adId: string) => void;
}) {
  const { format, formatExact } = useCurrency();
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Creative</th>
            <th className="px-3 py-2 font-medium">Diagnosis</th>
            <th className="px-3 py-2 font-medium">Score</th>
            <th className="px-3 py-2 font-medium">CTR</th>
            <th className="px-3 py-2 font-medium">Drop</th>
            <th className="px-3 py-2 font-medium">Proj 7d</th>
            <th className="px-3 py-2 font-medium">Freq</th>
            <th className="px-3 py-2 font-medium">CPA</th>
            <th className="px-3 py-2 font-medium">Cadence</th>
            <th className="px-3 py-2 font-medium">Spend</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr
              key={ad.adId}
              className="cursor-pointer border-b border-white/5 hover:bg-white/[0.04]"
              onClick={() => onOpen(ad.adId)}
            >
              <td className="max-w-[220px] px-3 py-2">
                <p className="truncate font-medium text-white">{ad.creativeTitle || ad.adName}</p>
                <p className="truncate text-[10px] text-zinc-500">
                  {PLATFORM_LABEL[ad.platform]} · {ad.format} · {ad.adsetName}
                </p>
              </td>
              <td className="px-3 py-2" style={{ color: DIAGNOSIS_COLOR[ad.diagnosis] }}>
                {DIAGNOSIS_LABEL[ad.diagnosis]}
              </td>
              <td className="px-3 py-2 tabular-nums text-white">{ad.fatigueScore}</td>
              <td className="px-3 py-2 tabular-nums text-white">{`${ad.ctr.toFixed(2)}%`}</td>
              <td className={`px-3 py-2 tabular-nums ${ad.ctrDropPct < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                {`${ad.ctrDropPct.toFixed(0)}%`}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-300">
                {ad.projectedCtr7d == null ? "—" : `${ad.projectedCtr7d.toFixed(2)}%`}
              </td>
              <td className="px-3 py-2 tabular-nums text-white">{ad.frequency.toFixed(2)}</td>
              <td className="px-3 py-2 tabular-nums text-white">
                {ad.cpa == null ? "—" : formatExact(ad.cpa)}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-300">{cadenceLabel(ad)}</td>
              <td className="px-3 py-2 tabular-nums text-white">{format(ad.spend)}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleWatch(ad.adId)}
                    className={watching(ad.adId) ? "text-amber-300" : "text-zinc-500 hover:text-white"}
                    aria-label="Watch"
                  >
                    <Star className={`h-3.5 w-3.5 ${watching(ad.adId) ? "fill-amber-300" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCompare(ad.adId)}
                    className={compareIds.includes(ad.adId) ? "text-sky-300" : "text-zinc-500 hover:text-white"}
                    aria-label="Compare"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Playbook({ ad }: { ad: FatigueAd }) {
  const play = DIAGNOSIS_PLAYBOOK[ad.diagnosis];
  const manager = adsManagerUrl(ad);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-semibold text-white">{play.headline}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-400">
        {play.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {ad.diagnosis === "cpa_inflation" && ad.catalogTemplate ? (
        <p className="mt-2 text-xs text-orange-200">
          Catalog / DPA: compare feed price and availability to the live PDP before touching the Advantage+ ad.
        </p>
      ) : null}
      {manager && (
        <a
          href={manager}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline"
        >
          Open in Ads Manager <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export function CompareDialog({
  ads,
  open,
  onClose,
}: {
  ads: FatigueAd[];
  open: boolean;
  onClose: () => void;
}) {
  const { format, formatExact } = useCurrency();
  if (!open || ads.length < 2) return null;
  const [a, b] = ads;
  const rows: Array<{ label: string; av: string; bv: string; worse?: "a" | "b" | null }> = [
    { label: "Diagnosis", av: DIAGNOSIS_LABEL[a.diagnosis], bv: DIAGNOSIS_LABEL[b.diagnosis] },
    { label: "Score", av: String(a.fatigueScore), bv: String(b.fatigueScore), worse: a.fatigueScore > b.fatigueScore ? "a" : "b" },
    { label: "CTR", av: `${a.ctr.toFixed(2)}%`, bv: `${b.ctr.toFixed(2)}%`, worse: a.ctr < b.ctr ? "a" : "b" },
    { label: "CTR vs week 1", av: `${a.ctrDropPct.toFixed(0)}%`, bv: `${b.ctrDropPct.toFixed(0)}%`, worse: a.ctrDropPct < b.ctrDropPct ? "a" : "b" },
    {
      label: "Projected CTR 7d",
      av: a.projectedCtr7d == null ? "—" : `${a.projectedCtr7d.toFixed(2)}%`,
      bv: b.projectedCtr7d == null ? "—" : `${b.projectedCtr7d.toFixed(2)}%`,
    },
    { label: "Frequency", av: a.frequency.toFixed(2), bv: b.frequency.toFixed(2), worse: a.frequency > b.frequency ? "a" : "b" },
    { label: "CPA", av: a.cpa == null ? "—" : formatExact(a.cpa), bv: b.cpa == null ? "—" : formatExact(b.cpa) },
    {
      label: "CPA vs week 1",
      av: `${a.cpaChangePct.toFixed(0)}%`,
      bv: `${b.cpaChangePct.toFixed(0)}%`,
      worse: a.cpaChangePct > b.cpaChangePct ? "a" : "b",
    },
    { label: "Days live", av: String(a.daysLive), bv: String(b.daysLive) },
    { label: "Cadence", av: cadenceLabel(a), bv: cadenceLabel(b) },
    { label: "Spend", av: format(a.spend), bv: format(b.spend) },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Compare creatives</p>
            <h3 className="mt-1 text-base font-semibold text-white">Side by side</h3>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-white">
            Close
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <p className="text-zinc-500">Metric</p>
          <p className="truncate font-medium text-white">{a.creativeTitle || a.adName}</p>
          <p className="truncate font-medium text-white">{b.creativeTitle || b.adName}</p>
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <p className="border-t border-white/5 py-2 text-zinc-500">{row.label}</p>
              <p className={`border-t border-white/5 py-2 tabular-nums ${row.worse === "a" ? "text-rose-300" : "text-white"}`}>
                {row.av}
              </p>
              <p className={`border-t border-white/5 py-2 tabular-nums ${row.worse === "b" ? "text-rose-300" : "text-white"}`}>
                {row.bv}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GRADE_TONE: Record<string, string> = {
  A: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  B: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  C: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  D: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  F: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export function HealthPanel({ health }: { health: FatigueHealthReport }) {
  if (health.checks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-violet-300" />
        <h2 className="text-sm font-semibold text-white">Creative health audit</h2>
        <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${GRADE_TONE[health.grade] ?? GRADE_TONE.C}`}>
          {health.grade} · {health.score}/100
        </span>
      </div>
      <ul className="space-y-2">
        {health.checks.map((check) => {
          const Icon = CHECK_ICON[check.status];
          return (
            <li key={check.id} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CHECK_COLOR[check.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">
                  {check.id.replace(/-meta|-google|-tiktok/i, "")} · {check.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RewritePack({ rewrites }: { rewrites: FatigueRewrite[] }) {
  if (rewrites.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCopy className="h-4 w-4 text-sky-300" />
        <h2 className="text-sm font-semibold text-white">Copy &amp; production pack</h2>
        <span className="ml-auto text-[11px] text-zinc-500">Does not write to Meta</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rewrites.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-white">{row.label}</p>
                <p className="mt-0.5 text-[11px] text-sky-200">{row.headline}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`${row.headline}\n\n${row.body}`);
                  toast.success("Copied rewrite");
                }}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:text-white"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-300">{row.body}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{row.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
