/**
 * Pure Meta operator rules — CBO vs ABO, learning-reset, bid, attribution.
 * Graph I/O lives in operator.ts so these stay unit-testable.
 */

export const LEARNING_RESET_BUDGET_RATIO = 0.2;
export const BUDGET_EDITS_PER_HOUR = 4;
export const LEARNING_RESET_MESSAGE =
  "This edit resets the learning phase (~50 optimization events / 7 days). Confirm to proceed.";

export type BudgetLayer = "campaign" | "adset";
export type BudgetKind = "daily" | "lifetime";
export type BidStrategy =
  | "LOWEST_COST_WITHOUT_CAP"
  | "LOWEST_COST_WITH_BID_CAP"
  | "COST_CAP"
  | "LOWEST_COST_WITH_MIN_ROAS";
export type AttributionPreset = "7d_click_1d_view" | "1d_click" | "7d_click";
export type SignificantEditKind =
  | "budget_over_20"
  | "targeting"
  | "bid_strategy"
  | "optimization"
  | "creative"
  | "add_ad"
  | "schedule";

export type BudgetSnapshot = {
  campaignId: string;
  campaignDailyCents: number | null;
  campaignLifetimeCents: number | null;
  adSets: Array<{
    id: string;
    dailyCents: number | null;
    lifetimeCents: number | null;
  }>;
};

export type BudgetEditTarget = {
  layer: BudgetLayer;
  id: string;
  currentCents: number;
  kind: BudgetKind;
  cbo: boolean;
};

export function amountToMetaCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 100;
  return Math.max(100, Math.round(amount * 100));
}

export function centsToAmount(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return null;
  return cents / 100;
}

