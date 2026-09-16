# ADR 0001 — Ads Pro shell, SACOS Growth Center catalog

Date: 2026-09-12

## Status

Accepted.

## Context

The same operator works BagToBag in two products. Ads Pro owns paid clocks (spend, till, GA4, GSC, email). SACOS Growth Center owns catalog truth (products, images, drafts, WordPress writes).

## Decision

Two applications, one brand cockpit.

- Ads Pro is the shell: pick organization + brand, see paid desks and a Growth Center desk.
- Join key: Ads Pro `Brand.website` → SACOS `site_id`. First mapping: `bagtobag.com.gr` → `bagtobag_com_gr`.
- Ads Pro may copy only the narrow `GET /api/desk-summary` counts (image issues, pending drafts, last accepted). It never invents zeros or catalog rows.
- Catalog surgery, WordPress writes, and SACOS login stay in Growth Center. Ads Pro session does not unlock them.
- Meta campaign edits (status / budget / rename) are governed by ADR 0002, not by the catalog write gate.
- Demo org stays unlinked.
- Production is two hostnames. The operator owns DNS: one domain for Ads Pro (Caddy `DOMAIN`), one HTTPS origin for Growth Center (`SACOS_GROWTH_ORIGIN`). Ads Pro does not reverse-proxy Growth Center. Leave the origin empty until that domain exists; do not point production at `127.0.0.1`.

## Consequences

- Do not merge Django into Next.js, Prisma schemas, or user tables.
- Do not iframe Growth Center.
- Catalog surgery, WordPress writes, and SACOS login stay in Growth Center. Ads Pro session does not unlock them.
- **Meta writes:** superseded for Meta only by [`docs/adr/0002-meta-write-desk.md`](0002-meta-write-desk.md) (operator-authorized, `ads_management`, audit log). Other ad platforms stay read-only unless a later ADR opens them.
- Ads Pro production host is Docker + Caddy only. **Vercel is retired** — do not redeploy there. Changing or removing leftover Vercel GitHub checks does not change the Ads Pro ↔ Growth Center join.
