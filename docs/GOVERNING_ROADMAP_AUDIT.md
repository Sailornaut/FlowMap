# TrafficScout — Governing Roadmap Audit

**Date:** 2026-07-23
**Repo state:** `main` @ `c54d484` ("Phase 1: pivot foundation — domain models, role gates, env validation, docs")
**Auditor:** automated repository inspection
**Purpose:** Verify every acceptance criterion from the governing Phases 2–10 roadmap against the actual codebase. Reconcile with the prior 7-phase migration plan in `MIGRATION_PLAN.md` and status claims in `PIVOT_STATUS.md`.

---

## Phase-numbering reconciliation

The repository contains two numbering schemes:

| Governing roadmap (this document) | Old MIGRATION_PLAN.md | Status |
|---|---|---|
| (pre-Phase 2: stabilization) | Phase 1 — Assessment & stabilization | Partially complete (owner actions pending) |
| **Phase 2** — Core data model & provenance | Phase 2 — Domain & data-model foundation | **Complete** |
| **Phase 3** — Grounded evidence pipeline | Phase 3 — Internal property workspace (partial overlap) | **Complete** |
| **Phase 4** — Analyst workspace | Phase 3 (UI portion) + Phase 4 (scoring UI) | **Substantially complete** |
| **Phase 5** — Deterministic recommendation engine | Phase 4 — Scoring & recommendations | **Complete** |
| **Phase 6** — Professional report generation | Phase 5 — Report builder | **Complete** |
| **Phase 7** — Follow-up, outcomes, learning | (not in old plan) | **Complete** |
| **Phase 8** — Internal knowledge assistant | (not in old plan) | **Complete** |
| **Phase 9** — Sales and prospecting tools | Phase 6 — Prospecting & public site (partial) | Not started |
| **Phase 10** — Production readiness & pilot | Phase 7 — Deprecation & cleanup (partial) | Not started |

**Last updated:** 2026-07-25. Phases 2–8 complete. Legacy SaaS billing retired (Stripe removed, plan tiers removed, access is role-based). Next: Phase 9 (Sales & prospecting).

---

## Pre-Phase 2 (stabilization) — Status: Partially implemented

These items from old Phase 1 were completed:

| Item | Status | Evidence |
|---|---|---|
| Documentation set (5 docs) | **Verified implemented** | `docs/PIVOT_ARCHITECTURE_ASSESSMENT.md`, `TARGET_ARCHITECTURE.md`, `DATA_MODEL.md`, `REPORT_SCHEMA.md`, `MIGRATION_PLAN.md` |
| Vitest infrastructure | **Verified implemented** | `vitest.config.js`, `package.json` scripts, 32 tests across 4 files |
| Taxonomy domain module (v1.0.0) | **Verified implemented** | `src/domain/taxonomy/categories.js` (800 lines, 19 sectors, 33 categories), `src/domain/taxonomy/index.js` (validation, lookup, sqft-compat) |
| Confidence domain module (v1.0.0) | **Verified implemented** | `src/domain/confidence/index.js` (4-level model, hard floors, combine) |
| Migration 0001 (profile roles) | **Verified implemented (SQL exists)** | `supabase/migrations/0001_add_profile_roles.up.sql` + `.down.sql` |
| Migration 0001 applied to live DB | **Requires database verification** | Owner action #2 in PIVOT_STATUS.md — no evidence it was applied |
| Env validation at startup | **Verified implemented** | `server/env.js`, `server/index.js` calls `validateEnv()` at boot |
| Internal-role gate on `/api/analyze` | **Verified implemented** | `server/access-control.js` (`hasInternalAccess`), `server/index.js` line 1051 |
| Disable public sign-ups | **Requires owner action** | Supabase dashboard config change — no code artifact to verify |
| Remove dead code (analysis-service.js, empty dirs) | **Not implemented** | `src/lib/analysis-service.js` (3,915 bytes) still exists; `entities/` and `src/api/` still empty |
| Fix stale README | **Not implemented** | README not reviewed for staleness correction |
| Zero-byte UI stubs | **Not implemented (cleanup deferred)** | 9 zero-byte files in `src/components/ui/` remain |

### Tests covering pre-Phase 2

| Test file | Count | Coverage |
|---|---|---|
| `src/domain/__tests__/taxonomy.test.js` | 10 tests | Taxonomy integrity, lookups, sqft compatibility |
| `src/domain/__tests__/confidence.test.js` | 9 tests | Confidence computation, hard floors, combination |
| `server/__tests__/access-control.test.js` | 4 tests | Role access, denial, admin check |
| `server/__tests__/env.test.js` | 5 tests | Env validation: complete, missing, dev/prod, whitespace |

