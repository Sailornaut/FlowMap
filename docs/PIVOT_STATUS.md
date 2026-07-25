# TrafficScout Pivot — Status Log

Running record of the SaaS → internal CRE-intelligence pivot: findings, decisions, implemented slices, verification results, and pending actions. Companion docs: `PIVOT_ARCHITECTURE_ASSESSMENT.md` (ground-truth inventory), `TARGET_ARCHITECTURE.md`, `DATA_MODEL.md`, `REPORT_SCHEMA.md`, `MIGRATION_PLAN.md` (original 7-phase plan), `GOVERNING_ROADMAP_AUDIT.md` (comprehensive audit against the governing Phases 2–10 roadmap).

**Current governing phase: Phase 6 — Professional report generation (complete).**
**Phases 2–6 complete. Pre-Phase 2 stabilization: owner actions pending.**

---

## Phase-numbering note

The original `MIGRATION_PLAN.md` uses a 7-phase numbering scheme (Phases 1–7). The governing roadmap for this continuation uses Phases 2–10. The mapping:

| Governing phase | Old MIGRATION_PLAN.md phase |
|---|---|
| Pre-Phase 2 (stabilization) | Phase 1 |
| Phase 2 — Core data model | Phase 2 |
| Phase 3 — Evidence pipeline | Phase 3 (pipeline portion) |
| Phase 4 — Analyst workspace | Phase 3 (UI) + Phase 4 (scoring UI) |
| Phase 5 — Recommendation engine | Phase 4 (scoring logic) |
| Phase 6 — Report generation | Phase 5 |
| Phase 7 — Follow-up & learning | New (not in old plan) |
| Phase 8 — Knowledge assistant | New (not in old plan) |
| Phase 9 — Sales & prospecting | Phase 6 (partial) |
| Phase 10 — Production readiness | Phase 7 (partial) |

See `GOVERNING_ROADMAP_AUDIT.md` for the full acceptance-criterion audit.

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
- **Deprecate after replacement:** all Stripe billing, usage limits, plan config/UI, SaaS landing copy, Google Ads tag. Not deleted early — live subscribers may exist.
- **Remove (safe now):** mock generator, empty dirs, zero-byte stubs, unused deps.

### Key decisions
- **Keep Supabase Auth**, invite-only + `profiles.role` (`admin`/`analyst`); server-side role checks, never dashboard-toggle alone.
- **Incremental migration, not a rewrite** — the working 20% is reusable; the risky part (grounded pipeline) is new either way.
- **PDF via @react-pdf/renderer** (deterministic vector output, pure Node on Render); maps as Mapbox Static Images; charts as shared spec→SVG functions. Tradeoffs in `TARGET_ARCHITECTURE.md` §7.
- **Typing:** JSDoc + `// @ts-check` on new modules + zod at boundaries; no mid-pivot TS conversion.
- **Rent analysis:** two report shapes only — `supported` or `insufficient_data`. No third shape.
- **External data plan:** Census/ACS (free, authoritative), DOT AADT counts (free, patchy), OSM/Overture or Places for POIs, Mapbox isochrones for trade areas; **rent comps are analyst-entered** (no affordable API). Estimated ongoing cost ≈ $10–100/mo at low volume; OpenAI demoted to narratives only.

### Highest-risk assumptions
1. Data-source availability/quality — confidence must degrade honestly, never fall back to AI guesses.
2. Possible live Stripe subscribers → billing teardown is a business action (cancel/refund) before code deletion.
3. Review workflow designed single-analyst; role model must extend to more analysts without rework.
4. PDF generation within Render's resource limits.

---

## 2. Implemented slices (pre-Phase 2 stabilization)

