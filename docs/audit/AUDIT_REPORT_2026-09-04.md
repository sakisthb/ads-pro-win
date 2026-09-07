# Ads Pro Enterprise (ads-pro-win) — Audit Report

**Ημερομηνία:** 4 Σεπτεμβρίου 2026
**Πηγές:** ανάγνωση κώδικα στο `~/AI-APPS/ai-ads/ads-pro-win` (read-only), `tsc --noEmit`, coverage report, git state, και live έλεγχος στον browser σε `http://localhost:3000` (λογαριασμός kotman1979 / brand BAGTOBAG).

---

## 1. Executive summary

Το Ads Pro έχει μετατραπεί από το "AI enterprise demo" του Αυγούστου 2025 σε ένα **πραγματικό, λειτουργικό marketing-intelligence desk για e-shops**: Supabase auth, multi-tenant organizations, Meta / GA4 / Search Console / WooCommerce / Brevo sync σε δικό σου Postgres (Supabase), dashboards με το μοντέλο "five clocks" (pixel, till, GA4, GSC, email), Meta write operations (pause/resume/+20%/kill switch/launcher), grounded AI chat πάνω σε πραγματικά δεδομένα, και πλήρες Docker/Caddy/CI deployment stack.

Στον browser, με πραγματικά δεδομένα BAGTOBAG, το dashboard, τα connections, οι καμπάνιες και το AI chat φορτώνουν χωρίς console errors.

**Τα τρία μεγαλύτερα θέματα αυτή τη στιγμή:**

1. **~82.000 γραμμές κώδικα (13 μήνες δουλειάς) είναι uncommitted.** Το τελευταίο commit είναι 4 Αυγ 2025. Όλο το πραγματικό προϊόν ζει μόνο στον δίσκο σου.
2. **Google Ads spend = €0** γιατί το developer token είναι test-only (7 errors στο sync). Χωρίς Basic Access, όλα τα ROAS/MER στο app είναι Meta-only.
3. **~25.000+ γραμμές νεκρού κώδικα** (legacy "enterprise/AI agents/optimization" libs, unused components, stale docs για Clerk/Vercel) που φουσκώνουν build, lint και coverage denominator και παραπλανούν.

---

## 2. Τι έχουμε (What we have)

### 2.1 Stack

| Layer | Τεχνολογία |
|---|---|
| Framework | Next.js 15.5 (App Router, Turbopack dev, `output: standalone`), React 19, TypeScript strict |
| API | tRPC 11 — 13 routers, ~110 procedures, ~9.5k LOC |
| DB | PostgreSQL (Supabase, eu-central-1 pooler) μέσω Prisma 6 — 24 models, 1 migration (`20260904142521_init`, δημιουργήθηκε σήμερα) |
| Auth | Supabase Auth (`@supabase/ssr`, cookies). Το Clerk έχει φύγει από τον κώδικα |
| Queue / cache | BullMQ 6 + ioredis (worker container, rate limiting, alert processor, sync schedules) |
| AI | LangChain 1.x `createAgent` — OpenAI `gpt-4o` ή Anthropic `claude-sonnet-4-20250514`, 7 Prisma-backed tools |
| UI | Tailwind 3.4, Radix/ShadCN, Recharts, Framer Motion, Zustand, TanStack Query |
| Deploy | Docker multi-stage (node:24-alpine) + `docker-compose.production.yml` (web + worker + redis + caddy) + `deploy.sh`/`deploy.ps1` με fail-closed `prisma migrate deploy` |
| CI | `.github/workflows/ci.yml`: audit, lint, typecheck, jest, migration drift check (Postgres service), production build, container smoke test |
| Tests | 59 jest test files, 2 Playwright specs. Coverage 17.3% lines / 15.8% branches / 12.9% functions |

**Μέγεθος:** `src/` = 399 αρχεία, ~135k LOC (201 αρχεία στο `src/lib`, 113 components). `tsc --noEmit` περνά με **0 errors** (31s).

### 2.2 Database (Prisma)

