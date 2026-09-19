/** @jest-environment node */
jest.mock("superjson", () => ({ __esModule: true, default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v } }));
jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {
  organization: { findUnique: jest.fn() }, brand: { findFirst: jest.fn() },
  analysis: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
} }));
jest.mock("@/lib/organization-authorization", () => ({ OrganizationAuthorizationError: class extends Error {},
  organizationRoles: ["owner", "admin", "member", "viewer"], requireOrganizationRoleForUser: jest.fn() }));

import { prisma } from "@/lib/db";
import { requireOrganizationRoleForUser } from "@/lib/organization-authorization";
import { researchMemoryRouter } from "../research-memory";

type StoredRecord = { id: string; organizationId: string; type: string; title: string; status: string; data: unknown };
let store: StoredRecord[] = [];
let seq = 0;

const caller = () => researchMemoryRouter.createCaller({ session: { user: { id: "fixture-user" }, expires: "2099-01-01" }, prisma });
const brandScope = { brandId: "fixture-brand" };
const importInput = { ...brandScope, title: "BagToBag performance strategy",
  sourceDoc: "docs/BAGTOBAG-PERFORMANCE-STRATEGY-2026-09-18.md", sourceDate: "2026-09-18", sourceUrls: ["https://bagtobag.gr"],
  markdown: "# Strategy\nPrivate report content.", confirmResearchOnly: true as const };

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date("2026-09-18T12:00:00Z"));
  store = []; seq = 0;
  jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "admin" } } as never);
  jest.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "fixture-org", settings: null } as never);
  jest.mocked(prisma.brand.findFirst).mockResolvedValue({ id: "fixture-brand", name: "BagToBag" } as never);
  jest.mocked(prisma.analysis.create).mockImplementation(async args => {
    const rec = { id: `record-${++seq}`, ...(args.data as Omit<StoredRecord, "id">) } as StoredRecord;
    store.push(rec); return rec;
  });
  jest.mocked(prisma.analysis.findMany).mockImplementation(async () => store.filter(r => r.type === "research_memory_v1"));
  jest.mocked(prisma.analysis.findFirst).mockImplementation(async args => store.find(r => r.id === (args.where as { id: string }).id) ?? null);
});
afterEach(() => jest.useRealTimers());

describe("research memory import", () => {
  it("creates version 1 for a new source doc inside the owned brand", async () => {
    const record = await caller().import(importInput);
    expect(record.entry.version).toBe(1);
    expect(record.entry.supersedesId).toBeNull();
    expect(record.entry.brandId).toBe("fixture-brand");
    expect(record.entry.importedBy).toBe("fixture-user");
    expect(record.entry.markdown).toContain("# Strategy");
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });
  it("bumps the version and chains supersedesId when the same source doc changes", async () => {
    const first = await caller().import(importInput);
    const second = await caller().import({ ...importInput, markdown: "# Strategy\nEdited content." });
    expect(second.entry.version).toBe(2);
    expect(second.entry.supersedesId).toBe(first.id);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(2);
  });
  it("is idempotent when the same source content is imported again", async () => {
    const first = await caller().import(importInput);
    const again = await caller().import(importInput);
    expect(again.id).toBe(first.id);
    expect(again.entry.version).toBe(1);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(1);
  });
  it("versions each source doc independently", async () => {
    await caller().import(importInput);
    const other = await caller().import({ ...importInput, sourceDoc: "docs/deployment/BAGTOBAG-META-RECONCILIATION-FINDING-2026-09-18.md", title: "Meta reconciliation finding" });
    expect(other.entry.version).toBe(1);
    expect(prisma.analysis.create).toHaveBeenCalledTimes(2);
  });
  it("withholds import for a brand outside the organization", async () => {
    jest.mocked(prisma.brand.findFirst).mockResolvedValue(null as never);
    await expect(caller().import(importInput)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
});

describe("research memory read", () => {
  it("lists decoded entries newest first and skips tampered records", async () => {
    const first = await caller().import(importInput);
    await caller().import({ ...importInput, markdown: "# Strategy\nEdited content." });
    store[0] = { ...store[0], data: { ...(store[0].data as object), markdown: "# Strategy\nTampered." } };
    const list = await caller().list(brandScope);
    expect(list).toHaveLength(1);
    expect(list[0].id).not.toBe(first.id);
    expect(list[0].entry.version).toBe(2);
  });
  it("gets a single record with integrity and brand scope enforced", async () => {
    const record = await caller().import(importInput);
    const got = await caller().get({ id: record.id, ...brandScope });
    expect(got.entry).toEqual(record.entry);
    await expect(caller().get({ id: record.id, brandId: "other-brand" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    store[0] = { ...store[0], data: { ...(store[0].data as object), version: 99 } };
    await expect(caller().get({ id: record.id, ...brandScope })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("lists nothing for a brand outside the organization", async () => {
    jest.mocked(prisma.brand.findFirst).mockResolvedValue(null as never);
    await expect(caller().list(brandScope)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("research memory authorization", () => {
  it("requires an organization admin role for import", async () => {
    jest.mocked(requireOrganizationRoleForUser).mockResolvedValue({ organizationId: "fixture-org", membership: { role: "member" } } as never);
    await expect(caller().import(importInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.analysis.create).not.toHaveBeenCalled();
  });
});
