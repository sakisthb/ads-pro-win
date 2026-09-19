import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "../server";
import { buildCampaignStudy, type CampaignStudy, type CampaignStudyOrder, type CampaignStudyRow, type StudyPlatform } from "@/lib/campaign-study";

const brandScope = z.object({ brandId: z.string().min(1) }).strict();
const STUDY_PLATFORMS: StudyPlatform[] = ["meta", "google"];

async function ownedBrand(prisma: PrismaClient, organizationId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, organizationId }, select: { id: true, name: true } });
  if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Owned brand not found" });
  return brand;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export const campaignStudyRouter = createTRPCRouter({
  get: organizationProcedure.input(brandScope).query(async ({ ctx, input }): Promise<CampaignStudy> => {
    await ownedBrand(ctx.prisma, ctx.organizationId, input.brandId);
    const accounts = await ctx.prisma.adAccount.findMany({
      where: { brandId: input.brandId, platform: { in: STUDY_PLATFORMS } },
      select: { id: true, platform: true },
    });
    const accountIds = accounts.map(a => a.id);
    const [metricRows, inventory, orderRows] = await Promise.all([
      ctx.prisma.dailyMetric.findMany({
        where: { platform: { in: STUDY_PLATFORMS }, adAccountId: { in: accountIds } },
        select: { date: true, platform: true, campaignId: true, campaignName: true, spend: true, impressions: true,
          clicks: true, conversions: true, conversionValue: true, linkClicks: true, landingPageViews: true,
          addToCart: true, websitePurchases: true, websitePurchaseValue: true },
      }),
      ctx.prisma.adCampaign.findMany({
        where: { adAccountId: { in: accountIds } },
        select: { platformCampaignId: true, name: true, objective: true, status: true },
      }),
      ctx.prisma.wooOrder.findMany({
        where: { brandId: input.brandId },
        select: { dateCreated: true, status: true, market: true, grossSales: true, source: true },
      }),
    ]);
    const toStudyRow = (row: (typeof metricRows)[number]): CampaignStudyRow => ({
      date: toDateString(row.date), platform: row.platform as StudyPlatform, campaignId: row.campaignId,
      campaignName: row.campaignName, spend: toNumber(row.spend), impressions: row.impressions, clicks: row.clicks,
      conversions: toNumber(row.conversions), conversionValue: toNumber(row.conversionValue), linkClicks: row.linkClicks,
      landingPageViews: row.landingPageViews, addToCart: toNumber(row.addToCart),
      websitePurchases: toNumber(row.websitePurchases), websitePurchaseValue: toNumber(row.websitePurchaseValue),
    });
    const metaRows = metricRows.filter(r => r.platform === "meta").map(toStudyRow);
    const googleRows = metricRows.filter(r => r.platform === "google").map(toStudyRow);
    const orders: CampaignStudyOrder[] = orderRows.map(o => ({
      date: toDateString(o.dateCreated), status: o.status, market: o.market,
      grossSales: toNumber(o.grossSales), source: o.source,
    }));
    return buildCampaignStudy({ asOf: new Date().toISOString().slice(0, 10), metaRows, googleRows,
      campaigns: inventory.map(c => ({ campaignId: c.platformCampaignId, name: c.name, objective: c.objective, status: c.status })),
      orders });
  }),
});
