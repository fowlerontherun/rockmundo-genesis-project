-- Restore progressive gig ticket sales and make attendance percentages authoritative.
-- This migration was first applied to production on 2026-08-22 so existing booked
-- gigs could be repaired immediately; the repository keeps the exact live version.

CREATE OR REPLACE FUNCTION public.set_predicted_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity integer;
BEGIN
  SELECT capacity
  INTO v_capacity
  FROM public.venues
  WHERE id = NEW.venue_id;

  -- Atomic booking already supplies its authoritative final attendance estimate.
  -- Preserve that value instead of overwriting it with the older distance-based helper.
  IF COALESCE(NEW.predicted_tickets, 0) <= 0 THEN
    NEW.predicted_tickets := public.calculate_predicted_tickets(
      NEW.band_id,
      COALESCE(v_capacity, 100),
      NEW.scheduled_date
    );
  END IF;

  NEW.predicted_tickets := LEAST(
    GREATEST(COALESCE(v_capacity, NEW.predicted_tickets, 1), 1),
    GREATEST(COALESCE(NEW.predicted_tickets, 0), COALESCE(NEW.tickets_sold, 0), 0)
  );

  IF NEW.tickets_sold IS NULL THEN
    NEW.tickets_sold := 0;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_predicted_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_predicted_tickets() TO authenticated, service_role;

-- Repair currently scheduled atomic bookings whose explicit estimate was
-- overwritten by trigger_set_predicted_tickets at insert time.
UPDATE public.gigs g
SET predicted_tickets = LEAST(
      GREATEST(COALESCE(v.capacity, 1), 1),
      GREATEST(COALESCE(g.estimated_attendance, 0), COALESCE(g.tickets_sold, 0), 1)
    )
FROM public.venues v
WHERE v.id = g.venue_id
  AND g.status IN ('scheduled', 'confirmed')
  AND g.scheduled_date > now()
  AND COALESCE(g.estimated_attendance, 0) > 0
  AND COALESCE(g.predicted_tickets, 0) <> LEAST(
        GREATEST(COALESCE(v.capacity, 1), 1),
        GREATEST(COALESCE(g.estimated_attendance, 0), COALESCE(g.tickets_sold, 0), 1)
      );

CREATE OR REPLACE FUNCTION public.advance_gig_ticket_sales(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH eligible AS (
    SELECT
      g.id,
      g.scheduled_date,
      COALESCE(g.created_at, g.last_ticket_update, p_now) AS booked_at,
      COALESCE(g.last_ticket_update, g.created_at, '-infinity'::timestamptz) AS last_update,
      COALESCE(g.tickets_sold, 0) AS sold,
      LEAST(
        GREATEST(COALESCE(v.capacity, 1), 1),
        GREATEST(COALESCE(g.predicted_tickets, g.estimated_attendance, 0), COALESCE(g.tickets_sold, 0), 0)
      ) AS target
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status IN ('scheduled', 'confirmed')
      AND g.scheduled_date > p_now
      AND g.scheduled_date < p_now + interval '30 days'
      AND COALESCE(g.predicted_tickets, g.estimated_attendance, 0) > 0
  ), progress AS (
    SELECT
      e.*,
      CASE
        WHEN e.scheduled_date <= e.booked_at THEN 1::numeric
        ELSE GREATEST(
          0::numeric,
          LEAST(
            1::numeric,
            EXTRACT(epoch FROM (p_now - e.booked_at)) /
              NULLIF(EXTRACT(epoch FROM (e.scheduled_date - e.booked_at)), 0)
          )
        )
      END AS elapsed_fraction
    FROM eligible e
    WHERE e.last_update::date < p_now::date
  ), targets AS (
    SELECT
      p.id,
      CASE
        WHEN p.target <= p.sold THEN p.sold
        WHEN p.scheduled_date - p_now <= interval '24 hours' THEN p.target
        ELSE LEAST(
          p.target,
          GREATEST(
            p.sold,
            floor(p.target * power(p.elapsed_fraction, 0.85))::integer
          )
        )
      END AS next_sold
    FROM progress p
  ), updated AS (
    UPDATE public.gigs g
    SET tickets_sold = t.next_sold,
        last_ticket_update = p_now
    FROM targets t
    WHERE g.id = t.id
    RETURNING g.id
  )
  SELECT count(*)::integer INTO v_updated FROM updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_gig_ticket_sales(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_gig_ticket_sales(timestamptz) TO service_role;

-- Keep the legacy function name as a compatibility wrapper for any older jobs/tools.
CREATE OR REPLACE FUNCTION public.simulate_ticket_sales()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.advance_gig_ticket_sales(now());
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_ticket_sales() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_ticket_sales() TO service_role;

-- One authoritative daily tick. Reusing the job name makes this idempotent.
SELECT cron.schedule(
  'advance-gig-ticket-sales-daily',
  '15 0 * * *',
  $cron$SELECT public.advance_gig_ticket_sales(now());$cron$
);

-- Catch existing booked gigs up to where they should be in their sales window.
SELECT public.advance_gig_ticket_sales(now());

CREATE OR REPLACE FUNCTION public.sync_gig_outcome_attendance_percentage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity integer;
BEGIN
  v_capacity := NULLIF(NEW.venue_capacity, 0);

  IF v_capacity IS NULL AND NEW.venue_id IS NOT NULL THEN
    SELECT NULLIF(v.capacity, 0)
    INTO v_capacity
    FROM public.venues v
    WHERE v.id = NEW.venue_id;
  END IF;

  IF v_capacity IS NULL AND NEW.gig_id IS NOT NULL THEN
    SELECT NULLIF(v.capacity, 0)
    INTO v_capacity
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.id = NEW.gig_id;
  END IF;

  IF v_capacity IS NOT NULL THEN
    NEW.venue_capacity := v_capacity;
    IF NEW.actual_attendance IS NOT NULL THEN
      NEW.attendance_percentage := LEAST(
        999.99::numeric,
        round((NEW.actual_attendance::numeric * 100.0) / v_capacity::numeric, 2)
      );
    ELSE
      NEW.attendance_percentage := NULL;
    END IF;
  ELSE
    NEW.attendance_percentage := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_gig_outcome_attendance_percentage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gig_outcome_attendance_percentage() TO service_role;

DROP TRIGGER IF EXISTS sync_gig_outcome_attendance_percentage_trigger ON public.gig_outcomes;
CREATE TRIGGER sync_gig_outcome_attendance_percentage_trigger
BEFORE INSERT OR UPDATE OF actual_attendance, venue_capacity, venue_id, gig_id
ON public.gig_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.sync_gig_outcome_attendance_percentage();

-- Backfill existing outcomes so every current UI gets a correct value immediately.
UPDATE public.gig_outcomes go
SET venue_capacity = v.capacity,
    attendance_percentage = CASE
      WHEN v.capacity > 0 AND go.actual_attendance IS NOT NULL
        THEN LEAST(999.99::numeric, round((go.actual_attendance::numeric * 100.0) / v.capacity::numeric, 2))
      ELSE NULL
    END
FROM public.gigs g
JOIN public.venues v ON v.id = g.venue_id
WHERE g.id = go.gig_id;
