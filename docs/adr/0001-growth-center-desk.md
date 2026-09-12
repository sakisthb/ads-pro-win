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
- Demo org stays unlinked.

## Consequences

- Do not merge Django into Next.js, Prisma schemas, or user tables.
- Do not iframe Growth Center.
- Ads Pro MVP ad connectors stay read-only. Write gates stay on SACOS.
- Disconnecting Vercel (or any Ads Pro host) does not change this join.
