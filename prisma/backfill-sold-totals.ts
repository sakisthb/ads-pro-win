import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../src/lib/db";
import { decrypt } from "../src/lib/crypto";
import { fetchWooOrders, persistWooSoldTotals } from "../src/lib/sync/fetchers";
import { soldTotalsFromWooOrders } from "../src/lib/woo-orders";

const BRAND_SLUG = "bagtobag";
const LOOKBACK_DAYS = 365;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const brand = await prisma.brand.findFirst({
    where: { slug: BRAND_SLUG },
    select: { id: true, name: true },
  });
  if (!brand) throw new Error(`Brand ${BRAND_SLUG} not found`);

  const account = await prisma.adAccount.findFirst({
    where: { brandId: brand.id, platform: "woocommerce", isActive: true },
    select: { id: true, accountId: true, accessToken: true, refreshToken: true },
  });
  if (!account?.accessToken || !account.refreshToken) {
    throw new Error("Active WooCommerce AdAccount with tokens not found");
  }

  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const dateRange = { startDate: isoDate(start), endDate: isoDate(end) };

  console.log(`Fetching Woo orders for ${brand.name} ${dateRange.startDate} → ${dateRange.endDate}`);
  const orders = await fetchWooOrders(
    account.accountId,
    decrypt(account.accessToken),
    decrypt(account.refreshToken),
    dateRange,
  );
  const totals = soldTotalsFromWooOrders(orders);
  let units = 0;
  for (const row of totals.values()) units += row.qty;

  await persistWooSoldTotals(brand.id, totals);
  await prisma.adAccount.updateMany({
    where: { brandId: brand.id, platform: "woocommerce" },
    data: { lastSyncAt: new Date() },
  });

  console.log(
    JSON.stringify({
      brandId: brand.id,
      orderCount: orders.length,
      skusWithSold: totals.size,
      units,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
