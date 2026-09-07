"use client";

import { api } from "@/components/providers/trpc-provider";

/**
 * Returns the currently active organization and a convenience `isDemo` flag.
 *
 * The active org is derived from the `organizations.list` tRPC query — the
 * server computes `isActive` from the `x-active-org` cookie (falling back to
 * the user's default membership). `isSample` is `true` for the shared "Demo"
 * showcase organization.
 */
export function useActiveOrg() {
  const { data: orgs, isLoading } = api.organizations.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const activeOrg = (orgs ?? []).find((o: any) => o.isActive);

  return {
    org: activeOrg,
    isDemo: activeOrg?.slug === "demo" || activeOrg?.isSample === true,
    isLoading,
    currency: activeOrg?.currency === "USD" ? "USD" : "EUR",
  };
}
