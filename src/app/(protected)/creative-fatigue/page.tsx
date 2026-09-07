"use client";

import { useEffect, useState } from "react";
import { CreativeFatigueMonitor } from "@/components/creative-fatigue/monitor";
import { DeskFilterRow } from "@/components/brands/desk-filters";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { api } from "@/components/providers/trpc-provider";
import {
  isoDaysAgo,
  todayIso,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { buildDemoFatiguePayload, emptyFatiguePayload } from "@/lib/creative-fatigue";

const DEMO_PAYLOAD = buildDemoFatiguePayload();

export default function CreativeFatiguePage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { brands, brandId, setBrandId, isLoading: brandsLoading } = useActiveBrand();
  const [range, setRange] = useState<DateRangeValue>({ startDate: "", endDate: "" });

  useEffect(() => {
    setRange({ startDate: isoDaysAgo(30), endDate: todayIso() });
  }, []);
  const rangeValid = range.startDate !== "" && range.endDate !== "";

  const fatigue = api.marketing.getCreativeFatigue.useQuery(
    { ...range, brandId: brandId || undefined },
    {
      enabled: !isLoading && !isDemo && rangeValid && !brandsLoading && (brands.length === 0 || Boolean(brandId)),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  if (isDemo) {
    return (
      <CreativeFatigueMonitor
        payload={DEMO_PAYLOAD}
        range={range}
        onRangeChange={setRange}
        isDemo
      />
    );
  }

  return (
    <div className="space-y-4">
      {brands.length > 0 && (
        <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
      )}
      <CreativeFatigueMonitor
        payload={
          fatigue.data ??
          emptyFatiguePayload([
            { id: "meta", connected: false, accountName: null },
            { id: "google", connected: false, accountName: null },
            { id: "tiktok", connected: false, accountName: null },
          ])
        }
        range={range}
        onRangeChange={setRange}
        isDemo={false}
        isLoading={fatigue.isLoading || brandsLoading}
        errorMessage={fatigue.isError ? fatigue.error?.message : undefined}
        onRefresh={() => {
          void fatigue.refetch();
        }}
        isRefreshing={fatigue.isFetching}
        lastFetchedAt={fatigue.dataUpdatedAt || undefined}
        brandId={brandId || undefined}
      />
    </div>
  );
}
