"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/components/providers/trpc-provider";
import { useActiveOrg } from "@/hooks/use-active-org";

/**
 * Dismissible banner when the active workspace has not finished first-session
 * setup (connect + project context). Demo org stays quiet.
 */
export function OnboardingBanner() {
  const { isDemo } = useActiveOrg();
  const [dismissed, setDismissed] = useState(false);
  const statusQuery = api.onboarding.getStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isDemo,
  });

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem("onboarding-banner-dismissed") === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem("onboarding-banner-dismissed", "true");
    } catch {
      /* noop */
    }
    setDismissed(true);
  };

  const incomplete = statusQuery.data && !statusQuery.data.onboardingCompleted && !statusQuery.data.ready;
  const visible = !isDemo && !dismissed && Boolean(incomplete);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-sky-600/90 via-violet-600/90 to-fuchsia-600/90 px-4 py-2 text-sm text-white backdrop-blur-sm">
            <Link
              href="/onboarding"
              className="flex items-center gap-2 font-medium transition-opacity hover:opacity-80"
            >
              <span>Finish first-session setup — connect, save context, load performance</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss banner"
              className="rounded-md p-1 transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
