-- Historical duplicate leaderboard prototype.
--
-- The authoritative leaderboard season, snapshot, badge and badge-award schema
-- is created by the consolidated 20250917090000 migration. That schema also
-- owns the public read policies, indexes and updated-at triggers.
--
-- This later prototype used an incompatible `is_active` model and attempted to
-- recreate the same tables. It is intentionally retained as a no-op migration
-- marker so deployed migration history is preserved without creating a second
-- leaderboard contract.

DO $$
BEGIN
  RAISE NOTICE 'Skipping duplicate leaderboard prototype; canonical schema already exists';
END
$$;
