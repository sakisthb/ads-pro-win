import type { AuditGoal } from "./performance-audit";

export type AuditMeasures = {
  spend: number; value: number; conversions: number; clicks: number; impressions: number;
  roas: number | null; cpa: number | null; cpc: number | null; ctr: number | null; cpm: number | null;
};
type Summary = AuditMeasures & { currency: string; previous: AuditMeasures | null };
type Definition = { id: string; label: string; role: "primary" | "driver" | "reference"; formula: string; caveat: string; key?: keyof AuditMeasures };
export const AUDIT_KPI_REFERENCES = [
  { label: "Google conversion columns and attribution clocks", url: "https://support.google.com/google-ads/answer/6270625?hl=en" },
  { label: "Google eligible-interaction conversion rate", url: "https://support.google.com/google-ads/answer/2684489?hl=en" },
  { label: "Google unique reach, frequency and historical limits", url: "https://support.google.com/google-ads/answer/2472714?hl=en" },
];
const reference: Definition[] = [
  { id: "spend", label: "Spend", role: "reference", key: "spend", formula: "Sum of stored spend", caveat: "Subset spend, not total business cost." },
  { id: "value", label: "Attributed conversion value", role: "reference", key: "value", formula: "Sum of stored attributed conversion value", caveat: "Not store revenue, purchase-only proof or profit." },
  { id: "conversions", label: "Generic attributed conversions", role: "reference", key: "conversions", formula: "Sum of stored conversions", caveat: "May include multiple action types; not verified purchases or qualified leads." },
  { id: "clicks", label: "Clicks", role: "driver", key: "clicks", formula: "Sum of stored clicks", caveat: "Not sessions, unique people or qualified demand." },
  { id: "impressions", label: "Impressions", role: "driver", key: "impressions", formula: "Sum of stored impressions", caveat: "Not unique reach; repeat exposures are included." },
  { id: "roas", label: "Generic attributed ROAS", role: "reference", key: "roas", formula: "Attributed conversion value / spend", caveat: "Not purchase ROAS, MER or incremental profitability." },
  { id: "cpa", label: "Cost / generic conversion", role: "reference", key: "cpa", formula: "Spend / generic attributed conversions", caveat: "Not customer acquisition cost or qualified CPL." },
  { id: "cpc", label: "CPC", role: "driver", key: "cpc", formula: "Spend / clicks", caveat: "Traffic cost, not traffic quality." },
  { id: "ctr", label: "CTR (%)", role: "driver", key: "ctr", formula: "100 × clicks / impressions", caveat: "Response proxy, not purchase or brand lift." },
  { id: "cpm", label: "CPM", role: "reference", key: "cpm", formula: "1000 × spend / impressions", caveat: "Exposure cost; not cost per unique person." },
  { id: "conversion_rate", label: "Provider conversion rate", role: "reference", formula: "100 × conversions / eligible ad interactions", caveat: "Eligible interaction denominator/action definitions are not loaded. Clicks are not silently substituted." },
];
const primary: Record<AuditGoal, Definition[]> = {
  sales: [
    { id: "purchase_roas", label: "Purchase-only ROAS", role: "primary", formula: "Verified attributed purchase value / matched ad spend", caveat: "Needs purchase action definitions, deduplication and mature attribution." },
    { id: "contribution", label: "Contribution after advertising", role: "primary", formula: "Net sales − agreed variable costs − ad spend", caveat: "Needs aligned store outcomes, COGS, returns, tax/cost basis; no free-text target inference." },
    { id: "new_customer_cac", label: "New-customer CAC", role: "primary", formula: "Matched acquisition spend / verified new customers", caveat: "Needs customer identity, new/returning classification and agreed spend scope." },
  ],
  branding: [
    { id: "reach", label: "Unique reach", role: "primary", formula: "Provider-deduplicated people in exact account/audience/window scope", caveat: "Non-additive across campaigns/dates; provider eligibility and historical limits apply." },
    { id: "brand_lift", label: "Brand lift", role: "primary", formula: "Eligible exposed vs control outcome difference", caveat: "Requires a valid lift study; clicks and sales ROAS cannot establish lift." },
    { id: "frequency", label: "Frequency", role: "driver", formula: "Matched impressions / deduplicated reach", caveat: "Needs exact non-additive scope; daily/campaign frequencies cannot be summed or averaged blindly." },
  ],
  wholesale: [
    { id: "qualified_cpl", label: "Qualified Wholesale CPL", role: "primary", formula: "Matched Wholesale spend / unique qualified business leads", caveat: "Needs business qualification, lead identity and Retail/Wholesale separation." },
    { id: "wholesale_cac", label: "Paid Wholesale buyer CAC", role: "primary", formula: "Matched Wholesale acquisition spend / first-paid Wholesale buyers", caveat: "Needs lead → first paid order linkage and follow-up/lag evidence." },
    { id: "repeat_contribution", label: "Wholesale repeat-order contribution", role: "primary", formula: "Repeat/cohort net sales − agreed variable and acquisition costs", caveat: "Needs cohort horizon, repeat orders, economics and currency-matched costs." },
  ],
};

/** Measurement inventory, not a target scorecard or an action authorization. */
export function auditKpis(goal: AuditGoal, summaries: Summary[]) {
  return [...primary[goal], ...reference].map(definition => {
    const key = definition.key;
    const values = key ? summaries.map(s => ({ currency: s.currency, current: s[key], baseline: s.previous?.[key] ?? null })) : [];
    const status = !key ? "unavailable" as const : values.some(v => v.current !== null) ? "stored_subset" as const : "unverified" as const;
    return { ...definition, status, values };
  });
}
