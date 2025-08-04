import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ads Pro Enterprise - Advanced Attribution Analytics",
  description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
  keywords: "attribution analytics, digital marketing, cross-channel reporting, marketing automation, ROI tracking",
  authors: [{ name: "Ads Pro Enterprise" }],
  openGraph: {
    title: "Ads Pro Enterprise - Advanced Attribution Analytics",
    description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
    type: "website",
    url: "https://ads-pro-enterprise.vercel.app",
    siteName: "Ads Pro Enterprise",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ads Pro Enterprise - Advanced Attribution Analytics",
    description: "Performance digital marketing platform with advanced attribution analytics and cross-channel reporting that drives real results.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
