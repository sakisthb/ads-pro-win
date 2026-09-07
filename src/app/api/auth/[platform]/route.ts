import { NextResponse } from "next/server";
import {
  buildOAuthUrl,
  getOrigin,
  googleOAuthOrigin,
  isOAuthPlatform,
  isPlatformConfigured,
  platformNotConfiguredMessage,
} from "@/lib/oauth/platforms";
import { createOAuthTransaction } from "@/lib/oauth/oauth-transactions";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-events";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";

/**
 * GET /api/auth/[platform]
 *
 * Kicks off an OAuth flow for meta | google-ads | tiktok. When the platform's
 * client id is configured, redirects (302) to the provider's authorization
 * endpoint. When it isn't, returns a JSON error the UI surfaces in-card.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  if (!isOAuthPlatform(platform)) {
    logSecurityEvent("oauth_failure", "warn", { code: "unknown_platform", platform });
    return NextResponse.json(
      { error: `Unknown platform "${platform}".` },
      { status: 404 },
    );
  }

  const session = await getSession();
  if (!session) {
    logSecurityEvent("oauth_failure", "warn", { code: "unauthenticated", platform });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let authorization;
  let brandId: string | null = null;
  try {
    authorization = await requireOrganizationRoleForUser(session.userId, [
      "owner",
      "admin",
    ]);
    brandId = url.searchParams.get("brand");
    if (brandId) {
      await requireOwnedBrand(authorization, brandId);
    }
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (!isPlatformConfigured(platform)) {
    logSecurityEvent("oauth_failure", "info", {
      code: "platform_not_configured",
      platform,
    });
    return NextResponse.json(
      { error: platformNotConfiguredMessage(platform) },
      { status: 503 },
    );
  }

  const origin =
    platform === "google-ads" ||
    platform === "google-analytics" ||
    platform === "google-search-console"
      ? googleOAuthOrigin(request)
      : getOrigin(request);

  const { rawState, codeChallenge, codeChallengeMethod } =
    await createOAuthTransaction(prisma, {
      platform,
      userId: session.userId,
      organizationId: authorization.organizationId,
      brandId,
      returnPath: url.searchParams.get("return"),
    });

  const authUrl = buildOAuthUrl(platform, origin, {
    state: rawState,
    codeChallenge,
    codeChallengeMethod,
  });
  return NextResponse.redirect(authUrl);
}
