-- Restore city-development demand in the latest ticket-sales authority and make
-- City Hall promoted genres a real local-demand policy.
--
-- Policy semantics:
--   * primary band genre promoted by the booked City Hall law: +10% demand
--   * otherwise, promoted songs in a mixed setlist contribute proportionally up
--     to +5% demand when the whole playable set is promoted
--   * city Culture / Music Scene / Tourism demand continues to multiply this
--     policy effect
--   * effective booked capacity remains the absolute ticket-sales ceiling
--
-- The booked law snapshot wins so a later mayor cannot rewrite a concert's
-- policy after tickets have started selling. Older gigs without a snapshot use
-- the law that is effective at their scheduled start.

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS city_development_demand_multiplier numeric(6,4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS city_genre_demand_multiplier numeric(6,4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS city_genre_promotion_basis text NOT NULL DEFAULT 'none';

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
      COALESCE(m.audience_demand_multiplier, 1)::numeric AS development_multiplier,
      CASE
        WHEN primary_promotion.is_match THEN 1.1000::numeric
        WHEN COALESCE(setlist_promotion.promoted_share, 0) > 0
          THEN 1.0000::numeric + LEAST(0.0500::numeric, setlist_promotion.promoted_share * 0.0500::numeric)
        ELSE 1.0000::numeric
      END AS genre_multiplier,
      CASE
        WHEN primary_promotion.is_match THEN 'primary_genre'
        WHEN COALESCE(setlist_promotion.promoted_share, 0) > 0 THEN 'setlist'
        ELSE 'none'
      END AS promotion_basis,
      LEAST(
        GREATEST(COALESCE(NULLIF(g.effective_capacity, 0), v.capacity, 1), 1),
        GREATEST(
          ROUND(
            GREATEST(
              COALESCE(g.predicted_tickets, g.estimated_attendance, 0),
              COALESCE(g.tickets_sold, 0),
              0
            )::numeric
            * COALESCE(m.audience_demand_multiplier, 1)::numeric
            * CASE
                WHEN primary_promotion.is_match THEN 1.1000::numeric
                WHEN COALESCE(setlist_promotion.promoted_share, 0) > 0
                  THEN 1.0000::numeric + LEAST(0.0500::numeric, setlist_promotion.promoted_share * 0.0500::numeric)
                ELSE 1.0000::numeric
              END
          )::integer,
          COALESCE(g.tickets_sold, 0),
          0
        )
      ) AS target
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    JOIN public.bands b ON b.id = g.band_id
    LEFT JOIN LATERAL public.city_gameplay_modifiers(v.city_id) m ON true
    LEFT JOIN LATERAL (
      SELECT cl.id, COALESCE(cl.promoted_genres, '{}'::text[]) AS promoted_genres
      FROM public.city_laws cl
      WHERE
        (g.booking_city_law_id IS NOT NULL AND cl.id = g.booking_city_law_id)
        OR
        (
          g.booking_city_law_id IS NULL
          AND cl.city_id = v.city_id
          AND cl.effective_from <= g.scheduled_date
          AND (cl.effective_until IS NULL OR cl.effective_until > g.scheduled_date)
        )
      ORDER BY
        CASE WHEN cl.id = g.booking_city_law_id THEN 0 ELSE 1 END,
        cl.effective_from DESC
      LIMIT 1
    ) law ON true
    LEFT JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(law.promoted_genres, '{}'::text[])) AS promoted(genre)
        WHERE lower(trim(promoted.genre)) = lower(trim(
          COALESCE(NULLIF(b.primary_genre, ''), NULLIF(b.genre, ''), '')
        ))
      ) AS is_match
    ) primary_promotion ON true
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM unnest(COALESCE(law.promoted_genres, '{}'::text[])) AS promoted(genre)
              WHERE lower(trim(promoted.genre)) = lower(trim(s.genre))
            )
          )::numeric / NULLIF(count(*)::numeric, 0),
          0::numeric
        ) AS promoted_share
      FROM public.setlist_songs ss
      JOIN public.songs s ON s.id = ss.song_id
      WHERE ss.setlist_id = g.setlist_id
        AND ss.song_id IS NOT NULL
        AND NULLIF(trim(s.genre), '') IS NOT NULL
    ) setlist_promotion ON true
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
      p.development_multiplier,
      p.genre_multiplier,
      p.promotion_basis,
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
        last_ticket_update = p_now,
        city_development_demand_multiplier = round(t.development_multiplier, 4),
        city_genre_demand_multiplier = round(t.genre_multiplier, 4),
        city_genre_promotion_basis = t.promotion_basis
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

COMMENT ON COLUMN public.gigs.city_development_demand_multiplier IS
  'Latest server-applied Culture/Music Scene/Tourism ticket-demand multiplier.';
COMMENT ON COLUMN public.gigs.city_genre_demand_multiplier IS
  'Latest server-applied City Hall promoted-genre ticket-demand multiplier.';
COMMENT ON COLUMN public.gigs.city_genre_promotion_basis IS
  'Why the promoted-genre multiplier applied: none, primary_genre, or setlist.';

NOTIFY pgrst, 'reload schema';
