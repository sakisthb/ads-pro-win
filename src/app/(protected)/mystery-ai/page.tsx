"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { FortunePanel } from "@/components/mystery/fortune-panel";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { api } from "@/components/providers/trpc-provider";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { useActiveMarket } from "@/hooks/use-active-market";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import type { MysteryCampaign } from "@/lib/mystery-insights";

function mapPlatform(raw: string): string {
  const key = raw.toLowerCase();
  if (key === "facebook" || key === "meta" || key === "instagram") return "Meta";
  if (key === "google") return "Google";
  if (key === "tiktok") return "TikTok";
  return raw;
}

export default function MysteryAiPage() {
  const { isDemo } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const { market } = useActiveMarket();
  const range = useIsoDateRange(30);
  const datesValid = range.startDate !== "";
  const shopReady = !brandsLoading && (brands.length === 0 || Boolean(brandId));
  const top = api.marketing.getTopCampaigns.useQuery(
    {
      startDate: range.startDate,
      endDate: range.endDate,
      metric: "spend",
      limit: 12,
      brandId: brandId || undefined,
      ...(market !== "all" ? { market } : {}),
    },
    { enabled: datesValid && (isDemo || shopReady) },
  );

  const campaigns = useMemo<MysteryCampaign[]>(() => {
    const rows = top.data?.data?.campaigns ?? [];
    return rows.map((r) => {
      const impressions = r.totalImpressions ?? 0;
      const clicks = r.totalClicks ?? 0;
      return {
        name: r.campaignName || "Unknown campaign",
        platform: mapPlatform(String(r.platform ?? "")),
        spend: r.totalSpend ?? 0,
        revenue: r.totalConversionValue ?? 0,
        roas: Number.isFinite(r.roas) ? r.roas : 0,
        clicks,
        impressions,
        conversions: r.totalConversions ?? 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: r.cpc ?? (clicks > 0 ? (r.totalSpend ?? 0) / clicks : 0),
      };
    });
  }, [top.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-200">
          <Sparkles className="h-3.5 w-3.5" />
          Mystery AI
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Campaign fortune teller</h1>
        <p className="max-w-2xl text-sm text-white/50">
          Fortune, tarot, crystal, creative, and spy readings over the last 30 days of synced
          campaigns. Pixel conversion value, not till, not GA4. Same tRPC rows as Campaigns
          {datesValid ? ` · ${range.startDate} → ${range.endDate}` : ""}.
        </p>
        <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
      </div>
      <FortunePanel campaigns={campaigns} loading={!shopReady || top.isLoading} />
    </div>
  );
}
