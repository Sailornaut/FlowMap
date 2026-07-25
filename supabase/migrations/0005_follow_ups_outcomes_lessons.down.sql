-- 0005 (down): Drop follow-ups, outcomes, and lessons tables.
-- Reverse order of creation to respect FK dependencies.

drop table if exists public.lesson_references;
drop table if exists public.lessons_learned;
drop table if exists public.observed_outcomes;
drop table if exists public.follow_ups;

delete from public.schema_migrations where version = '0005';
