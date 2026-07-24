-- 0002 (up): Core data model for the TrafficScout internal CRE intelligence platform.
-- Part of governing Phase 2 — Core data model and provenance.
-- All tables are additive; down migration is plain drops.
-- Every table gets RLS: staff-only unless noted.
-- See docs/DATA_MODEL.md for the design rationale.

-- ============================================================================
-- Helper: reusable RLS policy for staff-only access
-- ============================================================================

-- Staff-only read/write policy function (reusable across tables)
create or replace function public.is_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role is not null
  )
$$;

-- ============================================================================
-- 1. Data sources & provenance
-- ============================================================================

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('api', 'scrape', 'analyst', 'document', 'licensed')),
  base_url text,
  license_note text,
  reliability_tier smallint not null check (reliability_tier between 1 and 4),
  enabled boolean not null default true,
  cost_model jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_sources enable row level security;
create policy "data_sources_staff_select" on public.data_sources
  for select using (public.is_internal_staff());
create policy "data_sources_staff_insert" on public.data_sources
  for insert with check (public.is_internal_staff());
create policy "data_sources_staff_update" on public.data_sources
  for update using (public.is_internal_staff());

-- ============================================================================
-- 2. Organizations & contacts
-- ============================================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('owner', 'manager', 'broker', 'developer', 'tenant', 'other')),
  website text,
  notes text,
  source_id uuid references public.data_sources(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
create policy "organizations_staff_select" on public.organizations
  for select using (public.is_internal_staff());
create policy "organizations_staff_insert" on public.organizations
  for insert with check (public.is_internal_staff());
create policy "organizations_staff_update" on public.organizations
  for update using (public.is_internal_staff());

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  title text,
  email text,
  phone text,
  source_id uuid references public.data_sources(id),
  source_url text,
  verified_at timestamptz,
  do_not_contact boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
create policy "contacts_staff_select" on public.contacts
  for select using (public.is_internal_staff());
create policy "contacts_staff_insert" on public.contacts
  for insert with check (public.is_internal_staff());
create policy "contacts_staff_update" on public.contacts
  for update using (public.is_internal_staff());

-- ============================================================================
-- 3. Properties
-- ============================================================================

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text,
  state text,
  postal_code text,
  lat numeric(9,6),
  lng numeric(9,6),
  property_type text not null check (property_type in (
    'shopping_center', 'retail', 'office', 'mixed', 'pad', 'other'
  )),
  center_subtype text check (center_subtype in (
    'strip', 'neighborhood', 'community', 'power', 'lifestyle', 'regional'
  )),
  total_gla_sqft integer,
  boundary jsonb,
  owner_org_id uuid references public.organizations(id) on delete set null,
  manager_org_id uuid references public.organizations(id) on delete set null,
  broker_org_id uuid references public.organizations(id) on delete set null,
  website text,
  leasing_contact_id uuid references public.contacts(id) on delete set null,
  parking_spaces integer,
  parking_notes text,
  access_points jsonb,
  road_frontage jsonb,
  signage_visibility jsonb,
  analyst_notes text,
  data_freshness_at timestamptz,
  status text not null default 'active' check (status in ('active', 'prospect', 'archived')),
  source text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.properties enable row level security;
create policy "properties_staff_select" on public.properties
  for select using (public.is_internal_staff());
create policy "properties_staff_insert" on public.properties
  for insert with check (public.is_internal_staff());
create policy "properties_staff_update" on public.properties
  for update using (public.is_internal_staff());

-- ============================================================================
-- 4. Files (photos, documents, report assets)
-- ============================================================================

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  mime text,
  bytes bigint,
  sha256 text,
  uploaded_by uuid references public.profiles(id),
  kind text not null check (kind in ('photo', 'document', 'report_asset', 'upload')),
  property_id uuid references public.properties(id) on delete set null,
  quarantined boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;
create policy "files_staff_select" on public.files
  for select using (public.is_internal_staff());
create policy "files_staff_insert" on public.files
  for insert with check (public.is_internal_staff());

-- ============================================================================
-- 5. Taxonomy (DB mirror of src/domain/taxonomy)
-- ============================================================================

create table if not exists public.tenant_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.tenant_categories(id),
  sector text not null,
  active boolean not null default true,
  taxonomy_version text not null,
  created_at timestamptz not null default now()
);

alter table public.tenant_categories enable row level security;
create policy "tenant_categories_staff_select" on public.tenant_categories
  for select using (public.is_internal_staff());
