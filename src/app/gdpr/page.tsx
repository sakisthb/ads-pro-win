import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Προσωπικά δεδομένα / GDPR · ${BRAND.name}`,
  description: `Πολιτική προσωπικών δεδομένων (GDPR) για το ${BRAND.name}.`,
  alternates: {
    canonical: BRAND.privacyUrl,
  },
  openGraph: {
    title: `Προσωπικά δεδομένα / GDPR · ${BRAND.name}`,
    url: BRAND.privacyUrl,
    siteName: BRAND.name,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function GdprPage() {
  return <PrivacyPolicy />;
}
