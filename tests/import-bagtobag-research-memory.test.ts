/** @jest-environment node */
import { BAGTOBAG_RESEARCH_DOCS, parseArgs, resolveScope } from "../scripts/import-bagtobag-research-memory";

describe("BAGTOBAG_RESEARCH_DOCS manifest", () => {
  it("lists exactly the 4 Qoder research docs with unique repo-relative paths", () => {
    expect(BAGTOBAG_RESEARCH_DOCS).toHaveLength(4);
    const paths = BAGTOBAG_RESEARCH_DOCS.map(d => d.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const doc of BAGTOBAG_RESEARCH_DOCS) {
      expect(doc.path.startsWith("docs/")).toBe(true);
    }
  });
  it("keeps every entry import-schema valid: title, ISO source date, https-only source urls", () => {
    for (const doc of BAGTOBAG_RESEARCH_DOCS) {
      expect(doc.title.trim().length).toBeGreaterThanOrEqual(3);
      expect(doc.title.length).toBeLessThanOrEqual(200);
      expect(doc.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const url of doc.sourceUrls) expect(url.startsWith("https://")).toBe(true);
    }
  });
  it("carries the BagToBag google repair desk audit sources", () => {
    const audit = BAGTOBAG_RESEARCH_DOCS.find(d => d.path.includes("GOOGLE-REPAIR-DESK-AUDIT"));
    expect(audit?.sourceUrls).toContain("https://github.com/sakisthb/ads-pro-win/issues/34");
  });
});

describe("parseArgs", () => {
  it("defaults to dry-run with the BagToBag brand lookup", () => {
    expect(parseArgs([])).toEqual({ confirm: false, brand: "bagtobag", userId: null });
  });
  it("enables writes only with --confirm and accepts --brand/--user overrides", () => {
    expect(parseArgs(["--confirm", "--brand", "BagToBag", "--user", "user-1"]))
      .toEqual({ confirm: true, brand: "BagToBag", userId: "user-1" });
  });
  it("fails loud on unknown flags", () => {
    expect(() => parseArgs(["--force"])).toThrow(/Unknown flag/);
  });
});

describe("resolveScope", () => {
  const membership = { findFirst: jest.fn() };
  const brand = { findFirst: jest.fn() };
  const prisma = { brand, organizationMembership: membership } as never;
  beforeEach(() => jest.clearAllMocks());

  it("resolves the brand by case-insensitive name, its organization and the org owner/admin", async () => {
    brand.findFirst.mockResolvedValue({ id: "brand-1", name: "BagToBag", organizationId: "org-1" });
    membership.findFirst.mockResolvedValue({ userId: "owner-1", role: "owner" });
    await expect(resolveScope(prisma, { brand: "bagtobag", userId: null }))
      .resolves.toEqual({ brandId: "brand-1", organizationId: "org-1", importedBy: "owner-1" });
    expect(brand.findFirst).toHaveBeenCalledWith({ where: { name: { contains: "bagtobag", mode: "insensitive" } } });
  });
  it("prefers an explicit --user over membership lookup", async () => {
    brand.findFirst.mockResolvedValue({ id: "brand-1", name: "BagToBag", organizationId: "org-1" });
    await expect(resolveScope(prisma, { brand: "bagtobag", userId: "operator-9" }))
      .resolves.toMatchObject({ importedBy: "operator-9" });
    expect(membership.findFirst).not.toHaveBeenCalled();
  });
  it("fails when no brand matches or no owner/admin membership exists", async () => {
    brand.findFirst.mockResolvedValue(null);
    await expect(resolveScope(prisma, { brand: "bagtobag", userId: null })).rejects.toThrow(/No brand found/);
    brand.findFirst.mockResolvedValue({ id: "brand-1", name: "BagToBag", organizationId: "org-1" });
    membership.findFirst.mockResolvedValue(null);
    await expect(resolveScope(prisma, { brand: "bagtobag", userId: null }))
      .rejects.toThrow(/No owner or admin membership/);
  });
});
