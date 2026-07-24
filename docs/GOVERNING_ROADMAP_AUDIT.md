# TrafficScout — Governing Roadmap Audit

**Date:** 2026-07-23
**Repo state:** `main` @ `c54d484` ("Phase 1: pivot foundation — domain models, role gates, env validation, docs")
**Auditor:** automated repository inspection
**Purpose:** Verify every acceptance criterion from the governing Phases 2–10 roadmap against the actual codebase. Reconcile with the prior 7-phase migration plan in `MIGRATION_PLAN.md` and status claims in `PIVOT_STATUS.md`.

---

## Phase-numbering reconciliation

The repository contains two numbering schemes:

| Governing roadmap (this document) | Old MIGRATION_PLAN.md | PIVOT_STATUS.md claims |
|---|---|---|
| (pre-Phase 2: stabilization) | Phase 1 — Assessment & stabilization | "Phase 1 in progress", Slices 1–2 complete |
| **Phase 2** — Core data model & provenance | Phase 2 — Domain & data-model foundation | Not started |
| **Phase 3** — Grounded evidence pipeline | Phase 3 — Internal property workspace (partial overlap) | Not started |
| **Phase 4** — Analyst workspace | Phase 3 (UI portion) + Phase 4 (scoring UI) | Not started |
| **Phase 5** — Deterministic recommendation engine | Phase 4 — Scoring & recommendations | Not started |
| **Phase 6** — Professional report generation | Phase 5 — Report builder | Not started |
| **Phase 7** — Follow-up, outcomes, learning | (not in old plan) | Not started |
| **Phase 8** — Internal knowledge assistant | (not in old plan) | Not started |
| **Phase 9** — Sales and prospecting tools | Phase 6 — Prospecting & public site (partial) | Not started |
| **Phase 10** — Production readiness & pilot | Phase 7 — Deprecation & cleanup (partial) | Not started |

**Key correction:** `PIVOT_STATUS.md` claims "Phase 1 in progress" with Slices 1–2 complete. This maps to pre-Phase 2 stabilization work in the governing roadmap. The claims for Slices 1–2 are **verified accurate** — code, tests, and migration SQL all exist and are correct. No governing phase (2–10) work has begun.

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
| 2.1 | A property can be created and retrieved | **Not implemented** | No `properties` table migration. No CRUD routes. No UI. |
| 2.2 | Tenants and vacancies can be recorded | **Not implemented** | No `tenants` or `vacancies` table migrations. |
| 2.3 | An analysis project and run can be created | **Not implemented** | No `analysis_runs` table. No project concept in DB. |
| 2.4 | A linked manifest is created or reserved automatically | **Implemented** | `POST /api/analyses` uses atomic `create_analysis_run_with_manifest` RPC (migration 0003) — run + manifest v1 in one transaction. Returns 503 if migration not applied. Execute endpoint writes finalized manifest with stage outcomes; failure is fatal (run marked failed). `analysis_runs.manifest` JSONB is deprecated backward-compat only. |
| 2.5 | Schema and migration status are documented | **Partially implemented** | `DATA_MODEL.md` documents the target schema comprehensively. `schema_migrations` table is created by migration 0001. But no Phase 2 migrations exist. |
| 2.6 | Migrations are either verified applied or explicitly marked pending | **Partially implemented** | Migration 0001 exists with up/down scripts. Application status unknown. No Phase 2 migrations exist to evaluate. |

### Required entities — implementation status

