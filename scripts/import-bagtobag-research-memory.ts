/**
 * BagToBag research-memory release import.
 *
 * Reads the 4 private Qoder research docs and imports them into the app
 * research memory (BagToBag brand scope) through the same store the tRPC
 * router uses — scripted imports cannot drift from in-app import behavior.
 * The manifest references doc paths only; content is read locally and is
 * never committed or printed.
 *
 * Run at release time only, against the production DATABASE_URL (.env is
 * auto-loaded by @prisma/client). Dry-run by default.
 *
 * Usage:
 *   npx tsx scripts/import-bagtobag-research-memory.ts                # dry-run
 *   npx tsx scripts/import-bagtobag-research-memory.ts --confirm      # write
 * Options:
 *   --brand <name>   brand name lookup (default "bagtobag")
 *   --user <id>      importedBy user id (default: first org owner/admin)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { importResearchMemory } from "../src/lib/research-memory-store";

export interface BagtobagResearchDoc {
  path: string;
  title: string;
  sourceDate: string;
  sourceUrls: string[];
}

const STRATEGY_SOURCES = [
  "https://assets.axelaccessories.com/en/the-company",
  "https://bagtobag.com.gr/axesouar/wallet-portofolia/",
  "https://bagtobag.com.gr/fall-winter-2027/",
  "https://bagtobag.com.gr/wallet-portofolia/",
  "https://bagtobag.com.gr/wholesale-contact-form/",
  "https://campanior.com/",
  "https://campanior.com/my-performance-assistant-pricing/",
  "https://campanior.com/my-performance-assistant/",
  "https://developers.google.com/google-ads/api/docs/campaigns/ai-max-for-search-campaigns/ai-max-reporting",
  "https://developers.google.com/google-ads/api/performance-max/troubleshooting",
  "https://docs.adalysis.com/tools/audit/audit-overview",
  "https://help.optmyzr.com/en/articles/14592604-about-optmyzr-audits",
  "https://help.optmyzr.com/en/articles/5387569-automation-in-optmyzr",
  "https://support.google.com/google-ads/answer/10369906?hl=en",
  "https://support.google.com/google-ads/answer/11459091?hl=en",
  "https://support.google.com/google-ads/answer/11461796?hl=en",
  "https://support.google.com/google-ads/answer/15910187?hl=en",
  "https://support.google.com/google-ads/answer/16260130?hl=en",
  "https://support.google.com/google-ads/answer/1704443?hl=en",
  "https://support.google.com/google-ads/answer/17091676?hl=en",
  "https://support.google.com/google-ads/answer/1752334?hl=en",
  "https://support.google.com/google-ads/answer/2579754?hl=en",
  "https://support.google.com/google-ads/answer/7193800?hl=en",
  "https://www.docaofficial.com/el/",
  "https://www.docaofficial.com/en/3289-handbags",
  "https://www.verdefashion.gr/",
];

export const BAGTOBAG_RESEARCH_DOCS: BagtobagResearchDoc[] = [
  { path: "docs/BAGTOBAG-GOOGLE-REPAIR-DESK-AUDIT-2026-09-17.md",
    title: "BagToBag Google repair desk audit", sourceDate: "2026-09-17",
    sourceUrls: ["https://bagtobag.com.gr/axesouar/wallet-portofolia/",
      "https://bagtobag.com.gr/wallet-portofolia/", "https://github.com/sakisthb/ads-pro-win/issues/34"] },
  { path: "docs/BAGTOBAG-NETWORK-AND-SHOP-EVIDENCE-ADDENDUM-2026-09-18.md",
    title: "BagToBag network and shop evidence addendum", sourceDate: "2026-09-18", sourceUrls: [] },
  { path: "docs/deployment/BAGTOBAG-META-RECONCILIATION-FINDING-2026-09-18.md",
    title: "BagToBag Meta reconciliation finding", sourceDate: "2026-09-18", sourceUrls: [] },
  { path: "docs/BAGTOBAG-PERFORMANCE-STRATEGY-2026-09-18.md",
    title: "BagToBag performance strategy", sourceDate: "2026-09-18", sourceUrls: STRATEGY_SOURCES },
];

export interface ScriptArgs { confirm: boolean; brand: string; userId: string | null; }

export function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = { confirm: false, brand: "bagtobag", userId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--confirm") args.confirm = true;
    else if (flag === "--brand") { i += 1; if (!argv[i]) throw new Error("--brand requires a value"); args.brand = argv[i]; }
    else if (flag === "--user") { i += 1; if (!argv[i]) throw new Error("--user requires a value"); args.userId = argv[i]; }
    else throw new Error(`Unknown flag: ${flag}`);
  }
  return args;
}

export async function resolveScope(
  prisma: Pick<PrismaClient, "brand" | "organizationMembership">,
  opts: { brand: string; userId: string | null },
): Promise<{ brandId: string; organizationId: string; importedBy: string }> {
  const brand = await prisma.brand.findFirst({ where: { name: { contains: opts.brand, mode: "insensitive" } } });
  if (!brand) throw new Error(`No brand found matching name "${opts.brand}".`);
  let importedBy = opts.userId;
  if (!importedBy) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: brand.organizationId, role: { in: ["owner", "admin"] } }, orderBy: { createdAt: "asc" } });
    if (!membership) throw new Error("No owner or admin membership found for the brand organization; pass --user.");
    importedBy = membership.userId;
  }
  return { brandId: brand.id, organizationId: brand.organizationId, importedBy };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const prisma = new PrismaClient({ log: ["error"] });
  try {
    const scope = await resolveScope(prisma, args);
    console.log(`Scope: brand=${scope.brandId} org=${scope.organizationId} importedBy=${scope.importedBy} mode=${args.confirm ? "WRITE" : "dry-run"}`);
    for (const doc of BAGTOBAG_RESEARCH_DOCS) {
      const markdown = readFileSync(path.join(repoRoot, doc.path), "utf8");
      if (!args.confirm) {
        console.log(`[dry-run] would import: ${doc.path} · v? · ${doc.title}`);
        continue;
      }
      const result = await importResearchMemory(prisma, scope.organizationId, scope.brandId, scope.importedBy, {
        title: doc.title, sourceDoc: doc.path, sourceDate: doc.sourceDate, sourceUrls: doc.sourceUrls, markdown,
      });
      console.log(`[${result.status}] ${doc.path} · v${result.record.entry.version} · record ${result.record.id}`);
    }
    console.log(args.confirm ? "Import complete." : "Dry-run only. Re-run with --confirm to write.");
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().then(code => process.exit(code)).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
