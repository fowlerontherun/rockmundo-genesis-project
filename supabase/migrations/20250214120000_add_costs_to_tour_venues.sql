-- This migration sorts before public.tour_venues is created by the September
-- 2025 MMO schema migration. Keep the historical version as an explicit no-op
-- and add the columns in the dependency-safe compatibility migration
-- 20291218242900_complete_tour_venue_cost_fields.sql.

DO $$
BEGIN
  RAISE NOTICE 'Deferred tour venue cost fields until public.tour_venues exists';
END
$$;