import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import { createTRPCRouter, organizationAdminProcedure } from '../server';
import { parseGoogleAdsCustomerId } from '@/lib/google-ads-accounts';
import { buildGoogleHygieneAudit } from '@/lib/google-hygiene';
import { googleHygieneProvider } from '@/lib/google-hygiene-provider';

const scopeSchema = z.object({ brandId: z.string().min(1), adAccountId: z.string().min(1) }).strict();
const fail = (message: string) => new TRPCError({ code: 'PRECONDITION_FAILED', message });

async function ownedGoogleAccount(db: PrismaClient, organizationId: string, scope: z.infer<typeof scopeSchema>) {
  const account = await db.adAccount.findFirst({
    where: { id: scope.adAccountId, platform: 'google', brand: { id: scope.brandId, organizationId } },
    select: { id: true, accountId: true, isActive: true, accessToken: true, refreshToken: true, tokenExpiry: true },
  });
  if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owned Google account not found' });
  if (!account.isActive || !account.accessToken || !parseGoogleAdsCustomerId(account.accountId)) throw fail('Select a connected active Google Ads spend account');
  return { ...account, accessToken: account.accessToken };
}

export const googleHygieneRouter = createTRPCRouter({
  scan: organizationAdminProcedure.input(scopeSchema).query(async ({ ctx, input }) => {
    if (ctx.organization.slug === 'demo' || ctx.organization.slug.startsWith('demo-')) throw fail('Demo organizations cannot run native Google hygiene scans');
    const account = await ownedGoogleAccount(ctx.prisma, ctx.organizationId, input);
    try {
      const snapshot = await (await googleHygieneProvider(account)).scan();
      return buildGoogleHygieneAudit(snapshot);
    } catch {
      throw fail('Native Google hygiene scan unavailable. No empty-success audit was produced and no Google Ads write was attempted.');
    }
  }),
});
