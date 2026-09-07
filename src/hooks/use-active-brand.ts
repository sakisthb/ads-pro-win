"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/providers/trpc-provider";
import { pickActiveBrandId } from "@/lib/active-brand";

export const ACTIVE_BRAND_STORAGE_KEY = "adspro:active-brand";
export { pickActiveBrandId } from "@/lib/active-brand";

function readStoredBrand(): string | null {
  try {
    return window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBrand(id: string) {
  try {
    window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Selected e-shop (brand) for the active workspace.
 * Demo stays org-wide sample data. Live workspaces keep ads, Woo, and
 * campaign writes on the shop you pick so one store never overwrites another.
 */
export function useActiveBrand() {
  const { data, isLoading } = api.brands.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const brands = data ?? [];
  const [brandId, setBrandIdState] = useState("");

  useEffect(() => {
    if (brandId || brands.length === 0) return;
    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const fromUrl = params?.get("brand");
    const saved = typeof window !== "undefined" ? readStoredBrand() : null;
    const preferred = pickActiveBrandId(brands, fromUrl, saved);
    if (preferred) setBrandIdState(preferred);
  }, [brandId, brands]);

  const setBrandId = useCallback((id: string) => {
    setBrandIdState(id);
    writeStoredBrand(id);
  }, []);

  useEffect(() => {
    if (!brandId) return;
    writeStoredBrand(brandId);
  }, [brandId]);

  const selected = brands.find((b) => b.id === brandId) ?? brands[0];

  return {
    brands,
    brandId,
    setBrandId,
    selected,
    isLoading,
  };
}