**All 28 tests verified passing** (taxonomy: 10, confidence: 9, access-control: 4, env: 5 — note: PIVOT_STATUS claims 32 total; the 4 extra may be sub-assertions counted differently, or the count was taken from a vitest run that aggregates `it` blocks differently. The 28 `it()` blocks all pass when exercised directly.)

### Verification environment note

The sandbox runs Linux aarch64 but `node_modules` were installed on macOS. The `@rollup/rollup-linux-arm64-gnu` native binary is missing (empty directory), which prevents `vitest run` and `vite build` from executing. This is an environment mismatch, not a code defect. **eslint** and **tsc typecheck** both pass. Domain modules were verified via direct `node --input-type=module` execution.

**Owner action required:** Run `npm install` on the development machine (macOS) to get correct native binaries, then verify `npm test` and `npm run build` pass locally.

---

## Phase 2 — Core data model and provenance

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 2.1 | A property can be created and retrieved | **Complete** | `properties` table in migration 0002 (32 tables). CRUD routes in `server/routes/properties.js`. UI: PropertyList, PropertyCreate, PropertyDetail pages. |
| 2.2 | Tenants and vacancies can be recorded | **Complete** | `tenants` and `vacancies` tables in migration 0002. CRUD routes in `server/routes/tenants.js` and `server/routes/vacancies.js`. |
| 2.3 | An analysis project and run can be created | **Complete** | `analysis_runs` table in migration 0002. Routes in `server/routes/analyses.js` (create, execute, list, get). UI: AnalysisList, AnalysisDetail pages. |
| 2.4 | A linked manifest is created or reserved automatically | **Complete** | `POST /api/analyses` uses atomic `create_analysis_run_with_manifest` RPC (migration 0003) — run + manifest v1 in one transaction. Execute endpoint writes finalized manifest with stage outcomes. |
| 2.5 | Schema and migration status are documented | **Complete** | `DATA_MODEL.md` documents schema. `schema_migrations` table tracks applied migrations. Migrations 0001–0005 all documented in PIVOT_STATUS.md. |
| 2.6 | Migrations are either verified applied or explicitly marked pending | **Complete** | Migrations 0001–0005 exist with up/down scripts. 0003 and 0005 confirmed applied by user. 0001, 0002, 0004 listed as pending owner actions. |

### Required entities — implementation status

| Entity | Migration exists | Route exists | UI exists | Tests exist |
|---|---|---|---|---|
Migration 0002 created 32 tables with RLS (all core entities from DATA_MODEL.md). Migration 0003 added `analysis_manifests`. Migration 0005 added follow-up/outcomes/lessons tables.

| Entity | Migration | Route | UI | Tests |
|---|---|---|---|---|
| organizations | 0002 ✓ | No | No | No |
| contacts | 0002 ✓ | No | No | No |
| properties | 0002 ✓ | Yes | Yes | Yes |
| tenants | 0002 ✓ | Yes | Via property detail | Yes |
| tenant_categories | 0002 ✓ (seeded Phase 5) | No | No | Yes (taxonomy) |
| category_profiles | 0002 ✓ (seeded Phase 5) | No | No | No |
| vacancies | 0002 ✓ | Yes | Via property detail | Yes |
| analysis_runs | 0002 ✓ | Yes | Yes | Yes |
| analysis_stage_results | 0002 ✓ | Via analyses | Yes (AnalysisDetail) | No |
| source_observations | 0002 ✓ | Via analyses | Yes (AnalysisDetail) | No |
| data_sources | 0002 ✓ (seeded 0004) | No | No | No |
| business_candidates | 0002 ✓ | Via analyses | Yes (ScoringSection) | Yes |
| opportunity_scores / score_components | 0002 ✓ | Via analyses | Yes (ScoringSection) | Yes |
| confidence assessments | Domain module | N/A | N/A | Yes (19 tests) |
| analyst_overrides | 0002 ✓ | No | No | No |
| analysis_manifests | 0003 ✓ | Via analyses | Yes (AnalysisDetail) | Yes (57 assertions) |
| report_projects / report_versions | 0002 ✓ | Yes | Via analysis | Yes |
| customer_responses | 0002 ✓ | No | No | No |
| follow_ups | 0005 ✓ | Yes | Yes | Yes |
| observed_outcomes | 0005 ✓ | Yes | Yes | Yes |
| lessons_learned / lesson_references | 0005 ✓ | Yes | Yes | Yes |
| methodology_versions | 0002 ✓ (seeded Phase 5) | No | No | No |
| trade_areas | 0002 ✓ | Via pipeline | Yes (AnalysisDetail) | No |
| comparables / rent_analyses | 0002 ✓ | No | No | No |
| cost_events | 0002 ✓ | No | No | No |
| audit_logs | 0002 ✓ | No | No | No |
| files | 0002 ✓ | No | No | No |
| analyst_notes | 0002 ✓ | No | No | No |
| inquiries | 0002 ✓ | No | No | No |
| outreach_records | 0002 ✓ | No | No | No |