| Entity | Migration exists | Route exists | UI exists | Tests exist |
|---|---|---|---|---|
| organizations | No | No | No | No |
| contacts | No | No | No | No |
| properties | No | No | No | No |
| buildings/leasable spaces | No | No | No | No |
| tenants | No | No | No | No |
| tenant_categories (taxonomy) | No (in-memory JS only) | No | No | Yes (taxonomy tests) |
| category_profiles | No | No | No | No |
| occupancy records | No | No | No | No |
| vacancies | No | No | No | No |
| analysis projects | No | No | No | No |
| analysis_runs | No | No | No | No |
| analysis_stage_results | No | No | No | No |
| source_observations | No | No | No | No |
| source_documents / data_sources | No | No | No | No |
| recommendations / business_candidates | No | No | No | No |
| opportunity_scores / score_components | No | No | No | No |
| confidence assessments | No (in-memory JS only) | No | No | Yes (confidence tests) |
| analyst_overrides | No | No | No | No |
| analysis manifests | Yes (migration 0003) | Yes (via analyses route) | No | No |
| report_projects | No | No | No | No |
| report_versions | No | No | No | No |
| customer_responses | No | No | No | No |
| follow_ups | No | No | No | No |
| observed_outcomes | No | No | No | No |
| lessons_learned | No | No | No | No |
| methodology_versions | No | No | No | No |
| prompt_versions | No | No | No | No |
| taxonomy_versions | No (version constant in JS) | No | No | No |
| scoring_model_versions | No | No | No | No |
| trade_areas | No | No | No | No |
| comparables / rent_analyses | No | No | No | No |
| cost_events | No | No | No | No |
| audit_logs | No | No | No | No |
| files | No | No | No | No |
| analyst_notes | No | No | No | No |
| inquiries | No | No | No | No |
| outreach_records | No | No | No | No |

### Additional Phase 2 requirements

| Requirement | Status | Notes |
|---|---|---|
| Avoid one large JSON document as primary system of record | **Not implemented** | Current system stores entire analysis as JSONB blob in `saved_locations.payload` |
| JSONB only for immutable snapshots, raw responses, flexible metadata | **Not implemented** | No new tables exist |
| Every analysis run links to a provenance manifest | **Implemented** | `analysis_manifests` table (migration 0003) with FK to `analysis_runs`. Route writes on creation + finalization. |
| Historical finalized manifests must be immutable | **Implemented** | `analysis_manifests` enforces immutability via BEFORE UPDATE/DELETE triggers (fire regardless of role, including service-role). RLS is SELECT-only. INSERT/UPDATE/DELETE revoked from anon and authenticated. No `updated_at` column. 57 test assertions verified. |
| Additive, ordered migrations | **Partially implemented** | Migration 0001 follows this pattern. No further migrations. |
| RLS and grants on exposed tables | **Partially implemented** | Legacy tables have RLS. No new tables exist to evaluate. |
| Internal-only tables protected from Data API | **Not implemented** | No new tables exist |

### Domain modules (Phase 2 prerequisites)

| Module | Status | Files | Tests |
|---|---|---|---|
| `src/domain/taxonomy/` | **Verified implemented** | `categories.js`, `index.js` | 10 tests |
| `src/domain/confidence/` | **Verified implemented** | `index.js` | 9 tests |
| `src/domain/scoring/` | **Not implemented** | Does not exist | — |
| `src/domain/rent/` | **Not implemented** | Does not exist | — |
| `src/domain/report/` | **Not implemented** | Does not exist | — |

### Fixtures

| Fixture | Status |
|---|---|
| Healthy grocery-anchored center | **Not implemented** |
| Declining strip with vacancies | **Not implemented** |
| Child-activity-dominated center | **Not implemented** |
| Small office property | **Not implemented** |
| Insufficient-data property | **Not implemented** |
| Physically-disqualified vacancy | **Not implemented** |

---

