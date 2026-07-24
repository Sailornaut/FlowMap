-- 0002 (down): Drop all Phase 2 tables in reverse dependency order.
-- Does NOT touch legacy tables (profiles, subscriptions, usage_events, saved_locations).

drop table if exists public.lessons_learned cascade;
drop table if exists public.observed_outcomes cascade;
drop table if exists public.follow_ups cascade;
drop table if exists public.customer_responses cascade;
drop table if exists public.inquiries cascade;
drop table if exists public.outreach_records cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.analyst_notes cascade;
drop table if exists public.cost_events cascade;
drop table if exists public.report_assets cascade;
drop table if exists public.report_versions cascade;
drop table if exists public.report_sections cascade;
drop table if exists public.report_projects cascade;
drop table if exists public.rent_analyses cascade;
drop table if exists public.comparables cascade;
drop table if exists public.score_components cascade;
drop table if exists public.opportunity_scores cascade;
drop table if exists public.business_candidates cascade;
drop table if exists public.trade_areas cascade;
drop table if exists public.source_observations cascade;
drop table if exists public.analysis_stage_results cascade;
drop table if exists public.analysis_runs cascade;
drop table if exists public.vacancies cascade;
drop table if exists public.tenants cascade;
drop table if exists public.category_profiles cascade;
drop table if exists public.tenant_categories cascade;
drop table if exists public.methodology_versions cascade;
drop table if exists public.files cascade;
drop table if exists public.contacts cascade;
drop table if exists public.properties cascade;
drop table if exists public.organizations cascade;
drop table if exists public.data_sources cascade;

drop function if exists public.is_internal_staff();

delete from public.schema_migrations where version = '0002_core_data_model';
