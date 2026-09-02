-- Historical ordering note:
-- this July 2025 migration predates the base schema that creates public.bands
-- and public.band_members.
-- The canonical band_membership_roles/band_membership_status_history schema is
-- created later by 20260717045808_342626c8-6dae-42fb-b952-5cddcb44840e.sql and
-- matches the live production schema, including grants and RLS policies.
--
-- Intentionally leave this migration as a no-op so the later dependency-safe
-- migration owns the band membership management tables.

DO $$
BEGIN
  RAISE NOTICE 'Deferred superseded band membership schema to canonical 20260717045808 migration';
END
$$;
