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
  storeUrl: z.string().url("Invalid store URL"),
  username: z.string().min(1, "API username is required"),
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
// POST /api/connections/opencart
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

  const { storeUrl, username, apiKey, brandId } = body;

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
    // 3. Test the OpenCart connection by requesting an API token.
    //    OpenCart 3.x: POST {storeUrl}/index.php?route=api/login with a
    //    form-urlencoded body `username=...&key=...`. A valid response
    //    contains an `api_token` field we use for subsequent GET calls.
    //    This is READ-ONLY — we never mutate data in the OpenCart store.
    const base = storeUrl.replace(/\/+$/, "");
    const loginUrl = new URL(`${base}/index.php`);
    loginUrl.searchParams.set("route", "api/login");

    const loginRes = await safeFetch(loginUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, key: apiKey }).toString(),
      timeoutMs: 20_000,
    });

    let loginPayload: { api_token?: string; error?: string } | null = null;
    try {
      loginPayload = (await loginRes.json()) as { api_token?: string; error?: string };
    } catch {
      // non-JSON response — treat as connection failure below
    }

    const apiToken = loginPayload?.api_token ?? "";

    if (!loginRes.ok || !apiToken) {
      const detail =
        loginPayload?.error ??
        (loginRes.ok ? "No api_token returned" : `HTTP ${loginRes.status}`);
      console.error(
        `[api/connections/opencart] Connection test failed: ${detail}`,
      );
      return json(
        { success: false, error: "Connection failed. Please check your store URL and credentials." },
        400,
      );
    }

    // 4. Encrypt credentials
    //    Following the WooCommerce convention, the encrypted username is
    //    stored in `accessToken` and the encrypted API key in `refreshToken`.
    const encryptedUsername = encrypt(username);
    const encryptedKey = encrypt(apiKey);

    // 5. Upsert the AdAccount record for this brand + opencart platform
    const existing = await prisma.adAccount.findFirst({
      where: { brandId, platform: "opencart" },
    });

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          accountId: base,           // storeUrl
          accessToken: encryptedUsername,
          refreshToken: encryptedKey,
          isActive: true,
        },
      });
    } else {
      await prisma.adAccount.create({
        data: {
          brandId,
          platform: "opencart",
          accountId: base,           // storeUrl
          name: `OpenCart – ${new URL(base).hostname}`,
          accessToken: encryptedUsername,
          refreshToken: encryptedKey,
          isActive: true,
        },
      });
    }

    // 6. Success
    return json({ success: true, storeUrl: base });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/connections/opencart] Error:", message);
    return json({ success: false, error: "Connection failed" }, 400);
  }
}
