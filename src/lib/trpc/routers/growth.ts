import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure } from "../server";
import { prisma } from "@/lib/db";
import { DEMO_ORG_SLUG } from "@/lib/org-default";
import { resolveBrandWebsite } from "@/lib/site-seo";
import {
  growthCenterOriginFromEnv,
  loadGrowthDesk,
} from "@/lib/growth-center";

export const growthRouter = createTRPCRouter({
  desk: organizationProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (ctx.organization.slug === DEMO_ORG_SLUG) {
        return { status: "unlinked" as const };
      }

      const brand = await prisma.brand.findFirst({
        where: { id: input.brandId, organizationId: ctx.organizationId },
        select: { website: true, slug: true },
      });
      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      }

      return loadGrowthDesk({
        organizationSlug: ctx.organization.slug,
        website: resolveBrandWebsite(brand),
        origin: growthCenterOriginFromEnv(
          process.env.SACOS_GROWTH_ORIGIN,
          process.env.NODE_ENV ?? "development",
        ),
        deskToken: process.env.SACOS_GROWTH_DESK_TOKEN,
      });
    }),
});
