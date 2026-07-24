-- Rollback 0004: Remove seeded data sources.
-- Only deletes sources that have no observations referencing them.

delete from public.data_sources
where name in ('mapbox_geocoding', 'mapbox_isochrone', 'census_geocoder', 'census_acs_5yr', 'osm_overpass')
  and id not in (select source_id from public.source_observations);

delete from public.schema_migrations where version = '0004';
