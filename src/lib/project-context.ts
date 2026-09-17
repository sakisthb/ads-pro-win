import { parseMarketMode } from "@/lib/market-desk";

export type ProjectObjective = "sales" | "leads" | "awareness" | "traffic";

export const PROJECT_OBJECTIVES: ProjectObjective[] = [
  "sales",
  "leads",
  "awareness",
  "traffic",
];

export interface ProjectContext {
  objective: ProjectObjective;
  targetResult: string;
  priorities: string;
  constraints: string;
  seasonality: string;
  notes: string;
  updatedAt?: string;
}

export interface OrgSettingsBlob {
  currency?: string;
  onboardingCompleted?: boolean;
  projectContext?: ProjectContext;
  brandContexts?: Record<string, ProjectContext>;
  marketMode?: "mixed" | "retail" | "wholesale";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseObjective(value: unknown): ProjectObjective {
  if (value === "sales" || value === "leads" || value === "awareness" || value === "traffic") {
    return value;
  }
  return "sales";
}

export function emptyProjectContext(): ProjectContext {
  return {
    objective: "sales",
    targetResult: "",
    priorities: "",
    constraints: "",
    seasonality: "",
    notes: "",
  };
}

export function parseProjectContext(value: unknown): ProjectContext | null {
  if (!isRecord(value)) return null;
  const ctx: ProjectContext = {
    objective: parseObjective(value.objective),
    targetResult: asString(value.targetResult),
    priorities: asString(value.priorities),
    constraints: asString(value.constraints),
    seasonality: asString(value.seasonality),
    notes: asString(value.notes),
    updatedAt: asString(value.updatedAt) || undefined,
  };
  const hasAny =
    ctx.targetResult ||
    ctx.priorities ||
    ctx.constraints ||
    ctx.seasonality ||
    ctx.notes;
  return hasAny || value.objective ? ctx : null;
}

export function parseBrandContexts(value: unknown): Record<string, ProjectContext> {
  if (!isRecord(value)) return {};
  const out: Record<string, ProjectContext> = {};
  for (const [id, raw] of Object.entries(value)) {
    const parsed = parseProjectContext(raw);
    if (parsed) out[id] = parsed;
  }
  return out;
}

export function parseOrgSettings(settings: unknown): OrgSettingsBlob {
  if (!isRecord(settings)) return {};
  return {
    currency: typeof settings.currency === "string" ? settings.currency : undefined,
    onboardingCompleted: settings.onboardingCompleted === true,
    projectContext: parseProjectContext(settings.projectContext) ?? undefined,
    brandContexts: parseBrandContexts(settings.brandContexts),
    marketMode: settings.marketMode ? parseMarketMode(settings.marketMode) : undefined,
  };
}

export function contextForBrand(
  settings: OrgSettingsBlob,
  brandId: string | undefined,
): ProjectContext | null {
  if (brandId !== undefined) return strictContextForBrand(settings, brandId);
  return settings.projectContext ?? null;
}

/** Strict provenance for scoped audits. The legacy blob may belong to a different brand. */
export function strictContextForBrand(settings: OrgSettingsBlob, brandId: string): ProjectContext | null {
  if (!brandId || !settings.brandContexts || !Object.hasOwn(settings.brandContexts, brandId)) return null;
  return settings.brandContexts[brandId] ?? null;
}

/** Shared labels/values for the screen and downloadable audit. These are operator inputs. */
export function projectContextEntries(ctx: ProjectContext): [string, string][] {
  return [
    ["Saved objective", ctx.objective], ["Target result (text)", ctx.targetResult],
    ["Priorities", ctx.priorities], ["Constraints", ctx.constraints],
    ["Seasonality / promotions", ctx.seasonality], ["Notes", ctx.notes],
    ["Updated at", ctx.updatedAt ?? ""],
  ];
}

export function isContextComplete(ctx: ProjectContext | null | undefined): boolean {
  if (!ctx) return false;
  return ctx.targetResult.trim().length > 0 || ctx.priorities.trim().length > 0;
}

export function mergeOrgSettings(
  current: unknown,
  patch: Partial<OrgSettingsBlob> & { brandId?: string; brandContext?: ProjectContext },
): Record<string, unknown> {
  const base = isRecord(current) ? { ...current } : {};
  if (patch.currency !== undefined) base.currency = patch.currency;
  if (patch.onboardingCompleted !== undefined) {
    base.onboardingCompleted = patch.onboardingCompleted;
  }
  if (patch.projectContext !== undefined) {
    base.projectContext = patch.projectContext;
  }
  if (patch.brandId && patch.brandContext) {
    const existing = parseBrandContexts(base.brandContexts);
    existing[patch.brandId] = patch.brandContext;
    base.brandContexts = existing;
    base.projectContext = patch.brandContext;
  }
  if (patch.brandContexts !== undefined) {
    base.brandContexts = patch.brandContexts;
  }
  if (patch.marketMode !== undefined) {
    base.marketMode = patch.marketMode;
  }
  return base;
}

export function contextToPromptBlock(ctx: ProjectContext | null | undefined): string {
  if (!ctx) return "";
  const lines = [
    `Business objective: ${ctx.objective}`,
    ctx.targetResult && `Target result: ${ctx.targetResult}`,
    ctx.priorities && `Priorities: ${ctx.priorities}`,
    ctx.constraints && `Constraints: ${ctx.constraints}`,
    ctx.seasonality && `Seasonality / promotions: ${ctx.seasonality}`,
    ctx.notes && `Notes: ${ctx.notes}`,
  ].filter(Boolean);
  return lines.join("\n");
}
