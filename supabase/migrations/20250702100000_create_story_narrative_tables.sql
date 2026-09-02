-- Historical ordering note:
-- this July 2025 migration predates the base schema that creates public.profiles.
-- The canonical story_states/story_choices schema is created later by
-- 20260308145318_c0dbd6df-ba8d-4a77-9cd3-45a3f5dcb113.sql and matches the
-- live production schema. Keeping a second definition here breaks clean
-- rebuilds and would create schema drift if it were allowed to run first.
--
-- Intentionally leave this migration as a no-op so the canonical later
-- migration owns the narrative tables and their RLS policies.

DO $$
BEGIN
  RAISE NOTICE 'Deferred superseded story narrative schema to canonical 20260308145318 migration';
END
$$;