export function parseMetaCents(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function isMetaUserRateLimit(
  message: string,
  code?: number | null,
  subcode?: number | null,
): boolean {
  if (code === 17 || subcode === 2446079) return true;
  return /request limit reached/i.test(message);
}

export function operatorBudgetAmount(opts: {
  campaignDaily: number | null | undefined;
  campaignLifetime: number | null | undefined;
  budgetTarget: BudgetEditTarget | null | undefined;
}): number | null {
  if (opts.budgetTarget?.currentCents) return opts.budgetTarget.currentCents / 100;
  return opts.campaignDaily ?? opts.campaignLifetime ?? null;
}

export function metaWriteBlockedReason(granted: string[]): string | null {
  if (granted.includes("ads_management")) return null;
  const listed = granted.length ? granted.join(", ") : "none";
  return `This Meta token cannot write ads (granted: ${listed}). Reconnect Meta on Connections and approve ads_management.`;
}

export function resolveBudgetEditTarget(snap: BudgetSnapshot): BudgetEditTarget {
  if (snap.campaignDailyCents && snap.campaignDailyCents > 0) {
    return {
      layer: "campaign",
      id: snap.campaignId,
      currentCents: snap.campaignDailyCents,
      kind: "daily",
      cbo: true,
    };
  }
  if (snap.campaignLifetimeCents && snap.campaignLifetimeCents > 0) {
    return {
      layer: "campaign",
      id: snap.campaignId,
      currentCents: snap.campaignLifetimeCents,
      kind: "lifetime",
      cbo: true,
    };
  }
  const withDaily = snap.adSets.find((row) => row.dailyCents && row.dailyCents > 0);
  if (withDaily?.dailyCents) {
    return {
      layer: "adset",
      id: withDaily.id,
      currentCents: withDaily.dailyCents,
      kind: "daily",
      cbo: false,
    };
  }
  const withLife = snap.adSets.find((row) => row.lifetimeCents && row.lifetimeCents > 0);
  if (withLife?.lifetimeCents) {
    return {
      layer: "adset",
      id: withLife.id,
      currentCents: withLife.lifetimeCents,
      kind: "lifetime",
      cbo: false,
    };
  }
  throw new Error(
    "No daily or lifetime budget on this campaign. Advantage+ CBO may use a spend cap only — set a campaign budget or an ad set budget first.",
  );
}

export function budgetChangeResetsLearning(currentCents: number, nextCents: number): boolean {
  if (currentCents <= 0) return false;
  return Math.abs(nextCents - currentCents) / currentCents > LEARNING_RESET_BUDGET_RATIO;
}

export function canEditBudgetThisHour(
  editTimes: Array<Date | string>,
  now = new Date(),
): { ok: boolean; remaining: number; recent: number } {
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const recent = editTimes.filter((t) => new Date(t).getTime() > hourAgo).length;
  const remaining = Math.max(0, BUDGET_EDITS_PER_HOUR - recent);
  return { ok: remaining > 0, remaining, recent };
}

export function isLearningStatus(
  effectiveStatus?: string | null,
  learningStage?: string | null,
): boolean {
  const hay = `${effectiveStatus ?? ""} ${learningStage ?? ""}`.toUpperCase();
  return hay.includes("LEARNING");
}

export function editIsSignificant(kind: SignificantEditKind): boolean {
  return true;
}

export function requireLearningConfirm(opts: {
  kind: SignificantEditKind;
  learning: boolean;
  confirm?: boolean;
}): void {
  if (!editIsSignificant(opts.kind)) return;
  if (!opts.confirm) {
    throw new Error(LEARNING_RESET_MESSAGE);
  }
}

export function bidFieldsForStrategy(input: {
  strategy: BidStrategy;
  bidAmount?: number | null;
  minRoas?: number | null;
}): Record<string, string> {
  const fields: Record<string, string> = { bid_strategy: input.strategy };
  if (input.strategy === "LOWEST_COST_WITHOUT_CAP") {
    return fields;
  }
  if (input.strategy === "LOWEST_COST_WITH_MIN_ROAS") {
    const roas = input.minRoas && input.minRoas > 0 ? input.minRoas : 1;
    fields.bid_constraints = JSON.stringify({
      roas_average_floor: Math.round(roas * 10_000),
    });
    return fields;
  }
  const cents = amountToMetaCents(input.bidAmount ?? 0);
  fields.bid_amount = String(cents);
  return fields;
}

export function attributionSpecFromPreset(preset: AttributionPreset): Array<{
  event_type: string;
  window_days: number;
}> {
  if (preset === "1d_click") {
    return [{ event_type: "CLICK_THROUGH", window_days: 1 }];
  }
  if (preset === "7d_click") {
    return [{ event_type: "CLICK_THROUGH", window_days: 7 }];
  }
  return [
    { event_type: "CLICK_THROUGH", window_days: 7 },
    { event_type: "VIEW_THROUGH", window_days: 1 },
  ];
}

export function mapCtaToMeta(cta: string): string {
  const cleaned = cta.trim();
  if (!cleaned) return "SHOP_NOW";
  const known: Record<string, string> = {
    "shop now": "SHOP_NOW",
    "learn more": "LEARN_MORE",
    "order now": "ORDER_NOW",
    "sign up": "SIGN_UP",
    "buy now": "BUY_NOW",
    "get offer": "GET_OFFER",
    "contact us": "CONTACT_US",
    "add to cart": "ADD_TO_CART",
    "whatsapp": "WHATSAPP_MESSAGE",
    "whatsapp message": "WHATSAPP_MESSAGE",
    "apply now": "APPLY_NOW",
    "book now": "BOOK_NOW",
    "subscribe": "SUBSCRIBE",
  };
  const lower = cleaned.toLowerCase();
  if (known[lower]) return known[lower];
  return cleaned.toUpperCase().replace(/\s+/g, "_");
}

export const META_CTA_OPTIONS = [
  "SHOP_NOW",
  "LEARN_MORE",
  "ORDER_NOW",
  "BUY_NOW",
  "SIGN_UP",
  "GET_OFFER",
  "ADD_TO_CART",
  "CONTACT_US",
  "WHATSAPP_MESSAGE",
  "APPLY_NOW",
  "BOOK_NOW",
  "SUBSCRIBE",
] as const;

export const META_OPTIMIZATION_GOALS = [
  "OFFSITE_CONVERSIONS",
  "VALUE",
  "LANDING_PAGE_VIEWS",
  "LINK_CLICKS",
  "REACH",
  "LEAD_GENERATION",
  "CONVERSIONS",
] as const;

export const META_BID_STRATEGIES: Array<{ value: BidStrategy; label: string }> = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Lowest cost (no cap)" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Bid cap" },
  { value: "COST_CAP", label: "Cost cap" },
  { value: "LOWEST_COST_WITH_MIN_ROAS", label: "Minimum ROAS" },
];

