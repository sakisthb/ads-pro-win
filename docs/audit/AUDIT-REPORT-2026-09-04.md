# Ads Pro Enterprise — Product & Engineering Audit

**Ημερομηνία:** Παρασκευή 4 Σεπτεμβρίου 2026  
**Project:** `ads-pro-win` (`ads-pro-enterprise` v0.1.0)  
**Repo:** `/Users/athanas1os/AI-APPS/ai-ads/ads-pro-win`  
**Μέθοδος:** (1) audit κώδικα / schema / routers / CI / deploy, (2) live browser pass στο `http://localhost:3000` με πραγματικό logged-in session, (3) δεύτερο audit με βάση τι φόρτωσε πραγματικά στην οθόνη.

Αυτό το αρχείο είναι το πλήρες report. Δεν είναι marketing deck. Είναι η κατάσταση του προϊόντος όπως φαίνεται στον κώδικα και όπως αποδείχθηκε στον browser.

---

## 1. Executive verdict

Το Ads Pro **δεν είναι πλέον mockup**. Είναι ένα πραγματικό multi-tenant marketing OS με ζωντανό data path:

```text
Supabase Auth → Organization / Brand → Connections (OAuth ή REST keys)
  → Sync → DailyMetric / WooOrder / AdCampaign
  → Operator desks (Dashboard, Campaigns, Attribution, Reports, AI chat)
```

Το **live spine δουλεύει**. Στο browser, το workspace `kotman1979's Workspace` (BAGTOBAG) έδειξε πραγματικά Meta spend, Woo till, GA4, Search Console και Brevo, με ρητή διάκριση των «πέντε ρολογιών» (pixel / till / GA4 / GSC / email) αντί για ένα φανταστικό blended ROAS.

Παράλληλα, το προϊόν **φαίνεται μεγαλύτερο από τη μηχανή του**:

- Η landing page πουλάει LinkedIn, Shopify, Stripe pricing, 500+ brands, 97% forecast accuracy.
- Το README μιλάει ακόμα για Clerk, Next 14, Vercel, SOC2.
- Πολλές σελίδες Intelligence έχουν **Demo theater** (hardcoded charts) όταν το org είναι `demo`.
- Billing, Help, Watch Demo, footer links, Playwright e2e και LinkedIn/Microsoft Ads **δεν είναι προϊόν**.

**Συμπέρασμα:** Έχετε έναν σοβαρό operator desk για BAGTOBAG (και Demo seed). Δεν έχετε ακόμα packaged SaaS με billing, autonomous AI forecasting, multi-touch attribution engine, ή production-grade e2e.

**Σημείωση session:** Κατά το browser pass έγινε switch στο org **Demo**. Αν ανοίξετε την εφαρμογή και βλέπετε StyleVault αντί για BAGTOBAG, γυρίστε το workspace από το `Switch organization` πίσω στο `kotman1979's Workspace`.

---

## 2. Τι είναι το προϊόν σήμερα

**Ads Pro Enterprise** είναι operator platform για paid ads + e-commerce till, με κεντρική ιδέα:

> Πέντε ρολόγια. Μην τα προσθέτεις.  
> Pixel ≠ till ≠ GA4 ≠ Search Console ≠ email.

Δεν είναι «ένα dashboard που ενώνει τα πάντα σε ένα ROAS». Είναι desk που **ονομάζει** κάθε πηγή και δείχνει πού ψεύδεται το pixel σε σχέση με το ταμείο.

### Tech stack (πραγματικό, όχι README)

| Layer | Reality |
|---|---|
| App | Next.js **15.5.25** (Turbopack), React 19, TypeScript |
| API | tRPC 11 κάτω από `src/lib/trpc` |
| DB | PostgreSQL μέσω Prisma 6 + Supabase |
| Auth | **Supabase Auth** (email/password). Clerk έχει φύγει από τον κώδικα |
| UI | Tailwind, Radix/shadcn, Framer Motion, Recharts |
| Cache / queues | Redis + BullMQ workers (Docker). Local dev τρέχει χωρίς workers |
| AI | LangChain + OpenAI/Anthropic/Google keys (optional). Χωρίς keys υπάρχει grounded fallback |
| Deploy | Docker + Caddy + `docker-compose.production.yml`. Όχι Vercel |

### Δύο κόσμοι δεδομένων

| Org | Τι είδαμε |
|---|---|
| **kotman1979's Workspace** (owner, plan `free`) | Ζωντανό BAGTOBAG. Meta, Woo, GA4, GSC, Google Ads OAuth, Brevo |
| **Demo** (viewer, plan `enterprise`, 4 brands) | StyleVault seed. Ίδιο dashboard engine πάνω σε demo rows. Predictions = theater |

