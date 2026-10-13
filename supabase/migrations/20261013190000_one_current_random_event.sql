-- Prevent concurrent random-event workers from creating multiple current events
-- for one account. Pre-2026-10-09 quarantined outcomes are excluded.
-- Historical conflicting current events must be reconciled before deployment.
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.player_events
   WHERE user_id IS NOT NULL
     AND created_at >= TIMESTAMPTZ '2026-10-09 00:00:00+00'
     AND status IN ('pending_choice','awaiting_outcome')
   GROUP BY user_id HAVING count(*) > 1
 ) THEN
   RAISE EXCEPTION 'Duplicate active current events require reconciliation before guard installation';
 END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS player_events_one_current_event_per_account
 ON public.player_events(user_id)
 WHERE user_id IS NOT NULL
   AND created_at >= TIMESTAMPTZ '2026-10-09 00:00:00+00'
   AND status IN ('pending_choice','awaiting_outcome');
