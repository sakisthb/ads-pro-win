# ADR 0003 — Operator-confirmed Google existing-target repairs

Date: 2026-09-17

## Status

Accepted product/action contract. Deployment and live provider acceptance are separate, still pending.

## Context and authority

Athanasios requested corrections to Google ads, keywords and destinations after an account study, then explicitly instructed that ADPD itself implement the missing accepted action contract instead of repeatedly presenting the blanket Google-write block. This decision supersedes ADR 0001/0002's Google read-only boundary only for the following narrowly scoped workflow.

## Decision

- A separate `googleRepair` router and Google Repair Desk permit repairs to the selected, organization-owned, connected BagToBag spend account. Customer identity must be verified natively; manager customers, Demo organizations, foreign targets and non-Search parents are rejected.
- Only owner/admin can prepare, execute or reconcile. Organization members may read owned durable audit history. No automatic Chat execution, OAuth reconnect or grant expansion is introduced.
- One existing target per immutable ten-minute preview: responsive Search ad final URL/copy update; positive keyword pause/final URL update; or pause of a single campaign sitelink association. Legacy call ads, keyword text/match changes, positive/negative creation, shared negative-list changes, shared asset edits, ad deletion, enable operations, campaign status, budgets and new campaigns are excluded.
- Sparse Google update masks preserve all unapproved fields, mobile URLs, ad status and parent status. RSA output-only performance/policy properties are not sent as writable assets. Legacy shared RSA targets are rejected rather than edited across multiple parents.
- Preview contains server-read native before state, exact desired state, target/brand/account/customer scope, reason, actor, timestamps and SHA256. Client-supplied performance, credentials, arbitrary resource names or replacement operations are not accepted.
- Execute requires visible approval of that exact preview and a separate acknowledgement that repairing an ENABLED disapproved ad may resume delivery/spend under existing budgets. It is not spend-neutral just because budgets are unchanged.
- A durable atomic single-use claim precedes provider access. Re-read before state; validate canonical live HTML destinations (including inherited mobile URLs); Google `validateOnly`; re-read before again; recheck expiry; then issue exactly one live mutation without retries. A native field readback is required for `verified`.
- Existing `Analysis` records of type `google_repair_v1` retain preview and attempt status, actor and sanitized outcome. Legacy analytics retention must preserve these receipts, including failed/uncertain attempts. No new schema migration is required by this feature.
- Ambiguous network/provider results are `provider_unknown`; differing fields are `readback_mismatch`. Never silently retry a live mutation. Read-only reconciliation may establish current native fields without changing ads. An in-flight `executing` receipt cannot be reconciled until its ten-minute execution window has passed.
- `verified` means native fields match, not Google policy approval, eligibility, delivery, profitable conversions, account-wide coverage or improved ROAS. Editorial review can be asynchronous.
- Canonical destinations must be HTTPS on the shop domain, with no credentials, nondefault ports, fragments or redirect-following shortcuts. HTTP errors/challenges/soft-404s fail closed. This proves reachability/HTML only, not product stock, B2B fit, tracking, mobile usability or a CRO/merchandising study.
- Google updates are not externally atomic with concurrent edits made directly in Google Ads. The before/validate/recheck sequence reduces, but cannot eliminate, that race. No automatic rollback is safe; restoring copy/URLs requires a fresh preview of current fields. Re-enabling paused keywords is outside v1.

## Boundaries and release

Generic campaign launcher/status/budget helpers and the Google MCP adapter stay read-only. Research acceptance remains research-only, not live repair consent. Meta ADR 0002 remains unchanged; TikTok remains read-only. WP, catalog, product copy and landing-page content writes remain in the SACOS Growth Center workflow.

Source tests, local browser proof, production deployment and exact provider acceptance must be reported separately. This contract does not waive unresolved host-security/recovery or producer/cutover release gates, authorize secrets copying, or permit a broad Compose/worker restart. Existing signed-in auth and selected account are reused; no reconnect spam.
