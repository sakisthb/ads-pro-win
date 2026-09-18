# ADR 0004 — Chat history stays user-scoped in M1.5; organization scoping is M2

Date: 2026-09-18

## Status

Accepted scoping decision for the M1.5 production-truth milestone. The formal
organization-scoped model and its migration are explicitly deferred to M2.

## Context and authority

The Chat desk persists conversation history to Supabase tables
`chat_sessions` / `chat_messages`, keyed by Supabase `user_id`, with a
browser `localStorage` fallback (`adspro:chat:<userId>`) when remote
persistence is unavailable. Neither path carries an organization scope, so a
user who belongs to more than one ADPD Organization sees one shared history
across all of them.

Athanasios' M1 directive ordered production-truth fixes (business context
staleness, Pixel labels, Decision plan wording, chat history) with the
owner-scope lock from `docs/operator-bagtobag.md`: verified data →
audit/report → strategy → approved supported changes. Codex's review put
"protection of private artifacts" first and scoped the chat fix as a formal
model decision, not an ad-hoc patch.

## Decision

- M1.5 makes **no schema or RLS change** to chat persistence. The current
  user-scoped Supabase read/write path and the localStorage fallback stay
  exactly as they are; no migration is run against the shared database.
- Organization-scoped chat history — adding `organizationId` to
  `chat_sessions` / `chat_messages` (or folding them into the Prisma schema
  with the rest of the ADPD data model), backfilling existing rows, and
  enabling default-deny RLS with per-organization policies — is **M2 scope**
  together with the isolation checks that prove one Organization cannot read
  another's chat history.
- Until M2 ships, chat history is user-level. This is accepted short-term
  because Organization membership is operator-controlled (owner/admin admits
  members), so cross-org visibility is limited to users the operator already
  admitted to both organizations.
- The localStorage fallback remains a best-effort convenience cache keyed by
  user id; it is not evidence and never feeds Audit or Reports.

## Boundaries and release

This decision does not weaken the server-only backend table hardening, does
not touch Audit/Reports evidence chains, and authorizes no provider write.
M2 must deliver the org-scoped model with TDD, a bounded hand-written
migration applied via `prisma migrate deploy` only, and native isolation
tests before any chat schema change reaches production.
