// Commerce tRPC Router — WooCommerce sales, product profitability & ad-vs-revenue
// Phase 4: Business Tools

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "../server";
import { groupWooChannels } from "@/lib/woo-channels";
import { buildCustomerProfiles, rfmCounts } from "@/lib/woo-customers";
import { rankCatalogProfitability, UNPAID_WOO_STATUS_LIST } from "@/lib/woo-orders";
import { buildMerSnapshot } from "@/lib/till-economics";
import { dailyMetricPlatformWhere } from "@/lib/paid-ad-metrics";
import {
  MARKET_FILTER_SCHEMA,
  matchesMarketFilter,
  namedAdSpendForFilter,
  pickMarketTill,
  resolveStoredMarket,
  rollupMarketTill,
  splitNamedAdSpend,
  visibleMarketFilters,
  type MarketFilter,
  type MarketMode,
  type MarketTillSlice,
} from "@/lib/market-desk";
import { loadShopMarketMode } from "@/lib/shop-market-mode";

const UNPAID_STATUSES = [...UNPAID_WOO_STATUS_LIST];
const marketFilterInput = z.enum(MARKET_FILTER_SCHEMA).optional();

function isPrismaMissingColumn(error: unknown, fragment: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; meta?: unknown; message?: string };
  if (err.code !== "P2022") return false;
  const blob = `${err.message ?? ""} ${JSON.stringify(err.meta ?? {})}`.toLowerCase();
  return blob.includes(fragment.toLowerCase());
}

// ============================================================================
// Shared helpers
// ============================================================================

/** Convert a Prisma Decimal (or null) to a plain number for JSON serialization. */
function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return typeof value.toNumber === "function" ? value.toNumber() : Number(value);
}

/** Parse a `YYYY-MM-DD` string into a Date at the start of that day (UTC). */
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

/** Parse a `YYYY-MM-DD` string into a Date at the end of that day (UTC). */
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
  prisma: PrismaClient,
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

/** Resolve brand IDs for an organization (WooOrder/WooProduct lack a direct `brand` relation). */
async function resolveOrgBrandIds(
  prismaClient: PrismaClient,
  organizationId: string,
): Promise<string[]> {
  const brands = await prismaClient.brand.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return brands.map((b) => b.id);
}

/** Build a Prisma `where` clause for WooOrder enforcing org isolation via Brand. */
async function buildWooOrderWhere(args: {
  prismaClient: PrismaClient;
  organizationId: string;
  startDate: string;
  endDate: string;
  brandId?: string;
}): Promise<Prisma.WooOrderWhereInput> {
  const { prismaClient, organizationId, startDate, endDate, brandId } = args;
  const allBrandIds = await resolveOrgBrandIds(prismaClient, organizationId);
  const brandIds = brandId ? allBrandIds.filter((id) => id === brandId) : allBrandIds;
  return {
    dateCreated: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    brandId: { in: brandIds },
    status: { notIn: UNPAID_STATUSES },
  };
}

function tillFromSlice(slice: MarketTillSlice) {
  const orderCount = slice.orders;
  const netSales = slice.netSales;
  return {
    orderCount,
    newCustomers: slice.newOrders,
    newCustomerNet: slice.newCustomerNet,
    returningCustomers: Math.max(orderCount - slice.newOrders, 0),
    avgOrderValue: slice.avgOrderValue,
    grossSales: slice.grossSales,
    discounts: slice.discounts,
    refunds: slice.refunds,
    netSales,
    shipping: slice.shipping,
    tax: slice.tax,
    costOfGoods: slice.costOfGoods,
    grossProfit: slice.grossProfit,
    grossMargin: netSales > 0 ? (slice.grossProfit / netSales) * 100 : 0,
    cogsKnown: slice.costOfGoods > 0,
  };
}

