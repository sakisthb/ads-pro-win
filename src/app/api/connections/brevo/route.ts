import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { safeFetch } from "@/lib/safe-fetch";
import {
  OrganizationAuthorizationError,
  requireOrganizationRoleForUser,
  requireOwnedBrand,
} from "@/lib/organization-authorization";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const connectionSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  brandId: z.string().min(1, "brandId is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// POST /api/connections/brevo
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

  const { apiKey, brandId } = body;

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
    // 3. Test the Brevo connection via account endpoint
    const testRes = await safeFetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey },
    });
    if (!testRes.ok) {
      const detail = await testRes.text();
      console.error(
        `[api/connections/brevo] Connection test failed (${testRes.status}): ${detail}`,
      );
      return json(
        { success: false, error: "Connection failed. Please check your API key." },
        400,
      );
    }

    // Validate the response is genuine Brevo data
    const accountData = (await testRes.json()) as unknown;
    if (!accountData || typeof accountData !== "object") {
      return json(
        { success: false, error: "Invalid response from Brevo." },
        400,
      );
    }

    // 4. Encrypt the API key
    const encryptedKey = encrypt(apiKey);

    // 5. Upsert the AdAccount record for this brand + brevo platform
    const existing = await prisma.adAccount.findFirst({
      where: { brandId, platform: "brevo" },
    });

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: encryptedKey,
          isActive: true,
        },
      });
    } else {
      await prisma.adAccount.create({
        data: {
          brandId,
          platform: "brevo",
          accountId: `brevo-${brandId}`,
          name: "Brevo",
          accessToken: encryptedKey,
          isActive: true,
        },
      });
    }

    // 6. Success
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/connections/brevo] Error:", message);
    return json({ success: false, error: "Connection failed" }, 400);
  }
}