Αυτό είναι σωστό προϊόν: το Demo είναι showcase. Το live org δεν εφευρίσκει νούμερα.

---

## 3. Τι έχουμε (inventory από κώδικα)

### 3.1 Auth, orgs, brands

**WORKING**

- Login / signup με Supabase email+password.
- Middleware: unauthenticated → `/auth/login?redirect=…`. Logged-in users bounce από login/signup.
- `(protected)/layout.tsx` είναι το authoritative server gate (`getSession()`).
- Organizations + memberships (owner / admin / member / viewer).
- Invites (`invitations` router + `/api/invite/accept`).
- Org switcher, brand chips, market desks (Retail / Wholesale).
- Onboarding wizard + banner «First session».
- Encrypted tokens (`ENCRYPTION_KEY`, AES-256-GCM).
- Rate limiting (internal Redis route).
- WebSocket tickets (`/api/ws/ticket`) — ξεχωριστό process, όχι στο production compose.

**PARTIAL / κενά**

- `/invite/accept` δεν είναι public path στο middleware → ο invitee πηγαίνει πρώτα login (σωστό ως ροή, αλλά η σελίδα σε 401 κάνει redirect σε `/login` αντί για `/auth/login`).
- User model κρατάει ακόμα legacy `organizationId` δίπλα στα memberships.
- Org `plan` υπάρχει ως string. Δεν κάνει gating προϊόντος. Billing δεν το τιμολογεί.

### 3.2 Connections & sync

Wired platforms στο Connections desk:

| Platform | Τρόπος | Κατάσταση κώδικα |
|---|---|---|
| Meta Ads | OAuth → Graph | WORKING (read + operator writes) |
| Google Ads | OAuth + developer token | PARTIAL (account pick + sync. Fail path υπάρχει) |
| GA4 | OAuth + property picker | WORKING |
| Search Console | OAuth + site picker | WORKING |
| TikTok Ads | OAuth | PARTIAL (UI + sync fetcher. Env άδειο στο local. Launch = campaign shell) |
| WooCommerce | REST keys ανά brand | WORKING |
| OpenCart | API key | WORKING (connect/sync) |
| Omnisend | API key | WORKING (connect/sync) |
| Brevo | API key | WORKING (connect/sync) |
| LinkedIn Ads | — | MISSING (enum/UI only) |
| Microsoft / Bing Ads | — | MISSING (Bing = Woo last-click tag, όχι spend) |
| Shopify | — | MISSING (μόνο landing marketing) |
| Snapchat / Pinterest | — | MISSING (ρητά: «not in this desk») |

On-demand sync: `POST /api/sync/[platform]` με Graph/REST fetchers. Αυτό είναι το path που χρησιμοποιεί ο operator από Connections.

Background workers: BullMQ queues για meta/google/tiktok/woo/opencart/email/alerts. Τρέχουν στο Docker `worker` service. **Δεν υπάρχει npm script** `worker` στο `package.json`. Το local `npm run dev` δεν συγχρονίζει μόνο του.

**Dual-path κίνδυνος:** οι workers μιλούν σε MCP adapters (`mcp.facebook.com/ads` κ.λπ.). Το UI Sync Now μιλάει απευθείας Graph/REST. Αν τα MCP remotes διαφέρουν, το background sync μπορεί να αποτυγχάνει ενώ το Sync Now δουλεύει.

### 3.3 Data model (σημαντικό)

| Model | Ρόλος |
|---|---|
| `Campaign` | App-created / Campaign Studio. Legacy AI relations. Enum περιλαμβάνει `linkedin` |
| `AdCampaign` | Synced αντικείμενα από Meta/Google/TikTok |
| `DailyMetric` | Αλήθεια των operator desks (spend, pixel, GA4/GSC rows) |
| `WooOrder` / `WooProduct` | Till P&L |
| `AdAccount` | Tokens ανά brand/platform |
| `SyncJob` | Ιστορικό sync |
| `AlertRule` / `Notification` | Budget alerts |
| `Analysis` / `Prediction` / `Optimization` / `AIAgent` | Παλιό AI layer. `Prediction` table practically unused από τα νέα desks |
| `ApprovalRequest` | Schema υπάρχει. Δεν είναι το κύριο Meta operator path |

Αυτό το dual model φαίνεται και στο UI: στο `/campaigns` το header έδειξε `TOTAL CAMPAIGNS 1 / SPEND €0 / BUDGET €80` (Studio `Campaign`), ενώ από κάτω το Meta desk είχε Advantage+ με χιλιάδες ευρώ synced spend.

