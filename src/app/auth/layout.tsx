"use client";

import { motion } from "framer-motion";

/**
 * Shared immersive background for /auth/* routes.
 *
 * Echoes the landing page's purple→blue gradient + floating orb language so
 * the auth screens feel like a continuation of the marketing site rather than
 * a disconnected utility page.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-950 text-white">
      {/* Deep gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-purple-950/80 to-gray-950" />

      {/* Floating colored orbs */}
      <motion.div
        className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-purple-600/25 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-3xl"
        animate={{ scale: [1.15, 1, 1.15], opacity: [0.4, 0.25, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      {/* Dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top-left brand mark */}
      <a
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-base font-bold">
          A
        </span>
        Ads Pro
      </a>

      {/* Centered auth card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}
