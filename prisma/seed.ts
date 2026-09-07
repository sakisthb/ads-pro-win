import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

/**
 * Demo — Primary Seed Script
 *
 * Provisions a complete "Demo" organization with realistic,
 * investor-ready demo data across every Prisma model.
 *
 * Idempotent: all structural records use upsert (re-runnable safely);
 * bulk inserts use createMany + skipDuplicates.
 *
 * Usage:  npx prisma db seed   (or)   npm run db:seed
 * Env:    DATABASE_URL / DIRECT_DATABASE_URL (.env.local or .env)
 */

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

// ── Stable IDs (valid UUIDv4-shaped) for idempotent upserts ──────────────────
const ADMIN_USER_ID = '7f3a2b1c-4d5e-4f6a-8b7c-9d0e1f2a3b4c';
const MEMBER_USER_ID = '8e4b3c2d-5e6f-4a7b-9c8d-0e1f2a3b4c5d';

// ── Constants ───────────────────────────────────────────────────────────────
const ORG_NAME = 'Demo';
const ORG_SLUG = 'demo';
const BRAND_NAME = 'SACOS';
const BRAND_SLUG = 'sacos';

type AdAccountDef = { platform: string; accountId: string; name: string };

const AD_ACCOUNTS: AdAccountDef[] = [
  { platform: 'meta', accountId: 'act_sacos_meta_2024', name: 'SACOS Meta Ads' },
  { platform: 'google', accountId: 'sacos-google-2024', name: 'SACOS Google Ads' },
  { platform: 'tiktok', accountId: 'sacos-tiktok-2024', name: 'SACOS TikTok Ads' },
];

type CampaignDef = {
  id: string;
  name: string;
  platform: string;       // campaign.platform: facebook | google | tiktok
  adAccount: string;      // which AD_ACCOUNTS.platform it belongs to
  status: string;
  budget: number;
  spentPct: number;
  description: string;
};

