/** @jest-environment node */
import type { PrismaClient } from "@prisma/client";
import { importResearchMemory, storedResearchMemoryRecords } from "@/lib/research-memory-store";

type StoredRecord = { id: string; organizationId: string; type: string; title: string; status: string; data: unknown };
let store: StoredRecord[] = [];
let seq = 0;

function makePrisma() {
  const prisma = {
    analysis: {
      create: jest.fn(async args => {
        const rec = { id: `record-${++seq}`, ...(args.data as Omit<StoredRecord, "id">) } as StoredRecord;
        store.push(rec);
        return rec;
      }),
      findMany: jest.fn(async () => store.filter(r => r.type === "research_memory_v1")),
      findFirst: jest.fn(async args => store.find(r => r.id === (args.where as { id: string }).id) ?? null),
    },
  };
  return prisma as unknown as PrismaClient & { analysis: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock } };
}

const ORG = "fixture-org", BRAND = "fixture-brand", USER = "fixture-user";
const baseInput = { title: "BagToBag performance strategy",
  sourceDoc: "docs/BAGTOBAG-PERFORMANCE-STRATEGY-2026-09-18.md", sourceDate: "2026-09-18",
  sourceUrls: ["https://bagtobag.gr"], markdown: "# Strategy\nPrivate report content." };

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00Z"));
  store = []; seq = 0;
});
afterEach(() => jest.useRealTimers());

describe("importResearchMemory", () => {
  it("imports version 1 for a new source doc and reports status imported", async () => {
    const prisma = makePrisma();
    const result = await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    expect(result.status).toBe("imported");
    expect(result.record.entry.version).toBe(1);
    expect(result.record.entry.supersedesId).toBeNull();
    expect(result.record.entry.brandId).toBe(BRAND);
    expect(result.record.entry.importedBy).toBe(USER);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });
  it("bumps version and chains supersedesId when the same source doc changes", async () => {
    const prisma = makePrisma();
    const first = await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    const second = await importResearchMemory(prisma, ORG, BRAND, USER, { ...baseInput, markdown: "# Strategy\nEdited content." });
    expect(second.status).toBe("imported");
    expect(second.record.entry.version).toBe(2);
    expect(second.record.entry.supersedesId).toBe(first.record.id);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(2);
  });
  it("reports unchanged and skips the write when identical content is re-imported", async () => {
    const prisma = makePrisma();
    const first = await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    const again = await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    expect(again.status).toBe("unchanged");
    expect(again.record.id).toBe(first.record.id);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });
  it("versions each source doc independently", async () => {
    const prisma = makePrisma();
    await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    const other = await importResearchMemory(prisma, ORG, BRAND, USER,
      { ...baseInput, sourceDoc: "docs/deployment/BAGTOBAG-META-RECONCILIATION-FINDING-2026-09-18.md", title: "Meta reconciliation finding" });
    expect(other.record.entry.version).toBe(1);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(2);
  });
});

describe("storedResearchMemoryRecords", () => {
  it("decodes entries and withholds tampered records", async () => {
    const prisma = makePrisma();
    await importResearchMemory(prisma, ORG, BRAND, USER, baseInput);
    await importResearchMemory(prisma, ORG, BRAND, USER, { ...baseInput, markdown: "# Strategy\nEdited content." });
    store[0] = { ...store[0], data: { ...(store[0].data as object), markdown: "# Strategy\nTampered." } };
    const records = await storedResearchMemoryRecords(prisma, ORG, BRAND);
    expect(records).toHaveLength(1);
    expect(records[0].entry.version).toBe(2);
  });
});
