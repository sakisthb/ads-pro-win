// tRPC Server Configuration for Ads Pro Enterprise
// AI-Powered Marketing Intelligence Platform

import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";

import { getSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OrganizationAuthorizationError,
  organizationRoles,
  requireOrganizationRoleForUser,
  type OrganizationRole,
} from "@/lib/organization-authorization";
import { logSecurityEvent } from "@/lib/security-events";

// Session shape consumed by tRPC context (mapped from the Supabase session)
interface CustomSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
  expires: string;
}

interface CreateContextOptions {
  session: CustomSession | null;
}

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
  };
};

function toCustomSession(session: Session | null): CustomSession | null {
  if (!session) {
    return null;
  }
  return {
    user: {
      id: session.userId,
      email: session.email,
      emailVerified: session.emailVerified,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  // Supabase Auth session (read from request cookies via the server client)
  const session = toCustomSession(await getSession());

  return createInnerTRPCContext({
    session,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    logSecurityEvent("authz_denied", "warn", { code: "unauthenticated" });
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const enforceUserIsAuthedAndVerified = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.session.user.emailVerified) {
    logSecurityEvent("authz_denied", "warn", {
      code: "email_unverified",
      userId: ctx.session.user.id,
    });
    throw new TRPCError({ code: "FORBIDDEN", message: "Email not verified" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const enforceUserIsAuthedAndHasOrganization = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  let authorization;
  try {
    authorization = await requireOrganizationRoleForUser(
      ctx.session.user.id,
      organizationRoles,
    );
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      throw new TRPCError({
        code: error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        message: error.message,
        cause: error,
      });
    }
    throw error;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: authorization.organizationId },
  });

  if (!organization) {
    logSecurityEvent("authz_denied", "error", {
      code: "organization_not_found",
      userId: ctx.session.user.id,
      organizationId: authorization.organizationId,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization not found",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      organization,
      organizationId: authorization.organizationId,
      organizationMembership: authorization.membership,
      organizationRole: authorization.membership.role,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
export const verifiedProcedure = t.procedure.use(enforceUserIsAuthedAndVerified);
export const organizationProcedure = t.procedure.use(enforceUserIsAuthedAndHasOrganization);
export const organizationAdminProcedure = organizationProcedure.use(({ ctx, next }) => {
  if (ctx.organizationRole !== "owner" && ctx.organizationRole !== "admin") {
    logSecurityEvent("authz_denied", "warn", {
      code: "admin_required",
      userId: ctx.session.user.id,
      organizationId: ctx.organizationId,
      role: ctx.organizationRole,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient organization permissions",
    });
  }
  return next();
});
export const organizationOwnerProcedure = organizationProcedure.use(({ ctx, next }) => {
  if (ctx.organizationRole !== "owner") {
    logSecurityEvent("authz_denied", "warn", {
      code: "owner_required",
      userId: ctx.session.user.id,
      organizationId: ctx.organizationId,
      role: ctx.organizationRole,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient organization permissions",
    });
  }
  return next();
});