### 3.4 tRPC routers (κανένα δεν επιστρέφει hardcoded mock από τον server)

Routers: `ai`, `campaigns`, `marketing`, `commerce`, `connections`, `organizations`, `brands`, `syncStatus`, `onboarding`, `emailCampaigns`, `invitations`, `alerts`, `metaOps`.

Το Demo theater ζει **στις σελίδες** (`isDemo`), όχι στους routers.

Chat tools πάνω σε πραγματικά Prisma data: blended performance, compare periods, wasted spend, actual sales, spend vs revenue, low-stock advertised products, top campaigns.

### 3.5 Σελίδες (35 routes)

**Main:** Dashboard, Campaigns, Analytics, Analytics Studio, Realtime, Chat  
**Intelligence:** Predictions, Mystery AI, Attribution, Funnel, Audiences, Cross-Platform, Bidding, Creative Fatigue, SEO, Email  
**Automation:** Onboarding, Campaign Studio, Budget Alerts, Mission Control  
**Tools:** Reports, Connections, Customers, Team  
**Account:** Notifications, Billing, Settings, Profile, Help  
**Public:** `/`, `/auth/login`, `/auth/signup`, `/invite/accept`

### 3.6 AI

| Κομμάτι | Reality |
|---|---|
| `/chat` + `/api/chat` SSE + Saki playbooks | WORKING. LangChain tools ή grounded fallback χωρίς LLM keys |
| Floating chat στο protected shell | WORKING (κουμπί Open chat) |
| Mystery AI | WORKING. Deterministic fortunes πάνω σε live top campaigns |
| Predictions page (live org) | PARTIAL. Heuristic insights από synced data. Όχι trained forecast |
| Predictions page (Demo) | Theater. «15+ years of media buying», €28,600 potential, 85% confidence |
| Legacy `ai.analyzeCampaign` / creative / optimize | PARTIAL. LLM πάνω στο παλιό `Campaign` model + WS progress |
| Autonomous optimization | ΔΕΝ υπάρχει. Meta writes είναι operator-driven (pause / +20% / Edit on Meta) |

### 3.7 CI / tests / deploy

**CI (σοβαρό):** lint, `npm audit --audit-level=high`, `tsc --noEmit`, Jest, Prisma migrate + schema drift, production build, Docker container smoke με Postgres+Redis και `/api/health`.

**Tests:** ~62 αρχεία. Κάλυψη Jest σκόπιμα χαμηλή (15% lines). Δυνατά στα helpers (metrics, Woo, Meta, OAuth, authz, fatigue). Αδύναμα σε UI pages και στα περισσότερα tRPC routers.

**Playwright:** `e2e/end-to-end-testing.spec.ts` και `e2e/ai-workflow.spec.ts` είναι **stale**. Ψάχνουν tabs που δεν υπάρχουν, `/api/health-check` αντί `/api/health`, deleted `/ai-demo`. Το CI **δεν τρέχει** Playwright.

**Production path:** `Dockerfile` standalone Next + worker bundle, Caddy TLS, `deploy.sh` migrate-before-traffic. Gaps: το `deploy.sh` χτίζει tag που το compose δεν χρησιμοποιεί απαραίτητα. WebSocket sidecar λείπει από production compose.

---

## 4. Browser audit — τι φόρτωσε πραγματικά

Τοπικό server: `npm run dev` → Next 15.5.25 Turbopack, port 3000, `.env.local`.  
Health: `GET /api/health` → `{ status: "ok", db: true, redis: true, migrations: { failed: 0 } }`.

Unauthenticated (curl χωρίς cookies):

- `/dashboard` → 307 `/auth/login?redirect=/dashboard`
- `/chat` → 307 login
- `/invite/accept` → 307 login

Authenticated session υπήρχε ήδη στο Cursor browser.

### 4.1 Landing `/`

**Δουλεύει οπτικά.** Hero: «Stop Guessing. Start Scaling.», CTA `Get Started Free` → `/auth/signup`, stats, demo tabs (Revenue / Attribution / AI Predictions), pricing (€497 / €1,497 / Custom), testimonials, footer.

**Δεν δουλεύει ως προϊόν:**