### Slice 1 — docs + domain foundation + role migration *(2026-07-21)* ✅
- `docs/` — the five pivot documents.
- `src/domain/taxonomy/` — versioned taxonomy (v1.0.0): 19 sectors, 33 categories with attribute profiles (sqft ranges, dayparts, sensitivities, co-tenancy, physical requirements); `validateTaxonomy()`, `isSqftCompatible()`.
- `src/domain/confidence/` — deterministic 4-level confidence model (v1.0.0) with hard floors (tier-4 sources and <35% completeness can never exceed *Insufficient*; scraped tier-3 can never reach *High*); conservative `combineConfidence()`.
- `supabase/migrations/0001_add_profile_roles.{up,down}.sql` — adds `profiles.role` (`admin`/`analyst`, NULL = no access), `invited_by/at`, `schema_migrations` table; seeds the owner as admin. Reversible.
- Test infra: vitest + `npm test`; 23 tests.
- **Additive only:** nothing imports the new modules yet → zero behavior change.

### Slice 2 — env validation + internal-role gate *(2026-07-21)* ✅
- `server/env.js` — pure `validateEnv()`: required vars (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) vs feature-scoped optional vars; fatal in production, loud warning in development.
- `server/access-control.js` — pure `hasInternalAccess()` / `isAdmin()` over `profiles.role`.
- `server/index.js` — calls `validateEnv` at startup (production boot with missing required vars exits 1); `POST /api/analyze` now returns **403 `internal_access_required`** unless the profile has an internal role. A valid session alone is intentionally insufficient.
- Tests for both modules (env: 5, access-control: 4).
- **Behavior change (intended):** non-staff accounts can no longer run analyses. Legacy billing/account routes deliberately untouched so any existing subscriber can still reach the Stripe portal to cancel.

### What is NOT done in stabilization
- Dead code removal (`analysis-service.js`, empty dirs, zero-byte stubs) — deferred
- README staleness fixes — not done
- ~14 unused npm dependencies — not removed
- Migration 0001 application to live database — **requires owner action**
- Supabase sign-up disable — **requires owner action**

---

## 3. Current state summary (2026-07-23 audit)

**Code completed and verified:**
- Taxonomy domain module (19 sectors, 33 categories, validation, sqft-compat) — 10 tests
- Confidence domain module (4 levels, hard floors, combine) — 9 tests
- Access-control module (role gate) — 4 tests
- Env validation module — 5 tests
- Migration 0001 SQL (up + down)
- Role gate wired into `POST /api/analyze`

**Mock-tested behavior (no live verification):**
- All 28 test `it()` blocks pass (verified via direct node execution; vitest cannot run in current sandbox due to rollup native binary mismatch)
- eslint: passes
- tsc typecheck: passes (but `checkJs: false` means JS files are not actually type-checked)

**Not yet live-verified:**
- Migration 0001 has not been confirmed applied to Supabase
- Role gate has not been tested against the deployed Render API
- Sign-up disable has not been confirmed in Supabase dashboard

**Phase 2 — in progress (2026-07-23):**
- Migration 0002 created: 32 new tables with RLS (all core entities from DATA_MODEL.md). **Not yet applied to live DB — requires owner action.**
- Server modularized: `server/routes/` (properties, tenants, vacancies, analyses), `server/middleware/` (auth, error-handler), `server/services/` (supabase-admin). Legacy routes in `server/index.js` preserved.
- Property CRUD routes: list, get, create, update — role-gated via middleware
- Tenant CRUD routes: list, create, update, delete (nested under property) — role-gated
- Vacancy CRUD routes: list, create, update, delete (nested under property) — role-gated
- Analysis run routes: list, get, create (with linked manifest), update status — role-gated
- Route module tests: 13 assertions covering imports, requireAuth, requireStaff
- Scoring engine: `src/domain/scoring/index.js` — 15-component weighted scoring, disqualifier checks, unit-size/physical-fit sub-scores, deterministic ranking. 19 assertions pass.
- Rent analysis: `src/domain/rent/index.js` — two shapes only (`supported`/`insufficient_data`), comparable validation, stale/asking flags, outlier trim. 17 assertions pass.
- Fixtures: 6 scenario properties under `fixtures/` (healthy grocery-anchored, declining strip, child-activity-dominated, small office, insufficient-data, physically-disqualified). 59 assertions pass against scoring + rent modules.
- Lint: PASS. Typecheck: PASS.

