-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "platform" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetAudience" JSONB NOT NULL DEFAULT '{}',
    "adCreatives" JSONB NOT NULL DEFAULT '[]',
    "performance" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "performance" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "schedule" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "insights" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimizations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "implementation" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "impact" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "optimizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_integrations" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "api_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "marketMode" TEXT NOT NULL DEFAULT 'inherit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "platform" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adGroupId" TEXT,
    "adId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "spend" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "frequency" DECIMAL(10,4),
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "landingPageViews" INTEGER NOT NULL DEFAULT 0,
    "addToCart" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "checkouts" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "websitePurchases" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "websitePurchaseValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "results" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resultType" TEXT,
    "attributionSetting" TEXT,
    "cpc" DECIMAL(10,4),
    "cpm" DECIMAL(10,4),
    "ctr" DECIMAL(10,4),
    "roas" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "effectiveStatus" TEXT,
    "objective" TEXT,
    "dailyBudget" DECIMAL(12,4),
    "lifetimeBudget" DECIMAL(12,4),
    "budgetType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "attributionSetting" TEXT,
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "createdTime" TIMESTAMP(3),
    "updatedTime" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WooOrder" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dateCreated" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "grossSales" DECIMAL(12,4) NOT NULL,
    "discounts" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(12,4) NOT NULL,
    "shipping" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "costOfGoods" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "isNewCustomer" BOOLEAN NOT NULL DEFAULT false,
    "customerEmail" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "market" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WooOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WooProduct" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,4) NOT NULL,
    "costOfGoods" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "stockStatus" TEXT NOT NULL DEFAULT 'instock',
    "isAdvertised" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "soldQty" INTEGER NOT NULL DEFAULT 0,
    "soldNet" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WooProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT,
    "brandId" TEXT,
    "type" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaWriteLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "adAccountId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "learningRisk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaWriteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT,
    "platform" TEXT,
    "thresholdAmount" DECIMAL(12,4) NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'daily',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "tokenDigest" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_transactions" (
    "id" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandId" TEXT,
    "returnPath" TEXT NOT NULL DEFAULT '/connections',
    "pkceCodeVerifier" TEXT,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websocket_tickets" (
    "id" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channels" TEXT[],
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websocket_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "description" TEXT NOT NULL,
    "currentValue" TEXT,
    "proposedValue" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executionResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_createdAt_idx" ON "organizations"("createdAt");

-- CreateIndex
CREATE INDEX "organizations_plan_idx" ON "organizations"("plan");

-- CreateIndex
CREATE INDEX "organization_memberships_userId_idx" ON "organization_memberships"("userId");

-- CreateIndex
CREATE INDEX "organization_memberships_organizationId_idx" ON "organization_memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_userId_organizationId_key" ON "organization_memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