- `Watch Demo` δεν έχει `onClick`. Νεκρό κουμπί.
- Footer links (`Features`, `Pricing`, `API Docs`, `About`, `Blog`, `Careers`, `Privacy`, `Terms`…) είναι `href="#"`.
- Marketing ψέματα σε σχέση με τον κώδικα: LinkedIn, Shopify, «500+ Brands», «97% Forecast Accuracy», «AI-powered multi-touch attribution», pricing που το Billing page λέει ρητά ότι δεν υπάρχει checkout.
- Landing λέει «4 Platforms» ενώ το Connections desk έχει 9 slots και το live BAGTOBAG έχει 6 συνδεδεμένα.

Hydration overlay εμφανίστηκε στο `src/app/page.tsx` (`motion.h1`). Το diff ήταν `data-cursor-ref` — πιθανό artifact του Cursor browser tooling, όχι σίγουρο production bug. Αξίζει ένα καθαρό reload χωρίς automation για επιβεβαίωση.

### 4.2 Live workspace — BAGTOBAG (`kotman1979's Workspace`, owner)

Dashboard μετά το load (όχι empty state):

| Clock | Τι έδειξε (Last 30 days) |
|---|---|
| Pixel | €370 spend, 13 conversions, **4.72x pixel ROAS** — Advantage+ (PUR) |
| Till | **€11,526**, 83 paid Woo orders |
| GA4 | 9,783 sessions, 96 ecommerce purchases |
| GSC | 3,513 clicks, 58,102 impressions, €0 value |
| Email | 0 delivered στο επιλεγμένο window (Brevo connected — quiet window, όχι «μηδενική επιρροή») |

Άλλα live στοιχεία:

- Store MER **31.17x**, profit after ads **€1,150**, aMER **7.97x**, new-customer net 26% / €2,947.
- Insights ρητά grounded: «Till is ahead of the pixel», «Store MER is not Meta ROAS», «Direct is 59% of till».
- Open blockers: CAPI/EMQ (83 till vs 13 pixel), Google Ads spend sync €0, Woo REST tax = 0, email quiet window.
- Sync activity: Brevo 28 rows OK, GA4 205 rows OK, GSC 5480 rows OK, **Google Ads failed** (account `7488715250`, 0 rows).
- 5 of 6 accounts synced. Retail/Wholesale desks €0 — 83 unclassified orders. Το mixed-shop MER δεν βάζει unnamed ads σε desk.
- Notifications: 6 unread στο live org.
- CSV/PDF export ενεργοποιήθηκαν όταν ήρθαν data.

Αυτό είναι το δυνατό σημείο του προϊόντος: **honest operator copy πάνω σε πραγματικά νούμερα**.

### 4.3 Connections (BAGTOBAG)

Τίτλος: «Platform Health Monitoring». Copy: tokens ανά e-shop.

**6 of 9 platforms connected:**

| Platform | Browser |
|---|---|
| Meta Ads | Connected. Account **BTB - B2C**. Sync Now / Reconnect / Disconnect / Open Meta Ads |
| Google Ads | Connected. Account **7488715250**. Sync failed. UI ζητά Basic Access στο Ads API Center. Warning: μην διαλέξεις MCC |
| TikTok Ads | **Connect disabled**. Λείπουν `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` |
| Google Analytics | Connected. Property **GA4 - Bagtobag**. Picker βλέπει και άλλα properties του ίδιου Google login (richgirlboudoir, B2B Rock Club, Thebeautybar, Katabra, manimal) — το UI προειδοποιεί να μην ανακατέψεις brand |
| Search Console | Connected. **bagtobag.com.gr**. Δεύτερο site στο picker: richgirlboudoir.gr |
| WooCommerce | Connected. **bagtobag.com.gr** |
| OpenCart | Disconnected |
| Omnisend | Disconnected |
| Brevo | Connected |

Playbook στο ίδιο desk: CAPI+EMQ, GA4 vs Woo, Unassigned sessions, Google Ads spend sync, Woo VAT. Αυτό είναι operator product, όχι generic SaaS settings.

### 4.4 Campaigns (BAGTOBAG)

Δύο στρώσεις στην ίδια σελίδα:

1. **Studio header (παλιό `Campaign`):** 1 campaign, 0 active, spend €0, budget €80. Αυτό μπερδεύει.
2. **Synced Campaigns (Meta) — αυτό είναι το πραγματικό desk:**  
   - Advantage+ (PUR) // General Campaign — ACTIVE, pixel ROAS 7.47x, spend **€19,611**, reach 2.8M, 2022 pixel purchases, CTR 4.33%, CPC €0.10. Pause / Resume / +20% / Edit on Meta.  
   - B2B (GR+CY) | TR(LPV) — PAUSED, 1.02x, spend €1,639.  
   - Πολλά ακόμα Meta objects με Pause/Resume/Edit. Το snapshot ήταν τεράστιο (~4800 refs) — το operator desk φορτώνει βαθιά.

