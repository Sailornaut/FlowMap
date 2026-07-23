-- 0001 (up): internal-access roles on profiles.
-- Part of the internal-tool pivot (docs/MIGRATION_PLAN.md, Phase 1).
-- Additive and reversible. Apply alongside disabling public sign-ups in the
-- Supabase dashboard (Auth -> Providers -> Email -> disable sign-ups).
--
-- Semantics: role IS NULL  => no internal access (server returns 403).
--            role='admin'  => full access incl. settings/invitations.
--            role='analyst'=> workspace access.

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text
    check (role in ('admin', 'analyst')),
  add column if not exists invited_by uuid references public.profiles(id),
  add column if not exists invited_at timestamptz;

comment on column public.profiles.role is
  'Internal access role. NULL = no access to the internal workspace.';

-- Seed the owner as admin. Replace the email if the operator account differs.
update public.profiles
  set role = 'admin'
  where email = 'davidshoemaker@gameplan.tech'
    and role is null;

insert into public.schema_migrations (version)
  values ('0001_add_profile_roles')
  on conflict (version) do nothing;