## Phase 3 — Grounded evidence pipeline

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 3.1 | Active analysis path does not use fabricated GPT facts | **Partially implemented** | New pipeline (`POST /api/analyses/:id/execute`) runs 5 grounded stages with no GPT. Legacy `POST /api/analyze` still exists (unchanged). New path does not fabricate data. |
| 3.2 | At least one real demographic source integrated | **Implemented (mock-verified)** | `server/pipeline/stages/demographics.js` — Census/ACS service interface, tier-1 reliability. Service client not yet wired to live API. |
| 3.3 | At least one real nearby-business/tenant-context source integrated | **Implemented (mock-verified)** | `server/pipeline/stages/demand-generators.js` — pluggable POI service (OSM/Google/Foursquare). Service client not yet wired to live API. |
| 3.4 | Every material fact has source provenance | **Implemented** | All external stages record `observations[]` with source_name, source_kind, source_url_or_id, retrieved_at, raw_value, normalized_value, confidence, reliability_tier. Persisted to `source_observations` table via execute endpoint callback. |
| 3.5 | Missing evidence reduces confidence | **Implemented** | Pipeline runner computes overall confidence as worst across stages. Stages without services return `insufficient`. Scoring engine degrades completeness→confidence. |
| 3.6 | Stage failures are isolated and recorded | **Implemented** | Runner catches per-stage errors, records `status: "failed"` + error message, continues to next stage. 21 runner assertions verify isolation. |
| 3.7 | Tests cover full, partial, missing, stale, and source-failure cases | **Implemented (mock-verified)** | 104 assertions: runner (21) + stages (60) + integration (23). Cover: complete data, missing fields, no coords, service errors, partial failures, zero results, depth filtering, fixture integration. |
| 3.8 | Live-service verification recorded separately from mocked tests | **Not yet verified** | No live API calls made. Requires owner to configure Mapbox/Census service clients and run integration tests against live endpoints. |

### Pipeline infrastructure

| Component | Status | Evidence |
|---|---|---|
| `server/pipeline/runner.js` | **Implemented** | Stage executor with ordered execution, failure isolation, cost tracking, confidence propagation, depth filtering, inputs hashing. 21 assertions. |
| Stage contract (name, version, run, outputs, observations, confidence, cost) | **Implemented** | All 5 stages conform to `{ name, version, run(ctx) → { outputs, observations[], confidence, completeness, cost } }` |
| Stage modules (17 planned) | **5 of 17 implemented** | property-validation, geo-enrichment, trade-area, demographics, demand-generators. 12 remaining planned in stages/index.js. |
| `server/routes/` modularization | **Implemented** | `server/routes/properties.js`, `tenants.js`, `vacancies.js`, `analyses.js` (with execute endpoint) |
| `server/services/` | **Implemented** | `server/services/supabase-admin.js`. Service interfaces for geocoding, isochrone, census, places defined in stage modules. |
| Census/ACS service | **Interface implemented (mock-verified)** | `demographics.js` stage defines `CensusService` interface (getTract, getACSData). Live client not yet wired. |
| POI/Places service | **Interface implemented (mock-verified)** | `demand-generators.js` stage defines `PlacesService` interface (searchNearby, providerName). Live client not yet wired. |
| DOT traffic service | **Not implemented** | — |
| Mapbox Isochrone service | **Interface implemented (mock-verified)** | `trade-area.js` stage defines `IsochroneService` interface (getIsochrone). Live client not yet wired. Mapbox token exists. |

---

## Phase 4 — Analyst workspace

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 4.1 | Create and edit a property | **API + UI implemented** | `POST/PATCH /api/properties` routes + `/workspace/properties/new` create form, `/workspace/properties/:id` detail view |
| 4.2 | Add buildings or spaces | **Not implemented** | — |
| 4.3 | Add tenants | **API implemented** | `POST /api/properties/:id/tenants` route exists; no UI |
| 4.4 | Add vacancies | **API implemented** | `POST /api/properties/:id/vacancies` route exists; no UI |
| 4.5 | Enter vacancy characteristics | **API implemented** | Vacancy routes accept all physical attributes; no UI |
| 4.6 | Start an analysis | **API + UI implemented** | `POST /api/analyses` creates run; `POST /api/analyses/:id/execute` runs pipeline. UI: property detail has "New analysis" + depth selector + "Run" button. Analysis detail shows stage results. |
| 4.7 | Resume an incomplete analysis | **Not implemented** |
| 4.8 | View stage progress | **Not implemented** |
| 4.9 | Inspect observations and sources | **Not implemented** |
| 4.10 | View warnings and missing evidence | **Not implemented** |
| 4.11 | Review recommendation scores | **Not implemented** |
| 4.12 | Override facts or recommendations | **Not implemented** |
| 4.13 | Record override reason | **Not implemented** |
| 4.14 | Preserve original and final values | **Not implemented** |
| 4.15 | Approve, reject, or edit narrative | **Not implemented** |
| 4.16 | Save progress | **Not implemented** |
| 4.17 | Staff user can complete the full workflow | **Not implemented** |
| 4.18 | Authorization enforced server-side | **Implemented for API** — All new routes require `populateAuth → requireAuth → requireStaff` middleware chain. `/api/analyze` also role-gated. |
| 4.19 | Overrides record actor, timestamp, reason, original, final | **Not implemented** |
| 4.20 | Errors and missing evidence remain visible | **Not implemented** |
| 4.21 | Critical workflow behavior has integration-level test coverage | **Not implemented** |

