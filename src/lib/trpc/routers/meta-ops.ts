import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationAdminProcedure } from "../server";
import { getMetaGrantedPermissions, listMetaCustomAudiences, listMetaPages, resolveLaunchAccount } from "@/lib/platform-launch";
import {
  addPausedMetaAd,
  attachMetaValueRules,
  createMetaValueRuleSet,
  duplicateMetaObject,
  fetchMetaOperatorTree,
  killSwitchMeta,
  listMetaValueRuleSets,
  setMetaAudience,
  setMetaBid,
  setMetaBudget,
  setMetaFrequency,
  setMetaObjectName,
  setMetaObjectStatus,
  setMetaOptimization,
  setMetaPacing,
  setMetaPlacements,
  setMetaSchedule,
  setMetaSpecialAdCategories,
  swapMetaAdCreative,
} from "@/lib/meta/operator";
import {
  LEARNING_RESET_MESSAGE,
  amountToMetaCents,
  budgetChangeResetsLearning,
  canEditBudgetThisHour,
  requireLearningConfirm,
  type BidStrategy,
  type SignificantEditKind,
} from "@/lib/meta/operator-logic";
import { mapMetaCampaignStatus } from "@/lib/meta/actions";

const campaignIdSchema = z.object({
  campaignId: z.string().min(1),
  brandId: z.string().optional(),
  adAccountId: z.string().optional(),
});

const confirmSchema = z.object({
  confirmLearningReset: z.boolean().optional(),
});

function assertNotDemoOrg(slug: string) {
  if (slug === "demo") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Switch out of the Demo workspace to edit live Meta ads.",
    });
  }
}

function asTrpc(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message === LEARNING_RESET_MESSAGE) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

async function resolveMetaWriter(
  ctx: { prisma: typeof import("@/lib/db").prisma; organizationId: string; organization: { slug: string } },
  input: { brandId?: string; adAccountId?: string },
) {
  assertNotDemoOrg(ctx.organization.slug);
  const resolved = await resolveLaunchAccount(
    ctx.prisma,
    ctx.organizationId,
    "meta",
    input.adAccountId,
    input.brandId,
  );
  if (!resolved) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Connect a Meta ad account on Connections first.",
    });
  }
  const granted = await getMetaGrantedPermissions(resolved.accessToken);
  if (!granted.includes("ads_management")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Meta is still on a read-only token. Reconnect Meta on Connections and approve ads_management.",
    });
  }
  return { ...resolved, granted };
}

async function logWrite(
  ctx: { prisma: typeof import("@/lib/db").prisma; organizationId: string; session: { user: { id: string } } },
  opts: {
    adAccountId: string;
    objectType: string;
    objectId: string;
    action: string;
    payload?: unknown;
    ok: boolean;
    message: string;
    learningRisk?: boolean;
  },
) {
  await ctx.prisma.metaWriteLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.session.user.id,
      adAccountId: opts.adAccountId,
      objectType: opts.objectType,
      objectId: opts.objectId,
      action: opts.action,
      payload: opts.payload === undefined ? undefined : JSON.parse(JSON.stringify(opts.payload)),
      ok: opts.ok,
      message: opts.message.slice(0, 4000),
      learningRisk: opts.learningRisk ?? false,
    },
  });
}

async function guardSignificant(
  kind: SignificantEditKind,
  learning: boolean,
  confirm?: boolean,
) {
  try {
    requireLearningConfirm({ kind, learning, confirm });
  } catch (error) {
    asTrpc(error);
  }
}

