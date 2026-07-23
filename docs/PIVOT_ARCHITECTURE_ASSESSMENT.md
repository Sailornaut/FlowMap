# TrafficScout — Pivot Architecture Assessment

**Date:** 2026-07-21
**Repo state assessed:** `main` @ `305853e` ("Reduce Supabase auth lock contention"), working tree clean except an uncommitted deletion of `TrafficScoutLogo.png` at the repo root.
**Purpose:** Ground-truth inventory of the existing customer-facing SaaS before pivoting to an internal CRE (commercial real estate) intelligence platform. Nothing in this document is aspirational; every claim below was verified by reading the code.

---

## 1. Existing architecture summary

### 1.1 Frontend
- **Framework:** React 18 + Vite 6, plain JavaScript/JSX (no TypeScript sources). `npm run typecheck` runs `tsc -p jsconfig.json`, but `checkJs: false` means JS files are **not actually type-checked** — the script only validates config-level errors.
- **UI kit:** Tailwind 3 + shadcn/ui ("new-york" style, Radix primitives) in `src/components/ui/`. Nine of those files are **zero bytes** (`table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`, `use-toast`) — they were emptied, and nothing imports them, so the build survives.
- **Routing:** `react-router-dom` 6. Routes: `/` (marketing Landing), and behind auth: `/app` (Analyze), `/dashboard`, `/saved`, `/profile`. `NavigationContext` implements tab-stack transitions.
- **State/data:** TanStack Query 5 (`saved-locations`, `account-summary` queries), React context for auth.
- **Charts:** Recharts (`HourlyChart`, `WeeklyChart`, `DemographicChart`, Dashboard comparison chart) plus a hand-rolled SVG `TrafficScoreGauge`.
- **Map:** `react-leaflet` 4 in `src/components/analysis/LocationMap.jsx` (marker + click-to-analyze). No property boundaries, no polygons, no heatmaps.

### 1.2 Backend
- **A single Express 5 monolith:** `server/index.js` (~1,170 lines). Everything lives here: CORS, Stripe billing, Supabase auth verification, usage metering, caching, rate limiting, and the analysis endpoint. There is **no module structure** on the server.
- **Endpoints:** `GET /api/health`, `GET /api/account`, `POST /api/billing/checkout`, `POST /api/billing/addon-checkout`, `GET /api/billing/checkout-status`, `POST /api/billing/portal`, `POST /api/stripe/webhook`, `POST /api/analyze`.
- **No scheduled jobs, queues, or serverless functions.** The only webhook is Stripe's. The server is a long-running process (deployed to Render per the README).

### 1.3 The analysis engine — critical finding
`POST /api/analyze` sends the geocoded location (name, address, lat/lng, place type, context string) to OpenAI `gpt-5-mini` via the Responses API with a strict JSON schema, and the model **invents the entire analysis**: `traffic_score`, `peak_hours`, `daily_pattern`, `nearby_pois`, `demographics`, `estimated_daily_foot_traffic`, `business_suitability`.

- There are **no ground-truth data sources** in the system other than Mapbox geocoding. No census/demographics API, no POI API, no traffic counts, no drive-time isochrones.
- The prompt does instruct the model to "be realistic and conservative" and not to "pretend you have live sensor data," and the schema is strictly validated — but every number and every "nearby POI" is model-fabricated.
- `src/lib/analysis-service.js` is an even older, fully deterministic **mock generator** (seeded pseudo-random data). It is **imported by nothing** — dead code from before the OpenAI integration.

**Implication for the pivot:** the mandate "AI must not be the source of truth for traffic counts, demographics, business locations, or numeric scores" is violated by the *entire current product*, not by an edge case. The pivot's core engineering work is building a grounded data/scoring pipeline, not removing SaaS chrome. Nothing in the current analysis payload can be carried into a sellable report without re-sourcing.

### 1.4 Database schema (Supabase Postgres)
Single file `supabase/schema.sql`, idempotent (`create table if not exists`), **no migration framework, no versioning, no down migrations**:

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | 1:1 with `auth.users` (trigger-created) | `billing_tier` (`free`/`pro`/`business`), `stripe_customer_id` |
| `subscriptions` | Stripe subscription mirror | keyed by Stripe sub id, synced from webhooks |
| `usage_events` | analysis-run + credit-purchase metering | JSONB `metadata` |
| `saved_locations` | user's saved analyses | **entire analysis payload in one unvalidated JSONB blob** |

