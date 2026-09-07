import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ProtectedLayout } from "@/components/layouts/ProtectedLayout";
import { FloatingChat } from "@/components/ai/floating-chat";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingBanner } from "@/components/onboarding-banner";

/**
 * Layout for every authenticated route (dashboard, chat, connections,
 * settings). The `(protected)` route group does not appear in the URL.
 *
 * This is the authoritative server-side auth gate. The middleware performs a
 * pre-redirect for unauthenticated users, but this layout is the final source
 * of truth — even if the cookie refresh is bypassed, no protected page renders
 * without a valid Supabase session.
 */
export default async function ProtectedRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <ProtectedLayout email={session.email}>
      <OnboardingBanner />
      {children}
      <FloatingChat />
      <CommandPalette />
    </ProtectedLayout>
  );
}