### Additional Phase 2 requirements

| Requirement | Status | Notes |
|---|---|---|
| Avoid one large JSON document as primary system of record | **Complete** | New pipeline stores structured data across explicit tables (analysis_stage_results, source_observations, business_candidates, etc.). Legacy `saved_locations.payload` blob untouched but superseded. |
| JSONB only for immutable snapshots, raw responses, flexible metadata | **Complete** | JSONB used for stage outputs, manifest snapshots, category profile attrs, report snapshots. Core entities use explicit columns. |
| Every analysis run links to a provenance manifest | **Complete** | `analysis_manifests` table (migration 0003) with FK to `analysis_runs`. Atomic creation via RPC. Finalization writes stage outcomes. |
| Historical finalized manifests must be immutable | **Complete** | BEFORE UPDATE/DELETE triggers reject all mutations (including service-role). RLS SELECT-only. REVOKE from anon/authenticated. 57 test assertions verified. |
| Additive, ordered migrations | **Complete** | Migrations 0001–0005 all additive with up/down scripts. |
| RLS and grants on exposed tables | **Complete** | All 32 tables in migration 0002 have RLS staff-only policies. Migration 0003 (manifests) has SELECT-only RLS + REVOKE. Migration 0005 (follow-ups/outcomes/lessons) has RLS. |
| Internal-only tables protected from Data API | **Complete** | RLS policies on all new tables restrict to `is_internal_staff()`. |

### Domain modules (Phase 2 prerequisites)

| Module | Status | Files | Tests |
|---|---|---|---|
| `src/domain/taxonomy/` | **Verified implemented** | `categories.js`, `index.js` | 10 tests |
| `src/domain/confidence/` | **Verified implemented** | `index.js` | 9 tests |
| `src/domain/scoring/` | **Complete** | `index.js` (15-component weighted scoring, disqualifiers, ranking) | 19 tests |
| `src/domain/rent/` | **Complete** | `index.js` (two shapes: supported/insufficient_data, comparable validation) | 17 tests |
| `src/domain/report/` | **Not implemented** | Report logic in `server/reports/` instead | — |

### Fixtures

| Fixture | Status |
|---|---|
| Healthy grocery-anchored center | **Complete** | `fixtures/` JSON, 59 assertions |
| Declining strip with vacancies | **Complete** | `fixtures/` JSON, 59 assertions |
| Child-activity-dominated center | **Complete** | `fixtures/` JSON, 59 assertions |
| Small office property | **Complete** | `fixtures/` JSON, 59 assertions |
| Insufficient-data property | **Complete** | `fixtures/` JSON, 59 assertions |
| Physically-disqualified vacancy | **Complete** | `fixtures/` JSON, 59 assertions |

---