Create Campaign → Campaign Studio. Platform filter: Meta / Google / TikTok. LinkedIn δεν είναι στο filter του live desk (καλό), αλλά παραμένει στο Zod enum του router.

### 4.5 Billing (live org)

**Honest stub.** Headline: «Workspace usage for this org. Invoices and checkout are not in Ads Pro.»

- Plan: **free** · kotman1979's Workspace
- Live counts: seats, brands, synced AdCampaigns, alert rules
- Connected: 6 accounts · meta · google-search-console · woocommerce · google-analytics · brevo · google
- «There is no Stripe checkout here.»

Ο κώδικας έχει Demo theater (fake invoices INV-2026-*, €99 Professional) **μόνο όταν `isDemo`**. Στο live org δεν εμφανίστηκε. Σωστό gating.

### 4.6 Demo org — StyleVault

Org switcher: `Demo` (viewer · 4 brands · enterprise) και `kotman1979's Workspace` (owner · 1 · free). Create organization υπάρχει.

Demo dashboard μετά το load:

- Brands: StyleVault – Fashion & Lifestyle, SACOS
- Pixel €3,183 / 1,382 conversions / **28.14x ROAS**
- Till €2,695 / 33 orders / Store MER **0.85x** / profit after ads **−€1,621**
- GA4 και GSC **not connected** σε αυτό το shop
- Seed syncs: Google 365 rows, Meta 410, TikTok 290, Woo 48 (12–14 μέρες πριν)
- Top campaigns: Dynamic Product Ads, Brand Awareness – Bags, PMax, TopView, κ.λπ.

Το Demo dashboard **δεν είναι hardcoded charts**. Τρέχει το ίδιο engine πάνω σε seed rows. Γι’ αυτό η copy λέει «Live ads and Woo for StyleVault» και «Generated from this org's blended performance — not sample copy».

### 4.7 Predictions (Demo)

Ρητή ετικέτα: **«Demo theater only — not BAGTOBAG pixel run-rate.»**

11 active predictions, €28,600 potential, 85% AI confidence, tabs Campaigns / Platforms / Budget AI / Creatives / Expert AI, κουμπιά Implement Now / Dismiss. Αφηγήσεις τύπου «15+ years of media buying». Αυτό είναι showcase, σωστά μαρκαρισμένο στο Demo, επικίνδυνο αν ποτέ ξεφύγει σε live org.

### 4.8 Campaign Studio `/campaign-launcher`

Φόρμα ζωντανή: brief, objective (Sales/Traffic/Awareness/Leads/Engagement), landing page, Meta/Google/TikTok, Generate campaign plan. Copy: «Demo workspace is StyleVault sample data only.» Woo catalog prompt αν δεν έχει sync. Launch στο backend μπλοκάρει demo slug.

### 4.9 Chat `/chat`

Ξεχωριστό layout (χωρίς AppSidebar). Δουλεύει.

- Saved conversations στο browser: «Name Pixel ROAS, Woo till, GA4 purchases», «Show blended ROAS for the last 30 days»
- 25 Saki playbooks (Five clocks, wasted spend, MER vs platform ROAS, weekly CEO brief, …)
- Disclaimer: «Verify critical decisions against the dashboard.»
- Send disabled μέχρι να γραφτεί μήνυμα (δεν στάλθηκε νέο μήνυμα σε αυτό το pass)

### 4.10 Email `/email` στο Demo

**Gated σωστά:** «Email desk is live-shop only. Switch out of the demo workspace… This desk never invents email revenue.»

### 4.11 Help `/help`

Πρώτο compile χτύπησε Turbopack `ENOENT` στο `_buildManifest.js.tmp.*`. Η σελίδα έμεινε κενή στο browser. Στον κώδικα είναι static FAQ + demo «Talk to a Human» (`support@adspro.com`, `docs.adspro.com`, YouTube) vs live «There is no 2-hour SLA inbox here.»

### 4.12 Dev server στο τέλος του pass

Μετά από πολλά hot compiles, το `next dev` **έπεσε** με επαναλαμβανόμενα:

```text
ENOENT ... .next/static/development/_buildManifest.js.tmp.*
ENOENT ... .next/server/app/auth/login/page/app-build-manifest.json
```

Αυτό είναι local Turbopack flake υπό φόρτο, όχι λογικό bug του billing desk. Σημαίνει όμως ότι το dev loop δεν είναι ακόμα «set and forget».

---

## 5. Τι δουλεύει vs τι είναι theater vs τι λείπει

