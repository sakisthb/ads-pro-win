# Ads Pro Digital — Domain Context

**Current BagToBag / Growth Center operator truth:** [`docs/operator-bagtobag.md`](docs/operator-bagtobag.md). New chats must read its latest owner scope lock before ADPD audit/data/report/operator/release or catalog, image, or WordPress work. Main outcome: verified data → audit/report → Retail/Branding/Wholesale strategy → approved supported changes through ADPD. Owner explicitly prohibits VPS reinstall; do not expand into unrelated infrastructure work automatically. Architecture decisions: [`docs/adr/0001-growth-center-desk.md`](docs/adr/0001-growth-center-desk.md) (two apps / catalog desk), [`docs/adr/0002-meta-write-desk.md`](docs/adr/0002-meta-write-desk.md) (operator-authorized Meta edits), [`docs/adr/0003-google-repair-desk.md`](docs/adr/0003-google-repair-desk.md) (bounded existing-target Google Search repairs).

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

- **Research memory:** owned Google research snapshots retain server-generated scoped audit plus optional full operator Markdown study with declared title/source URLs/observation time. Study content is separately labelled research, never canonical metric evidence or Ads approval. Frozen evidence hash covers the full body; new snapshots preserve old studies and existing actor/time/revision review history. Scoped Chat/Reports share the snapshot reference; complete-study LLM interpretation is not yet implemented. See the controlling18Sept shared-data/import/memory receipt in `docs/operator-bagtobag.md`; dated zero-data/missing-receipt handoffs are no longer current for its four exact imported windows. Shared backend delivery is NOT production UI/web-worker deployment.

- Next.js 15 App Router with React Server Components where appropriate.
- tRPC for type-safe API routes.
- Prisma ORM with Supabase PostgreSQL.
- Supabase Auth for authentication and authorization.
- AI providers: OpenAI, Anthropic, Google.
- Meta Ads writes are operator-authorized (ADR 0002). Google existing-target Search repairs are authorized only through the exact-preview Google Repair Desk (ADR 0003); generic campaign activation, budgets and creation remain read-only. Other platforms remain read-only. Catalog/WP writes stay in SACOS.
- **Current hosted deploy architecture:** Docker behind CyberPanel/OpenLiteSpeed on the existing host, preserving the host-only Compose override and loopback binding; Caddy is disabled there. The repository's default Docker+Caddy scripts are not the current VPS recipe. Read the canonical `CYBERPANEL-SERVER/servers/socialideas-gr/sites/adpd.gr/` handoff before any approved production maintenance. **Vercel is finished — never deploy there again.** Ignore leftover GitHub “Vercel” status checks; they are not part of CI. Architecture is not deployment/recovery authorization or readiness proof.
