"use client";

import { Suspense } from "react";
import { CampaignLauncherStudio } from "@/components/campaign-launcher/studio";

export default function CampaignLauncherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      }
    >
      <CampaignLauncherStudio />
    </Suspense>
  );
}