-- CreateIndex
CREATE INDEX "campaigns_organizationId_idx" ON "campaigns"("organizationId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_platform_idx" ON "campaigns"("platform");

-- CreateIndex
CREATE INDEX "campaigns_startDate_idx" ON "campaigns"("startDate");

-- CreateIndex
CREATE INDEX "campaigns_endDate_idx" ON "campaigns"("endDate");

-- CreateIndex
CREATE INDEX "campaigns_createdAt_idx" ON "campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "campaigns_budget_idx" ON "campaigns"("budget");

-- CreateIndex
CREATE INDEX "campaigns_organizationId_status_idx" ON "campaigns"("organizationId", "status");

-- CreateIndex
CREATE INDEX "campaigns_organizationId_platform_idx" ON "campaigns"("organizationId", "platform");

-- CreateIndex
CREATE INDEX "ai_agents_organizationId_idx" ON "ai_agents"("organizationId");

-- CreateIndex
CREATE INDEX "ai_agents_type_idx" ON "ai_agents"("type");

-- CreateIndex
CREATE INDEX "ai_agents_status_idx" ON "ai_agents"("status");

-- CreateIndex
CREATE INDEX "ai_agents_lastRunAt_idx" ON "ai_agents"("lastRunAt");

-- CreateIndex
CREATE INDEX "ai_agents_organizationId_type_idx" ON "ai_agents"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ai_agents_organizationId_status_idx" ON "ai_agents"("organizationId", "status");

-- CreateIndex
CREATE INDEX "workflows_organizationId_idx" ON "workflows"("organizationId");

-- CreateIndex
CREATE INDEX "workflows_type_idx" ON "workflows"("type");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_nextRunAt_idx" ON "workflows"("nextRunAt");

-- CreateIndex
CREATE INDEX "workflows_lastRunAt_idx" ON "workflows"("lastRunAt");

-- CreateIndex
CREATE INDEX "workflows_organizationId_type_idx" ON "workflows"("organizationId", "type");

-- CreateIndex
CREATE INDEX "workflows_organizationId_status_idx" ON "workflows"("organizationId", "status");

-- CreateIndex
CREATE INDEX "analyses_organizationId_idx" ON "analyses"("organizationId");

-- CreateIndex
CREATE INDEX "analyses_type_idx" ON "analyses"("type");

-- CreateIndex
CREATE INDEX "analyses_status_idx" ON "analyses"("status");

-- CreateIndex
CREATE INDEX "analyses_createdAt_idx" ON "analyses"("createdAt");

-- CreateIndex
CREATE INDEX "analyses_organizationId_type_idx" ON "analyses"("organizationId", "type");

-- CreateIndex
CREATE INDEX "analyses_organizationId_status_idx" ON "analyses"("organizationId", "status");

-- CreateIndex
CREATE INDEX "predictions_organizationId_idx" ON "predictions"("organizationId");

-- CreateIndex
CREATE INDEX "predictions_type_idx" ON "predictions"("type");

-- CreateIndex
CREATE INDEX "predictions_confidence_idx" ON "predictions"("confidence");

-- CreateIndex
CREATE INDEX "predictions_createdAt_idx" ON "predictions"("createdAt");

-- CreateIndex
CREATE INDEX "predictions_organizationId_type_idx" ON "predictions"("organizationId", "type");

-- CreateIndex
CREATE INDEX "predictions_organizationId_confidence_idx" ON "predictions"("organizationId", "confidence");

-- CreateIndex
CREATE INDEX "optimizations_organizationId_idx" ON "optimizations"("organizationId");

-- CreateIndex
CREATE INDEX "optimizations_type_idx" ON "optimizations"("type");

-- CreateIndex
CREATE INDEX "optimizations_status_idx" ON "optimizations"("status");

-- CreateIndex
CREATE INDEX "optimizations_createdAt_idx" ON "optimizations"("createdAt");

-- CreateIndex
CREATE INDEX "optimizations_organizationId_type_idx" ON "optimizations"("organizationId", "type");

-- CreateIndex
CREATE INDEX "optimizations_organizationId_status_idx" ON "optimizations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "api_integrations_organizationId_idx" ON "api_integrations"("organizationId");

-- CreateIndex
CREATE INDEX "api_integrations_platform_idx" ON "api_integrations"("platform");

-- CreateIndex
CREATE INDEX "api_integrations_status_idx" ON "api_integrations"("status");

-- CreateIndex
CREATE INDEX "api_integrations_lastSyncAt_idx" ON "api_integrations"("lastSyncAt");

-- CreateIndex
CREATE INDEX "api_integrations_organizationId_platform_idx" ON "api_integrations"("organizationId", "platform");

-- CreateIndex
CREATE INDEX "api_integrations_organizationId_status_idx" ON "api_integrations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_isRead_idx" ON "notifications"("organizationId", "isRead");

-- CreateIndex
CREATE INDEX "Brand_organizationId_idx" ON "Brand"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_organizationId_slug_key" ON "Brand"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "AdAccount_brandId_idx" ON "AdAccount"("brandId");

-- CreateIndex
CREATE INDEX "AdAccount_platform_idx" ON "AdAccount"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_platform_accountId_key" ON "AdAccount"("platform", "accountId");

-- CreateIndex
CREATE INDEX "DailyMetric_adAccountId_date_idx" ON "DailyMetric"("adAccountId", "date");

-- CreateIndex
CREATE INDEX "DailyMetric_date_idx" ON "DailyMetric"("date");

-- CreateIndex
CREATE INDEX "DailyMetric_platform_date_idx" ON "DailyMetric"("platform", "date");

-- CreateIndex
CREATE INDEX "DailyMetric_campaignId_idx" ON "DailyMetric"("campaignId");

-- CreateIndex
CREATE INDEX "DailyMetric_platform_adAccountId_date_idx" ON "DailyMetric"("platform", "adAccountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_date_platform_adAccountId_campaignId_adGroupId__key" ON "DailyMetric"("date", "platform", "adAccountId", "campaignId", "adGroupId", "adId");

-- CreateIndex
CREATE INDEX "AdCampaign_adAccountId_status_idx" ON "AdCampaign"("adAccountId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_platform_platformCampaignId_idx" ON "AdCampaign"("platform", "platformCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_adAccountId_platformCampaignId_key" ON "AdCampaign"("adAccountId", "platformCampaignId");

-- CreateIndex
CREATE INDEX "WooOrder_brandId_dateCreated_idx" ON "WooOrder"("brandId", "dateCreated");

-- CreateIndex
CREATE INDEX "WooOrder_brandId_market_dateCreated_idx" ON "WooOrder"("brandId", "market", "dateCreated");

-- CreateIndex
CREATE INDEX "WooOrder_dateCreated_idx" ON "WooOrder"("dateCreated");

-- CreateIndex
CREATE INDEX "WooOrder_status_idx" ON "WooOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WooOrder_brandId_orderId_key" ON "WooOrder"("brandId", "orderId");

-- CreateIndex
CREATE INDEX "WooProduct_brandId_idx" ON "WooProduct"("brandId");

-- CreateIndex
CREATE INDEX "WooProduct_sku_idx" ON "WooProduct"("sku");

-- CreateIndex
CREATE INDEX "WooProduct_stockStatus_idx" ON "WooProduct"("stockStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WooProduct_brandId_productId_key" ON "WooProduct"("brandId", "productId");

-- CreateIndex
CREATE INDEX "SyncJob_adAccountId_idx" ON "SyncJob"("adAccountId");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");

-- CreateIndex
CREATE INDEX "SyncJob_createdAt_idx" ON "SyncJob"("createdAt");

-- CreateIndex
CREATE INDEX "MetaWriteLog_adAccountId_createdAt_idx" ON "MetaWriteLog"("adAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaWriteLog_organizationId_createdAt_idx" ON "MetaWriteLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaWriteLog_objectId_action_createdAt_idx" ON "MetaWriteLog"("objectId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "alert_rules_organizationId_isActive_idx" ON "alert_rules"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenDigest_key" ON "invitations"("tokenDigest");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_idx" ON "invitations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invitations_tokenDigest_idx" ON "invitations"("tokenDigest");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_transactions_stateDigest_key" ON "oauth_transactions"("stateDigest");

-- CreateIndex
CREATE INDEX "oauth_transactions_organizationId_consumedAt_idx" ON "oauth_transactions"("organizationId", "consumedAt");

-- CreateIndex
CREATE INDEX "oauth_transactions_expiresAt_idx" ON "oauth_transactions"("expiresAt");

-- CreateIndex
CREATE INDEX "oauth_transactions_stateDigest_idx" ON "oauth_transactions"("stateDigest");

-- CreateIndex
CREATE UNIQUE INDEX "websocket_tickets_tokenDigest_key" ON "websocket_tickets"("tokenDigest");

-- CreateIndex
CREATE INDEX "websocket_tickets_organizationId_idx" ON "websocket_tickets"("organizationId");

-- CreateIndex
CREATE INDEX "websocket_tickets_expiresAt_idx" ON "websocket_tickets"("expiresAt");

-- CreateIndex
CREATE INDEX "websocket_tickets_consumedAt_idx" ON "websocket_tickets"("consumedAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_organizationId_status_idx" ON "ApprovalRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimizations" ADD CONSTRAINT "optimizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimizations" ADD CONSTRAINT "optimizations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websocket_tickets" ADD CONSTRAINT "websocket_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

