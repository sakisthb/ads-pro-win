import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, organizationAdminProcedure, organizationProcedure } from "../server";
import { marketingRouter } from "./marketing";
import { resolveAuditPeriods } from "@/lib/audit-periods";
import { auditMarkdown, auditProviderAccountLabel, buildPerformanceAudit } from "@/lib/performance-audit";
import { googleResearchProposals, GOOGLE_RESEARCH_RECORD_TYPE } from "@/lib/google-audit-research";
import { parseOrgSettings, strictContextForBrand } from "@/lib/project-context";
import { MARKET_FILTER_SCHEMA } from "@/lib/market-desk";

const recordType = GOOGLE_RESEARCH_RECORD_TYPE;
const windowSchema = z.object({ startDate: z.string(), endDate: z.string() }).strict();
const comparisonSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("previous") }).strict(),
  z.object({ mode: z.literal("year"), yearsBack: z.number().int().min(1).max(10) }).strict(),
  z.object({ mode: z.literal("custom"), window: windowSchema }).strict(),
]);
const accountScope = z.object({ brandId: z.string().min(1), adAccountId: z.string().min(1) }).strict();
const decisionSchema = z.enum(["accepted_research", "changes_requested", "rejected"]);
const snapshotSchema = z.object({
  schemaVersion: z.literal(1), engine: z.literal("stored_rules_v1"), createdBy: z.string(), createdAt: z.string().datetime(),
  scope: accountScope.extend({ platform: z.literal("google"), market: z.enum(MARKET_FILTER_SCHEMA), goal: z.enum(["sales", "branding", "wholesale"]),
    window: windowSchema, comparison: comparisonSchema, baselineWindow: windowSchema,
    brandName: z.string(), accountName: z.string(), providerAccountId: z.string() }).strict(),
  verdict: z.enum(["blocked", "review"]), reportMarkdown: z.string().max(3_000_000),
  proposals: z.array(z.object({ id: z.string(), kind: z.enum(["measurement", "investigation"]), title: z.string(), campaignId: z.string().optional(),
    reason: z.string(), evidence: z.string(), nextCheck: z.string(), successCriteria: z.string(), risk: z.string(),
    confidence: z.enum(["observed", "provisional"]), expectedEffect: z.string(), executionAllowed: z.literal(false) }).strict()).max(1100),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), revision: z.number().int().nonnegative(),
  reviewStatus: z.enum(["pending", "accepted_research", "changes_requested", "rejected"]), executionAllowed: z.literal(false),
  reviews: z.array(z.object({ actorId: z.string(), at: z.string().datetime(), revision: z.number().int().positive(),
    decision: decisionSchema, note: z.string().max(2000) }).strict()).max(100),
}).strict();
export type GoogleResearchSnapshot = z.infer<typeof snapshotSchema>;
export type GoogleResearchRecord = { id: string; snapshot: GoogleResearchSnapshot };

function contentHash(snapshot: Pick<GoogleResearchSnapshot, "createdBy" | "createdAt" | "scope" | "verdict" | "reportMarkdown" | "proposals">) {
  return createHash("sha256").update(JSON.stringify({ createdBy: snapshot.createdBy, createdAt: snapshot.createdAt,
    scope: snapshot.scope, verdict: snapshot.verdict, reportMarkdown: snapshot.reportMarkdown, proposals: snapshot.proposals })).digest("hex");
}
async function ownedAccount(prisma: PrismaClient, organizationId: string, input: z.infer<typeof accountScope>) {
  const account = await prisma.adAccount.findFirst({ where: { id: input.adAccountId, platform: "google", brand: { id: input.brandId, organizationId } },
    select: { id: true, accountId: true, name: true, brand: { select: { name: true } } } });
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Owned Google account not found" });
  return account;
}
function decode(record: { id: string; data: unknown }, input: z.infer<typeof accountScope>): GoogleResearchRecord {
  const parsed = snapshotSchema.safeParse(record.data);
  if (!parsed.success) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Unsupported research snapshot; evidence withheld" });
  const snapshot = parsed.data;
  if (snapshot.scope.brandId !== input.brandId || snapshot.scope.adAccountId !== input.adAccountId)
    throw new TRPCError({ code: "NOT_FOUND", message: "Research snapshot not found in this scope" });
  if (contentHash(snapshot) !== snapshot.contentHash || snapshot.revision !== snapshot.reviews.length ||
    snapshot.reviews.some((r, i) => r.revision !== i + 1) || snapshot.reviewStatus !== (snapshot.reviews.at(-1)?.decision ?? "pending"))
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Research snapshot integrity check failed; evidence withheld" });
  return { id: record.id, snapshot };
}

