# Ads Pro Digital — Domain Context

**Current BagToBag / Growth Center operator truth:** [`docs/operator-bagtobag.md`](docs/operator-bagtobag.md). New chats must read that file before catalog, image, or WordPress work. Architecture decisions: [`docs/adr/0001-growth-center-desk.md`](docs/adr/0001-growth-center-desk.md) (two apps / catalog desk), [`docs/adr/0002-meta-write-desk.md`](docs/adr/0002-meta-write-desk.md) (operator-authorized Meta edits).

## What this project is

Ads Pro Digital is a Next.js SaaS application for performance marketing teams. It provides AI-assisted dashboards, campaign analysis, and platform integrations for ad accounts.

## Core domain concepts

- **Organization** — the top-level tenant. Billing, team membership, and connected platforms are scoped to an organization.
- **User** — a person who belongs to an Organization. Authentication is handled by Supabase Auth.
- **Brand** — a shop inside an Organization. `website` / hostname is the join key to SACOS Growth Center.
- **Growth Center desk** — Ads Pro Digital surface for catalog counts of a mapped brand. Catalog writes stay in SACOS Growth Center (a separate application). Production uses two hostnames (Ads Pro Digital + Growth Center). See `docs/adr/0001-growth-center-desk.md`.
- **Campaign** — a paid advertising campaign imported from or planned for an ad platform.
- **Meta write desk** — operator-confirmed edits on existing Meta campaign / ad set / ad objects (status, budget, rename). Requires `ads_management`. Audited in `metaWriteLog`. See `docs/adr/0002-meta-write-desk.md`.
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
- Supabase Auth for authentication and authorization.
- AI providers: OpenAI, Anthropic, Google.
- Meta Ads writes are operator-authorized (ADR 0002). Other ad platforms stay read-only in the MVP unless a later ADR opens them. Catalog/WP writes stay in SACOS.
- **Deploy:** Docker + Caddy only (`docker-compose.production.yml`, `deploy.sh` / `deploy.ps1`). **Vercel is finished — never deploy there again.** Ignore leftover GitHub “Vercel” status checks; they are not part of CI.