export const META_SPECIAL_AD_CATEGORIES = [
  { value: "NONE", label: "None" },
  { value: "HOUSING", label: "Housing" },
  { value: "CREDIT", label: "Credit" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Social issues / elections" },
  { value: "ONLINE_GAMBLING_AND_GAMING", label: "Online gambling & gaming" },
] as const;

export function specialAdCategoriesPayload(
  categories: string[],
  countries: string[],
): Record<string, string> {
  const cats = [...new Set(categories.map((row) => row.trim().toUpperCase()).filter((row) => row && row !== "NONE"))];
  if (cats.length === 0) {
    return { special_ad_categories: JSON.stringify(["NONE"]) };
  }
  const countryCodes = [
    ...new Set(
      countries
        .map((row) => row.trim().toUpperCase())
        .filter((row) => /^[A-Z]{2}$/.test(row)),
    ),
  ];
  if (countryCodes.length === 0) {
    throw new Error("Special ad categories need at least one ISO country (e.g. GR).");
  }
  return {
    special_ad_categories: JSON.stringify(cats),
    special_ad_category_country: JSON.stringify(countryCodes),
  };
}

export function adCreateCreativeField(creativeId: string): string {
  const id = creativeId.trim();
  if (!id) throw new Error("Creative id is required.");
  return JSON.stringify({ creative_id: id });
}

export type WeekdaySchedule = {
  startMinute: number;
  endMinute: number;
  days: number[];
};

export const META_SCHEDULE_DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const DEFAULT_SCHEDULE: WeekdaySchedule = {
  startMinute: 540,
  endMinute: 1260,
  days: [1, 2, 3, 4, 5],
};

export function splitGraphFields(fields: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of fields) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

export function unknownFieldFromGraphError(message: string): string | null {
  const patterns = [
    /nonexisting field \(([^)]+)\)/i,
    /Tried accessing nonexisting field ([a-z0-9_]+)/i,
    /unknown field ['`]([a-z0-9_]+)['`]/i,
    /is not a valid field(?: for \w+)?:?\s+['`]?([a-z0-9_]+)/i,
  ];
  for (const re of patterns) {
    const match = message.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function stripGraphField(fields: string, field: string): string | null {
  if (!field) return null;
  const parts = splitGraphFields(fields);
  let changed = false;
  const next: string[] = [];
  for (const part of parts) {
    const open = part.indexOf("{");
    if (open === -1) {
      if (part === field) {
        changed = true;
        continue;
      }
      next.push(part);
      continue;
    }
    const name = part.slice(0, open);
    const close = part.lastIndexOf("}");
    const inner = close > open ? part.slice(open + 1, close) : "";
    if (name === field) {
      changed = true;
      continue;
    }
    const strippedInner = inner ? stripGraphField(inner, field) : null;
    if (
      strippedInner === null &&
      inner &&
      splitGraphFields(inner).some((part) => part === field || part.startsWith(`${field}{`))
    ) {
      changed = true;
      next.push(name);
      continue;
    }
    if (strippedInner && strippedInner !== inner) {
      changed = true;
      next.push(`${name}{${strippedInner}}`);
      continue;
    }
    next.push(part);
  }
  if (!changed || next.length === 0) return null;
  return next.join(",");
}

export function parseAdsetSchedule(raw: unknown): WeekdaySchedule {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
  const rec = row as { start_minute?: unknown; end_minute?: unknown; days?: unknown };
  const startMinute = Number(rec.start_minute);
  const endMinute = Number(rec.end_minute);
  const days = Array.isArray(rec.days)
    ? rec.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  return {
    startMinute: Number.isFinite(startMinute) ? startMinute : DEFAULT_SCHEDULE.startMinute,
    endMinute: Number.isFinite(endMinute) ? endMinute : DEFAULT_SCHEDULE.endMinute,
    days: days.length ? days : [...DEFAULT_SCHEDULE.days],
  };
}

export function minutesToClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function clockToMinutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return Math.max(0, Math.min(1439, hours * 60 + mins));
}

export function adsetSchedulePayload(schedule: WeekdaySchedule): string {
  const days = schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
  return JSON.stringify([
    {
      start_minute: Math.max(0, Math.min(1439, schedule.startMinute)),
      end_minute: Math.max(1, Math.min(1440, schedule.endMinute)),
      days,
    },
  ]);
}

export function countriesFromTargeting(targeting: unknown): string[] {
  if (!targeting || typeof targeting !== "object") return [];
  const geo = (targeting as { geo_locations?: { countries?: unknown } }).geo_locations;
  const countries = geo?.countries;
  if (!Array.isArray(countries)) return [];
  return countries.filter((c): c is string => typeof c === "string");
}

export function advantageAudienceOn(targeting: unknown): boolean {
  if (!targeting || typeof targeting !== "object") return true;
  const auto = (targeting as { targeting_automation?: { advantage_audience?: number | string } })
    .targeting_automation;
  if (!auto) return true;
  return String(auto.advantage_audience ?? "1") !== "0";
}

export const META_PUBLISHER_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  { value: "audience_network", label: "Audience Network" },
] as const;

