// Root tRPC Router - Main API Router Configuration
// Combines all feature routers into a unified API

import { createTRPCRouter } from "./server";
import { aiRouter } from "./routers/ai";
import { campaignsRouter } from "./routers/campaigns";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  ai: aiRouter,
  campaigns: campaignsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;