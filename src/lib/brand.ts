export const BRAND = {
  name: "Ads Pro Digital",
  domain: "adpd.gr",
  siteUrl: "https://adpd.gr",
  privacyPath: "/gdpr",
  privacyUrl: "https://adpd.gr/gdpr",
  termsPath: "/terms",
  termsUrl: "https://adpd.gr/terms",
  ink: "#0A0A0A",
  charcoal: "#121417",
  paper: "#FFFFFF",
  assets: {
    mark: "/adpd-logo-mark.png",
    wordmark: "/adpd-logo-wordmark.png",
  },
} as const;

export function brandMetadata() {
  const description =
    "Paid marketing desk — campaigns, store till, and attribution.";
  return {
    title: BRAND.name,
    description,
    keywords:
      "paid ads, attribution, digital marketing, campaign analytics, Meta Ads, Google Ads",
    authors: [{ name: BRAND.name }],
    icons: {
      icon: BRAND.assets.mark,
      apple: BRAND.assets.mark,
    },
    openGraph: {
      title: BRAND.name,
      description,
      type: "website" as const,
      url: process.env.NEXT_PUBLIC_SITE_URL || BRAND.siteUrl,
      siteName: BRAND.name,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: BRAND.name,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function inviteEmailCopy(args: { orgName: string; inviterName: string }) {
  return {
    fromName: BRAND.name,
    subject: `${args.inviterName} invited you to ${args.orgName} on ${BRAND.name}`,
    body: `${args.inviterName} invited you to join ${args.orgName} on ${BRAND.name}.`,
  };
}
