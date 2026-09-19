import { TRPCError } from "@trpc/server";
import { getMetaGrantedPermissions, resolveLaunchAccount } from "@/lib/platform-launch";
import { canEditBudgetThisHour, LEARNING_RESET_MESSAGE } from "@/lib/meta/operator-logic";
import { resolveMetaWriteGate } from "@/lib/meta/write-policy";

interface MetaWriteRouterContext {
  prisma: typeof import("@/lib/db").prisma;
  organizationId: string;
  organization: { slug: string };
  session: { user: { id: string } };
}

export function asTrpc(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message === LEARNING_RESET_MESSAGE) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export async function resolveMetaWriter(
  ctx: Pick<MetaWriteRouterContext, "prisma" | "organizationId" | "organization">,
  input: { brandId?: string; adAccountId?: string },
) {
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
  let brandWebsite: string | null = null;
  if (input.brandId) {
    const brand = await ctx.prisma.brand.findFirst({
      where: { id: input.brandId, organizationId: ctx.organizationId },
      select: { website: true },
    });
    brandWebsite = brand?.website ?? null;
  }
  const gate = resolveMetaWriteGate({
    organizationSlug: ctx.organization.slug,
    grantedScopes: granted,
    operatorAuthorizedMetaWrite: true,
    brandWebsite,
  });
  if (!gate.allowed) {
    throw new TRPCError({
      code: gate.reason?.includes("Demo") ? "FORBIDDEN" : "PRECONDITION_FAILED",
      message: gate.reason ?? "Meta write blocked.",
    });
  }
  return { ...resolved, granted };
}

export async function logWrite(
  ctx: Pick<MetaWriteRouterContext, "prisma" | "organizationId" | "session">,
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

export async function assertMetaBudgetEditAllowed(
  ctx: Pick<MetaWriteRouterContext, "prisma">,
  adAccountId: string,
  objectId: string,
) {
  const recent = await ctx.prisma.metaWriteLog.findMany({
    where: {
      adAccountId,
      objectId,
      action: { in: ["setBudget", "scaleBudget"] },
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
  return hour;
}
