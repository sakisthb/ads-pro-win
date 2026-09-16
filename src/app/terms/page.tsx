import type { Metadata } from "next";
import { TermsOfUse } from "@/components/legal/terms-of-use";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Όροι χρήσης · ${BRAND.name}`,
  description: `Όροι χρήσης για το ${BRAND.name}.`,
  alternates: {
    canonical: BRAND.termsUrl,
  },
  openGraph: {
    title: `Όροι χρήσης · ${BRAND.name}`,
    url: BRAND.termsUrl,
    siteName: BRAND.name,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  return <TermsOfUse />;
}