RLS is enabled on all four tables: `select`-own everywhere; `insert`/`delete`-own only on `saved_locations`. All other writes go through the **service-role key on the server** — a sane privilege split.

### 1.5 Supabase usage
- **Auth:** magic-link OTP (`signInWithOtp`) from the client; the server validates bearer tokens with `supabase.auth.getUser()` using the service-role client; `ensureProfile` upserts a profile per request. A DB trigger (`on_auth_user_created`) also creates profiles. **Sign-up is open** — anyone who enters an email gets an account.
- **Database:** as above. **Storage:** not used. **Edge functions:** not used. **Realtime:** not used.
- Service-role key is server-only (env), anon key is in the browser (correct).

### 1.6 External services and integrations
| Service | Where | Used for |
|---|---|---|
| Mapbox Geocoding v6 | client (`src/lib/mapbox.js`), public token | forward/reverse geocode + autocomplete |
| OpenAI (`gpt-5-mini`, Responses API) | server | fabricates the whole analysis (see 1.3) |
| Stripe | server + webhook | Pro $9/mo subscription, $5 one-time analysis add-on, billing portal |
| Supabase | both | auth + Postgres |
| Upstash Redis | server, optional | shared analysis cache (7-day TTL) + IP rate limit (15/hr); in-memory fallback |
| Sentry | both | error monitoring + tracing |
| Google Ads (`gtag`, AW-18036805720) | `index.html` | conversion tracking for the SaaS funnel |
| OpenStreetMap tiles (via Leaflet) | client | base map |

### 1.7 Billing & usage limits
Fully wired Stripe integration: checkout (subscription + one-time add-on), customer portal, webhook signature verification, subscription sync, idempotent credit granting, `PLAN_LIMITS` (free = 3 lifetime analyses + purchased credits; pro/business unlimited). UI coupling: `Profile.jsx`, `CheckoutStatusBanner.jsx`, `plan-config.js`, upgrade buttons in `AppLayout`, plan copy in `AuthScreen` and `Landing`.

### 1.8 Report/export functionality
**None.** `jspdf` and `html2canvas` are in `package.json` but are imported nowhere. There is no report model, no export path, no print styling. The report system is a green-field build.

### 1.9 Deployment & environment
- **Frontend:** Vercel static hosting (`vercel.json` rewrites everything except `/api/*` to `index.html`).
- **API:** Render (per README; `VITE_API_BASE_URL` points the client at it). CORS allowlist hardcodes `gettrafficscout.com` + subdomains + localhost, plus `ALLOWED_ORIGIN` env.
- **Env vars:** documented in `.env.example` — Mapbox token, OpenAI key, Supabase URL/anon/service-role, Stripe keys + 3 price IDs, Sentry DSNs, Upstash creds, cache/rate-limit tuning. Env validation is **lazy** (each `getXClient()` throws on first use) — no startup validation.
- `.env.local` exists on disk with real secrets; it is gitignored (verified).

### 1.10 Tests & CI
**Zero tests. No CI configuration.** Validation is `npm run build`, `npm run lint`, and the non-checking `typecheck`.

### 1.11 Dead code & unused dependencies (verified by grep)
- `src/lib/analysis-service.js` — unimported mock generator.
- Empty directories: `entities/`, `src/api/`.
- Zero-byte shadcn stubs listed in 1.1 (nothing imports them).
- `DemographicsChart.jsx` (46 bytes) is just a re-export shim of `DemographicChart.jsx` — used by `SavedLocations.jsx`.
- Unused npm dependencies (imported nowhere in `src/` or `server/`): `jspdf`, `html2canvas`, `react-quill`, `three`, `moment`, `lodash`, `canvas-confetti`, `@hello-pangea/dnd`, `@stripe/react-stripe-js`, `@stripe/stripe-js` (checkout is a URL redirect; Stripe.js never loads), `embla-carousel-react` (only via the unused `carousel.jsx`), `input-otp` (only via unused `input-otp.jsx`), `react-day-picker` (only via unused `calendar.jsx`).
- README is stale: claims "Saved locations are still stored in browser localStorage" — they are in Supabase.

---

## 2. Current user flow