**Phase 2 code-complete.** All code-side acceptance criteria met. Live verification requires owner to apply migrations 0001 + 0002.

**Phase 3 — in progress (2026-07-23):**
- Pipeline runner framework: `server/pipeline/runner.js` — ordered stage execution, failure isolation, cost tracking, confidence propagation, depth filtering, inputs hashing. 21 assertions pass.
- Stage 1 (property-validation): validates required/recommended fields, geocode, per-vacancy completeness. Pure logic, no external calls.
- Stage 2 (geo-enrichment): confirms or obtains coordinates via Mapbox Geocoding. Records source observations with provenance.
- Stage 3 (trade-area): generates drive-time isochrone polygons via Mapbox Isochrone API.
- Stage 4 (demographics): Census/ACS demographic data by tract. Free, authoritative (reliability tier 1).
- Stage 6 (demand-generators): nearby POI retrieval via pluggable places service (OSM/Google/Foursquare).
- Stage registry: `server/pipeline/stages/index.js` — 5 stages in execution order, 12 more planned.
- All stages have service interfaces (not hardcoded to specific APIs); mock-verified with 60 stage + 23 integration assertions.
- **External services not yet live-verified** — stages gracefully degrade to `insufficient` confidence when services are unavailable.

**Phase 4 product completion — complete (2026-07-24):**

P1 (workspace navigation): All routes connected — WorkspaceOverview, PropertyList, PropertyCreate, PropertyDetail, AnalysisList, AnalysisDetail, AnalysisReport. Sidebar nav with active states. Loading/empty/error states on all list pages. Mobile bottom nav.

P2 (property-to-analysis workflow): PropertyDetail auto-executes new runs and navigates to the analysis page. Depth inherited from previous runs.

P3 (execution progress polling): AnalysisDetail polls via React Query `refetchInterval` (3s while queued/running, stops on terminal status). Elapsed time counter. Running progress banner with spinner and stage count.

P4 (decision-oriented summary): `src/lib/analysis-summary.js` — deterministic summary builder from stage outputs. Returns headline, positives, risks, nextSteps, methodology. Every statement traceable to a stage output — no fabrication. AnalysisSummarySection renders in AnalysisDetail.

P5 (report generation): `src/pages/workspace/AnalysisReport.jsx` — 10-section print-friendly HTML report (property overview, executive summary, confidence/status, demographics, trade area, demand generators, key findings, risks, evidence/sources, methodology/manifest). References immutable manifest version. Route wired at `/workspace/analyses/:id/report`. "View Report" button on AnalysisDetail.

P6 (export and sharing): Print button calls `window.print()`. `@media print` CSS for page margins, color-adjust, break-avoids. Screen-only toolbar hidden in print. Browser "Save as PDF" from print dialog.

P7 (workspace overview): Real data from API — 4 stat cards (properties, analyses, completed, active), recent analyses list with status badges and dates, quick-action links.

P8 (production readiness): CORS fixed — added PATCH and DELETE to allowed methods (routes use both). All route imports resolve. No mock data in production code. No hardcoded secrets. No console.log in production files. Env files gitignored. Server-side auth enforced on all workspace routes. Confidence tests (19 assertions) pass.

**Phase 3 hardening — complete (2026-07-24):**

P1 (workspace display): AnalysisDetail.jsx rewritten to show all persisted data — overall and data-quality confidence from latest manifest, expandable stage cards with per-stage output renderers (property-validation fields, geocode source/coords, trade-area isochrones with vertex counts, demographics summary with population/income/age/households, POI category breakdown with nearest-distance), source observations with data-source name/kind/tier/confidence, manifest version history with runner version and cost, partial/failed banners, metadata footer with run timestamps.

