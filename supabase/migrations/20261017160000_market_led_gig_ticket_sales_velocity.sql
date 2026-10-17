-- Market-led gig demand and velocity. Safe for previously sold tickets:
-- never decrease tickets_sold and never exceed venue capacity for new sales.
-- This replaces the live time-elapsed curve, which delayed certain sell-outs
-- until the last 24 hours even for bands with vastly more demand than seats.

-- Potential demand is intentionally UNCAPPED: a band drawing 100k people must
-- sell a 2k room faster than a 20k arena. Keep the capped public forecast wrapper.
CREATE OR REPLACE FUNCTION public.calculate_gig_market_demand(
  p_band_id uuid,
  p_venue_id uuid,
  p_scheduled_date timestamptz,
  p_ticket_price integer DEFAULT 20,
  p_slot_multiplier numeric DEFAULT 1.0
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city_id uuid;
  v_country text;
  v_total_fans numeric := 0;
  v_city_fans numeric := 0;
  v_city_fame numeric := 0;
  v_country_fans numeric := 0;
  v_country_fame numeric := 0;
  v_global_fame numeric := 0;
  v_popularity numeric := 0;
  v_sentiment numeric := 0;
  v_reputation numeric := 0;
  v_effective_popularity numeric := 0;
  v_safe_country_fans numeric := 0;
  v_market_fans numeric := 0;
  v_fan_demand numeric := 0;
  v_fame_demand numeric := 0;
  v_local_reach numeric := 0.75;
  v_price_multiplier numeric := 1;
  v_repeat_multiplier numeric := 1;
  v_time_multiplier numeric := 1;
  v_sentiment_multiplier numeric := 1;
  v_reputation_multiplier numeric := 1;
  v_recent_shows integer := 0;
BEGIN
  SELECT v.city_id, c.country
  INTO v_city_id, v_country
  FROM public.venues v LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_venue_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(b.total_fans,0), COALESCE(b.fame,0), COALESCE(b.popularity,0),
         COALESCE(b.fan_sentiment_score,0), COALESCE(b.reputation_score,0)
  INTO v_total_fans, v_global_fame, v_popularity, v_sentiment, v_reputation
  FROM public.bands b WHERE b.id = p_band_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(max(cf.total_fans),0), COALESCE(max(cf.city_fame),0)
  INTO v_city_fans, v_city_fame
  FROM public.band_city_fans cf
  WHERE cf.band_id = p_band_id AND cf.city_id = v_city_id;

  SELECT COALESCE(max(cf.total_fans),0), COALESCE(max(cf.fame),0)
  INTO v_country_fans, v_country_fame
  FROM public.band_country_fans cf
  WHERE cf.band_id = p_band_id AND lower(trim(cf.country)) = lower(trim(COALESCE(v_country,'')));

  -- Some imported country-fan rows exceed the band's global fan count by
  -- >300x. They are not millions of guaranteed local customers.
  v_safe_country_fans := LEAST(
    GREATEST(v_country_fans,0),
    GREATEST(v_total_fans * 2, v_city_fans, 200)
  );

  -- City fans are the strongest direct audience; country fans are a smaller
  -- travelling catchment, with a conservative global fallback for missing rows.
  v_market_fans := GREATEST(
    v_city_fans * 0.90,
    v_safe_country_fans * 0.13,
    v_total_fans * 0.04
  );
  v_effective_popularity := GREATEST(
    v_popularity,
    LEAST(100, ln(1 + GREATEST(v_global_fame,0)) * 4.5)
  );
  v_fan_demand := v_market_fans *
    LEAST(0.65, 0.22 + v_effective_popularity / 250.0);

  -- Fame generates casual demand, regional fame strengthens it, but a band
  -- without regional data still retains part of its worldwide audience.
  v_local_reach := CASE
    WHEN v_city_fans > 0 OR v_city_fame > 0 THEN 1.08
    WHEN v_country_fans > 0 OR v_country_fame > 0 THEN 1.00
    ELSE 0.75
  END;
  v_fame_demand := (
    CASE WHEN v_global_fame <= 0 THEN 3
         ELSE power(v_global_fame, 0.58) * 3.25 END
    + power(GREATEST(v_country_fame,0), 0.56) * 1.30
    + power(GREATEST(v_city_fame,0), 0.62) * 0.90
  ) * v_local_reach;

  -- Preserve live price, repeat-show, sentiment, reputation and slot impacts.
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
  WHERE g.band_id = p_band_id AND g.venue_id = p_venue_id
    AND g.status <> 'cancelled'
    AND g.scheduled_date >= p_scheduled_date - interval '45 days'
    AND g.scheduled_date < p_scheduled_date;
  v_repeat_multiplier := CASE
    WHEN v_recent_shows = 0 THEN 1.00
    WHEN v_recent_shows = 1 THEN 0.78
    WHEN v_recent_shows = 2 THEN 0.60
    ELSE 0.45
  END;
  v_time_multiplier := CASE
    WHEN p_scheduled_date - now() >= interval '21 days' THEN 1.08
    WHEN p_scheduled_date - now() >= interval '7 days' THEN 1.04
    ELSE 1.00
  END;
  v_sentiment_multiplier :=
    0.85 + ((GREATEST(-100,LEAST(100,v_sentiment)) + 100) / 200.0) * 0.30;
  v_reputation_multiplier :=
    0.92 + ((GREATEST(-100,LEAST(100,v_reputation)) + 100) / 200.0) * 0.16;

  RETURN GREATEST(0,
    (v_fan_demand + v_fame_demand)
    * GREATEST(0.30, LEAST(1.00, COALESCE(p_slot_multiplier,1.0)))
    * v_price_multiplier * v_repeat_multiplier * v_time_multiplier
    * v_sentiment_multiplier * v_reputation_multiplier
  );
END;
$$;

-- Internal function: only privileged booking/forecast/tick paths should invoke it.
REVOKE ALL ON FUNCTION public.calculate_gig_market_demand(uuid,uuid,timestamptz,integer,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_gig_market_demand(uuid,uuid,timestamptz,integer,numeric)
  TO service_role;

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
  v_capacity integer;
  v_demand numeric;
BEGIN
  SELECT GREATEST(COALESCE(capacity,100),1) INTO v_capacity
  FROM public.venues WHERE id=p_venue_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_demand := public.calculate_gig_market_demand(
    p_band_id,p_venue_id,p_scheduled_date,p_ticket_price,p_slot_multiplier
  );
  RETURN LEAST(v_capacity, GREATEST(3, round(v_demand)::integer));
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric)
  TO authenticated, service_role;

-- Cumulative tickets at any instant, including at opening (elapsed = 0).
-- For 100k qualified demand: 2k instantly, 20k within a day, 100k over days.
CREATE OR REPLACE FUNCTION public.gig_ticket_sales_goal(
  p_market_demand numeric,
  p_capacity integer,
  p_booked_at timestamptz,
  p_at timestamptz,
  p_show_at timestamptz
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_capacity integer := GREATEST(COALESCE(p_capacity,0),0);
  v_demand numeric := GREATEST(COALESCE(p_market_demand,0),0);
  v_target integer;
  v_ratio numeric;
  v_opening numeric;
  v_hours numeric;
  v_available numeric;
  v_elapsed numeric;
  v_fraction numeric;
BEGIN
  IF v_capacity = 0 OR p_booked_at IS NULL OR p_at IS NULL OR p_show_at IS NULL
     OR p_show_at <= p_booked_at THEN RETURN 0; END IF;
  v_target := LEAST(v_capacity, round(v_demand)::integer);
  IF v_target <= 0 THEN RETURN 0; END IF;
  v_ratio := v_demand / v_capacity;
  IF v_ratio >= 20 THEN RETURN v_target; END IF;
  IF v_ratio >= 10 THEN v_opening := 0.90; v_hours := 4;
  ELSIF v_ratio >= 5 THEN v_opening := 0.60; v_hours := 24;
  ELSIF v_ratio >= 2 THEN v_opening := 0.30; v_hours := 72;
  ELSIF v_ratio >= 1 THEN v_opening := 0.15; v_hours := 168;
  ELSIF v_ratio >= 0.5 THEN v_opening := 0.08; v_hours := 336;
  ELSE v_opening := 0.03; v_hours := 504;
  END IF;
  v_available := GREATEST(0.001, EXTRACT(epoch FROM (p_show_at-p_booked_at))/3600.0);
  v_hours := LEAST(v_hours, v_available);
  v_elapsed := GREATEST(0, EXTRACT(epoch FROM (LEAST(p_at,p_show_at)-p_booked_at))/3600.0);
  v_fraction := v_opening + (1-v_opening)
    * power(LEAST(1, v_elapsed/v_hours), 0.70);
  RETURN LEAST(v_target, GREATEST(0, floor(v_target*v_fraction)::integer));
END;
$$;
REVOKE ALL ON FUNCTION public.gig_ticket_sales_goal(numeric,integer,timestamptz,timestamptz,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gig_ticket_sales_goal(numeric,integer,timestamptz,timestamptz,timestamptz)
  TO authenticated, service_role;

-- A booking should immediately reserve the opening rush before INSERT returns.
-- Alphabetical trigger order deliberately follows trigger_set_predicted_tickets.
CREATE OR REPLACE FUNCTION public.seed_initial_gig_ticket_sales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity integer;
  v_potential numeric;
  v_initial integer;
BEGIN
  IF NEW.status NOT IN ('scheduled','confirmed') OR NEW.scheduled_date <= now()
  THEN RETURN NEW; END IF;
  SELECT GREATEST(COALESCE(v.capacity,1),1) INTO v_capacity
  FROM public.venues v WHERE v.id=NEW.venue_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_potential := public.calculate_gig_market_demand(
    NEW.band_id,NEW.venue_id,NEW.scheduled_date,
    COALESCE(NEW.ticket_price,20),COALESCE(NEW.slot_attendance_multiplier,1)
  );
  v_initial := public.gig_ticket_sales_goal(
    v_potential,v_capacity,COALESCE(NEW.created_at,now()),now(),NEW.scheduled_date
  );
  NEW.tickets_sold := LEAST(v_capacity,GREATEST(COALESCE(NEW.tickets_sold,0),v_initial));
  NEW.predicted_tickets := LEAST(v_capacity,GREATEST(COALESCE(NEW.predicted_tickets,0),NEW.tickets_sold));
  NEW.estimated_attendance := NEW.predicted_tickets;
  NEW.estimated_revenue := LEAST(2147483647::numeric,
    NEW.predicted_tickets::numeric * GREATEST(COALESCE(NEW.ticket_price,0),0))::integer;
  NEW.last_ticket_update := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_seed_initial_gig_ticket_sales ON public.gigs;
CREATE TRIGGER zz_seed_initial_gig_ticket_sales
BEFORE INSERT ON public.gigs FOR EACH ROW
EXECUTE FUNCTION public.seed_initial_gig_ticket_sales();
REVOKE ALL ON FUNCTION public.seed_initial_gig_ticket_sales() FROM PUBLIC,anon,authenticated;

-- Single server authority for every scheduled gig (including >30 days away).
-- Include city development, City Hall genre promotion and support acts. Cumulative
-- curve is calculated from original booking time, not the last cron execution.
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
      g.id, g.scheduled_date, g.band_id, g.venue_id,
      COALESCE(g.created_at,g.last_ticket_update,p_now) AS booked_at,
      COALESCE(g.tickets_sold,0) AS sold,
      GREATEST(COALESCE(v.capacity,1),1) AS capacity,
      COALESCE(g.ticket_price,20) AS ticket_price,
      COALESCE(g.slot_attendance_multiplier,1) AS slot_multiplier,
      COALESCE(m.audience_demand_multiplier,1)::numeric AS city_multiplier,
      CASE
        WHEN EXISTS(
          SELECT 1 FROM unnest(COALESCE(law.promoted_genres,'{}'::text[])) promoted(genre)
          WHERE lower(trim(promoted.genre)) =
            lower(trim(COALESCE(NULLIF(b.primary_genre,''),NULLIF(b.genre,''),'')))
        ) THEN 1.10::numeric
        WHEN COALESCE(setlist_promotions.promoted_share,0)>0
          THEN 1+LEAST(0.05::numeric, setlist_promotions.promoted_share*0.05)
        ELSE 1::numeric
      END AS genre_multiplier
    FROM public.gigs g
    JOIN public.venues v ON v.id=g.venue_id
    JOIN public.bands b ON b.id=g.band_id
    LEFT JOIN LATERAL public.city_gameplay_modifiers(v.city_id) m ON true
    LEFT JOIN LATERAL (
      SELECT cl.promoted_genres
      FROM public.city_laws cl
      WHERE cl.city_id=v.city_id
        AND cl.effective_from<=g.scheduled_date
        AND (cl.effective_until IS NULL OR cl.effective_until>g.scheduled_date)
      ORDER BY cl.effective_from DESC LIMIT 1
    ) law ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM unnest(COALESCE(law.promoted_genres,'{}'::text[])) promoted(genre)
          WHERE lower(trim(promoted.genre))=lower(trim(s.genre))
        ))::numeric / NULLIF(count(*)::numeric,0),0
      ) AS promoted_share
      FROM public.setlist_songs ss
      JOIN public.songs s ON s.id=ss.song_id
      WHERE ss.setlist_id=g.setlist_id AND ss.song_id IS NOT NULL
        AND NULLIF(trim(s.genre),'') IS NOT NULL
    ) setlist_promotions ON true
    WHERE g.status IN ('scheduled','confirmed') AND g.scheduled_date>p_now
  ), demand AS (
    SELECT e.*,
      public.calculate_gig_market_demand(
        e.band_id,e.venue_id,e.scheduled_date,e.ticket_price,e.slot_multiplier
      ) * e.city_multiplier * e.genre_multiplier
        * public.support_gig_demand_multiplier(e.id) AS potential
    FROM eligible e
  ), goals AS (
    SELECT d.id,d.sold,d.capacity,
      LEAST(d.capacity,GREATEST(d.sold,round(d.potential)::integer)) AS target,
      public.gig_ticket_sales_goal(
        d.potential,d.capacity,d.booked_at,p_now,d.scheduled_date
      ) AS due
    FROM demand d
  ), next_state AS (
    SELECT id, target,
      CASE WHEN sold>=capacity THEN sold
      ELSE LEAST(capacity,GREATEST(sold,due)) END AS next_sold
    FROM goals
  ), changed AS (
    UPDATE public.gigs g
    SET tickets_sold=n.next_sold,
        predicted_tickets=n.target,
        estimated_attendance=n.target,
        estimated_revenue=LEAST(2147483647::numeric,
          n.target::numeric * GREATEST(COALESCE(g.ticket_price,0),0))::integer,
        last_ticket_update=p_now
    FROM next_state n
    WHERE g.id=n.id AND (
      g.tickets_sold IS DISTINCT FROM n.next_sold OR
      g.predicted_tickets IS DISTINCT FROM n.target OR
      g.estimated_attendance IS DISTINCT FROM n.target
    )
    RETURNING g.id
  )
  SELECT count(*)::integer INTO v_updated FROM changed;
  RETURN v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_gig_ticket_sales(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_gig_ticket_sales(timestamptz) TO service_role;

-- Keep old tooling that calls simulate_ticket_sales compatible.
CREATE OR REPLACE FUNCTION public.simulate_ticket_sales()
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.advance_gig_ticket_sales(now());
END;
$$;
REVOKE ALL ON FUNCTION public.simulate_ticket_sales() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_ticket_sales() TO service_role;

-- Move from overnight-only progress to hourly progress; do not leave both jobs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='advance-gig-ticket-sales-daily')
  THEN PERFORM cron.unschedule('advance-gig-ticket-sales-daily'); END IF;
END;
$$;
SELECT cron.schedule(
  'advance-gig-ticket-sales-hourly','15 * * * *',
  $cron$SELECT public.advance_gig_ticket_sales(now());$cron$
);

-- Catch up existing future shows without ever reducing a previously sold count.
SELECT public.advance_gig_ticket_sales(now());
NOTIFY pgrst, 'reload schema';
