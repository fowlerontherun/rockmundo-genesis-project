-- Secondary financial idempotency guard. Settlement already locks an event
-- and never pays it twice, but the earnings table must also reject any
-- duplicate Battle of the Bands prize for the same event ID.
--
-- The preflight makes legacy data issues explicit rather than choosing which
-- payment to keep automatically (which would alter player balances).
DO $verify_botb_earnings$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.band_earnings e
    WHERE e.source='battle_of_the_bands'
      AND e.metadata ? 'event_id'
      AND e.metadata->>'event_id' IS NOT NULL
    GROUP BY e.metadata->>'event_id'
    HAVING COUNT(*)>1
  ) THEN
    RAISE EXCEPTION 'BOTB_DUPLICATE_HISTORICAL_EARNINGS: manual review required';
  END IF;
END;
$verify_botb_earnings$;

CREATE UNIQUE INDEX IF NOT EXISTS botb_one_prize_per_event
  ON public.band_earnings ((metadata->>'event_id'))
  WHERE source='battle_of_the_bands'
    AND metadata ? 'event_id'
    AND metadata->>'event_id' IS NOT NULL;
