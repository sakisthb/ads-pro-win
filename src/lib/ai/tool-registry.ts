// LangChain Tool Registry — wraps marketing & commerce business logic for AI tool-calling
// Phase 5: AI Chat with LangChain Tool Calling

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { UNPAID_WOO_STATUS_LIST } from '@/lib/woo-orders'
import { buildMerSnapshot } from '@/lib/till-economics'
import { dailyMetricPlatformWhere } from '@/lib/paid-ad-metrics'
import { loadShopMarketMode } from '@/lib/shop-market-mode'
import { rollupMarketTill, splitNamedAdSpend, type MarketMode } from '@/lib/market-desk'

// ============================================================================
// Shared helpers (mirrored from marketing.ts / commerce.ts)
// ============================================================================

/** Convert a Prisma Decimal (or null) to a plain number for JSON serialization. */
function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0
  return typeof value.toNumber === 'function' ? value.toNumber() : Number(value)
}

/** Parse a `YYYY-MM-DD` string into a Date at the start of that day (UTC). */
function startOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr} (expected YYYY-MM-DD)`)
  }
  return d
}

/** Parse a `YYYY-MM-DD` string into a Date at the end of that day (UTC). */
function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59.999Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr} (expected YYYY-MM-DD)`)
  }
  return d
}

/**
 * Build a Prisma `where` clause for DailyMetric enforcing organization
 * isolation via Brand -> AdAccount -> DailyMetric join chain.
 */
function buildDailyMetricWhere(args: {
  organizationId: string
  startDate: string
  endDate: string
  platform?: string
}): Prisma.DailyMetricWhereInput {
  const { organizationId, startDate, endDate, platform } = args
  return {
    date: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    ...dailyMetricPlatformWhere(platform),
    adAccount: {
      brand: { organizationId },
    },
  }
}

/**
 * Resolve brand IDs for an organization (used for WooOrder/WooProduct queries
 * which lack a direct `brand` relation in the Prisma schema).
 */
async function resolveOrgBrandIds(organizationId: string): Promise<string[]> {
  const brands = await prisma.brand.findMany({
    where: { organizationId },
    select: { id: true },
  })
  return brands.map((b) => b.id)
}

/**
 * Build a Prisma `where` clause for WooOrder enforcing org isolation via Brand.
 */
async function buildWooOrderWhere(args: {
  organizationId: string
  startDate: string
  endDate: string
}): Promise<Prisma.WooOrderWhereInput> {
  const { organizationId, startDate, endDate } = args
  const brandIds = await resolveOrgBrandIds(organizationId)
  return {
    dateCreated: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    brandId: { in: brandIds },
    status: { notIn: [...UNPAID_WOO_STATUS_LIST] },
  }
}

async function loadOrgMarketMode(organizationId: string): Promise<MarketMode> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  return loadShopMarketMode({
    prisma,
    organizationId,
    organizationSettings: org?.settings,
  })
}

async function marketTillSummary(where: Prisma.WooOrderWhereInput, mode: MarketMode) {
  try {
    const grouped = await prisma.wooOrder.groupBy({
      by: ['market', 'campaign', 'source'],
      where,
      _count: { id: true },
      _sum: { netSales: true, grossSales: true },
    })
    const desks = rollupMarketTill(
      grouped.map((row) => ({
        market: row.market,
        campaign: row.campaign,
        source: row.source,
        orders: row._count.id,
        netSales: toNumber(row._sum.netSales),
        grossSales: toNumber(row._sum.grossSales),
      })),
      mode,
    )
    return {
      marketMode: mode,
      retail: { orders: desks.retail.orders, netSales: desks.retail.netSales },
      wholesale: { orders: desks.wholesale.orders, netSales: desks.wholesale.netSales },
      unknown: { orders: desks.unknown.orders, netSales: desks.unknown.netSales },
    }
  } catch {
    return { marketMode: mode }
  }
}