P2 (confidence aggregation): `computeOverallConfidence` separated data-quality stages (property-validation) from analytical stages. Overall = worst analytical; data quality reported separately; neither caps the other. 19 assertions in `confidence.test.js` cover: empty, all-failed, all-high, weakest-caps, validation-does-not-cap, fallback-to-DQ, skipped-ignored, single-stage, mixed-fail-ok.

P3 (analytical correctness): Census ACS now returns `_acs_year` and `_acs_dataset` metadata for provenance. Demographics stage persists actual ACS year in `acs_year` output and `source_url_or_id` (format: `census:acs5:YEAR:FIPS`). Overpass uses `osm_overpass` provider name matching data_sources table. Mapbox geocoding quality (relevance, matchCode) already persisted by geo-enrichment stage.

P4 (execution route hardening): Atomic duplicate-execution prevention via conditional UPDATE (only claims run if status IN ('queued','failed')). Per-stage timeout (default 60s) via `Promise.race` in runner — prevents single slow API from blocking pipeline. Failed runs automatically cleaned up in catch block (marks run as 'failed' if still 'running'). Safe error responses — no internal details leaked to client. Auth already enforced: `populateAuth → requireAuth → requireStaff` on all /api/analyses routes. Partial status rejected for re-execution.

P5 (rerun semantics): Completed/partial analyses cannot be re-executed (409 with `already_complete`/`already_partial` code). UI shows "New run" button on terminal analyses that creates a new analysis_run for the same property via atomic RPC (inherits depth, links via notes). Prior results and manifests remain immutable and auditable. Each rerun creates a fresh run with its own manifest chain.

P6 (analysis detail page): Covered by P1 above — full rewrite of AnalysisDetail.jsx.

P7 (tests and documentation): confidence.test.js with 19 assertions. Runner timeout test (7 assertions). All modules load cleanly. Status docs updated.

**Phase 5 — Deterministic recommendation engine — complete (2026-07-24):**

P1 (seed taxonomy): `server/scripts/seed-taxonomy.js` — idempotent seed script for tenant_categories (33 categories, 19 sectors), methodology_versions (v1.0.0 with DEFAULT_WEIGHTS), and category_profiles linking each category to the methodology version. Upserts on slug/version to avoid duplicates. Validates taxonomy before writing.

P2 (evidence extraction): `server/pipeline/evidence-extractor.js` — maps real pipeline outputs to scoring inputs. Six scoring functions: `scoreDemographicAlignment` (income/population/family alignment with configurable sensitivity thresholds), `scoreLocalDemand` (POI count + category diversity), `scoreCompetition` (competitor density adjusted by tolerance), `scoreTenantMixGap` (sector coverage analysis), `scoreCotenancySynergy` (cotenancy preference matching), `scoreDataQuality` (stage success rate). `buildEvidenceInputs` composite builder. No fabrication — components without pipeline data default to undefined → 50 in scoring engine with reduced completeness. 24 assertions pass.

P3 (vacancy-scoring pipeline stage): `server/pipeline/stages/vacancy-scoring.js` — 6th pipeline stage (depths: standard, full). For each vacancy × each category (pre-filtered by sqft compatibility with 50% tolerance): builds evidence from pipeline outputs, runs `scoreCandidate` from domain scoring engine, derives verdict (recommend ≥65 / neutral / avoid ≤30 / disqualified). Persists to Supabase: business_candidates → opportunity_scores → score_components. Source observation with scoring provenance. Registered in `server/pipeline/stages/index.js`.

P4 (API scoring data): `server/routes/analyses.js` — GET /:id extended to query business_candidates with nested opportunity_scores and score_components, ordered by rank. Supabase service passed to pipeline context for scoring stage persistence.

P5 (UI scoring section): `src/pages/workspace/AnalysisDetail.jsx` — ScoringSection with expandable CandidateRow cards. Each card shows: overall score number + bar, category name/sector, verdict badge (color-coded: recommend=green, neutral=gray, avoid=orange, disqualified=red), expandable details with confidence/completeness/rank, positive/negative factors, disqualifiers, component grid.

