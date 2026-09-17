/** Storage-report scope. These dates are not proof of provider coverage. */
export function lastCompletedCampaignWindow(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function validCampaignWindow(startDate: string, endDate: string): boolean {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return valid(startDate) && valid(endDate) && startDate <= endDate;
}

export function campaignReportKey(adAccountId: string, platform: string, campaignId: string | null, currency: string) {
  return JSON.stringify([adAccountId, platform, campaignId, currency]);
}

export function campaignReportPlatformWhere(platform?: string) {
  if (!platform || platform === "all") return { platform: { in: ["meta", "facebook", "instagram", "google", "tiktok"] } };
  if (platform === "meta" || platform === "facebook" || platform === "instagram") {
    return { platform: { in: ["meta", "facebook", "instagram"] } };
  }
  return { platform };
}
