import type { CampaignStudy } from "@/lib/campaign-study";

// Study-derived operator proposals. Every proposal is computed from the stored-rows
// campaign study only — nothing is copied from operator journals — and each one is
// gated by what may actually execute: Meta writes stay behind the audited write
// desk (ADR 0002), Google stays read-only (ADR 0003), the rest are no-write checks.
// This module is isomorphic (no node-only imports) so the desk can derive proposals
// client-side from the same study payload.

export type ProposalDesk = "retail" | "branding" | "wholesale";
export type ProposalKind = "meta_spend_review" | "tracking_check" | "google_planning_note" | "order_ops_review";
export type ProposalDecision = "approved" | "rejected";

export interface CampaignProposal {
  key: string;
  desk: ProposalDesk;
  kind: ProposalKind;
  title: string;
  rationale: string[];
  uncertainty: string[];
  execution: string;
  evidenceAsOf: string;
}

const META_EXECUTION =
  "Operator-approved execution only via the audited Meta write desk (ADR 0002: ads_management scope, in-UI confirmation, metaWriteLog audit). This proposal derives from stored rows and never writes to a provider by itself.";
const TRACKING_EXECUTION =
  "No provider write: verify landing-page tags and Pixel events, then re-check this desk. Execution happens outside the ad platforms.";
const UTM_EXECUTION =
  "No provider write: fix Woo order source capture (checkout/UTM persistence), then re-check attribution coverage.";
const GOOGLE_EXECUTION =
  "Google campaign activation, budget and creation stay read-only in-app (ADR 0003). This note informs an operator decision; nothing here is executable in the app.";
const ORDERS_EXECUTION =
  "No ad-platform write: commercial/ops follow-up on the Woo order trend.";

function eur(value: number): string {
  return `€${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Isomorphic FNV-1a key so client-side derivation and server-side decisions match.
// Keys exclude the as-of date and any dynamic number: re-derived studies stay
// decidable day to day.
export function proposalKeyOf(desk: ProposalDesk, kind: ProposalKind, title: string): string {
  const input = `${desk}|${kind}|${title}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p_${hash.toString(16).padStart(8, "0")}`;
}

function proposal(desk: ProposalDesk, kind: ProposalKind, title: string, rationale: string[], execution: string, study: CampaignStudy): CampaignProposal {
  return {
    key: proposalKeyOf(desk, kind, title),
    desk, kind, title,
    rationale: rationale.filter(part => part.trim().length > 0),
    uncertainty: [...study.limits],
    execution,
    evidenceAsOf: study.asOf,
  };
}

export function buildProposals(study: CampaignStudy): CampaignProposal[] {
  const proposals: CampaignProposal[] = [];
  const { metaCoverage, spendCut, lpv, retail, wholesale, timing, utmCoverage, googleCoverage, purchaseFunnel } = study;

  if (metaCoverage.primaryCampaign && (spendCut.status === "sharp" || timing.dropBeforeSpendCut === true)) {
    const latest = purchaseFunnel[purchaseFunnel.length - 1];
    proposals.push(proposal("retail", "meta_spend_review",
      "Meta PUR spend cut on the primary purchase campaign",
      [
        spendCut.summary,
        timing.summary,
        `Primary campaign: ${metaCoverage.primaryCampaign.name} — ${eur(metaCoverage.primaryCampaign.spend)} stored spend (${Math.round(metaCoverage.primaryCampaign.shareOfMetaSpend * 100)}% of Meta).`,
        latest ? `Latest window (${latest.window.label}): ${latest.purchases} purchases / ${eur(latest.purchaseValue)} on ${eur(latest.spend)} spend.` : "",
      ],
      META_EXECUTION, study));
  }

  if (lpv.status === "broken" || lpv.status === "degraded") {
    proposals.push(proposal("retail", "tracking_check",
      "Repair LPV / Pixel tracking signal on the purchase funnel",
      [lpv.summary],
      TRACKING_EXECUTION, study));
  }

  if (utmCoverage.orders > 0 && !utmCoverage.sufficient) {
    proposals.push(proposal("retail", "tracking_check",
      "Improve order source/UTM coverage for attribution",
      [
        `Only ${utmCoverage.withSource} of ${utmCoverage.orders} orders carry a source (${utmCoverage.coveragePct === null ? "n/a" : `${Math.round(utmCoverage.coveragePct)}%`}); Meta-attributed: ${utmCoverage.metaAttributed}. Spend/order correlation stays unproven below half coverage.`,
      ],
      UTM_EXECUTION, study));
  }

  if (googleCoverage.rowCount > 0 && googleCoverage.seasonalOnly) {
    proposals.push(proposal("branding", "google_planning_note",
      "Plan the next Google activation window from historical coverage",
      [googleCoverage.summary],
      GOOGLE_EXECUTION, study));
  }

  if (retail.status === "dip" || retail.status === "sustained_decline") {
    proposals.push(proposal("retail", "order_ops_review",
      "Retail (ΛΙΑΝΙΚΗ) order trend follow-up",
      [retail.summary],
      ORDERS_EXECUTION, study));
  }

  if (wholesale.status === "dip" || wholesale.status === "sustained_decline") {
    proposals.push(proposal("wholesale", "order_ops_review",
      "Wholesale (χονδρική) order trend follow-up",
      [wholesale.summary],
      ORDERS_EXECUTION, study));
  }

  return proposals;
}
