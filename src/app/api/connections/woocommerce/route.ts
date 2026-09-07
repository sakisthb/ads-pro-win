import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";
import { testWooCommerceConnection } from "@/lib/woocommerce-rest";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const connectionSchema = z.object({
  storeUrl: z.string().url("Invalid store URL"),
  consumerKey: z.string().min(1, "Consumer key is required"),
  consumerSecret: z.string().min(1, "Consumer secret is required"),
  brandId: z.string().min(1, "brandId is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// POST /api/connections/woocommerce
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Session check
  const session = await getSession();
  if (!session) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // 2. Parse & validate body
  let body: z.infer<typeof connectionSchema>;
  try {
    const raw = await request.json();
    const result = connectionSchema.safeParse(raw);
    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error.issues[0]?.message ?? "Invalid request",
        },
        400,
      );
    }
    body = result.data;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { storeUrl, consumerKey, consumerSecret, brandId } = body;

  try {
    const authorization = await requireOrganizationRoleForUser(session.userId, [
      "owner",
      "admin",
    ]);
    await requireOwnedBrand(authorization, brandId);
  } catch (error) {
    if (error instanceof OrganizationAuthorizationError) {
      return json({ success: false, error: error.message }, error.status);
    }
    throw error;
  }

  try {
    // 3. Test by reading one order — the same REST surface we sync.
    //    system_status is admin-only and is a common false failure.
    const probe = await testWooCommerceConnection({
      storeUrl,
      consumerKey,
      consumerSecret,
    });
    if (!probe.ok) {
      console.error(`[api/connections/woocommerce] Connection test failed: ${probe.error}`);
      return json({ success: false, error: probe.error }, 400);
    }
    const base = probe.storeUrl;

    // 4. Encrypt credentials
    const encryptedKey = encrypt(consumerKey);
    const encryptedSecret = encrypt(consumerSecret);

    // 5. Upsert the AdAccount record for this brand + woocommerce platform
    const existing = await prisma.adAccount.findFirst({
      where: { brandId, platform: "woocommerce" },
    });

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          accountId: base,          // storeUrl
          accessToken: encryptedKey,
          refreshToken: encryptedSecret,
          isActive: true,
        },
      });
    } else {
      await prisma.adAccount.create({
        data: {
          brandId,
          platform: "woocommerce",
          accountId: base,           // storeUrl
          name: `WooCommerce – ${new URL(base).hostname}`,
          accessToken: encryptedKey,
          refreshToken: encryptedSecret,
          isActive: true,
        },
      });
    }

    // 6. Success
    return json({ success: true, storeUrl: base });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/connections/woocommerce] Error:", message);
    if (/ENCRYPTION_KEY/.test(message)) {
      return json(
        { success: false, error: "Server encryption is not configured (ENCRYPTION_KEY)." },
        500,
      );
    }
    return json({ success: false, error: "Connection failed" }, 400);
  }
}
