# Archived Singleton Managers

This folder contains historical singleton-manager modules that were previously located under `src/lib/`.

## Why they are here

These files were identified during an architecture review as **unused by the current codebase** (zero imports outside this folder). They were singleton-style managers that kept state in memory rather than the database and duplicated responsibilities already covered by:

- Prisma + database models for persistence
- tRPC routers for API seams
- Existing AI/realtime modules for agent orchestration

Because they failed the deletion test (their complexity was not leveraged by callers), they created confusion about which modules are canonical. Rather than deleting them outright, they are preserved here as reference.

## Files

| File | Original purpose |
|------|------------------|
| `ai-agents.ts` | Basic LangChain-based AI agent factory (superseded by integrated/realtime variants) |
| `campaign-automation.ts` | In-memory campaign automation manager |
| `notifications.ts` | In-memory notification service |
| `real-time-monitoring.ts` | In-memory real-time monitoring coordinator |
| `monitoring-analytics-integration.ts` | Bridge between monitoring and analytics |
| `api-integrations.ts` | API integration registry and helpers |

## Status

- **Not imported by active code.**
- **Not loaded by the application.**
- Kept for historical reference only.

If you need any of this behavior in production, prefer re-implementing it behind the current tRPC/Prisma seams rather than re-activating these files directly.
