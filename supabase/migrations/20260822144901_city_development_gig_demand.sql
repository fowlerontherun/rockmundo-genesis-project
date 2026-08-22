-- Feed city culture/music/tourism development into progressive gig ticket demand.
-- The neutral city score (50) keeps today's behaviour unchanged. The multiplier
-- is bounded by city_gameplay_modifiers, and venue capacity remains a hard cap.

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
        GREATEST(
          ROUND(
            GREATEST(COALESCE(g.predicted_tickets, g.estimated_attendance, 0), COALESCE(g.tickets_sold, 0), 0)::numeric
              * COALESCE(m.audience_demand_multiplier, 1)
          )::integer,
          COALESCE(g.tickets_sold, 0),
          0
        )
      ) AS target
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    LEFT JOIN LATERAL public.city_gameplay_modifiers(v.city_id) m ON true
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

-- Keep the compatibility wrapper pointed at the development-aware authority.
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

-- Existing scheduled gigs pick up their city's current demand on the next daily
-- progression tick; no historical ticket rows are rewritten.
NOTIFY pgrst, 'reload schema';
