-- Rollback migration 0003: drop analysis_manifests table, triggers, RPC, and grants.
-- The analysis_runs.manifest JSONB column is preserved (it was never dropped).

-- 1. Drop RPC function (also removes the REVOKE on it)
drop function if exists public.create_analysis_run_with_manifest(uuid, uuid, text, uuid, text);

-- 2. Drop triggers
drop trigger if exists trg_analysis_manifests_no_update on public.analysis_manifests;
drop trigger if exists trg_analysis_manifests_no_delete on public.analysis_manifests;

-- 3. Drop trigger functions
drop function if exists public.reject_manifest_update();
drop function if exists public.reject_manifest_delete();

-- 4. Drop indexes
drop index if exists public.idx_analysis_manifests_run_version;
drop index if exists public.idx_analysis_manifests_run_id;

-- 5. Drop policies
drop policy if exists "analysis_manifests_staff_select" on public.analysis_manifests;

-- 6. Drop table (cascades RLS, grants)
drop table if exists public.analysis_manifests;

-- 7. Remove migration record
delete from public.schema_migrations where version = '0003';
