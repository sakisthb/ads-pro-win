import { validCampaignWindow } from "./campaign-reporting";

export type AuditWindow = { startDate: string; endDate: string };
export type AuditPreset = "week" | "month" | "six_months" | "year";
export type AuditComparison = { mode: "previous" } | { mode: "year"; yearsBack: number } | { mode: "custom"; window: AuditWindow };
const dayMs = 86_400_000;
const time = (day: string) => new Date(`${day}T00:00:00Z`).getTime();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const days = (window: AuditWindow) => (time(window.endDate) - time(window.startDate)) / dayMs + 1;
function validate(window: AuditWindow) {
  if (!validCampaignWindow(window.startDate, window.endDate) || days(window) > 366) throw new Error("Choose a valid completed UTC window of at most 366 days.");
}
function shifted(day: string, months: number) {
  const date = new Date(`${day}T00:00:00Z`);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return iso(target.getTime());
}

/** Rolling windows, never partial today: 7/30 days or 6/12 calendar months. */
export function auditPresetWindow(preset: AuditPreset, asOf: string): AuditWindow {
  if (!validCampaignWindow(asOf, asOf)) throw new Error("Invalid UTC review date");
  const endDate = iso(time(asOf) - dayMs);
  const startDate = preset === "week" || preset === "month"
    ? iso(time(asOf) - (preset === "week" ? 7 : 30) * dayMs)
    : shifted(asOf, preset === "six_months" ? 6 : 12);
  return { startDate, endDate };
}

export function resolveAuditPeriods(current: AuditWindow, comparison: AuditComparison = { mode: "previous" }, asOf?: string) {
  validate(current);
  if (asOf && (!validCampaignWindow(asOf, asOf) || current.endDate >= asOf)) throw new Error("Choose a valid completed UTC window ending before today.");
  let window: AuditWindow;
  let label: string;
  let clamped = false;
  if (comparison.mode === "previous") {
    window = { startDate: iso(time(current.startDate) - days(current) * dayMs), endDate: iso(time(current.startDate) - dayMs) };
    label = "Previous equal-length period";
  } else if (comparison.mode === "year") {
    if (!Number.isInteger(comparison.yearsBack) || comparison.yearsBack < 1 || comparison.yearsBack > 10) throw new Error("Choose 1–10 historical years back.");
    window = { startDate: shifted(current.startDate, comparison.yearsBack * 12), endDate: shifted(current.endDate, comparison.yearsBack * 12) };
    clamped = window.startDate.slice(5) !== current.startDate.slice(5) || window.endDate.slice(5) !== current.endDate.slice(5);
    label = `Same calendar dates ${comparison.yearsBack} year${comparison.yearsBack === 1 ? "" : "s"} earlier`;
  } else {
    window = { ...comparison.window };
    label = "Custom historical baseline";
  }
  validate(window);
  if (window.endDate >= current.startDate) throw new Error("Choose a valid historical baseline ending before the current window; overlap is not allowed.");
  const currentDays = days(current), baselineDays = days(window);
  const equalDays = currentDays === baselineDays;
  const notice = [
    "Historical comparison is descriptive, not causal: weekday mix, conversion maturity, attribution and tracking may differ.",
    ...(clamped ? ["Leap-day dates were clamped to the last valid calendar day."] : []),
    ...(!equalDays ? ["The windows have unequal day counts; baseline metrics and change heuristics are withheld. Inspect the baseline as its own current window."] : []),
    "Selecting dates does not fetch provider history or prove complete daily coverage.",
  ].join(" ");
  return { mode: comparison.mode, label, window, currentDays, baselineDays, equalDays, notice };
}