P6 (UI report section): `src/pages/workspace/AnalysisReport.jsx` — TenantRecommendations section (section 7) added to report with recommended categories table and disqualified list. Report now 11 sections total.

P7 (tests + verification): 48 assertions pass (24 evidence extractor + 24 scoring integration). Tests cover all Phase 5 acceptance criteria: determinism (5.1), inspectable components (5.2), confidence vs opportunity separation (5.3), disqualification (5.4), missing evidence handling (5.5), LLM-proof ordering (5.6), scenario coverage including strong fit, weak fit, disqualification, missing evidence, contradictory evidence (5.7). All server-side files pass `node --check`. JSX files validated via @babel/parser. No mock data in production code.

**Phase 6 — Professional report generation — complete (2026-07-24):**

P1 (PDF infrastructure): Installed `@react-pdf/renderer` (v4.3.0). Removed unused `jspdf` and `html2canvas` deps. Created `server/reports/` directory with shared styles (`styles.js`) and PDF document builder (`analysis-pdf.js`). Uses `React.createElement` (no JSX) for plain Node compatibility without a build step.

P2 (section renderers): 8 PDF sections implemented as pure functions from analysis data → react-pdf elements: Cover page (property name, address, date, depth, branding), Executive summary (headline, status, confidence, strengths/risks, top 5 recommendations table), Property overview (name, address, type, GLA, parking, coordinates), Vacancy overview (unit table with sqft/rent/placement/condition), Demographics (Census ACS data with source year), Trade area (isochrone drive-time table), Demand generators (POI category table with counts and nearest distances), Tenant recommendations (scored categories grouped by verdict — recommended/neutral/avoid/disqualified — with top-candidate callout). Plus Sources (deduplicated source table with type/tier/confidence/date), Methodology (manifest version, runner version, confidence levels), and Disclaimer sections.

P3 (report API): `server/routes/reports.js` — three endpoints: POST `/api/reports/generate/:analysisId` (loads full analysis with all joins, builds summary, renders PDF via `renderToBuffer`, persists `report_projects` + `report_versions` with reproducible snapshot, uploads PDF to Supabase Storage), GET `/api/reports/:reportVersionId/download` (streams PDF from storage or re-renders from snapshot as fallback), GET `/api/reports` (lists report projects with versions). Route registered in `server/index.js` with full auth middleware.

P4 (UI wiring): AnalysisDetail — "Download PDF" button with `useMutation` calling `generateReport`, opens download in new tab on success. AnalysisReport — `PdfDownloadButton` component added to toolbar alongside existing Print button. API client — `generateReport()`, `getReportDownloadUrl()`, `listReports()` added to `src/lib/api-client.js`.

P5 (verification): 46 assertions pass (21 snapshot builder + 25 structural). All server-side files pass `node --check`. JSX files validated via @babel/parser. No mock data in production code. Package.json updated (added @react-pdf/renderer, removed jspdf/html2canvas).

**Not yet started (governing Phases 7–10):**
- No follow-up/outcome tracking (Phase 7)
- No knowledge assistant (Phase 8)
- No prospecting tools (Phase 9)
- No production deployment / hosting (Phase 10)

---

## 4. Pending owner actions