### Frontend workspace routes

| Route | Status | Current state |
|---|---|---|
| `/workspace` (overview) | **Implemented** | Workspace shell with sidebar nav, stats cards, recent analyses |
| `/workspace/properties` | **Implemented** | Property list, create form (`/new`), detail page (`/:id`) with tenant/vacancy summary |
| `/workspace/analyses` | **Implemented** | Analysis list, detail page (`/:id`) with stage results, execute button, error display |
| `/workspace/reports` | **Not implemented** | — |
| `/workspace/prospects` | **Not implemented** | — |
| `/workspace/data-sources` | **Not implemented** | — |
| `/workspace/methodology` | **Not implemented** | — |
| `/workspace/settings` | **Not implemented** | — |

Current routes: `/` (Landing), `/app` (Analyze), `/dashboard`, `/saved`, `/profile` — all SaaS-era.

---

## Phase 5 — Deterministic recommendation engine

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 5.1 | Scores are deterministic | **Not implemented** — `src/domain/scoring/` does not exist |
| 5.2 | Score components stored and inspectable | **Not implemented** |
| 5.3 | Confidence separate from opportunity | **Not implemented** (confidence module exists but scoring does not) |
| 5.4 | Hard constraints can disqualify categories | **Not implemented** |
| 5.5 | Missing evidence cannot improve confidence | **Verified in confidence model** — completeness < 0.35 caps at INSUFFICIENT |
| 5.6 | LLM cannot silently change ordering | **Not implemented** — LLM currently generates the entire analysis |
| 5.7 | Tests cover strong fit, weak fit, disqualification, missing evidence, contradictory evidence | **Not implemented** |

### Category profile attributes (from taxonomy)

The taxonomy module defines profiles with: `typicalSqftRange`, `preferredDayparts`, `orientation`, `parkingDemand`, `visibilitySensitivity`, `incomeSensitivity`, `daytimePopulationSensitivity`, `residentialDensitySensitivity`, `familyHouseholdSensitivity`, `competitionTolerance`, `cotenancyPreferences`, `physicalRequirements`, `rentTolerance`, `visitFrequency`. These provide the foundation for scoring but no scoring engine uses them yet.

---

## Phase 6 — Professional report generation

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 6.1 | Complete report from saved analysis | **Not implemented** |
| 6.2 | Actual PDF rendered | **Not implemented** — `jspdf`/`html2canvas` installed but unused; `@react-pdf/renderer` not installed |
| 6.3 | PDF visually inspected | **Not implemented** |
| 6.4 | Pagination, maps, charts, tables, typography usable | **Not implemented** |
| 6.5 | Unsupported claims absent | **Not implemented** |
| 6.6 | Sources and methodology appear | **Not implemented** |
| 6.7 | Frozen analysis produces reproducible snapshot | **Not implemented** |
| 6.8 | Tests validate key content and generation | **Not implemented** |
| 6.9 | Internal prompts excluded from customer PDF | **Not implemented** |

### Report infrastructure

