import {
  adsManagerUrl,
  clampAge,
  canSubmitLaunch,
  dailyBudgetToCents,
  dailyBudgetToMicros,
  friendlyPlatformError,
  fromPrismaPlatform,
  mapMetaObjective,
  mapPrismaPlatform,
  metaActPath,
  normalizeCountries,
  stripActPrefix,
} from "@/lib/platform-launch/mapping";

describe("platform launch mapping", () => {
  it("normalizes Meta act_ prefixes", () => {
    expect(stripActPrefix("act_123")).toBe("123");
    expect(metaActPath("123")).toBe("act_123");
    expect(metaActPath("act_123")).toBe("act_123");
  });

  it("maps Prisma platforms both ways", () => {
    expect(mapPrismaPlatform("meta")).toBe("facebook");
    expect(fromPrismaPlatform("facebook")).toBe("meta");
    expect(fromPrismaPlatform("linkedin")).toBeNull();
  });

  it("converts budgets to Meta cents and Google micros", () => {
    expect(dailyBudgetToCents(80)).toBe(8000);
    expect(dailyBudgetToCents(0)).toBe(100);
    expect(dailyBudgetToMicros(80)).toBe("80000000");
  });

  it("maps sales to Meta OUTCOME_SALES", () => {
    expect(mapMetaObjective("sales")).toBe("OUTCOME_SALES");
  });

  it("builds ads manager URLs", () => {
    expect(adsManagerUrl("meta", "act_99", "camp1")).toContain("act=99");
    expect(adsManagerUrl("google", "123", "camp1")).toContain("campaignId=camp1");
    expect(adsManagerUrl("tiktok", "adv1")).toContain("aadvid=adv1");
  });

  it("asks the operator to reconnect Meta when ads_management is missing", () => {
    expect(friendlyPlatformError("meta", "(#10) permission")).toMatch(/Reconnect Meta/);
    expect(friendlyPlatformError("meta", "ads_management required")).toMatch(/Reconnect Meta/);
  });

  it("does not treat Graph (#100) unknown-field errors as a missing ads_management token", () => {
    const raw = "(#100) Tried accessing nonexisting field (description)";
    expect(friendlyPlatformError("meta", raw)).toBe(raw);
  });

  it("cleans country codes and clamps ages", () => {
    expect(normalizeCountries(["gr", "DEU", "DE"])).toEqual(["GR", "DE"]);
    expect(clampAge(12, 80)).toEqual({ ageMin: 18, ageMax: 65 });
  });

  it("allows a paused campaign+ad set launch without ad copy", () => {
    expect(
      canSubmitLaunch({
        name: "Test",
        headline: "",
        primaryText: "",
        dailyBudget: 40,
        platformCount: 1,
        includeAd: false,
        isDemo: false,
      }),
    ).toBe(true);
    expect(
      canSubmitLaunch({
        name: "Test",
        headline: "",
        primaryText: "",
        dailyBudget: 40,
        platformCount: 1,
        includeAd: true,
        isDemo: false,
      }),
    ).toBe(false);
  });
});
