# TrafficScout — Data Model

Conventions: Postgres (Supabase). `id uuid pk default gen_random_uuid()` unless noted; `created_at/updated_at timestamptz`; soft coupling to legacy tables preserved during migration. JSONB is allowed only for stage-specific outputs and flexible attributes — **core searchable entities and all provenance are explicit columns/rows.** All new tables get RLS: staff-only (`exists (select 1 from profiles p where p.id = auth.uid() and p.role is not null)`), with writes via service role or owner policies as noted.

## 1. Legacy tables (retained during migration)

- `profiles` — **extended**: `+ role text check (role in ('admin','analyst'))` (NULL = no access), `+ invited_by uuid`, `+ invited_at`. `billing_tier`/`stripe_customer_id` kept until Phase 7.
- `subscriptions`, `usage_events` — frozen; deprecated in Phase 7 (usage_events superseded by `cost_events`).
- `saved_locations` — read-only legacy; optional backfill into `properties` (`source='legacy_saved_location'`).

## 2. Core entities

### organizations
Ownership/management/brokerage firms and prospect clients.
`name`, `org_type` (`owner|manager|broker|developer|tenant|other`), `website`, `notes`, `source_id fk→data_sources`, `verified_at`.

### contacts
Business contacts only, legitimately public/licensed.
`organization_id fk`, `full_name`, `title`, `email`, `phone`, `source_id fk`, `source_url`, `verified_at`, `do_not_contact boolean default false`, `notes`.

### properties
`name`, `address`, `city/state/postal`, `lat/lng` (numeric(9,6)), `property_type` (`shopping_center|retail|office|mixed|pad|other`), `center_subtype` (`strip|neighborhood|community|power|lifestyle|regional|null`), `total_gla_sqft int`, `boundary geojson jsonb`, `owner_org_id fk`, `manager_org_id fk`, `broker_org_id fk`, `website`, `leasing_contact_id fk→contacts`, `parking_spaces int`, `parking_notes`, `access_points jsonb`, `road_frontage jsonb`, `signage_visibility jsonb`, `analyst_notes`, `data_freshness_at`, `status` (`active|prospect|archived`).

### property_photos / files
`files`: `bucket`, `path`, `mime`, `bytes`, `sha256`, `uploaded_by`, `kind` (`photo|document|report_asset|upload`), `property_id fk null`, `quarantined boolean`. Photos are `files` rows with `kind='photo'`.

### tenants
Existing occupants. `property_id fk`, `name`, `category_id fk→tenant_categories`, `unit_label`, `sqft int`, `is_anchor boolean`, `since date null`, `source_id fk`, `notes`.

### tenant_categories (taxonomy)
Mirrors `src/domain/taxonomy` (seeded from it; DB is the runtime source for joins, the JS module is the versioned definition).
`slug unique`, `name`, `parent_id fk self` (sector → subcategory), `sector`, `active boolean`, `taxonomy_version text`.

### category_profiles
Configurable attributes per category per methodology version — **never hard-coded in app logic**.
`category_id fk`, `methodology_version_id fk`, `attrs jsonb` validated by zod schema: typical_sqft_range, preferred_dayparts, destination_vs_convenience, parking_demand, visibility_sensitivity, income_sensitivity, daytime_pop_sensitivity, residential_density_sensitivity, family_sensitivity, competition_tolerance, cotenancy_preferences[], physical_requirements[], rent_tolerance, visit_frequency.

### vacancies
`property_id fk`, `unit_label`, `sqft int`, `asking_rent_psf numeric null`, `rent_basis` (`nnn|gross|modified_gross|unknown`), `cam_psf numeric null`, `condition` (`shell|white_box|second_gen|built_out|unknown`), `prior_tenant`, `prior_category_id fk null`, `vacant_since date null`, `placement` (`end_cap|inline|pad|freestanding|kiosk|unknown`), `frontage_ft numeric null`, `ceiling_height_ft numeric null`, `venting_possible` (`yes|no|unknown`), `grease_trap` (`yes|no|unknown`), `drive_through` (`yes|no|possible|unknown`), `patio_possible` (`yes|no|unknown`), `loading_access`, `parking_proximity`, `allowed_uses jsonb`, `restricted_uses jsonb`, `analyst_notes`, `data_confidence` (`high|moderate|preliminary|insufficient`), `source_id fk`.
Tri-state `unknown` values matter: compatibility rules must distinguish "no venting" (disqualifies restaurants) from "unknown" (lowers confidence).

## 3. Data & provenance

### data_sources
Registry. `name`, `kind` (`api|scrape|analyst|document|licensed`), `base_url`, `license_note`, `reliability_tier smallint (1=authoritative…4=unverified)`, `enabled`, `cost_model jsonb`.

### source_observations
**One row per external fact used anywhere.**
`source_id fk`, `source_url_or_id`, `retrieved_at`, `effective_date`, `geographic_scope`, `raw_value jsonb`, `normalized_value jsonb`, `unit`, `analyst_override jsonb null`, `override_by/at`, `confidence`, `license_note`, `subject_type` + `subject_id` (property/vacancy/trade_area/…), `analysis_run_id fk null` (run that consumed it).

## 4. Analysis

