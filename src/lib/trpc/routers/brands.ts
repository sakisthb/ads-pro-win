import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import { prisma } from "@/lib/db";
import { BRAND_MARKET_MODE_SCHEMA } from "@/lib/market-desk";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a URL-safe slug from a brand name: lowercase, spaces → hyphens.
 * Repeated hyphens are collapsed and leading/trailing ones trimmed.
 */
function slugifyBrand(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  );
}

/**
 * Resolve a slug that is unique within the organization. Brand has a
 * compound unique constraint on [organizationId, slug], so collisions get a
 * numeric suffix (e.g. "acme", "acme-2", "acme-3", …).
 */
async function resolveUniqueSlug(
  organizationId: string,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;
  // Bounded loop — each iteration either exits or narrows toward the next
  // free suffix (in practice this resolves on the first or second probe).
  for (let i = 0; i < 100; i++) {
    const existing = await prisma.brand.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
  return `${baseSlug}-${Date.now()}`;
}

/**
 * Fetch a brand owned by the caller's organization or throw NOT_FOUND.
 * This is the ownership guard shared by update/delete — it guarantees a
 * member of organization A can never mutate a brand of organization B by
 * guessing its id.
 */
async function getOwnedBrandOrThrow(organizationId: string, id: string) {
  const brand = await prisma.brand.findFirst({
    where: { id, organizationId },
  });
  if (!brand) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Brand not found",
    });
  }
  return brand;
}

// ============================================================================
// Router
// ============================================================================

export const brandsRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // list — every brand owned by the caller's active organization, enriched
  // with the number of connected ad accounts for the management UI.
  // --------------------------------------------------------------------------
  list: organizationProcedure.query(async ({ ctx }) => {
    return prisma.brand.findMany({
      where: { organizationId: ctx.organizationId },
      include: { _count: { select: { adAccounts: true } } },
      orderBy: { createdAt: "asc" },
    });
  }),

  // --------------------------------------------------------------------------
  // create — new brand in the active organization. The slug is derived from
  // the name (lowercase, spaces → hyphens) and de-duplicated per org.
  // --------------------------------------------------------------------------
  create: organizationAdminProcedure
    .input(
        z.object({
        name: z.string().min(1),
        website: z.string().optional(),
        marketMode: z.enum(BRAND_MARKET_MODE_SCHEMA).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.organization.slug === "demo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Switch out of the Demo workspace to add a real e-shop.",
        });
      }
      const name = input.name.trim();
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Brand name cannot be empty",
        });
      }

      const baseSlug = slugifyBrand(name);
      const slug = await resolveUniqueSlug(ctx.organizationId, baseSlug);

      return prisma.brand.create({
        data: {
          name,
          slug,
          website: input.website?.trim() || null,
          marketMode: input.marketMode ?? "inherit",
          organizationId: ctx.organizationId,
        },
        include: { _count: { select: { adAccounts: true } } },
      });
    }),

  // --------------------------------------------------------------------------
  // update — mutate an owned brand. Ownership is verified against the
  // caller's organization before anything is written. The slug is treated as
  // a stable identifier and is intentionally left untouched.
  // --------------------------------------------------------------------------
  update: organizationAdminProcedure
    .input(
        z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        website: z.string().optional(),
        marketMode: z.enum(BRAND_MARKET_MODE_SCHEMA).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOwnedBrandOrThrow(ctx.organizationId, input.id);

      const data: { name?: string; website?: string | null; marketMode?: string } = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Brand name cannot be empty",
          });
        }
        data.name = name;
      }
      if (input.website !== undefined) {
        // Empty string clears the website; otherwise store the trimmed value.
        data.website = input.website.trim() || null;
      }
      if (input.marketMode !== undefined) {
        data.marketMode = input.marketMode;
      }

      return prisma.brand.update({
        where: { id: input.id },
        data,
        include: { _count: { select: { adAccounts: true } } },
      });
    }),

  // --------------------------------------------------------------------------
  // delete — remove an owned brand. Cascades to its ad accounts (schema
  // onDelete: Cascade), so ownership is verified first.
  // --------------------------------------------------------------------------
  delete: organizationAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getOwnedBrandOrThrow(ctx.organizationId, input.id);
      await prisma.brand.delete({ where: { id: brand.id } });
      return { id: brand.id, deleted: true };
    }),
});
