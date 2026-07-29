-- This migration originally attempted to create profile activity, jam-session and
-- busking tables before the repository's timestamped base schema had created
-- public.profiles, public.songs and public.activity_feed.
--
-- The definitions are intentionally deferred to migrations that run after their
-- dependencies:
--   * public.jam_sessions: 20250916153000_create_jam_sessions_table.sql
--   * public.profile_activity_statuses: 20251006052802_4b82ad0e-e2a8-49b5-a82f-9cca1bc0d525.sql
--   * busking tables: the dedicated 2026 busking migrations
--
-- Keeping this migration as an explicit no-op preserves migration history while
-- allowing fresh databases to reach the base schema in the correct order.

DO $$
BEGIN
  RAISE NOTICE 'Deferred pre-base activity and busking schema to dependency-safe migrations';
END
$$;