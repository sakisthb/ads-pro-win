/** ADR 0002: only existing-object Meta edits are authorized. No env bypass. */
export function readOnlyAdWriteReason(platform: string): string | null {
  if (platform === "meta") return null;
  if (platform === "google" || platform === "tiktok") {
    return `${platform === "google" ? "Google Ads" : "TikTok Ads"} is read-only. Live writes require a later accepted ADR and verified operator controls.`;
  }
  return "Live writes are not authorized for this ad platform.";
}

export function campaignCreationBlockReason(platform: string): string | null {
  return readOnlyAdWriteReason(platform) ??
    "Meta creation is not authorized. ADR 0002 permits edits on existing objects only; campaign/ad set/ad creation requires a later decision.";
}