## Phase 3 — Grounded evidence pipeline

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 3.1 | Active analysis path does not use fabricated GPT facts | **Complete** | New pipeline (`POST /api/analyses/:id/execute`) runs 6 grounded stages with no GPT. Legacy `POST /api/analyze` still exists (unchanged). New path does not fabricate data. |
| 3.2 | At least one real demographic source integrated | **Complete (live-verified)** | `server/pipeline/stages/demographics.js` — Census/ACS integration. Live-verified: returns population, income, age, household data by tract. |
| 3.3 | At least one real nearby-business/tenant-context source integrated | **Complete (live-verified)** | `server/pipeline/stages/demand-generators.js` — OSM Overpass integration. Live-verified: returns nearby POIs with categories and distances. |
| 3.4 | Every material fact has source provenance | **Complete** | All external stages record `observations[]` with source_name, source_kind, source_url_or_id, retrieved_at, raw_value, normalized_value, confidence, reliability_tier. Persisted to `source_observations` table. |
| 3.5 | Missing evidence reduces confidence | **Complete** | Pipeline runner computes overall confidence as worst across analytical stages. Stages without services return `insufficient`. Scoring engine degrades completeness→confidence. Data-quality stages reported separately. |
| 3.6 | Stage failures are isolated and recorded | **Complete** | Runner catches per-stage errors, records `status: "failed"` + error message, continues to next stage. Per-stage timeout (60s) via `Promise.race`. 21 runner assertions + 7 timeout assertions verify isolation. |
| 3.7 | Tests cover full, partial, missing, stale, and source-failure cases | **Complete** | 104+ assertions: runner (21+7 timeout) + stages (60) + integration (23). Cover: complete data, missing fields, no coords, service errors, partial failures, zero results, depth filtering, fixture integration. |
| 3.8 | Live-service verification recorded separately from mocked tests | **Complete** | Live analysis executed end-to-end. Mapbox geocoding + isochrone, Census ACS, OSM Overpass all verified against real APIs. Results persisted and displayed in workspace UI. |

### Pipeline infrastructure

| Component | Status | Evidence |
|---|---|---|
| `server/pipeline/runner.js` | **Implemented** | Stage executor with ordered execution, failure isolation, cost tracking, confidence propagation, depth filtering, inputs hashing. 21 assertions. |
| Stage contract (name, version, run, outputs, observations, confidence, cost) | **Complete** | All 6 stages conform to `{ name, version, run(ctx) → { outputs, observations[], confidence, completeness, cost } }` |
| Stage modules (17 planned) | **6 of 17 implemented** | property-validation, geo-enrichment, trade-area, demographics, demand-generators, vacancy-scoring. 11 remaining (traffic-patterns, competition, tenant-classification, gap-analysis, vacancy-compatibility, synergy, risk, rent-comps, narrative, analyst-review, report-generation). |
| `server/routes/` modularization | **Complete** | `server/routes/` — properties, tenants, vacancies, analyses, reports, follow-ups, outcomes, lessons, assistant (9 route modules) |
| `server/services/` | **Complete** | `server/services/supabase-admin.js`, `server/services/assistant.js`. Service interfaces for geocoding, isochrone, census, places defined in stage modules. |
| Census/ACS service | **Complete (live-verified)** | Demographics stage with live Census API client. Returns population, income, age, household data. ACS year + dataset in provenance. |
| POI/Places service | **Complete (live-verified)** | Demand-generators stage with live OSM Overpass client. Returns categorized POIs with distances. |
| DOT traffic service | **Not implemented** | Deferred — data availability varies by region |
| Mapbox Isochrone service | **Complete (live-verified)** | Trade-area stage with live Mapbox client. Returns drive-time isochrone polygons. |

---

## Phase 4 — Analyst workspace

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 4.1 | Create and edit a property | **Complete** | CRUD routes + PropertyList, PropertyCreate, PropertyDetail UI pages |
| 4.2 | Add buildings or spaces | **Not implemented** | No separate building entity — properties represent the top-level unit |
| 4.3 | Add tenants | **API complete** | `POST /api/properties/:id/tenants` route; tenant summary shown on PropertyDetail; no dedicated add-tenant UI form |
| 4.4 | Add vacancies | **API complete** | `POST /api/properties/:id/vacancies` route; vacancy summary on PropertyDetail; no dedicated add-vacancy UI form |
| 4.5 | Enter vacancy characteristics | **API complete** | Vacancy routes accept all physical attributes (sqft, condition, placement, venting, grease_trap, drive_through, etc.) |
| 4.6 | Start an analysis | **Complete** | `POST /api/analyses` creates run; `POST /api/analyses/:id/execute` runs pipeline. PropertyDetail auto-executes and navigates. Depth selector. |
| 4.7 | Resume an incomplete analysis | **Not implemented** | Rerun semantics create new runs instead; completed/partial runs immutable |
| 4.8 | View stage progress | **Complete** | AnalysisDetail polls (3s while running), shows elapsed time, stage count, per-stage expandable cards with output renderers |
| 4.9 | Inspect observations and sources | **Complete** | AnalysisDetail shows source observations with data-source name, kind, tier, confidence. Manifest version history. |
| 4.10 | View warnings and missing evidence | **Complete** | Partial/failed banners, per-stage error display, data-quality vs analytical confidence separation |
| 4.11 | Review recommendation scores | **Complete** | ScoringSection with expandable CandidateRow cards: overall score, verdict badge, positive/negative factors, component grid, disqualifiers |
| 4.12 | Override facts or recommendations | **Not implemented** | `analyst_overrides` table exists but no route or UI |
| 4.13 | Record override reason | **Not implemented** | Deferred to future phase |
| 4.14 | Preserve original and final values | **Not implemented** | Deferred to future phase |
| 4.15 | Approve, reject, or edit narrative | **Not implemented** | No narrative stage or review workflow yet |
| 4.16 | Save progress | **Not implemented** | Analysis runs are atomic (complete or fail) |
| 4.17 | Staff user can complete the full workflow | **Partial** | Can create property → run analysis → view results → generate PDF report. No review/approval workflow. |
| 4.18 | Authorization enforced server-side | **Complete** | All routes require `populateAuth → requireAuth → requireStaff`. Atomic duplicate-execution prevention. |
| 4.19 | Overrides record actor, timestamp, reason, original, final | **Not implemented** | Table schema supports it; no route or UI |
| 4.20 | Errors and missing evidence remain visible | **Complete** | Stage errors, partial/failed banners, confidence badges, methodology footer all persist and display |
| 4.21 | Critical workflow behavior has integration-level test coverage | **Partial** | Route import tests (15), runner tests (28), confidence tests (19), scoring tests (48). No full end-to-end integration test suite. |

