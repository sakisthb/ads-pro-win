# BagToBag operator truth

Last updated: 2026-09-16 (drafts: operator said do not work on them). Athanasios is CEO/operator. New chats in this repo must read this file with `CONTEXT.md` and `docs/adr/0001-growth-center-desk.md`.

This is working memory for the catalog desk. It is not a live WordPress dump and not permission to write production.

## Two applications, one brand

- Ads Pro (`http://127.0.0.1:3000`) — paid desks. Auth: Supabase. Live workspace of `kotman1979@gmail.com`, brand **BagToBag**, not Demo.
- SACOS Growth Center (`http://127.0.0.1:18806`) — catalog truth, drafts, WordPress write gates. Auth: `sacos_owner` (local staging password-only; hosted MFA stays).
- Join: Ads Pro `Brand.website` `bagtobag.com.gr` → SACOS `site_id` `bagtobag_com_gr`.
- Do not merge repos, Prisma, Django, or user tables. Do not iframe Growth Center. Do not reverse-proxy SACOS through Ads Pro. Operator owns DNS for the two future production hostnames.
- Ads Pro MVP ads stay read-only. Ads Pro session does not unlock catalog surgery or WordPress writes.
- Ads Pro Growth Center desk [PR #2](https://github.com/sakisthb/ads-pro-win/pull/2) is **merged** to `main`. Branch `feat/growth-center-desk` is historical — new work from `main` via small PRs.

## Three places that are easy to confuse

| Place | What it is | Writes |
| --- | --- | --- |
| `https://bagtobag.com.gr` | Production WordPress. Source of catalog truth. | Only after explicit operator approval and native executor. |
| Local Growth Center on the Mac | Operator desk. Holds snapshots, drafts, packs. Profile is BagToBag, not a demo shop. | Local DB only. Does not sync to WordPress. |
| `test1.local` | WordPress sandbox for a few executor proofs (sibio, connector `image.optimize`). | Never install Bulk Image Optimizer / sibio on BagToBag. |

There are no Woo/REST API keys for the catalog snapshot path. Live reads use the existing operator SSH + site-user PHP stdin, `READ ONLY`. Nothing is written back automatically.

## Catalog brand rule (operator, 2026-09-14)

- **Bags:** BagToBag only.
- **Accessories:** BagToBag or Ardika. Ardika on this shop is expected, not a data error.
- Example: product `355677` (βραχιόλι TN-X10-15, `pa_brand` ARDIKA, `instock`) is legitimate.
- Do not rewrite Ardika accessories as BagToBag. Do not label a bag as Ardika.

## Copy and image rules

- Tone: clear natural Greek. Only documented attributes (title, SKU, categories, dimensions, brand). Do not invent leather, metal, lining, or certifications from a photo.
- Do not trust a second `pa_color` of «Μπλέ» when the title already names another color — treat as dirty attribute until photo/operator confirms.
- SKU on older rows is sometimes a copy of the title; newer rows use codes such as `YD805201-BLACK`.
- Do not create, edit, review, or pack product/image drafts unless the operator explicitly asks. Do not “fix” Ardika/BagToBag brand in copy as a side task.
- Do not claim visual QA of the ~14k catalog images. The 11/09 pilot visually checked 12 main photos.

## Done — #1 image snapshot (2026-09-14)

Live read `2026-09-14T13:40:20+00:00` into gitignored `native-images.json`. Local Growth Center import `--replace` only.

Proof: `/Users/athanas1os/SACOS/sacos-private-operator/workspaces/bagtobag-image-snapshot-20260914/proof.md`

| Fact | Value |
| --- | --- |
| Published products in that read | 2,753 |
| Catalog-referenced images | 14,119 (was 14,107 on 11/09) |
| `image_snapshot.status` | `current` |
| empty_stored_alt | 14,046 |
| over_500kb_review | 703 |
| under_600px_review | 4 |
| WordPress files changed | 0 |
| Pilot image records kept | 32 |

Product records in Growth Center are still the 11/09 catalog seed. The 29 `empty_description` IDs still have empty long description on the 14/09 live read. `shared_across_products_review` is not rebuilt by the file-based image replace.

## Next

Wait for the operator. Do **not** start the 29 `empty_description` drafts, reviewed pack, or any copy queue.

Ads Pro Growth Center desk (engineering, 2026-09-16): Phase A stabilize merged via [PR #2](https://github.com/sakisthb/ads-pro-win/pull/2) (`1393a77` on `main`, head included `18d3ec5`). Hosted origin fail-closed, deploy HTTPS+token gates, ADR two-hostnames, operator truth, router/unit/contract tests. Live dashboard proof: BagToBag counts from SACOS `desk-summary`. **CI that counts:** GitHub Actions only. **Ignore Vercel.** Docker + Caddy only.

Later sequence exists only as backlog, not as permission: test1 native executor; readback; `over_500kb_review` as SACOS `image.optimize` handoff (still not sibio on BagToBag); alt batches; snapshot freshness on the desk; production Growth Center hostname; second site as a new profile.

## Stop conditions

- No sibio / Bulk Image Optimizer on BagToBag.
- No live WP writes without a new explicit yes.
- No inventing product facts.
- No treating test1 as the BagToBag shop.
- No treating local Growth Center replace as a production publish.
- No draft/copy work unless the operator asks.
- **No Vercel.** Ads Pro ships on Docker + Caddy only. Never run `vercel`, never treat the leftover GitHub Vercel check as CI.
