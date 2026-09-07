import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

/**
 * BAGTOBAG Brand Seed Script
 *
 * Idempotently provisions the BAGTOBAG organization, a Supabase-linked user,
 * a single brand, and four ad accounts (Meta, Google, TikTok, WooCommerce).
 *
 * Env vars (set in .env.local or pass inline):
 *   SEED_USER_ID    — MUST match the Supabase auth user's ID (becomes User.id)
 *   SEED_USER_EMAIL — the user's email in Supabase (becomes User.email)
 *
 * Usage:
 *   npm run seed:bagtobag
 *   # or inline:
 *   SEED_USER_ID=abc SEED_USER_EMAIL=a@b.com npm run seed:bagtobag
 *
 * All operations use `upsert` so the script is safe to re-run.
 * Ad account tokens are left null — they are populated by the OAuth callback
 * after platform authorization.
 */

// Load .env.local (Next.js convention) so SEED_USER_ID / SEED_USER_EMAIL
// can be defined there. Prisma already loads DATABASE_URL from .env.
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

const SEED_USER_ID = process.env.SEED_USER_ID;
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL;

// Brand constants
const BRAND_NAME = 'BAGTOBAG';
const BRAND_SLUG = 'bagtobag';

// Ad account definitions: platform + display name.
// `accountId` is a deterministic placeholder that satisfies the required,
// unique field until OAuth returns the real platform account ID.
type AdAccountDef = {
  platform: string;
  name: string;
};

const AD_ACCOUNTS: AdAccountDef[] = [
  { platform: 'meta', name: 'BAGTOBAG Meta Ads' },
  { platform: 'google', name: 'BAGTOBAG Google Ads' },
  { platform: 'tiktok', name: 'BAGTOBAG TikTok Ads' },
  { platform: 'woocommerce', name: 'BAGTOBAG WooCommerce' },
];

function placeholderAccountId(platform: string): string {
  return `${BRAND_SLUG}-${platform}-placeholder`;
}