async function loadMarketTill(args: {
  prisma: PrismaClient;
  where: Prisma.WooOrderWhereInput;
  mode: MarketMode;
}) {
  const sum = {
    grossSales: true,
    discounts: true,
    refunds: true,
    netSales: true,
    shipping: true,
    tax: true,
    costOfGoods: true,
    grossProfit: true,
  } as const;
  type GroupRow = {
    market?: string | null;
    campaign: string | null;
    source: string | null;
    _count: { id: number };
    _sum: {
      grossSales: Prisma.Decimal | null;
      discounts: Prisma.Decimal | null;
      refunds: Prisma.Decimal | null;
      netSales: Prisma.Decimal | null;
      shipping: Prisma.Decimal | null;
      tax: Prisma.Decimal | null;
      costOfGoods: Prisma.Decimal | null;
      grossProfit: Prisma.Decimal | null;
    };
  };
  let grouped: GroupRow[];
  let newGrouped: Array<{
    market?: string | null;
    campaign: string | null;
    source: string | null;
    _count: { id: number };
    _sum: { netSales: Prisma.Decimal | null };
  }>;
  try {
    const [marketGrouped, marketNew] = await Promise.all([
      args.prisma.wooOrder.groupBy({
        by: ["market", "campaign", "source"],
        where: args.where,
        _count: { id: true },
        _sum: sum,
      }),
      args.prisma.wooOrder.groupBy({
        by: ["market", "campaign", "source"],
        where: { ...args.where, isNewCustomer: true },
        _count: { id: true },
        _sum: { netSales: true },
      }),
    ]);
    grouped = marketGrouped as GroupRow[];
    newGrouped = marketNew;
  } catch (error) {
    if (!isPrismaMissingColumn(error, "market")) throw error;
    const [fallbackGrouped, fallbackNew] = await Promise.all([
      args.prisma.wooOrder.groupBy({
        by: ["campaign", "source"],
        where: args.where,
        _count: { id: true },
        _sum: sum,
      }),
      args.prisma.wooOrder.groupBy({
        by: ["campaign", "source"],
        where: { ...args.where, isNewCustomer: true },
        _count: { id: true },
        _sum: { netSales: true },
      }),
    ]);
    grouped = fallbackGrouped as GroupRow[];
    newGrouped = fallbackNew;
  }
  const newKey = (row: { market?: string | null; campaign: string | null; source: string | null }) =>
    `${row.market ?? ""}|${row.campaign ?? ""}|${row.source ?? ""}`;
  const newBy = new Map(newGrouped.map((row) => [newKey(row), row]));
  return rollupMarketTill(
    grouped.map((row) => {
      const neu = newBy.get(newKey(row));
      return {
        market: row.market,
        campaign: row.campaign,
        source: row.source,
        orders: row._count.id,
        netSales: toNumber(row._sum.netSales),
        grossSales: toNumber(row._sum.grossSales),
        discounts: toNumber(row._sum.discounts),
        refunds: toNumber(row._sum.refunds),
        tax: toNumber(row._sum.tax),
        shipping: toNumber(row._sum.shipping),
        costOfGoods: toNumber(row._sum.costOfGoods),
        grossProfit: toNumber(row._sum.grossProfit),
        newOrders: neu?._count.id ?? 0,
        newCustomerNet: toNumber(neu?._sum.netSales),
      };
    }),
    args.mode,
  );
}

async function loadAdMarketSplit(args: {
  prisma: PrismaClient;
  organizationId: string;
  startDate: string;
  endDate: string;
  brandId?: string;
  mode: MarketMode;
}) {
  const grouped = await args.prisma.dailyMetric.groupBy({
    by: ["campaignName"],
    where: {
      date: { gte: startOfDay(args.startDate), lte: endOfDay(args.endDate) },
      ...dailyMetricPlatformWhere(),
      adAccount: {
        brand: {
          organizationId: args.organizationId,
          ...(args.brandId ? { id: args.brandId } : {}),
        },
      },
    },
    _sum: {
      spend: true,
      conversions: true,
      conversionValue: true,
      clicks: true,
      impressions: true,
    },
  });
  return splitNamedAdSpend(
    grouped.map((row) => ({
      name: row.campaignName,
      spend: toNumber(row._sum.spend),
      conversions: toNumber(row._sum.conversions),
      conversionValue: toNumber(row._sum.conversionValue),
      clicks: row._sum.clicks ?? 0,
      impressions: row._sum.impressions ?? 0,
    })),
    args.mode,
  );
}

