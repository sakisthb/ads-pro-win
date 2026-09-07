import type { PrismaClient } from "@prisma/client";
import {
  resolveMarketMode,
  type MarketMode,
} from "@/lib/market-desk";
import { parseOrgSettings } from "@/lib/project-context";

function isPrismaMissingColumn(error: unknown, fragment: string): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; meta?: unknown; message?: string };
  const blob = `${err.message ?? ""} ${JSON.stringify(err.meta ?? {})}`.toLowerCase();
  if (!blob.includes(fragment.toLowerCase())) return false;
  return err.code === "P2022" || /unknown field|unknown arg|does not exist/.test(blob);
}

/**
 * Brand override, else workspace default, else mixed.
 * Missing `marketMode` column is treated as inherit/mixed so old DBs still boot.
 */
export async function loadShopMarketMode(args: {
  prisma: PrismaClient;
  organizationId: string;
  organizationSettings?: unknown;
  brandId?: string;
}): Promise<MarketMode> {
  const orgMode = parseOrgSettings(args.organizationSettings).marketMode ?? "mixed";
  try {
    if (args.brandId) {
      const brand = await args.prisma.brand.findFirst({
        where: { id: args.brandId, organizationId: args.organizationId },
        select: { marketMode: true },
      });
      return resolveMarketMode(brand?.marketMode, orgMode);
    }
    const brands = await args.prisma.brand.findMany({
      where: { organizationId: args.organizationId },
      select: { marketMode: true },
    });
    if (brands.length === 0) return orgMode;
    const resolved = brands.map((b) => resolveMarketMode(b.marketMode, orgMode));
    if (resolved.every((mode) => mode === resolved[0])) return resolved[0] ?? orgMode;
    return "mixed";
  } catch (error) {
    if (isPrismaMissingColumn(error, "marketMode")) return orgMode;
    throw error;
  }
}
