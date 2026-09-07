/**
 * Invitation Acceptance Endpoint
 * Protected POST-only flow that binds acceptance to the authenticated
 * recipient's email and consumes the invitation inside a transaction.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createInvitationTokenDigest,
  normalizeEmail,
} from "@/lib/invitation-tokens";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid request body");
  }

  const rawToken = typeof body.token === "string" ? body.token : "";
  if (!rawToken) {
    return errorResponse(400, "Invitation token is required");
  }

  const session = await getSession();
  if (!session) {
    return errorResponse(401, "Authentication required");
  }
  if (!session.email) {
    return errorResponse(403, "A verified email is required to accept an invitation");
  }

  const tokenDigest = createInvitationTokenDigest(rawToken);

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenDigest },
    });

    if (!invitation) {
      return errorResponse(404, "Invitation not found");
    }

    if (invitation.status !== "pending") {
      // Idempotent success if the same authenticated user already consumed it.
      if (
        invitation.status === "accepted" &&
        invitation.acceptedByUserId === session.userId
      ) {
        return NextResponse.json({ success: true });
      }
      return errorResponse(410, "Invitation has already been used");
    }

    if (invitation.expiresAt < new Date()) {
      return errorResponse(410, "Invitation has expired");
    }

    if (normalizeEmail(invitation.email) !== normalizeEmail(session.email)) {
      return errorResponse(
        403,
        "This invitation was sent to a different email address",
      );
    }

    await prisma.$transaction(async (tx) => {
      const existingMembership =
        await tx.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: session.userId,
              organizationId: invitation.organizationId,
            },
          },
        });

      if (!existingMembership) {
        await tx.organizationMembership.create({
          data: {
            userId: session.userId,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          acceptedByUserId: session.userId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[invite] Error processing invitation acceptance:", error);
    return errorResponse(500, "Failed to accept invitation");
  }
}