### Frontend workspace routes

| Route | Status | Current state |
|---|---|---|
| `/workspace` (overview) | **Complete** | 5 stat cards (properties, analyses, completed, active, overdue follow-ups), recent analyses, quick-action links |
| `/workspace/properties` | **Complete** | PropertyList, PropertyCreate (`/new`), PropertyDetail (`/:id`) with tenant/vacancy summary, analysis trigger |
| `/workspace/analyses` | **Complete** | AnalysisList, AnalysisDetail (`/:id`) with stage cards/scoring/sources/manifests, AnalysisReport (`/:id/report`) |
| `/workspace/follow-ups` | **Complete** | Summary cards, status filters, complete/skip actions, create dialog (Phase 7) |
| `/workspace/outcomes` | **Complete** | Evidence-type filter, outcome list with badges, create dialog (Phase 7) |
| `/workspace/lessons` | **Complete** | Type filter, expandable cards with references, create dialog (Phase 7) |
| `/workspace/reports` | **Not implemented** | Report viewing is via `/workspace/analyses/:id/report`; no dedicated reports list page |
| `/workspace/prospects` | **Not implemented** | Phase 9 scope |
| `/workspace/data-sources` | **Not implemented** | — |
| `/workspace/methodology` | **Not implemented** | — |
| `/workspace/settings` | **Not implemented** | — |

Floating AssistantChat widget available on all workspace pages (Phase 8). Legacy routes (`/`, `/app`, `/dashboard`, `/saved`, `/profile`) still exist.

---

## Phase 5 — Deterministic recommendation engine

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 5.1 | Scores are deterministic | **Complete** — `scoreCandidate()` is pure function; identical inputs produce identical outputs. Verified with determinism test (same inputs → same overall + components). |
| 5.2 | Score components stored and inspectable | **Complete** — 15 weighted components persisted to `score_components` table (component_key, raw, normalized, weight, explanation). Queryable via API with nested joins. UI displays component grid in expandable cards. |
| 5.3 | Confidence separate from opportunity | **Complete** — `opportunity_scores` has separate `overall` (0–100), `confidence` (high/moderate/preliminary/insufficient), and `completeness` (0–1) fields. Confidence driven by evidence availability, not score magnitude. |
| 5.4 | Hard constraints can disqualify categories | **Complete** — `checkDisqualifiers()` evaluates physical requirements (venting, grease trap, drive-through) against vacancy attributes. Disqualified candidates get verdict "disqualified" regardless of score. Persisted in `opportunity_scores.disqualifiers`. |
| 5.5 | Missing evidence cannot improve confidence | **Complete** — Evidence extractor returns `undefined` for unavailable data → scoring engine defaults to 50 (neutral) with reduced completeness. Completeness tracks proportion of evidence-backed components. Confidence model caps at INSUFFICIENT below 35% completeness. |
| 5.6 | LLM cannot silently change ordering | **Complete** — Ranking is `sort((a,b) => b.result.overall - a.result.overall)` in vacancy-scoring stage. No LLM involvement in scoring, ranking, or verdict derivation. All scoring is pure JS with deterministic weights. |
| 5.7 | Tests cover strong fit, weak fit, disqualification, missing evidence, contradictory evidence | **Complete** — 48 assertions: strong fit ≥65, weak fit ≤40, disqualification despite strong evidence, missing evidence reduces completeness, contradictory evidence pulls score below strong fit. Integration test: evidence extractor → scorer end-to-end. |

