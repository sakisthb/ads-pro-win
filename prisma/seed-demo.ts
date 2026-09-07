import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

/**
 * Demo Organization Seed Script
 *
 * Creates a complete "Demo Organization" with realistic data for all modules.
 * Safe to re-run — uses upserts for structural data, createMany+skipDuplicates for bulk.
 *
 * Usage:  npx tsx prisma/seed-demo.ts
 * Env:    SEED_USER_ID, SEED_USER_EMAIL (from .env.local)
 */

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const SEED_USER_ID = process.env.SEED_USER_ID;
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL;

// ── Helpers ─────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRandom(seed) * arr.length)];
}

// ── Constants ───────────────────────────────────────────────────────────────

const ORG_SLUG = 'demo';
const ORG_NAME = 'Demo Organization';
const BRAND_NAME = 'StyleVault – Fashion & Lifestyle';
const BRAND_SLUG = 'stylevault';

const AD_ACCOUNT_DEFS = [
  { platform: 'meta', accountId: 'act_demo_meta_001', name: 'StyleVault Meta Ads' },
  { platform: 'google', accountId: 'demo-google-001', name: 'StyleVault Google Ads' },
  { platform: 'tiktok', accountId: 'demo-tiktok-001', name: 'StyleVault TikTok Ads' },
  { platform: 'woocommerce', accountId: 'https://demo-stylevault.com', name: 'WooCommerce – demo-stylevault.com' },
  { platform: 'opencart', accountId: 'https://demo-stylevault-opencart.com', name: 'OpenCart – demo-stylevault-opencart.com' },
  { platform: 'omnisend', accountId: 'omnisend-demo-001', name: 'StyleVault Omnisend' },
  { platform: 'brevo', accountId: 'brevo-demo-001', name: 'StyleVault Brevo' },
] as const;

type CampaignDef = {
  name: string;
  platform: string;
  status: string;
  budget: number;
  spentPct: number; // 0-1 fraction of budget spent
};

const CAMPAIGNS: CampaignDef[] = [
  // Facebook (4)
  { name: 'Summer Collection Retargeting', platform: 'facebook', status: 'active', budget: 3000, spentPct: 0.72 },
  { name: 'Brand Awareness – Bags', platform: 'facebook', status: 'active', budget: 2500, spentPct: 0.55 },
  { name: 'Dynamic Product Ads', platform: 'facebook', status: 'paused', budget: 1500, spentPct: 0.40 },
  { name: 'Lookalike – High Value', platform: 'facebook', status: 'active', budget: 4000, spentPct: 0.85 },
  // Google (4)
  { name: 'Search – Brand Terms', platform: 'google', status: 'active', budget: 2000, spentPct: 0.60 },
  { name: 'Shopping – Accessories', platform: 'google', status: 'active', budget: 3500, spentPct: 0.78 },
  { name: 'Performance Max – Full Catalog', platform: 'google', status: 'completed', budget: 5000, spentPct: 0.95 },
  { name: 'Display – Remarketing', platform: 'google', status: 'paused', budget: 1200, spentPct: 0.30 },
  // TikTok (4)
  { name: 'Spark Ads – UGC Reviews', platform: 'tiktok', status: 'active', budget: 2000, spentPct: 0.65 },
  { name: 'TopView – New Arrivals', platform: 'tiktok', status: 'completed', budget: 4500, spentPct: 1.0 },
  { name: 'Catalog Sales – Best Sellers', platform: 'tiktok', status: 'active', budget: 1800, spentPct: 0.50 },
  { name: 'In-Feed – Summer Sale', platform: 'tiktok', status: 'draft', budget: 500, spentPct: 0 },
];

const PRODUCTS = [
  { name: 'Leather Crossbody Bag', price: 129, cost: 52, stock: 85, sku: 'SV-LCB-001' },
  { name: 'Canvas Tote – Natural', price: 49, cost: 15, stock: 200, sku: 'SV-CTN-002' },
  { name: 'Silk Scarf – Geometric', price: 69, cost: 22, stock: 120, sku: 'SV-SSG-003' },
  { name: 'Minimalist Watch – Gold', price: 189, cost: 75, stock: 35, sku: 'SV-MWG-004' },
  { name: 'Quilted Chain Bag', price: 159, cost: 64, stock: 0, sku: 'SV-QCB-005' },
  { name: 'Linen Blazer – Sand', price: 149, cost: 55, stock: 42, sku: 'SV-LBS-006' },
  { name: 'Suede Ankle Boots', price: 179, cost: 72, stock: 28, sku: 'SV-SAB-007' },
  { name: 'Oversized Sunglasses', price: 89, cost: 27, stock: 150, sku: 'SV-OSG-008' },
  { name: 'Woven Straw Hat', price: 39, cost: 12, stock: 0, sku: 'SV-WSH-009' },
  { name: 'Pearl Drop Earrings', price: 59, cost: 18, stock: 95, sku: 'SV-PDE-010' },
  { name: 'Cashmere Wrap – Ivory', price: 169, cost: 68, stock: 60, sku: 'SV-CWI-011' },
  { name: 'Leather Belt – Cognac', price: 45, cost: 14, stock: 180, sku: 'SV-LBC-012' },
  { name: 'Satin Midi Skirt', price: 79, cost: 28, stock: 72, sku: 'SV-SMS-013' },
  { name: 'Structured Shopper Bag', price: 139, cost: 56, stock: 48, sku: 'SV-SSB-014' },
  { name: 'Gold Layered Necklace', price: 55, cost: 17, stock: 110, sku: 'SV-GLN-015' },
  { name: 'Cotton Poplin Dress', price: 99, cost: 35, stock: 65, sku: 'SV-CPD-016' },
  { name: 'Embroidered Clutch', price: 85, cost: 30, stock: 0, sku: 'SV-ECL-017' },
  { name: 'Velvet Headband Set', price: 29, cost: 8, stock: 190, sku: 'SV-VHS-018' },
  { name: 'Tailored Wide-Leg Pants', price: 119, cost: 44, stock: 55, sku: 'SV-TWP-019' },
  { name: 'Bamboo Handle Bag', price: 109, cost: 40, stock: 38, sku: 'SV-BHB-020' },
  { name: 'Printed Wrap Dress', price: 89, cost: 32, stock: 80, sku: 'SV-PWD-021' },
  { name: 'Leather Card Holder', price: 35, cost: 10, stock: 160, sku: 'SV-LCH-022' },
  { name: 'Crystal Brooch', price: 45, cost: 14, stock: 75, sku: 'SV-CRB-023' },
  { name: 'Ribbed Knit Top', price: 59, cost: 20, stock: 100, sku: 'SV-RKT-024' },
  { name: 'Chain Link Bracelet', price: 65, cost: 20, stock: 88, sku: 'SV-CLB-025' },
];