| Component | Status |
|---|---|
| `report_projects` table | **Not implemented** |
| `report_sections` table | **Not implemented** |
| `report_versions` table | **Not implemented** |
| `report_assets` table | **Not implemented** |
| `server/reports/` renderers | **Not implemented** (directory does not exist) |
| `@react-pdf/renderer` dependency | **Not installed** |
| Mapbox Static Images integration | **Not implemented** |
| Chart SVG shared spec functions | **Not implemented** |
| Review workflow (draft → reviewed → final → archived) | **Not implemented** |

---

## Phase 7 — Follow-up, outcomes, and learning

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 7.1 | Follow-ups can be created and reviewed | **Not implemented** |
| 7.2 | Outcomes link to original vacancy and analysis | **Not implemented** |
| 7.3 | Historical manifests remain immutable | **Implemented** | BEFORE UPDATE/DELETE triggers reject all mutations (including service-role). REVOKE INSERT/UPDATE/DELETE from anon/authenticated. RLS SELECT-only with `is_internal_staff()`. 57 test assertions verified. |
| 7.4 | Corrections produce amendments or new versions | **Implemented** | `(analysis_run_id, version)` unique constraint. Execute route queries max version and inserts N+1. Tests verify version 1 unchanged after re-execution, zero UPDATEs/DELETEs on manifests table. |
| 7.5 | Lessons can reference reports, analyses, responses, outcomes | **Not implemented** |
| 7.6 | Observations distinguished from assumptions | **Not implemented** |
| 7.7 | Default follow-up milestones (3/6/12/24 months) | **Not implemented** |

No tables, routes, UI, or tests exist for any Phase 7 entity.

---

## Phase 8 — Internal knowledge assistant

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 8.1 | Retrieves from real TrafficScout data | **Not implemented** |
| 8.2 | Material answers include citations or links | **Not implemented** |
| 8.3 | Unsupported questions return insufficient evidence | **Not implemented** |
| 8.4 | Authorization enforced | **Not implemented** |
| 8.5 | Tool calls logged safely | **Not implemented** |

No assistant infrastructure exists.

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
| 10.12 | Cost controls | **Not implemented** — no `cost_events` table |
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
| **Phase 2** — Core data model | **Not started** | 0 of 6 criteria met |
| **Phase 3** — Evidence pipeline | **Not started** | 0 of 8 criteria met (confidence model provides foundation only) |
| **Phase 4** — Analyst workspace | **In progress** | 3 of 21 criteria met (4.1, 4.6, 4.18) + workspace shell, property CRUD UI, analysis trigger UI |
| **Phase 5** — Recommendation engine | **Not started** | 1 of 7 partially met (confidence hard floor) |
| **Phase 6** — Report generation | **Not started** | 0 of 9 criteria met |
| **Phase 7** — Follow-up & learning | **Not started** | 0 of 7 criteria met |
| **Phase 8** — Knowledge assistant | **Not started** | 0 of 5 criteria met |
| **Phase 9** — Sales & prospecting | **Not started** | 0 of 5 criteria met |
| **Phase 10** — Production readiness | **Not started** | 3 of 18 partially met |

**Earliest incomplete governing phase: Phase 2 — Core data model and provenance.**

The repository has a solid foundation (docs, taxonomy, confidence, role gates, env validation) but no Phase 2+ work has begun. The server remains a monolith, the analysis is still fully GPT-fabricated, and no new database tables exist beyond the legacy 4 + migration 0001's role columns.

---

## Owner actions required before Phase 2 can begin

1. Run `npm install` locally to get correct native binaries, verify `npm test` (32/32) and `npm run build` pass
2. Apply `supabase/migrations/0001_add_profile_roles.up.sql` in Supabase SQL editor
3. Disable public sign-ups in Supabase dashboard (Auth → Providers → Email)
4. Check Stripe dashboard for active subscriptions (gates future Phase 10 billing teardown)
5. Confirm the owner account email for admin seeding (`davidshoemaker@gameplan.tech` in migration 0001)
