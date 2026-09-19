import {
  contextConnectionStaleness,
  contextForBrand,
  contextToPromptBlock,
  emptyProjectContext,
  isContextComplete,
  mergeOrgSettings,
  parseObjective,
  parseOrgSettings,
  parseProjectContext,
  strictContextForBrand,
} from "@/lib/project-context";

describe("project context", () => {
  it("never falls back to another brand's last-saved context for an explicit missing brand", () => {
    const legacy = { ...emptyProjectContext(), notes: "Last-saved other shop" };
    const parsed = parseOrgSettings({ projectContext: legacy });
    expect(contextForBrand(parsed, "brand-without-inputs")).toBeNull();
    expect(contextForBrand(parsed, undefined)).toEqual(legacy);
  });
  it("reads only the exact brand context, never the last-saved organization fallback", () => {
    const own = { ...emptyProjectContext(), constraints: "Owned shop constraints" };
    const parsed = parseOrgSettings({
      projectContext: { ...emptyProjectContext(), notes: "Other shop private notes" },
      brandContexts: { "brand-a": own },
    });
    expect(strictContextForBrand(parsed, "brand-a")).toEqual(own);
    expect(strictContextForBrand(parsed, "brand-b")).toBeNull();
    expect(strictContextForBrand(parsed, "")).toBeNull();
  });
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

  it("flags saved context that predates a live connection as stale claims", () => {
    const saved = { ...emptyProjectContext(), notes: "Google not connected yet; Meta only", updatedAt: "2026-08-28T10:00:00Z" };
    expect(contextConnectionStaleness(saved, [{ platform: "google", connectedAt: "2026-09-17" }]))
      .toContain("Saved on 2026-08-28, before the google connection");
    expect(contextConnectionStaleness(saved, [{ platform: "google", connectedAt: "2026-09-17" }]))
      .toContain("historical, not current truth");
  });

  it("does not flag staleness without a save date or when connections predate the save", () => {
    const saved = { ...emptyProjectContext(), notes: "Meta only", updatedAt: "2026-08-28T10:00:00Z" };
    expect(contextConnectionStaleness({ ...emptyProjectContext(), notes: "No date" }, [{ platform: "google", connectedAt: "2026-09-17" }])).toBeNull();
    expect(contextConnectionStaleness(saved, [{ platform: "google", connectedAt: "2026-08-01" }])).toBeNull();
    expect(contextConnectionStaleness(saved, [])).toBeNull();
    expect(contextConnectionStaleness(null, [{ platform: "google", connectedAt: "2026-09-17" }])).toBeNull();
  });

  it("lists every newer connection platform once and skips unparseable dates", () => {
    const saved = { ...emptyProjectContext(), updatedAt: "2026-08-28T10:00:00Z" };
    const message = contextConnectionStaleness(saved, [
      { platform: "google", connectedAt: "2026-09-17" },
      { platform: "google", connectedAt: "2026-09-18" },
      { platform: "meta", connectedAt: "not-a-date" },
      { platform: "tiktok", connectedAt: "2026-09-20" },
    ]);
    expect(message).toContain("google");
    expect(message).toContain("tiktok");
    expect(message).not.toContain("meta");
    expect(message!.match(/google/g)!.length).toBe(1);
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
