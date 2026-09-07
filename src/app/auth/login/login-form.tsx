"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  authProvidersUrl,
  isEmailAuthEnabled,
  mapAuthError,
  safeAppPath,
} from "@/lib/supabase/auth-errors";

/**
 * Supabase email + password login. Uses the browser client so the session
 * cookie is written directly by @supabase/ssr. On success we route to the
 * dashboard (or the `redirect` query param set by the middleware).
 *
 * Lives in its own client component because useSearchParams() must be inside
 * a <Suspense> boundary for the page to prerender statically.
 */
export default function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailDisabled, setEmailDisabled] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error"),
  );

  const redirectTarget = safeAppPath(searchParams.get("redirect"));

  useEffect(() => {
    let cancelled = false;
    isEmailAuthEnabled().then((enabled) => {
      if (!cancelled && !enabled) setEmailDisabled(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(mapAuthError(error.message, error.code));
      setLoading(false);
      return;
    }

    window.location.assign(redirectTarget);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-3xl font-bold text-transparent">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Sign in to your Ads Pro command center.
          </p>
        </div>

        {emailDisabled && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Email logins are turned off in Supabase Auth. Your saved password is not the problem.
              </span>
            </p>
            <a
              href={authProvidersUrl()}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block pl-6 font-medium text-amber-200 underline"
            >
              Open Authentication → Providers and enable Email
            </a>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-white/60">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-white/60"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:from-purple-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Switch to signup */}
        <p className="mt-6 text-center text-sm text-white/50">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-purple-300 transition-colors hover:text-purple-200"
          >
            Sign up
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-white/30">
        Protected by Supabase Auth · http-only cookies
      </p>
    </motion.div>
  );
}