const SOURCES = ['facebook', 'google', 'tiktok', 'direct', 'organic'];
const CAMPAIGN_UTMS = [
  'summer_collection', 'brand_awareness', 'dynamic_product', 'lookalike',
  'search_brand', 'shopping_acc', 'perf_max', 'display_remarketing',
  'spark_ugc', 'topview_arrivals', 'catalog_best', 'infeed_sale',
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!SEED_USER_ID) throw new Error('SEED_USER_ID env var is required');
  if (!SEED_USER_EMAIL) throw new Error('SEED_USER_EMAIL env var is required');

  console.log('🎪 Starting Demo Organization seed...');
  console.log(`   User: ${SEED_USER_EMAIL} (${SEED_USER_ID})\n`);

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: ORG_NAME, slug: ORG_SLUG, plan: 'enterprise', settings: { timezone: 'Europe/Athens', currency: 'EUR' } },
    update: { name: ORG_NAME, plan: 'enterprise' },
  });
  console.log(`✓ Organization: ${org.name} (id: ${org.id})`);

  // 2. Ensure the seed user exists in the users table (needed for FK on membership)
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    create: { id: SEED_USER_ID, email: SEED_USER_EMAIL, fullName: 'Demo User', role: 'admin', isActive: true, organizationId: org.id },
    update: { organizationId: org.id },
  });

  // 2b. Demo User (separate — campaigns need a userId that belongs to this org)
  const demoUserId = `demo-user-${org.id}`;
  await prisma.user.upsert({
    where: { id: demoUserId },
    create: { id: demoUserId, email: 'demo@stylevault.com', fullName: 'Demo Manager', role: 'admin', isActive: true, organizationId: org.id },
    update: { email: 'demo@stylevault.com', fullName: 'Demo Manager', organizationId: org.id },
  });

  // 3. OrganizationMembership — link real user to demo org as member (NOT default)
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: SEED_USER_ID, organizationId: org.id } },
    create: { userId: SEED_USER_ID, organizationId: org.id, role: 'member', isDefault: false },
    update: { role: 'member', isDefault: false },
  });
  console.log(`✓ Membership: ${SEED_USER_EMAIL} → demo org (member, isDefault=false)`);

  // 4. Brand
  const brand = await prisma.brand.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: BRAND_SLUG } },
    create: { name: BRAND_NAME, slug: BRAND_SLUG, organizationId: org.id, website: 'https://demo-stylevault.com' },
    update: { name: BRAND_NAME },
  });
  console.log(`✓ Brand: ${brand.name} (id: ${brand.id})`);

  // 5. AdAccounts
  const adAccountMap = new Map<string, string>(); // platform -> adAccountId
  for (const def of AD_ACCOUNT_DEFS) {
    const acct = await prisma.adAccount.upsert({
      where: { platform_accountId: { platform: def.platform, accountId: def.accountId } },
      create: {
        brandId: brand.id, platform: def.platform, accountId: def.accountId, name: def.name,
        currency: 'EUR', accessToken: 'demo-encrypted-token', tokenExpiry: new Date('2030-01-01'),
        isActive: true, lastSyncAt: new Date(),
      },
      update: { brandId: brand.id, name: def.name, isActive: true, lastSyncAt: new Date() },
    });
    adAccountMap.set(def.platform, acct.id);
  }
  console.log(`✓ AdAccounts: ${AD_ACCOUNT_DEFS.length} created`);

  // 6. Campaigns (12)
  const campaignIds: string[] = [];
  const campaignNameToId = new Map<string, string>();
  const thirtyDaysAgo = daysAgo(30);
  const sixtyDaysAhead = addDays(new Date(), 60);

  for (let i = 0; i < CAMPAIGNS.length; i++) {
    const c = CAMPAIGNS[i];
    const slug = `${ORG_SLUG}-${c.platform}-${i}`;
    const camp = await prisma.campaign.upsert({
      where: { id: `demo-camp-${i}` },
      create: {
        id: `demo-camp-${i}`, name: c.name, platform: c.platform, status: c.status,
        budget: c.budget, budgetSpent: round2(c.budget * c.spentPct),
        startDate: c.status === 'completed' ? daysAgo(90) : thirtyDaysAgo,
        endDate: c.status === 'completed' ? daysAgo(5) : (c.status === 'draft' ? null : sixtyDaysAhead),
        description: `${c.name} campaign for StyleVault fashion brand`,
        targetAudience: { age: '25-45', gender: 'female', interests: ['fashion', 'luxury', 'lifestyle'], locations: ['Greece', 'Cyprus', 'Italy'] },
        performance: { roas: round2(2 + seededRandom(i * 7) * 2.5), ctr: round2(1.2 + seededRandom(i * 13) * 3) },
        organizationId: org.id, userId: demoUserId,
      },
      update: { name: c.name, status: c.status, budget: c.budget, budgetSpent: round2(c.budget * c.spentPct) },
    });
    campaignIds.push(camp.id);
    campaignNameToId.set(c.name, camp.id);
  }
  console.log(`✓ Campaigns: ${CAMPAIGNS.length} created`);

  // ── Group campaign IDs by platform for DailyMetric generation ──
  const metaCampIds = CAMPAIGNS.map((c, i) => c.platform === 'facebook' ? campaignIds[i] : null).filter(Boolean) as string[];
  const googleCampIds = CAMPAIGNS.map((c, i) => c.platform === 'google' ? campaignIds[i] : null).filter(Boolean) as string[];
  const tiktokCampIds = CAMPAIGNS.map((c, i) => c.platform === 'tiktok' ? campaignIds[i] : null).filter(Boolean) as string[];

  // 7. DailyMetrics (~1350 rows over 90 days)
  console.log('⏳ Generating DailyMetric rows (90 days × campaigns)...');
  const metaAdId = adAccountMap.get('meta')!;
  const googleAdId = adAccountMap.get('google')!;
  const tiktokAdId = adAccountMap.get('tiktok')!;

  type MetricRow = {
    date: Date; platform: string; adAccountId: string; campaignId: string; campaignName: string;
    adGroupId: null; adId: null; currency: string;
    spend: number; impressions: number; clicks: number; conversions: number;
    conversionValue: number; cpc: number; cpm: number; ctr: number; roas: number;
  };

  const metrics: MetricRow[] = [];
  const NOW = new Date(); NOW.setHours(0, 0, 0, 0);

  for (let day = 1; day <= 90; day++) {
    const date = daysAgo(day);
    const dow = date.getDay(); // 0=Sun
    const weekendBoost = (dow === 0 || dow === 6) ? 1.25 : 1.0;
    const seasonalWave = 1 + 0.15 * Math.sin((day / 90) * Math.PI * 2);

    // Meta campaigns (5 campaignIds — we have 4 but let's use the first 4 campaign IDs)
    for (let ci = 0; ci < metaCampIds.length; ci++) {
      const seed = day * 100 + ci;
      const r = (offset: number) => seededRandom(seed + offset);
      const baseSpend = 8 + r(1) * 17; // €8-25
      const spend = round2(baseSpend * weekendBoost * seasonalWave);
      const cpm = round2(4 + r(2) * 4); // €4-8
      const ctrVal = round2(0.012 + r(3) * 0.013); // 1.2-2.5%
      const impressions = Math.round(spend * 1000 / cpm);
      const clicks = Math.max(1, Math.round(impressions * ctrVal));
      const cpc = round2(spend / clicks);
      const conversions = Math.max(1, Math.round(2 + r(4) * 13)); // 2-15
      const aov = 45 + r(5) * 40; // €45-85
      const conversionValue = round2(conversions * aov);
      const roas = round2(conversionValue / spend);
      metrics.push({
        date, platform: 'facebook', adAccountId: metaAdId,
        campaignId: metaCampIds[ci], campaignName: CAMPAIGNS[ci].name,
        adGroupId: null, adId: null, currency: 'EUR',
        spend, impressions, clicks, conversions, conversionValue, cpc, cpm, ctr: round2(ctrVal * 100), roas,
      });
    }

    // Google campaigns
    for (let ci = 0; ci < googleCampIds.length; ci++) {
      const seed = day * 200 + ci;
      const r = (offset: number) => seededRandom(seed + offset);
      const baseSpend = 5 + r(1) * 13; // €5-18
      const spend = round2(baseSpend * weekendBoost * seasonalWave);
      const cpm = round2(3 + r(2) * 3); // €3-6
      const ctrVal = round2(0.02 + r(3) * 0.025); // 2.0-4.5%
      const impressions = Math.round(spend * 1000 / cpm);
      const clicks = Math.max(1, Math.round(impressions * ctrVal));
      const cpc = round2(spend / clicks);
      const conversions = Math.max(1, Math.round(1 + r(4) * 9)); // 1-10
      const aov = 50 + r(5) * 35;
      const conversionValue = round2(conversions * aov);
      const roas = round2(conversionValue / spend);
      const campIdx = 4 + ci; // offset in CAMPAIGNS array
      metrics.push({
        date, platform: 'google', adAccountId: googleAdId,
        campaignId: googleCampIds[ci], campaignName: CAMPAIGNS[campIdx].name,
        adGroupId: null, adId: null, currency: 'EUR',
        spend, impressions, clicks, conversions, conversionValue, cpc, cpm, ctr: round2(ctrVal * 100), roas,
      });
    }

    // TikTok campaigns
    for (let ci = 0; ci < tiktokCampIds.length; ci++) {
      const seed = day * 300 + ci;
      const r = (offset: number) => seededRandom(seed + offset);
      const baseSpend = 4 + r(1) * 8; // €4-12
      const spend = round2(baseSpend * weekendBoost * seasonalWave);
      const cpm = round2(2 + r(2) * 3); // €2-5
      const ctrVal = round2(0.008 + r(3) * 0.012); // 0.8-2.0%
      const impressions = Math.round(spend * 1000 / cpm);
      const clicks = Math.max(1, Math.round(impressions * ctrVal));
      const cpc = round2(spend / clicks);
      const conversions = Math.max(1, Math.round(1 + r(4) * 7)); // 1-8
      const aov = 45 + r(5) * 40;
      const conversionValue = round2(conversions * aov);
      const roas = round2(conversionValue / spend);
      const campIdx = 8 + ci;
      metrics.push({
        date, platform: 'tiktok', adAccountId: tiktokAdId,
        campaignId: tiktokCampIds[ci], campaignName: CAMPAIGNS[campIdx].name,
        adGroupId: null, adId: null, currency: 'EUR',
        spend, impressions, clicks, conversions, conversionValue, cpc, cpm, ctr: round2(ctrVal * 100), roas,
      });
    }
  }

  // Bulk insert DailyMetrics
  const batchSize = 500;
  let totalMetricsInserted = 0;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    const result = await prisma.dailyMetric.createMany({
      data: batch.map(m => ({
        ...m,
        spend: m.spend, conversions: m.conversions, conversionValue: m.conversionValue,
        cpc: m.cpc, cpm: m.cpm, ctr: m.ctr, roas: m.roas,
      })),
      skipDuplicates: true,
    });
    totalMetricsInserted += result.count;
  }
  console.log(`✓ DailyMetric: ${totalMetricsInserted} rows inserted (${metrics.length} generated, duplicates skipped)`);

  // 8. WooOrders (150)
  console.log('⏳ Generating WooOrders...');
  const wooAdId = adAccountMap.get('woocommerce')!;
  const orders: Array<{
    brandId: string; orderId: number; orderNumber: string; status: string;
    dateCreated: Date; currency: string; grossSales: number; discounts: number;
    refunds: number; netSales: number; shipping: number; tax: number;
    costOfGoods: number; grossProfit: number; isNewCustomer: boolean;
    customerEmail: string; source: string; medium: string; campaign: string;
  }> = [];

  for (let i = 0; i < 150; i++) {
    const seed = i * 37 + 7;
    const r = (o: number) => seededRandom(seed + o);
    // Distribute over 90 days with weekend clustering
    let dayOffset = Math.floor(r(1) * 90);
    const testDate = daysAgo(dayOffset);
    const dow = testDate.getDay();
    if (dow === 0 || dow === 6) dayOffset = Math.max(1, dayOffset - Math.floor(r(2) * 3)); // shift toward weekend
    const dateCreated = daysAgo(dayOffset);
    dateCreated.setHours(8 + Math.floor(r(10) * 14), Math.floor(r(11) * 60));

    let status: string;
    if (i < 120) status = 'completed';
    else if (i < 140) status = 'processing';
    else status = 'refunded';

    const grossSales = round2(25 + r(3) * 155); // €25-180
    const discounts = round2(r(4) * grossSales * 0.15);
    const refunds = status === 'refunded' ? round2(grossSales * 0.8) : round2(r(5) * 5);
    const netSales = round2(grossSales - discounts - refunds);
    const shipping = round2(4.90 + r(6) * 5);
    const tax = round2(netSales * 0.24);
    const cogPct = 0.30 + r(7) * 0.20; // 30-50%
    const costOfGoods = round2(grossSales * cogPct);
    const grossProfit = round2(netSales - costOfGoods);
    const source = pick(SOURCES, seed + 8);
    const medium = source === 'direct' ? '(none)' : source === 'organic' ? 'organic' : 'cpc';
    const campaign = pick(CAMPAIGN_UTMS, seed + 9);

    orders.push({
      brandId: brand.id, orderId: 1001 + i, orderNumber: `SV-${1001 + i}`,
      status, dateCreated, currency: 'EUR',
      grossSales, discounts, refunds, netSales, shipping, tax,
      costOfGoods, grossProfit,
      isNewCustomer: r(12) < 0.30,
      customerEmail: `customer${i + 1}@example.com`,
      source, medium, campaign,
    });
  }

  const orderResult = await prisma.wooOrder.createMany({ data: orders, skipDuplicates: true });
  console.log(`✓ WooOrders: ${orderResult.count} inserted`);

  // 9. WooProducts (25)
  const productData = PRODUCTS.map((p, i) => ({
    brandId: brand.id, productId: 1001 + i, sku: p.sku, name: p.name,
    price: p.price, costOfGoods: p.cost, stockQty: p.stock,
    stockStatus: p.stock === 0 ? 'outofstock' : 'instock',
    isAdvertised: i < 10, lastSyncAt: new Date(),
  }));
  const prodResult = await prisma.wooProduct.createMany({ data: productData, skipDuplicates: true });
  console.log(`✓ WooProducts: ${prodResult.count} inserted`);

  // 10. AIAgents (4)
  const agents = [
    { name: 'CampaignOptimizer Pro', type: 'campaign_optimizer', status: 'active',
      configuration: { optimizationGoal: 'roas', minConfidence: 0.8, maxBudgetChangePct: 0.25, platforms: ['facebook', 'google', 'tiktok'] },
      performance: { totalOptimizations: 142, successRate: 0.78, avgRoasImprovement: 0.32, lastRunAt: daysAgo(1) } },
    { name: 'AudienceInsight AI', type: 'audience_analyzer', status: 'active',
      configuration: { analysisDepth: 'deep', segments: ['high_value', 'cart_abandoners', 'lookalike'], refreshIntervalHours: 6 },
      performance: { segmentsIdentified: 24, avgSegmentSize: 12500, conversionLift: 0.18 } },
    { name: 'CreativeGen Studio', type: 'creative_generator', status: 'active',
      configuration: { formats: ['square', 'story', 'carousel'], styleGuide: 'modern-minimal', brandColors: ['#1a1a2e', '#e94560', '#f5e6cc'] },
      performance: { creativesGenerated: 87, avgCtrLift: 0.22, topPerformingFormat: 'carousel' } },
    { name: 'PredictiveEngine', type: 'performance_predictor', status: 'training',
      configuration: { modelVersion: 'v2.1', features: ['spend_velocity', 'ctr_trend', 'seasonal', 'competitor_spend'], horizonDays: 14 },
      performance: { predictionsMade: 56, mae: 0.12, trainingAccuracy: 0.82 } },
  ];
  for (const a of agents) {
    await prisma.aIAgent.upsert({
      where: { id: `demo-agent-${a.type}` },
      create: { id: `demo-agent-${a.type}`, ...a, organizationId: org.id, lastRunAt: daysAgo(1) },
      update: { name: a.name, status: a.status, configuration: a.configuration, performance: a.performance },
    });
  }
  console.log(`✓ AIAgents: ${agents.length} created`);

  // 11. Workflows (4)
  const workflows = [
    { name: 'Daily Budget Rebalancer', type: 'optimization', status: 'active',
      description: 'Automatically shifts budget from underperforming to top campaigns daily at 6 AM',
      configuration: { trigger: 'schedule', timeOfDay: '06:00', minRoasThreshold: 2.0, maxShiftPct: 0.15 },
      schedule: { cron: '0 6 * * *', timezone: 'Europe/Athens' } },
    { name: 'Weekly Performance Report', type: 'analysis', status: 'active',
      description: 'Generates comprehensive weekly performance analysis across all platforms',
      configuration: { metrics: ['roas', 'cpa', 'ctr', 'conversions'], recipients: ['demo@stylevault.com'] },
      schedule: { cron: '0 9 * * 1', timezone: 'Europe/Athens' } },
    { name: 'Audience Refresh Pipeline', type: 'automation', status: 'active',
      description: 'Refreshes custom audiences and lookalike segments every 12 hours',
      configuration: { platforms: ['facebook', 'tiktok'], segments: ['purchasers_30d', 'cart_abandoners', 'high_value'] },
      schedule: { cron: '0 */12 * * *' } },
    { name: 'Creative A/B Test Runner', type: 'automation', status: 'inactive',
      description: 'Launches A/B tests for new creatives and pauses losers after 72h',
      configuration: { minImpressions: 1000, significanceLevel: 0.95, autoPause: true },
      schedule: { cron: '0 10 * * 3' } },
  ];
  for (let i = 0; i < workflows.length; i++) {
    const w = workflows[i];
    await prisma.workflow.upsert({
      where: { id: `demo-wf-${i}` },
      create: { id: `demo-wf-${i}`, ...w, organizationId: org.id, lastRunAt: daysAgo(i + 1), nextRunAt: addDays(new Date(), i + 1) },
      update: { name: w.name, status: w.status, configuration: w.configuration },
    });
  }
  console.log(`✓ Workflows: ${workflows.length} created`);

  // 12. Analyses (8)
  const analyses = [
    { type: 'performance', title: 'Q2 Cross-Platform Performance Review',
      data: { period: '2026-Q2', totalSpend: 48250, totalRevenue: 156800, blendedRoas: 3.25 },
      insights: ['Meta ROAS outperformed Google by 18%', 'Weekend spend generates 23% more conversions', 'TikTok CPC is 60% lower than Meta'],
      recommendations: ['Increase TikTok budget by 20%', 'Shift Display budget to Shopping campaigns', 'Test lookalike audiences on Meta'] },
    { type: 'audience', title: 'High-Value Customer Segment Analysis',
      data: { segmentsAnalyzed: 8, topSegment: 'Repeat Purchasers 90d', avgLTV: 385 },
      insights: ['Top 10% of customers drive 45% of revenue', 'Cross-sell opportunity in accessories category', 'Email capture rate is 68% on first purchase'],
      recommendations: ['Create VIP lookalike audience', 'Launch retention campaign for dormant 60d+ customers', 'Add post-purchase upsell flow'] },
    { type: 'competitive', title: 'Fashion Vertical Competitive Landscape',
      data: { competitorsTracked: 6, marketPosition: 'top_quartile', shareOfVoice: 0.28 },
      insights: ['StyleVault CTR is 35% above vertical average', 'Competitor X increased spend by 40% this month', 'Video ads gaining share in fashion vertical'],
      recommendations: ['Invest in short-form video creative', 'Defend brand search terms with increased bids', 'Explore influencer partnerships'] },
    { type: 'trend', title: 'Summer 2026 Fashion Trend Forecast',
      data: { trendsIdentified: 12, confidenceLevel: 0.85, topTrend: 'sustainable_materials' },
      insights: ['Sustainable fashion searches up 45% YoY', 'Mini bags trending in southern Europe', 'Neutral color palettes outperforming bright colors'],
      recommendations: ['Highlight sustainability in ad copy', 'Feature mini bag collection in carousel ads', 'A/B test earth-tone vs. bright creative'] },
    { type: 'performance', title: 'Meta Ads Creative Performance Deep Dive',
      data: { creativesAnalyzed: 34, topFormat: 'carousel', avgThumbStopRate: 0.42 },
      insights: ['Carousel ads have 2.3x higher CTR than single image', 'UGC-style content outperforms studio shots by 38%', 'First 3 seconds critical for video retention'],
      recommendations: ['Convert top static ads to carousel format', 'Increase UGC content production', 'Add hook testing to creative pipeline'] },
    { type: 'audience', title: 'TikTok Audience Behavior Report',
      data: { avgWatchTime: 8.2, engagementRate: 0.067, topDemographic: 'F25-34' },
      insights: ['Spark Ads drive 3x more engagement than in-feed', 'Best posting times: 7-9 PM weekdays', 'Comment sentiment is 82% positive'],
      recommendations: ['Increase Spark Ads budget allocation to 60%', 'Partner with 5 micro-influencers for UGC', 'Test shoppable video format'] },
    { type: 'competitive', title: 'Google Ads Auction Insights',
      data: { impressionShare: 0.72, overlapRate: 0.45, outrankingShare: 0.58 },
      insights: ['Lost 18% impression share due to budget on Shopping', 'Brand terms have 95% impression share', '2 new competitors entered auction this month'],
      recommendations: ['Increase Shopping budget cap by 25%', 'Add negative keywords from competitor analysis', 'Test Performance Max with asset group segmentation'] },
    { type: 'trend', title: 'E-commerce Seasonal Trend Analysis',
      data: { upcomingEvents: ['Back to School', 'Fall Collection Launch'], expectedLift: 0.35 },
      insights: ['September historically shows 35% revenue lift', 'Early holiday shoppers start browsing in October', 'Gift guide content performs well in Nov-Dec'],
      recommendations: ['Prepare back-to-school campaign assets by Aug 15', 'Launch fall collection preview in early September', 'Build holiday gift guide landing page'] },
  ];
  for (let i = 0; i < analyses.length; i++) {
    const a = analyses[i];
    await prisma.analysis.upsert({
      where: { id: `demo-analysis-${i}` },
      create: { id: `demo-analysis-${i}`, ...a, status: 'completed', organizationId: org.id, campaignId: campaignIds[i % campaignIds.length] },
      update: { title: a.title, data: a.data, insights: a.insights, recommendations: a.recommendations },
    });
  }
  console.log(`✓ Analyses: ${analyses.length} created`);

  // 13. Predictions (8)
  const predictions = [
    { type: 'performance', title: 'Next 7-Day ROAS Forecast', confidence: 0.89, accuracy: 0.84,
      data: { predictedRoas: 3.42, currentRoas: 3.18, expectedSpend: 4850, expectedRevenue: 16587 } },
    { type: 'budget', title: 'Optimal Budget Allocation – August', confidence: 0.92, accuracy: 0.87,
      data: { meta: 0.45, google: 0.35, tiktok: 0.20, expectedBlendedRoas: 3.65 } },
    { type: 'audience', title: 'Audience Fatigue Prediction', confidence: 0.78, accuracy: 0.72,
      data: { atRiskSegments: 3, estimatedCtrDecline: 0.15, refreshRecommendedIn: '5 days' } },
    { type: 'trend', title: 'Seasonal Demand Forecast – Fall 2026', confidence: 0.85, accuracy: 0.81,
      data: { expectedDemandLift: 0.32, topCategories: ['bags', 'outerwear', 'accessories'], peakWeek: 'Oct 12-18' } },
    { type: 'performance', title: 'Campaign Performance Trajectory', confidence: 0.91, accuracy: 0.88,
      data: { trending: 'upward', predictedConversions: 1250, confidenceBand: [1100, 1400] } },
    { type: 'budget', title: 'Budget Exhaustion Alert', confidence: 0.94, accuracy: 0.91,
      data: { daysUntilExhaustion: 12, campaignsAtRisk: 3, recommendedAction: 'increase_monthly_budget' } },
    { type: 'audience', title: 'Lookalike Audience Quality Score', confidence: 0.76, accuracy: 0.69,
      data: { bestLookalike: '1%_purchasers', qualityScore: 0.88, estimatedCPA: 12.50 } },
    { type: 'trend', title: 'Creative Trend Prediction', confidence: 0.82, accuracy: 0.78,
      data: { emergingFormats: ['shoppable_video', 'ar_try_on'], decliningFormats: ['static_banner'], pivotRecommended: true } },
  ];
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    await prisma.prediction.upsert({
      where: { id: `demo-pred-${i}` },
      create: { id: `demo-pred-${i}`, ...p, organizationId: org.id, campaignId: campaignIds[i % campaignIds.length] },
      update: { title: p.title, confidence: p.confidence, accuracy: p.accuracy, data: p.data },
    });
  }
  console.log(`✓ Predictions: ${predictions.length} created`);

  // 14. Optimizations (6)
  const optimizations = [
    { type: 'budget', title: 'Reallocate €500 from Display to Shopping', status: 'implemented',
      description: 'Display remarketing ROAS is 1.8x while Shopping is 4.2x — shift budget for better returns',
      recommendations: [{ action: 'decrease_budget', campaign: 'Display – Remarketing', amount: 500 }, { action: 'increase_budget', campaign: 'Shopping – Accessories', amount: 500 }],
      implementation: { executedAt: daysAgo(3), platform: 'google', status: 'success' },
      impact: { predictedRoasLift: 0.45, estimatedMonthlySavings: 380 } },
    { type: 'audience', title: 'Expand Lookalike to 3% for Summer Campaign', status: 'implemented',
      description: 'Current 1% lookalike is saturated — expand to 3% to reach new high-value prospects',
      recommendations: [{ action: 'expand_lookalike', from: '1%', to: '3%', platform: 'facebook' }],
      implementation: { executedAt: daysAgo(5), status: 'success' },
      impact: { estimatedReachIncrease: 0.65, predictedCPAChange: 0.08 } },
    { type: 'creative', title: 'Replace Underperforming Carousel Images', status: 'implemented',
      description: 'Images 3 and 5 in the top carousel have CTR below 0.8% — replace with UGC content',
      recommendations: [{ action: 'replace_images', carousel: 'Summer Collection', positions: [3, 5] }],
      implementation: { executedAt: daysAgo(2), status: 'success' },
      impact: { predictedCtrLift: 0.35, estimatedConversionsLift: 0.12 } },
    { type: 'bidding', title: 'Switch to Target ROAS Bidding on Google', status: 'pending',
      description: 'Current manual CPC is leaving money on the table — tROAS at 3.5x could improve efficiency',
      recommendations: [{ action: 'switch_bidding', campaign: 'Search – Brand Terms', strategy: 'tROAS', target: 3.5 }],
      implementation: {}, impact: { predictedEfficiencyGain: 0.22, riskLevel: 'low' } },
    { type: 'budget', title: 'Increase TikTok Budget by 30% for New Arrivals', status: 'pending',
      description: 'TikTok Spark Ads showing 3.2x ROAS with room to scale before frequency cap',
      recommendations: [{ action: 'increase_budget', campaign: 'Spark Ads – UGC Reviews', amount: 600, pct: 0.30 }],
      implementation: {}, impact: { predictedIncrementalRevenue: 2800, estimatedRoas: 2.9 } },
    { type: 'audience', title: 'Retire Exhausted Cart Abandoner Segment', status: 'rejected',
      description: 'Cart abandoner audience frequency is 8.2x — causing ad fatigue and rising CPA',
      recommendations: [{ action: 'pause_audience', segment: 'cart_abandoners_7d', reason: 'frequency_cap_exceeded' }],
      implementation: { rejectedAt: daysAgo(1), reason: 'Marketing team wants to maintain presence' },
      impact: { estimatedCPASavings: 2.50, reachReduction: 0.15 } },
  ];
  for (let i = 0; i < optimizations.length; i++) {
    const o = optimizations[i];
    await prisma.optimization.upsert({
      where: { id: `demo-opt-${i}` },
      create: { id: `demo-opt-${i}`, ...o, organizationId: org.id, campaignId: campaignIds[i % campaignIds.length] },
      update: { title: o.title, status: o.status, recommendations: o.recommendations, impact: o.impact },
    });
  }
  console.log(`✓ Optimizations: ${optimizations.length} created`);

  // 15. Notifications (12)
  const notifications = [
    { type: 'success', title: 'Campaign Hit ROAS Target', message: 'Summer Collection Retargeting achieved 4.2x ROAS this week — exceeding the 3.5x target.', isRead: false },
    { type: 'alert', title: 'Budget Threshold Warning', message: 'Shopping – Accessories has spent 90% of its monthly budget. Consider increasing the cap.', isRead: false },
    { type: 'info', title: 'New Audience Segment Ready', message: 'High-Value Lookalike 3% audience has been created and is ready to use in campaigns.', isRead: false },
    { type: 'warning', title: 'Creative Performance Declining', message: 'Carousel ad set "Summer Bags" CTR dropped 18% in the last 3 days. Consider refreshing creatives.', isRead: false },
    { type: 'success', title: 'Weekly Report Generated', message: 'Your weekly cross-platform performance report is ready. Blended ROAS: 3.25x.', isRead: true },
    { type: 'info', title: 'TikTok Ads Account Connected', message: 'StyleVault TikTok Ads account was successfully connected and synced.', isRead: true },
    { type: 'success', title: 'AI Optimization Applied', message: 'Budget reallocation from Display to Shopping was executed successfully. Expected ROAS lift: +0.45x.', isRead: true },
    { type: 'alert', title: 'Sync Job Failed', message: 'Google Ads sync failed for campaign "Performance Max". Error: API rate limit exceeded.', isRead: true },
    { type: 'warning', title: 'Ad Account Token Expiring', message: 'Meta Ads access token expires in 14 days. Reauthorize to prevent sync interruptions.', isRead: true },
    { type: 'info', title: 'New Prediction Available', message: 'PredictiveEngine has generated a new 14-day forecast for all active campaigns.', isRead: true },
    { type: 'success', title: '100th Order Milestone', message: 'StyleVault just processed its 100th WooCommerce order this month! Revenue: €12,450.', isRead: true },
    { type: 'info', title: 'Workflow Completed', message: 'Audience Refresh Pipeline completed successfully. 3 segments updated across 2 platforms.', isRead: true },
  ];
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    await prisma.notification.upsert({
      where: { id: `demo-notif-${i}` },
      create: { id: `demo-notif-${i}`, ...n, data: {}, organizationId: org.id },
      update: { title: n.title, message: n.message, isRead: n.isRead },
    });
  }
  console.log(`✓ Notifications: ${notifications.length} created`);

  // 16. SyncJobs (8)
  const syncJobs = [
    { type: 'metrics', platform: 'meta', recordsProcessed: 420 },
    { type: 'metrics', platform: 'google', recordsProcessed: 380 },
    { type: 'metrics', platform: 'tiktok', recordsProcessed: 290 },
    { type: 'orders', platform: 'woocommerce', recordsProcessed: 150 },
    { type: 'products', platform: 'woocommerce', recordsProcessed: 25 },
    { type: 'metrics', platform: 'meta', recordsProcessed: 410 },
    { type: 'metrics', platform: 'google', recordsProcessed: 365 },
    { type: 'orders', platform: 'woocommerce', recordsProcessed: 48 },
  ];
  for (let i = 0; i < syncJobs.length; i++) {
    const s = syncJobs[i];
    const startedAt = addDays(daysAgo(Math.floor(i / 2) + 1), 0);
    startedAt.setHours(2 + i * 3);
    const completedAt = new Date(startedAt.getTime() + (30 + i * 15) * 1000);
    await prisma.syncJob.create({
      data: {
        adAccountId: adAccountMap.get(s.platform) ?? adAccountMap.get('woocommerce'),
        brandId: brand.id, type: s.type, platform: s.platform,
        status: 'completed', startedAt, completedAt,
        recordsProcessed: s.recordsProcessed,
      },
    });
  }
  console.log(`✓ SyncJobs: ${syncJobs.length} created`);

  // 17. APIIntegrations (3)
  const integrations = [
    { platform: 'facebook', name: 'Meta Ads API', credentials: { appId: 'demo-app-id', adAccountId: 'act_demo_meta_001' }, settings: { syncIntervalHours: 6, fields: ['insights', 'campaigns', 'adsets'] } },
    { platform: 'google', name: 'Google Ads API', credentials: { customerId: '123-456-7890', developerToken: 'demo-dev-token' }, settings: { syncIntervalHours: 6, includeMCC: false } },
    { platform: 'tiktok', name: 'TikTok Marketing API', credentials: { advertiserId: 'demo-tiktok-001' }, settings: { syncIntervalHours: 12, includeCreative: true } },
  ];
  for (let i = 0; i < integrations.length; i++) {
    const ig = integrations[i];
    await prisma.aPIIntegration.upsert({
      where: { id: `demo-integ-${i}` },
      create: { id: `demo-integ-${i}`, ...ig, status: 'active', lastSyncAt: daysAgo(0), organizationId: org.id },
      update: { name: ig.name, status: 'active', credentials: ig.credentials, settings: ig.settings, lastSyncAt: daysAgo(0) },
    });
  }
  console.log(`✓ APIIntegrations: ${integrations.length} created`);

  // ── Summary ──
  console.log('\n🎉 Demo Organization seed completed successfully!');
  console.log('📊 Summary:');
  console.log(`   Organization: ${org.name} (${org.slug})`);
  console.log(`   Brand:        ${BRAND_NAME}`);
  console.log(`   AdAccounts:   ${AD_ACCOUNT_DEFS.length}`);
  console.log(`   Campaigns:    ${CAMPAIGNS.length}`);
  console.log(`   DailyMetrics: ${totalMetricsInserted} rows`);
  console.log(`   WooOrders:    ${orderResult.count}`);
  console.log(`   WooProducts:  ${prodResult.count}`);
  console.log(`   AIAgents:     ${agents.length}`);
  console.log(`   Workflows:    ${workflows.length}`);
  console.log(`   Analyses:     ${analyses.length}`);
  console.log(`   Predictions:  ${predictions.length}`);
  console.log(`   Optimizations:${optimizations.length}`);
  console.log(`   Notifications:${notifications.length}`);
  console.log(`   SyncJobs:     ${syncJobs.length}`);
  console.log(`   Integrations: ${integrations.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during Demo seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
