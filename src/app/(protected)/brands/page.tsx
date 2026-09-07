"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Bricolage_Grotesque } from "next/font/google";
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/react";
import {
  MARKET_MODE_LABEL,
  parseBrandMarketMode,
  type BrandMarketMode,
} from "@/lib/market-desk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnimatedSection } from "@/components/ui/animated-section";
import { cn } from "@/lib/utils";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

/* -------------------------------------------------------------------------- */
/* Types & Helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Brand row as returned by the brands.list query (with ad-account counts). */
type Brand = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  marketMode?: string | null;
  createdAt: Date;
  _count: { adAccounts: number };
};

/** Deterministic gradient palette — a brand always renders the same tile. */
const AVATAR_GRADIENTS = [
  "from-indigo-500 via-violet-500 to-purple-600",
  "from-cyan-500 via-sky-500 to-blue-600",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-fuchsia-500 via-purple-500 to-indigo-600",
  "from-rose-400 via-pink-500 to-fuchsia-600",
] as const;

function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/** Normalize a stored website value into a clickable href. */
function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                   */
/* -------------------------------------------------------------------------- */

export default function BrandsPage() {
  const utils = api.useUtils();

  // ── Brands query ──
  const {
    data: brandsData,
    isLoading,
    error,
    refetch,
  } = api.brands.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const brands = useMemo(() => brandsData ?? [], [brandsData]);

  // ── Mutations ──
  const createMutation = api.brands.create.useMutation({
    onError: (err) => toast.error(err.message || "Failed to create brand"),
  });
  const updateMutation = api.brands.update.useMutation({
    onError: (err) => toast.error(err.message || "Failed to update brand"),
  });
  const deleteMutation = api.brands.delete.useMutation({
    onError: (err) => toast.error(err.message || "Failed to delete brand"),
  });

  // ── Form dialog state (shared by create & edit) ──
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [marketMode, setMarketMode] = useState<BrandMarketMode>("inherit");
  const [submitting, setSubmitting] = useState(false);

  // ── Delete confirmation state ──
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setWebsite("");
    setMarketMode("inherit");
    setFormOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setName(brand.name);
    setWebsite(brand.website ?? "");
    setMarketMode(parseBrandMarketMode(brand.marketMode));
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;

    setSubmitting(true);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: trimmedName,
          website: website.trim() || "",
          marketMode,
        });
        toast.success(`Brand "${trimmedName}" updated`);
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          website: website.trim() || undefined,
          marketMode,
        });
        toast.success(`Brand "${trimmedName}" created`);
      }
      setFormOpen(false);
      await utils.brands.list.invalidate();
    } catch {
      // Toast handled by mutation onError
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast.success(`Brand "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await utils.brands.list.invalidate();
    } catch {
      // Toast handled by mutation onError
    } finally {
      setDeleting(false);
    }
  };

  const totalAccounts = useMemo(
    () => brands.reduce((sum, b) => sum + b._count.adAccounts, 0),
    [brands],
  );

  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      {/* ── Header ── */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-purple-300/80">
          <span className="h-px w-6 bg-gradient-to-r from-purple-400/60 to-transparent" />
          Brand Management
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className={cn(
                "bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl",
                bricolage.className,
              )}
            >
              Brands
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/45">
              Organize your multi-brand workspace. Each brand groups its ad
              accounts, keeping data isolated and reporting clean.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/40"
          >
            <Plus className="h-3.5 w-3.5" /> Create Brand
          </button>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
      </header>

      {/* ── Loading state ── */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-sm text-white/50">
          <Loader2 className="h-5 w-5 animate-spin text-purple-300" />
          Loading brands…
        </div>
      )}

      {/* ── Error state ── */}
      {error && !isLoading && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Failed to load brands</p>
            <p className="mt-0.5 text-xs text-red-300/70">{error.message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-200 hover:text-red-100"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !error && brands.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 ring-1 ring-inset ring-white/10">
            <Layers className="h-7 w-7 text-purple-300" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-white/70">
              No brands in this workspace yet
            </p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-white/40">
              Brands let you run multiple stores or product lines under one
              organization — each with its own connected ad accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/40"
          >
            <Plus className="h-3.5 w-3.5" /> Create your first brand
          </button>
        </div>
      )}

      {/* ── Summary + Brand grid ── */}
      {!isLoading && !error && brands.length > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 text-purple-200 ring-1 ring-inset ring-white/10">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-white/55">
                <span className="font-semibold text-white">{brands.length}</span>{" "}
                {brands.length === 1 ? "brand" : "brands"} ·{" "}
                <span className="font-semibold text-white">{totalAccounts}</span>{" "}
                connected {totalAccounts === 1 ? "account" : "accounts"}
              </p>
              <p className="text-[11px] text-white/35">
                {totalAccounts > 0
                  ? "Ad accounts inherit their brand's data isolation."
                  : "Connect ad accounts from a brand to start syncing."}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text font-mono text-sm font-semibold tabular-nums text-transparent">
                {brands.length}
              </span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min((brands.length / 12) * 100, 100)}%`,
                  }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {brands.map((brand, i) => (
              <AnimatedSection key={brand.id} delay={i * 0.06} variant="fadeInUp">
                <BrandCard
                  brand={brand}
                  onEdit={() => openEdit(brand)}
                  onDelete={() => setDeleteTarget(brand)}
                />
              </AnimatedSection>
            ))}
          </div>
        </>
      )}

      {/* ── Create / Edit dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="border border-white/10 bg-zinc-950/95 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {editing ? `Edit "${editing.name}"` : "Create brand"}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/50">
              {editing
                ? "Update the brand details. Its slug stays unchanged."
                : "A slug is generated from the name automatically."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="brand-name"
                className="text-xs font-medium text-white/60"
              >
                Brand name
              </label>
              <input
                id="brand-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Footwear"
                autoFocus
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-purple-500/60 focus:bg-white/[0.06]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="brand-website"
                className="text-xs font-medium text-white/60"
              >
                Website{" "}
                <span className="font-normal text-white/30">(optional)</span>
              </label>
              <input
                id="brand-website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-purple-500/60 focus:bg-white/[0.06]"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-white/60">Shop identity</legend>
              <p className="text-[11px] leading-relaxed text-white/40">
                Retail-only and wholesale-only shops inherit that desk for guests and unnamed ads.
                Mixed shops (BAGTOBAG) classify per order. Sync Woo after you change this.
              </p>
              <div className="grid gap-2">
                {(["inherit", "mixed", "retail", "wholesale"] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                      marketMode === value
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-50"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="brand-market-mode"
                      className="mt-0.5"
                      checked={marketMode === value}
                      onChange={() => setMarketMode(value)}
                    />
                    <span>{MARKET_MODE_LABEL[value]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editing ? "Saving…" : "Creating…"}
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create brand
                </>
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="border border-red-400/20 bg-zinc-950/95 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 ring-1 ring-inset ring-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </span>
              Delete brand
            </DialogTitle>
            <DialogDescription className="text-sm text-white/50">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-3 pt-1">
              <p className="text-sm leading-relaxed text-white/70">
                Delete{" "}
                <span className="font-semibold text-white">
                  &ldquo;{deleteTarget.name}&rdquo;
                </span>{" "}
                permanently?
              </p>
              {deleteTarget._count.adAccounts > 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2.5 text-xs text-red-200">
                  <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Its{" "}
                    <span className="font-semibold">
                      {deleteTarget._count.adAccounts} connected ad{" "}
                      {deleteTarget._count.adAccounts === 1
                        ? "account"
                        : "accounts"}
                    </span>{" "}
                    will be disconnected and removed along with the brand.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/50">
                  <Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>No ad accounts are connected to this brand.</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-all hover:shadow-red-600/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" /> Delete brand
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* BrandCard                                                                   */
/* -------------------------------------------------------------------------- */

interface BrandCardProps {
  brand: Brand;
  onEdit: () => void;
  onDelete: () => void;
}

function BrandCard({ brand, onEdit, onDelete }: BrandCardProps) {
  const gradient = gradientForName(brand.name);
  const accounts = brand._count.adAccounts;

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-colors hover:border-white/20">
      {/* corner glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40",
          gradient,
        )}
      />

      <div className="relative flex h-full flex-col gap-4">
        {/* Identity row */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold text-white shadow-lg",
              gradient,
            )}
          >
            {brand.name.trim()[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-white">
              {brand.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/50">
                /{brand.slug}
              </span>
              <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
                {MARKET_MODE_LABEL[parseBrandMarketMode(brand.marketMode)]}
              </span>
              {brand.website ? (
                <a
                  href={websiteHref(brand.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-[220px] items-center gap-1 truncate text-[11px] text-purple-300/80 transition-colors hover:text-purple-200"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{brand.website}</span>
                </a>
              ) : (
                <span className="text-[11px] italic text-white/25">
                  No website
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset",
              accounts > 0
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
                : "bg-white/5 text-white/40 ring-white/10",
            )}
          >
            <Plug className="h-3 w-3" />
            {accounts} connected {accounts === 1 ? "account" : "accounts"}
          </span>
          <span className="text-[10px] text-white/30">
            Created {formatDistanceToNow(new Date(brand.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06]"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] font-semibold text-white/50 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
