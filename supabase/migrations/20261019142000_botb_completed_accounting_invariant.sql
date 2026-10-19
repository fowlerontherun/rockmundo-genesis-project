-- Database-level accounting invariant for completed Battle of the Bands.
-- Requiring an actual recorded attendance avoids rewriting the seven legacy
-- results (which predate event finance columns).
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.botb_events e
    WHERE e.status='completed' AND e.attendance>0
      AND (
        e.ticket_revenue+e.sponsorship_revenue <
          e.prize_money::bigint+e.production_cost
        OR e.city_profit <>
          e.ticket_revenue+e.sponsorship_revenue-
          e.prize_money::bigint-e.production_cost
      )
  ) THEN
    RAISE EXCEPTION 'BOTB_COMPLETED_ECONOMY_DRIFT_REQUIRES_REVIEW';
  END IF;
END;
$preflight$;

ALTER TABLE public.botb_events
  ADD CONSTRAINT botb_completed_balanced_accounting
  CHECK (
    status <> 'completed'
    OR attendance = 0
    OR (
      ticket_revenue+sponsorship_revenue >=
        prize_money::bigint+production_cost
      AND city_profit =
        ticket_revenue+sponsorship_revenue-
        prize_money::bigint-production_cost
    )
  );
