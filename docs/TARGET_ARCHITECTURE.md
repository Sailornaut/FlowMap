# TrafficScout — Target Architecture

**Positioning:** TrafficScout is a commercial real-estate intelligence service. The deliverable is a defensible, source-backed recommendation packet answering: *"What should occupy this space, why is it a strong fit, and how confident are we?"* The internal application exists to produce that packet efficiently and honestly.

---

## 1. System shape

Same deployment topology as today (Vite/React SPA + Express API + Supabase Postgres), reorganized around domains instead of pages:

```
┌─ Public site (marketing, /) ──────────────┐   unauthenticated, static-ish
│  Home · Services · Sample Report ·        │   + rate-limited POST /api/inquiries
│  Methodology · About · Request · Contact  │
└───────────────────────────────────────────┘
┌─ Internal workspace (/workspace/*) ───────┐   Supabase Auth, role-gated
│  Dashboard · Properties · Analyses ·      │
│  Reports · Prospects · Data Sources ·     │
│  Methodology · Settings                   │
└───────────────────────────────────────────┘
┌─ Express API ─────────────────────────────┐
│  server/routes/*      thin HTTP handlers  │
│  server/services/*    orchestration, ext. │
│  server/pipeline/*    analysis stages     │
│  server/reports/*     render + PDF        │
└───────────────────────────────────────────┘
┌─ Shared domain (src/domain/*) ────────────┐   pure JS/ESM, no React, no Express,
│  taxonomy · scoring · confidence ·        │   no I/O — importable by client,
│  rent-analysis rules · report model       │   server, and tests alike
└───────────────────────────────────────────┘
┌─ Supabase ────────────────────────────────┐
│  Postgres (explicit entities, provenance) │
│  Auth (invite-only, roles)                │
│  Storage (report assets, PDFs, photos)    │
└───────────────────────────────────────────┘
```

**Key structural rule:** business logic moves out of page components and out of the Express monolith into `src/domain/` (pure, deterministic, unit-testable) and `server/services/` (I/O, orchestration). Page components render; routes translate HTTP; nothing else.

## 2. Module layout

```
src/
  domain/                  # pure logic, zero dependencies on React/Express/Supabase
    taxonomy/              # tenant category tree + attribute profiles (versioned)
    scoring/               # opportunity score: components, weights, normalization
    confidence/            # confidence levels + completeness calculator
    rent/                  # rent-comp adjustment rules, safeguard checks
    report/                # report section model, ordering, grounding validation
  pages/
    workspace/             # internal app pages
    public/                # marketing pages
  components/
    property/ vacancy/ analysis/ report/ ui/ ...
  lib/                     # supabase client, api-client, mapbox (as today)
server/
  index.js                 # boot: env validation, middleware, route mounting only
  routes/                  # auth-gated route modules (properties, analyses, reports…)
  services/                # supabase-admin, openai, mapbox-static, census, places,
  pipeline/                # stage runner + one module per stage (see §4)
  reports/                 # section renderers → react-pdf document
supabase/
  migrations/              # numbered, reversible SQL (NNNN_name.up.sql / .down.sql)
  schema.sql               # frozen legacy baseline (kept for history)
```

## 3. Navigation & screens (internal workspace)

- **Dashboard** — active analyses, reports awaiting review, recently generated reports, data-source failures (last N pipeline errors), estimated API spend (from `cost_events`), properties with incomplete data, "New analysis" quick action.
- **Properties** — list + property record (identity, physical attributes, tenants, vacancies, photos, sources, notes, freshness, history). Property and vacancy fields per DATA_MODEL.md.
- **Analyses** — runs per property; stage timeline with inputs/outputs/provenance/confidence per stage; rerun individual stages; inspect raw source observations.
- **Reports** — report projects; structured section editor; analyst review workflow (accept/reject/edit/lock/reorder, per-section regenerate); status Draft → Reviewed → Final → Archived; PDF preview/export; version history.
- **Prospects** — prospect pipeline (statuses Identified → … → Won/Lost/Do-not-contact), teaser report generation, outreach log. No bulk email.
- **Data Sources** — registry of configured sources, health, last retrieval, cost per source, cache hit rates.
- **Methodology** — read-only rendering of the active methodology version: scoring weights, category profiles, confidence rules. Every report cites the version it was built with.
- **Settings** — staff invitations/roles, branding assets, analysis-depth defaults, API keys status (never values).

## 4. Analysis pipeline

A run is a sequence of stages executed by a small runner (`server/pipeline/runner.js`). Uniform stage contract:

```js
{ name, version, run(ctx) -> { outputs, observations[], confidence, completeness, cost } }
```

Each stage persists an `analysis_stage_results` row: inputs hash, outputs (validated JSONB), source observations (provenance rows), retrieved-at timestamps, confidence, errors (surfaced, never swallowed), duration, and per-call cost. Stages are independently rerunnable; stable inputs (geocode, census tract data) are cached with the existing Upstash/memory cache, keyed by stage+inputs hash.

