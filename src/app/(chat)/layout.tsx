import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Suspense } from "react";

/**
 * Minimal layout for the AI Chat page.
 * Performs the Supabase auth gate but renders children full-viewport —
 * no AppSidebar, no ProfessionalNavbar, no ProtectedLayout chrome.
 * The chat page manages its own sidebar and header internally.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-400" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
