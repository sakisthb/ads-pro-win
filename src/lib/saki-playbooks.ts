import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  DollarSign,
  Lightbulb,
  Palette,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export type PlaybookCategory =
  | "Performance"
  | "Budget"
  | "Creative"
  | "Audience"
  | "Funnel";

export interface SakiPlaybook {
  id: string;
  category: PlaybookCategory;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export const SAKI_PLAYBOOKS: SakiPlaybook[] = [
  {
    id: "roas-30d",
    category: "Performance",
    label: "Five clocks 30d",
    prompt: "Name Pixel ROAS, Woo till, GA4 purchases, GSC clicks, and Brevo delivered for the last 30 days as five clocks. Do not blend them into one ROAS. If Google Ads or TikTok spend is €0, say so — Woo last-click Google is till, not Ads spend.",
    icon: Sparkles,
  },
  {
    id: "compare-7d",
    category: "Performance",
    label: "Compare 7d vs prior",
    prompt: "Compare this week's spend, revenue, and ROAS against the previous 7 days. Call out the biggest movers.",
    icon: BarChart3,
  },
  {
    id: "top-campaigns",
    category: "Performance",
    label: "Top campaigns",
    prompt: "List the top 5 campaigns by ROAS this period and the bottom 5 by wasted spend.",
    icon: Target,
  },
  {
    id: "health-check",
    category: "Performance",
    label: "Campaign health",
    prompt: "Run a health check on all active campaigns: CTR, CPC, CPA, and any learning-limited sets.",
    icon: TrendingUp,
  },
  {
    id: "predict-week",
    category: "Performance",
    label: "Predict next week",
    prompt: "Based on the last 14 days, forecast next week's spend, conversions, and MER.",
    icon: TrendingUp,
  },
  {
    id: "find-waste",
    category: "Budget",
    label: "Find wasted spend",
    prompt: "Find wasted spend: campaigns with spend but weak conversions or ROAS below 1.5x.",
    icon: Lightbulb,
  },
  {
    id: "budget-shift",
    category: "Budget",
    label: "Reallocate budget",
    prompt: "How should I reallocate budget across Meta, Google, and TikTok based on current ROAS?",
    icon: DollarSign,
  },
  {
    id: "scale-winners",
    category: "Budget",
    label: "Scale winners",
    prompt: "Which campaigns can I scale 20% this week without breaking CPA?",
    icon: DollarSign,
  },
  {
    id: "daypart",
    category: "Budget",
    label: "Dayparting",
    prompt: "When during the day do conversions peak? Recommend bid or schedule changes.",
    icon: BarChart3,
  },
  {
    id: "creative-winners",
    category: "Creative",
    label: "Best creatives",
    prompt: "Which ad creatives are performing best on CTR and conversion rate?",
    icon: Palette,
  },
  {
    id: "fatigue",
    category: "Creative",
    label: "Creative fatigue",
    prompt: "Which ads show creative fatigue (frequency up, CTR down) and what should I refresh first?",
    icon: Palette,
  },
  {
    id: "hooks",
    category: "Creative",
    label: "New hooks",
    prompt: "Propose 5 new ad hooks for our current offer based on top converting campaigns.",
    icon: Sparkles,
  },
  {
    id: "ugc",
    category: "Creative",
    label: "UGC angles",
    prompt: "Suggest UGC-style angles and first-three-seconds scripts for Meta and TikTok.",
    icon: Palette,
  },
  {
    id: "audiences",
    category: "Audience",
    label: "Best audiences",
    prompt: "Which geo, age, and device slices convert best in this window? If the winner is Advantage+, do not recommend a lookalike — keep the catalog as control.",
    icon: Users,
  },
  {
    id: "exclusions",
    category: "Audience",
    label: "Exclusions",
    prompt: "Who should I exclude from prospecting so I stop paying for existing customers?",
    icon: Users,
  },
  {
    id: "lookalike",
    category: "Audience",
    label: "Advantage+ control",
    prompt: "If the funded campaign is Advantage+ catalog, keep it as the control. What format, offer, or landing move should I ship next instead of a 1% vs 3% lookalike test?",
    icon: Users,
  },
  {
    id: "geo",
    category: "Audience",
    label: "Geo winners",
    prompt: "Which countries or regions drive the best ROAS? Where should I cut or scale?",
    icon: Target,
  },
  {
    id: "funnel-drop",
    category: "Funnel",
    label: "Funnel drop-off",
    prompt: "Show impression → click → conversion drop-off and the cost of the biggest leak.",
    icon: BarChart3,
  },
  {
    id: "mer",
    category: "Funnel",
    label: "MER vs platform ROAS",
    prompt: "Compare MER (store revenue / ad spend) with platform-reported ROAS and explain the gap.",
    icon: DollarSign,
  },
  {
    id: "attribution",
    category: "Funnel",
    label: "Attribution",
    prompt: "Name Woo last-click mix (Direct, Google, Email, Meta). Last-click Google is till, not Google Ads spend. Last-click email is till, not Brevo ROAS. Do not invent assisted or view-through credit.",
    icon: Swords,
  },
  {
    id: "aov",
    category: "Funnel",
    label: "AOV & CPA",
    prompt: "What is Woo AOV and pixel CPA this period? If product COGS is unknown, say so — do not invent VAT or margin. Till profit is not Pixel ROAS.",
    icon: DollarSign,
  },
  {
    id: "retarget",
    category: "Funnel",
    label: "Retargeting",
    prompt: "How should I structure retargeting for cart abandoners vs viewers this week?",
    icon: Target,
  },
  {
    id: "competitors",
    category: "Performance",
    label: "No auction intel",
    prompt: "Do not invent competitor auction insights, impression share, or industry CTR benchmarks. Name our pixel CTR, CPC, and ROAS from DailyMetric. Auction overlap needs Google Ads Basic Access — this desk does not have it.",
    icon: Swords,
  },
  {
    id: "alerts",
    category: "Performance",
    label: "What broke today",
    prompt: "What changed today versus the trailing 7-day average? Flag anything that needs action.",
    icon: Lightbulb,
  },
  {
    id: "weekly-brief",
    category: "Budget",
    label: "Weekly CEO brief",
    prompt: "Write a one-page weekly CEO brief: spend, pixel ROAS, store MER if Woo is synced, winners, losers, and 3 actions. Do not treat MER as causal Meta ROAS.",
    icon: Sparkles,
  },
];

export const PLAYBOOK_CATEGORIES: PlaybookCategory[] = [
  "Performance",
  "Budget",
  "Creative",
  "Audience",
  "Funnel",
];
