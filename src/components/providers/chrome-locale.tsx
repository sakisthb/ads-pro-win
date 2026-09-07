"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ChromeLocale = "en" | "el";

const STORAGE_KEY = "ads-pro-locale";
const EVENT = "adspro:locale";

const DICT: Record<ChromeLocale, Record<string, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.campaigns": "Campaigns",
    "nav.analytics": "Analytics",
    "nav.studio": "Analytics Studio",
    "nav.realtime": "Real-Time",
    "nav.chat": "AI Chat",
    "nav.predictions": "AI Predictions",
    "nav.attribution": "Attribution",
    "nav.funnel": "Funnel Analysis",
    "nav.audiences": "Audiences",
    "nav.cross": "Cross-Platform",
    "nav.bidding": "Bid Management",
    "nav.fatigue": "Creative Fatigue",
    "nav.seo": "SEO · GEO · AEO",
    "nav.email": "Email · Brevo",
    "nav.mystery": "Mystery AI",
    "nav.launcher": "Campaign Studio",
    "nav.alerts": "Budget Alerts",
    "nav.mission": "Mission Control",
    "nav.reports": "Report Builder",
    "nav.connections": "Connections",
    "nav.customers": "Customers",
    "nav.team": "AI Team",
    "nav.notifications": "Notifications",
    "nav.billing": "Billing",
    "nav.settings": "Settings",
    "nav.help": "Help",
    "nav.profile": "Profile",
    "nav.onboarding": "First session",
    "section.main": "MAIN",
    "section.intelligence": "INTELLIGENCE",
    "section.automation": "AUTOMATION",
    "section.tools": "TOOLS",
    "section.account": "ACCOUNT",
    "search.placeholder": "Search pages…",
    "ask.ai": "Ask AI",
    "demo.banner": "Demo workspace — StyleVault sample data only. Switch to your real workspace for live shops.",
  },
  el: {
    "nav.dashboard": "Πίνακας",
    "nav.campaigns": "Καμπάνιες",
    "nav.analytics": "Αναλυτικά",
    "nav.studio": "Studio αναλυτικών",
    "nav.realtime": "Σε πραγματικό χρόνο",
    "nav.chat": "AI Chat",
    "nav.predictions": "Προβλέψεις AI",
    "nav.attribution": "Attribution",
    "nav.funnel": "Χωνί",
    "nav.audiences": "Κοινά",
    "nav.cross": "Cross-Platform",
    "nav.bidding": "Προσφορές",
    "nav.fatigue": "Κόπωση creative",
    "nav.seo": "SEO · GEO · AEO",
    "nav.email": "Email · Brevo",
    "nav.mystery": "Mystery AI",
    "nav.launcher": "Studio καμπάνιας",
    "nav.alerts": "Ειδοποιήσεις budget",
    "nav.mission": "Mission Control",
    "nav.reports": "Αναφορές",
    "nav.connections": "Συνδέσεις",
    "nav.customers": "Πελάτες",
    "nav.team": "Ομάδα AI",
    "nav.notifications": "Ειδοποιήσεις",
    "nav.billing": "Χρέωση",
    "nav.settings": "Ρυθμίσεις",
    "nav.help": "Βοήθεια",
    "nav.profile": "Προφίλ",
    "nav.onboarding": "Πρώτη συνεδρία",
    "section.main": "ΚΥΡΙΟ",
    "section.intelligence": "ΝΟΗΜΟΣΥΝΗ",
    "section.automation": "ΑΥΤΟΜΑΤΙΣΜΟΣ",
    "section.tools": "ΕΡΓΑΛΕΙΑ",
    "section.account": "ΛΟΓΑΡΙΑΣΜΟΣ",
    "search.placeholder": "Αναζήτηση σελίδων…",
    "ask.ai": "Ρώτα AI",
    "demo.banner": "Demo χώρος — μόνο δείγμα StyleVault. Άλλαξε στον πραγματικό χώρο για τα live καταστήματα.",
  },
};

type ChromeLocaleValue = {
  locale: ChromeLocale;
  setLocale: (next: ChromeLocale) => void;
  t: (key: string) => string;
};

const ChromeLocaleContext = createContext<ChromeLocaleValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => DICT.en[key] ?? key,
});

export function readStoredLocale(): ChromeLocale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "el" ? "el" : "en";
  } catch {
    return "en";
  }
}

export function persistLocale(next: ChromeLocale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

export function ChromeLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<ChromeLocale>("en");

  useEffect(() => {
    setLocaleState(readStoredLocale());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ChromeLocale>).detail;
      if (detail === "en" || detail === "el") setLocaleState(detail);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const value = useMemo<ChromeLocaleValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        persistLocale(next);
      },
      t: (key) => DICT[locale][key] ?? DICT.en[key] ?? key,
    }),
    [locale],
  );

  return (
    <ChromeLocaleContext.Provider value={value}>{children}</ChromeLocaleContext.Provider>
  );
}

export function useChromeLocale() {
  return useContext(ChromeLocaleContext);
}
