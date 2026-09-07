import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationAdminProcedure,
  organizationProcedure,
} from "../server";
import { prisma } from "@/lib/db";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fetch an AlertRule owned by the caller's organization or throw NOT_FOUND.
 * Prevents cross-org mutation by verifying organizationId before any write.
 */
async function getOwnedAlertRuleOrThrow(organizationId: string, id: string) {
  const rule = await prisma.alertRule.findFirst({
    where: { id, organizationId },
  });
  if (!rule) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Alert rule not found",
    });
  }
  return rule;
}

// ============================================================================
// Router
// ============================================================================

export const alertsRouter = createTRPCRouter({
  // --------------------------------------------------------------------------
  // listRules — all AlertRules for the caller's active organization.
  // --------------------------------------------------------------------------
  listRules: organizationProcedure.query(async ({ ctx }) => {
    return prisma.alertRule.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
    });
  }),

  // --------------------------------------------------------------------------
  // createRule — create a new budget alert rule scoped to the organization.
  // --------------------------------------------------------------------------
  createRule: organizationAdminProcedure
    .input(
      z.object({
        brandId: z.string().optional(),
        platform: z.string().optional(),
        thresholdAmount: z.number().positive(),
        period: z.enum(["daily", "weekly"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.brandId) {
        const brand = await prisma.brand.findFirst({
          where: { id: input.brandId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!brand) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
        }
      }

      return prisma.alertRule.create({
        data: {
          organizationId: ctx.organizationId,
          brandId: input.brandId ?? null,
          platform: input.platform ?? null,
          thresholdAmount: input.thresholdAmount,
          period: input.period,
        },
      });
    }),

  // --------------------------------------------------------------------------
  // updateRule — modify an owned alert rule. Ownership verified first.
  // --------------------------------------------------------------------------
  updateRule: organizationAdminProcedure
    .input(
      z.object({
        id: z.string(),
        thresholdAmount: z.number().positive().optional(),
        isActive: z.boolean().optional(),
        period: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getOwnedAlertRuleOrThrow(ctx.organizationId, input.id);

      const data: {
        thresholdAmount?: number;
        isActive?: boolean;
        period?: string;
      } = {};
      if (input.thresholdAmount !== undefined) data.thresholdAmount = input.thresholdAmount;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.period !== undefined) data.period = input.period;

      return prisma.alertRule.update({
        where: { id: input.id },
        data,
      });
    }),

  // --------------------------------------------------------------------------
  // deleteRule — remove an owned alert rule. Ownership verified first.
  // --------------------------------------------------------------------------
  deleteRule: organizationAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await getOwnedAlertRuleOrThrow(ctx.organizationId, input.id);
      await prisma.alertRule.delete({ where: { id: rule.id } });
      return { id: rule.id, deleted: true };
    }),

  // --------------------------------------------------------------------------
  // listTriggered — recent alert notifications for the organization.
  // --------------------------------------------------------------------------
  listTriggered: organizationProcedure.query(async ({ ctx }) => {
    return prisma.notification.findMany({
      where: {
        organizationId: ctx.organizationId,
        type: "alert",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  unreadCount: organizationProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({
      where: { organizationId: ctx.organizationId, isRead: false },
    });
  }),

  markRead: organizationAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.notification.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }
      return prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true },
      });
    }),

  markAllRead: organizationAdminProcedure.mutation(async ({ ctx }) => {
    const result = await prisma.notification.updateMany({
      where: { organizationId: ctx.organizationId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }),
});
