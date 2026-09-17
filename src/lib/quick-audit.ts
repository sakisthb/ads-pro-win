export type AuditPriority = "high" | "stable" | "watch";

export interface QuickAuditCampaign {
  campaignId: string;
  campaignName: string;
  platform: string;
  totalSpend: number;
  roas: number;
  totalConversions: number;
}

export interface QuickAuditItem {
  id: string;
  campaignName: string;
  platform: string;
  priority: AuditPriority;
  title: string;
  detail: string;
  spend: number;
  roas: number;
}

export interface QuickAuditResult {
  status: "retired";
  executionAllowed: false;
  auditUrl: "/account-audit";
  summary: string;
  itemCount: number;
  highCount: number;
  items: QuickAuditItem[];
}

/** An objective alone cannot establish a validated commercial ROAS target. */
export function targetRoasForObjective(_objective: string | undefined): null {
  return null;
}

/** Compatibility notice only: never interpret legacy unscoped aggregates. */
export function buildQuickAudit(_input: {
  campaigns: QuickAuditCampaign[];
  objective?: string;
  targetRoas?: number;
}): QuickAuditResult {
  return {
    status: "retired", executionAllowed: false, auditUrl: "/account-audit",
    summary: "Legacy Quick Audit is retired. Select an exact account, currency and completed periods in the Performance Marketing Desk. This notice contains no account-performance verdict; empty advice counts are not measured performance and do not diagnose connection or sync health.",
    itemCount: 0, highCount: 0, items: [],
  };
}
