/** @jest-environment node */
import { mapBrevoCampaignsToMetrics, brevoCampaignDateParams, brevoCampaignStats, countSentBrevoArchive } from "@/lib/sync/fetchers";

describe("Brevo campaign date filter", () => {
  const now = new Date("2026-09-03T05:00:00.000Z");

  it("sends UTC ISO datetimes instead of YYYY-MM-DD", () => {
    expect(brevoCampaignDateParams("2026-08-01", "2026-08-31", now)).toEqual({
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-31T23:59:59.999Z",
    });
  });

  it("clamps end-of-today UTC so it is not in the future", () => {
    expect(brevoCampaignDateParams("2026-08-04", "2026-09-03", now)).toEqual({
      startDate: "2026-08-04T00:00:00.000Z",
      endDate: "2026-09-03T05:00:00.000Z",
    });
  });

  it("leaves past ISO values unchanged", () => {
    expect(
      brevoCampaignDateParams("2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.999Z", now),
    ).toEqual({
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-31T23:59:59.999Z",
    });
  });
});

describe("Brevo campaign stats mapping", () => {
  it("reads nested globalStats and writes campaign-level rows", () => {
    expect(
      brevoCampaignStats({
        statistics: { globalStats: { delivered: 1200, uniqueClicks: 48, uniqueViews: 300 } },
      }),
    ).toMatchObject({ sent: 0, delivered: 1200, clicks: 48, opened: 300 });

    const rows = mapBrevoCampaignsToMetrics(
      [
        {
          id: 99,
          name: "September drop",
          sentDate: "2026-08-20T10:00:00.000Z",
          subject: "September drop",
          statistics: {
            globalStats: {
              sent: 810,
              delivered: 800,
              uniqueClicks: 40,
              uniqueViews: 200,
              appleMppOpens: 12,
              hardBounces: 3,
            },
          },
        },
        {
          id: 100,
          name: "Too old",
          sentDate: "2026-01-01T10:00:00.000Z",
          statistics: { globalStats: { delivered: 50, uniqueClicks: 1 } },
        },
      ],
      { startDate: "2026-08-01", endDate: "2026-08-31" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-08-20",
      campaignId: "99",
      campaignName: "September drop",
      impressions: 800,
      clicks: 40,
      reach: 200,
      conversionValue: 0,
      resultType: "brevo_email",
    });
    expect(rows[0].attributionSetting).toContain('"appleMppOpens":12');
    expect(rows[0].landingPageViews).toBe(810);
  });

  it("uses campaignStats when globalStats.delivered is 0 (list payload without statistics=globalStats)", () => {
    expect(
      brevoCampaignStats({
        statistics: {
          globalStats: { delivered: 0, sent: 0, uniqueClicks: 0, uniqueViews: 0 },
          campaignStats: [
            { delivered: 1598, sent: 1600, uniqueClicks: 40, uniqueViews: 300 },
            { delivered: 12, sent: 12, uniqueClicks: 2, uniqueViews: 4 },
          ],
        },
      }),
    ).toMatchObject({ sent: 1612, delivered: 1610, clicks: 42, opened: 304 });
  });

  it("keeps +03:00 sentDate inside the lookback window", () => {
    const rows = mapBrevoCampaignsToMetrics(
      [
        {
          id: 212,
          name: "χονδρικη _copy",
          sentDate: "2026-07-31T11:27:53.000+03:00",
          statistics: { globalStats: { delivered: 1598, uniqueClicks: 48, uniqueViews: 300 } },
        },
      ],
      { startDate: "2026-03-07", endDate: "2026-09-03" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-07-31", impressions: 1598, campaignId: "212" });
  });
});

describe("Brevo sent archive", () => {
  it("counts every sent campaign, not only the operator window", () => {
    expect(
      countSentBrevoArchive([
        {
          sentDate: "2026-08-20T10:00:00.000Z",
          statistics: { globalStats: { delivered: 800 } },
        },
        {
          sentDate: "2025-01-01T10:00:00.000Z",
          statistics: { globalStats: { delivered: 50 } },
        },
        {
          statistics: { globalStats: { delivered: 9 } },
        },
      ]),
    ).toBe(2);
  });
});
