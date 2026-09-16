// Root tRPC Router - Main API Router Configuration
// Combines all feature routers into a unified API

import { createTRPCRouter } from "./server";
import { aiRouter } from "./routers/ai";
import { campaignsRouter } from "./routers/campaigns";
import { marketingRouter } from "./routers/marketing";
import { commerceRouter } from "./routers/commerce";
import { connectionsRouter } from "./routers/connections";
import { organizationsRouter } from "./routers/organizations";
import { brandsRouter } from "./routers/brands";
import { syncStatusRouter } from "./routers/sync-status";
import { onboardingRouter } from "./routers/onboarding";
import { alertsRouter } from "./routers/alerts";
import { emailCampaignsRouter } from "./routers/email";
import { invitationsRouter } from "./routers/invitations";
import { metaOpsRouter } from "./routers/meta-ops";
import { growthRouter } from "./routers/growth";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  ai: aiRouter,
  campaigns: campaignsRouter,
  marketing: marketingRouter,
  commerce: commerceRouter,
  connections: connectionsRouter,
  organizations: organizationsRouter,
  brands: brandsRouter,
  syncStatus: syncStatusRouter,
  onboarding: onboardingRouter,
  emailCampaigns: emailCampaignsRouter,
  invitations: invitationsRouter,
  alerts: alertsRouter,
  metaOps: metaOpsRouter,
  growth: growthRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;