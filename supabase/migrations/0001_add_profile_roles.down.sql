-- 0001 (down): remove internal-access roles from profiles.
-- Reverses 0001_add_profile_roles.up.sql. No data outside these columns is touched.

alter table public.profiles
  drop column if exists role,
  drop column if exists invited_by,
  drop column if exists invited_at;

delete from public.schema_migrations
  where version = '0001_add_profile_roles';