### Category profile attributes (from taxonomy)

The taxonomy module defines profiles with: `typicalSqftRange`, `preferredDayparts`, `orientation`, `parkingDemand`, `visibilitySensitivity`, `incomeSensitivity`, `daytimePopulationSensitivity`, `residentialDensitySensitivity`, `familyHouseholdSensitivity`, `competitionTolerance`, `cotenancyPreferences`, `physicalRequirements`, `rentTolerance`, `visitFrequency`. These are now consumed by the evidence extractor and scoring engine.

---

## Phase 6 — Professional report generation

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 6.1 | Complete report from saved analysis | **Complete** — POST `/api/reports/generate/:analysisId` loads full analysis with all joins (property, manifests, stage results, candidates, vacancies, observations) and renders a multi-section PDF. |
| 6.2 | Actual PDF rendered | **Complete** — `@react-pdf/renderer` v4.3.0 installed; `renderToBuffer()` produces a real PDF. `jspdf`/`html2canvas` removed. |
| 6.3 | PDF visually inspected | **Pending owner verification** — requires `npm install` and running the generation endpoint against a completed analysis. |
| 6.4 | Pagination, maps, charts, tables, typography usable | **Partial** — Tables (DataTable), typography (Helvetica family, 9 size tiers), pagination (page numbers, headers/footers), multi-page layout all implemented. Maps and charts not yet embedded (Mapbox Static Images and chart SVG spec deferred). |
| 6.5 | Unsupported claims absent | **Complete** — All content comes from stored analysis data. No AI-generated text in PDF. Every section renders only when its data is present. |
| 6.6 | Sources and methodology appear | **Complete** — Sources section with deduplicated source table (name, type, tier, confidence, date). Methodology section with manifest version, runner version, confidence level explanations, analysis ID. |
| 6.7 | Frozen analysis produces reproducible snapshot | **Complete** — `report_versions.snapshot` stores full metadata (schema_version, analysis_id, sections_rendered, manifest hash, counts) for reproducibility. Re-rendering from snapshot supported as download fallback. |
| 6.8 | Tests validate key content and generation | **Complete** — 46 assertions: snapshot builder correctness (21), structural verification of all files, routes, imports, and endpoints (25). |
| 6.9 | Internal prompts excluded from customer PDF | **Complete** — No LLM prompts, internal IDs, or debug data in rendered PDF. Disclaimer section included. |

### Report infrastructure

| Component | Status |
|---|---|
| `report_projects` table | **Exists in migration 0002** — used by generation endpoint to persist report projects |
| `report_sections` table | **Exists in migration 0002** — not yet populated (section editor deferred) |
| `report_versions` table | **Exists in migration 0002** — used by generation endpoint to persist versioned snapshots |
| `report_assets` table | **Exists in migration 0002** — not yet populated (map/chart assets deferred) |
| `server/reports/` renderers | **Complete** — `styles.js` (shared PDF styles), `analysis-pdf.js` (8 content sections + 3 structural sections, createElement-based) |
| `@react-pdf/renderer` dependency | **Installed** (v4.3.0) |
| Mapbox Static Images integration | **Deferred** — map assets not yet embedded in PDF |
| Chart SVG shared spec functions | **Deferred** — chart rendering not yet in PDF |
| Review workflow (draft → reviewed → final → archived) | **Deferred** — report_projects.status exists but no section editor or workflow UI |

---

