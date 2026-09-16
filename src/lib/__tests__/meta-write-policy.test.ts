import {
  META_WRITE_V1_ACTIONS,
  assertMetaWriteAllowed,
  isMetaWriteV1Action,
  metaWritePolicySummary,
  otherAdPlatformsRemainReadOnly,
  resolveMetaWriteGate,
} from "@/lib/meta/write-policy";

describe("Meta write policy v1", () => {
  it("documents operator-authorized v1 actions for existing objects only", () => {
    expect(META_WRITE_V1_ACTIONS).toEqual(
      expect.arrayContaining(["setStatus", "setBudget", "setName"]),
    );
    expect(META_WRITE_V1_ACTIONS).not.toEqual(
      expect.arrayContaining(["createCampaign", "uploadCreative", "catalogSurgery"]),
    );
    expect(isMetaWriteV1Action("setStatus")).toBe(true);
    expect(isMetaWriteV1Action("createCampaign")).toBe(false);
  });

  it("fails closed without ads_management even when the operator authorized Meta writes", () => {
    const gate = resolveMetaWriteGate({
      organizationSlug: "bagtobag",
      grantedScopes: ["ads_read", "public_profile"],
      operatorAuthorizedMetaWrite: true,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/ads_management/);
    expect(() =>
      assertMetaWriteAllowed({
        organizationSlug: "bagtobag",
        grantedScopes: ["ads_read"],
        operatorAuthorizedMetaWrite: true,
      }),
    ).toThrow(/ads_management/);
  });

  it("blocks Demo workspace writes even with ads_management", () => {
    const gate = resolveMetaWriteGate({
      organizationSlug: "demo",
      grantedScopes: ["ads_read", "ads_management"],
      operatorAuthorizedMetaWrite: true,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/Demo/i);
  });

  it("allows BagToBag Meta edits when ads_management is granted", () => {
    const gate = resolveMetaWriteGate({
      organizationSlug: "bagtobag",
      grantedScopes: ["ads_read", "ads_management"],
      operatorAuthorizedMetaWrite: true,
      brandWebsite: "https://bagtobag.com.gr/",
    });
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeNull();
    expect(gate.brandScoped).toBe(true);
    expect(gate.defaultBrandHint).toBe("bagtobag.com.gr");
  });

  it("keeps Google Ads and TikTok read-only under this policy", () => {
    expect(otherAdPlatformsRemainReadOnly(["google", "tiktok", "meta"])).toEqual({
      google: true,
      tiktok: true,
      meta: false,
    });
  });

  it("states catalog and WordPress stay locked from the Ads Pro session", () => {
    const summary = metaWritePolicySummary();
    expect(summary.metaWriteAuthorized).toBe(true);
    expect(summary.requiredOAuthScopes).toEqual(
      expect.arrayContaining(["ads_read", "ads_management"]),
    );
    expect(summary.auditLog).toBe("metaWriteLog");
    expect(summary.catalogSurgeryUnlocked).toBe(false);
    expect(summary.wordpressWritesUnlocked).toBe(false);
    expect(summary.v1Scope).toEqual(
      expect.arrayContaining([
        "status ACTIVE/PAUSED on campaign/adset/ad",
        "daily/lifetime budget where applicable",
        "rename campaign/adset/ad",
      ]),
    );
  });
});
