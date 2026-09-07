// Email Campaigns tRPC Router — Org-scoped email metrics for Omnisend & Brevo
// Phase 4: Business Tools

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "../server";
import {
  classifyEmailCampaignName,
  classifyEmailTillSource,
  deriveEmailInsights,
  parseBrevoExtra,
  rollupEmailDesks,
  rollupEmailListIds,
  sumBrevoExtras,
  type EmailCampaignLike,
  type EmailTillSlice,
} from "@/lib/email-desk";
import { normalizeWooChannel } from "@/lib/woo-channels";
import { UNPAID_WOO_STATUS_LIST } from "@/lib/woo-orders";
import { decrypt } from "@/lib/crypto";
import { countBrevoSentArchive } from "@/lib/sync/fetchers";
import { MARKET_FILTER_SCHEMA, type MarketFilter } from "@/lib/market-desk";
import { loadShopMarketMode } from "@/lib/shop-market-mode";

// ============================================================================
// Helpers
// ============================================================================

const EMAIL_PLATFORMS: string[] = ["omnisend", "brevo"];

/** Convert a Prisma Decimal (or null) to a plain number. */
function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return typeof value.toNumber === "function" ? value.toNumber() : Number(value);
}

/** Parse YYYY-MM-DD into a Date at start of day (UTC). */
function startOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid date: ${dateStr} (expected YYYY-MM-DD)`,
    });
  }
  return d;
}

/** Parse YYYY-MM-DD into a Date at end of day (UTC). */
function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid date: ${dateStr} (expected YYYY-MM-DD)`,
    });
  }
  return d;
}

/** Verify that a brand belongs to the caller's organization. */
async function validateBrandAccess(
  prisma: typeof import("@/lib/db").prisma,
  organizationId: string,
  brandId?: string,
): Promise<void> {
  if (!brandId) return;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, organizationId: true },
  });
  if (!brand || brand.organizationId !== organizationId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
  }
}

/**
 * Build a Prisma `where` clause for DailyMetric scoped to email platforms
 * (omnisend / brevo) within the caller's organization.
 */
function buildEmailMetricWhere(args: {
  organizationId: string;
  startDate: string;
  endDate: string;
  brandId?: string;
  campaignId?: string;
  platform?: string;
}): Prisma.DailyMetricWhereInput {
  const { organizationId, startDate, endDate, brandId, campaignId, platform } = args;
  return {
    date: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    ...(platform && platform !== "all"
      ? { platform }
      : { platform: { in: EMAIL_PLATFORMS } }),
    ...(campaignId ? { campaignId } : {}),
    adAccount: {
      brand: {
        organizationId,
        ...(brandId ? { id: brandId } : {}),
      },
    },
  };
}

async function loadEmailTill(args: {
  prisma: typeof import("@/lib/db").prisma;
  organizationId: string;
  startDate: string;
  endDate: string;
  brandId?: string;
}): Promise<EmailTillSlice | null> {
  const brands = await args.prisma.brand.findMany({
    where: {
      organizationId: args.organizationId,
      ...(args.brandId ? { id: args.brandId } : {}),
    },
    select: { id: true },
  });
  const brandIds = brands.map((b) => b.id);
  if (brandIds.length === 0) return null;

  const grouped = await args.prisma.wooOrder.groupBy({
    by: ["source"],
    where: {
      brandId: { in: brandIds },
      dateCreated: { gte: startOfDay(args.startDate), lte: endOfDay(args.endDate) },
      status: { notIn: [...UNPAID_WOO_STATUS_LIST] },
    },
    _count: { _all: true },
    _sum: { netSales: true },
  });

  let orders = 0;
  let netSales = 0;
  let brevoOrders = 0;
  let brevoNetSales = 0;
  let gmailAppOrders = 0;
  let otherEmailOrders = 0;
  const sources: string[] = [];
  for (const row of grouped) {
    if (normalizeWooChannel(row.source) !== "email") continue;
    const n = row._count._all;
    const net = toNumber(row._sum.netSales);
    orders += n;
    netSales += net;
    const kind = classifyEmailTillSource(row.source);
    if (kind === "brevo") {
      brevoOrders += n;
      brevoNetSales += net;
    } else if (kind === "gmail-app") {
      gmailAppOrders += n;
    } else {
      otherEmailOrders += n;
    }
    const label = row.source?.trim();
    if (label) sources.push(label);
  }
  if (orders <= 0) {
    return {
      orders: 0,
      netSales: 0,
      sources: [],
      brevoOrders: 0,
      brevoNetSales: 0,
      gmailAppOrders: 0,
      otherEmailOrders: 0,
    };
  }
  return {
    orders,
    netSales,
    sources,
    brevoOrders,
    brevoNetSales,
    gmailAppOrders,
    otherEmailOrders,
  };
}

