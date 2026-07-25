-- Migration 0003: analysis_manifests — immutable, versioned provenance snapshots
--
-- Problem: the current design stores a mutable JSONB `manifest` column on
-- `analysis_runs`. This violates three governing architecture requirements:
--
--   1. Immutability — any UPDATE on analysis_runs can overwrite the manifest.
--      Criterion 7.3 requires finalized manifests to be immutable.
--   2. Versioning — re-executions overwrite in place with no history.
--      Criterion 7.4 requires corrections to produce new versions.
--   3. DATA_MODEL.md convention — JSONB only for stage outputs and flexible
--      metadata, not for core provenance data that should be explicit columns.
--
-- Solution: a dedicated `analysis_manifests` table with:
--   - Triggers that reject UPDATE and DELETE (enforced regardless of role,
--     including service-role which bypasses RLS)
--   - SELECT-only RLS for authenticated/anon; INSERT via service role only
--   - Explicit REVOKE of UPDATE/DELETE from anon and authenticated roles
--   - Versioned per run (version integer, unique per run)
--   - Explicit columns for searchable provenance fields
--   - JSONB only for the stage plan (flexible, version-specific)
--   - An RPC function for atomic run+manifest creation
--
-- `analysis_runs.manifest` is deprecated. New code treats it as a non-
-- authoritative cache that may be stale. `analysis_manifests` is the single
-- authoritative source of manifest data.

-- ============================================================================
-- 1. Create analysis_manifests table
-- ============================================================================

create table if not exists public.analysis_manifests (
  id uuid primary key default gen_random_uuid(),

  -- Link to the analysis run this manifest belongs to
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,

  -- Monotonically increasing version per run (1 = initial, 2+ = re-executions)
  version integer not null default 1,

  -- Explicit provenance columns (not buried in JSONB)
  methodology_version_id uuid references public.methodology_versions(id),
  depth text not null check (depth in ('teaser', 'standard', 'full')),
  requested_by uuid references public.profiles(id),

  -- Stage plan: which stages were planned, their versions, and order
  stages_planned jsonb not null default '[]'::jsonb,

  -- Snapshot of stage outcomes at the time this manifest was finalized
  stages_completed jsonb not null default '[]'::jsonb,

  -- Data sources that were used during this execution
  data_sources_used jsonb not null default '[]'::jsonb,

  -- Pipeline runner version that created this manifest
  runner_version text,

  -- Cost snapshot at manifest creation time
  total_cost_usd numeric,

  -- Overall confidence at the time of manifest creation
  overall_confidence text check (overall_confidence in ('high', 'moderate', 'preliminary', 'insufficient')),

  -- Who/what created this manifest (service role for pipeline, user for manual)
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  -- Immutability: no updated_at column. Once created, a manifest never changes.
  -- To correct, create a new version.

  -- Unique constraint: one version number per run
  unique (analysis_run_id, version)
);

-- ============================================================================
-- 2. Immutability triggers — enforced regardless of role (including service-role)
-- ============================================================================

-- Reject any UPDATE on analysis_manifests
create or replace function public.reject_manifest_update()
returns trigger as $$
begin
  raise exception 'analysis_manifests rows are immutable — updates are not permitted. '
    'To correct a manifest, insert a new version for the same analysis_run_id.';
end;
$$ language plpgsql;

drop trigger if exists trg_analysis_manifests_no_update on public.analysis_manifests;
create trigger trg_analysis_manifests_no_update
  before update on public.analysis_manifests
  for each row execute function public.reject_manifest_update();

-- Reject any DELETE on analysis_manifests
create or replace function public.reject_manifest_delete()
returns trigger as $$
begin
  raise exception 'analysis_manifests rows are immutable — deletes are not permitted. '
    'Historical manifests must be preserved for audit and compliance.';
end;
$$ language plpgsql;

drop trigger if exists trg_analysis_manifests_no_delete on public.analysis_manifests;
create trigger trg_analysis_manifests_no_delete
  before delete on public.analysis_manifests
  for each row execute function public.reject_manifest_delete();

-- ============================================================================
-- 3. RLS: SELECT only for authenticated roles
-- ============================================================================

alter table public.analysis_manifests enable row level security;

-- Staff can read manifests
drop policy if exists "analysis_manifests_staff_select" on public.analysis_manifests;
create policy "analysis_manifests_staff_select" on public.analysis_manifests
  for select using (public.is_internal_staff());

-- No INSERT/UPDATE/DELETE policies. INSERT happens via service role (bypasses RLS).
-- UPDATE and DELETE are blocked by triggers regardless of role.

-- ============================================================================
-- 4. Grants: explicitly revoke mutation privileges from non-service roles
-- ============================================================================

-- Supabase grants broad privileges to anon and authenticated by default on the
-- public schema. Explicitly revoke INSERT/UPDATE/DELETE so that even if RLS is
-- misconfigured, these roles cannot mutate manifests.
revoke insert, update, delete on public.analysis_manifests from anon;
revoke insert, update, delete on public.analysis_manifests from authenticated;

-- Ensure anon and authenticated can still SELECT (needed for RLS-gated reads).
grant select on public.analysis_manifests to anon;
grant select on public.analysis_manifests to authenticated;

-- ============================================================================
-- 5. RPC: atomic run + manifest creation
-- ============================================================================

-- Creates an analysis run and its initial manifest (version 1) in a single
-- transaction. If either insert fails, neither is committed.
create or replace function public.create_analysis_run_with_manifest(
  p_property_id uuid,
  p_requested_by uuid,
  p_depth text default 'standard',
  p_methodology_version_id uuid default null,
  p_notes text default null
)
returns jsonb as $$
declare
  v_run_id uuid;
  v_manifest_id uuid;
  v_run jsonb;
begin
  -- Validate depth
  if p_depth not in ('teaser', 'standard', 'full') then
    raise exception 'Invalid depth: %. Must be teaser, standard, or full.', p_depth;
  end if;

  -- Verify property exists
  if not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'Property % not found.', p_property_id;
  end if;

  -- Insert analysis run
  insert into public.analysis_runs (
    property_id, requested_by, depth, status,
    methodology_version_id, notes
  ) values (
    p_property_id, p_requested_by, p_depth, 'queued',
    p_methodology_version_id, p_notes
  ) returning id into v_run_id;

  -- Insert initial manifest (version 1) — same transaction
  insert into public.analysis_manifests (
    analysis_run_id, version, methodology_version_id,
    depth, requested_by, created_by
  ) values (
    v_run_id, 1, p_methodology_version_id,
    p_depth, p_requested_by, p_requested_by
  ) returning id into v_manifest_id;

  -- Return the run with manifest reference
  select to_jsonb(r) || jsonb_build_object('manifest_id', v_manifest_id, 'manifest_version', 1)
  into v_run
  from public.analysis_runs r
  where r.id = v_run_id;

  return v_run;
end;
$$ language plpgsql security definer;

-- Only service role should call this RPC; revoke from public-facing roles.
revoke execute on function public.create_analysis_run_with_manifest from anon;
revoke execute on function public.create_analysis_run_with_manifest from authenticated;

-- ============================================================================
-- 6. Index for common query patterns
-- ============================================================================

create index if not exists idx_analysis_manifests_run_id
  on public.analysis_manifests (analysis_run_id);

create index if not exists idx_analysis_manifests_run_version
  on public.analysis_manifests (analysis_run_id, version desc);

-- ============================================================================
-- 7. Record migration
-- ============================================================================

insert into public.schema_migrations (version, description)
values ('0003', 'Add analysis_manifests table with immutability triggers, grants, and atomic creation RPC')
on conflict (version) do nothing;
