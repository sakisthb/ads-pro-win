# ADR 0002 — Meta write desk (BagToBag / operator-authorized)

Date: 2026-09-16

## Status

Accepted.

## Context

ADR 0001 kept Ads Pro MVP ad connectors read-only so catalog/WP risk stayed in SACOS Growth Center. The Meta operator desk (`metaOps` + Meta operator UI) already implemented gated Graph writes (status, budget, rename, and additional controls) behind `ads_management`, Demo-org block, learning-reset confirms, and `metaWriteLog` audit rows.

Operator Athanasios explicitly authorized Ads Pro to **edit Meta for BagToBag** — not read-only only. Leaving ADR 0001 as “all ads stay read-only” silently contradicted shipping code and the new product decision.

## Decision

- **Meta writes are operator-authorized** for the Ads Pro Meta operator desk on non-Demo organizations, brand-scoped via the connected Meta account / brand context. Default operator brand remains BagToBag (`bagtobag.com.gr` → SACOS `bagtobag_com_gr`).
- **v1 edit surface** (product contract): existing campaign / ad set / ad objects only — `ACTIVE`/`PAUSED` status, daily/lifetime budget where Graph allows, and rename. Creating new campaigns/adsets/ads, creative upload, catalog surgery, WP writes, sibio, and Growth Center merge stay out of this decision.
- **Fail closed** without Meta OAuth scope `ads_management` (keep `ads_read`). No silent auto-writes; UI requires explicit confirmation for live status/budget/rename.
- **Audit** every write attempt in `metaWriteLog` (success and failure).
- **Other ad platforms** (Google Ads, TikTok, etc.) remain read-only unless a future ADR says otherwise.
- **SACOS boundary unchanged:** Ads Pro session still never unlocks catalog surgery or live WordPress writes. Those stay in Growth Center only.

## Consequences

- Agents and docs must not treat “MVP ads read-only” as absolute for Meta. Prefer this ADR + `src/lib/meta/write-policy.ts`.
- Operator must reconnect Meta on Connections and approve `ads_management` before any live edit works. Tokens with `ads_read` only stay fail-closed.
- ADR 0001 still governs the two-app Growth Center join; its “ad connectors stay read-only” line is superseded **for Meta only** by this ADR.
