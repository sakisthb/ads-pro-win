/** @jest-environment node */
import {
  RESEARCH_MEMORY_RECORD_TYPE,
  ResearchMemoryError,
  buildResearchMemoryEntry,
  decodeResearchMemoryRecord,
  researchMemoryContentHash,
} from "@/lib/research-memory";

const baseInput = {
  title: "BagToBag performance strategy",
  sourceDoc: "docs/BAGTOBAG-PERFORMANCE-STRATEGY-2026-09-18.md",
  sourceDate: "2026-09-18",
  sourceUrls: ["https://bagtobag.gr"],
  importedAt: "2026-09-18T10:05:48.000Z",
  importedBy: "fixture-user",
  brandId: "fixture-brand",
  markdown: "# Strategy\nPrivate report content.",
};

describe("research memory entry building", () => {
  it("stamps schemaVersion/kind and a valid content hash", () => {
    const entry = buildResearchMemoryEntry({ ...baseInput, version: 1, supersedesId: null });
    expect(entry.schemaVersion).toBe(1);
    expect(entry.kind).toBe("imported_operator_research");
    expect(entry.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.contentHash).toBe(researchMemoryContentHash(entry));
  });
  it("changes the hash when the markdown or version changes", () => {
    const v1 = buildResearchMemoryEntry({ ...baseInput, version: 1, supersedesId: null });
    const v2 = buildResearchMemoryEntry({ ...baseInput, version: 2, supersedesId: "record-1" });
    const edited = buildResearchMemoryEntry({ ...baseInput, markdown: "# Strategy\nEdited.", version: 1, supersedesId: null });
    expect(v2.contentHash).not.toBe(v1.contentHash);
    expect(edited.contentHash).not.toBe(v1.contentHash);
  });
  it("rejects invalid input instead of building an unhashable entry", () => {
    expect(() => buildResearchMemoryEntry({ ...baseInput, title: "ab", version: 1, supersedesId: null })).toThrow();
    expect(() => buildResearchMemoryEntry({ ...baseInput, sourceDate: "18/09/2026", version: 1, supersedesId: null })).toThrow();
    expect(() => buildResearchMemoryEntry({ ...baseInput, version: 0, supersedesId: null })).toThrow();
  });
});

describe("research memory record decoding", () => {
  it("round-trips a stored record within its brand scope", () => {
    const entry = buildResearchMemoryEntry({ ...baseInput, version: 1, supersedesId: null });
    const decoded = decodeResearchMemoryRecord({ id: "record-1", data: entry }, "fixture-brand");
    expect(decoded.id).toBe("record-1");
    expect(decoded.entry).toEqual(entry);
  });
  it("withholds evidence from a different brand scope", () => {
    const entry = buildResearchMemoryEntry({ ...baseInput, version: 1, supersedesId: null });
    expect(() => decodeResearchMemoryRecord({ id: "record-1", data: entry }, "other-brand"))
      .toThrow(ResearchMemoryError);
    try {
      decodeResearchMemoryRecord({ id: "record-1", data: entry }, "other-brand");
    } catch (error) {
      expect((error as ResearchMemoryError).code).toBe("scope");
    }
  });
  it("withholds tampered records on integrity failure", () => {
    const entry = buildResearchMemoryEntry({ ...baseInput, version: 1, supersedesId: null });
    const tampered = { ...entry, markdown: "# Strategy\nTampered." };
    try {
      decodeResearchMemoryRecord({ id: "record-1", data: tampered }, "fixture-brand");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchMemoryError);
      expect((error as ResearchMemoryError).code).toBe("integrity");
    }
  });
  it("withholds unsupported record shapes", () => {
    try {
      decodeResearchMemoryRecord({ id: "record-1", data: { hello: "world" } }, "fixture-brand");
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as ResearchMemoryError).code).toBe("unsupported");
    }
  });
});

describe("record type discipline", () => {
  it("uses a dedicated Analysis type separate from google audit research", () => {
    expect(RESEARCH_MEMORY_RECORD_TYPE).toBe("research_memory_v1");
    expect(RESEARCH_MEMORY_RECORD_TYPE).not.toBe("google_audit_research_v1");
  });
});
