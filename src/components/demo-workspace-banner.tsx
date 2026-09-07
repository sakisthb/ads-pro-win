"use client";

import Link from "next/link";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useChromeLocale } from "@/components/providers/chrome-locale";

export function DemoWorkspaceBanner() {
  const { isDemo, isLoading } = useActiveOrg();
  const { t } = useChromeLocale();

  if (isLoading || !isDemo) return null;

  return (
    <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
      {t("demo.banner")}{" "}
      <Link href="/connections" className="font-semibold underline-offset-2 hover:underline">
        Connections
      </Link>
    </div>
  );
}