Κλίμακα: **WORKING** = live path αποδείχθηκε σε κώδικα και/ή browser. **PARTIAL** = υπάρχει αλλά ρηχό, σπασμένο, ή dual-mode. **THEATER** = Demo/landing μόνο. **STUB / MISSING** = δεν είναι προϊόν.

| Επιφάνεια | Status | Απόδειξη |
|---|---|---|
| Supabase login + protected shell | WORKING | Browser session, middleware 307 |
| Org switcher + RBAC | WORKING | Demo viewer vs live owner |
| BAGTOBAG dashboard five clocks | WORKING | Pixel/till/GA4/GSC/email με πραγματικά νούμερα |
| Connections OAuth/REST | WORKING | 6/9 connected, Sync Now, property pickers |
| Meta operator desk | WORKING | Synced campaigns, Pause/Resume/+20%, Edit on Meta |
| Woo till / Customers path | WORKING | 83 orders, MER, tax=0 honesty |
| GA4 + GSC desks | WORKING | Sync completed, clocks named |
| Brevo email sync | WORKING | Connected. Desk gated στο Demo. Quiet window στο live |
| Reports CSV/PDF | WORKING | Κουμπιά ενεργά με data |
| Budget alerts / notifications badge | WORKING | 6–8 unread |
| AI chat + playbooks | WORKING | Saved threads + 25 playbooks |
| Mystery AI | WORKING στον κώδικα | Δεν ανοίχτηκε σε αυτό το pass. Backend πάνω σε top campaigns |
| Onboarding | PARTIAL | Banner «First session» ακόμα στο BAGTOBAG |
| Campaign Studio launch | PARTIAL | UI ζωντανό. Meta πλήρες-ish. Google θέλει Basic Access token. TikTok shell |
| Google Ads spend | PARTIAL | OAuth on, DailyMetric €0, last sync failed |
| TikTok | PARTIAL | UI υπάρχει. Local Connect disabled χωρίς app credentials |
| Bidding | PARTIAL | Live = suggestions, δεν γράφει bids |
| Predictions | PARTIAL / THEATER | Live = heuristics. Demo = fake forecast deck |
| Attribution live | PARTIAL | Till vs pixel honesty. Multi-touch journeys = Demo only |
| Analytics / Funnel / Audiences / Cross-platform / Studio / Mission Control | PARTIAL | Live desks στον κώδικα. Demo = StyleVault/DEMO_* charts |
| Realtime | PARTIAL | Live org monitor vs Demo simulated stream |
| Settings / Profile | PARTIAL | Live prefs + Demo theater toggles / fake identity |
| Billing | STUB (honest στο live) | Καμία Stripe ροή |
| Help | STUB | Static + vapor docs. Browser compile flake |
| Landing Watch Demo / footer / pricing | THEATER | Dead buttons, `#` links, φανταστικά stats |
| LinkedIn Ads | MISSING | Enum μόνο |
| Microsoft Ads | MISSING | By design |
| Shopify | MISSING | Landing only |
| Stripe subscriptions | MISSING | Env keys optional, UI δεν τα χρησιμοποιεί |
| Enterprise SSO | MISSING | README roadmap |
| Trained forecasting / autonomous optimization | MISSING | Marketing claim |
| Production WebSocket | MISSING από compose | Υπάρχει μόνο `dev:ws` |
| Playwright e2e | MISSING ως ποιότητα | Stale specs, εκτός CI |

---

## 6. Docs drift (README vs πραγματικότητα)

| README / landing λέει | Πραγματικότητα |
|---|---|
| Auth: Clerk | Supabase Auth |
| Next 14+ | Next 15.5 |
| Deploy: Vercel | Docker + Caddy |
| LinkedIn + Shopify | Δεν είναι integrations |
| «Enterprise Security / SOC2 ready» | Marketing. Υπάρχει πραγματικό authz + encryption, όχι SOC2 evidence |
| `src/server/api/routers` | `src/lib/trpc/routers` |
| docs.adspro.com / Discord | Δεν υπάρχουν ως προϊόν |
| Automated optimization + 97% forecast | Heuristics + Demo theater |
| `.env.example` ακόμα έχει Clerk key | `env.ts` δεν έχει Clerk |

Πηγή αλήθειας για env: `.env.local.example` + `.env.production.example` + `src/env.ts`. Το root `README.md` είναι stale.

---

## 7. Κενά που φάνηκαν στο BAGTOBAG (όχι θεωρία)

Αυτά είναι **shop-side / sync** δουλειά, και το ίδιο το UI τα ονομάζει:

1. **CAPI + Event Match Quality.** 83 till orders vs 13 pixel conversions. Purchase είναι browser-only / blocked / unmatched.
2. **Google Ads spend sync.** OAuth υπάρχει, DailyMetric google = €0. Woo last-click Google (€3,636 / 23 orders) είναι till, όχι Ads spend. Developer token πιθανόν test-only — UI ζητά Basic Access.
3. **Woo REST tax = 0.** Το Net ex VAT = store net. Μην εφεύρεις 24% ΦΠΑ.
4. **Email window.** Brevo connected, 0 delivered στο 30ήμερο. Άνοιξε Email desk σε 180 ημέρες.
5. **Unclassified till.** 83 παραγγελίες δεν μπαίνουν Retail/Wholesale desks. Mixed shop MER μένει «unnamed».
6. **GA4 property picker** βλέπει ξένα shops του ίδιου Google login. Το UI προειδοποιεί. Ένα λάθος click ανακατεύει traffic.
7. **Header vs Meta desk** στο `/campaigns` λέει δύο διαφορετικές αλήθειες (Studio campaign vs synced Advantage+).

---

## 8. Τι είναι επόμενο (προτεραιότητες)

Ομαδοποιημένο σε 30 / 60 / 90 ημέρες. Σειρά με βάση leverage, όχι όγκο σελίδων.

### Τώρα (ημέρες 1–14) — κάνε το αληθινό προϊόν αληθινό και προς τα έξω

1. **Ξαναγράψε README + landing ώστε να ταιριάζουν με τον κώδικα.** Supabase, Next 15, Docker. Πλατφόρμες: Meta, Google Ads, GA4, GSC, TikTok, Woo, OpenCart, Brevo, Omnisend. Βγάλε LinkedIn, Shopify, Clerk, Vercel, 500+ brands, 97% accuracy. Σύνδεσε ή σκότωσε το `Watch Demo`. Φτιάξε footer links ή αφαίρεσέ τα.
2. **Ενοποίησε sync path.** Workers να χρησιμοποιούν τους ίδιους Graph/REST fetchers με το `/api/sync`. MCP μόνο αν αποδειχθεί σε prod. Πρόσθεσε `npm run worker` script.
3. **Google Ads Basic Access + επιτυχές Sync Now** για BAGTOBAG, ώστε το Pixel ROAS να μην είναι Meta-only.
4. **Campaigns header.** Μην δείχνεις Studio `Campaign` totals (€0) δίπλα σε synced Advantage+ (€19k). Ένα desk, μία αλήθεια.
5. **Επιβεβαίωσε Demo gating** σε Predictions / Attribution / Audiences / Analytics Studio ώστε `DEMO_*` να μην μπορεί να renderάρει όταν `!isDemo`.
6. **Άφησε το live org στο BAGTOBAG** μετά από αυτό το audit (το session έμεινε στο Demo).

### 30 ημέρες — operator completeness για ένα shop

7. CAPI playbook μέχρι αποδείξιμο κλείσιμο του χάσματος 83 vs 13 (shop-side, όχι Ads Pro write).
8. Woo tax re-sync αφού ανοίξει το tax στο REST.
9. TikTok: είτε βάλε credentials και σύνδεσε, είτε κατέβασε το Connect σε «coming when env is set» χωρίς disabled-dead card.
10. Persist notification prefs ή βγάλε το Settings theater.
11. Help page: πραγματικά playbooks (CAPI, Google token, Woo VAT) αντί για `docs.adspro.com`.
12. Invite accept: public path + redirect `/auth/login`.
13. Σταθεροποίησε Turbopack flake ή τρέχε `next dev` χωρίς `--turbopack` αν ο crash επαναλαμβάνεται.

### 60 ημέρες — ποιότητα που επιτρέπει δεύτερο πελάτη

14. Playwright ξανά από το μηδέν πάνω στα πραγματικά routes (`/auth/login`, `/dashboard`, `/connections`, `/campaigns`). Βάλ’ το στο CI με storageState, όχι `?mock_auth=true`.
15. Billing απόφαση: είτε Stripe αληθινό, είτε βγάλε τη σελίδα από το nav και τα Stripe env/CSP leftovers. Μην αφήνεις fake invoices στο Demo να μοιάζουν με προϊόν.
16. Document ή συγχώνευσε `Campaign` vs `AdCampaign`. Βγάλε `linkedin` από launch enums.
17. Predictions: μετονόμασε σε «Operator outlook». Σβήσε ή γράψε το `Prediction` table. Μην πουλάς forecast accuracy.
18. WebSocket στο production compose ή αφαίρεσε το live badge μέχρι να υπάρχει process.