-- Insert/update via service role only (seed script)

-- ============================================================================
-- 6. Methodology versions
-- ============================================================================

create table if not exists public.methodology_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  weights jsonb not null,
  category_overrides jsonb,
  confidence_rules jsonb,
  active boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.methodology_versions enable row level security;
create policy "methodology_versions_staff_select" on public.methodology_versions
  for select using (public.is_internal_staff());
-- Insert/update via service role (admin action)

-- ============================================================================
-- 7. Category profiles (per category per methodology version)
-- ============================================================================

create table if not exists public.category_profiles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.tenant_categories(id) on delete cascade,
  methodology_version_id uuid not null references public.methodology_versions(id) on delete cascade,
  attrs jsonb not null,
  created_at timestamptz not null default now(),
  unique (category_id, methodology_version_id)
);

alter table public.category_profiles enable row level security;
create policy "category_profiles_staff_select" on public.category_profiles
  for select using (public.is_internal_staff());

-- ============================================================================
-- 8. Tenants
-- ============================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  category_id uuid references public.tenant_categories(id),
  unit_label text,
  sqft integer,
  is_anchor boolean not null default false,
  since date,
  source_id uuid references public.data_sources(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
create policy "tenants_staff_select" on public.tenants
  for select using (public.is_internal_staff());
create policy "tenants_staff_insert" on public.tenants
  for insert with check (public.is_internal_staff());
create policy "tenants_staff_update" on public.tenants
  for update using (public.is_internal_staff());
create policy "tenants_staff_delete" on public.tenants
  for delete using (public.is_internal_staff());

-- ============================================================================
-- 9. Vacancies
-- ============================================================================

create table if not exists public.vacancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_label text,
  sqft integer,
  asking_rent_psf numeric,
  rent_basis text check (rent_basis in ('nnn', 'gross', 'modified_gross', 'unknown')),
  cam_psf numeric,
  condition text check (condition in ('shell', 'white_box', 'second_gen', 'built_out', 'unknown')),
  prior_tenant text,
  prior_category_id uuid references public.tenant_categories(id),
  vacant_since date,
  placement text check (placement in ('end_cap', 'inline', 'pad', 'freestanding', 'kiosk', 'unknown')),
  frontage_ft numeric,
  ceiling_height_ft numeric,
  venting_possible text not null default 'unknown' check (venting_possible in ('yes', 'no', 'unknown')),
  grease_trap text not null default 'unknown' check (grease_trap in ('yes', 'no', 'unknown')),
  drive_through text not null default 'unknown' check (drive_through in ('yes', 'no', 'possible', 'unknown')),
  patio_possible text not null default 'unknown' check (patio_possible in ('yes', 'no', 'unknown')),
  loading_access text,
  parking_proximity text,
  allowed_uses jsonb,
  restricted_uses jsonb,
  analyst_notes text,
  data_confidence text not null default 'preliminary' check (data_confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  source_id uuid references public.data_sources(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vacancies enable row level security;
create policy "vacancies_staff_select" on public.vacancies
  for select using (public.is_internal_staff());
create policy "vacancies_staff_insert" on public.vacancies
  for insert with check (public.is_internal_staff());
create policy "vacancies_staff_update" on public.vacancies
  for update using (public.is_internal_staff());
create policy "vacancies_staff_delete" on public.vacancies
  for delete using (public.is_internal_staff());

-- ============================================================================
-- 10. Analysis runs
-- ============================================================================

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  depth text not null default 'standard' check (depth in ('teaser', 'standard', 'full')),
  status text not null default 'queued' check (status in ('queued', 'running', 'partial', 'complete', 'failed')),
  methodology_version_id uuid references public.methodology_versions(id),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  total_cost_usd numeric,
  notes text,
  manifest jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_runs enable row level security;
create policy "analysis_runs_staff_select" on public.analysis_runs
  for select using (public.is_internal_staff());
create policy "analysis_runs_staff_insert" on public.analysis_runs
  for insert with check (public.is_internal_staff());
create policy "analysis_runs_staff_update" on public.analysis_runs
  for update using (public.is_internal_staff());

-- ============================================================================
-- 11. Analysis stage results
-- ============================================================================

create table if not exists public.analysis_stage_results (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  stage_name text not null,
  stage_version text not null,
  status text not null default 'ok' check (status in ('ok', 'skipped', 'failed', 'stale')),
  inputs_hash text,
  inputs jsonb,
  outputs jsonb,
  confidence text check (confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  completeness numeric check (completeness >= 0 and completeness <= 1),
  error text,
  duration_ms integer,
  cost_usd numeric,
  cache_hit boolean not null default false,
  superseded_by uuid references public.analysis_stage_results(id),
  created_at timestamptz not null default now(),
  unique (analysis_run_id, stage_name)
);

alter table public.analysis_stage_results enable row level security;
create policy "analysis_stage_results_staff_select" on public.analysis_stage_results
  for select using (public.is_internal_staff());
create policy "analysis_stage_results_staff_insert" on public.analysis_stage_results
  for insert with check (public.is_internal_staff());
create policy "analysis_stage_results_staff_update" on public.analysis_stage_results
  for update using (public.is_internal_staff());

-- ============================================================================
-- 12. Source observations
-- ============================================================================

create table if not exists public.source_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id),
  source_url_or_id text,
  retrieved_at timestamptz not null default now(),
  effective_date date,
  geographic_scope text,
  raw_value jsonb,
  normalized_value jsonb,
  unit text,
  analyst_override jsonb,
  override_by uuid references public.profiles(id),
  override_at timestamptz,
  confidence text check (confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  license_note text,
  subject_type text,
  subject_id uuid,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.source_observations enable row level security;
create policy "source_observations_staff_select" on public.source_observations
  for select using (public.is_internal_staff());
create policy "source_observations_staff_insert" on public.source_observations
  for insert with check (public.is_internal_staff());
create policy "source_observations_staff_update" on public.source_observations
  for update using (public.is_internal_staff());

-- ============================================================================
-- 13. Trade areas
-- ============================================================================

create table if not exists public.trade_areas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  method text not null check (method in ('drive_time', 'walk_time', 'radius', 'custom')),
  params jsonb,
  geometry jsonb,
  source_observation_id uuid references public.source_observations(id),
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.trade_areas enable row level security;
create policy "trade_areas_staff_select" on public.trade_areas
  for select using (public.is_internal_staff());
create policy "trade_areas_staff_insert" on public.trade_areas
  for insert with check (public.is_internal_staff());

-- ============================================================================
-- 14. Business candidates & scoring
-- ============================================================================

create table if not exists public.business_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  category_id uuid not null references public.tenant_categories(id),
  vacancy_id uuid references public.vacancies(id) on delete set null,
  rank integer,
  verdict text not null default 'neutral' check (verdict in ('recommend', 'neutral', 'avoid', 'disqualified')),
  created_at timestamptz not null default now()
);

alter table public.business_candidates enable row level security;
create policy "business_candidates_staff_select" on public.business_candidates
  for select using (public.is_internal_staff());
create policy "business_candidates_staff_insert" on public.business_candidates
  for insert with check (public.is_internal_staff());

create table if not exists public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.business_candidates(id) on delete cascade,
  overall numeric not null check (overall >= 0 and overall <= 100),
  confidence text check (confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  completeness numeric check (completeness >= 0 and completeness <= 1),
  methodology_version_id uuid references public.methodology_versions(id),
  positive_factors jsonb,
  negative_factors jsonb,
  disqualifiers jsonb,
  created_at timestamptz not null default now()
);

alter table public.opportunity_scores enable row level security;
create policy "opportunity_scores_staff_select" on public.opportunity_scores
  for select using (public.is_internal_staff());
create policy "opportunity_scores_staff_insert" on public.opportunity_scores
  for insert with check (public.is_internal_staff());

create table if not exists public.score_components (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.opportunity_scores(id) on delete cascade,
  component_key text not null,
  raw numeric,
  normalized numeric check (normalized >= 0 and normalized <= 100),
  weight numeric,
  inputs jsonb,
  explanation text,
  created_at timestamptz not null default now()
);

alter table public.score_components enable row level security;
create policy "score_components_staff_select" on public.score_components
  for select using (public.is_internal_staff());
create policy "score_components_staff_insert" on public.score_components
  for insert with check (public.is_internal_staff());

-- ============================================================================
-- 15. Comparables & rent analyses
-- ============================================================================

create table if not exists public.comparables (
  id uuid primary key default gen_random_uuid(),
  property_like jsonb,
  sqft integer,
  rent_psf numeric,
  rent_basis text check (rent_basis in ('nnn', 'gross', 'modified_gross', 'unknown')),
  cam_psf numeric,
  ti_allowance_psf numeric,
  free_rent_months integer,
  percentage_rent boolean,
  lease_term_months integer,
  condition text,
  placement text,
  drive_through boolean,
  lease_date date,
  source_observation_id uuid not null references public.source_observations(id),
  is_asking boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.comparables enable row level security;
create policy "comparables_staff_select" on public.comparables
  for select using (public.is_internal_staff());
create policy "comparables_staff_insert" on public.comparables
  for insert with check (public.is_internal_staff());

create table if not exists public.rent_analyses (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  vacancy_id uuid references public.vacancies(id) on delete set null,
  status text not null check (status in ('supported', 'insufficient_data')),
  indicated_low_psf numeric,
  indicated_high_psf numeric,
  basis text,
  assumptions jsonb,
  adjustments jsonb,
  comparable_ids uuid[],
  data_as_of date,
  confidence text check (confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  limitations text,
  disclaimer_version text,
  created_at timestamptz not null default now(),
  -- Range columns non-null only when status = 'supported'
  check (
    (status = 'supported' and indicated_low_psf is not null and indicated_high_psf is not null)
    or (status = 'insufficient_data' and indicated_low_psf is null and indicated_high_psf is null)
  )
);

alter table public.rent_analyses enable row level security;
create policy "rent_analyses_staff_select" on public.rent_analyses
  for select using (public.is_internal_staff());
create policy "rent_analyses_staff_insert" on public.rent_analyses
  for insert with check (public.is_internal_staff());

-- ============================================================================
-- 16. Reports
-- ============================================================================

create table if not exists public.report_projects (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id),
  kind text not null default 'full' check (kind in ('full', 'teaser')),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'final', 'archived')),
  title text,
  branding jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_projects enable row level security;
create policy "report_projects_staff_select" on public.report_projects
  for select using (public.is_internal_staff());
create policy "report_projects_staff_insert" on public.report_projects
  for insert with check (public.is_internal_staff());
create policy "report_projects_staff_update" on public.report_projects
  for update using (public.is_internal_staff());

create table if not exists public.report_sections (
  id uuid primary key default gen_random_uuid(),
  report_project_id uuid not null references public.report_projects(id) on delete cascade,
  section_key text not null,
  position integer not null,
  payload jsonb,
  narrative jsonb,
  review_status text not null default 'pending' check (review_status in ('pending', 'edited', 'accepted', 'rejected')),
  locked boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_sections enable row level security;
create policy "report_sections_staff_select" on public.report_sections
  for select using (public.is_internal_staff());
create policy "report_sections_staff_insert" on public.report_sections
  for insert with check (public.is_internal_staff());
create policy "report_sections_staff_update" on public.report_sections
  for update using (public.is_internal_staff());

create table if not exists public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_project_id uuid not null references public.report_projects(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  pdf_file_id uuid references public.files(id),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz not null default now(),
  methodology_version_id uuid references public.methodology_versions(id),
  created_at timestamptz not null default now(),
  unique (report_project_id, version)
);

alter table public.report_versions enable row level security;
create policy "report_versions_staff_select" on public.report_versions
  for select using (public.is_internal_staff());
-- Insert via service role only (finalization action)

create table if not exists public.report_assets (
  id uuid primary key default gen_random_uuid(),
  report_project_id uuid not null references public.report_projects(id) on delete cascade,
  file_id uuid not null references public.files(id),
  asset_key text not null,
  spec jsonb,
  spec_hash text,
  created_at timestamptz not null default now()
);

alter table public.report_assets enable row level security;
create policy "report_assets_staff_select" on public.report_assets
  for select using (public.is_internal_staff());
create policy "report_assets_staff_insert" on public.report_assets
  for insert with check (public.is_internal_staff());

-- ============================================================================
-- 17. Operations
-- ============================================================================

create table if not exists public.cost_events (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  service text not null,
  operation text not null,
  units jsonb,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cost_events enable row level security;
create policy "cost_events_staff_select" on public.cost_events
  for select using (public.is_internal_staff());
-- Insert via service role only

create table if not exists public.analyst_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  body text not null,
  author_id uuid not null references public.profiles(id),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analyst_notes enable row level security;
create policy "analyst_notes_staff_select" on public.analyst_notes
  for select using (public.is_internal_staff());
create policy "analyst_notes_staff_insert" on public.analyst_notes
  for insert with check (public.is_internal_staff());
create policy "analyst_notes_staff_update" on public.analyst_notes
  for update using (public.is_internal_staff());

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  subject_type text,
  subject_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Audit logs: append-only, staff-readable, no update/delete policies
alter table public.audit_logs enable row level security;
create policy "audit_logs_staff_select" on public.audit_logs
  for select using (public.is_internal_staff());
-- Insert via service role only

-- ============================================================================
-- 18. Prospecting (minimal for Phase 2 schema; full UI in Phase 9)
-- ============================================================================

create table if not exists public.outreach_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'identified' check (status in (
    'identified', 'researching', 'report_prepared', 'contacted',
    'follow_up_due', 'meeting_scheduled', 'proposal_sent',
    'won', 'lost', 'do_not_contact'
  )),
  follow_up_on date,
  history jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outreach_records enable row level security;
create policy "outreach_records_staff_select" on public.outreach_records
  for select using (public.is_internal_staff());
create policy "outreach_records_staff_insert" on public.outreach_records
  for insert with check (public.is_internal_staff());
create policy "outreach_records_staff_update" on public.outreach_records
  for update using (public.is_internal_staff());

-- ============================================================================
-- 19. Public inquiries
-- ============================================================================

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_email text not null,
  organization text,
  role text,
  property_address text,
  property_type text,
  vacancy_count integer,
  primary_question text,
  upload_file_id uuid references public.files(id),
  consented boolean not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'converted', 'dismissed')),
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Inquiries: staff can read; inserts via service role (public API endpoint)
alter table public.inquiries enable row level security;
create policy "inquiries_staff_select" on public.inquiries
  for select using (public.is_internal_staff());

-- ============================================================================
-- 20. Follow-ups, outcomes, lessons (Phase 7 schema, created now for FK stability)
-- ============================================================================

create table if not exists public.customer_responses (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid references public.report_versions(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  response_type text not null check (response_type in ('question', 'objection', 'revision_request', 'positive', 'negative', 'neutral')),
  content text not null,
  received_at timestamptz not null default now(),
  responded_at timestamptz,
  response_notes text,
  created_at timestamptz not null default now()
);

alter table public.customer_responses enable row level security;
create policy "customer_responses_staff_select" on public.customer_responses
  for select using (public.is_internal_staff());
create policy "customer_responses_staff_insert" on public.customer_responses
  for insert with check (public.is_internal_staff());
create policy "customer_responses_staff_update" on public.customer_responses
  for update using (public.is_internal_staff());

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  report_version_id uuid references public.report_versions(id) on delete set null,
  milestone_months integer not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped', 'overdue')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.follow_ups enable row level security;
create policy "follow_ups_staff_select" on public.follow_ups
  for select using (public.is_internal_staff());
create policy "follow_ups_staff_insert" on public.follow_ups
  for insert with check (public.is_internal_staff());
create policy "follow_ups_staff_update" on public.follow_ups
  for update using (public.is_internal_staff());

create table if not exists public.observed_outcomes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  vacancy_id uuid references public.vacancies(id) on delete set null,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  outcome_type text not null check (outcome_type in (
    'vacancy_filled', 'vacancy_still_open', 'tenant_closed',
    'new_tenant_opened', 'property_sold', 'other'
  )),
  new_tenant_name text,
  new_tenant_category_id uuid references public.tenant_categories(id),
  recommendation_rank_match integer,
  observed_at date,
  opening_date date,
  closure_date date,
  provenance text,
  confidence text check (confidence in ('high', 'moderate', 'preliminary', 'insufficient')),
  source_observation_id uuid references public.source_observations(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.observed_outcomes enable row level security;
create policy "observed_outcomes_staff_select" on public.observed_outcomes
  for select using (public.is_internal_staff());
create policy "observed_outcomes_staff_insert" on public.observed_outcomes
  for insert with check (public.is_internal_staff());

create table if not exists public.lessons_learned (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  report_version_id uuid references public.report_versions(id) on delete set null,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  customer_response_id uuid references public.customer_responses(id) on delete set null,
  observed_outcome_id uuid references public.observed_outcomes(id) on delete set null,
  methodology_change_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons_learned enable row level security;
create policy "lessons_learned_staff_select" on public.lessons_learned
  for select using (public.is_internal_staff());
create policy "lessons_learned_staff_insert" on public.lessons_learned
  for insert with check (public.is_internal_staff());
create policy "lessons_learned_staff_update" on public.lessons_learned
  for update using (public.is_internal_staff());

-- ============================================================================
-- Record migration
-- ============================================================================

insert into public.schema_migrations (version)
  values ('0002_core_data_model')
  on conflict (version) do nothing;
