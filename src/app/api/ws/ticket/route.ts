import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OrganizationAuthorizationError,
  organizationRoles,
  requireOrganizationRoleForUser,
} from "@/lib/organization-authorization";
import { createWebSocketTicket } from "@/lib/websocket/tickets";

/**
 * POST /api/ws/ticket
 *
 * Issues a short-lived, single-use ticket that a client must present when
 * opening the WebSocket connection. The ticket is bound to the authenticated
 * user and their active organization and carries a permitted channel scope.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let authorization;
  try {
    authorization = await requireOrganizationRoleForUser(
      session.userId,
      organizationRoles,
    );
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  const { ticket, rawToken } = await createWebSocketTicket(prisma, {
    userId: session.userId,
    organizationId: authorization.organizationId,
    channels: ["ai_operations", "analytics_updates", "campaign_*"],
  });

  return NextResponse.json({
    token: rawToken,
    expiresAt: ticket.expiresAt.toISOString(),
  });
}
