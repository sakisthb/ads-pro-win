/**
 * Meta write policy v1 — operator-authorized edits on existing objects.
 * Catalog surgery and WordPress writes stay locked to SACOS Growth Center.
 */

export const META_WRITE_V1_ACTIONS = ["setStatus", "setBudget", "setName"] as const;

export type MetaWriteV1Action = (typeof META_WRITE_V1_ACTIONS)[number];

export const META_WRITE_DEFAULT_BRAND_HOST = "bagtobag.com.gr";

export type MetaWriteGateInput = {
  organizationSlug: string;
  grantedScopes: string[];
  /** Explicit product decision: Meta writes are allowed when scopes + org allow it. */
  operatorAuthorizedMetaWrite?: boolean;
  brandWebsite?: string | null;
};

export type MetaWriteGate = {
  allowed: boolean;
  reason: string | null;
  brandScoped: boolean;
  defaultBrandHint: string;
};

export function isMetaWriteV1Action(action: string): action is MetaWriteV1Action {
  return (META_WRITE_V1_ACTIONS as readonly string[]).includes(action);
}

function normalizeHost(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.toLowerCase() || null;
  }
}

export function resolveMetaWriteGate(input: MetaWriteGateInput): MetaWriteGate {
  const operatorAuthorized = input.operatorAuthorizedMetaWrite !== false;
  const host = normalizeHost(input.brandWebsite);
  const brandScoped = Boolean(host);
  const defaultBrandHint = META_WRITE_DEFAULT_BRAND_HOST;

  if (!operatorAuthorized) {
    return {
      allowed: false,
      reason: "Meta writes are not authorized for this workspace.",
      brandScoped,
      defaultBrandHint,
    };
  }

  if (input.organizationSlug === "demo") {
    return {
      allowed: false,
      reason: "Switch out of the Demo workspace to edit live Meta ads.",
      brandScoped,
      defaultBrandHint,
    };
  }

  if (!input.grantedScopes.includes("ads_management")) {
    return {
      allowed: false,
      reason:
        "Meta is still on a read-only token. Reconnect Meta on Connections and approve ads_management.",
      brandScoped,
      defaultBrandHint,
    };
  }

  return {
    allowed: true,
    reason: null,
    brandScoped,
    defaultBrandHint,
  };
}

export function assertMetaWriteAllowed(input: MetaWriteGateInput): void {
  const gate = resolveMetaWriteGate(input);
  if (!gate.allowed) {
    throw new Error(gate.reason ?? "Meta write blocked.");
  }
}

export function otherAdPlatformsRemainReadOnly(
  platforms: Array<"google" | "tiktok" | "meta">,
): Record<"google" | "tiktok" | "meta", boolean> {
  return {
    google: platforms.includes("google"),
    tiktok: platforms.includes("tiktok"),
    meta: false,
  };
}

export function metaWritePolicySummary() {
  return {
    metaWriteAuthorized: true,
    requiredOAuthScopes: ["ads_read", "ads_management"] as const,
    auditLog: "metaWriteLog" as const,
    catalogSurgeryUnlocked: false,
    wordpressWritesUnlocked: false,
    v1Scope: [
      "status ACTIVE/PAUSED on campaign/adset/ad",
      "daily/lifetime budget where applicable",
      "rename campaign/adset/ad",
    ] as const,
    outOfScopeV1: [
      "create campaign/adset/ad",
      "creative upload",
      "catalog surgery",
      "WordPress writes",
    ] as const,
    defaultBrandHost: META_WRITE_DEFAULT_BRAND_HOST,
  };
}
