"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.status === 401) {
        const loginUrl = new URL("/login", window.location.origin);
        loginUrl.searchParams.set("invite_token", token);
        loginUrl.searchParams.set(
          "redirect",
          `/invite/accept?token=${encodeURIComponent(token)}`,
        );
        router.push(loginUrl.toString());
        return;
      }

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setError(result.error ?? "Unable to accept this invitation.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
        <Mail className="h-6 w-6 text-violet-400" />
      </div>

      <h1 className="text-xl font-bold text-white">Team invitation</h1>
      <p className="mt-2 text-sm text-zinc-400">
        You&apos;ve been invited to join an organization. Accepting will add
        you to the team workspace.
      </p>

      {!token ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">
            This invitation link is invalid or incomplete.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAccept}
          disabled={isLoading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Join organization
            </>
          )}
        </button>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </motion.div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <Suspense
        fallback={
          <div className="flex w-full max-w-md items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          </div>
        }
      >
        <AcceptInvitationContent />
      </Suspense>
    </div>
  );
}
