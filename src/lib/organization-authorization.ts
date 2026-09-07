import { getActiveOrgId } from "@/lib/active-org";
import { getSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pickLiveDefaultMembership } from "@/lib/org-default";
import { logSecurityEvent } from "@/lib/security-events";

export const organizationRoles = ["owner", "admin", "member", "viewer"] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export interface OrganizationMembershipAuthorization {
  organizationId: string;
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    isDefault: boolean;
  };
}

export interface OrganizationAuthorization extends OrganizationMembershipAuthorization {
  session: Session;
}

export class OrganizationAuthorizationError extends Error {
  constructor(
    readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "OrganizationAuthorizationError";
  }
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (organizationRoles as readonly string[]).includes(value);
}

async function resolveMembership(userId: string) {
  const activeOrganizationId = await getActiveOrgId();

  if (activeOrganizationId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: activeOrganizationId,
        },
      },
    });
    if (membership) {
      return membership;
    }
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    include: { organization: { select: { id: true, slug: true } } },
  });

  return pickLiveDefaultMembership(memberships) ?? null;
}

export async function requireOrganizationRoleForUser(
  userId: string,
  allowedRoles: readonly OrganizationRole[],
): Promise<OrganizationMembershipAuthorization> {
  const membership = await resolveMembership(userId);
  if (!membership) {
    logSecurityEvent("authz_denied", "warn", { code: "membership_required", userId });
    throw new OrganizationAuthorizationError(403, "Organization membership is required");
  }

  if (!isOrganizationRole(membership.role)) {
    logSecurityEvent("authz_denied", "warn", {
      code: "unrecognized_role",
      userId,
      organizationId: membership.organizationId,
      role: membership.role,
    });
    throw new OrganizationAuthorizationError(403, "Organization role is not recognized");
  }

  if (!allowedRoles.includes(membership.role)) {
    logSecurityEvent("authz_denied", "warn", {
      code: "insufficient_permissions",
      userId,
      organizationId: membership.organizationId,
      role: membership.role,
      required: allowedRoles.join("|"),
    });
    throw new OrganizationAuthorizationError(403, "Insufficient organization permissions");
  }

  return {
    organizationId: membership.organizationId,
    membership: {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      isDefault: membership.isDefault,
    },
  };
}

export async function requireOrganizationRole(
  allowedRoles: readonly OrganizationRole[],
): Promise<OrganizationAuthorization> {
  const session = await getSession();
  if (!session) {
    logSecurityEvent("authz_denied", "warn", { code: "unauthenticated" });
    throw new OrganizationAuthorizationError(401, "Unauthorized");
  }

  return {
    session,
    ...(await requireOrganizationRoleForUser(session.userId, allowedRoles)),
  };
}

export async function requireOwnedBrand(
  authorization: OrganizationMembershipAuthorization,
  brandId: string,
) {
  const brand = await prisma.brand.findFirst({
    where: {
      id: brandId,
      organizationId: authorization.organizationId,
    },
  });

  if (!brand) {
    logSecurityEvent("authz_denied", "warn", {
      code: "brand_not_found",
      userId: authorization.membership.userId,
      organizationId: authorization.organizationId,
      brandId,
    });
    throw new OrganizationAuthorizationError(404, "Brand not found");
  }

  return brand;
}
