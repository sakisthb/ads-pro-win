/**
 * Invitations tRPC Router
 * Handles team member invitations for organizations
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationOwnerProcedure,
  organizationProcedure,
} from "../server";
import { sendInviteEmail } from "@/lib/email/send-invite";
import {
  generateInvitationToken,
  normalizeEmail,
} from "@/lib/invitation-tokens";
import type { OrganizationRole } from "@/lib/organization-authorization";

export const invitationsRouter = createTRPCRouter({
  /**
   * List all invitations for the current organization
   */
  list: organizationProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.prisma.invitation.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        invitedByUserId: true,
      },
    });

    return {
      success: true,
      data: invitations,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * List all current members of the organization
   */
  listMembers: organizationProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.organizationMembership.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      success: true,
      data: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        fullName: m.user.fullName,
        avatar: m.user.avatar,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Send a new invitation to join the organization
   */
  send: organizationOwnerProcedure
    .input(
      z.object({
        email: z.preprocess(
          (value) => (typeof value === "string" ? normalizeEmail(value) : value),
          z.string().email("Invalid email address"),
        ),
        role: z.enum(["admin", "member", "viewer"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { role, email } = input;
      const userId = ctx.session.user.id;
      const organizationId = ctx.organizationId;

      // Callers may not invite a role equal to or above their own.
      const roleRank: Record<OrganizationRole, number> = {
        owner: 4,
        admin: 3,
        member: 2,
        viewer: 1,
      };
      if (roleRank[role] >= roleRank[ctx.organizationRole]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot invite a user with this role",
        });
      }

      // Check if user is already a member
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        const existingMembership = await ctx.prisma.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId,
            },
          },
        });

        if (existingMembership) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User is already a member of this organization",
          });
        }
      }

      // Check for pending invitations
      const existingInvitation = await ctx.prisma.invitation.findFirst({
        where: {
          email,
          organizationId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active invitation already exists for this email",
        });
      }

      // Generate a raw token for the email link and store only its digest.
      const { raw, digest } = generateInvitationToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      const invitation = await ctx.prisma.invitation.create({
        data: {
          email,
          role,
          tokenDigest: digest,
          invitedByUserId: userId,
          organizationId,
          status: "pending",
          expiresAt,
        },
      });

      // Get organization and inviter details for email
      const organization = await ctx.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      const inviter = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });

      // Send invitation email. The raw token is passed only to the email helper
      // and is never returned to the caller or logged.
      await sendInviteEmail({
        email,
        orgName: organization?.name ?? "Organization",
        inviterName: inviter?.fullName ?? inviter?.email ?? "Team member",
        token: raw,
        role,
      });

      return {
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Revoke a pending invitation
   */
  revoke: organizationOwnerProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const organizationId = ctx.organizationId;

      // Verify the invitation belongs to this organization
      const invitation = await ctx.prisma.invitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.organizationId !== organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to revoke this invitation",
        });
      }

      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending invitations can be revoked",
        });
      }

      await ctx.prisma.invitation.delete({
        where: { id },
      });

      return {
        success: true,
        data: { id },
        timestamp: new Date().toISOString(),
      };
    }),
});
