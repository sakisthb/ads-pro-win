import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import {
  contextForBrand,
  emptyProjectContext,
  isContextComplete,
  mergeOrgSettings,
  parseObjective,
  parseOrgSettings,
  type ProjectContext,
} from "@/lib/project-context";
import { adAccountIsConnected } from "@/lib/connection-status";
import { buildQuickAudit } from "@/lib/quick-audit";
import { PAID_AD_PLATFORMS } from "@/lib/paid-ad-metrics";

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

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return typeof value.toNumber === "function" ? value.toNumber() : Number(value);
}

export const onboardingRouter = createTRPCRouter({
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
      const ctxForShop = contextForBrand(parsed, b.id) ?? emptyProjectContext();
      return {
        ...b,
        connectedCount: shopConnected.length,
        connectedPlatforms: shopConnected.map((c) => c.platform),
        contextComplete: isContextComplete(ctxForShop),
      };
    });

    const context = parsed.projectContext ?? emptyProjectContext();
    const contextComplete = shops.some((s) => s.contextComplete) || isContextComplete(parsed.projectContext);
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
      ready:
        !isDemo &&
        connected.length > 0 &&
        contextComplete &&
        metricCount > 0,
    };
  }),

  saveContext: organizationAdminProcedure
    .input(contextInputSchema)
    .mutation(async ({ ctx, input }) => {
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
        days: z.number().min(7).max(90).default(14),
        brandId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const parsed = parseOrgSettings(ctx.organization.settings);
      const end = new Date();
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - input.days);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      const shopContext = contextForBrand(parsed, input.brandId);

      const grouped = await ctx.prisma.dailyMetric.groupBy({
        by: ["campaignId", "campaignName", "platform"],
        where: {
          date: {
            gte: new Date(`${startDate}T00:00:00.000Z`),
            lte: new Date(`${endDate}T23:59:59.999Z`),
          },
          campaignId: { not: "" },
          platform: { in: [...PAID_AD_PLATFORMS] },
          adAccount: {
            brand: {
              organizationId: ctx.organizationId,
              ...(input.brandId ? { id: input.brandId } : {}),
            },
          },
        },
        _sum: {
          spend: true,
          conversions: true,
          conversionValue: true,
        },
        orderBy: { _sum: { spend: "desc" } },
        take: 40,
      });

      const campaigns = grouped.map((g) => {
        const spend = toNumber(g._sum.spend);
        const conversionValue = toNumber(g._sum.conversionValue);
        return {
          campaignId: g.campaignId ?? "",
          campaignName: g.campaignName ?? "Unknown campaign",
          platform: g.platform,
          totalSpend: spend,
          totalConversions: toNumber(g._sum.conversions),
          roas: spend > 0 ? conversionValue / spend : 0,
        };
      });

      return {
        days: input.days,
        startDate,
        endDate,
        objective: shopContext?.objective ?? "sales",
        audit: buildQuickAudit({
          campaigns,
          objective: shopContext?.objective,
        }),
      };
    }),
});
