-- Rebalance commercial demand for established artists.
-- Regional fan rows remain preferred, but sparse legacy data no longer collapses demand.

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
  v_country text;
  v_total_fans integer := 0;
  v_country_fans integer := 0;
  v_fame bigint := 0;
  v_popularity integer := 0;
  v_effective_popularity numeric := 0;
  v_sentiment numeric := 0;
  v_reputation numeric := 0;
  v_market_fans numeric := 0;
  v_fan_demand numeric := 0;
  v_fame_demand numeric := 0;
  v_price_multiplier numeric := 1;
  v_repeat_multiplier numeric := 1;
  v_time_multiplier numeric := 1;
  v_sentiment_multiplier numeric := 1;
  v_reputation_multiplier numeric := 1;
  v_recent_shows integer := 0;
  v_demand numeric := 0;
BEGIN
  SELECT GREATEST(COALESCE(v.capacity, 100), 1), c.country
  INTO v_capacity, v_country
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_venue_id;

  SELECT COALESCE(b.total_fans,0), COALESCE(b.fame,0), COALESCE(b.popularity,0),
         COALESCE(b.fan_sentiment_score,0), COALESCE(b.reputation_score,0)
  INTO v_total_fans, v_fame, v_popularity, v_sentiment, v_reputation
  FROM public.bands b
  WHERE b.id = p_band_id;

  SELECT COALESCE(MAX(bcf.total_fans),0)
  INTO v_country_fans
  FROM public.band_country_fans bcf
  WHERE bcf.band_id = p_band_id
    AND lower(bcf.country) = lower(COALESCE(v_country,''));

  v_effective_popularity := GREATEST(
    v_popularity::numeric,
    LEAST(100::numeric, ln(1 + GREATEST(v_fame,0)::numeric) * 4.5)
  );

  v_market_fans := CASE
    WHEN v_country_fans > 0 THEN GREATEST(v_country_fans::numeric, v_total_fans::numeric * 0.05)
    ELSE v_total_fans::numeric * 0.12
  END;

  v_fan_demand := v_market_fans * LEAST(0.55, 0.18 + v_effective_popularity / 400.0);
  v_fame_demand := CASE
    WHEN v_fame <= 0 THEN 3
    ELSE power(v_fame::numeric, 0.43) * 1.45
  END;

  v_price_multiplier := CASE
    WHEN COALESCE(p_ticket_price,20) <= 10 THEN 1.12
    WHEN p_ticket_price <= 20 THEN 1.00
    WHEN p_ticket_price <= 30 THEN 0.90
    WHEN p_ticket_price <= 45 THEN 0.78
    WHEN p_ticket_price <= 65 THEN 0.62
    ELSE 0.45
  END;

  SELECT count(*) INTO v_recent_shows
  FROM public.gigs g
  WHERE g.band_id = p_band_id
    AND g.venue_id = p_venue_id
    AND g.status <> 'cancelled'
    AND g.scheduled_date >= p_scheduled_date - interval '45 days'
    AND g.scheduled_date < p_scheduled_date;

  v_repeat_multiplier := CASE
    WHEN v_recent_shows=0 THEN 1.00
    WHEN v_recent_shows=1 THEN 0.78
    WHEN v_recent_shows=2 THEN 0.60
    ELSE 0.45
  END;

  v_time_multiplier := CASE
    WHEN p_scheduled_date-now() >= interval '21 days' THEN 1.08
    WHEN p_scheduled_date-now() >= interval '7 days' THEN 1.04
    ELSE 1.00
  END;

  v_sentiment_multiplier := 0.85 + ((GREATEST(-100,LEAST(100,v_sentiment)) + 100) / 200.0) * 0.30;
  v_reputation_multiplier := 0.92 + ((GREATEST(-100,LEAST(100,v_reputation)) + 100) / 200.0) * 0.16;

  v_demand := (v_fan_demand + v_fame_demand)
    * GREATEST(0.30, LEAST(1.00, COALESCE(p_slot_multiplier,1.0)))
    * v_price_multiplier * v_repeat_multiplier * v_time_multiplier
    * v_sentiment_multiplier * v_reputation_multiplier;

  RETURN LEAST(v_capacity, GREATEST(3, round(v_demand)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_predicted_tickets(
  p_band_id uuid,
  p_venue_capacity integer,
  p_scheduled_date timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fans integer := 0;
  v_fame bigint := 0;
  v_popularity integer := 0;
  v_effective_popularity numeric := 0;
  v_demand numeric := 0;
BEGIN
  SELECT COALESCE(total_fans,0), COALESCE(fame,0), COALESCE(popularity,0)
  INTO v_fans, v_fame, v_popularity
  FROM public.bands
  WHERE id=p_band_id;

  v_effective_popularity := GREATEST(
    v_popularity::numeric,
    LEAST(100::numeric, ln(1 + GREATEST(v_fame,0)::numeric) * 4.5)
  );

  v_demand :=
      (v_fans::numeric * 0.08 * LEAST(0.50,0.18 + v_effective_popularity/400.0))
    + CASE WHEN v_fame<=0 THEN 3 ELSE power(v_fame::numeric,0.43)*1.35 END;

  RETURN LEAST(
    GREATEST(COALESCE(p_venue_capacity,1),1),
    GREATEST(3,round(v_demand)::integer)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_predicted_tickets(uuid,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_predicted_tickets(uuid,integer,timestamptz) TO authenticated, service_role;

UPDATE public.gigs g
SET predicted_tickets = GREATEST(
      COALESCE(g.tickets_sold,0),
      public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0))
    ),
    estimated_attendance = GREATEST(
      COALESCE(g.tickets_sold,0),
      public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0))
    ),
    estimated_revenue = GREATEST(
      COALESCE(g.tickets_sold,0),
      public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0))
    ) * COALESCE(g.ticket_price,20)
WHERE g.status IN ('scheduled','confirmed')
  AND g.scheduled_date > now();

NOTIFY pgrst, 'reload schema';
