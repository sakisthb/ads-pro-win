import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import {
  emptyProjectContext,
  isContextComplete,
  mergeOrgSettings,
  parseObjective,
  parseOrgSettings,
  strictContextForBrand,
  type ProjectContext,
} from "@/lib/project-context";
import { adAccountIsConnected } from "@/lib/connection-status";
import { buildQuickAudit } from "@/lib/quick-audit";

const DEMO_ORG_SLUG = "demo";

const contextInputSchema = z.object({
  brandId: z.string().min(1).optional(),
  objective: z.enum(["sales", "leads", "awareness", "traffic"]),
  targetResult: z.string().max(500).optional().default(""),
  priorities: z.string().max(1000).optional().default(""),
  constraints: z.string().max(1000).optional().default(""),
  seasonality: z.string().max(500).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

export const onboardingRouter = createTRPCRouter({
  getBrandContext: organizationProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.brandId, organizationId: ctx.organizationId }, select: { id: true },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      const context = strictContextForBrand(parseOrgSettings(ctx.organization.settings), input.brandId);
      return { brandId: input.brandId, source: context ? "brand" as const : "missing" as const, context };
    }),

  getStatus: organizationProcedure.query(async ({ ctx }) => {
    const parsed = parseOrgSettings(ctx.organization.settings);
    const accounts = await ctx.prisma.adAccount.findMany({
      where: { brand: { organizationId: ctx.organizationId } },
      select: {
        id: true,
        platform: true,
        name: true,
        accountId: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiry: true,
        lastSyncAt: true,
        brandId: true,
      },
    });
    const connections = accounts.map((a) => {
      const isConnected = adAccountIsConnected(a);
      return {
        id: a.id,
        platform: a.platform,
        name: a.name,
        accountId: a.accountId,
        brandId: a.brandId,
        isConnected,
        lastSyncAt: a.lastSyncAt,
      };
    });
    const connected = connections.filter((c) => c.isConnected);
    const metricCount = await ctx.prisma.dailyMetric.count({
      where: { adAccount: { brand: { organizationId: ctx.organizationId } } },
    });
    const brands = await ctx.prisma.brand.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, website: true, slug: true },
      orderBy: { name: "asc" },
    });

    const shops = brands.map((b) => {
      const shopConnections = connections.filter((c) => c.brandId === b.id);
      const shopConnected = shopConnections.filter((c) => c.isConnected);
      const ctxForShop = strictContextForBrand(parsed, b.id);
      return {
        ...b,
        connectedCount: shopConnected.length,
        connectedPlatforms: shopConnected.map((c) => c.platform),
        contextComplete: isContextComplete(ctxForShop),
        contextSource: ctxForShop ? "brand" as const : "missing" as const,
      };
    });

    const context = parsed.projectContext ?? emptyProjectContext();
    const contextComplete = shops.some((s) => s.contextComplete);
    const isDemo = ctx.organization.slug === DEMO_ORG_SLUG;

    return {
      isDemo,
      orgName: ctx.organization.name,
      onboardingCompleted: parsed.onboardingCompleted === true,
      connectedCount: connected.length,
      connections,
      brands: shops,
      brandContexts: parsed.brandContexts ?? {},
      hasPerformance: metricCount > 0,
      context,
      contextComplete,
      setupReady: !isDemo && shops.some((s) => s.connectedCount > 0 && s.contextComplete),
      // Setup cannot certify provider health, selected-period coverage or action permission.
      ready: false as const,
      executionAllowed: false as const,
      readinessScope: "organization_setup_only" as const,
    };
  }),

  saveContext: organizationAdminProcedure
    .input(contextInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.brandId) {
        const brand = await ctx.prisma.brand.findFirst({
          where: { id: input.brandId, organizationId: ctx.organizationId }, select: { id: true },
        });
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      }
      const projectContext: ProjectContext = {
        objective: parseObjective(input.objective),
        targetResult: input.targetResult.trim(),
        priorities: input.priorities.trim(),
        constraints: input.constraints.trim(),
        seasonality: input.seasonality.trim(),
        notes: input.notes.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (ctx.organization.slug === DEMO_ORG_SLUG) {
        return { persisted: false as const, context: projectContext };
      }

      await ctx.prisma.organization.update({
        where: { id: ctx.organizationId },
        data: {
          settings: mergeOrgSettings(ctx.organization.settings, {
            projectContext,
            brandId: input.brandId,
            brandContext: input.brandId ? projectContext : undefined,
          }) as Prisma.InputJsonValue,
        },
      });
      return { persisted: true as const, context: projectContext };
    }),

  complete: organizationAdminProcedure.mutation(async ({ ctx }) => {
    if (ctx.organization.slug === DEMO_ORG_SLUG) {
      return { success: true, persisted: false as const };
    }
    await ctx.prisma.organization.update({
      where: { id: ctx.organizationId },
      data: {
        settings: mergeOrgSettings(ctx.organization.settings, {
          onboardingCompleted: true,
        }) as Prisma.InputJsonValue,
      },
    });
    return { success: true, persisted: true as const };
  }),

  getQuickAudit: organizationProcedure
    .input(
      z.object({
        days: z.number().int().min(7).max(90).default(14),
        brandId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.brandId) {
        const brand = await ctx.prisma.brand.findFirst({
          where: { id: input.brandId, organizationId: ctx.organizationId }, select: { id: true },
        });
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      }
      // Compatibility endpoint only. No unscoped metric reads, provider calls or verdicts.
      return { audit: buildQuickAudit({ campaigns: [] }) };
    }),
});
