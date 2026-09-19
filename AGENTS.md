# Ads Pro Digital — Agent Operating Contract

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues in `sakisthb/ads-pro-win`. Use the `gh` CLI for all operations. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at the repo root (created lazily) and `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.

### TDD workflow

Use the `tdd` skill (`.qoder/skills/tdd.md`) for every non-trivial change: write the failing test first, make it pass, then refactor. Run `npx tsc --noEmit` and the relevant Jest tests before finishing.

## Language

Respond to Athanasios in Greek. Keep product, engineering, and ads terminology in English where it is clearer.

## Safety

- Read `docs/operator-bagtobag.md` before ADPD operator planning, audit/data/report or release work. Its latest owner scope lock controls over older dated handoffs: Performance Marketing Desk / AI Ads Operator through ADPD, verified data → audit/report → strategy → approved supported changes. No VPS reinstall or automatic expansion into broad infrastructure recovery. Report any real blocker with the smallest scoped action and impact; source/local verification is not production readiness.
- Never commit `.env` files, Firebase exports, Supabase credential docs, or generated runtime data.
- Adopt code from reference repos by hand in small pieces with tests, not by bulk merge.
- Meta Ads writes are operator-authorized (ADR 0002): require `ads_management`, confirm in UI, audit `metaWriteLog`. Google existing-target Search repairs use the separate preview/confirmation/native-readback desk (ADR 0003); generic Google campaign activation, budget and creation remain read-only. Other platforms stay read-only. Catalog/WP writes stay in SACOS Growth Center.
