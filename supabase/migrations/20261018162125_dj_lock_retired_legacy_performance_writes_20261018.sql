-- Applied directly to production Supabase as 20261018162125.
-- Legacy browser DJ payouts have been removed; players must not forge history.
-- Historical rows are preserved, and server-owned booked-set writes continue.
ALTER TABLE public.player_dj_performances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own DJ performances"
  ON public.player_dj_performances;
REVOKE INSERT, UPDATE, DELETE
  ON public.player_dj_performances FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.player_dj_performances IS
  'Read-only player DJ history: legacy instant grants retired; new records only from trusted DJ booked-set settlement. Existing history remains readable.';