async function namedAdDeskSpend(organizationId: string, startDate: string, endDate: string, mode: MarketMode) {
  const grouped = await prisma.dailyMetric.groupBy({
    by: ['campaignName'],
    where: {
      date: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
      ...dailyMetricPlatformWhere(),
      adAccount: { brand: { organizationId } },
    },
    _sum: { spend: true },
  })
  return splitNamedAdSpend(
    grouped.map((row) => ({ name: row.campaignName, spend: toNumber(row._sum.spend) })),
    mode,
  )
}

// ============================================================================
// Tool factory
// ============================================================================

export function createMarketingTools(organizationId: string) {
  return [
    // -----------------------------------------------------------------------
    // get_blended_performance
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'get_blended_performance',
      description:
        'Get blended marketing performance across all ad platforms (Meta, Google, TikTok) for a date range. Returns total spend, impressions, clicks, conversions, conversion value, and ROAS.',
      schema: z.object({
        startDate: z.string().describe('Start date in YYYY-MM-DD format'),
        endDate: z.string().describe('End date in YYYY-MM-DD format'),
        platform: z
          .enum(['meta', 'google', 'tiktok', 'all'])
          .default('all')
          .describe('Filter by platform or all'),
      }),
      func: async ({ startDate, endDate, platform }) => {
        try {
          const where = buildDailyMetricWhere({
            organizationId,
            startDate,
            endDate,
            platform,
          })

          const agg = await prisma.dailyMetric.aggregate({
            where,
            _sum: {
              spend: true,
              impressions: true,
              clicks: true,
              conversions: true,
              conversionValue: true,
            },
          })

          const totalSpend = toNumber(agg._sum.spend)
          const totalImpressions = agg._sum.impressions ?? 0
          const totalClicks = agg._sum.clicks ?? 0
          const totalConversions = toNumber(agg._sum.conversions)
          const totalConversionValue = toNumber(agg._sum.conversionValue)

          return JSON.stringify({
            startDate,
            endDate,
            platform,
            totals: {
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              totalConversionValue,
              blendedROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
              blendedCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
              blendedCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
              blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            },
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to get blended performance: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // compare_periods
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'compare_periods',
      description:
        'Compare marketing performance between two time periods. Shows metrics for both periods and percentage change.',
      schema: z.object({
        period1Start: z.string().describe('First period start date (YYYY-MM-DD)'),
        period1End: z.string().describe('First period end date (YYYY-MM-DD)'),
        period2Start: z.string().describe('Second period start date (YYYY-MM-DD)'),
        period2End: z.string().describe('Second period end date (YYYY-MM-DD)'),
      }),
      func: async ({ period1Start, period1End, period2Start, period2End }) => {
        try {
          const where1 = buildDailyMetricWhere({
            organizationId,
            startDate: period1Start,
            endDate: period1End,
          })
          const where2 = buildDailyMetricWhere({
            organizationId,
            startDate: period2Start,
            endDate: period2End,
          })

          const aggregatePeriod = async (where: Prisma.DailyMetricWhereInput) => {
            const agg = await prisma.dailyMetric.aggregate({
              where,
              _sum: {
                spend: true,
                impressions: true,
                clicks: true,
                conversions: true,
                conversionValue: true,
              },
            })
            const totalSpend = toNumber(agg._sum.spend)
            const totalImpressions = agg._sum.impressions ?? 0
            const totalClicks = agg._sum.clicks ?? 0
            const totalConversions = toNumber(agg._sum.conversions)
            const totalConversionValue = toNumber(agg._sum.conversionValue)
            return {
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              totalConversionValue,
              blendedROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
              blendedCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
              blendedCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
              blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            }
          }

          const [period1, period2] = await Promise.all([
            aggregatePeriod(where1),
            aggregatePeriod(where2),
          ])

          const pctChange = (prev: number, next: number): number => {
            if (prev === 0) return next === 0 ? 0 : 100
            return ((next - prev) / Math.abs(prev)) * 100
          }

          const changes = {
            totalSpend: pctChange(period1.totalSpend, period2.totalSpend),
            totalImpressions: pctChange(period1.totalImpressions, period2.totalImpressions),
            totalClicks: pctChange(period1.totalClicks, period2.totalClicks),
            totalConversions: pctChange(period1.totalConversions, period2.totalConversions),
            totalConversionValue: pctChange(period1.totalConversionValue, period2.totalConversionValue),
            blendedROAS: pctChange(period1.blendedROAS, period2.blendedROAS),
            blendedCPC: pctChange(period1.blendedCPC, period2.blendedCPC),
            blendedCPM: pctChange(period1.blendedCPM, period2.blendedCPM),
            blendedCTR: pctChange(period1.blendedCTR, period2.blendedCTR),
          }

          return JSON.stringify({
            period1: { startDate: period1Start, endDate: period1End, ...period1 },
            period2: { startDate: period2Start, endDate: period2End, ...period2 },
            changes,
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to compare periods: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // find_wasted_spend
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'find_wasted_spend',
      description:
        'Find campaigns with high spend but low return (ROAS below threshold). Identifies budget waste.',
      schema: z.object({
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        roasThreshold: z
          .number()
          .default(1.0)
          .describe('ROAS below this is considered wasted (default 1.0)'),
      }),
      func: async ({ startDate, endDate, roasThreshold }) => {
        try {
          const where = buildDailyMetricWhere({
            organizationId,
            startDate,
            endDate,
          })

          const grouped = await prisma.dailyMetric.groupBy({
            by: ['campaignId', 'campaignName', 'platform'],
            where: { ...where, campaignId: { not: null } },
            _sum: {
              spend: true,
              conversionValue: true,
              impressions: true,
              clicks: true,
              conversions: true,
            },
          })

          const minSpend = 50
          const wastedCampaigns = grouped
            .map((g) => {
              const totalSpend = toNumber(g._sum.spend)
              const totalConversionValue = toNumber(g._sum.conversionValue)
              return {
                campaignId: g.campaignId ?? '',
                campaignName: g.campaignName ?? 'Unknown campaign',
                platform: g.platform,
                totalSpend,
                totalImpressions: g._sum.impressions ?? 0,
                totalClicks: g._sum.clicks ?? 0,
                totalConversions: toNumber(g._sum.conversions),
                totalConversionValue,
                roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
              }
            })
            .filter((c) => c.totalSpend >= minSpend && c.roas < roasThreshold)
            .sort((a, b) => b.totalSpend - a.totalSpend)

          const totalWastedSpend = wastedCampaigns.reduce((sum, c) => sum + c.totalSpend, 0)

          return JSON.stringify({
            wastedCampaigns,
            threshold: roasThreshold,
            totalWastedSpend,
            count: wastedCampaigns.length,
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to find wasted spend: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // get_actual_sales
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'get_actual_sales',
      description:
        'Get actual WooCommerce sales data (not platform-reported). Returns gross sales, net sales, refunds, cost of goods, and gross profit.',
      schema: z.object({
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
      }),
      func: async ({ startDate, endDate }) => {
        try {
          const where = await buildWooOrderWhere({
            organizationId,
            startDate,
            endDate,
          })

          const [agg, newAgg] = await Promise.all([
            prisma.wooOrder.aggregate({
              where,
              _sum: {
                grossSales: true,
                discounts: true,
                refunds: true,
                netSales: true,
                shipping: true,
                tax: true,
                costOfGoods: true,
                grossProfit: true,
              },
              _count: { id: true },
            }),
            prisma.wooOrder.aggregate({
              where: { ...where, isNewCustomer: true },
              _sum: { netSales: true },
              _count: { id: true },
            }),
          ])

          const orderCount = agg._count.id ?? 0
          const netSales = toNumber(agg._sum.netSales)
          const newCustomers = newAgg._count.id ?? 0
          const newCustomerNet = toNumber(newAgg._sum.netSales)
          const mode = await loadOrgMarketMode(organizationId)
          const markets = await marketTillSummary(where, mode)

          return JSON.stringify({
            orderCount,
            newCustomers,
            newCustomerNet,
            avgOrderValue: orderCount > 0 ? netSales / orderCount : 0,
            grossSales: toNumber(agg._sum.grossSales),
            discounts: toNumber(agg._sum.discounts),
            refunds: toNumber(agg._sum.refunds),
            netSales,
            shipping: toNumber(agg._sum.shipping),
            tax: toNumber(agg._sum.tax),
            costOfGoods: toNumber(agg._sum.costOfGoods),
            grossProfit: toNumber(agg._sum.grossProfit),
            grossMargin: netSales > 0 ? (toNumber(agg._sum.grossProfit) / netSales) * 100 : 0,
            cogsKnown: toNumber(agg._sum.costOfGoods) > 0,
            markets,
            note:
              mode === 'mixed'
                ? 'Retail and wholesale are two tills. Do not divide wholesale till by total Meta spend. Unnamed ads stay unclassified on a mixed shop.'
                : `This shop identity is ${mode}. Guests and unnamed ads inherit that desk unless an opposite signal exists.`,
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to get actual sales: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // compare_ad_spend_to_revenue
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'compare_ad_spend_to_revenue',
      description:
        'Compare total ad spend to WooCommerce till. Returns Pixel ROAS, Store MER, and aMER (new-customer net / spend). MER is not incremental.',
      schema: z.object({
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
      }),
      func: async ({ startDate, endDate }) => {
        try {
          const dateRange = {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          }

          const brandIds = await resolveOrgBrandIds(organizationId)

          const paidWhere: Prisma.WooOrderWhereInput = {
            dateCreated: dateRange,
            brandId: { in: brandIds },
            status: { notIn: [...UNPAID_WOO_STATUS_LIST] },
          }

          const [spendAgg, revenueAgg, newAgg] = await Promise.all([
            prisma.dailyMetric.aggregate({
              where: {
                date: dateRange,
                ...dailyMetricPlatformWhere(),
                adAccount: {
                  brand: { organizationId },
                },
              },
              _sum: { spend: true, conversionValue: true, clicks: true, conversions: true },
            }),
            prisma.wooOrder.aggregate({
              where: paidWhere,
              _sum: {
                netSales: true,
                grossProfit: true,
                costOfGoods: true,
                shipping: true,
                tax: true,
                refunds: true,
              },
              _count: { id: true },
            }),
            prisma.wooOrder.aggregate({
              where: { ...paidWhere, isNewCustomer: true },
              _sum: { netSales: true },
              _count: { id: true },
            }),
          ])

          const snapshot = buildMerSnapshot({
            totalSpend: toNumber(spendAgg._sum.spend),
            totalClicks: spendAgg._sum.clicks ?? 0,
            totalAttributedRevenue: toNumber(spendAgg._sum.conversionValue),
            pixelConversions: toNumber(spendAgg._sum.conversions),
            totalRevenue: toNumber(revenueAgg._sum?.netSales),
            orderCount: revenueAgg._count.id ?? 0,
            costOfGoods: toNumber(revenueAgg._sum?.costOfGoods),
            shipping: toNumber(revenueAgg._sum?.shipping),
            tax: toNumber(revenueAgg._sum?.tax),
            refunds: toNumber(revenueAgg._sum?.refunds),
            grossProfit: toNumber(revenueAgg._sum?.grossProfit),
            newCustomerNet: toNumber(newAgg._sum.netSales),
            newCustomerOrders: newAgg._count.id ?? 0,
          })
          const mode = await loadOrgMarketMode(organizationId)
          const [markets, adDesks] = await Promise.all([
            marketTillSummary(paidWhere, mode),
            namedAdDeskSpend(organizationId, startDate, endDate, mode),
          ])

          return JSON.stringify({
            ...snapshot,
            markets,
            namedAdSpend: {
              retail: adDesks.retail.spend,
              wholesale: adDesks.wholesale.spend,
              unnamed: adDesks.unknown.spend,
            },
            note: [
              "MER is store net sales / paid ad spend (blended), not incremental Meta ROAS.",
              mode === 'mixed'
                ? "On a mixed shop, do not divide wholesale till by total Meta spend, and do not put unnamed Advantage+ into a desk MER."
                : `Shop identity is ${mode}; unnamed ads inherit that desk unless a campaign name says otherwise.`,
              "Pixel conversions exclude GA4 key events, GA4 ecommerce purchases, and email/OpenCart rows. Do not add store orders + pixel + GA4.",
              "aMER is new-customer net / the same spend. Repeats can inflate MER.",
              "Do not scale Advantage+ as if MER were causal.",
              "If the funded campaign is Advantage+ / ASC, do not recommend a 1% or 3% lookalike — keep the catalog as the control.",
              "netExVat subtracts Woo tax from net; Woo totals are usually VAT-inclusive.",
              snapshot.cogsKnown
                ? undefined
                : "grossProfit is 0 until cost of goods is set; contributionAfterAds is store revenue minus ad spend, not profit.",
            ]
              .filter(Boolean)
              .join(" "),
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to compare ad spend to revenue: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // get_low_stock_advertised_products
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'get_low_stock_advertised_products',
      description:
        'Find products that are currently being advertised but have low stock (risk of wasting ad spend on out-of-stock items).',
      schema: z.object({
        stockThreshold: z
          .number()
          .default(10)
          .describe('Products with stock below this are flagged'),
      }),
      func: async ({ stockThreshold }) => {
        try {
          const brandIds = await resolveOrgBrandIds(organizationId)
          const advertised = await prisma.wooProduct.findMany({
            where: {
              brandId: { in: brandIds },
              isAdvertised: true,
              stockQty: { lt: stockThreshold },
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
            orderBy: { stockQty: 'asc' },
            take: 40,
          })
          const products = advertised.length > 0
            ? advertised
            : await prisma.wooProduct.findMany({
            where: {
              brandId: { in: brandIds },
              OR: [{ stockStatus: 'outofstock' }, { stockQty: { lte: stockThreshold } }],
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
            orderBy: { stockQty: 'asc' },
            take: 40,
          })

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
          }))

          return JSON.stringify({
            products: mapped,
            threshold: stockThreshold,
            count: mapped.length,
          })
        } catch (error) {
          return JSON.stringify({ error: `Failed to get low stock advertised products: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),

    // -----------------------------------------------------------------------
    // get_top_campaigns
    // -----------------------------------------------------------------------
    new DynamicStructuredTool({
      name: 'get_top_campaigns',
      description: 'Get the top performing campaigns sorted by a chosen metric.',
      schema: z.object({
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        metric: z
          .enum(['spend', 'conversions', 'roas', 'clicks'])
          .default('conversions'),
        limit: z.number().default(10),
      }),
      func: async ({ startDate, endDate, metric, limit }) => {
        try {
          const where = buildDailyMetricWhere({
            organizationId,
            startDate,
            endDate,
          })

          const grouped = await prisma.dailyMetric.groupBy({
            by: ['campaignId', 'campaignName', 'platform'],
            where: { ...where, campaignId: { not: null } },
            _sum: {
              spend: true,
              impressions: true,
              clicks: true,
              conversions: true,
              conversionValue: true,
            },
          })

          const campaigns = grouped
            .map((g) => {
              const totalSpend = toNumber(g._sum.spend)
              const totalImpressions = g._sum.impressions ?? 0
              const totalClicks = g._sum.clicks ?? 0
              const totalConversions = toNumber(g._sum.conversions)
              const totalConversionValue = toNumber(g._sum.conversionValue)
              return {
                campaignId: g.campaignId ?? '',
                campaignName: g.campaignName ?? 'Unknown campaign',
                platform: g.platform,
                totalSpend,
                totalImpressions,
                totalClicks,
                totalConversions,
                totalConversionValue,
                roas: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
                cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
              }
            })
            .sort((a, b) => {
              switch (metric) {
                case 'spend':
                  return b.totalSpend - a.totalSpend
                case 'conversions':
                  return b.totalConversions - a.totalConversions
                case 'clicks':
                  return b.totalClicks - a.totalClicks
                case 'roas':
                  return b.roas - a.roas
                default:
                  return 0
              }
            })
            .slice(0, limit)

          return JSON.stringify({ metric, campaigns })
        } catch (error) {
          return JSON.stringify({ error: `Failed to get top campaigns: ${error instanceof Error ? error.message : 'Unknown error'}` })
        }
      },
    }),
  ]
}