export const googleResearchRouter = createTRPCRouter({
  save: organizationAdminProcedure.input(accountScope.extend({ market: z.enum(MARKET_FILTER_SCHEMA), goal: z.enum(["sales", "branding", "wholesale"]),
    window: windowSchema, comparison: comparisonSchema, acknowledgeResearchOnly: z.literal(true) }).strict())
    .mutation(async ({ ctx, input }): Promise<GoogleResearchRecord> => {
      const asOf = new Date().toISOString().slice(0, 10);
      let periods: ReturnType<typeof resolveAuditPeriods>;
      try { periods = resolveAuditPeriods(input.window, input.comparison, asOf); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid periods" }); }
      const account = await ownedAccount(ctx.prisma, ctx.organizationId, input);
      const reader = marketingRouter.createCaller(ctx);
      const reportInput = { brandId: input.brandId, adAccountId: input.adAccountId, platform: "google" as const, market: input.market, limit: 1000 };
      const current = await reader.getCampaignPerformance({ ...reportInput, ...input.window });
      // Baseline failure is an explicit unavailable comparison, never invented zero.
      const previous = await reader.getCampaignPerformance({ ...reportInput, ...periods.window }).catch(() => undefined);
      const context = strictContextForBrand(parseOrgSettings(ctx.organization.settings), input.brandId);
      const audit = buildPerformanceAudit({ current: current.data, previous: previous?.data, asOf, platform: "google", adAccountId: input.adAccountId,
        goal: input.goal, comparison: input.comparison, businessContext: { source: context ? "brand" : "missing", context } });
      const scope = { brandId: input.brandId, adAccountId: input.adAccountId, platform: "google" as const, market: input.market, goal: input.goal,
        window: input.window, comparison: input.comparison, baselineWindow: periods.window, brandName: account.brand.name,
        accountName: account.name, providerAccountId: auditProviderAccountLabel("google", account.accountId) };
      const evidence = { createdBy: ctx.session.user.id, createdAt: new Date().toISOString(), scope, verdict: audit.verdict,
        reportMarkdown: auditMarkdown(audit, { brand: scope.brandName, account: scope.accountName, providerAccountId: scope.providerAccountId, market: scope.market }),
        proposals: googleResearchProposals(audit) };
      const snapshot = snapshotSchema.parse({ ...evidence, schemaVersion: 1, engine: "stored_rules_v1", contentHash: contentHash(evidence),
        revision: 0, reviewStatus: "pending", reviews: [], executionAllowed: false });
      const record = await ctx.prisma.analysis.create({ data: { organizationId: ctx.organizationId, type: recordType,
        title: "Google audit research snapshot", status: "research_pending", data: snapshot as Prisma.InputJsonValue }, select: { id: true, data: true } });
      return decode(record, input);
    }),
  history: organizationProcedure.input(accountScope).query(async ({ ctx, input }): Promise<GoogleResearchRecord[]> => {
    await ownedAccount(ctx.prisma, ctx.organizationId, input);
    const records = await ctx.prisma.analysis.findMany({ where: { organizationId: ctx.organizationId, type: recordType, AND: [
      { data: { path: ["scope", "brandId"], equals: input.brandId } }, { data: { path: ["scope", "adAccountId"], equals: input.adAccountId } },
    ] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, select: { id: true, data: true } });
    return records.map(r => decode(r, input));
  }),
  review: organizationAdminProcedure.input(accountScope.extend({ id: z.string().min(1), revision: z.number().int().nonnegative(), decision: decisionSchema,
    note: z.string().trim().max(2000), confirmResearchOnly: z.literal(true) }).strict()).mutation(async ({ ctx, input }): Promise<GoogleResearchRecord> => {
    await ownedAccount(ctx.prisma, ctx.organizationId, input);
    if (input.decision === "changes_requested" && input.note.length < 3)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Explain the requested changes" });
    const record = await ctx.prisma.analysis.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, type: recordType }, select: { id: true, data: true } });
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Research snapshot not found" });
    const { snapshot } = decode(record, input);
    if (snapshot.revision !== input.revision) throw new TRPCError({ code: "CONFLICT", message: "Review changed; reload before deciding" });
    if (snapshot.reviews.length >= 100) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Review limit reached; create a new research snapshot" });
    const next: GoogleResearchSnapshot = { ...snapshot, revision: snapshot.revision + 1, reviewStatus: input.decision,
      reviews: [...snapshot.reviews, { actorId: ctx.session.user.id, at: new Date().toISOString(), revision: snapshot.revision + 1, decision: input.decision, note: input.note }] };
    const updated = await ctx.prisma.analysis.updateMany({ where: { id: record.id, organizationId: ctx.organizationId, type: recordType,
      data: { path: ["revision"], equals: input.revision } }, data: { status: `research_${input.decision}`, data: next as Prisma.InputJsonValue } });
    if (updated.count !== 1) throw new TRPCError({ code: "CONFLICT", message: "Concurrent review changed; reload before deciding" });
    return { id: record.id, snapshot: next };
  }),
});