| # | Action | Why | Status |
|---|---|---|---|
| 1 | Run `npm install` in the repo on macOS | gets correct native binaries; verify `npm test` and `npm run build` pass locally | ☐ |
| 2 | Apply `supabase/migrations/0001_add_profile_roles.up.sql` in the Supabase SQL editor | creates `profiles.role`, seeds `davidshoemaker@gameplan.tech` as admin. **Required before deploying the role-gated code** — without it, every analyze call 403s, including yours | ☐ |
| 3 | Supabase dashboard → Auth → Providers → Email → **disable sign-ups** | closes open registration; top security item | ☐ |
| 4 | Check Stripe dashboard for active subscriptions | determines whether billing teardown requires cancel/refund actions | ☐ |
| 5 | Confirm owner account email for admin seeding | migration 0001 seeds `davidshoemaker@gameplan.tech` — confirm this is correct | ☐ |
| 6 | Commit pivot changes with git locally | sandbox git operations can leave stale lock files; run git on the development machine | ☐ |
| 7 | Apply `supabase/migrations/0002_core_data_model.up.sql` in the Supabase SQL editor | creates all 32 Phase 2 tables with RLS. **Required before the new CRUD routes will work.** Apply after migration 0001. | ☐ |
| 8 | Apply `supabase/migrations/0003_analysis_manifests.up.sql` in the Supabase SQL editor | creates `analysis_manifests` table with immutability triggers (BEFORE UPDATE/DELETE), grants (REVOKE mutation from anon/authenticated), and atomic `create_analysis_run_with_manifest` RPC. Apply after migration 0002. **Blocking — POST /api/analyses and POST /api/analyses/:id/execute return 503 without this migration.** | ☐ |
| 9 | Apply `supabase/migrations/0004_seed_data_sources.up.sql` in the Supabase SQL editor | seeds 5 data_sources rows (mapbox_geocoding, mapbox_isochrone, census_geocoder, census_acs_5yr, osm_overpass). Required for source_observations FK linkage. Apply after migration 0003. Without this, observations are skipped with a log warning but the pipeline still completes. | ☐ |

## 5. Live-verification checklist

These items cannot be verified without access to live services:

| Item | Service | How to verify | Status |
|---|---|---|---|
| Migration 0001 applied | Supabase | Query `select * from schema_migrations` and `select role from profiles limit 5` | ☐ |
| Sign-ups disabled | Supabase | Attempt sign-up with a new email; should fail | ☐ |
| Role gate active on deployed API | Render | `POST /api/analyze` with a non-staff session returns 403 | ☐ |
| Role gate allows staff | Render | `POST /api/analyze` with admin session returns analysis | ☐ |
| Stripe subscription status | Stripe | Dashboard → Subscriptions → filter active | ☐ |
| Migration 0002 applied | Supabase | Query `select * from schema_migrations` — should show both 0001 and 0002 | ☐ |
| Property CRUD works | Render | `POST /api/properties` with staff session creates a row; `GET /api/properties` lists it | ☐ |
| Tenant CRUD works | Render | `POST /api/properties/:id/tenants` with staff session creates a tenant | ☐ |
| Vacancy CRUD works | Render | `POST /api/properties/:id/vacancies` with staff session creates a vacancy | ☐ |
| Analysis creation works | Render | `POST /api/analyses` with staff session creates a run with manifest | ☐ |

## 6. Phase 2 — Code complete (pending live verification)

All Phase 2 code-side work is done:
- Migration 0002: 32 tables with RLS ✅
- Server modularization: routes, middleware, services ✅
- Property/tenant/vacancy/analysis CRUD routes ✅
- Scoring engine (15 components, deterministic, versioned) ✅
- Rent analysis (two shapes only, comparable validation) ✅
- Six scenario fixtures verified against domain modules ✅

**Remaining for Phase 2 sign-off:** owner must apply migrations 0001+0002, then live-verify CRUD routes work against real DB (see §5).

## 7. Phase 3 — Pipeline infrastructure code-complete, remaining work

Completed:
- Pipeline runner framework ✅
- Property-validation stage (no external deps) ✅
- Geo-enrichment stage (Mapbox geocoding) ✅
- Trade-area stage (Mapbox Isochrone) ✅
- Demographics stage (Census/ACS) ✅
- Demand-generators stage (POI via pluggable service) ✅
- Source observation recording in all external stages ✅
- Mock-verified tests (104 assertions total) ✅

