'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Check,
  ChevronDown,
  Crown,
  Eye,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/components/providers/trpc-provider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type OrgListItem = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  isDefault: boolean;
  isActive: boolean;
  isSample: boolean;
  memberCount: number;
};

/** Small colored pill that reflects an organization's plan tier. */
function PlanBadge({ plan }: { plan: string }) {
  const styles =
    plan === 'enterprise'
      ? 'bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30'
      : plan === 'pro'
        ? 'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30'
        : 'bg-white/5 text-white/40 ring-1 ring-inset ring-white/10';
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide',
        styles,
      )}
    >
      {plan}
    </span>
  );
}

/** Role icon: Crown for owner, Eye for viewer, Users for member/admin. */
function RoleIcon({ role }: { role: string }) {
  const className = 'h-3 w-3';
  switch (role) {
    case 'owner':
      return <Crown className={cn(className, 'text-amber-400')} />;
    case 'viewer':
      return <Eye className={cn(className, 'text-white/40')} />;
    default:
      return <Users className={cn(className, 'text-white/40')} />;
  }
}

/** Gradient tile showing the org's first letter; sample orgs use a warm gradient. */
function OrgAvatar({
  name,
  isSample,
  size = 'md',
}: {
  name: string;
  isSample: boolean;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-sm',
        dims,
        isSample
          ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-orange-500/20'
          : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-violet-500/20',
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

/** Section divider with an optional label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-1 pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {children}
      </span>
      <div className="h-px flex-1 bg-white/5" />
    </div>
  );
}

export function OrgSwitcher() {
  const router = useRouter();
  const utils = api.useUtils();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  // Single authenticated query — the active org is derived from the list via
  // the server-computed `isActive` flag (driven by the x-active-org cookie).
  const {
    data: orgs,
    isLoading,
    isError,
  } = api.organizations.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = api.organizations.create.useMutation({
    onSuccess: () => {
      toast.success('Organization created');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create organization');
    },
  });

  const list = (orgs ?? []) as OrgListItem[];
  const currentOrg = list.find((o) => o.isActive) ?? list[0] ?? null;

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?.id) {
      setOpen(false);
      return;
    }
    setSwitching(orgId);
    try {
      const res = await fetch('/api/org/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (!res.ok) throw new Error('Switch failed');
      toast.success('Workspace switched');
      setOpen(false);
      await utils.invalidate(); // Invalidate ALL tRPC queries — forces refetch under new org context
      router.refresh();
    } catch {
      toast.error('Failed to switch workspace');
    } finally {
      setSwitching(null);
    }
  };

  const handleCreate = async () => {
    const name = newOrgName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createMutation.mutateAsync({ name });
      setCreateOpen(false);
      setNewOrgName('');
      // Land the user inside the freshly created workspace.
      await fetch('/api/org/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: created.id }),
      });
      await utils.invalidate(); // Invalidate ALL tRPC queries — new org context
      router.refresh();
    } catch {
      // toast is handled by the mutation onError handler
    } finally {
      setCreating(false);
    }
  };

  const filteredOrgs = list.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  const sampleOrgs = filteredOrgs.filter((o) => o.isSample);
  const ownedOrgs = filteredOrgs.filter((o) => !o.isSample);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg bg-white/10" />
        <Skeleton className="h-7 w-32 rounded-md bg-white/10" />
      </div>
    );
  }

  // ── Error state (DB unreachable / auth issue) ──────────────────────────
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white/50">
        <Building2 className="h-3.5 w-3.5" />
        Workspace
      </span>
    );
  }

  // ── Empty state: memberships are still being bootstrapped ──────────────
  if (list.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Preparing workspaces…
      </span>
    );
  }

  const triggerName = currentOrg?.name ?? 'Select workspace';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2 text-left transition-all hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 active:scale-[0.98] data-[state=open]:border-white/20 data-[state=open]:bg-white/[0.08]"
            aria-label="Switch organization"
          >
            <OrgAvatar
              name={triggerName}
              isSample={currentOrg?.isSample ?? false}
              size="sm"
            />
            <span className="min-w-0 max-w-[140px]">
              <span className="block truncate text-[13px] font-semibold leading-tight text-white">
                {triggerName}
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-wide text-white/40">
                {currentOrg?.isSample ? 'Sample' : currentOrg?.role ?? 'Workspace'}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="w-[320px] border border-white/10 bg-zinc-950/95 p-0 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                      Workspaces
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/25">
                      Switch organization context
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/40">
                    {list.length}
                  </span>
                </div>

                {/* Search */}
                {list.length > 2 && (
                  <div className="px-3 py-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                      <input
                        type="text"
                        placeholder="Search workspaces…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-3 text-xs text-white placeholder:text-white/25 outline-none transition-colors focus:border-violet-500/50 focus:bg-white/[0.06]"
                      />
                    </div>
                  </div>
                )}

                {/* Org list */}
                <div className="max-h-72 overflow-y-auto py-1.5">
                  {filteredOrgs.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-white/25">
                      No workspaces found
                    </p>
                  )}

                  {/* Sample section */}
                  {sampleOrgs.length > 0 && (
                    <>
                      <SectionLabel>Sample</SectionLabel>
                      {sampleOrgs.map((org, index) => (
                        <OrgRow
                          key={org.id}
                          org={org}
                          index={index}
                          currentOrg={currentOrg}
                          switching={switching}
                          onSwitch={handleSwitch}
                        />
                      ))}
                    </>
                  )}

                  {/* Your Organizations section */}
                  {ownedOrgs.length > 0 && (
                    <>
                      <SectionLabel>Your organizations</SectionLabel>
                      {ownedOrgs.map((org, index) => (
                        <OrgRow
                          key={org.id}
                          org={org}
                          index={index}
                          currentOrg={currentOrg}
                          switching={switching}
                          onSwitch={handleSwitch}
                        />
                      ))}
                    </>
                  )}
                </div>

                {/* Divider + create */}
                <div className="border-t border-white/[0.06] p-1.5">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setCreateOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06]">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    Create organization
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>

      {/* Create organization dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border border-white/10 bg-zinc-950/95 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              Create organization
            </DialogTitle>
            <DialogDescription className="text-sm text-white/50">
              Start a new workspace. You&apos;ll become the owner and can invite
              teammates later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="org-name"
                className="text-xs font-medium text-white/60"
              >
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                placeholder="e.g. Acme Marketing"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-violet-500/60 focus:bg-white/[0.06]"
                autoFocus
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!newOrgName.trim() || creating}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create organization
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Individual organization row inside the switcher dropdown. */
function OrgRow({
  org,
  index,
  currentOrg,
  switching,
  onSwitch,
}: {
  org: OrgListItem;
  index: number;
  currentOrg: OrgListItem | null;
  switching: string | null;
  onSwitch: (id: string) => void;
}) {
  const isActive = org.id === currentOrg?.id;
  const isSwitching = switching === org.id;

  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.03 * index,
        duration: 0.15,
        ease: 'easeOut',
      }}
      onClick={() => onSwitch(org.id)}
      disabled={isSwitching}
      className={cn(
        'group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-50',
        isActive && 'bg-white/[0.06]',
      )}
    >
      <OrgAvatar name={org.name} isSample={org.isSample} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-medium text-white">
            {org.name}
          </p>
          {org.isSample && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-500/25">
              <Sparkles className="h-2.5 w-2.5" />
              Demo
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35">
          <span className="inline-flex items-center gap-1 capitalize">
            <RoleIcon role={org.role} />
            {org.role}
          </span>
          <span className="text-white/15">·</span>
          <span className="inline-flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {org.memberCount}
          </span>
          <span className="text-white/15">·</span>
          <PlanBadge plan={org.plan} />
        </div>
      </div>

      {isActive ? (
        <Check className="h-4 w-4 shrink-0 text-violet-400" />
      ) : isSwitching ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/40" />
      ) : (
        <Check className="h-4 w-4 shrink-0 text-transparent transition-colors group-hover:text-white/15" />
      )}
    </motion.button>
  );
}
