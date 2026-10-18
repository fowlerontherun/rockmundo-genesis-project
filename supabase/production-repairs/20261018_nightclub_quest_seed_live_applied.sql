-- Live production repair performed directly on 2026-10-18.
-- The complete idempotent SQL is now embedded in historical seed migration:
-- supabase/migrations/20260411072341_6fa7fb05-85f9-4aa1-b843-7b632d051981.sql
-- Runtime source copied from the original 25 quest rows, mapped NPC IDs
-- to existing club names (25/25 matches). It inserted 25 quests without
-- touching any player quest progress. Replaying the migration is idempotent.
-- Read-only live verification:
SELECT count(*) AS live_quests FROM public.nightclub_quests;
SELECT count(*) AS orphan_quests FROM public.nightclub_quests q
 LEFT JOIN public.city_night_clubs c ON c.id=q.club_id WHERE c.id IS NULL;
