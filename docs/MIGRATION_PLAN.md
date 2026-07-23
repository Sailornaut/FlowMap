# TrafficScout — Migration Plan

**Strategy: incremental migration, not a rewrite.** The assessment (PIVOT_ARCHITECTURE_ASSESSMENT.md) shows a small, working codebase whose auth, geocoding, caching, charts, and deployment are all reusable. The risky part — the grounded analysis pipeline — is *new* either way; rewriting the working 20% around it would add risk for nothing. Each phase leaves `main` deployable.

**Verification gate after every phase:** `npm run build` + `npm run lint` + `npm test` (once vitest lands) + manual smoke of the current entry flow; summarize changed files; update docs.

---

## Phase 1 — Assessment & stabilization  *(no user-facing change)*
1. ✅ Documentation set (`docs/*` — this set).
2. Security hardening (independent of refactor, do first):
   - Disable public sign-ups in Supabase dashboard (config).
   - Migration `0001`: add `profiles.role`; seed the owner account as `admin`.
   - Server middleware: internal routes require non-null role (403 otherwise). `/api/analyze` becomes role-gated → stops uninvited signups from spending OpenAI budget.
3. Establish testing baseline: add vitest + first pure-domain modules with tests (taxonomy, confidence) — additive only, nothing imports them yet.
4. Env validation at server startup (fail fast with named vars).
5. Fix stale README statements.
**Rollback:** each item independently revertable; migration 0001 has a down script.

## Phase 2 — Domain & data-model foundation *(additive migrations only)*
1. Migrations `0002…000N`: `data_sources`, `source_observations`, `organizations`, `contacts`, `properties`, `tenants`, `tenant_categories`, `category_profiles`, `vacancies`, `trade_areas`, `analysis_runs`, `analysis_stage_results`, `methodology_versions`, `cost_events`, `files`, `analyst_notes`, `audit_logs` + RLS policies. All additive; downs are drops.
2. Seed `tenant_categories` from `src/domain/taxonomy`; seed `methodology_versions` v1 with initial weights.
3. `src/domain/scoring` + `src/domain/rent` pure modules with tests.
4. Fixtures for the six required scenarios (healthy grocery-anchored center; declining strip w/ vacancies; child-activity-dominated center; small office property; insufficient-data property; physically-disqualified vacancy) as JSON under `fixtures/`.
5. Optional backfill script: `saved_locations` → `properties` (flagged `legacy`).
**Risk:** schema churn — mitigated by driving table shapes from the fixtures and tests first.

## Phase 3 — Internal property workspace
1. Server modularization: split `server/index.js` into `routes/` + `services/` (behavior-preserving; billing routes move untouched).
2. Properties/vacancies CRUD (routes + pages), reusing Mapbox search for address entry and `LocationMap` for display.
3. Pipeline runner + first grounded stages: validation, geo-enrichment, trade-area (Mapbox Isochrone), demographics (Census ACS — free), demand-generators/competition (POI source; start with one provider behind a `services/places.js` interface).
4. Analyses screen with stage timeline, provenance inspection, per-stage rerun; `cost_events` recording; Dashboard v2 (ops view).
5. Legacy `/app` flow still works untouched until parity.
**Risk:** external-source integration quality — degrade to explicit `insufficient` confidence, never to AI-fabricated values.

## Phase 4 — Scoring & recommendations
1. Wire `src/domain/scoring` into pipeline stages 8–13; scores persisted with components/weights/methodology version.
2. Category profiles editable (Settings/Methodology); weight changes create new methodology versions.
3. Vacancy-compatibility rules (tri-state unknowns) + disqualifier surfacing.
4. Narrative stage: schema-constrained LLM explanations grounded by `grounding_refs`; validation rejects unreferenced claims.
5. Analyst review UI: accept/reject/edit/reorder/lock/regenerate per section-precursor.
**Risk:** score credibility — mitigated by fixtures with hand-computed expected scores.

## Phase 5 — Report builder
1. Report model tables (`report_projects/sections/versions/assets`) — additive migration.
2. Section renderers (web preview) + @react-pdf/renderer document; chart-spec → SVG shared functions; Mapbox Static Images assets.
3. Review workflow states, finalization gate, immutable versions, audit logging, signed-URL sharing.
4. Rent-analysis section with both shapes (`supported` / `insufficient_data`) and hard safeguards from `src/domain/rent`.
**Risk:** PDF fidelity on Render — react-pdf is pure Node (no headless browser); prototype the heaviest section first.

## Phase 6 — Prospecting & public site
1. `outreach_records` + Prospects screen; teaser report kind; no bulk email anywhere.
2. Rewrite `Landing.jsx` → outcome-focused public site (Home/Services/Sample Report/Methodology/About/Request an Analysis/Contact); `inquiries` endpoint with rate limit + validation + upload quarantine.
3. Remove Google Ads tag with the new site (or keep intentionally — owner decision).
**Risk:** low.

## Phase 7 — Deprecation & cleanup *(only after replacements are live)*
1. Verify zero active Stripe subscriptions (business action: cancel/refund if any); remove `/api/billing/*`, webhook, Stripe deps, `CheckoutStatusBanner`, `plan-config`, billing UI in Profile/AppLayout/AuthScreen.
2. Export then drop `subscriptions`; freeze `usage_events` (export + drop after cost_events proves out); drop `saved_locations` after backfill sign-off. Each with documented down/restore path (dumps stored under `supabase/exports/`).
3. Remove dead code (mock `analysis-service.js`, zero-byte ui stubs, empty dirs) and unused deps (§1.11 of the assessment); prune env vars (`STRIPE_*`, plan tuning) from README, Render, Vercel.
4. Final docs pass; keep migration history + rollback notes in repo.
**Rollback:** git revert + restore-from-export scripts; nothing here is time-critical.

---

## External services & estimated ongoing cost (initial, low volume)

| Service | Use | Est. monthly (≤ ~30 full analyses) |
|---|---|---|
| Supabase | auth/db/storage | $0–25 (free tier likely sufficient initially) |
| Vercel + Render | hosting | $0–14 (current setup) |
| Mapbox | geocode, isochrones, static maps | $0 at this volume (generous free tier) |
| Census/ACS | demographics | $0 |
| OpenStreetMap/Overture | POI baseline | $0 |
| Google Places or Foursquare (optional accuracy upgrade) | POI/competitors | $0–50 depending on tier and caching |
| State DOT AADT feeds | traffic counts | $0 (public), coverage varies |
| OpenAI | narratives only (no longer the whole product) | $5–30; strictly metered via `cost_events` |
| Upstash Redis | cache/rate limit | $0 (free tier) |
| Sentry | monitoring | $0 (dev tier) |
| Rent comps | **no viable cheap API** — analyst-entered from listings/brokers | $0 + analyst time |

Cost posture: cache-first, fixtures in dev, per-run cost estimate before full runs.