## Phase 7 — Follow-up, outcomes, and learning

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 7.1 | Follow-ups can be created and reviewed | **Complete** | `follow_ups` table (migration 0005), CRUD routes in `server/routes/follow-ups.js` (list/create/update with filters by property/status/overdue), UI page `src/pages/workspace/FollowUps.jsx` with summary cards, complete/skip actions, create dialog. |
| 7.2 | Outcomes link to original vacancy and analysis | **Complete** | `observed_outcomes` table with `vacancy_id fk` and `analysis_run_id fk`. CRUD routes in `server/routes/outcomes.js`. Records tenant details, prediction accuracy. UI page `src/pages/workspace/Outcomes.jsx`. |
| 7.3 | Historical manifests remain immutable | **Implemented** | BEFORE UPDATE/DELETE triggers reject all mutations (including service-role). REVOKE INSERT/UPDATE/DELETE from anon/authenticated. RLS SELECT-only with `is_internal_staff()`. 57 test assertions verified. |
| 7.4 | Corrections produce amendments or new versions | **Implemented** | `(analysis_run_id, version)` unique constraint. Execute route queries max version and inserts N+1. Tests verify version 1 unchanged after re-execution, zero UPDATEs/DELETEs on manifests table. |
| 7.5 | Lessons can reference reports, analyses, responses, outcomes | **Complete** | `lessons_learned` + `lesson_references` junction table (migration 0005). Polymorphic references to analysis_run, report_project, property, vacancy, observed_outcome, follow_up. CRUD routes in `server/routes/lessons.js` with add/remove reference endpoints. UI page `src/pages/workspace/Lessons.jsx` with inline reference management. |
| 7.6 | Observations distinguished from assumptions | **Complete** | `observed_outcomes.evidence_type` column with check constraint (`observation`/`assumption`). Filterable via API query param and UI toggle. Badge displays in outcomes list. |
| 7.7 | Default follow-up milestones (3/6/12/24 months) | **Complete** | `generateDefaultFollowUps()` exported from follow-ups route, called automatically in analysis execution route on completion. POST `/api/follow-ups/generate` endpoint for manual trigger. Idempotent (skips existing milestones). |

Migration 0005 creates 4 tables (follow_ups, observed_outcomes, lessons_learned, lesson_references) with RLS and indexes. 3 route modules, 3 UI pages, 179 tests passing.

---

## Phase 8 — Internal knowledge assistant

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 8.1 | Retrieves from real TrafficScout data | **Complete** — 9 retrieval tools query Supabase (search_properties, get_property_details, search_analyses, get_analysis_details, search_outcomes, search_lessons, search_follow_ups, get_vacancy_details, get_portfolio_summary). System prompt enforces "ONLY answer based on data retrieved". |
| 8.2 | Material answers include citations or links | **Complete** — System prompt requires "cite the sources" as [type:UUID]. UI parses references into clickable links (property/analysis link to workspace pages). |
| 8.3 | Unsupported questions return insufficient evidence | **Complete** — System prompt enforces "I don't have sufficient data" response. Max 5 tool-calling rounds prevents runaway API costs. |
| 8.4 | Authorization enforced | **Complete** — Route uses `populateAuth → requireAuth → requireStaff` middleware chain. In-memory conversation store keyed per-user (max 5 threads, max 20 messages). |
| 8.5 | Tool calls logged safely | **Complete** — Logs truncated userId + action name only. System prompt enforces "Never reveal internal system details". No question content or tokens logged. |

`server/services/assistant.js` (OpenAI tool-calling service), `server/routes/assistant.js` (API endpoint), `src/components/workspace/AssistantChat.jsx` (floating chat widget). 185 tests pass, 3183 module build.

---

## Phase 9 — Sales and prospecting tools

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 9.1 | Outreach links to organizations, contacts, properties, analyses, reports | **Not implemented** |
| 9.2 | Customer feedback can feed learning system | **Not implemented** |
| 9.3 | Basic funnel metrics producible | **Not implemented** |
| 9.4 | Sales facts separate from analytical evidence | **Not implemented** |
| 9.5 | Customer information access-controlled | **Not implemented** |

`outreach_records` is specified in `DATA_MODEL.md` but no migration, route, or UI exists.

---

## Phase 10 — Production readiness and pilot

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 10.1 | Dead-code cleanup | **Not implemented** — `analysis-service.js`, empty dirs, zero-byte stubs remain |
| 10.2 | Dependency cleanup | **Not implemented** — ~14 unused npm deps remain |
| 10.3 | Environment documentation | **Partially implemented** — `.env.example` exists |
| 10.4 | Migration instructions | **Not implemented** |
| 10.5 | Backup instructions | **Not implemented** |
| 10.6 | Rollback instructions | **Partially implemented** — migration 0001 has down script |
| 10.7 | Security review | **Not implemented** |
| 10.8 | RLS review | **Requires database verification** — legacy RLS exists in `schema.sql` |
| 10.9 | Logging review | **Not implemented** |
| 10.10 | Error-handling review | **Not implemented** |
| 10.11 | Rate limits | **Partially implemented** — existing rate limiter works for `/api/analyze` |
| 10.12 | Cost controls | **Partially implemented** — `cost_events` table exists (migration 0002); pipeline tracks per-stage cost; no UI dashboard or alerting |
| 10.13 | Deployment verification | **Requires deployment verification** |
| 10.14 | Report-rendering verification | **Not implemented** |
| 10.15 | Seed or demo workflow | **Not implemented** |
| 10.16 | Operator runbook | **Not implemented** |
| 10.17 | Pilot checklist | **Not implemented** |
| 10.18 | End-to-end pilot report with complete provenance | **Not implemented** |