async function main() {
  // --- Validate required env vars -----------------------------------------
  if (!SEED_USER_ID) {
    throw new Error(
      'SEED_USER_ID env var is required — it must match the Supabase auth user ID. ' +
        'Set it in .env.local or pass it inline, e.g. ' +
        'SEED_USER_ID=xxx npm run seed:bagtobag',
    );
  }
  if (!SEED_USER_EMAIL) {
    throw new Error(
      'SEED_USER_EMAIL env var is required — it must match the Supabase auth user email. ' +
        'Set it in .env.local or pass it inline, e.g. ' +
        'SEED_USER_EMAIL=yyy npm run seed:bagtobag',
    );
  }

  console.log('🛍️  Starting BAGTOBAG brand seed...');
  console.log(`   User ID:    ${SEED_USER_ID}`);
  console.log(`   User email: ${SEED_USER_EMAIL}`);
  console.log('');

  // --- 1. Organization ----------------------------------------------------
  console.log('🏢 Upserting organization "BAGTOBAG"...');
  const organization = await prisma.organization.upsert({
    where: { slug: BRAND_SLUG },
    create: {
      name: BRAND_NAME,
      slug: BRAND_SLUG,
      plan: 'enterprise',
      settings: {
        timezone: 'Europe/Athens',
        currency: 'EUR',
        language: 'en',
      },
    },
    update: {
      name: BRAND_NAME,
      plan: 'enterprise',
    },
  });
  console.log(
    `   ✓ Organization: ${organization.name} (slug: ${organization.slug}) — id: ${organization.id}`,
  );

  // --- 2. User (linked to Organization, id == Supabase user id) -----------
  console.log('👤 Upserting user linked to organization...');
  const user = await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    create: {
      id: SEED_USER_ID,
      email: SEED_USER_EMAIL,
      fullName: 'BAGTOBAG Admin',
      role: 'admin',
      isActive: true,
      organizationId: organization.id,
    },
    update: {
      email: SEED_USER_EMAIL,
      fullName: 'BAGTOBAG Admin',
      role: 'admin',
      isActive: true,
      organizationId: organization.id,
    },
  });
  console.log(`   ✓ User: ${user.email} — id: ${user.id} (role: ${user.role})`);

  // --- 2b. OrganizationMembership (owner) -------------------------------
  // Link the user to the organization as an owner + default membership.
  // This is required by organizationProcedure, which resolves the active
  // org via OrganizationMembership (cookie) before falling back to
  // user.organizationId.
  console.log('🔗 Upserting organization membership (owner)...');
  const membership = await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: SEED_USER_ID,
        organizationId: organization.id,
      },
    },
    create: {
      userId: SEED_USER_ID,
      organizationId: organization.id,
      role: 'owner',
      isDefault: true,
    },
    update: {
      role: 'owner',
      isDefault: true,
    },
  });
  console.log(
    `   ✓ Membership: role=${membership.role} isDefault=${membership.isDefault} (org: ${organization.slug})`,
  );

  // --- 3. Brand -----------------------------------------------------------
  console.log('🏷️  Upserting brand "BAGTOBAG"...');
  const brand = await prisma.brand.upsert({
    where: {
      organizationId_slug: { organizationId: organization.id, slug: BRAND_SLUG },
    },
    create: {
      name: BRAND_NAME,
      slug: BRAND_SLUG,
      organizationId: organization.id,
      website: "https://bagtobag.com.gr/",
    },
    update: {
      name: BRAND_NAME,
      website: "https://bagtobag.com.gr/",
    },
  });
  console.log(
    `   ✓ Brand: ${brand.name} (slug: ${brand.slug}) — id: ${brand.id}`,
  );

  // --- 4. Ad Accounts (Meta, Google, TikTok, WooCommerce) -----------------
  console.log('📊 Upserting ad accounts...');
  const createdAccounts = [];
  for (const def of AD_ACCOUNTS) {
    const accountId = placeholderAccountId(def.platform);
    const account = await prisma.adAccount.upsert({
      where: {
        platform_accountId: { platform: def.platform, accountId },
      },
      create: {
        brandId: brand.id,
        platform: def.platform,
        accountId,
        name: def.name,
        currency: 'EUR',
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        isActive: true,
      },
      update: {
        brandId: brand.id,
        name: def.name,
        // NOTE: tokens intentionally NOT touched on update — OAuth callback
        // owns accessToken / refreshToken / tokenExpiry once authorized.
      },
    });
    createdAccounts.push(account);
    console.log(
      `   ✓ AdAccount: ${account.platform.padEnd(11)} — "${account.name}" (accountId: ${account.accountId}) — id: ${account.id}`,
    );
  }

  // --- Summary ------------------------------------------------------------
  console.log('');
  console.log('🎉 BAGTOBAG seed completed successfully!');
  console.log('📊 Summary:');
  console.log(`   🏢 Organization: ${organization.name} (slug: ${organization.slug})`);
  console.log(`   👤 User:         ${user.email} (id: ${user.id})`);
  console.log(`   🔗 Membership:  owner / isDefault=true`);
  console.log(`   🏷️  Brand:        ${brand.name} (slug: ${brand.slug})`);
  console.log(`   📊 AdAccounts:   ${createdAccounts.length}`);
  for (const a of createdAccounts) {
    console.log(`        • ${a.platform.padEnd(11)} — ${a.name}`);
  }
  console.log('');
  console.log('ℹ️  Ad account tokens (accessToken / refreshToken / tokenExpiry) are null.');
  console.log('   They will be populated by the OAuth callback after platform authorization.');
  console.log('   The accountId field is a placeholder; update it to the real platform');
  console.log('   account ID once OAuth returns it.');
}

main()
  .catch((e) => {
    console.error('❌ Error during BAGTOBAG seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