Stage order (each may be skipped by configured analysis depth):
1. **property-validation** — required fields, geocode confirmation
2. **geo-enrichment** — parcel/boundary, road frontage hints, static map assets
3. **trade-area** — drive-time/radius isochrones (Mapbox Isochrone API — token already provisioned)
4. **demographics** — Census/ACS by tract/block-group intersection with trade area (free, authoritative)
5. **traffic-patterns** — DOT AADT counts where available; modeled estimates clearly labeled as modeled
6. **demand-generators** — POI retrieval (Places/Foursquare/Overture) near property
7. **competition** — same-category POI density/saturation within trade area
8. **tenant-classification** — map existing tenants onto taxonomy (`src/domain/taxonomy`)
9. **gap-analysis** — deterministic tenant-mix gap/oversaturation from 7+8
10. **vacancy-compatibility** — physical-constraint filter per vacancy (deterministic rules)
11. **candidate-scoring** — TrafficScout Tenant Opportunity Score (§5)
12. **synergy** — co-tenancy synergy/cannibalization matrix from taxonomy preferences
13. **risk** — data limitations, single-source facts, staleness flags
14. **rent-comps** — only if comparables entered/available; safeguards in `src/domain/rent`
15. **narrative** — the *only* LLM stage that writes prose; consumes structured outputs of 1–14; schema-constrained; every claim carries a reference to a stage output or observation id; validated before storage
16. **analyst-review** — human gate (not automated)
17. **report-generation** — assembles report project from reviewed data

**AI boundary (hard rule):** stages 1–14 are deterministic or third-party-data-driven. The LLM never produces a number that feeds scoring; it may summarize, explain, flag contradictions, and suggest missing research. Narrative outputs are stored with `grounding_refs`; a validation pass rejects any narrative block whose refs don't resolve.

## 5. Opportunity scoring (`src/domain/scoring`)

- Named components (local demand, demographic alignment, traffic alignment, daypart alignment, competition, tenant-mix gap, co-tenancy synergy, unit-size fit, physical fit, visibility, access, parking, market growth, rent feasibility, data quality), each 0–100 with an explicit input list.
- Weight sets are **data, not code**: stored in `methodology_versions` (JSONB), per-category overrides supported, normalized to sum 1.0, versioned; every score row records the methodology version used.
- Disqualifying constraints (e.g., no venting for restaurant use) zero out a candidate-for-vacancy pairing regardless of score, with the constraint named.
- Output per candidate (and per candidate×vacancy): overall, components, weights, positive/negative factors, disqualifiers, confidence, completeness, methodology version. Pure functions → directly unit-testable.

## 6. Confidence framework (`src/domain/confidence`)

Levels: **High / Moderate / Preliminary / Insufficient data.** Computed from source reliability tier, recency, corroboration count, geographic precision, model coverage, and required-field completeness. Reports label every figure as one of: *measured fact · third-party data · modeled estimate · analyst-entered · AI interpretation.* If rent comps can't support an estimate, the rent section renders the "insufficient data" template — it never invents a range.

## 7. Report generation — approach and tradeoffs

Requirement: reproducible, professional PDF from stored structured data; no browser screenshots.

| Option | Pros | Cons |
|---|---|---|
| **@react-pdf/renderer (server-side)** — recommended | Deterministic vector output from React components; same skillset as the rest of the app; runs in plain Node on Render (no headless browser); reproducible from stored report data; page headers/footers/numbers/watermarks supported | Its own layout primitives (not HTML/CSS); charts must be drawn as react-pdf SVG (we generate chart SVGs from pure functions — also reusable in the web preview) |
| Headless Chromium print-to-PDF (Playwright) | Full HTML/CSS fidelity; preview = artifact | Heavy on Render's memory; slower cold starts; reproducibility depends on browser version; operationally the fragile choice |
| pdfmake / jsPDF programmatic | Light | Imperative document building scales badly to a 24-section branded packet |
| LaTeX/Typst toolchain | Beautiful typography | Foreign toolchain for this team; binary deps on Render |

**Decision: @react-pdf/renderer**, with maps embedded as Mapbox Static Images API PNGs (fetched server-side with a server token, cached as report assets) and charts as shared SVG-spec functions rendered both by web preview and PDF. The existing `jspdf`/`html2canvas` deps are removed, not built upon.

## 8. Cost controls

- `cost_events` table: every external call (OpenAI tokens, paid POI calls) recorded per analysis run per service.
- Cache-first per stage; duplicate-request prevention via inputs-hash idempotency.
- Configurable analysis depth (teaser vs. full) selects stage subset; pre-run cost estimate shown from per-stage historical averages.
- Retry with backoff per service; failed sources degrade the run's confidence instead of failing the run (error surfaced on Dashboard).
- Dev fixtures: recorded JSON responses per source under `fixtures/`, activated by `USE_FIXTURES=1` so tests and local dev never hit paid APIs.

## 9. Security model

- Supabase Auth retained; invite-only; `profiles.role ∈ {admin, analyst}`; server middleware enforces role on every internal route (401 without session, 403 without role).
- RLS retained and extended to new tables (owner = internal staff; public tables none).
- Service-role key server-only (unchanged). Env validation at startup (fail fast, named missing vars).
- Public endpoints: only the inquiry form; rate-limited (existing limiter), validated (zod), uploads type/size-checked into quarantined storage prefix.
- Finalized reports in Supabase Storage private bucket; signed expiring URLs for sharing; `audit_logs` rows on finalize/share/export.
- All scraped/uploaded text is untrusted: delimited as data in prompts, never as instructions; LLM outputs schema-validated before storage.

## 10. Typing & standards

New domain modules use JSDoc types + `// @ts-check` with `checkJs` enabled for `src/domain/**` (incremental strictness without a big-bang TS migration); zod schemas validate every external API response and every LLM output at the boundary. Structured logging (pino) on the server. Vitest for unit tests; fixtures for the six required scenario properties (see MIGRATION_PLAN.md Phase 2).
