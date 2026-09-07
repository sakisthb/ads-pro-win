import { TRACKING_WORKSTREAMS, trackingWorkstream } from "@/lib/tracking-ops";

describe("tracking ops playbook", () => {
  it("covers the five BAGTOBAG operator jobs", () => {
    expect(TRACKING_WORKSTREAMS.map((w) => w.id)).toEqual([
      "capi-emq",
      "ga4-mp",
      "ga4-unassigned",
      "google-ads-api",
      "woo-vat",
    ]);
  });

  it("insists on one CAPI stack and order-id dedup", () => {
    const capi = trackingWorkstream("capi-emq");
    expect(capi.doNot).toMatch(/two CAPI stacks/i);
    expect(capi.steps.join(" ")).toMatch(/event_id/);
    expect(capi.verify).toMatch(/EMQ/);
  });

  it("does not treat sGTM-only as the GA4 order fix", () => {
    const ga4 = trackingWorkstream("ga4-mp");
    expect(ga4.doNot).toMatch(/sGTM-only/);
    expect(ga4.steps.join(" ")).toMatch(/woocommerce_payment_complete/);
  });

  it("treats Google Ads as a spend sync after the developer token is present", () => {
    const ads = trackingWorkstream("google-ads-api");
    expect(ads.title).toMatch(/spend sync/i);
    expect(ads.doNot).toMatch(/MCC/);
    expect(ads.verify).toMatch(/Sync Now/);
    expect(ads.steps.join(" ")).toMatch(/Basic Access/);
    expect(ads.verify).toMatch(/0 records/);
  });
});
