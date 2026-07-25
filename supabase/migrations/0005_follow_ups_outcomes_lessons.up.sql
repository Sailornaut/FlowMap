-- 0005 (up): Follow-ups, observed outcomes, and lessons learned.
-- Part of governing Phase 7 — Follow-up, outcomes, and learning.
-- All tables are additive; down migration is plain drops.
-- Every table gets RLS: staff-only.

-- ============================================================================
-- 1. Follow-ups
-- ============================================================================

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  vacancy_id uuid references public.vacancies(id) on delete set null,
  milestone text not null check (milestone in (
    '3_month', '6_month', '12_month', '24_month', 'custom'
  )),
  due_date date not null,
  status text not null default 'pending' check (status in (
    'pending', 'completed', 'skipped', 'overdue'
  )),
  title text not null,
  notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_follow_ups_property on public.follow_ups(property_id);
create index idx_follow_ups_analysis on public.follow_ups(analysis_run_id);
create index idx_follow_ups_status on public.follow_ups(status);
create index idx_follow_ups_due_date on public.follow_ups(due_date);

alter table public.follow_ups enable row level security;
create policy "follow_ups_staff_select" on public.follow_ups
  for select using (public.is_internal_staff());
create policy "follow_ups_staff_insert" on public.follow_ups
  for insert with check (public.is_internal_staff());
create policy "follow_ups_staff_update" on public.follow_ups
  for update using (public.is_internal_staff());

-- ============================================================================
-- 2. Observed outcomes
-- ============================================================================

create table if not exists public.observed_outcomes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  vacancy_id uuid references public.vacancies(id) on delete set null,
  follow_up_id uuid references public.follow_ups(id) on delete set null,
  outcome_type text not null check (outcome_type in (
    'lease_signed', 'tenant_opened', 'vacancy_persisted',
    'property_sold', 'renovation', 'other'
  )),
  tenant_name text,
  tenant_category_id uuid references public.tenant_categories(id) on delete set null,
  actual_rent_psf numeric,
  rent_basis text check (rent_basis is null or rent_basis in (
    'nnn', 'gross', 'modified_gross', 'unknown'
  )),
  lease_date date,
  prediction_accuracy text check (prediction_accuracy is null or prediction_accuracy in (
    'correct', 'partially_correct', 'incorrect', 'not_applicable'
  )),
  our_recommendation_rank int,
  evidence_type text not null default 'observation' check (evidence_type in (
    'observation', 'assumption'
  )),
  source_observation_id uuid references public.source_observations(id) on delete set null,
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_outcomes_property on public.observed_outcomes(property_id);
create index idx_outcomes_analysis on public.observed_outcomes(analysis_run_id);
create index idx_outcomes_vacancy on public.observed_outcomes(vacancy_id);
create index idx_outcomes_follow_up on public.observed_outcomes(follow_up_id);

alter table public.observed_outcomes enable row level security;
create policy "outcomes_staff_select" on public.observed_outcomes
  for select using (public.is_internal_staff());
create policy "outcomes_staff_insert" on public.observed_outcomes
  for insert with check (public.is_internal_staff());
create policy "outcomes_staff_update" on public.observed_outcomes
  for update using (public.is_internal_staff());

-- ============================================================================
-- 3. Lessons learned
-- ============================================================================

create table if not exists public.lessons_learned (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  lesson_type text not null check (lesson_type in (
    'methodology', 'data_quality', 'market_insight', 'process', 'other'
  )),
  severity text not null default 'minor' check (severity in (
    'critical', 'important', 'minor'
  )),
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons_learned enable row level security;
create policy "lessons_staff_select" on public.lessons_learned
  for select using (public.is_internal_staff());
create policy "lessons_staff_insert" on public.lessons_learned
  for insert with check (public.is_internal_staff());
create policy "lessons_staff_update" on public.lessons_learned
  for update using (public.is_internal_staff());

-- ============================================================================
-- 4. Lesson references (junction: lessons ↔ any entity)
-- ============================================================================

create table if not exists public.lesson_references (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons_learned(id) on delete cascade,
  subject_type text not null check (subject_type in (
    'analysis_run', 'report_project', 'property', 'vacancy',
    'observed_outcome', 'follow_up'
  )),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  unique (lesson_id, subject_type, subject_id)
);

create index idx_lesson_refs_lesson on public.lesson_references(lesson_id);
create index idx_lesson_refs_subject on public.lesson_references(subject_type, subject_id);

alter table public.lesson_references enable row level security;
create policy "lesson_refs_staff_select" on public.lesson_references
  for select using (public.is_internal_staff());
create policy "lesson_refs_staff_insert" on public.lesson_references
  for insert with check (public.is_internal_staff());
create policy "lesson_refs_staff_update" on public.lesson_references
  for update using (public.is_internal_staff());
create policy "lesson_refs_staff_delete" on public.lesson_references
  for delete using (public.is_internal_staff());

-- ============================================================================
-- Record migration
-- ============================================================================

insert into public.schema_migrations (version, applied_at)
values ('0005', now())
on conflict (version) do nothing;
