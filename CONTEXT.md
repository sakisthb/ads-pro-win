# Ads Pro Enterprise — Domain Context

## What this project is

Ads Pro Enterprise is a Next.js SaaS application for performance marketing teams. It provides AI-assisted dashboards, campaign analysis, and platform integrations for ad accounts.

## Core domain concepts

- **Organization** — the top-level tenant. Billing, team membership, and connected platforms are scoped to an organization.
- **User** — a person who belongs to an Organization. Authentication is handled by Clerk.
- **Campaign** — a paid advertising campaign imported from or planned for an ad platform.
- **AI Agent** — a specialized assistant that analyzes data and produces insights, predictions, or optimization suggestions.
- **Insight** — an AI-generated observation about campaigns, with severity, confidence, evidence, and a recommended action.
- **Analysis** — a structured analytics run (funnel, attribution, performance) produced for an organization.
- **Prediction** — a forecast or estimate produced by an AI model.
- **Optimization** — a recommended change to improve campaign performance.
- **API Integration** — a connection to an external marketing platform (Meta Ads, Google Ads, TikTok Ads, WooCommerce, etc.).
- **Notification** — user-facing alerts about insights, connector health, or system events.
- **Workflow** — a multi-step automation or approval process.

## Bounded language

- Use **dashboard** for the main analytics surface.
- Use **insight** for AI-generated recommendations, not "suggestion" or "tip."
- Use **connector** for platform API integrations, not "integration" alone.
- Use **organization** (not "tenant" or "team") for the billing/membership scope.
- Use **campaign** for the ad object; use **ad set** or **ad group** only when referring to platform-native sub-objects.

## Architecture notes

- Next.js 15 App Router with React Server Components where appropriate.
- tRPC for type-safe API routes.
- Prisma ORM with Supabase PostgreSQL.
- Clerk for authentication and authorization.
- AI providers: OpenAI, Anthropic, Google.
- Read-only ad platform integrations in the MVP.