export const META_PACING_TYPES = [
  { value: "standard", label: "Standard (daily even)" },
  { value: "day_parting", label: "Daypart pacing" },
  { value: "no_pacing", label: "No pacing (spend ASAP)" },
] as const;

const PLACEMENT_KEYS = [
  "publisher_platforms",
  "facebook_positions",
  "instagram_positions",
  "messenger_positions",
  "audience_network_positions",
  "device_platforms",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeAdsetTargeting(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (key === "geo_locations" && isRecord(existing.geo_locations) && isRecord(value)) {
      next.geo_locations = { ...existing.geo_locations, ...value };
      continue;
    }
    if (key === "targeting_automation" && isRecord(existing.targeting_automation) && isRecord(value)) {
      next.targeting_automation = { ...existing.targeting_automation, ...value };
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function automaticPlacementsOn(targeting: unknown): boolean {
  if (!isRecord(targeting)) return true;
  return !Array.isArray(targeting.publisher_platforms) || targeting.publisher_platforms.length === 0;
}

export function placementsFromTargeting(targeting: unknown): string[] {
  if (!isRecord(targeting) || !Array.isArray(targeting.publisher_platforms)) {
    return META_PUBLISHER_PLATFORMS.map((row) => row.value);
  }
  return targeting.publisher_platforms.filter((row): row is string => typeof row === "string");
}

export function audienceIdsFromTargeting(
  targeting: unknown,
  key: "custom_audiences" | "excluded_custom_audiences",
): string[] {
  if (!isRecord(targeting) || !Array.isArray(targeting[key])) return [];
  return targeting[key]
    .map((row) => {
      if (typeof row === "string") return row;
      if (isRecord(row) && typeof row.id === "string") return row.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

export function placementPatch(opts: {
  automatic: boolean;
  platforms: string[];
}): Record<string, unknown> {
  if (opts.automatic) {
    return Object.fromEntries(PLACEMENT_KEYS.map((key) => [key, null]));
  }
  const platforms = opts.platforms.filter((row) =>
    META_PUBLISHER_PLATFORMS.some((item) => item.value === row),
  );
  if (platforms.length === 0) {
    throw new Error("Pick at least one placement, or leave Advantage+ placements on.");
  }
  return { publisher_platforms: platforms };
}

export const META_LOCALES = [
  { id: 6, label: "English (US)" },
  { id: 24, label: "Greek" },
  { id: 16, label: "French" },
  { id: 5, label: "German" },
  { id: 7, label: "Spanish" },
  { id: 18, label: "Italian" },
] as const;

export function localesFromTargeting(targeting: unknown): number[] {
  if (!isRecord(targeting) || !Array.isArray(targeting.locales)) return [];
  return targeting.locales.map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

export function normalizeUrlTags(tags: string): string {
  return tags.trim().replace(/^\?/, "").replace(/\s+/g, "");
}

export function formatMetaRecommendations(raw: unknown): string[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return rows.slice(0, 8).map((row) => {
    if (typeof row === "string") return row.slice(0, 220);
    if (!isRecord(row)) return String(row).slice(0, 220);
    const title = typeof row.title === "string" ? row.title : "";
    const message = typeof row.message === "string" ? row.message : typeof row.blame_field === "string" ? row.blame_field : "";
    return [title, message].filter(Boolean).join(" — ").slice(0, 220) || JSON.stringify(row).slice(0, 220);
  }).filter(Boolean);
}

export function frequencyFromSpec(raw: unknown): { intervalDays: number; maxFrequency: number } | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!isRecord(row)) return null;
  const intervalDays = Number(row.interval_days);
  const maxFrequency = Number(row.max_frequency);
  if (!Number.isFinite(intervalDays) || !Number.isFinite(maxFrequency) || maxFrequency <= 0) return null;
  return { intervalDays, maxFrequency };
}

export function copiedIdFromBody(body: Record<string, unknown>): string | null {
  const keys = [
    "copied_campaign_id",
    "copied_adset_id",
    "copied_ad_id",
    "campaign_id",
    "adset_id",
    "ad_id",
    "id",
  ];
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  const data = body.copied_campaign_id ?? body.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (typeof nested.id === "string") return nested.id;
  }
  return null;
}
