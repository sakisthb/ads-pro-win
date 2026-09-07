import { env } from "@/env";

export function authProvidersUrl(): string {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  return `https://supabase.com/dashboard/project/${ref}/auth/providers`;
}

export function safeAppPath(redirect: string | null | undefined): string {
  if (
    !redirect ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes("\\")
  ) {
    return "/dashboard";
  }
  return redirect;
}

export function mapAuthError(message: string, code?: string): string {
  if (
    code === "email_provider_disabled" ||
    /email logins are disabled/i.test(message)
  ) {
    return "Email logins are turned off in Supabase Auth for this project. Re-enable Email (password) under Authentication → Providers, then sign in again. Your password was not rejected.";
  }
  return message;
}

export async function isEmailAuthEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return true;
    const json = (await res.json()) as { external?: { email?: boolean } };
    return json.external?.email !== false;
  } catch {
    return true;
  }
}