### 90 ημέρες — ανάπτυξη προϊόντος (μόνο μετά τα παραπάνω)

19. Δεύτερο live brand (ο picker ήδη βλέπει richgirlboudoir / manimal / κ.λπ. — μην τα ανακατέψεις στο BAGTOBAG).
20. TikTok launch βάθος πέρα από campaign shell, **ή** μόνιμο badge «shell only».
21. Meta bid writes μόνο αν το θέλετε ρητά. Σήμερα το Bidding είναι suggest-only — σωστό default.
22. Μην χτίζετε Microsoft/LinkedIn/Shopify μέχρι να σταθεροποιηθεί το Google spend sync και το CAPI gap.
23. Αν το προϊόν είναι private operator για BAGTOBAG + λίγα shops: σταμάτα το SaaS pricing theater. Αν είναι SaaS: τότε Stripe, plan gating, docs, e2e είναι blockers, όχι nice-to-have.

---

## 9. Τι να μην κάνετε τώρα

- Μην προσθέσετε νέες Intelligence σελίδες. Έχετε ήδη ~30 routes. Η αξία είναι στα πέντε ρολόγια και στο Meta desk.
- Μην συνδέσετε Stripe «για να υπάρχει billing» πριν αποφασίσετε αν αυτό είναι SaaS ή private OS.
- Μην εμπιστευτείτε το υπάρχον Playwright ως απόδειξη ποιότητας.
- Μην προσθέσετε LinkedIn επειδή το αναφέρει το README.
- Μην αθροίζετε Pixel ROAS + till + GA4 purchases σε ένα νούμερο. Το προϊόν το λέει σωστά. Η landing το λέει λάθος.

---

## 10. Scorecard

| Άξονας | Βαθμός | Σχόλιο |
|---|---|---|
| Live data honesty (BAGTOBAG) | Υψηλό | Five clocks, blockers, MER ≠ ROAS |
| Meta operator | Υψηλό | Synced objects + writes |
| Commerce till | Υψηλό | Woo orders, profit after ads, tax honesty |
| Connections UX | Υψηλό | 6/9, playbooks, property warnings |
| AI chat | Μεσαίο-υψηλό | Playbooks + grounded tools. LLM keys optional |
| Google Ads | Μεσαίο-χαμηλό | OAuth ναι, spend rows όχι |
| TikTok | Χαμηλό | UI χωρίς local credentials |
| Campaign Studio | Μεσαίο | UI ναι, launch βάθος άνισο |
| Predictions / landing claims | Χαμηλό | Theater vs live |
| Billing | Honest stub | Σωστό στο live, λάθος στη landing |
| Docs / README | Κακό | Clerk/Vercel/LinkedIn |
| E2E / UI tests | Κακό | Stale Playwright, σχεδόν καθόλου page tests |
| Production ops shape | Καλό | Docker/Caddy/CI smoke. Workers όχι στο `npm run dev` |
| Dev loop stability | Μέτριο | Turbopack crash μετά από μεγάλο browse |

**Συνολικά:** το project έχει περάσει από «AI demo app» σε **πραγματικό operator desk για ένα e-shop**. Το επόμενο άλμα δεν είναι νέα features. Είναι αλήθεια προς τα έξω (landing/README), Google spend που γράφει rows, ένα sync path, και e2e που δοκιμάζει τις σελίδες που υπάρχουν.

---

## 11. Browser pass log (σύντομο)

| URL | Αποτέλεσμα |
|---|---|
| `/` | Hero OK. Watch Demo νεκρό. Footer `#` |
| `/api/health` | 200, db+redis, migrations failed=0 |
| `/dashboard` unauth | 307 login |
| `/dashboard` BAGTOBAG | Live five clocks |
| `/connections` | 6/9 connected, TikTok disabled, Google fail |
| `/campaigns` | Meta desk ζωντανό. Header dual-model bug |
| `/billing` | Honest free plan, no Stripe |
| Org switch → Demo | StyleVault seed dashboard |
| `/predictions` Demo | Theater, σωστά μαρκαρισμένο |
| `/campaign-launcher` | Studio form ζωντανή |
| `/chat` | Playbooks + saved threads |
| `/email` Demo | Gated, no invented revenue |
| `/help` | Compile flake / κενή σελίδα σε αυτό το pass |
| Dev server | Crash Turbopack ENOENT στο τέλος |

---

*Audit από κώδικα + live browser στις 4 Σεπτεμβρίου 2026. Δεν περιέχει secrets, tokens ή passwords.*
