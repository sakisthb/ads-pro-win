/**
 * Onboarding page — server component shell.
 *
 * The heavy wizard UI lives in `onboarding-client.tsx` (client component).
 * This file exists so Next.js treats the route as a server component entry
 * and allows us to add server-side logic (e.g. metadata, auth guards) later.
 */

import OnboardingClient from "./onboarding-client";

export const metadata = {
  title: "Onboarding — Ads Pro",
  description: "Set up your Ads Pro workspace in a few quick steps.",
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
