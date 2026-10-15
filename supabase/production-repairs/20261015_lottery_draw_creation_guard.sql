-- Follow-up for issue #4072 / PR #4130.
-- Keep the UI's "create current draw if none exists" fallback, but prevent
-- an authenticated player from publishing a future/past week, selected
-- winning numbers, a pre-drawn record, or a custom inflated jackpot.
-- The trusted cron function is service-only and bypasses this user RLS.
DO $preflight$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='lottery_draws'
     AND policyname='Authenticated users can create lottery draws' AND cmd='INSERT'
 ) THEN
   RAISE EXCEPTION 'Unexpected lottery draw insertion policy: stop cutover';
 END IF;
 IF (SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='lottery_draws'
       AND column_name='jackpot_amount') IS DISTINCT FROM '1000000' THEN
   RAISE EXCEPTION 'Unexpected jackpot default: stop cutover';
 END IF;
END
$preflight$;
REVOKE INSERT ON public.lottery_draws FROM PUBLIC,anon;
GRANT INSERT ON public.lottery_draws TO authenticated;
ALTER POLICY "Authenticated users can create lottery draws"
  ON public.lottery_draws TO authenticated
  WITH CHECK (
    status='pending'
    AND week_start=date_trunc('week',now() AT TIME ZONE 'UTC')::date
    AND jackpot_amount=1000000
    AND draw_date IS NULL AND winning_numbers IS NULL AND bonus_number IS NULL
  );
NOTIFY pgrst,'reload schema';
