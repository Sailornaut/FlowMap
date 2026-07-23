# TrafficScout Pivot — Status Log

Running record of the SaaS → internal CRE-intelligence pivot: findings, decisions, implemented slices, verification results, and pending actions. Companion docs: `PIVOT_ARCHITECTURE_ASSESSMENT.md` (ground-truth inventory), `TARGET_ARCHITECTURE.md`, `DATA_MODEL.md`, `REPORT_SCHEMA.md`, `MIGRATION_PLAN.md` (7 phases).

**Current phase: Phase 1 — assessment & stabilization (in progress).**

---

## 1. Findings summary (from repository inspection, 2026-07-21)

Assessed at `main` @ `305853e`. Full detail in `PIVOT_ARCHITECTURE_ASSESSMENT.md`.

1. **Architecture:** React 18 + Vite SPA (plain JSX, shadcn/Tailwind, react-leaflet, Recharts) + one 1,170-line Express monolith (`server/index.js`) + Supabase (magic-link auth, 4 tables, RLS) + Stripe billing + optional Upstash cache/rate-limit + Sentry. Deployed: Vercel (SPA) / Render (API).
2. **Critical finding — the analysis is fabricated.** `POST /api/analyze` has `gpt-5-mini` invent the entire payload (traffic score, hourly/daily patterns, demographics, *nearby POIs*, foot-traffic estimate) from nothing but a geocoded address. Mapbox geocoding is the only real data source in the system. The pivot's core engineering work is therefore a **grounded pipeline**, not SaaS removal. Nothing in current analysis payloads is usable in a sellable report.
3. **User flow:** open magic-link signup → analyze (auth → IP rate limit → cache → lifetime usage limit → GPT) → save JSONB blob → dashboard/saved/profile with Stripe upgrade paths ($9/mo Pro, $5 add-on).
4. **No tests, no CI, no migration framework, no report/export code** (`jspdf`/`html2canvas` installed but unused). `npm run typecheck` checks nothing (`checkJs: false`).
5. **Dead weight:** unimported mock `src/lib/analysis-service.js`, empty `entities/` and `src/api/` dirs, nine zero-byte shadcn stubs, ~14 unused npm deps, stale README claims.
6. **Security posture:** service-role key correctly server-only; RLS sane; but **signup is open** — any stranger can register and spend OpenAI budget. Closing this is the top hardening item.

### Component disposition (detail in assessment §3)
- **Keep unchanged:** Supabase Auth + RLS, Mapbox client, Leaflet map, chart components, shadcn kit, cache/rate-limit utilities, Sentry, deployment topology.
- **Keep but refactor:** Express monolith → routes/services/pipeline; `/api/analyze` → 17-stage grounded pipeline; AuthContext (roles, not billing tiers); AppLayout/Dashboard for new IA; `saved_locations` → explicit property/analysis models.
- **Deprecate after replacement (Phase 7):** all Stripe billing, usage limits, plan config/UI, SaaS landing copy, Google Ads tag. Not deleted early — live subscribers may exist.
- **Remove (safe now):** mock generator, empty dirs, zero-byte stubs, unused deps.

### Key decisions
- **Keep Supabase Auth**, invite-only + `profiles.role` (`admin`/`analyst`); server-side role checks, never dashboard-toggle alone.
- **Incremental migration, not a rewrite** — the working 20% is reusable; the risky part (grounded pipeline) is new either way.
- **PDF via @react-pdf/renderer** (deterministic vector output, pure Node on Render); maps as Mapbox Static Images; charts as shared spec→SVG functions. Tradeoffs in `TARGET_ARCHITECTURE.md` §7.
- **Typing:** JSDoc + `// @ts-check` on new modules + zod at boundaries; no mid-pivot TS conversion.
- **Rent analysis:** two report shapes only — `supported` (with comps, basis, assumptions, dates, confidence, non-appraisal disclaimer) or `insufficient_data`. No third shape.
- **External data plan:** Census/ACS (free, authoritative), DOT AADT counts (free, patchy), OSM/Overture or Places for POIs, Mapbox isochrones for trade areas; **rent comps are analyst-entered** (no affordable API). Estimated ongoing cost ≈ $10–100/mo at low volume; OpenAI demoted to narratives only.