const CAMPAIGNS: CampaignDef[] = [
  { id: 'sacos-camp-0', name: 'Summer Sale 2024 - Conversions', platform: 'facebook', adAccount: 'meta', status: 'active', budget: 3500, spentPct: 0.68, description: 'Conversion-optimized Meta campaign for the Summer 2024 sale across GR/CY/IT markets.' },
  { id: 'sacos-camp-1', name: 'Brand Awareness - SACOS Premium', platform: 'facebook', adAccount: 'meta', status: 'active', budget: 2000, spentPct: 0.54, description: 'Top-of-funnel awareness campaign for the SACOS premium line with video creative.' },
  { id: 'sacos-camp-2', name: 'Retargeting - Cart Abandoners', platform: 'facebook', adAccount: 'meta', status: 'active', budget: 1200, spentPct: 0.73, description: 'Dynamic product retargeting for 7-day cart abandoners with time-sensitive offers.' },
  { id: 'sacos-camp-3', name: 'Search - Brand Terms', platform: 'google', adAccount: 'google', status: 'active', budget: 1800, spentPct: 0.61, description: 'Google Search defending the SACOS brand query with sitelink extensions.' },
  { id: 'sacos-camp-4', name: 'Shopping - Full Catalog', platform: 'google', adAccount: 'google', status: 'active', budget: 4200, spentPct: 0.79, description: 'Google Shopping feed campaign for the full SACOS product catalog (Performance Max).' },
  { id: 'sacos-camp-5', name: 'Spark Ads - UGC Collection', platform: 'tiktok', adAccount: 'tiktok', status: 'active', budget: 1500, spentPct: 0.65, description: 'TikTok Spark Ads promoting user-generated content for the Fall collection launch.' },
  { id: 'sacos-camp-6', name: 'In-Feed - New Arrivals Fall', platform: 'tiktok', adAccount: 'tiktok', status: 'paused', budget: 900, spentPct: 0.22, description: 'In-feed TikTok campaign for Fall arrivals — paused pending creative refresh.' },
];

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

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Demo seed...\n');

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      plan: 'enterprise',
      settings: { timezone: 'Europe/Athens', currency: 'EUR', language: 'en' },
    },
    update: { name: ORG_NAME, plan: 'enterprise' },
  });
  console.log(`✓ Organization: ${org.name} (id: ${org.id})`);

  // 2. Users (admin + member) — using generated UUIDs, NOT the .env.local placeholder
  const adminUser = await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    create: {
      id: ADMIN_USER_ID,
      email: 'nikolai@sacos-marketing.com',
      fullName: 'Nikolai Vassilakis',
      role: 'admin',
      isActive: true,
      lastLoginAt: new Date(),
      organizationId: org.id,
    },
    update: {
      email: 'nikolai@sacos-marketing.com',
      fullName: 'Nikolai Vassilakis',
      role: 'admin',
      isActive: true,
      organizationId: org.id,
    },
  });
  console.log(`✓ Admin user: ${adminUser.fullName} (${adminUser.email})`);

  const memberUser = await prisma.user.upsert({
    where: { id: MEMBER_USER_ID },
    create: {
      id: MEMBER_USER_ID,
      email: 'elena@sacos-marketing.com',
      fullName: 'Elena Papadopoulos',
      role: 'manager',
      isActive: true,
      lastLoginAt: daysAgo(1),
      organizationId: org.id,
    },
    update: {
      email: 'elena@sacos-marketing.com',
      fullName: 'Elena Papadopoulos',
      role: 'manager',
      isActive: true,
      organizationId: org.id,
    },
  });
  console.log(`✓ Member user: ${memberUser.fullName} (${memberUser.email})`);

  // 2b. OrganizationMemberships (admin=owner, member=member)
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: ADMIN_USER_ID, organizationId: org.id } },
    create: { userId: ADMIN_USER_ID, organizationId: org.id, role: 'owner', isDefault: true },
    update: { role: 'owner', isDefault: true },
  });
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: MEMBER_USER_ID, organizationId: org.id } },
    create: { userId: MEMBER_USER_ID, organizationId: org.id, role: 'member', isDefault: true },
    update: { role: 'member', isDefault: true },
  });
  console.log(`✓ Memberships: owner + member linked`);

  // 3. Brand
  const brand = await prisma.brand.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: BRAND_SLUG } },
    create: { name: BRAND_NAME, slug: BRAND_SLUG, organizationId: org.id, website: 'https://sacos-marketing.com' },
    update: { name: BRAND_NAME, website: 'https://sacos-marketing.com' },
  });
  console.log(`✓ Brand: ${brand.name} (id: ${brand.id})`);

  // 4. Ad Accounts (Meta, Google, TikTok)
  const adAccountMap = new Map<string, string>(); // platform -> adAccountId (PK)
  for (const def of AD_ACCOUNTS) {
    const acct = await prisma.adAccount.upsert({
      where: { platform_accountId: { platform: def.platform, accountId: def.accountId } },
      create: {
        brandId: brand.id,
        platform: def.platform,
        accountId: def.accountId,
        name: def.name,
        currency: 'EUR',
        accessToken: 'demo-encrypted-token',
        tokenExpiry: new Date('2030-01-01'),
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: { brandId: brand.id, name: def.name, isActive: true, lastSyncAt: new Date() },
    });
    adAccountMap.set(def.platform, acct.id);
  }
  console.log(`✓ AdAccounts: ${AD_ACCOUNTS.length} created (Meta, Google, TikTok)`);

  // 5. Campaigns (7)
  const campaignIds: string[] = [];
  for (const c of CAMPAIGNS) {
    const spent = round2(c.budget * c.spentPct);
    const startDate = c.status === 'completed' ? daysAgo(75) : daysAgo(28);
    const endDate = c.status === 'completed' ? daysAgo(4) : (c.status === 'draft' ? null : addDays(new Date(), 45));
    const perfRoas = round2(2.2 + seededRandom(c.name.length * 7) * 2.3);
    const perfCtr = round2(1.1 + seededRandom(c.name.length * 13) * 2.4);
    await prisma.campaign.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        description: c.description,
        platform: c.platform,
        status: c.status,
        budget: c.budget,
        budgetSpent: spent,
        startDate,
        endDate,
        targetAudience: {
          ageRange: '25-45',
          gender: 'all',
          interests: ['premium fashion', 'luxury accessories', 'lifestyle'],
          locations: ['Greece', 'Cyprus', 'Italy'],
        },
        adCreatives: [{ format: 'single_image', status: 'active' }, { format: 'carousel', status: 'active' }],
        performance: { roas: perfRoas, ctr: perfCtr, cpa: round2(spent / (perfCtr * 10)) },
        settings: { bidding: 'auto', optimizationGoal: 'conversions' },
        organizationId: org.id,
        userId: ADMIN_USER_ID,
      },
      update: {
        name: c.name,
        status: c.status,
        budget: c.budget,
        budgetSpent: spent,
        description: c.description,
      },
    });
    campaignIds.push(c.id);
  }
  console.log(`✓ Campaigns: ${CAMPAIGNS.length} created`);

  // 6. DailyMetrics — 30 days × 7 campaigns = 210 rows
  console.log('⏳ Generating DailyMetrics (30 days × 7 campaigns)...');
  type MetricRow = {
    date: Date;
    platform: string;
    adAccountId: string;
    campaignId: string;
    campaignName: string;
    adGroupId: null;
    adId: null;
    currency: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    cpc: number;
    cpm: number;
    ctr: number;
    roas: number;
  };

  const metrics: MetricRow[] = [];
  const platformSpendBase: Record<string, number> = { facebook: 9, google: 6, tiktok: 5 };
  const platformCpmBase: Record<string, number> = { facebook: 6.5, google: 5.0, tiktok: 3.0 };
  const platformCtrBase: Record<string, number> = { facebook: 0.022, google: 0.035, tiktok: 0.014 };
  const platformConvBase: Record<string, number> = { facebook: 6, google: 4, tiktok: 3 };

  for (let day = 1; day <= 30; day++) {
    const date = daysAgo(day);
    const dow = date.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.22 : 1.0;
    const trend = 1 + 0.08 * Math.sin((day / 30) * Math.PI * 2);

    for (let ci = 0; ci < CAMPAIGNS.length; ci++) {
      const c = CAMPAIGNS[ci];
      const seed = day * 100 + ci * 7;
      const r = (o: number) => seededRandom(seed + o);

      if (c.status === 'draft' || c.status === 'paused') {
        // Draft/paused campaigns contribute no spend
        continue;
      }

      const p = c.platform; // facebook | google | tiktok
      const baseSpend = platformSpendBase[p] + r(1) * 14;
      const spend = round2(baseSpend * weekendBoost * trend);
      const cpm = round2(platformCpmBase[p] + r(2) * 3);
      const ctrVal = platformCtrBase[p] + r(3) * 0.012;
      const impressions = Math.max(100, Math.round((spend * 1000) / cpm));
      const clicks = Math.max(1, Math.round(impressions * ctrVal));
      const cpc = round2(spend / clicks);
      const conversions = Math.max(0, Math.round(platformConvBase[p] + r(4) * 9));
      const aov = 48 + r(5) * 42; // €48–90 AOV
      const conversionValue = round2(conversions * aov);
      const roas = spend > 0 ? round2(conversionValue / spend) : 0;

      metrics.push({
        date,
        platform: p === 'facebook' ? 'meta' : p, // DailyMetric.platform uses 'meta' for Facebook
        adAccountId: adAccountMap.get(c.adAccount)!,
        campaignId: c.id,
        campaignName: c.name,
        adGroupId: null,
        adId: null,
        currency: 'EUR',
        spend,
        impressions,
        clicks,
        conversions,
        conversionValue,
        cpc,
        cpm,
        ctr: round2(ctrVal * 100),
        roas,
      });
    }
  }

  const batchSize = 200;
  let totalMetrics = 0;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    const result = await prisma.dailyMetric.createMany({ data: batch, skipDuplicates: true });
    totalMetrics += result.count;
  }
  console.log(`✓ DailyMetrics: ${totalMetrics} rows inserted`);

  // 7. Predictions (4 AI insights)
  const predictions = [
    {
      type: 'performance',
      title: '7-Day ROAS Forecast — Blended',
      description: 'Predicted blended ROAS for all active campaigns over the next 7 days based on 30-day spend velocity and conversion trends.',
      confidence: 0.89,
      accuracy: 0.84,
      data: { predictedRoas: 3.42, currentRoas: 3.18, expectedSpend: 4250, expectedRevenue: 14535, trend: 'upward' },
    },
    {
      type: 'budget',
      title: 'Optimal Budget Allocation — September',
      description: 'Recommended platform budget split to maximize blended ROAS given current saturation curves.',
      confidence: 0.92,
      accuracy: 0.87,
      data: { meta: 0.42, google: 0.38, tiktok: 0.20, expectedBlendedRoas: 3.65, rationale: 'tiktok_scaling_headroom' },
    },
    {
      type: 'audience',
      title: 'Audience Fatigue Warning — Meta Retargeting',
      description: 'Cart Abandoner audience frequency is 6.8x; CTR decline projected within 5 days if creative is not refreshed.',
      confidence: 0.78,
      accuracy: 0.72,
      data: { atRiskSegments: 1, frequency: 6.8, estimatedCtrDecline: 0.18, refreshRecommendedIn: '5 days' },
    },
    {
      type: 'trend',
      title: 'Fall 2024 Demand Forecast',
      description: 'Seasonal demand lift expected across premium accessories as temperatures drop in target markets.',
      confidence: 0.85,
      accuracy: 0.81,
      data: { expectedDemandLift: 0.28, topCategories: ['outerwear', 'leather goods', 'boots'], peakWeek: 'Oct 14-20' },
    },
  ];
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    await prisma.prediction.upsert({
      where: { id: `sacos-pred-${i}` },
      create: {
        id: `sacos-pred-${i}`,
        type: p.type,
        title: p.title,
        description: p.description,
        data: p.data,
        confidence: p.confidence,
        accuracy: p.accuracy,
        organizationId: org.id,
        campaignId: campaignIds[i % campaignIds.length],
      },
      update: { title: p.title, description: p.description, confidence: p.confidence, accuracy: p.accuracy, data: p.data },
    });
  }
  console.log(`✓ Predictions: ${predictions.length} created`);

  // 8. Notifications (6)
  const notifications = [
    { type: 'success', title: 'Campaign Hit ROAS Target', message: '"Summer Sale 2024 - Conversions" achieved 4.1x ROAS this week — exceeding the 3.5x target.', isRead: false },
    { type: 'alert', title: 'Budget Threshold Warning', message: '"Shopping - Full Catalog" has spent 79% of its monthly budget. Consider increasing the cap.', isRead: false },
    { type: 'info', title: 'New Prediction Available', message: 'A new 7-day ROAS forecast is available for all active campaigns. Predicted blended ROAS: 3.42x.', isRead: false },
    { type: 'warning', title: 'Creative Performance Declining', message: 'Retargeting - Cart Abandoners CTR dropped 18% in the last 3 days. Creative refresh recommended.', isRead: false },
    { type: 'success', title: 'Weekly Report Generated', message: 'Your weekly cross-platform performance report is ready. Blended ROAS: 3.18x, Spend: €4,820.', isRead: true },
    { type: 'info', title: 'Sync Completed', message: 'Google Ads metrics sync completed successfully. 30 days of data refreshed.', isRead: true },
  ];
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    await prisma.notification.upsert({
      where: { id: `sacos-notif-${i}` },
      create: { id: `sacos-notif-${i}`, type: n.type, title: n.title, message: n.message, isRead: n.isRead, data: {}, organizationId: org.id },
      update: { title: n.title, message: n.message, isRead: n.isRead },
    });
  }
  console.log(`✓ Notifications: ${notifications.length} created`);

  // 9. Workflows (2)
  const workflows = [
    {
      name: 'Daily Budget Rebalancer',
      type: 'optimization',
      status: 'active',
      description: 'Automatically shifts budget from underperforming to top campaigns daily at 6 AM (Europe/Athens).',
      configuration: { trigger: 'schedule', timeOfDay: '06:00', minRoasThreshold: 2.0, maxShiftPct: 0.15 },
      schedule: { cron: '0 6 * * *', timezone: 'Europe/Athens' },
    },
    {
      name: 'Weekly Performance Report',
      type: 'analysis',
      status: 'active',
      description: 'Generates a comprehensive weekly cross-platform performance analysis every Monday at 9 AM.',
      configuration: { metrics: ['roas', 'cpa', 'ctr', 'conversions'], recipients: ['nikolai@sacos-marketing.com'] },
      schedule: { cron: '0 9 * * 1', timezone: 'Europe/Athens' },
    },
  ];
  for (let i = 0; i < workflows.length; i++) {
    const w = workflows[i];
    await prisma.workflow.upsert({
      where: { id: `sacos-wf-${i}` },
      create: {
        id: `sacos-wf-${i}`,
        name: w.name,
        type: w.type,
        status: w.status,
        description: w.description,
        configuration: w.configuration,
        schedule: w.schedule,
        lastRunAt: daysAgo(i + 1),
        nextRunAt: addDays(new Date(), i + 1),
        organizationId: org.id,
      },
      update: { name: w.name, status: w.status, description: w.description, configuration: w.configuration },
    });
  }
  console.log(`✓ Workflows: ${workflows.length} created`);

  // 10. WooCommerce Orders (4)
  const wooOrders = [
    {
      orderId: 2001,
      orderNumber: 'SACOS-2001',
      status: 'completed',
      dateCreated: daysAgo(2),
      grossSales: 248.0,
      discounts: 24.8,
      refunds: 0,
      netSales: 223.2,
      shipping: 5.9,
      tax: 53.57,
      costOfGoods: 86.8,
      grossProfit: 136.4,
      isNewCustomer: true,
      customerEmail: 'maria.k@example.com',
      source: 'facebook',
      medium: 'cpc',
      campaign: 'summer_sale_2024',
    },
    {
      orderId: 2002,
      orderNumber: 'SACOS-2002',
      status: 'completed',
      dateCreated: daysAgo(5),
      grossSales: 379.0,
      discounts: 0,
      refunds: 0,
      netSales: 379.0,
      shipping: 0,
      tax: 90.96,
      costOfGoods: 151.6,
      grossProfit: 227.4,
      isNewCustomer: false,
      customerEmail: 'george.p@example.com',
      source: 'google',
      medium: 'cpc',
      campaign: 'shopping_full_catalog',
    },
    {
      orderId: 2003,
      orderNumber: 'SACOS-2003',
      status: 'processing',
      dateCreated: daysAgo(1),
      grossSales: 156.0,
      discounts: 15.6,
      refunds: 0,
      netSales: 140.4,
      shipping: 4.9,
      tax: 33.7,
      costOfGoods: 54.6,
      grossProfit: 85.8,
      isNewCustomer: true,
      customerEmail: 'sofia.l@example.com',
      source: 'tiktok',
      medium: 'cpc',
      campaign: 'spark_ads_ugc',
    },
    {
      orderId: 2004,
      orderNumber: 'SACOS-2004',
      status: 'refunded',
      dateCreated: daysAgo(8),
      grossSales: 92.0,
      discounts: 0,
      refunds: 73.6,
      netSales: 18.4,
      shipping: 4.9,
      tax: 4.42,
      costOfGoods: 32.2,
      grossProfit: -13.8,
      isNewCustomer: true,
      customerEmail: 'nikos.d@example.com',
      source: 'facebook',
      medium: 'cpc',
      campaign: 'retargeting_cart_abandoners',
    },
  ];
  for (const o of wooOrders) {
    await prisma.wooOrder.upsert({
      where: { brandId_orderId: { brandId: brand.id, orderId: o.orderId } },
      create: { brandId: brand.id, ...o },
      update: { status: o.status, grossSales: o.grossSales, netSales: o.netSales, grossProfit: o.grossProfit },
    });
  }
  console.log(`✓ WooOrders: ${wooOrders.length} created`);

  // 11. WooCommerce Products (4)
  const wooProducts = [
    { productId: 3001, sku: 'SAC-LCB-01', name: 'Premium Leather Crossbody Bag', price: 129.0, costOfGoods: 52.0, stockQty: 42, stockStatus: 'instock', isAdvertised: true },
    { productId: 3002, sku: 'SAC-CWT-02', name: 'Cashmere Blend Scarf', price: 79.0, costOfGoods: 28.0, stockQty: 65, stockStatus: 'instock', isAdvertised: true },
    { productId: 3003, sku: 'SAC-MWG-03', name: 'Minimalist Gold Watch', price: 189.0, costOfGoods: 75.0, stockQty: 12, stockStatus: 'instock', isAdvertised: true },
    { productId: 3004, sku: 'SAC-SAB-04', name: 'Suede Ankle Boots', price: 159.0, costOfGoods: 64.0, stockQty: 0, stockStatus: 'outofstock', isAdvertised: false },
  ];
  for (const p of wooProducts) {
    await prisma.wooProduct.upsert({
      where: { brandId_productId: { brandId: brand.id, productId: p.productId } },
      create: { brandId: brand.id, ...p, lastSyncAt: new Date() },
      update: { name: p.name, price: p.price, stockQty: p.stockQty, stockStatus: p.stockStatus, isAdvertised: p.isAdvertised, lastSyncAt: new Date() },
    });
  }
  console.log(`✓ WooProducts: ${wooProducts.length} created`);

  // 12. Sync Jobs (3)
  const syncJobs = [
    { type: 'metrics', platform: 'meta', recordsProcessed: 210, adAccountKey: 'meta' },
    { type: 'metrics', platform: 'google', recordsProcessed: 210, adAccountKey: 'google' },
    { type: 'metrics', platform: 'tiktok', recordsProcessed: 180, adAccountKey: 'tiktok' },
  ];
  for (let i = 0; i < syncJobs.length; i++) {
    const s = syncJobs[i];
    const startedAt = daysAgo(i + 1);
    startedAt.setHours(2 + i * 3, 15);
    const completedAt = new Date(startedAt.getTime() + (45 + i * 20) * 1000);
    await prisma.syncJob.create({
      data: {
        adAccountId: adAccountMap.get(s.adAccountKey)!,
        brandId: brand.id,
        type: s.type,
        platform: s.platform,
        status: 'completed',
        startedAt,
        completedAt,
        recordsProcessed: s.recordsProcessed,
      },
    }).catch(() => { /* sync jobs have no unique constraint; ignore re-run dupes silently */ });
  }
  console.log(`✓ SyncJobs: ${syncJobs.length} created`);

  // ── Summary ──
  console.log(`\n🎉 Demo seed completed successfully!`);
  console.log('📊 Summary:');
  console.log(`   Organization:   ${org.name} (${org.slug})`);
  console.log(`   Users:          2 (admin + member)`);
  console.log(`   Brand:          ${BRAND_NAME}`);
  console.log(`   AdAccounts:     ${AD_ACCOUNTS.length}`);
  console.log(`   Campaigns:      ${CAMPAIGNS.length}`);
  console.log(`   DailyMetrics:   ${totalMetrics} rows`);
  console.log(`   Predictions:    ${predictions.length}`);
  console.log(`   Notifications:  ${notifications.length}`);
  console.log(`   Workflows:      ${workflows.length}`);
  console.log(`   WooOrders:      ${wooOrders.length}`);
  console.log(`   WooProducts:    ${wooProducts.length}`);
  console.log(`   SyncJobs:       ${syncJobs.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during SACOS Marketing seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