```
Visitor → Landing (/) — SaaS marketing, pricing, mailto contact
       → "Get started" → /app → AuthScreen (magic-link email, open signup)
       → email link → /app (Analyze)
            Search (Mapbox autocomplete) or click map
            → POST /api/analyze  (auth → rate limit → cache → usage limit → GPT fabricates payload)
            → AnalysisPanel (gauge, hourly/weekly charts, demographics pie, fake POIs)
            → Save → saved_locations (JSONB)
       → /dashboard — aggregate stats over saved locations + checkout status banner
       → /saved — list, filter, detail dialog, delete
       → /profile — plan/usage, Stripe checkout/portal, $5 add-on, clear data, sign out
Stripe webhook → subscription/profile sync (server-side)
```

---

## 3. Component disposition

### Category 1 — Keep unchanged
| Component | Reasoning |
|---|---|
| Supabase Auth (magic link) + RLS pattern | Working, secure, integrated. Safer to *restrict* (invite-only, roles) than to replace. See §4. |
| `src/lib/mapbox.js` | Clean, normalized geocoding client. Directly reusable for property address entry. |
| `src/lib/supabase.js`, session caching | Solid client bootstrap; keep. |
| Chart components (`HourlyChart`, `WeeklyChart`, `DemographicChart`, `TrafficScoreGauge`, `StatCard`, `NearbyPOIList`) | Presentation-only, data-shape-agnostic enough to reuse in the analyst workspace and report previews. |
| `LocationMap.jsx` (Leaflet) | Reusable base; will gain boundary/trade-area layers later, but works as-is. |
| shadcn/ui kit, Tailwind, Vite toolchain | Foundation of the new internal UI. |
| Sentry monitoring (both sides) | Keep as-is. |
| Server cache + rate-limit utilities (Upstash/memory) | Generalize keys, but the mechanism directly serves the new cost-control requirements. |
| Vercel + Render deployment shape | No reason to change hosting during the pivot. |

