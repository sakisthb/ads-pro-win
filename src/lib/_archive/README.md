# Archived Singleton Managers

This folder contains historical singleton-manager modules that were previously located under `src/lib/`.

## Why they are here

These files were identified during an architecture review as **unused by the current codebase** (zero imports outside this folder). They were either singleton-style managers that kept state in memory rather than the database, or pass-through modules that added no meaningful logic. Their responsibilities are already covered by:

- Prisma + database models for persistence
- tRPC routers for API seams
- Existing AI/realtime modules for agent orchestration

Because they failed the deletion test (their complexity was not leveraged by callers), they created confusion about which modules are canonical. Rather than deleting them outright, they are preserved here as reference.

## Files

### Original singleton-manager archive

| File | Original purpose |
|------|------------------|
| `ai-agents.ts` | Basic LangChain-based AI agent factory (superseded by integrated/realtime variants) |
| `campaign-automation.ts` | In-memory campaign automation manager |
| `notifications.ts` | In-memory notification service |
| `real-time-monitoring.ts` | In-memory real-time monitoring coordinator |
| `monitoring-analytics-integration.ts` | Bridge between monitoring and analytics |
| `api-integrations.ts` | API integration registry and helpers |
| `api.ts` | Legacy API client wrapper |

### Pass-through modules and unused singletons (2026-09-07)

| File | Original purpose |
|------|------------------|
| `trpc-client.ts` | Pure re-export of `api` from `src/lib/trpc/react` |
| `mcp-index.ts` | Dead barrel for MCP client-manager, types and adapters |
| `workers-index.ts` | Dead barrel for queues, schedules and worker processors |
| `mcp-adapter-woocommerce.ts` | Unused WooCommerce MCP adapter |
| `design/` | Dead design-token cluster (colors, spacing, typography) |
| `animations/` | Dead Framer Motion variant barrel |
| `api-middleware.ts` | Unused Next.js middleware helpers |
| `cache-middleware.ts` | Thin wrapper around `cache.ts` |
| `query-optimizer.ts` | Wrapper around the legacy database client with an in-memory query cache |
| `advanced-lazy-loading.tsx` | Unused React lazy-loading wrapper |
| `lazy-routes.tsx` | Unused route-level lazy-loading wrapper |
| `database-connection-pool.ts` | Standalone connection pool manager |
| `database.ts` | Legacy Prisma wrapper (canonical access is `src/lib/db.ts`) |
| `database-pool.ts` | Custom `DatabaseConnectionPool` singleton used only by `database.ts` |
| `cache.ts` | Singleton `CacheManager` backed by Redis |
| `database-performance-optimization.ts` | In-memory database performance metrics singleton |
| `database-query-optimization.ts` | SQL-string query analyzer singleton |
| `animation-performance.ts` | Unused animation performance utility |
| `memory-optimization.ts` | Unused memory optimization singleton |
| `cdn-infrastructure.ts` | Unused CDN infrastructure manager |
| `cdn-optimizer.ts` | Unused CDN optimization utility |
## Status

- **Not imported by active code.**
- **Not loaded by the application.**
- Kept for historical reference only.

If you need any of this behavior in production, prefer re-implementing it behind the current tRPC/Prisma seams rather than re-activating these files directly.
