import { cookies } from "next/headers";

const COOKIE_NAME = "x-active-org";

/** Server-side: read active org from cookies */
export async function getActiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/** For use in API routes that need to set the cookie */
export function activeOrgCookieOptions(orgId: string) {
  return {
    name: COOKIE_NAME,
    value: orgId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  };
}

export const ACTIVE_ORG_COOKIE_NAME = COOKIE_NAME;
