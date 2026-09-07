"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Link2, Rocket } from "lucide-react";

/**
 * Full-height empty-state placeholder shown when the active organization is
 * NOT the Demo workspace. It invites the user to connect their ad platforms
 * so real data can populate this page.
 */
export function WorkspaceEmptyState({ pageName }: { pageName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-6">
        <BarChart3 className="w-10 h-10 text-zinc-500" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">No data yet</h2>

      <p className="text-zinc-400 max-w-md mb-8">
        Connect your ad accounts and platforms to start seeing{" "}
        <span className="text-white font-medium">{pageName}</span> data in your
        workspace.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/connections"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm font-medium text-white transition-all"
        >
          <Link2 className="h-4 w-4" />
          Connect Platforms
        </Link>

        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all"
        >
          <Rocket className="h-4 w-4" />
          Get Started
        </Link>
      </div>
    </motion.div>
  );
}
