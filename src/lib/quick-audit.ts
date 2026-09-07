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
  summary: string;
  itemCount: number;
  highCount: number;
  items: QuickAuditItem[];
}

export function targetRoasForObjective(objective: string | undefined): number {
  if (objective === "sales") return 2.5;
  if (objective === "leads") return 1.5;
  return 0;
}

export function buildQuickAudit(input: {
  campaigns: QuickAuditCampaign[];
  objective?: string;
  targetRoas?: number;
}): QuickAuditResult {
  const target = input.targetRoas ?? targetRoasForObjective(input.objective);
  const ranked = [...input.campaigns].sort((a, b) => b.totalSpend - a.totalSpend);

  const items: QuickAuditItem[] = ranked.slice(0, 12).map((c) => {
    const spend = Number(c.totalSpend) || 0;
    const roas = Number(c.roas) || 0;
    const conversions = Number(c.totalConversions) || 0;
    let priority: AuditPriority = "watch";
    let title = "Keep monitoring";
    let detail = "Not enough of a pattern yet — check again after more delivery.";

    if (target > 0 && roas >= target && spend > 0) {
      priority = "stable";
      title = "Protect this performer";
      detail = `${roas.toFixed(2)}x ROAS is at or above the ${target.toFixed(1)}x project target. Scale in small steps and keep testing creative.`;
    } else if (
      spend >= 50 &&
      ((target > 0 && roas < target / 2) ||
        (input.objective === "sales" && conversions < 1))
    ) {
      priority = "high";
      title = "Review low-return spend first";
      detail =
        conversions < 1 && input.objective === "sales"
          ? "Spend is live without a purchase. Pause or rebuild before adding budget."
          : `ROAS ${roas.toFixed(2)}x is well below the ${target.toFixed(1)}x target. Diagnose creative, landing page, or audience before scaling.`;
    } else if (spend > 0 && target > 0 && roas < target) {
      priority = "watch";
      title = "Below target — investigate";
      detail = `${roas.toFixed(2)}x vs ${target.toFixed(1)}x target. Use Analytics for the breakdown, then AI Audit if the gap holds.`;
    }

    return {
      id: c.campaignId || c.campaignName,
      campaignName: c.campaignName,
      platform: c.platform,
      priority,
      title,
      detail,
      spend,
      roas,
    };
  });

  const highCount = items.filter((i) => i.priority === "high").length;
  let summary = "Connect an ad account and load performance to run a first audit.";
  if (ranked.length === 0) {
    summary = "No campaign rows in this date range yet. Sync the account, then press Show results.";
  } else if (highCount > 0) {
    summary = `${highCount} campaign${highCount === 1 ? "" : "s"} need attention before you scale. Treat alerts as a prompt to investigate, not an automatic pause.`;
  } else {
    summary = "No emergency spend. Protect stable campaigns and use Campaign Studio for the next test as a paused draft.";
  }

  return { summary, itemCount: items.length, highCount, items };
}
