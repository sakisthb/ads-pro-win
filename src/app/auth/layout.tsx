"use client";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { BRAND } from "@/lib/brand";

/**
 * Shared quiet chrome for /auth/* routes.
 * Monochrome charcoal — no purple orbs, no gradient mark.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{ backgroundColor: BRAND.ink }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: BRAND.charcoal }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <a
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <BrandLockup className="h-8 max-w-[220px]" />
      </a>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}
