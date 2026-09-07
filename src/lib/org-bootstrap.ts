import { prisma } from "@/lib/db";
import { DEMO_ORG_SLUG } from "@/lib/org-default";

/** Slugify a display name into a URL-safe slug (falls back to "workspace"). */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

/**
 * Idempotent auto-membership bootstrap.
 *
 * If the user has NO organization memberships, this function:
 * 1. Finds or creates the shared "Demo" organization (viewer, not default)
 * 2. Creates a personal workspace for the user (owner, default)
 * 3. Ensures a User row exists (FK target for memberships)
 *
 * New users land on the personal workspace. Demo is opt-in via the switcher.
 *
 * Returns `{ ensured: true, personalOrgId }` when memberships were created,
 * or `{ ensured: false }` when the user already belonged to at least one org.
 */
export async function ensureUserMemberships(
  userId: string,
  email: string,
  fullName?: string | null,
): Promise<{ ensured: boolean; personalOrgId?: string }> {
  // Idempotency: if the user already belongs to one or more organizations,
  // there is nothing to bootstrap.
  const existing = await prisma.organizationMembership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  if (existing.length > 0) {
    return { ensured: false };
  }

  // Find or provision the shared Demo (sample data) organization.
  const demoOrg = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    create: {
      name: "Demo Organization",
      slug: DEMO_ORG_SLUG,
      plan: "enterprise",
      settings: { isSample: true },
    },
    update: {},
  });

  // Ensure a User row exists — it's the FK target for memberships. We only
  // create it for users we have never seen before; pre-existing users keep
  // their current state (update: {}).
  const user = await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      fullName: fullName?.trim() || undefined,
      role: "user",
      isActive: true,
      organizationId: demoOrg.id,
    },
    update: {},
  });

  // 1) Add the user to the Demo org as a read-only viewer (showcase).
  await prisma.organizationMembership.create({
    data: {
      userId,
      organizationId: demoOrg.id,
      role: "viewer",
      isDefault: false,
    },
  });

  // 2) Provision a personal organization where the user is the owner and
  //    can later connect their own ad accounts.
  const baseName = user.fullName?.trim() || email.split("@")[0] || "My";
  const personalName = `${baseName}'s Workspace`;
  const personalSlug = `${slugify(baseName)}-${userId.slice(-6)}`;
  const personalOrg = await prisma.organization.create({
    data: { name: personalName, slug: personalSlug, plan: "free" },
  });
  await prisma.organizationMembership.create({
    data: {
      userId,
      organizationId: personalOrg.id,
      role: "owner",
      isDefault: true,
    },
  });

  // Point the user's default organization at the personal workspace so a
  // missing cookie never lands them in StyleVault sample data.
  if (user.organizationId !== personalOrg.id) {
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: personalOrg.id },
    });
  }

  return { ensured: true, personalOrgId: personalOrg.id };
}
