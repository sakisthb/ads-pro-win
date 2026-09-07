import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureUserMemberships } from "@/lib/org-bootstrap";
import { activeOrgCookieOptions } from "@/lib/active-org";

/**
 * Supabase email-confirmation / OAuth callback handler.
 *
 * Exchanges the `code` query param for a real session, then bootstraps
 * organization memberships for brand-new users (Demo + personal workspace),
 * and finally redirects to the dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // An invite/expiry error from Supabase surfaces as `error`/`error_description`.
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  const redirectUrl = `${origin}${next}`;

  if (code) {
    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(error.message)}`,
      );
    }

    // ── Auto-membership bootstrap ──────────────────────────────────────────
    if (session?.user) {
      try {
        const meta = (session.user.user_metadata ?? {}) as Record<
          string,
          unknown
        >;
        const fullName =
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          (meta.fullName as string | undefined) ??
          null;

        const result = await ensureUserMemberships(
          session.user.id,
          session.user.email ?? "",
          fullName,
        );

        // Set the personal org as the active org cookie so the user lands in
        // their own workspace (they can always switch to the Demo showcase).
        if (result.ensured && result.personalOrgId) {
          const cookieOpts = activeOrgCookieOptions(result.personalOrgId);
          const response = NextResponse.redirect(redirectUrl);
          response.cookies.set(cookieOpts.name, cookieOpts.value, {
            httpOnly: cookieOpts.httpOnly,
            secure: cookieOpts.secure,
            sameSite: cookieOpts.sameSite,
            path: cookieOpts.path,
            maxAge: cookieOpts.maxAge,
          });
          return response;
        }
      } catch (err) {
        // Non-fatal: log but still redirect the user.
        console.error("[auth/callback] Auto-membership bootstrap failed:", err);
      }
    }
  }

  return NextResponse.redirect(redirectUrl);
}
