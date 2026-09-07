/** Shared sample workspace. Live shops never live in this org. */
export const DEMO_ORG_SLUG = "demo";

/**
 * When no active-org cookie is set, land on the personal live workspace —
 * never the Demo StyleVault sample, even if that membership is still flagged default.
 */
export function pickLiveDefaultMembership<
  M extends {
    role: string;
    isDefault: boolean;
    organization: { id: string; slug: string };
  },
>(memberships: M[]): M | undefined {
  const liveOwner = memberships.find(
    (m) => m.role === "owner" && m.organization.slug !== DEMO_ORG_SLUG,
  );
  if (liveOwner) return liveOwner;
  return memberships.find((m) => m.isDefault) ?? memberships[0];
}
