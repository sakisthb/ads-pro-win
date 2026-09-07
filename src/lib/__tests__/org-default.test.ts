import { pickLiveDefaultMembership, DEMO_ORG_SLUG } from "@/lib/org-default";

const memberships = [
  {
    role: "viewer",
    isDefault: true,
    organization: { id: "demo-id", slug: DEMO_ORG_SLUG },
  },
  {
    role: "owner",
    isDefault: false,
    organization: { id: "live-id", slug: "kotman1979-646918" },
  },
];

describe("pickLiveDefaultMembership", () => {
  it("prefers the live owner workspace over Demo even when Demo is flagged default", () => {
    expect(pickLiveDefaultMembership(memberships)?.organization.id).toBe("live-id");
  });

  it("falls back to Demo when that is the only membership", () => {
    expect(
      pickLiveDefaultMembership(memberships.slice(0, 1))?.organization.id,
    ).toBe("demo-id");
  });
});