- **Tenancy:** `Organization`, `OrganizationMembership` (role: owner/admin/member/viewer, isDefault), `User`, `Invitation`
- **Data plane (το πραγματικό προϊόν):** `Brand` → `AdAccount` (platform, encrypted tokens AES-256-GCM) → `DailyMetric` (unique σε date/platform/account/campaign/adGroup/ad), `AdCampaign`, `SyncJob`
- **Commerce:** `WooOrder`, `WooProduct`
- **Ops/Security:** `MetaWriteLog`, `AlertRule`, `OAuthTransaction` (state digest, PKCE), `WebSocketTicket`, `ApprovalRequest`
- **Legacy (από το παλιό AI demo):** `Campaign`, `AIAgent`, `Workflow`, `Analysis`, `Prediction`, `Optimization`, `APIIntegration`, `Notification`
- Δεν υπάρχουν Prisma enums — roles/statuses είναι free strings.
- Seeds: `seed.ts` (org `demo`, brand `sacos`), `seed-demo.ts` (org `demo`, brand `stylevault`, σπέρνει και όλα τα legacy models), `seed-bagtobag.ts` (πραγματικό org BAGTOBAG), `backfill-sold-totals.ts` (one-off).

### 2.3 Auth & multi-tenancy

- `src/middleware.ts` (318 LOC): όλα εκτός `/`, `/auth/*` προστατεύονται· redirect με `?redirect=`· Redis rate limiting μέσω `/api/internal/rate-limit` (Edge δεν φορτώνει ioredis)· 10 MB body cap· proxy-aware IP.
- Active org μέσω httpOnly cookie `x-active-org` (`POST /api/org/switch`). `organization-authorization.ts` → membership → role check → `requireOwnedBrand`, με security-event logging.
- tRPC procedures: `protected`, `verified`, `organization`, `organizationAdmin`, `organizationOwner`.
- `org-bootstrap.ts`: στο πρώτο login δημιουργεί personal workspace (owner) + viewer membership στο shared Demo org.
- Invitations: owner-only send/revoke, SHA-256 token digests, `/invite/accept`. **Το email delivery είναι stub** (`send-invite.ts` κάνει `console.log`).

### 2.4 Routes

**Public:** `/`, `/auth/login`, `/auth/signup`, `/auth/callback`, `/invite/accept`

**API (16):** `api/auth/[platform]` + `/callback` (OAuth), `api/chat` (SSE), `api/connections/{brevo,omnisend,opencart,woocommerce}`, `api/health` (live + DB/Redis readiness), `api/internal/rate-limit`, `api/invite/accept`, `api/org/switch`, `api/settings/clear-demo`, `api/sync/[platform]` (492 LOC, τρέχει inline), `api/trpc/[trpc]`, `api/ws/ticket`

**Protected pages (31):** dashboard, analytics, analytics-studio, attribution, cross-platform, funnel, mission-control, predictions, reports, team, campaigns, campaign-launcher, audiences, bidding, creative-fatigue, customers, email, connections, brands, budget-alerts, notifications, team-members, settings, billing, onboarding, mystery-ai, realtime, seo, profile, help, chat.

Όλες οι σελίδες δεδομένων διαβάζουν **πραγματικά** `DailyMetric`/`WooOrder`/GA4/GSC μέσω tRPC — δεν βρέθηκε mock data σε mounted σελίδα.

### 2.5 tRPC routers

`marketing` (3506 LOC, 14 procs), `commerce` (7), `emailCampaigns` (3), `syncStatus` (1), `alerts` (8), `brands` (4), `invitations` (4), `organizations` (7), `onboarding` (4), `connections` (8), `campaigns` (15 — `generatePlan`, `launch`, `scaleBudget`, `updateLiveStatus`), `metaOps` (20 Meta writes — `killSwitch`, `duplicate`, `swapCreative` κ.ά.), `ai` (13 — μόνο το `generateCreative` χρησιμοποιείται από UI).

### 2.6 Integrations

