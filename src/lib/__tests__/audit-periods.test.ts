import { auditPresetWindow, resolveAuditPeriods } from "../audit-periods";

const asOf = "2026-09-17";
const current = { startDate: "2026-08-18", endDate: "2026-09-16" };
it.each([
  ["week", "2026-09-10"], ["month", "2026-08-18"],
  ["six_months", "2026-03-17"], ["year", "2025-09-17"],
] as const)("uses completed UTC %s windows, with explicit rolling/calendar-month semantics", (preset, startDate) => {
  expect(auditPresetWindow(preset, asOf)).toEqual({ startDate, endDate: "2026-09-16" });
});
it("clamps calendar month shifts rather than overflowing month end", () => {
  expect(auditPresetWindow("six_months", "2024-08-31")).toEqual({ startDate: "2024-02-29", endDate: "2024-08-30" });
});
it("resolves the adjacent inclusive equal-length baseline", () => {
  expect(resolveAuditPeriods(current, { mode: "previous" }, asOf)).toMatchObject({
    window: { startDate: "2026-07-19", endDate: "2026-08-17" }, currentDays: 30, baselineDays: 30, equalDays: true,
  });
});
it.each([1, 2, 3])( "selects the same calendar dates %i years earlier", yearsBack => {
  expect(resolveAuditPeriods(current, { mode: "year", yearsBack }, asOf).window).toEqual({
    startDate: `${2026 - yearsBack}-08-18`, endDate: `${2026 - yearsBack}-09-16`,
  });
});
it("discloses leap-day clamping and unequal durations", () => {
  const result = resolveAuditPeriods({ startDate: "2024-02-28", endDate: "2024-03-01" }, { mode: "year", yearsBack: 1 }, "2024-03-02");
  expect(result).toMatchObject({ currentDays: 3, baselineDays: 2, equalDays: false });
  expect(result.notice).toContain("unequal");
  expect(resolveAuditPeriods({ startDate: "2024-02-29", endDate: "2024-02-29" }, { mode: "year", yearsBack: 1 }, "2024-03-02").notice).toContain("clamped");
});
it("allows explicit historical windows while retaining their actual lengths", () => {
  const baseline = { startDate: "2021-01-01", endDate: "2021-01-07" };
  expect(resolveAuditPeriods(current, { mode: "custom", window: baseline }, asOf)).toMatchObject({ window: baseline, equalDays: false });
});
it.each([
  { startDate: "2026-09-17", endDate: "2026-09-17" },
  { startDate: "2026-02-30", endDate: "2026-03-01" },
  { startDate: "2025-01-01", endDate: "2026-09-16" },
])("rejects partial/future, invalid and excessive current windows %j", window => {
  expect(() => resolveAuditPeriods(window, { mode: "previous" }, asOf)).toThrow();
});
it.each([
  { startDate: "2026-08-17", endDate: "2026-08-18" },
  { startDate: "2026-09-17", endDate: "2026-09-18" },
  { startDate: "2026-02-30", endDate: "2026-03-01" },
])("rejects overlapping/later or invalid custom baselines %j", window => {
  expect(() => resolveAuditPeriods(current, { mode: "custom", window }, asOf)).toThrow();
});
it.each([0, -1, 11, 1.5, NaN])("rejects unsupported years-back %s", yearsBack => {
  expect(() => resolveAuditPeriods(current, { mode: "year", yearsBack }, asOf)).toThrow();
});