export const metaOpsRouter = createTRPCRouter({
  tree: organizationAdminProcedure.input(campaignIdSchema).query(async ({ ctx, input }) => {
    const resolved = await resolveLaunchAccount(
      ctx.prisma,
      ctx.organizationId,
      "meta",
      input.adAccountId,
      input.brandId,
    );
    if (!resolved) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect a Meta ad account on Connections first.",
      });
    }
    const [granted, tree] = await Promise.all([
      getMetaGrantedPermissions(resolved.accessToken),
      fetchMetaOperatorTree(resolved.accessToken, input.campaignId),
    ]);
    const canWrite = granted.includes("ads_management");
    return {
      ...tree,
      canWrite,
      permissions: granted,
      pages: [] as Awaited<ReturnType<typeof listMetaPages>>,
      customAudiences: [] as Awaited<ReturnType<typeof listMetaCustomAudiences>>,
      valueRules: [] as Array<{ id: string; name: string }>,
      accountName: resolved.account.name,
      accountId: resolved.account.accountId,
      currency: resolved.account.currency,
      adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${resolved.account.accountId.replace(/^act_/i, "")}&selected_campaign_ids=${input.campaignId}`,
    };
  }),

  assets: organizationAdminProcedure
    .input(campaignIdSchema.extend({ withValueRules: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
    const resolved = await resolveLaunchAccount(
      ctx.prisma,
      ctx.organizationId,
      "meta",
      input.adAccountId,
      input.brandId,
    );
    if (!resolved) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect a Meta ad account on Connections first.",
      });
    }
    const [pages, customAudiences] = await Promise.all([
      listMetaPages(resolved.accessToken),
      listMetaCustomAudiences(resolved.accessToken, resolved.account.accountId),
    ]);
    const valueRules = input.withValueRules
      ? await listMetaValueRuleSets(resolved.accessToken, resolved.account.accountId)
      : [];
    return { pages, customAudiences, valueRules };
  }),

  logs: organizationAdminProcedure
    .input(z.object({ campaignId: z.string().optional(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.metaWriteLog.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      const logs = input.campaignId
        ? rows.filter((row) => {
            const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
              ? (row.payload as Record<string, unknown>)
              : {};
            return row.objectId === input.campaignId || payload.campaignId === input.campaignId;
          })
        : rows;
      return { logs };
    }),

  setStatus: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        objectId: z.string().min(1),
        objectType: z.enum(["campaign", "adset", "ad"]),
        status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        await setMetaObjectStatus(resolved.accessToken, input.objectId, input.status);
        if (input.objectType === "campaign") {
          await ctx.prisma.adCampaign.updateMany({
            where: { adAccountId: resolved.account.id, platformCampaignId: input.objectId },
            data: {
              status: mapMetaCampaignStatus(input.status),
              effectiveStatus: input.status,
              lastSyncedAt: new Date(),
            },
          });
        }
        const message = `${input.objectType} set to ${input.status}.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: input.objectType,
          objectId: input.objectId,
          action: "setStatus",
          payload: { campaignId: input.campaignId, status: input.status },
          ok: true,
          message,
        });
        return { ok: true, message };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: input.objectType,
          objectId: input.objectId,
          action: "setStatus",
          ok: false,
          message,
        });
        asTrpc(error);
      }
    }),

  setName: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        objectId: z.string().min(1),
        objectType: z.enum(["campaign", "adset", "ad"]),
        name: z.string().min(1).max(400),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        await setMetaObjectName(resolved.accessToken, input.objectId, input.name);
        if (input.objectType === "campaign") {
          await ctx.prisma.adCampaign.updateMany({
            where: { adAccountId: resolved.account.id, platformCampaignId: input.objectId },
            data: { name: input.name.trim().slice(0, 400), lastSyncedAt: new Date() },
          });
        }
        const message = `${input.objectType} renamed.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: input.objectType,
          objectId: input.objectId,
          action: "setName",
          payload: { campaignId: input.campaignId, name: input.name },
          ok: true,
          message,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setSpecialAdCategories: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        categories: z.array(z.string().min(1)).max(6),
        countries: z.array(z.string().min(2).max(2)).max(50).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        await setMetaSpecialAdCategories({
          accessToken: resolved.accessToken,
          campaignId: input.campaignId,
          categories: input.categories,
          countries: input.countries,
        });
        const message = "Special ad categories updated.";
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "campaign",
          objectId: input.campaignId,
          action: "setSpecialAdCategories",
          payload: { categories: input.categories, countries: input.countries },
          ok: true,
          message,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setPlacements: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        automatic: z.boolean(),
        platforms: z.array(z.string()),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("targeting", Boolean(input.learning), input.confirmLearningReset);
      try {
        await setMetaPlacements({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          automatic: input.automatic,
          platforms: input.platforms,
        });
        const message = input.automatic ? "Advantage+ placements restored." : "Placements updated.";
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setPlacements",
          payload: { campaignId: input.campaignId, automatic: input.automatic, platforms: input.platforms },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setPacing: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        adSetId: z.string().min(1),
        pacingType: z.enum(["standard", "day_parting", "no_pacing"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        await setMetaPacing({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          pacingType: input.pacingType,
        });
        const message = `Pacing set to ${input.pacingType}.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setPacing",
          payload: { campaignId: input.campaignId, pacingType: input.pacingType },
          ok: true,
          message,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setBudget: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        objectId: z.string().min(1),
        kind: z.enum(["daily", "lifetime", "spend_cap"]),
        amount: z.number().positive().max(1_000_000),
        currentAmount: z.number().optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      const recent = await ctx.prisma.metaWriteLog.findMany({
        where: {
          adAccountId: resolved.account.id,
          objectId: input.objectId,
          action: "setBudget",
          ok: true,
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      });
      const hour = canEditBudgetThisHour(recent.map((row) => row.createdAt));
      if (!hour.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Meta allows 4 budget edits per hour on this object. Wait before the next change.",
        });
      }
      const currentCents = amountToMetaCents(input.currentAmount ?? input.amount);
      const nextCents = amountToMetaCents(input.amount);
      const over20 = budgetChangeResetsLearning(currentCents, nextCents);
      if (over20) {
        await guardSignificant("budget_over_20", Boolean(input.learning), input.confirmLearningReset);
      }
      try {
        await setMetaBudget({
          accessToken: resolved.accessToken,
          objectId: input.objectId,
          kind: input.kind,
          amount: input.amount,
        });
        if (input.kind !== "spend_cap" && input.objectId === input.campaignId) {
          await ctx.prisma.adCampaign.updateMany({
            where: { adAccountId: resolved.account.id, platformCampaignId: input.campaignId },
            data: {
              ...(input.kind === "daily" ? { dailyBudget: input.amount, budgetType: "daily" } : {}),
              ...(input.kind === "lifetime" ? { lifetimeBudget: input.amount, budgetType: "lifetime" } : {}),
              lastSyncedAt: new Date(),
            },
          });
        }
        const message = `${input.kind} budget set to ${input.amount}.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: input.objectId === input.campaignId ? "campaign" : "adset",
          objectId: input.objectId,
          action: "setBudget",
          payload: { campaignId: input.campaignId, kind: input.kind, amount: input.amount },
          ok: true,
          message,
          learningRisk: over20,
        });
        return { ok: true, message, learningRisk: over20, remainingEdits: hour.remaining - 1 };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setBid: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        strategy: z.enum([
          "LOWEST_COST_WITHOUT_CAP",
          "LOWEST_COST_WITH_BID_CAP",
          "COST_CAP",
          "LOWEST_COST_WITH_MIN_ROAS",
        ]),
        bidAmount: z.number().positive().optional(),
        minRoas: z.number().positive().max(100).optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("bid_strategy", Boolean(input.learning), input.confirmLearningReset);
      try {
        await setMetaBid({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          strategy: input.strategy as BidStrategy,
          bidAmount: input.bidAmount,
          minRoas: input.minRoas,
        });
        const message = `Bid strategy set to ${input.strategy}.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setBid",
          payload: { campaignId: input.campaignId, strategy: input.strategy },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setSchedule: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        startMinute: z.number().min(0).max(1439).optional(),
        endMinute: z.number().min(1).max(1440).optional(),
        days: z.array(z.number().min(0).max(6)).optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("schedule", Boolean(input.learning), input.confirmLearningReset);
      try {
        await setMetaSchedule({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          startTime: input.startTime,
          endTime: input.endTime,
          schedule:
            input.startMinute != null && input.endMinute != null
              ? { startMinute: input.startMinute, endMinute: input.endMinute, days: input.days ?? [0, 1, 2, 3, 4, 5, 6] }
              : null,
        });
        const message = "Schedule updated.";
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setSchedule",
          payload: { campaignId: input.campaignId },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setAudience: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        countries: z.array(z.string()).min(1),
        ageMin: z.number().min(18).max(65),
        ageMax: z.number().min(18).max(65),
        advantageAudience: z.boolean(),
        excludedAudienceIds: z.array(z.string()).optional(),
        includedAudienceIds: z.array(z.string()).optional(),
        locales: z.array(z.number().int().positive()).optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("targeting", Boolean(input.learning), input.confirmLearningReset);
      try {
        await setMetaAudience({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          countries: input.countries,
          ageMin: input.ageMin,
          ageMax: input.ageMax,
          advantageAudience: input.advantageAudience,
          includedAudienceIds: input.includedAudienceIds,
          excludedAudienceIds: input.excludedAudienceIds,
          locales: input.locales,
        });
        const message = "Audience updated.";
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setAudience",
          payload: { campaignId: input.campaignId, countries: input.countries },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setFrequency: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        intervalDays: z.number().min(1).max(90),
        maxFrequency: z.number().min(0).max(90),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      if (input.maxFrequency > 0) {
        await guardSignificant("targeting", Boolean(input.learning), input.confirmLearningReset);
      }
      try {
        await setMetaFrequency({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          intervalDays: input.intervalDays,
          maxFrequency: input.maxFrequency,
        });
        const message = input.maxFrequency <= 0
          ? "Frequency cap cleared."
          : `Frequency cap set to ${input.maxFrequency} / ${input.intervalDays} days.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setFrequency",
          payload: { campaignId: input.campaignId, intervalDays: input.intervalDays, maxFrequency: input.maxFrequency },
          ok: true,
          message,
          learningRisk: input.maxFrequency > 0,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  setOptimization: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        optimizationGoal: z.string().min(1),
        attributionPreset: z.enum(["7d_click_1d_view", "1d_click", "7d_click"]).optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("optimization", Boolean(input.learning), input.confirmLearningReset);
      try {
        await setMetaOptimization({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          optimizationGoal: input.optimizationGoal,
          attributionPreset: input.attributionPreset,
        });
        const message = `Optimization set to ${input.optimizationGoal}.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "setOptimization",
          payload: { campaignId: input.campaignId, optimizationGoal: input.optimizationGoal },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  createValueRules: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        name: z.string().min(1).max(80),
        adSetId: z.string().optional(),
        rules: z
          .array(
            z.object({
              name: z.string().min(1),
              adjustSign: z.enum(["INCREASE", "DECREASE"]),
              adjustValue: z.number().min(1).max(1000),
              criteriaType: z.enum(["LOCATION", "OS_TYPE", "DEVICE_PLATFORM", "PLACEMENT", "GENDER", "AGE"]),
              criteriaValues: z.array(z.string()).min(1),
            }),
          )
          .min(1)
          .max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        const id = await createMetaValueRuleSet({
          accessToken: resolved.accessToken,
          accountId: resolved.account.accountId,
          name: input.name,
          rules: input.rules,
        });
        if (input.adSetId) {
          await attachMetaValueRules({
            accessToken: resolved.accessToken,
            adSetId: input.adSetId,
            valueRuleSetId: id,
          });
        }
        const message = input.adSetId ? `Value rules created and attached (${id}).` : `Value rules created (${id}).`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "value_rule",
          objectId: id,
          action: "createValueRules",
          payload: { campaignId: input.campaignId, adSetId: input.adSetId },
          ok: true,
          message,
        });
        return { ok: true, message, valueRuleSetId: id };
      } catch (error) {
        asTrpc(error);
      }
    }),

  attachValueRules: organizationAdminProcedure
    .input(campaignIdSchema.extend({ adSetId: z.string().min(1), valueRuleSetId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        await attachMetaValueRules({
          accessToken: resolved.accessToken,
          adSetId: input.adSetId,
          valueRuleSetId: input.valueRuleSetId,
        });
        const message = "Value rules attached to this ad set.";
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "adset",
          objectId: input.adSetId,
          action: "attachValueRules",
          payload: { campaignId: input.campaignId, valueRuleSetId: input.valueRuleSetId },
          ok: true,
          message,
        });
        return { ok: true, message };
      } catch (error) {
        asTrpc(error);
      }
    }),

  duplicate: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        objectId: z.string().min(1),
        kind: z.enum(["campaign", "adset", "ad"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      try {
        const copiedId = await duplicateMetaObject({
          accessToken: resolved.accessToken,
          objectId: input.objectId,
          kind: input.kind,
          deepCopy: input.kind === "campaign",
        });
        const message = `Paused copy created (${copiedId}). Edit the copy — the original stays in learning.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: input.kind,
          objectId: copiedId,
          action: "duplicate",
          payload: { campaignId: input.campaignId, sourceId: input.objectId },
          ok: true,
          message,
        });
        return { ok: true, message, copiedId };
      } catch (error) {
        asTrpc(error);
      }
    }),

  swapCreative: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adId: z.string().min(1),
        pageId: z.string().min(1),
        primaryText: z.string().min(1).max(2000),
        headline: z.string().min(1).max(80),
        landingUrl: z.string().url(),
        cta: z.string().min(1),
        description: z.string().max(200).optional(),
        urlTags: z.string().max(500).optional(),
        instagramUserId: z.string().optional(),
        standardEnhancements: z.boolean().optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("creative", Boolean(input.learning), input.confirmLearningReset);
      try {
        const creativeId = await swapMetaAdCreative({
          accessToken: resolved.accessToken,
          accountId: resolved.account.accountId,
          adId: input.adId,
          pageId: input.pageId,
          primaryText: input.primaryText,
          headline: input.headline,
          landingUrl: input.landingUrl,
          cta: input.cta,
          description: input.description,
          urlTags: input.urlTags,
          instagramUserId: input.instagramUserId,
          standardEnhancements: input.standardEnhancements,
        });
        const message = `New creative attached (${creativeId}). The previous creative was not mutated.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "ad",
          objectId: input.adId,
          action: "swapCreative",
          payload: { campaignId: input.campaignId, creativeId },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message, creativeId };
      } catch (error) {
        asTrpc(error);
      }
    }),

  addAd: organizationAdminProcedure
    .input(
      campaignIdSchema.merge(confirmSchema).extend({
        adSetId: z.string().min(1),
        name: z.string().min(1).max(200),
        pageId: z.string().min(1),
        primaryText: z.string().min(1).max(2000),
        headline: z.string().min(1).max(80),
        landingUrl: z.string().url(),
        cta: z.string().min(1),
        description: z.string().max(200).optional(),
        urlTags: z.string().max(500).optional(),
        instagramUserId: z.string().optional(),
        standardEnhancements: z.boolean().optional(),
        learning: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      await guardSignificant("add_ad", Boolean(input.learning), input.confirmLearningReset);
      try {
        const adId = await addPausedMetaAd({
          accessToken: resolved.accessToken,
          accountId: resolved.account.accountId,
          adSetId: input.adSetId,
          name: input.name,
          pageId: input.pageId,
          primaryText: input.primaryText,
          headline: input.headline,
          landingUrl: input.landingUrl,
          cta: input.cta,
          description: input.description,
          urlTags: input.urlTags,
          instagramUserId: input.instagramUserId,
          standardEnhancements: input.standardEnhancements,
        });
        const message = `Paused ad created (${adId}). Activate it when you are ready to spend.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "ad",
          objectId: adId,
          action: "addAd",
          payload: { campaignId: input.campaignId, adSetId: input.adSetId },
          ok: true,
          message,
          learningRisk: true,
        });
        return { ok: true, message, adId };
      } catch (error) {
        asTrpc(error);
      }
    }),

  killSwitch: organizationAdminProcedure
    .input(
      campaignIdSchema.extend({
        mode: z.enum(["pause_adsets", "pause_campaign", "pause_ads", "spend_cap"]),
        spendCap: z.number().positive().optional(),
        confirmText: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolved = await resolveMetaWriter(ctx, input);
      if (input.confirmText.trim().toUpperCase() !== "PAUSE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'Type PAUSE to confirm the kill switch.',
        });
      }
      try {
        const result = await killSwitchMeta({
          accessToken: resolved.accessToken,
          campaignId: input.campaignId,
          mode: input.mode,
          spendCap: input.spendCap,
        });
        if (input.mode === "pause_campaign") {
          await ctx.prisma.adCampaign.updateMany({
            where: { adAccountId: resolved.account.id, platformCampaignId: input.campaignId },
            data: { status: "paused", effectiveStatus: "PAUSED", lastSyncedAt: new Date() },
          });
        }
        const message =
          input.mode === "spend_cap"
            ? `Campaign spend cap set to ${input.spendCap}.`
            : input.mode === "pause_campaign"
              ? "Campaign paused."
              : `Paused ${result.paused} ad set(s). The campaign object is still active.`;
        await logWrite(ctx, {
          adAccountId: resolved.account.id,
          objectType: "campaign",
          objectId: input.campaignId,
          action: "killSwitch",
          payload: { campaignId: input.campaignId, mode: input.mode },
          ok: true,
          message,
        });
        return { ok: true, message, ...result };
      } catch (error) {
        asTrpc(error);
      }
    }),
});
