// tRPC Server Configuration for Ads Pro Enterprise
// AI-Powered Marketing Intelligence Platform

import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Custom session type for Clerk
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

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;

  // Get the session from the server using the getServerSession wrapper
  const session = await getServerAuthSession({ req, res });

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
    throw new TRPCError({ code: "FORBIDDEN", message: "Email not verified" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const enforceUserIsAuthedAndHasOrganization = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Get user's organization
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    include: {
      organization: true,
    },
  });

  if (!user?.organization) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "User must be part of an organization" 
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      organization: user.organization,
      organizationId: user.organization.id,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
export const verifiedProcedure = t.procedure.use(enforceUserIsAuthedAndVerified);
export const organizationProcedure = t.procedure.use(enforceUserIsAuthedAndHasOrganization); 