function metricRowsToCampaigns(
  rows: Array<{
    campaignId: string | null;
    campaignName: string | null;
    date: Date;
    impressions: number;
    clicks: number;
    reach: number;
    attributionSetting: string | null;
  }>,
): EmailCampaignLike[] {
  const byId = new Map<string, EmailCampaignLike & { lastDate: string }>();
  for (const row of rows) {
    const id = row.campaignId || row.campaignName || "unknown";
    const date =
      row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
    const extra = parseBrevoExtra(row.attributionSetting);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, {
        name: row.campaignName ?? "Unknown campaign",
        delivered: row.impressions ?? 0,
        opens: row.reach ?? 0,
        clicks: row.clicks ?? 0,
        date,
        extra,
        lastDate: date,
      });
      continue;
    }
    prev.delivered += row.impressions ?? 0;
    prev.opens += row.reach ?? 0;
    prev.clicks += row.clicks ?? 0;
    if (date > prev.lastDate) {
      prev.date = date;
      prev.lastDate = date;
      if (extra) prev.extra = extra;
    }
  }
  return [...byId.values()].map(({ lastDate: _last, ...campaign }) => campaign);
}

// ============================================================================
// Router
// ============================================================================

export const emailCampaignsRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // Aggregate email metrics for a date range
  // --------------------------------------------------------------------------
  getEmailMetrics: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
        campaignId: z.string().optional(),
        platform: z.enum(["omnisend", "brevo", "all"]).default("all"),
        market: z.enum(MARKET_FILTER_SCHEMA).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = buildEmailMetricWhere({
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
          campaignId: input.campaignId,
          platform: input.platform,
        });

        const rows = await ctx.prisma.dailyMetric.findMany({
          where,
          select: {
            campaignId: true,
            campaignName: true,
            date: true,
            impressions: true,
            clicks: true,
            reach: true,
            landingPageViews: true,
            attributionSetting: true,
            conversionValue: true,
          },
          orderBy: { date: "asc" },
        });

        const totalSent = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
        const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
        const totalOpens = rows.reduce((s, r) => s + (r.reach ?? 0), 0);
        const totalAttempted = rows.reduce((s, r) => s + (r.landingPageViews ?? 0), 0);
        const totalRevenue = rows.reduce((s, r) => s + toNumber(r.conversionValue), 0);

        const emailAccounts = await ctx.prisma.adAccount.findMany({
          where: {
            platform: input.platform !== "all" ? input.platform : { in: EMAIL_PLATFORMS },
            brand: {
              organizationId: ctx.organizationId,
              ...(input.brandId ? { id: input.brandId } : {}),
            },
          },
          select: { id: true, lastSyncAt: true, platform: true, accessToken: true },
          orderBy: { lastSyncAt: "desc" },
        });
        const lastSyncAt = emailAccounts.find((row) => row.lastSyncAt)?.lastSyncAt ?? null;
        const archiveGroups =
          emailAccounts.length === 0
            ? []
            : await ctx.prisma.dailyMetric.groupBy({
                by: ["campaignId"],
                where: {
                  adAccountId: { in: emailAccounts.map((row) => row.id) },
                  platform: input.platform !== "all" ? input.platform : { in: EMAIL_PLATFORMS },
                  impressions: { gt: 0 },
                },
              });
        let archiveCampaignCount = archiveGroups.length;

        const byDate = new Map<string, { sent: number; clicks: number; opens: number }>();
        for (const row of rows) {
          const date =
            row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
          const prev = byDate.get(date) ?? { sent: 0, clicks: 0, opens: 0 };
          prev.sent += row.impressions ?? 0;
          prev.clicks += row.clicks ?? 0;
          prev.opens += row.reach ?? 0;
          byDate.set(date, prev);
        }
        const dailyData = [...byDate.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, day]) => ({
            date,
            sent: day.sent,
            clicks: day.clicks,
            opens: day.opens,
            conversions: 0,
            revenue: 0,
          }));

        const campaignLikes = metricRowsToCampaigns(rows);
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;
        const desks = rollupEmailDesks(campaignLikes, mode);
        const scoped =
          filter === "all"
            ? campaignLikes
            : campaignLikes.filter((c) => classifyEmailCampaignName(c.name, mode) === filter);
        if (archiveCampaignCount <= campaignLikes.length) {
          const brevo = emailAccounts.find((row) => row.platform === "brevo" && row.accessToken);
          if (brevo?.accessToken) {
            try {
              const listed = await countBrevoSentArchive(decrypt(brevo.accessToken));
              archiveCampaignCount = Math.max(archiveCampaignCount, listed);
            } catch (error) {
              console.warn("[email] Brevo archive count failed; using DailyMetric campaign ids", error);
            }
          }
        }
        const extras = sumBrevoExtras(filter === "all" ? campaignLikes : scoped);
        const lists = rollupEmailListIds(filter === "all" ? campaignLikes : scoped);
        const till = await loadEmailTill({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });
        const insights = deriveEmailInsights({
          campaigns: filter === "all" ? campaignLikes : scoped,
          desks,
          extras,
          till: till && till.orders > 0 ? till : null,
          archiveCampaignCount,
        });
        const scopedSent = scoped.reduce((s, r) => s + r.delivered, 0);
        const scopedOpens = scoped.reduce((s, r) => s + r.opens, 0);
        const scopedClicks = scoped.reduce((s, r) => s + r.clicks, 0);

        return {
          success: true,
          data: {
            connected: emailAccounts.length > 0,
            lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
            platforms: [...new Set(emailAccounts.map((row) => row.platform))],
            campaignCount: scoped.length,
            archiveCampaignCount,
            totalSent: filter === "all" ? totalSent : scopedSent,
            totalAttempted: filter === "all" ? totalAttempted || totalSent : scopedSent,
            totalClicks: filter === "all" ? totalClicks : scopedClicks,
            totalOpens: filter === "all" ? totalOpens : scopedOpens,
            totalConversions: 0,
            totalRevenue,
            totalSpend: 0,
            clickRate: (filter === "all" ? totalSent : scopedSent) > 0
              ? ((filter === "all" ? totalClicks : scopedClicks) / (filter === "all" ? totalSent : scopedSent)) * 100
              : 0,
            openRate: (filter === "all" ? totalSent : scopedSent) > 0
              ? ((filter === "all" ? totalOpens : scopedOpens) / (filter === "all" ? totalSent : scopedSent)) * 100
              : 0,
            dailyData,
            desks,
            extras,
            lists,
            insights,
            till,
            marketMode: mode,
            marketFilter: filter,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getEmailMetrics error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load email metrics",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // List recent email campaigns with aggregated stats
  // --------------------------------------------------------------------------
  listCampaigns: organizationProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        brandId: z.string().optional(),
        platform: z.enum(["omnisend", "brevo", "all"]).default("all"),
        market: z.enum(MARKET_FILTER_SCHEMA).optional(),
        limit: z.number().int().min(1).max(80).default(40),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
        const emailAccounts = await ctx.prisma.adAccount.findMany({
          where: {
            platform: input.platform !== "all" ? input.platform : { in: EMAIL_PLATFORMS },
            brand: {
              organizationId: ctx.organizationId,
              ...(input.brandId ? { id: input.brandId } : {}),
            },
          },
          select: { id: true, platform: true, name: true, lastSyncAt: true },
        });

        if (emailAccounts.length === 0) {
          return {
            success: true,
            data: { campaigns: [], connected: false, lastSyncAt: null as string | null },
            timestamp: new Date(),
          };
        }

        const accountIds = emailAccounts.map((a) => a.id);
        const lastSyncAt =
          emailAccounts
            .map((row) => row.lastSyncAt)
            .filter((d): d is Date => d instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["campaignId", "campaignName", "platform"],
          where: {
            adAccountId: { in: accountIds },
            campaignId: { not: null },
            ...(input.startDate && input.endDate
              ? { date: { gte: startOfDay(input.startDate), lte: endOfDay(input.endDate) } }
              : {}),
          },
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
            reach: true,
          },
          _max: { date: true },
        });

        const extraRows =
          grouped.length === 0
            ? []
            : await ctx.prisma.dailyMetric.findMany({
                where: {
                  adAccountId: { in: accountIds },
                  campaignId: {
                    in: grouped.map((g) => g.campaignId).filter((id): id is string => Boolean(id)),
                  },
                },
                select: { campaignId: true, attributionSetting: true, date: true },
                orderBy: { date: "desc" },
              });
        const extraByCampaign = new Map<string, ReturnType<typeof parseBrevoExtra>>();
        for (const row of extraRows) {
          if (!row.campaignId || extraByCampaign.has(row.campaignId)) continue;
          extraByCampaign.set(row.campaignId, parseBrevoExtra(row.attributionSetting));
        }

        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;

        const campaigns = grouped
          .map((g) => {
            const sent = g._sum.impressions ?? 0;
            const clicks = g._sum.clicks ?? 0;
            const opens = g._sum.reach ?? 0;
            const conversions = toNumber(g._sum.conversions);
            const revenue = toNumber(g._sum.conversionValue);
            const extra = extraByCampaign.get(g.campaignId ?? "") ?? null;
            const desk = classifyEmailCampaignName(g.campaignName, mode);
            if (filter !== "all" && desk !== filter) return null;
            return {
              id: g.campaignId ?? "",
              name: g.campaignName ?? "Unknown campaign",
              platform: g.platform,
              desk,
              status: "sent" as const,
              subject: extra?.subject ?? null,
              extra,
              metrics: {
                sent,
                clicks,
                opens,
                conversions,
                revenue,
                clickRate: sent > 0 ? (clicks / sent) * 100 : 0,
                openRate: sent > 0 ? (opens / sent) * 100 : 0,
                attempted: extra?.sent ?? sent,
                hardBounces: extra?.hardBounces ?? 0,
                unsubscriptions: extra?.unsubscriptions ?? 0,
                appleMppOpens: extra?.appleMppOpens ?? 0,
              },
              lastSync:
                g._max.date instanceof Date
                  ? g._max.date.toISOString()
                  : String(g._max.date ?? ""),
            };
          })
          .filter((row): row is NonNullable<typeof row> => row != null)
          .sort((a, b) => b.metrics.sent - a.metrics.sent || b.metrics.clicks - a.metrics.clicks)
          .slice(0, input.limit);

        return {
          success: true,
          data: {
            campaigns,
            connected: true,
            lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("listCampaigns error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list email campaigns",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get a single campaign's detail + daily breakdown
  // --------------------------------------------------------------------------
  getCampaignDetail: organizationProcedure
    .input(
      z.object({
        campaignId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        // Default date range: last 30 days
        const endDate = input.endDate ?? new Date().toISOString().slice(0, 10);
        const startDefault = new Date();
        startDefault.setUTCDate(startDefault.getUTCDate() - 29);
        const startDate =
          input.startDate ?? startDefault.toISOString().slice(0, 10);

        const where = buildEmailMetricWhere({
          organizationId: ctx.organizationId,
          startDate,
          endDate,
          campaignId: input.campaignId,
        });

        // Verify the campaign belongs to an org email account
        const firstRow = await ctx.prisma.dailyMetric.findFirst({
          where,
          select: {
            campaignId: true,
            campaignName: true,
            platform: true,
            adAccount: {
              select: { id: true, name: true, platform: true },
            },
          },
        });

        if (!firstRow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Email campaign not found for this organization",
          });
        }

        // Aggregate totals
        const agg = await ctx.prisma.dailyMetric.aggregate({
          where,
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
            spend: true,
          },
        });

        const totalSent = agg._sum.impressions ?? 0;
        const totalClicks = agg._sum.clicks ?? 0;
        const totalConversions = toNumber(agg._sum.conversions);
        const totalRevenue = toNumber(agg._sum.conversionValue);
        const totalSpend = toNumber(agg._sum.spend);

        // Daily breakdown
        const grouped = await ctx.prisma.dailyMetric.groupBy({
          by: ["date"],
          where,
          _sum: {
            impressions: true,
            clicks: true,
            conversions: true,
            conversionValue: true,
          },
          orderBy: { date: "asc" },
        });

        const dailyBreakdown = grouped.map((day) => ({
          date:
            day.date instanceof Date
              ? day.date.toISOString().slice(0, 10)
              : String(day.date),
          sent: day._sum.impressions ?? 0,
          clicks: day._sum.clicks ?? 0,
          conversions: toNumber(day._sum.conversions),
          revenue: toNumber(day._sum.conversionValue),
        }));

        return {
          success: true,
          data: {
            campaign: {
              id: firstRow.campaignId ?? input.campaignId,
              name: firstRow.campaignName ?? "Unknown campaign",
              status: "active" as const,
              platform: firstRow.platform,
              adAccountId: firstRow.adAccount.id,
              adAccountName: firstRow.adAccount.name,
            },
            metrics: {
              sent: totalSent,
              clicks: totalClicks,
              conversions: totalConversions,
              revenue: totalRevenue,
              spend: totalSpend,
              openRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
              roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            },
            dailyBreakdown,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getCampaignDetail error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load email campaign detail",
          cause: error,
        });
      }
    }),
});
