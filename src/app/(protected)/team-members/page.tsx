"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Eye,
  Crown,
  Clock,
  X,
  Check,
  Loader2,
  Send,
  UserCheck,
} from "lucide-react";
import { api } from "@/lib/trpc/react";
import { AnimatedSection, StaggerContainer, fadeInUp } from "@/components/ui/animated-section";

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: Crown,
    color: "#F59E0B",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  member: {
    label: "Member",
    icon: UserCheck,
    color: "#3B82F6",
    chip: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "#8B5CF6",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
} as const;

type Role = keyof typeof ROLE_CONFIG;

export default function TeamPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviteSent, setInviteSent] = useState(false);

  // Queries
  const membersQuery = api.invitations.listMembers.useQuery();
  const invitationsQuery = api.invitations.list.useQuery();

  // Mutations
  const sendInviteMutation = api.invitations.send.useMutation({
    onSuccess: () => {
      setInviteSent(true);
      setEmail("");
      invitationsQuery.refetch();
      setTimeout(() => setInviteSent(false), 4000);
    },
  });

  const revokeInviteMutation = api.invitations.revoke.useMutation({
    onSuccess: () => {
      invitationsQuery.refetch();
    },
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sendInviteMutation.mutate({ email, role });
  };

  const handleRevoke = (id: string) => {
    revokeInviteMutation.mutate({ id });
  };

  const members = membersQuery.data?.data ?? [];
  const invitations = invitationsQuery.data?.data ?? [];
  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  return (
    <div className="relative">
      {/* Ambient background effects */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-8 px-1">
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                  Team Management
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Team Members
                </span>
              </h1>
              <p className="text-sm text-zinc-400">
                Manage your organization&apos;s team and invite collaborators
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {members.length} member{members.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: Members + Invitations */}
          <div className="space-y-6 lg:col-span-2">
            {/* Members Section */}
            <AnimatedSection>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="border-b border-white/5 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                      <Users className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Current Members</h2>
                      <p className="text-xs text-zinc-400">
                        People with access to this organization
                      </p>
                    </div>
                  </div>
                </div>

                {membersQuery.isLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-zinc-600" />
                    <p className="mt-4 text-sm text-zinc-400">No members yet</p>
                  </div>
                ) : (
                  <StaggerContainer className="divide-y divide-white/5">
                    {members.map((member) => {
                      const roleConfig = ROLE_CONFIG[member.role as Role] ?? ROLE_CONFIG.member;
                      const RoleIcon = roleConfig.icon;
                      return (
                        <motion.div
                          key={member.id}
                          variants={fadeInUp}
                          className="flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                              {member.avatar ? (
                                <img
                                  src={member.avatar}
                                  alt={member.fullName ?? member.email}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-white/80">
                                  {(member.fullName ?? member.email)?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {member.fullName ?? member.email}
                              </p>
                              <p className="text-xs text-zinc-400">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${roleConfig.chip}`}
                            >
                              <RoleIcon className="h-3 w-3" />
                              {roleConfig.label}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>
            </AnimatedSection>

            {/* Pending Invitations Section */}
            <AnimatedSection>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="border-b border-white/5 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Mail className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Pending Invitations</h2>
                      <p className="text-xs text-zinc-400">
                        Invitations waiting to be accepted
                      </p>
                    </div>
                  </div>
                </div>

                {invitationsQuery.isLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                  </div>
                ) : pendingInvitations.length === 0 ? (
                  <div className="p-12 text-center">
                    <Mail className="mx-auto h-12 w-12 text-zinc-600" />
                    <p className="mt-4 text-sm text-zinc-400">No pending invitations</p>
                  </div>
                ) : (
                  <StaggerContainer className="divide-y divide-white/5">
                    {pendingInvitations.map((inv) => {
                      const roleConfig = ROLE_CONFIG[inv.role as Role] ?? ROLE_CONFIG.member;
                      const RoleIcon = roleConfig.icon;
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      return (
                        <motion.div
                          key={inv.id}
                          variants={fadeInUp}
                          className="flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10">
                              <Mail className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{inv.email}</p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${roleConfig.chip}`}
                                >
                                  <RoleIcon className="h-2.5 w-2.5" />
                                  {roleConfig.label}
                                </span>
                                {isExpired ? (
                                  <span className="text-[9px] font-medium text-red-400">
                                    Expired
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[9px] text-zinc-500">
                                    <Clock className="h-2.5 w-2.5" />
                                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revokeInviteMutation.isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" />
                            Revoke
                          </button>
                        </motion.div>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>
            </AnimatedSection>
          </div>

          {/* Right column: Invite Form */}
          <div className="space-y-6">
            <AnimatedSection>
              <div className="sticky top-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="border-b border-white/5 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                      <UserPlus className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Invite Team Member</h2>
                      <p className="text-xs text-zinc-400">Send an invitation email</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-5 p-6">
                  {/* Email Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-[11px] font-medium uppercase tracking-wider text-white/50"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      required
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                      Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(
                        ([key, config]) => {
                          const Icon = config.icon;
                          const isSelected = role === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setRole(key)}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                                isSelected
                                  ? "border-violet-500/50 bg-violet-500/10"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${
                                  isSelected ? "text-violet-400" : "text-zinc-400"
                                }`}
                              />
                              <span
                                className={`text-[10px] font-medium ${
                                  isSelected ? "text-white" : "text-zinc-400"
                                }`}
                              >
                                {config.label}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!email || sendInviteMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-violet-500/40 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {sendInviteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Invite
                      </>
                    )}
                  </button>

                  {/* Error Message */}
                  {sendInviteMutation.isError && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                      <p className="text-xs text-red-400">
                        {sendInviteMutation.error?.message ?? "Failed to send invitation"}
                      </p>
                    </div>
                  )}

                  {/* Success indicator (the actual invite link travels only in the email) */}
                  <AnimatePresence>
                    {inviteSent && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-400" />
                          <p className="text-xs font-medium text-emerald-300">
                            Invitation sent
                          </p>
                        </div>
                        <p className="mt-1 text-[10px] text-emerald-400/80">
                          An email with a secure join link has been prepared.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>
            </AnimatedSection>

            {/* Info Card */}
            <AnimatedSection>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 text-violet-400" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-white/80">About Roles</p>
                    <ul className="space-y-1.5 text-[10px] text-zinc-400">
                      <li>
                        <span className="font-semibold text-amber-300">Admin</span> — Full access
                        to settings and billing
                      </li>
                      <li>
                        <span className="font-semibold text-blue-300">Member</span> — Create and
                        manage campaigns
                      </li>
                      <li>
                        <span className="font-semibold text-violet-300">Viewer</span> — View-only
                        access to reports
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </div>
  );
}
