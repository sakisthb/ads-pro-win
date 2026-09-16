# Production deployment — Ads Pro Digital

**Deploy path: Docker + Caddy only. Vercel is finished — never use it again.**

Ignore leftover GitHub status checks named “Vercel”. They are not CI and not the host.

## Architecture

| Piece | Role |
| --- | --- |
| `web` | Next.js standalone (`output: 'standalone'`) |
| `worker` | Background jobs |
| `redis` | Cache / queues |
| `caddy` | TLS + reverse proxy for the Ads Pro Digital `DOMAIN` |
| Supabase | Postgres + Auth (external) |

Growth Center is a **second hostname** (`SACOS_GROWTH_ORIGIN`). Do not reverse-proxy it through Ads Pro Digital. See `docs/adr/0001-growth-center-desk.md`.

## Steps

1. On the deploy host, create `.env` from `.env.production.example` (never commit secrets). Set `DOMAIN=adpd.gr` and `NEXT_PUBLIC_SITE_URL=https://adpd.gr`. Caddy auto-TLS uses `DOMAIN` (`Caddyfile`); there is no `NEXTAUTH_URL` (Supabase Auth).
2. Leave `SACOS_GROWTH_ORIGIN` empty until the real Growth Center HTTPS domain exists. If set, it must be HTTPS + `SACOS_GROWTH_DESK_TOKEN` (32+ chars) — deploy scripts enforce this.
3. Point DNS A/AAAA for `adpd.gr` at the VPS (ports 80/443). Do not touch `apdm.gr`.
4. Run `./deploy.sh` (or `.\deploy.ps1` on Windows).
5. Confirm health on the Ads Pro Digital domain; do not point production at `127.0.0.1` for Growth Center.

## CI that counts

GitHub Actions on the branch/PR (`typecheck`, `test`, `build-production`, `container-smoke`, …).

Not Vercel.