### Highest-risk assumptions
1. Data-source availability/quality — confidence must degrade honestly, never fall back to AI guesses.
2. Possible live Stripe subscribers → billing teardown is a business action (cancel/refund) before code deletion.
3. Review workflow designed single-analyst; role model must extend to more analysts without rework.
4. PDF generation within Render's resource limits.

---

## 2. Implemented slices

### Slice 1 — docs + domain foundation + role migration *(2026-07-21)* ✅
- `docs/` — the five pivot documents.
- `src/domain/taxonomy/` — versioned taxonomy (v1.0.0): 19 sectors, 33 categories with attribute profiles (sqft ranges, dayparts, sensitivities, co-tenancy, physical requirements); `validateTaxonomy()`, `isSqftCompatible()`.
- `src/domain/confidence/` — deterministic 4-level confidence model (v1.0.0) with hard floors (tier-4 sources and <35% completeness can never exceed *Insufficient*; scraped tier-3 can never reach *High*); conservative `combineConfidence()`.
- `supabase/migrations/0001_add_profile_roles.{up,down}.sql` — adds `profiles.role` (`admin`/`analyst`, NULL = no access), `invited_by/at`, `schema_migrations` table; seeds the owner as admin. Reversible.
- Test infra: vitest + `npm test`; 23 tests.
- **Additive only:** nothing imports the new modules yet → zero behavior change.

**Verification:** `vite build` ✅ · 23/23 tests ✅ · `tsc` typecheck ✅ · eslint ✅ (run in the cloud container — the repo's `node_modules` are macOS-installed and can't execute in the session's Linux VM; that VM build error is environmental, not code).

### Slice 2 — env validation + internal-role gate *(2026-07-21)* ✅
- `server/env.js` — pure `validateEnv()`: required vars (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) vs feature-scoped optional vars; fatal in production, loud warning in development.
- `server/access-control.js` — pure `hasInternalAccess()` / `isAdmin()` over `profiles.role`.
- `server/index.js` — calls `validateEnv` at startup (production boot with missing required vars exits 1); `POST /api/analyze` now returns **403 `internal_access_required`** unless the profile has an internal role. A valid session alone is intentionally insufficient.
- Tests for both modules (env: 5, access-control: 4).
- **Behavior change (intended):** non-staff accounts can no longer run analyses. Legacy billing/account routes deliberately untouched so any existing subscriber can still reach the Stripe portal to cancel.

**Verification:** see log below (updated per slice).

---

## 3. Pending owner actions

| # | Action | Why | Status |
|---|---|---|---|
| 1 | Run `npm install` in the repo | picks up vitest so `npm test` works locally | ☐ |
| 2 | Apply `supabase/migrations/0001_add_profile_roles.up.sql` in the Supabase SQL editor | creates `profiles.role`, seeds `davidshoemaker@gameplan.tech` as admin. **Required before deploying slice 2** — without it, every analyze call 403s, including yours | ☐ |
| 3 | Supabase dashboard → Auth → Providers → Email → **disable sign-ups** | closes open registration | ☐ |
| 4 | Check Stripe dashboard for active subscriptions | gates Phase 7 billing teardown | ☐ |
| 5 | Delete `_to_delete/` in the repo | stale git lock files parked there (the session sandbox can't unlink on the mount) | ☐ |
| 6 | Commit the pivot changes with git locally | git run through the session leaves stale `.git/index.lock` files — run git yourself | ☐ |

## 4. Next steps (Phase 1 → 2)

1. Remove safe dead code (mock `analysis-service.js`, empty dirs) + fix stale README — small cleanup slice.
2. Phase 2 migrations: `data_sources`, `source_observations`, `properties`, `tenants`, `vacancies`, `analysis_runs`, `analysis_stage_results`, `methodology_versions`, `cost_events` (+ RLS) per `DATA_MODEL.md`.
3. Taxonomy/methodology DB seed script from `src/domain/taxonomy`.
4. Fixtures for the six required scenario properties; `src/domain/scoring` with hand-computed expected scores.
5. Then Phase 3: server modularization + first grounded pipeline stages (Census/ACS first — free and authoritative).

## 5. Verification log

| Date | Slice | Build | Tests | Typecheck | Lint |
|---|---|---|---|---|---|
| 2026-07-21 | 1 | ✅ | 23/23 ✅ | ✅ | ✅ |
| 2026-07-21 | 2 | n/a (server-only; SPA build unaffected) | 32/32 ✅ | ✅ | ✅ |