### Category 2 — Keep but refactor
| Component | Refactor | Dependencies to respect |
|---|---|---|
| `server/index.js` | Split into `server/routes/*`, `server/services/*`, shared `src/domain/*`. Currently every concern is interleaved; the analysis pipeline cannot be built inside this file. | Stripe webhook raw-body ordering; CORS middleware ordering. |
| `POST /api/analyze` | Becomes the staged, provenance-tracking pipeline. The OpenAI call survives only as the **narrative** stage, grounded in structured inputs. | Cache keying, usage recording call sites. |
| `AuthContext.jsx` | Strip `billing_tier` coupling; add `role`. Keep session logic. | `AppLayout`, `Profile`, `Analyze` consume it. |
| `AppLayout.jsx` | New IA (Dashboard/Properties/Analyses/Reports/Data Sources/Methodology/Settings); remove plan badge + upgrade buttons. | NavigationContext tab roots list must change in lockstep. |
| `Dashboard.jsx` | Repurpose as the ops dashboard (active analyses, reports awaiting review, data failures, cost). | Currently reads `saved_locations`; will read new tables. |
| `saved_locations` data + `SavedLocations.jsx` | Superseded by Properties/Analyses. Keep table + page read-only during migration so history isn't lost; migrate rows into `properties`+`analysis_runs` where useful. | Dashboard aggregates read it today. |
| `api-client.js` | Keep the auth-header fetch wrapper; billing functions deprecated with billing. | |
| OpenAI client usage | Keep client + strict-schema pattern (it's the right pattern); change what it's *for* (narratives, not facts). | |
| `Landing.jsx` | Rewrite as the outcome-focused marketing site (Phase 6). Until then it keeps working. | Contains SaaS pricing copy tied to `plan-config`. |

### Category 3 — Deprecate after replacement (do not delete yet)
| Component | Why not delete now | Replacement trigger |
|---|---|---|
| Stripe billing (all `/api/billing/*`, webhook, `subscriptions`, `stripe_customer_id`) | There may be live paying subscribers (`business` legacy tier exists in code). Cancel/refund is a business action, not a code deletion. Webhook removal before Stripe dashboard cleanup would cause silent failures. | Phase 7, after confirming zero active subscriptions in Stripe. |
| `usage_events` + `PLAN_LIMITS` enforcement | Metering shape is reused for per-analysis **cost tracking**; keep table, deprecate the *limit enforcement*. | Cost-tracking events land in Phase 3. |
| `Profile.jsx` billing UI, `CheckoutStatusBanner`, `plan-config.js` | Harmless while auth still works; removing early breaks the current app with nothing to replace it. | Phase 6/7. |
| Open public signup | Must be closed early (see §4) but via Supabase config + server-side allowlist, not code deletion. | Phase 1 hardening. |
| Google Ads tag | SaaS funnel tracking; pointless for internal tool but harmless. | Phase 6 with the new public site. |
| Free-tier add-on purchase flow | Same as billing. | Phase 7. |

### Category 4 — Remove (safe now; nothing depends on them)
- `src/lib/analysis-service.js` (unimported mock).
- Empty `entities/` and `src/api/` directories.
- Zero-byte `src/components/ui/*` stubs (or restore real implementations when a feature needs them — `table`, `tabs`, `textarea`, `tooltip` will likely be re-added properly for the workspace UI).
- Unused npm deps listed in §1.11 (each removal verified by grep before uninstalling; done in Phase 7 to keep early diffs small).
- Stale README claims.

---

## 4. Authentication decision

**Decision: keep Supabase Auth. Do not replace it.**

What it currently protects, verified:
- **API routes:** every `/api/*` route except `health` and the Stripe webhook requires a valid Supabase bearer token (server-side `auth.getUser`).
- **Row-level security:** all four tables, owner-scoped.
- **Storage / serverless / report files:** not applicable today (unused), but Supabase Storage + RLS is the natural home for report assets later, which is itself an argument for keeping the auth system.
- **Secrets/privileged operations:** service-role key is confined to the server process.

It is integrated, working, and already follows the correct privilege split. Replacing it would re-open every solved problem (token verification, session refresh, RLS identity) for zero gain.

**Required changes for internal use:**
1. Disable public sign-ups in the Supabase dashboard (Auth → providers → email → disable sign-ups) — config, not code.
2. Add `role` (`admin` | `analyst`) to `profiles`; **server-side allowlist check**: unknown or role-less users get 403 even if they somehow hold a session. Do not rely on the dashboard toggle alone.
3. Remove the auto-provisioning `on_auth_user_created` trigger behavior for uninvited users (or keep the trigger but leave `role` NULL = no access).
4. Invitation flow: admin creates users via service-role (`auth.admin.inviteUserByEmail`) from a Settings screen.
5. Magic-link stays — it's ideal for a 1–3 person internal team.

**Never exposed publicly:** service-role key (already safe), internal routes (to be enforced by role middleware), report drafts, scoring configuration, prompt templates.

---

## 5. Security implications of the pivot

1. **Open signup must close first.** Today anyone can create an account and consume OpenAI budget (3 free analyses each). This is the single most urgent hardening item and is independent of the refactor.
2. **The proprietary asset changes.** In the SaaS, the asset was uptime; in the pivot it is the scoring methodology, prompt templates, category weight tables, and unreleased report drafts. All must live server-side or behind role-checked routes; none may ship in the client bundle.
3. **Prompt injection surface appears in Phase 3+** when scraped listing pages, uploaded documents, and public-form free text enter the pipeline. All external text must be treated as data (delimited, never concatenated into system prompts; schema-validated outputs; no tool-use driven by document content).
4. **Public form (Phase 6)** needs rate limiting (the existing limiter generalizes), input validation, upload type/size checks, and must not trigger paid analysis without an authenticated analyst approving it.
5. **Report distribution:** finalized PDFs are client deliverables — store privately (Supabase Storage), share via signed, expiring URLs; audit-log finalization and shares.
6. **Contact/ownership data** (prospecting) is business-contact PII: store source + verification date, honor "do not contact," no scraped personal data.

---

## 6. Highest-risk assumptions (carried into MIGRATION_PLAN.md)

1. **Data availability is the whole ballgame.** The pivot presumes real demographic/traffic/POI/rent-comp sources can be integrated at acceptable cost (Census/ACS: free; POI: Google Places / Foursquare / Overture; traffic counts: state DOT AADT feeds; rent comps: largely *manual analyst entry* — no affordable API exists). If a source class is unavailable, the confidence framework must degrade honestly rather than silently reverting to AI guesses.
2. **Existing paying subscribers** may exist; billing teardown is a business decision with refund implications.
3. **Single-analyst assumption:** the review workflow is designed for one internal user initially; role model must not paint us into a corner if analysts are added.
4. **PDF generation** on Render's resource limits (see TARGET_ARCHITECTURE.md §7 tradeoffs).
5. **JS-not-TS:** "strict typing" will be delivered via JSDoc + `checkJs` on new domain modules and zod runtime validation at boundaries, rather than a disruptive whole-repo TS conversion mid-pivot. New files may be `.ts` where isolated.