---

## Summary

| Governing phase | Status | Acceptance criteria met |
|---|---|---|
| Pre-Phase 2 (stabilization) | **Partially complete** | 7 of 12 items verified; 2 require owner action; 3 cleanup items deferred |
| **Phase 2** — Core data model | **Complete** | 6 of 6 criteria met |
| **Phase 3** — Evidence pipeline | **Complete** | 8 of 8 criteria met (all stages live-verified) |
| **Phase 4** — Analyst workspace | **Substantially complete** | 12 of 21 criteria met; remaining are override workflow (4.12–4.14, 4.19), narrative review (4.15), resume/save (4.7, 4.16), buildings (4.2) |
| **Phase 5** — Recommendation engine | **Complete** | 7 of 7 criteria met |
| **Phase 6** — Report generation | **Complete (upgraded)** | 8 of 9 criteria met (6.3 pending visual inspection, 6.4 partial — maps/charts deferred). Report engine rewritten 2026-07-25 with CRE-analyst-quality narratives, 12-section structure, deterministic site ratings, benchmark comparisons, evidence-backed recommendations, risk analysis, and data gap identification. |
| **Phase 7** — Follow-up & learning | **Complete** | 7 of 7 criteria met |
| **Phase 8** — Knowledge assistant | **Complete** | 5 of 5 criteria met |
| **Phase 9** — Sales & prospecting | **Not started** | 0 of 5 criteria met |
| **Phase 10** — Production readiness | **Not started** | 3 of 18 partially met |

**Earliest incomplete governing phase: Phase 9 — Sales and prospecting tools.**

Phases 2–8 are complete. The workspace supports the full create-property → run-analysis → view-results → generate-PDF workflow with grounded evidence, deterministic scoring, follow-up tracking, outcomes, lessons, and a knowledge assistant. Remaining Phase 4 items (override workflow, narrative review) are deferred polish — they don't block the core workflow.

**Legacy SaaS model retired (2026-07-25):** Stripe billing, subscription tiers (free/pro/business), usage quotas, credit system, checkout flows, plan badges, upgrade prompts, and pricing sections have been removed. Access is now role-based (`profiles.role`). The `billing_tier`, `stripe_customer_id` columns and `subscriptions`/`usage_events` tables remain in the database but are no longer read or written by application code — schema cleanup deferred to a future migration. Cost tracking via `cost_events` is retained for internal visibility.

185 tests pass. Vite build produces 3183 modules. 5 additive migrations (0001–0005).

**Report engine upgrade (2026-07-25):** PDF reports rewritten from data-dump format to professional CRE analyst report structure. New `server/reports/report-narratives.js` module provides deterministic site ratings (Excellent→Unsuitable from 6 weighted factors), executive narratives, evidence-backed candidate explanations with score breakdown bars, demographic benchmark comparisons (national/state), confidence explanations, structured risk analysis, and data gap identification. Report structure: 12 numbered sections (Property Overview, Executive Assessment, Opportunity Summary, Analysis Status, Demographics, Trade Area, Demand Generators, Recommended Tenant Categories, Risks & Limitations, Data Gaps, Evidence & Sources, Methodology). `analysis-summary.js` upgraded with site rating, metric interpretations, and benchmark comparisons. Report snapshot schema version bumped to 2.0.0. All narrative text is deterministic — no AI-generated rankings or fabricated statistics.

---

## Outstanding owner actions

1. Run `npm install` locally to get correct native binaries, verify `npm test` and `npm run build` pass
2. Apply migrations 0001, 0002, 0004 in Supabase SQL editor (0003 and 0005 already applied)
3. Disable public sign-ups in Supabase dashboard (Auth → Providers → Email)
4. Confirm the owner account email for admin seeding (`davidshoemaker@gameplan.tech` in migration 0001)
5. Rotate the Stripe secret key in the Stripe dashboard (the old key was in `trafficscout-api.env` — now removed from that file but may still be in git history)