| Platform | OAuth | Sync | Κατάσταση (browser, 4/9) |
|---|---|---|---|
| **Meta Ads** | Πραγματικό (`OAuthTransaction`, `/me/adaccounts`) | Graph insights + campaigns/adsets, writes με `MetaWriteLog` | **Connected** — BTB-B2C, 1.365 records/sync, success 50%, last sync 6 days ago |
| **Google Ads** | Πραγματικό (adwords scope, refresh) | GAQL `searchStream` | **Sync failed** — developer token test-only, 7 errors, 0 records, never synced |
| **GA4** | Πραγματικό | Data API | **Connected** — GA4 Bagtobag, 205 records, 100% |
| **Search Console** | Πραγματικό | webmasters v3 | **Connected** — bagtobag.com.gr, 5.480 records, 100% |
| **WooCommerce** | API keys (encrypted) | REST orders/products/variations/wholesale | **Connected** — 11.275 records, success 66.7%, last sync 6 days ago |
| **Brevo** | API key | Fetcher | **Connected** — 28 records, 75% |
| **TikTok** | Config χωρίς creds | report API | Not connected — λείπουν `TIKTOK_APP_ID/SECRET` |
| **OpenCart / Omnisend** | API keys | Fetchers | Not connected, ποτέ δοκιμασμένα |
| **MCP adapters** (`src/lib/mcp`) | SSE σε `mcp.facebook.com` | — | Vestigial — `MCP_ENABLED=false`, χρησιμοποιούνται μόνο από unused `api-integrations.ts` |

Το sync τρέχει **inline στο HTTP request** (`api/sync/[platform]`) ενώ οι BullMQ workers (`sync-processor`, `email-sync-processor`, `alert-processor`, `schedules.ts` hourly/daily/6h) διπλασιάζουν τη λογική για το worker container — δύο code paths για συντήρηση.

### 2.7 AI

- **Live path:** `POST /api/chat` → `src/lib/ai/marketing-agent.ts` (LangChain agent, 10-call limit) με 7 tools πάνω σε Prisma (blended performance, top campaigns, wasted spend, actual sales, ad-spend-vs-revenue, compare periods, low stock). Org-scoped. Χωρίς LLM key πέφτει σε `chat-fallback.ts` (deterministic summary από 30d `DailyMetric`).
- **Στον browser:** `/chat` = "Ask AI · Saki playbooks", 25 playbooks (Five clocks 30d, Compare 7d vs prior, Find wasted spend, Reallocate budget, Dayparting…). Warning banner: **"Cloud history is off until `chat_sessions` exists in Supabase (relation public.chat_sessions does not exist)"** — λείπει table/migration.
- **Τοπικά δεν υπάρχει `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`** → το LLM path δεν έχει τρέξει ποτέ σε αυτό το περιβάλλον.
- **Legacy/dead:** `ai-agents.ts` (gpt-4 / claude-3-sonnet-20240229 / gemini-pro — deprecated model IDs), `ai-agents-realtime.ts`, `ai-agents-integrated.ts`, `ai-database-service.ts`, `components/ai/*` (εκτός `floating-chat`). `mystery-insights.ts` = templating, όχι LLM. Predictions = heuristics, όχι ML.

### 2.8 Realtime / WebSocket

- `websocket-server.ts` (542 LOC) + ticket auth είναι σωστά γραμμένα, αλλά `scripts/start-websocket-server.js` κάνει `require` σε `.js` που δεν υπάρχει (το αρχείο είναι `.ts`) → **δεν ξεκινά χωρίς build step**. Δεν είναι στο Dockerfile/compose. Το `/realtime` page κάνει polling tRPC, όχι WS. **Vestigial.**
- Redis/BullMQ: πραγματικά και deployed.

### 2.9 Env

