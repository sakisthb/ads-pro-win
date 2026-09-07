import { dailySyncVolume, sparklineForPlatform } from "@/lib/sync-sparkline";

const jobs = [
  { platform: "meta", records: 12, timestamp: Date.parse("2026-09-01T10:00:00Z"), status: "success" },
  { platform: "meta", records: 40, timestamp: Date.parse("2026-09-02T10:00:00Z"), status: "success" },
  { platform: "brevo", records: 28, timestamp: Date.parse("2026-09-02T12:00:00Z"), status: "success" },
  { platform: "google-ads", records: 0, timestamp: Date.parse("2026-09-02T13:00:00Z"), status: "failed" },
];

describe("sparklineForPlatform", () => {
  it("keeps completed record counts in time order and zeros failed runs", () => {
    const points = sparklineForPlatform(jobs, "meta");
    expect(points.map((p) => p.records)).toEqual([12, 40]);
    expect(sparklineForPlatform(jobs, "google-ads")[0]?.records).toBe(0);
  });
});

describe("dailySyncVolume", () => {
  it("sums successful jobs by UTC day and drops platforms with no records", () => {
    const { rows, keys } = dailySyncVolume(jobs, 3, Date.parse("2026-09-03T00:00:00Z"));
    expect(keys).toEqual(["brevo", "meta"]);
    expect(rows.find((r) => r.day === "09-02")?.meta).toBe(40);
    expect(rows.find((r) => r.day === "09-02")?.brevo).toBe(28);
    expect(rows.some((r) => "google-ads" in r && Number(r["google-ads"]) > 0)).toBe(false);
  });
});
