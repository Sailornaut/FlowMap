-- Migration 0004: Seed data_sources for live pipeline integrations.
-- Additive: inserts only if no row with that name exists.
-- These are the providers used by pipeline stages 2–5.

insert into public.data_sources (name, kind, base_url, license_note, reliability_tier)
select 'mapbox_geocoding', 'api', 'https://api.mapbox.com/search/geocode/v6', 'Mapbox ToS — attribution required', 2
where not exists (select 1 from public.data_sources where name = 'mapbox_geocoding');

insert into public.data_sources (name, kind, base_url, license_note, reliability_tier)
select 'mapbox_isochrone', 'api', 'https://api.mapbox.com/isochrone/v1', 'Mapbox ToS — attribution required', 2
where not exists (select 1 from public.data_sources where name = 'mapbox_isochrone');

insert into public.data_sources (name, kind, base_url, license_note, reliability_tier)
select 'census_geocoder', 'api', 'https://geocoding.geo.census.gov/geocoder', 'Public domain (U.S. Census Bureau)', 1
where not exists (select 1 from public.data_sources where name = 'census_geocoder');

insert into public.data_sources (name, kind, base_url, license_note, reliability_tier)
select 'census_acs_5yr', 'api', 'https://api.census.gov/data', 'Public domain (U.S. Census Bureau)', 1
where not exists (select 1 from public.data_sources where name = 'census_acs_5yr');

insert into public.data_sources (name, kind, base_url, license_note, reliability_tier)
select 'osm_overpass', 'api', 'https://overpass-api.de/api/interpreter', 'ODbL (OpenStreetMap contributors)', 3
where not exists (select 1 from public.data_sources where name = 'osm_overpass');

-- Record this migration
insert into public.schema_migrations (version, applied_at)
values ('0004', now())
on conflict (version) do nothing;
