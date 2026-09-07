# Ads Pro Enterprise — Agent Operating Contract

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

- Never commit `.env` files, Firebase exports, Supabase credential docs, or generated runtime data.
- Adopt code from reference repos by hand in small pieces with tests, not by bulk merge.
- Keep ad platform integrations read-only in the MVP.
