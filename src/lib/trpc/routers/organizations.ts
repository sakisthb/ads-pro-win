import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
  protectedProcedure,
} from "../server";
import { prisma } from "@/lib/db";
import { getActiveOrgId } from "@/lib/active-org";
import { createClient } from "@/lib/supabase/server";
import { ensureUserMemberships } from "@/lib/org-bootstrap";
import { currencyFromSettings } from "@/lib/currency";
import { DEMO_ORG_SLUG, pickLiveDefaultMembership } from "@/lib/org-default";
import { mergeOrgSettings, parseOrgSettings } from "@/lib/project-context";
import { MARKET_MODE_SCHEMA, parseMarketMode } from "@/lib/market-desk";

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
 * Resolve the current user's display name from Supabase user metadata.
 * Used to name the personal organization created during onboarding.
 */
async function resolveUserFullName(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      (meta.fullName as string | undefined);
    return name?.trim() || null;
  } catch {
    return null;
  }
}

/** Fetch the user's memberships (with org + member count), default-first. */
function fetchMemberships(userId: string) {
  return prisma.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: {
        include: { _count: { select: { memberships: true } } },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export const organizationsRouter = createTRPCRouter({
  // List every organization the authenticated user is a member of, enriched
  // with the active flag (driven by the x-active-org cookie, falling back to
  // the membership's isDefault), the shared "demo" sample flag, and a live
  // member count for the switcher UI.
  //
  // If the user has NO memberships yet (e.g. they signed up through a path
  // that bypassed the auth callback bootstrap), auto-provision their Demo +
  // personal workspaces here so the switcher never renders empty.
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const email = ctx.session.user.email ?? "";
    const activeOrgId = await getActiveOrgId();

    let memberships = await fetchMemberships(userId);

    if (memberships.length === 0) {
      const fullName = await resolveUserFullName();
      await ensureUserMemberships(userId, email, fullName);
      memberships = await fetchMemberships(userId);
    }

    const fallback = pickLiveDefaultMembership(memberships);
    return memberships.map((m) => {
      const org = m.organization;
      const isActive = activeOrgId ? org.id === activeOrgId : org.id === fallback?.organization.id;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        role: m.role,
        isDefault: m.isDefault,
        isActive,
        isSample: org.slug === DEMO_ORG_SLUG,
        memberCount: org._count.memberships,
        currency: currencyFromSettings(org.settings),
        marketMode: parseOrgSettings(org.settings).marketMode ?? "mixed",
      };
    });
  }),

  // Get current active org details (resolved from the active-org cookie with
  // a fallback to the user's default organization).
  getCurrent: organizationProcedure.query(async ({ ctx }) => {
    return ctx.organization;
  }),

  // Create a new organization. The creator becomes the owner. Slug collisions
  // are avoided by suffixing with a short user id fragment.
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), slug: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const baseSlug = slugify(input.slug ?? input.name);
      let slug = baseSlug;
      const taken = await prisma.organization.findUnique({ where: { slug } });
      if (taken) slug = `${baseSlug}-${userId.slice(-6)}`;

      const org = await prisma.organization.create({
        data: { name: input.name.trim(), slug, plan: "free" },
      });
      await prisma.organizationMembership.create({
        data: { userId, organizationId: org.id, role: "owner", isDefault: false },
      });
      return org;
    }),

  // Idempotent onboarding bootstrap: ensures the signed-in user belongs to at
  // least one organization. New users are added to the shared "Demo" sample
  // organization (as a read-only viewer) and receive their own personal
  // organization (as owner). Users that already hold a membership are left
  // untouched — this is the same path real SaaS apps run right after signup.
  ensureMembership: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const email = ctx.session.user.email ?? "";
    const fullName = await resolveUserFullName();

    const result = await ensureUserMemberships(userId, email, fullName);

    if (!result.ensured) {
      return { ensured: false };
    }

    // Resolve the Demo org id for the response (it was just provisioned).
    const demoOrg = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      select: { id: true },
    });

    return {
      ensured: true,
      demoOrgId: demoOrg?.id ?? null,
      personalOrgId: result.personalOrgId ?? null,
    };
  }),

  // Persist the user's reporting currency on the active workspace.
  // The shared Demo org is left untouched so one visitor cannot rewrite
  // sample settings for everyone else — the client still stores the choice
  // locally.
  updateCurrency: organizationAdminProcedure
    .input(z.object({ currency: z.enum(["EUR", "USD"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === DEMO_ORG_SLUG) {
        return { currency: input.currency, persisted: false as const };
      }

      const current =
        ctx.organization.settings &&
        typeof ctx.organization.settings === "object" &&
        !Array.isArray(ctx.organization.settings)
          ? (ctx.organization.settings as Record<string, unknown>)
          : {};

      await prisma.organization.update({
        where: { id: ctx.organization.id },
        data: { settings: { ...current, currency: input.currency } },
      });

      return { currency: input.currency, persisted: true as const };
    }),

  updateMarketMode: organizationAdminProcedure
    .input(z.object({ marketMode: z.enum(MARKET_MODE_SCHEMA) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === DEMO_ORG_SLUG) {
        return { marketMode: input.marketMode, persisted: false as const };
      }
      await prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          settings: mergeOrgSettings(ctx.organization.settings, {
            marketMode: parseMarketMode(input.marketMode),
          }) as Prisma.InputJsonValue,
        },
      });
      return { marketMode: input.marketMode, persisted: true as const };
    }),

  /** Live seat / connection counts — not Stripe usage or invoice history. */
  getWorkspaceUsage: organizationAdminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [
      memberCount,
      brandCount,
      alertRuleCount,
      accounts,
      campaignCount,
    ] = await Promise.all([
      prisma.organizationMembership.count({
        where: { organizationId: ctx.organizationId },
      }),
      prisma.brand.count({ where: { organizationId: ctx.organizationId } }),
      prisma.alertRule.count({ where: { organizationId: ctx.organizationId } }),
      prisma.adAccount.findMany({
        where: { brand: { organizationId: ctx.organizationId } },
        select: {
          platform: true,
          accessToken: true,
          tokenExpiry: true,
        },
      }),
      prisma.adCampaign.count({
        where: { adAccount: { brand: { organizationId: ctx.organizationId } } },
      }),
    ]);

    const connected = accounts.filter((a) => {
      const oauth =
        a.platform === "meta" || a.platform === "google" || a.platform === "tiktok";
      return oauth
        ? Boolean(a.accessToken && a.tokenExpiry && a.tokenExpiry > now)
        : Boolean(a.accessToken);
    });
    const platforms = [...new Set(connected.map((a) => a.platform))];

    return {
      plan: ctx.organization.plan,
      name: ctx.organization.name,
      memberCount,
      brandCount,
      alertRuleCount,
      campaignCount,
      connectedPlatforms: platforms,
      connectedAccountCount: connected.length,
    };
  }),
});
