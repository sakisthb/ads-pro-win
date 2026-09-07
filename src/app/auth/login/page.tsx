import { Suspense } from "react";
import LoginForm from "./login-form";

/**
 * Login page shell.
 *
 * The form itself is a client component that reads query params via
 * useSearchParams(); Next.js requires that hook to sit inside a
 * <Suspense> boundary so the page can be statically prerendered.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="w-full max-w-md animate-pulse"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-[26.5rem] rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-xl" />
          <span className="sr-only">Loading sign in…</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
