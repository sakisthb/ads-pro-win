import {
  contextForBrand,
  contextToPromptBlock,
  emptyProjectContext,
  isContextComplete,
  mergeOrgSettings,
  parseObjective,
  parseOrgSettings,
  parseProjectContext,
} from "@/lib/project-context";

describe("project context", () => {
  it("parses known objectives and defaults unknown ones", () => {
    expect(parseObjective("leads")).toBe("leads");
    expect(parseObjective("not-a-goal")).toBe("sales");
  });

  it("returns null for empty blobs and a context when any field is set", () => {
    expect(parseProjectContext(null)).toBeNull();
    expect(parseProjectContext({})).toBeNull();
    expect(parseProjectContext({ objective: "sales" })?.objective).toBe("sales");
    expect(parseProjectContext({ priorities: "ROAS first" })?.priorities).toBe("ROAS first");
  });

  it("reads onboarding flags from organization settings JSON", () => {
    expect(parseOrgSettings(null)).toEqual({});
    expect(
      parseOrgSettings({
        currency: "USD",
        onboardingCompleted: true,
        projectContext: { objective: "traffic", targetResult: "More visits" },
      }).onboardingCompleted,
    ).toBe(true);
  });

  it("treats context as complete when a result or priority exists", () => {
    expect(isContextComplete(emptyProjectContext())).toBe(false);
    expect(isContextComplete({ ...emptyProjectContext(), targetResult: "3x ROAS" })).toBe(true);
  });

  it("merges settings without dropping unrelated keys", () => {
    const merged = mergeOrgSettings({ currency: "EUR", extra: 1 }, { onboardingCompleted: true });
    expect(merged.currency).toBe("EUR");
    expect(merged.extra).toBe(1);
    expect(merged.onboardingCompleted).toBe(true);
  });

  it("serializes a prompt block for the planner", () => {
    const block = contextToPromptBlock({
      ...emptyProjectContext(),
      objective: "sales",
      targetResult: "2.5x ROAS",
      constraints: "No Sunday spend",
    });
    expect(block).toContain("Business objective: sales");
    expect(block).toContain("Target result: 2.5x ROAS");
    expect(block).toContain("No Sunday spend");
  });

  it("stores per-shop context without dropping the other shop", () => {
    const first = {
      ...emptyProjectContext(),
      objective: "sales" as const,
      targetResult: "BAGTOBAG 3x ROAS",
    };
    const second = {
      ...emptyProjectContext(),
      objective: "traffic" as const,
      targetResult: "New shop visits",
    };
    const afterFirst = mergeOrgSettings({}, { brandId: "brand-a", brandContext: first });
    const afterSecond = mergeOrgSettings(afterFirst, { brandId: "brand-b", brandContext: second });
    const parsed = parseOrgSettings(afterSecond);
    expect(contextForBrand(parsed, "brand-a")?.targetResult).toBe("BAGTOBAG 3x ROAS");
    expect(contextForBrand(parsed, "brand-b")?.targetResult).toBe("New shop visits");
    expect(contextForBrand(parsed, "brand-b")?.objective).toBe("traffic");
    expect(parsed.projectContext?.targetResult).toBe("New shop visits");
  });
});