### trade_areas
`property_id fk`, `method` (`drive_time|walk_time|radius|custom`), `params jsonb` (e.g. minutes), `geometry jsonb (geojson)`, `source_observation_id fk`, `analysis_run_id fk`.

### analysis_runs
`property_id fk`, `requested_by fk→profiles`, `depth` (`teaser|standard|full`), `status` (`queued|running|partial|complete|failed`), `methodology_version_id fk`, `started_at/finished_at`, `error`, `total_cost_usd numeric`, `notes`.

### analysis_stage_results
`analysis_run_id fk`, `stage_name`, `stage_version`, `status` (`ok|skipped|failed|stale`), `inputs_hash text`, `inputs jsonb`, `outputs jsonb` (zod-validated per stage), `confidence`, `completeness numeric 0-1`, `error text null`, `duration_ms`, `cost_usd numeric`, `cache_hit boolean`, `created_at`. Unique `(analysis_run_id, stage_name)`; reruns supersede via `superseded_by fk self`.

### business_candidates
`analysis_run_id fk`, `category_id fk`, `vacancy_id fk null` (NULL = property-level), `rank int`, `verdict` (`recommend|neutral|avoid|disqualified`).

### opportunity_scores / score_components
`opportunity_scores`: `candidate_id fk`, `overall numeric 0-100`, `confidence`, `completeness`, `methodology_version_id fk`, `positive_factors jsonb`, `negative_factors jsonb`, `disqualifiers jsonb`.
`score_components`: `score_id fk`, `component_key`, `raw numeric`, `normalized numeric 0-100`, `weight numeric`, `inputs jsonb` (observation ids), `explanation text`.

### comparables / rent_analyses
`comparables`: `property_like jsonb` (name/address/coords), `sqft`, `rent_psf`, `rent_basis`, `cam_psf`, `ti_allowance_psf`, `free_rent_months`, `percentage_rent`, `lease_term_months`, `condition`, `placement`, `drive_through`, `lease_date`, `source_observation_id fk (required)`, `is_asking boolean`.
`rent_analyses`: `analysis_run_id fk`, `vacancy_id fk null`, `status` (`supported|insufficient_data`), `indicated_low_psf/high_psf numeric null`, `basis`, `assumptions jsonb`, `adjustments jsonb`, `comparable_ids uuid[]`, `data_as_of date`, `confidence`, `limitations text`, `disclaimer_version text` (rendered disclaimer: not an appraisal/BOV/legal advice). CHECK: range columns non-null **only when** `status='supported'`.

## 5. Reports

(Full section semantics in REPORT_SCHEMA.md.)
- `report_projects`: `property_id fk`, `analysis_run_id fk`, `kind` (`full|teaser`), `status` (`draft|reviewed|final|archived`), `title`, `branding jsonb`, `created_by`.
- `report_sections`: `report_project_id fk`, `section_key`, `position int`, `payload jsonb` (typed per section), `narrative jsonb` (blocks with grounding_refs), `review_status` (`pending|edited|accepted|rejected`), `locked boolean` (manual edits protected from regeneration), `reviewed_by/at`.
- `report_versions`: immutable snapshot on finalize — `report_project_id fk`, `version int`, `snapshot jsonb`, `pdf_file_id fk→files`, `finalized_by/at`, `methodology_version_id fk`.
- `report_assets`: rendered maps/charts/covers — `report_project_id fk`, `file_id fk`, `asset_key`, `spec jsonb`, `spec_hash` (regeneration idempotency).

## 6. Operations

- `methodology_versions`: `version text unique`, `weights jsonb`, `category_overrides jsonb`, `confidence_rules jsonb`, `active boolean` (one active), `notes`, `created_by`.
- `analyst_notes`: polymorphic `subject_type/subject_id`, `body`, `author_id`, `pinned`.
- `outreach_records` (prospecting): `property_id fk`, `organization_id fk null`, `contact_id fk null`, `status` (`identified|researching|report_prepared|contacted|follow_up_due|meeting_scheduled|proposal_sent|won|lost|do_not_contact`), `follow_up_on date null`, `history jsonb[] (append-only status changes)`, `notes`.
- `cost_events`: `analysis_run_id fk null`, `service`, `operation`, `units jsonb` (tokens/calls), `cost_usd numeric`, `created_at` — replaces `usage_events` for the internal model.
- `audit_logs`: `actor_id`, `action` (`report_finalized|report_shared|report_exported|user_invited|methodology_changed|…`), `subject_type/subject_id`, `detail jsonb`, `created_at`. Append-only; no update/delete policies.
- `inquiries` (public form): `name`, `work_email`, `organization`, `role`, `property_address`, `property_type`, `vacancy_count`, `primary_question`, `upload_file_id fk null`, `consented boolean not null`, `status` (`new|reviewed|converted|dismissed`), `ip_hash`.

## 7. Migration mechanics

- Numbered pairs in `supabase/migrations/`: `NNNN_name.up.sql` + `NNNN_name.down.sql`. Legacy `schema.sql` frozen as baseline `0000`.
- All Phase 2 migrations are **additive** (new tables, added nullable columns) → down migrations are plain drops with no data loss to legacy tables.
- Destructive cleanup (dropping `subscriptions` etc.) only in Phase 7, preceded by a data export migration and documented rollback.
- Every migration applied via SQL editor or `supabase db push`; applied versions tracked in a `schema_migrations` table created by `0001`.
