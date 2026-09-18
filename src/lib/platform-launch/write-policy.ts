/** Generic campaign writes remain fenced; ADR 0003 repairs use a separate exact-target desk. */
export function readOnlyAdWriteReason(platform: string): string | null {
  if (platform === "meta") return null;
  if (platform === "google") {
    return "Google campaign activation, budgets and creation remain read-only. Existing-target corrections use Google Repair Desk (ADR 0003), with exact preview confirmation and native verification.";
  }
  if (platform === "tiktok") {
    return "TikTok Ads is read-only. Live writes require a later accepted ADR and verified operator controls.";
  }
  return "Live writes are not authorized for this ad platform.";
}

export function campaignCreationBlockReason(platform: string): string | null {
  return readOnlyAdWriteReason(platform) ??
    "Meta creation is not authorized. ADR 0002 permits edits on existing objects only; campaign/ad set/ad creation requires a later decision.";
}
