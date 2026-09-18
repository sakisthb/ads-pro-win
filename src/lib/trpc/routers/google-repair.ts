import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createTRPCRouter, organizationAdminProcedure, organizationProcedure } from '../server';
import { googleRepairProvider, GoogleDestinationPreflightError } from '@/lib/google-repair-provider';
import { parseGoogleAdsCustomerId } from '@/lib/google-ads-accounts';
import { GOOGLE_REPAIR_RECORD_TYPE, assertRepairFresh, desiredRepairState, repairContentHash, repairPreviewSchema, repairRequestSchema, type RepairPreview } from '@/lib/google-repair';

const scopeSchema = z.object({ brandId: z.string().min(1), adAccountId: z.string().min(1) }).strict();
const referenceSchema = scopeSchema.extend({ id: z.string().min(1), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const frozen = (p: RepairPreview) => ({ scope: p.scope, createdBy: p.createdBy, createdAt: p.createdAt, expiresAt: p.expiresAt, request: p.request, before: p.before, desired: p.desired });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message: string) => new TRPCError({ code: 'PRECONDITION_FAILED', message });
async function ownedAccount(db: PrismaClient, organizationId: string, scope: z.infer<typeof scopeSchema>) {
  const account = await db.adAccount.findFirst({ where: { id: scope.adAccountId, platform: 'google', brand: { id: scope.brandId, organizationId } },
    select: { id: true, accountId: true, isActive: true, accessToken: true, refreshToken: true, tokenExpiry: true, brand: { select: { website: true } } } });
  if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: 'Owned Google account not found' });
  let hostname = '';
  try { hostname = new URL(account.brand.website ?? '').hostname; } catch { /* fail closed */ }
  if (!['bagtobag.com.gr', 'www.bagtobag.com.gr'].includes(hostname) || !account.isActive || !account.accessToken || !parseGoogleAdsCustomerId(account.accountId)) throw fail('Select the connected BagToBag spend account');
  return { ...account, accessToken: account.accessToken };
}
function decode(record: { id: string; status: string; data: unknown }, scope: z.infer<typeof scopeSchema>, customerId: string) {
  const parsed = repairPreviewSchema.safeParse(record.data);
  if (!parsed.success) throw fail('Unsupported repair record; execution withheld');
  const preview = parsed.data;
  if (preview.scope.brandId !== scope.brandId || preview.scope.adAccountId !== scope.adAccountId || preview.scope.customerId !== customerId) throw fail('Repair belongs to another account scope');
  if (preview.state !== record.status || repairContentHash(frozen(preview)) !== preview.hash || !same(desiredRepairState(preview.request, preview.before), preview.desired)) throw fail('Repair record integrity failed');
  return { id: record.id, preview };
}
async function load(db: PrismaClient, organizationId: string, scope: z.infer<typeof referenceSchema>, customerId: string) {
  const record = await db.analysis.findFirst({ where: { id: scope.id, organizationId, type: GOOGLE_REPAIR_RECORD_TYPE }, select: { id: true, status: true, data: true } });
  if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Repair record not found' });
  const result = decode(record, scope, customerId);
  if (result.preview.hash !== scope.hash) throw fail('Exact preview changed; reload before deciding');
  return result;
}
function auditWhere(id: string, organizationId: string, p: RepairPreview) {
  return { id, organizationId, type: GOOGLE_REPAIR_RECORD_TYPE, status: p.state, data: { path: ['hash'], equals: p.hash } };
}
function requireRealOrganization(slug: string) {
  if (slug === 'demo' || slug.startsWith('demo-')) throw fail('Demo organizations cannot access Google repairs');
}
export const googleRepairRouter = createTRPCRouter({
  inventory: organizationAdminProcedure.input(scopeSchema.extend({ campaignId: z.string().regex(/^\d{1,20}$/).optional() }).strict()).query(async ({ ctx, input }) => {
    requireRealOrganization(ctx.organization.slug);
    const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
    try { return await (await googleRepairProvider(account)).inventory(input.campaignId); }
    catch { throw fail('Native Google inventory unavailable. No repair or empty-success inventory was produced.'); }
  }),
  history: organizationProcedure.input(scopeSchema).query(async ({ ctx, input }) => {
    const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
    const records = await ctx.prisma.analysis.findMany({ where: { organizationId: ctx.organizationId, type: GOOGLE_REPAIR_RECORD_TYPE, AND: [
      { data: { path: ['scope', 'brandId'], equals: input.brandId } }, { data: { path: ['scope', 'adAccountId'], equals: input.adAccountId } },
    ] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, select: { id: true, status: true, data: true } });
    return records.map(record => decode(record, input, parseGoogleAdsCustomerId(account.accountId)!));
  }),
  prepare: organizationAdminProcedure.input(scopeSchema.extend({ request: repairRequestSchema }).strict()).mutation(async ({ ctx, input }) => {
    requireRealOrganization(ctx.organization.slug);
    const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
    let provider, before, desired;
    try {
      provider = await googleRepairProvider(account);
      before = await provider.readTarget(input.request);
      desired = desiredRepairState(input.request, before);
      await provider.checkDestinations(input.request, desired);
    } catch (error) { throw fail(error instanceof GoogleDestinationPreflightError ? error.message : 'Native target or destination preflight failed. No executable preview was saved.'); }
    const evidence = { scope: { brandId: input.brandId, adAccountId: input.adAccountId, customerId: provider.customerId }, createdBy: ctx.session.user.id,
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10 * 60000).toISOString(), request: input.request, before, desired };
    const preview = repairPreviewSchema.parse({ ...evidence, schemaVersion: 1, hash: repairContentHash(evidence), state: 'prepared', attempt: null });
    const record = await ctx.prisma.analysis.create({ data: { organizationId: ctx.organizationId, type: GOOGLE_REPAIR_RECORD_TYPE, title: 'Operator Google repair preview', status: 'prepared', data: preview as Prisma.InputJsonValue }, select: { id: true } })
      .catch(() => { throw fail('Durable preview storage unavailable; no Google repair was attempted'); });
    return { id: record.id, preview };
  }),
  execute: organizationAdminProcedure.input(referenceSchema.extend({ confirmExactRepair: z.literal(true), acknowledgePossibleServing: z.literal(true) }).strict()).mutation(async ({ ctx, input }) => {
    requireRealOrganization(ctx.organization.slug);
    const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
    const record = await load(ctx.prisma, ctx.organizationId, input, parseGoogleAdsCustomerId(account.accountId)!);
    if (record.preview.state !== 'prepared') throw fail('This repair has already been claimed. Use read-only reconciliation, never replay.');
    try { assertRepairFresh(record.preview.expiresAt); } catch { throw fail('Preview expired. Prepare and confirm a fresh exact repair.'); }
    const claimed: RepairPreview = { ...record.preview, state: 'executing', attempt: { actorId: ctx.session.user.id, at: new Date().toISOString(), message: 'Single-use execution claimed', providerMayHaveChanged: false } };
    claimed.events = [...claimed.events, { ...claimed.attempt!, state: claimed.state }];
    const claim = await ctx.prisma.analysis.updateMany({ where: auditWhere(record.id, ctx.organizationId, record.preview), data: { status: claimed.state, data: claimed as Prisma.InputJsonValue } })
      .catch(() => { throw fail('Audit claim unavailable; no provider request was made'); });
    if (claim.count !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'Repair claim changed; no provider request was made' });
    let state: RepairPreview['state'] = 'blocked', message = 'Native preflight or validate-only failed; no live repair was attempted.', liveStarted = false;
    try {
      const provider = await googleRepairProvider(account);
      if (provider.customerId !== claimed.scope.customerId || !same(await provider.readTarget(claimed.request), claimed.before)) throw new Error('Stale target');
      await provider.checkDestinations(claimed.request, claimed.desired);
      await provider.mutate(claimed.request, claimed.before, true);
      if (!same(await provider.readTarget(claimed.request), claimed.before)) throw new Error('Target changed during validation');
      assertRepairFresh(claimed.expiresAt);
      liveStarted = true;
      await provider.mutate(claimed.request, claimed.before, false);
      const after = await provider.readTarget(claimed.request);
      state = same(after, claimed.desired) ? 'verified' : 'readback_mismatch';
      message = state === 'verified' ? 'Native fields match the exact approved repair. Google policy approval and serving are not implied.' : 'Live request returned, but native fields do not match. Reconcile read-only; do not replay.';
    } catch (error) {
      if (!liveStarted && error instanceof GoogleDestinationPreflightError) message = error.message;
      if (liveStarted) { state = 'provider_unknown'; message = 'Live outcome is uncertain. Reconcile read-only; no automatic retry is allowed.'; }
    }
    const preview: RepairPreview = { ...claimed, state, attempt: { ...claimed.attempt!, message, providerMayHaveChanged: liveStarted } };
    preview.events = [...claimed.events, { ...preview.attempt!, at: new Date().toISOString(), state }];
    const finished = await ctx.prisma.analysis.updateMany({ where: auditWhere(record.id, ctx.organizationId, claimed), data: { status: state, data: preview as Prisma.InputJsonValue } })
      .catch(() => { throw fail('Durable audit finalization unavailable. Provider may have changed; reload receipts and reconcile, never retry execution.'); });
    if (finished.count !== 1) throw fail('Audit finalization changed. Provider may have changed; inspect durable history and reconcile, never retry execution.');
    return { id: record.id, preview };
  }),
  reconcile: organizationAdminProcedure.input(referenceSchema).mutation(async ({ ctx, input }) => {
    requireRealOrganization(ctx.organization.slug);
    const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
    const record = await load(ctx.prisma, ctx.organizationId, input, parseGoogleAdsCustomerId(account.accountId)!);
    if (!['executing', 'provider_unknown', 'readback_mismatch'].includes(record.preview.state)) throw fail('Only uncertain execution attempts need reconciliation');
    if (record.preview.events.length >= 100) throw fail('Audit event limit reached; preserve this receipt and request an operator review');
    if (record.preview.state === 'executing' && Date.parse(record.preview.attempt?.at ?? '') + 10 * 60000 > Date.now()) throw fail('Execution may still be running. Wait before read-only reconciliation.');
    let after;
    try { after = await (await googleRepairProvider(account)).readTarget(record.preview.request); }
    catch { throw fail('Read-only native reconciliation unavailable. Existing audit state was preserved.'); }
    const state = same(after, record.preview.desired) ? 'verified' : 'readback_mismatch';
    const preview: RepairPreview = { ...record.preview, state, attempt: { actorId: ctx.session.user.id, at: new Date().toISOString(), providerMayHaveChanged: true,
      message: state === 'verified' ? 'Read-only reconciliation: native fields match the approved repair; policy approval/serving not implied.' : 'Read-only reconciliation: fields differ; review current native state before preparing any new repair.' } };
    preview.events = [...record.preview.events, { ...preview.attempt!, state }];
    const result = await ctx.prisma.analysis.updateMany({ where: auditWhere(record.id, ctx.organizationId, record.preview), data: { status: state, data: preview as Prisma.InputJsonValue } })
      .catch(() => { throw fail('Durable reconciliation storage unavailable. No new Google repair was attempted; reload receipts.'); });
    if (result.count !== 1) throw new TRPCError({ code: 'CONFLICT', message: 'Audit changed during reconciliation; reload history' });
    return { id: record.id, preview };
  }),
});
