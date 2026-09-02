-- Historical ordering note:
-- this July 2025 migration is a premature duplicate of
-- 20260711020000_contribution_source_adapters_bootstrap.sql.
-- The adapter functions depend on public.band_contribution_events, public.bands,
-- public.band_members, recording_sessions, production_tracks and profiles.
-- Those dependencies are created later in the migration history, with
-- band_contribution_events created immediately beforehand by
-- 20260711010000_create_band_contribution_events.sql.
--
-- Intentionally leave this migration as a no-op so the byte-for-byte canonical
-- July 2026 bootstrap migration owns the contribution adapter schema.

DO $$
BEGIN
  RAISE NOTICE 'Deferred duplicate contribution adapters to canonical 20260711020000 migration';
END
$$;