// ============================================================================
// Router
// ============================================================================

export const commerceRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // Get actual sales from WooCommerce
  // --------------------------------------------------------------------------
  getActualSales: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
        market: marketFilterInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const where = await buildWooOrderWhere({
          prismaClient: ctx.prisma,
          organizationId: ctx.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          brandId: input.brandId,
        });
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;
        const markets = await loadMarketTill({ prisma: ctx.prisma, where, mode });
        const slice = pickMarketTill(markets, filter);

        return {
          success: true,
          data: {
            ...tillFromSlice(slice),
            marketMode: mode,
            marketFilter: filter,
            markets,
            visibleDesks: visibleMarketFilters(mode, markets),
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getActualSales error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load actual sales",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Rank by till contribution (sold net − cost × qty) when a sync has
  // written soldQty. Until then, fall back to unit catalog markup.
  // --------------------------------------------------------------------------
  getProductProfitability: organizationProcedure
    .input(
      z.object({
        brandId: z.string(),
        limit: z.number().default(20),
        sortBy: z.enum(["profit", "revenue", "margin"]).default("profit"),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const products = await ctx.prisma.wooProduct.findMany({
          where: {
            brandId: input.brandId ?? '',
          },
          select: {
            id: true,
            productId: true,
            sku: true,
            name: true,
            price: true,
            costOfGoods: true,
            soldQty: true,
            soldNet: true,
            stockQty: true,
            stockStatus: true,
            isAdvertised: true,
          },
        });

        const ranked = rankCatalogProfitability(
          products.map((p) => ({
            id: p.id,
            productId: p.productId,
            sku: p.sku,
            name: p.name,
            listPrice: toNumber(p.price),
            cost: toNumber(p.costOfGoods),
            soldQty: p.soldQty,
            soldNet: toNumber(p.soldNet),
            stockQty: p.stockQty,
            stockStatus: p.stockStatus,
            isAdvertised: p.isAdvertised,
          })),
          input.sortBy,
        );

        return {
          success: true,
          data: {
            products: ranked.rows.slice(0, input.limit),
            totalProducts: ranked.rows.length,
            sortBy: input.sortBy,
            rankedBy: ranked.rankedBy,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getProductProfitability error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load product profitability",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Get low stock products that are being advertised
  // --------------------------------------------------------------------------
  getLowStockAdvertisedProducts: organizationProcedure
    .input(
      z.object({
        brandId: z.string(),
        stockThreshold: z.number().default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const products = await ctx.prisma.wooProduct.findMany({
          where: {
            brandId: input.brandId ?? '',
            isAdvertised: true,
            stockQty: { lt: input.stockThreshold },
          },
          select: {
            id: true,
            productId: true,
            sku: true,
            name: true,
            price: true,
            costOfGoods: true,
            stockQty: true,
            stockStatus: true,
            isAdvertised: true,
            updatedAt: true,
          },
          orderBy: { stockQty: "asc" },
        });

        const mapped = products.map((p) => ({
          id: p.id,
          productId: p.productId,
          sku: p.sku,
          name: p.name,
          price: toNumber(p.price),
          costOfGoods: toNumber(p.costOfGoods),
          stockQty: p.stockQty,
          stockStatus: p.stockStatus,
          isAdvertised: p.isAdvertised,
          updatedAt: p.updatedAt,
        }));

        return {
          success: true,
          data: {
            products: mapped,
            threshold: input.stockThreshold,
            count: mapped.length,
          },
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("getLowStockAdvertisedProducts error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load low stock advertised products",
          cause: error,
        });
      }
    }),

  // --------------------------------------------------------------------------
  // Compare ad spend to store revenue (MER)
  // --------------------------------------------------------------------------
  compareAdSpendToRevenue: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
        market: marketFilterInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);

        const dateRange = {
          gte: startOfDay(input.startDate),
          lte: endOfDay(input.endDate),
        };

        const orgBrandIds = await resolveOrgBrandIds(ctx.prisma, ctx.organizationId);
        const filteredBrandIds = input.brandId
          ? orgBrandIds.filter((id) => id === input.brandId)
          : orgBrandIds;

        const paidWhere: Prisma.WooOrderWhereInput = {
          dateCreated: dateRange,
          brandId: { in: filteredBrandIds },
          status: { notIn: UNPAID_STATUSES },
        };
        const mode = await loadShopMarketMode({
          prisma: ctx.prisma,
          organizationId: ctx.organizationId,
          organizationSettings: ctx.organization.settings,
          brandId: input.brandId,
        });
        const filter = (input.market ?? "all") as MarketFilter;
        const [markets, ads] = await Promise.all([
          loadMarketTill({ prisma: ctx.prisma, where: paidWhere, mode }),
          loadAdMarketSplit({
            prisma: ctx.prisma,
            organizationId: ctx.organizationId,
            startDate: input.startDate,
            endDate: input.endDate,
            brandId: input.brandId,
            mode,
          }),
        ]);
        const till = pickMarketTill(markets, filter);
        const ad = namedAdSpendForFilter(ads, filter);

        const data = {
          ...buildMerSnapshot({
            totalSpend: ad.spend,
            totalClicks: ad.clicks,
            totalAttributedRevenue: ad.conversionValue,
            pixelConversions: ad.conversions,
            totalRevenue: till.netSales,
            orderCount: till.orders,
            costOfGoods: till.costOfGoods,
            shipping: till.shipping,
            tax: till.tax,
            refunds: till.refunds,
            grossProfit: till.grossProfit,
            newCustomerNet: till.newCustomerNet,
            newCustomerOrders: till.newOrders,
          }),
          marketMode: mode,
          marketFilter: filter,
          markets,
          adMarkets: ads,
          unnamedAdSpend: ad.unnamedSpend,
          visibleDesks: visibleMarketFilters(mode, markets),
        };

        return {
          success: true,
          data,
          timestamp: new Date(),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("compareAdSpendToRevenue error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compare ad spend to revenue",
          cause: error,
        });
      }
    }),

  getOrderSourceMix: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string().optional(),
        market: marketFilterInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
      const where = await buildWooOrderWhere({
        prismaClient: ctx.prisma,
        organizationId: ctx.organizationId,
        startDate: input.startDate,
        endDate: input.endDate,
        brandId: input.brandId,
      });
      const mode = await loadShopMarketMode({
        prisma: ctx.prisma,
        organizationId: ctx.organizationId,
        organizationSettings: ctx.organization.settings,
        brandId: input.brandId,
      });
      const filter = (input.market ?? "all") as MarketFilter;
      type MixRow = {
        source: string | null;
        market?: string | null;
        campaign?: string | null;
        _count: { id: number };
        _sum: {
          netSales: Prisma.Decimal | null;
          refunds: Prisma.Decimal | null;
          tax: Prisma.Decimal | null;
          costOfGoods: Prisma.Decimal | null;
          grossProfit: Prisma.Decimal | null;
        };
      };
      let grouped: MixRow[];
      let newGrouped: Array<{
        source: string | null;
        market?: string | null;
        campaign?: string | null;
        _count: { id: number };
        _sum: { netSales: Prisma.Decimal | null };
      }>;
      try {
        const [marketMix, marketNew] = await Promise.all([
          ctx.prisma.wooOrder.groupBy({
            by: ["source", "market", "campaign"],
            where,
            _count: { id: true },
            _sum: { netSales: true, refunds: true, tax: true, costOfGoods: true, grossProfit: true },
          }),
          ctx.prisma.wooOrder.groupBy({
            by: ["source", "market", "campaign"],
            where: { ...where, isNewCustomer: true },
            _count: { id: true },
            _sum: { netSales: true },
          }),
        ]);
        grouped = marketMix as MixRow[];
        newGrouped = marketNew;
      } catch (error) {
        if (!isPrismaMissingColumn(error, "market")) throw error;
        const [fallbackMix, fallbackNew] = await Promise.all([
          ctx.prisma.wooOrder.groupBy({
            by: ["source", "campaign"],
            where,
            _count: { id: true },
            _sum: { netSales: true, refunds: true, tax: true, costOfGoods: true, grossProfit: true },
          }),
          ctx.prisma.wooOrder.groupBy({
            by: ["source", "campaign"],
            where: { ...where, isNewCustomer: true },
            _count: { id: true },
            _sum: { netSales: true },
          }),
        ]);
        grouped = fallbackMix as MixRow[];
        newGrouped = fallbackNew;
      }
      const newKey = (row: { source: string | null; market?: string | null; campaign?: string | null }) =>
        `${row.source ?? ""}|${row.market ?? ""}|${row.campaign ?? ""}`;
      const newBy = new Map(newGrouped.map((row) => [newKey(row), row]));
      const folded = new Map<
        string,
        {
          source: string;
          orders: number;
          netSales: number;
          refunds: number;
          tax: number;
          costOfGoods: number;
          grossProfit: number;
          newOrders: number;
          newNetSales: number;
        }
      >();
      for (const row of grouped) {
        const desk = resolveStoredMarket(
          { market: row.market, campaign: row.campaign, source: row.source },
          mode,
        );
        if (!matchesMarketFilter(desk, filter)) continue;
        const source = row.source?.trim() || "(none)";
        const neu = newBy.get(newKey(row));
        const prev = folded.get(source) ?? {
          source,
          orders: 0,
          netSales: 0,
          refunds: 0,
          tax: 0,
          costOfGoods: 0,
          grossProfit: 0,
          newOrders: 0,
          newNetSales: 0,
        };
        prev.orders += row._count.id;
        prev.netSales += toNumber(row._sum.netSales);
        prev.refunds += toNumber(row._sum.refunds);
        prev.tax += toNumber(row._sum.tax);
        prev.costOfGoods += toNumber(row._sum.costOfGoods);
        prev.grossProfit += toNumber(row._sum.grossProfit);
        prev.newOrders += neu?._count.id ?? 0;
        prev.newNetSales += toNumber(neu?._sum.netSales);
        folded.set(source, prev);
      }
      const rows = [...folded.values()].sort((a, b) => b.netSales - a.netSales);
      const channels = groupWooChannels(rows);
      return {
        success: true,
        data: { rows, channels, marketMode: mode, marketFilter: filter },
        timestamp: new Date(),
      };
    }),

  getLowStockCatalog: organizationProcedure
    .input(
      z.object({
        brandId: z.string(),
        stockThreshold: z.number().default(5),
        limit: z.number().default(12),
      }),
    )
    .query(async ({ input, ctx }) => {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
      const products = await ctx.prisma.wooProduct.findMany({
        where: {
          brandId: input.brandId,
          OR: [
            { stockStatus: "outofstock" },
            { stockQty: { lte: input.stockThreshold } },
          ],
        },
        orderBy: { stockQty: "asc" },
        take: input.limit,
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          stockStatus: true,
          price: true,
        },
      });
      return {
        success: true,
        data: {
          products: products.map((p) => ({
            ...p,
            price: toNumber(p.price),
          })),
          count: products.length,
        },
        timestamp: new Date(),
      };
    }),

  getCustomerIntelligence: organizationProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        brandId: z.string(),
        limit: z.number().min(1).max(50).default(12),
        market: marketFilterInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      await validateBrandAccess(ctx.prisma, ctx.organizationId, input.brandId);
      const mode = await loadShopMarketMode({
        prisma: ctx.prisma,
        organizationId: ctx.organizationId,
        organizationSettings: ctx.organization.settings,
        brandId: input.brandId,
      });
      const filter = (input.market ?? "all") as MarketFilter;
      const windowWhere = await buildWooOrderWhere({
        prismaClient: ctx.prisma,
        organizationId: ctx.organizationId,
        startDate: input.startDate,
        endDate: input.endDate,
        brandId: input.brandId,
      });
      const orderSelect = {
        customerEmail: true,
        netSales: true,
        dateCreated: true,
        isNewCustomer: true,
        market: true,
        campaign: true,
        source: true,
      } as const;
      let windowOrders: Array<{
        customerEmail: string | null;
        netSales: Prisma.Decimal;
        dateCreated: Date;
        isNewCustomer: boolean;
        market?: string | null;
        campaign?: string | null;
        source?: string | null;
      }>;
      let history: typeof windowOrders;
      try {
        [windowOrders, history] = await Promise.all([
          ctx.prisma.wooOrder.findMany({ where: windowWhere, select: orderSelect }),
          ctx.prisma.wooOrder.findMany({
            where: { brandId: input.brandId, status: { notIn: UNPAID_STATUSES } },
            select: orderSelect,
          }),
        ]);
      } catch (error) {
        if (!isPrismaMissingColumn(error, "market")) throw error;
        const fallbackSelect = {
          customerEmail: true,
          netSales: true,
          dateCreated: true,
          isNewCustomer: true,
          campaign: true,
          source: true,
        } as const;
        [windowOrders, history] = await Promise.all([
          ctx.prisma.wooOrder.findMany({ where: windowWhere, select: fallbackSelect }),
          ctx.prisma.wooOrder.findMany({
            where: { brandId: input.brandId, status: { notIn: UNPAID_STATUSES } },
            select: fallbackSelect,
          }),
        ]);
      }
      const keep = <T extends { market?: string | null; campaign?: string | null; source?: string | null }>(
        rows: T[],
      ) =>
        rows.filter((row) =>
          matchesMarketFilter(resolveStoredMarket(row, mode), filter),
        );
      const windowKept = keep(windowOrders);
      const historyKept = keep(history);
      const windowProfiles = buildCustomerProfiles(
        windowKept.map((row) => ({
          email: row.customerEmail,
          netSales: toNumber(row.netSales),
          dateCreated: row.dateCreated,
        })),
      );
      const lifetime = buildCustomerProfiles(
        historyKept.map((row) => ({
          email: row.customerEmail,
          netSales: toNumber(row.netSales),
          dateCreated: row.dateCreated,
        })),
      );
      const uniqueInWindow = windowProfiles.profiles.length;
      const repeatInWindow = windowProfiles.profiles.filter((p) => p.orders >= 2).length;
      const newInWindow = windowKept.filter((row) => row.isNewCustomer).length;
      const top = lifetime.profiles.slice(0, input.limit).map((p) => ({
        email: p.email,
        orders: p.orders,
        netSales: p.netSales,
        lastOrderAt: p.lastOrderAt,
        recencyDays: p.recencyDays,
        segment: p.segment,
      }));
      return {
        success: true,
        data: {
          uniqueCustomers: uniqueInWindow,
          repeatCustomers: repeatInWindow,
          guestOrders: windowProfiles.guestOrders,
          newOrderFlags: newInWindow,
          rfm: rfmCounts(lifetime.profiles),
          top,
          lifetimeCustomers: lifetime.profiles.length,
          marketMode: mode,
          marketFilter: filter,
        },
        timestamp: new Date(),
      };
    }),
});