- `.env.local` **SET:** DATABASE_URL, DIRECT_DATABASE_URL, Supabase (URL/anon/service), Redis (localhost), FACEBOOK_APP_ID/SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ANALYTICS_CLIENT_ID/SECRET, WOOCOMMERCE_*, ENCRYPTION_KEY, INTERNAL_RATE_LIMIT_SECRET, SEED_USER_*
- `.env.local` **EMPTY:** REDIS_PASSWORD, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GOOGLE_ADS_CLIENT_ID/SECRET, TIKTOK_APP_ID/SECRET, GOOGLE_MCP_URL
- **`.env.example` είναι UTF-16LE** — grep/dotenv δεν το διαβάζουν σωστά. Περιέχει ακόμα `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- `SKIP_ENV_VALIDATION=1` αλλά το `env.ts` ελέγχει μόνο για `"true"` → το validation τρέχει κανονικά (ακίνδυνο).

---

## 3. Τι δουλεύει (What is working) — επιβεβαιωμένο στον browser

**Dashboard (`/dashboard`)** — πραγματικά δεδομένα BAGTOBAG, last 30 days:
- Total spend €370 (Meta), Store net €11.526, Store MER 31,17x, Profit after ads €1.150
- Five clocks: Pixel €370 (13 conv, 4,72x ROAS) · Till €11.526 (83 paid Woo orders) · GA4 9.783 sessions (96 purchases) · GSC 3.513 clicks (58.102 impr) · Email 0
- Retail/Wholesale desks: 83 unclassified orders — τα desks δεν έχουν ακόμα classification rules
- Open blockers auto-generated: CAPI/EMQ HIGH (83 till vs 13 pixel), Google Ads spend sync HIGH, Woo tax = 0 MEDIUM, Email window quiet MEDIUM
- AI Insights (6 κάρτες, από org data, όχι sample copy), charts (trends, spend/pixel ROAS, 24h delivery pattern, attribution funnel, platform split), Woo last-click mix (Direct 59%, Google 32%, Bing 7%)
- Data sync 83% — 5/6 accounts synced
- **0 console errors**

**Connections (`/connections`)** — System Health 65%, 6/9 platforms connected. Λειτουργούν: Sync Now, Reconnect, Disconnect, επιλογή GA4 property (βλέπει και τα 8 properties του λογαριασμού σου), επιλογή GSC site, Store-ops playbook 01–05.

**Campaigns (`/campaigns`)** — synced Meta campaigns με pixel ROAS, spend share, reach, freq, CTR, CPC, LPV, Meta result· κουμπιά Edit on Meta / Pause / Resume / +20%. Advantage+ (PUR) ACTIVE: €19.611 spend, 7,47x ROAS, 2.022 pixel purchases.

**AI Chat (`/chat`)** — UI "Online", 25 playbooks, input λειτουργεί (fallback mode χωρίς LLM key).

**Από τον κώδικα (tsc OK, δεν έγινε runtime test εδώ):** login/signup/callback, org switch, role-gated tRPC, invitation accept, Meta OAuth→sync→DailyMetric→dashboards→writes με audit log & kill switch, Woo sync→customers/products, GA4/GSC sync, alert rules→worker→Notification, rate limiting, health probes, Docker deploy με fail-closed migrations, CI pipeline.

---

## 4. Τι είναι μισό / σπασμένο (Half-built & bugs)

### Βρέθηκαν στον browser
1. **Campaigns header vs list mismatch:** στο `/campaigns` το header λέει "TOTAL CAMPAIGNS 1 · ACTIVE 0 · TOTAL SPEND €0 · BUDGET €80" ενώ η λίστα από κάτω δείχνει 10+ synced Meta campaigns με €19.611 spend. Το header διαβάζει το legacy `Campaign` model, η λίστα το `AdCampaign`/`DailyMetric`.
2. **`chat_sessions` table λείπει** στο Supabase → chat history μόνο στον browser.
3. **Google Ads sync:** 7 errors, "developer token is test-only".
4. **Retail/Wholesale desks:** 83/83 orders unclassified — η λογική classification (π.χ. από Woo customer role / UTM / campaign name) δεν έχει κανόνες.
5. **Meta sync success rate 50%, Woo 66,7%, Brevo 75%** — τα SyncJob failures δεν εξηγούνται στο UI.
6. Meta & Woo last sync "6 days ago", όλα σε **Manual** mode — τα scheduled BullMQ syncs δεν τρέχουν τοπικά (δεν τρέχει worker).
7. Voice button στο chat = "Coming soon".

### Από τον κώδικα
8. **Invitation emails:** stub (console.log). Χρησιμοποιεί `NEXT_PUBLIC_APP_URL` που δεν υπάρχει στο `env.ts` (το app χρησιμοποιεί `NEXT_PUBLIC_SITE_URL`) → fallback σε `localhost:3000` στα invite links.
9. **Profile preferences** (notification toggles) δεν αποθηκεύονται.
10. **Billing:** μόνο usage counts — Stripe env vars υπάρχουν, κώδικας όχι.
11. **`ai` router:** 11/13 procedures orphaned, deprecated model IDs.
12. **WebSocket server:** launcher script σπασμένος, τίποτα δεν το καταναλώνει.
13. **E2E suite (Playwright):** `ai-workflow.spec.ts` στοχεύει `/ai-demo` και `?mock_auth=true` που δεν υπάρχουν πια → stale.
14. **`lodash → lodash-es` alias** στο `next.config.js` χωρίς `lodash-es` στο `package.json` → πιθανό break σε production build αν υπάρχει lodash import.
15. **Δύο seeds στο ίδιο org slug `demo`** με διαφορετικά brands (`sacos` vs `stylevault`) — αν τρέξουν και τα δύο μπερδεύουν datasets.
16. **Duplicate configs:** `tailwind.config.js` + `tailwind.config.ts`, `.eslintrc.json` + `eslint.config.mjs`, `next.config.{backup,simple,analyze}.js`.
17. **22 unused `src/lib` modules (~11k LOC):** ai-agents, api-integrations (1008), campaign-automation (796), production-deployment-optimization (754), security-hardening-environment (700), notifications (639), cdn-*, database-*-optimization, memory-optimization, scalability-load-balancing, real-time-monitoring, query-optimizer, lazy-routes, advanced-lazy-loading κ.ά. Plus unimported dirs: `src/lib/testing` (6005 LOC), `documentation` (1433), `design`, `animations`.
18. **Unused components/dirs:** `components/ai/*` (εκτός floating-chat), `sections`, `virtualization`, `test`, `images`, `go-live`, `optimized`, `lazy`, `animations`, `analytics`, `debug`, LazyComponents, DashboardContent, PerformanceOptimizationDashboard, CampaignManager.
19. **Stale docs:** README, `DEPLOYMENT_CHECKLIST.md`, `DEPLOYMENT_STRATEGY.md` (Clerk + Vercel), `AI_FEATURES_SETUP.md` (`/ai-demo`, WS), `PHASE_4_AI_INTEGRATION_LOG.md` (περιγράφει dead code). Μόνο τα comments σε `Dockerfile`, `ci.yml`, `env.ts` περιγράφουν σωστά την αρχιτεκτονική.
20. `manifest/` (26 παλιά logs), `performance-reportslighthouse-report.json` (506 KB στο root).

---

## 5. Git state — ΚΡΙΣΙΜΟ

- Branch `main`, remote `github.com/sakisthb/ads-pro-win`, 19 commits, **last commit 2025-08-04**.
- Working tree: **56 modified, 17 deleted, 166 untracked paths (251 untracked files, ~3,6 MB, ~81.8k LOC TS/TSX)**. Tracked diff: 73 files, +8.931 / −9.422.
- Ό,τι είναι το προϊόν σήμερα (Supabase auth, tenancy, όλα τα (protected) pages, Meta/Google/Woo/GA4/GSC/Brevo sync, Docker/CI, η migration) **δεν έχει γίνει ποτέ commit**.
- `.env*` σωστά gitignored.

---

## 6. Τι ακολουθεί (What's next) — προτεινόμενη σειρά

### Sprint 0 — Σήμερα/αύριο (ασφάλεια δουλειάς)
1. **Commit & push.** Καθάρισε πρώτα (βήμα 2) ή κάνε ένα "WIP: 2025-08 → 2026-09 rebuild" commit αμέσως και το cleanup μετά. Η `prisma/migrations/…_init` πρέπει να μπει στο repo για να έχει νόημα το drift check στο CI.
2. **Διάγραψε τον νεκρό κώδικα** (§4.17–4.20): ~25k LOC, μηδενικό ρίσκο αφού δεν γίνεται import. Ξανατρέξε `tsc` + `next build`.
3. **Fix `.env.example`** (UTF-16 → UTF-8, βγάλε Clerk), **`NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL`**, **`lodash-es`** (πρόσθεσέ το ή βγάλε το alias).
4. **Migration για `chat_sessions`** (ή απενεργοποίηση του cloud-history feature flag).

### Sprint 1 — Δεδομένα σωστά (1–2 εβδομάδες)
5. **Google Ads Basic Access** στο Ads API Center + `GOOGLE_ADS_CLIENT_ID/SECRET` στο env. Μέχρι τότε όλα τα ROAS είναι Meta-only.
6. **Fix `/campaigns` header** να διαβάζει `AdCampaign`/`DailyMetric` (ή drop το legacy `Campaign` model).
7. **Retail/Wholesale classification rules** (Woo customer role, campaign name prefix "B2B", UTM) ώστε τα desks να δείχνουν MER ανά κανάλι.
8. **Sync reliability:** εμφάνιση του error message κάθε failed `SyncJob` στο Connections· ξεκαθάρισε γιατί Meta 50% / Woo 66,7%.
9. **Worker running:** τρέξε τον BullMQ worker (τοπικά ή Docker) ώστε τα scheduled syncs να αντικαταστήσουν το "Manual · 6 days ago". Αποφάσισε: inline sync στο request **ή** queue — όχι και τα δύο.

### Sprint 2 — Production (2–3 εβδομάδες)
10. **Deploy** σε VPS με `docker-compose.production.yml` + Caddy (DOMAIN env) — το stack είναι έτοιμο. Πρόσθεσε `OPENAI_API_KEY` ή `ANTHROPIC_API_KEY` ώστε το chat να τρέξει σε LLM mode, και Sentry DSN.
11. **Invitation email** (Brevo transactional — έχεις ήδη το API key) ώστε να μπορείς να καλέσεις πελάτες/συνεργάτες.
12. **Onboard 2ο brand** (Rich Girl Boudoir — τα GA4/GSC properties ήδη φαίνονται στο dropdown) για να επαληθεύσεις multi-brand isolation.
13. **Tests:** διάγραψε τα stale e2e (`ai-workflow.spec.ts`), γράψε 3–4 Playwright smoke tests (login → dashboard → connections → campaigns) και ανέβασε coverage thresholds σταδιακά. Το CI τρέχει ήδη jest/typecheck/build/smoke.
14. **Ξαναγράψε README + διάγραψε τα 4 stale MD** — ένα `ARCHITECTURE.md` που λέει Supabase + Docker + five clocks.

### Backlog (μετά)
- TikTok Ads (creds + δοκιμή), OpenCart/Omnisend verification
- Profile preferences persistence, Stripe billing (αν θα πουληθεί ως SaaS σε πελάτες APDM)
- WebSocket realtime (ή οριστική αφαίρεση — το polling δουλεύει)
- Prisma enums για roles/status
- Predictions με πραγματικό μοντέλο αντί heuristics

---

## 7. Συνοπτικός πίνακας

| Περιοχή | Κατάσταση |
|---|---|
| Auth / tenancy / roles | ✅ Λειτουργεί |
| Meta OAuth + sync + writes | ✅ Λειτουργεί (success rate 50% — να ερευνηθεί) |
| GA4 / GSC / Woo / Brevo sync | ✅ Λειτουργεί |
| Dashboard / analytics / attribution / five clocks | ✅ Λειτουργεί με πραγματικά δεδομένα |
| AI chat (grounded) | ✅ Fallback mode · ⚠️ χωρίς LLM key, χωρίς `chat_sessions` |
| Google Ads spend | ❌ Test-only developer token |
| TikTok / OpenCart / Omnisend | ⚠️ Κώδικας έτοιμος, ποτέ δοκιμασμένος |
| Retail/Wholesale desks | ⚠️ Χωρίς classification rules |
| Invitations email / billing / prefs | ⚠️ Stubs |
| WebSocket / MCP / legacy AI agents | ❌ Νεκρός κώδικας |
| Docker / Caddy / CI | ✅ Έτοιμο, όχι ακόμα deployed |
| Tests | ⚠️ 17% coverage, e2e stale |
| Docs | ❌ Stale (Clerk/Vercel) |
| **Git** | **❌ 13 μήνες uncommitted** |