Remaining for Phase 3 sign-off:
1. Wire pipeline into analysis run route (`POST /api/analyses/:id/execute`)
2. Persist `analysis_stage_results` rows from pipeline output
3. Persist `source_observations` from pipeline observations
4. Live-verify at least one external service (Mapbox geocoding — token exists)
5. Remaining stages: traffic-patterns (5), competition (7), tenant-classification (8), gap-analysis (9), vacancy-compatibility (10) — these are Phase 4/5 scope

See `GOVERNING_ROADMAP_AUDIT.md` for the full acceptance-criterion breakdown.

---

## 8. Verification log

| Date | Slice/Phase | Build | Tests | Typecheck | Lint | Notes |
|---|---|---|---|---|---|---|
| 2026-07-21 | Stabilization Slice 1 | ✅ | 23/23 ✅ | ✅ | ✅ | Run in cloud container |
| 2026-07-21 | Stabilization Slice 2 | n/a (server-only) | 32/32 ✅ | ✅ | ✅ | Run in cloud container |
| 2026-07-23 | Audit verification | ⚠️ sandbox env | 28 `it()` pass (direct node) | ✅ | ✅ | vitest/vite blocked by rollup native binary (macOS→Linux mismatch); eslint and tsc pass; domain modules verified via `node --input-type=module` |
| 2026-07-23 | Phase 2 (migrations + routes) | ⚠️ sandbox env | 31 assertions pass (direct node) | ✅ | ✅ | 32 new tables in migration 0002; 4 route modules + 2 middleware + 1 service module; all parse, lint, typecheck clean |
| 2026-07-23 | Phase 2 (scoring + rent) | ⚠️ sandbox env | 36 assertions pass (direct node) | ✅ | ✅ | Scoring engine 19/19, rent analysis 17/17; both deterministic, versioned |
| 2026-07-23 | Phase 2 (fixtures) | ⚠️ sandbox env | 59 assertions pass (direct node) | n/a | n/a | 6 scenario fixtures validated against scoring+rent modules; all category slugs verified against taxonomy |
| 2026-07-23 | Phase 3 (pipeline runner) | ⚠️ sandbox env | 21 assertions pass (direct node) | ✅ | ✅ | Runner: hash, depth filter, confidence, execution, isolation, callback, output forwarding |
| 2026-07-23 | Phase 3 (stages) | ⚠️ sandbox env | 60 assertions pass (direct node) | ✅ | ✅ | 5 stages: property-validation, geo-enrichment, trade-area, demographics, demand-generators; all with mock services |
| 2026-07-23 | Phase 3 (integration) | ⚠️ sandbox env | 23 assertions pass (direct node) | n/a | n/a | Full pipeline with fixture data; depth filtering; graceful degradation without services |
| 2026-07-24 | Phase 3 hardening (P1–P7) | ⚠️ sandbox env | 26 assertions pass (direct node) | n/a | n/a | Confidence aggregation 19/19; runner timeout 7/7; modules 5/5 load clean |
| 2026-07-24 | Phase 4 product (P1–P8) | ✅ user-verified | n/a | n/a | n/a | Build: 3179 modules, 3.09s. CORS fix, report route, workspace overview, print CSS |
| 2026-07-24 | Phase 5 scoring (P1–P7) | ⚠️ sandbox env | 48 assertions pass (direct node) | ✅ | n/a | Evidence extractor 24/24; scoring integration 24/24 (determinism, disqualification, confidence, contradictory evidence, strong/weak fit); all files parse; no mock data |
| 2026-07-24 | Phase 5 test fixes | ✅ user-verified | 168/168 ✅ | n/a | n/a | Fixed 3 runner tests (computeOverallConfidence returns object), 1 stages test (osm_overpass provider name), excluded live-services.test.js from vitest |
| 2026-07-24 | Phase 6 reports (P1–P5) | ⚠️ sandbox env | 46 assertions pass (direct node) | ✅ | n/a | Snapshot builder 21/21; structural checks 25/25; all files parse; no mock data; @react-pdf/renderer added, jspdf/html2canvas removed |
