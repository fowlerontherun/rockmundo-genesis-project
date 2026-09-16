-- Make small, low-prestige venues a realistic entry point for new bands while
-- keeping ticket pricing tied to venue scale and prestige.

-- Existing data uses both 1-10 gameplay prestige and 70-100 legacy/famous
-- prestige. Keep both representations and normalise only for ticketing.
UPDATE public.venues
SET prestige_level = CASE
  WHEN COALESCE(capacity, 100) <= 200 THEN 1
  WHEN COALESCE(capacity, 100) <= 500 THEN 2
  WHEN COALESCE(capacity, 100) <= 1500 THEN 3
  WHEN COALESCE(capacity, 100) <= 5000 THEN 4
  ELSE 5
END
WHERE prestige_level IS NULL OR prestige_level <= 0;

ALTER TABLE public.venues
  ALTER COLUMN prestige_level SET DEFAULT 1,
  ALTER COLUMN prestige_level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.venues'::regclass
      AND conname = 'venues_prestige_level_valid'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_prestige_level_valid
      CHECK (prestige_level BETWEEN 1 AND 100);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.gig_ticket_prestige_tier(p_prestige integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT GREATEST(
    1,
    LEAST(
      10,
      CASE
        WHEN COALESCE(p_prestige, 1) <= 10 THEN COALESCE(p_prestige, 1)
        ELSE round(COALESCE(p_prestige, 1)::numeric / 10.0)::integer
      END
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.recommended_gig_ticket_price(
  p_capacity integer,
  p_prestige integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH inputs AS (
    SELECT
      GREATEST(COALESCE(p_capacity, 100), 1) AS capacity,
      public.gig_ticket_prestige_tier(p_prestige) AS prestige_tier
  ), priced AS (
    SELECT
      capacity,
      prestige_tier,
      CASE
        WHEN capacity <= 100 THEN 5
        WHEN capacity <= 200 THEN 6
        WHEN capacity <= 500 THEN 8
        WHEN capacity <= 1000 THEN 10
        WHEN capacity <= 2500 THEN 13
        WHEN capacity <= 5000 THEN 16
        WHEN capacity <= 10000 THEN 20
        WHEN capacity <= 25000 THEN 24
        WHEN capacity <= 50000 THEN 28
        ELSE 32
      END AS capacity_price
    FROM inputs
  )
  SELECT GREATEST(
    5,
    capacity_price
      + ((prestige_tier - 1) * 2)
      - CASE
          WHEN capacity <= 200 AND prestige_tier <= 2 THEN 2
          WHEN capacity <= 500 AND prestige_tier <= 3 THEN 1
          ELSE 0
        END
  )::integer
  FROM priced;
$$;

CREATE OR REPLACE FUNCTION public.calculate_realistic_gig_demand(
  p_band_id uuid,
  p_venue_id uuid,
  p_scheduled_date timestamptz,
  p_ticket_price integer DEFAULT 20,
  p_slot_multiplier numeric DEFAULT 1.0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity integer := 100;
  v_city_id uuid;
  v_country text;
  v_prestige integer := 1;
  v_ticket_prestige integer := 1;
  v_recommended_price integer := 10;
  v_total_fans integer := 0;
  v_city_fans integer := 0;
  v_country_fans integer := 0;
  v_fame integer := 0;
  v_popularity integer := 0;
  v_local_pool numeric := 0;
  v_core_demand numeric := 0;
  v_casual_demand numeric := 0;
  v_walkup_floor numeric := 0;
  v_price_ratio numeric := 1;
  v_price_multiplier numeric := 1;
  v_repeat_multiplier numeric := 1;
  v_time_multiplier numeric := 1;
  v_recent_shows integer := 0;
  v_demand numeric := 0;
BEGIN
  SELECT
    GREATEST(COALESCE(v.capacity, 100), 1),
    v.city_id,
    c.country,
    COALESCE(v.prestige_level, 1)
  INTO v_capacity, v_city_id, v_country, v_prestige
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_venue_id;

  v_ticket_prestige := public.gig_ticket_prestige_tier(v_prestige);
  v_recommended_price := public.recommended_gig_ticket_price(v_capacity, v_prestige);

  SELECT COALESCE(b.total_fans, 0), COALESCE(b.fame, 0), COALESCE(b.popularity, 0)
  INTO v_total_fans, v_fame, v_popularity
  FROM public.bands b
  WHERE b.id = p_band_id;

  SELECT COALESCE(MAX(bcf.total_fans), 0)
  INTO v_city_fans
  FROM public.band_city_fans bcf
  WHERE bcf.band_id = p_band_id
    AND bcf.city_id = v_city_id;

  SELECT COALESCE(MAX(bcf.total_fans), 0)
  INTO v_country_fans
  FROM public.band_country_fans bcf
  WHERE bcf.band_id = p_band_id
    AND lower(bcf.country) = lower(COALESCE(v_country, ''));

  v_local_pool := GREATEST(
    v_city_fans::numeric,
    LEAST(v_country_fans::numeric * 0.035, 500),
    LEAST(v_total_fans::numeric * 0.006, 150)
  );

  v_core_demand := v_local_pool
    * LEAST(0.38, 0.12 + LEAST(0.16, v_popularity / 500.0));

  v_casual_demand := CASE
    WHEN v_fame <= 0 THEN 2
    ELSE 2 + (ln(1 + v_fame::numeric) * 4.5)
  END;

  v_walkup_floor := CASE
    WHEN v_capacity <= 100 AND v_ticket_prestige <= 2 THEN v_capacity * 0.18
    WHEN v_capacity <= 200 AND v_ticket_prestige <= 3 THEN v_capacity * 0.15
    WHEN v_capacity <= 500 AND v_ticket_prestige <= 3 THEN v_capacity * 0.10
    ELSE 0
  END;

  v_price_ratio := GREATEST(COALESCE(p_ticket_price, v_recommended_price), 1)::numeric
    / GREATEST(v_recommended_price, 1)::numeric;

  v_price_multiplier := CASE
    WHEN v_price_ratio <= 0.75 THEN 1.30
    WHEN v_price_ratio <= 1.00 THEN 1.15
    WHEN v_price_ratio <= 1.25 THEN 1.00
    WHEN v_price_ratio <= 1.50 THEN 0.82
    WHEN v_price_ratio <= 2.00 THEN 0.60
    ELSE 0.40
  END;

  SELECT count(*)
  INTO v_recent_shows
  FROM public.gigs g
  WHERE g.band_id = p_band_id
    AND g.venue_id = p_venue_id
    AND g.status <> 'cancelled'
    AND g.scheduled_date >= p_scheduled_date - interval '45 days'
    AND g.scheduled_date < p_scheduled_date;

  v_repeat_multiplier := CASE
    WHEN v_recent_shows = 0 THEN 1.00
    WHEN v_recent_shows = 1 THEN 0.72
    WHEN v_recent_shows = 2 THEN 0.52
    ELSE 0.38
  END;

  v_time_multiplier := CASE
    WHEN p_scheduled_date - now() >= interval '21 days' THEN 1.08
    WHEN p_scheduled_date - now() >= interval '7 days' THEN 1.03
    ELSE 1.00
  END;

  v_demand := GREATEST(v_core_demand + v_casual_demand, v_walkup_floor)
    * GREATEST(0.30, LEAST(1.00, COALESCE(p_slot_multiplier, 1.0)))
    * v_price_multiplier
    * v_repeat_multiplier
    * v_time_multiplier;

  v_demand := v_demand
    * (1 + LEAST(0.30, GREATEST(0, v_popularity) / 350.0));

  RETURN LEAST(v_capacity, GREATEST(3, round(v_demand)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_realistic_gig_demand(uuid, uuid, timestamptz, integer, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_realistic_gig_demand(uuid, uuid, timestamptz, integer, numeric)
  TO authenticated, service_role;

WITH targets AS (
  SELECT
    g.id,
    GREATEST(
      COALESCE(g.tickets_sold, 0),
      COALESCE(g.predicted_tickets, 0),
      public.calculate_realistic_gig_demand(
        g.band_id,
        g.venue_id,
        g.scheduled_date,
        COALESCE(g.ticket_price, 20),
        COALESCE(g.slot_attendance_multiplier, 1.0)
      )
    ) AS target
  FROM public.gigs g
  JOIN public.venues v ON v.id = g.venue_id
  WHERE g.status IN ('scheduled', 'confirmed')
    AND g.scheduled_date > now()
    AND COALESCE(v.capacity, 100) <= 500
    AND public.gig_ticket_prestige_tier(v.prestige_level) <= 3
)
UPDATE public.gigs g
SET predicted_tickets = t.target,
    estimated_attendance = GREATEST(COALESCE(g.estimated_attendance, 0), t.target),
    estimated_revenue = GREATEST(
      COALESCE(g.estimated_revenue, 0),
      t.target * COALESCE(g.ticket_price, 20)
    )
FROM targets t
WHERE g.id = t.id;

COMMENT ON COLUMN public.venues.prestige_level IS
  'Required venue prestige. Core venues generally use 1-10; legacy famous venues may use 70-100 and are normalised by ticketing.';

COMMENT ON FUNCTION public.recommended_gig_ticket_price(integer, integer) IS
  'Recommended face-value ticket price using venue capacity plus a normalised prestige tier, with starter-venue discounts.';

NOTIFY pgrst, 'reload schema';