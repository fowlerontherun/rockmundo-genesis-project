-- Fan-led gig demand and slower fame/fan progression.
-- Applied to production on 2026-09-01 before this repository copy was added.

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
  v_fame integer := 0;
  v_popularity integer := 0;
  v_local_pool numeric := 0;
  v_core_demand numeric := 0;
  v_casual_demand numeric := 0;
  v_price_multiplier numeric := 1;
  v_repeat_multiplier numeric := 1;
  v_time_multiplier numeric := 1;
  v_recent_shows integer := 0;
  v_demand numeric := 0;
BEGIN
  SELECT GREATEST(COALESCE(v.capacity, 100), 1), c.country
    INTO v_capacity, v_country
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_venue_id;

  SELECT COALESCE(b.total_fans,0), COALESCE(b.fame,0), COALESCE(b.popularity,0)
    INTO v_total_fans, v_fame, v_popularity
  FROM public.bands b WHERE b.id = p_band_id;

  SELECT COALESCE(MAX(bcf.total_fans),0) INTO v_country_fans
  FROM public.band_country_fans bcf
  WHERE bcf.band_id = p_band_id
    AND lower(bcf.country) = lower(COALESCE(v_country,''));

  v_local_pool := GREATEST(LEAST(v_total_fans::numeric * 0.015, 250), v_country_fans::numeric * 0.10);
  v_core_demand := v_local_pool * LEAST(0.42, 0.16 + LEAST(0.16, v_popularity / 500.0));
  v_casual_demand := CASE WHEN v_fame <= 0 THEN 2 ELSE 3 + (ln(1 + v_fame::numeric) * 5.5) END;

  v_price_multiplier := CASE
    WHEN COALESCE(p_ticket_price,20) <= 10 THEN 1.12
    WHEN p_ticket_price <= 20 THEN 1.00
    WHEN p_ticket_price <= 30 THEN 0.90
    WHEN p_ticket_price <= 45 THEN 0.75
    WHEN p_ticket_price <= 65 THEN 0.58
    ELSE 0.40
  END;

  SELECT count(*) INTO v_recent_shows FROM public.gigs g
  WHERE g.band_id = p_band_id AND g.venue_id = p_venue_id AND g.status <> 'cancelled'
    AND g.scheduled_date >= p_scheduled_date - interval '45 days' AND g.scheduled_date < p_scheduled_date;

  v_repeat_multiplier := CASE WHEN v_recent_shows=0 THEN 1.00 WHEN v_recent_shows=1 THEN 0.72 WHEN v_recent_shows=2 THEN 0.52 ELSE 0.38 END;
  v_time_multiplier := CASE WHEN p_scheduled_date-now() >= interval '21 days' THEN 1.08 WHEN p_scheduled_date-now() >= interval '7 days' THEN 1.03 ELSE 1.00 END;

  v_demand := (v_core_demand + v_casual_demand)
    * GREATEST(0.30, LEAST(1.00, COALESCE(p_slot_multiplier,1.0)))
    * v_price_multiplier * v_repeat_multiplier * v_time_multiplier;
  v_demand := v_demand * (1 + LEAST(0.35, GREATEST(0, v_popularity) / 300.0));

  RETURN LEAST(v_capacity, GREATEST(3, round(v_demand)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_realistic_gig_demand(uuid,uuid,timestamptz,integer,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_predicted_tickets(p_band_id uuid,p_venue_capacity integer,p_scheduled_date timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_fans integer:=0; v_fame integer:=0; v_popularity integer:=0; v_demand numeric;
BEGIN
  SELECT COALESCE(total_fans,0),COALESCE(fame,0),COALESCE(popularity,0) INTO v_fans,v_fame,v_popularity FROM public.bands WHERE id=p_band_id;
  v_demand := (LEAST(v_fans*0.018,300)*(0.15+LEAST(0.17,v_popularity/600.0))) + 3 + ln(1+GREATEST(v_fame,0))*5.0;
  RETURN LEAST(GREATEST(COALESCE(p_venue_capacity,1),1),GREATEST(3,round(v_demand)::integer));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_predicted_tickets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_capacity integer; v_demand integer;
BEGIN
  SELECT capacity INTO v_capacity FROM public.venues WHERE id=NEW.venue_id;
  v_demand := public.calculate_realistic_gig_demand(NEW.band_id,NEW.venue_id,NEW.scheduled_date,COALESCE(NEW.ticket_price,20),COALESCE(NEW.slot_attendance_multiplier,1.0));
  NEW.predicted_tickets := LEAST(GREATEST(COALESCE(v_capacity,1),1),GREATEST(v_demand,COALESCE(NEW.tickets_sold,0),0));
  NEW.estimated_attendance := NEW.predicted_tickets;
  NEW.estimated_revenue := NEW.predicted_tickets*COALESCE(NEW.ticket_price,20);
  NEW.tickets_sold := COALESCE(NEW.tickets_sold,0);
  RETURN NEW;
END;
$$;

UPDATE public.gigs g
SET predicted_tickets=GREATEST(COALESCE(g.tickets_sold,0),public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0))),
    estimated_attendance=GREATEST(COALESCE(g.tickets_sold,0),public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0))),
    estimated_revenue=GREATEST(COALESCE(g.tickets_sold,0),public.calculate_realistic_gig_demand(g.band_id,g.venue_id,g.scheduled_date,COALESCE(g.ticket_price,20),COALESCE(g.slot_attendance_multiplier,1.0)))*COALESCE(g.ticket_price,20)
WHERE g.status IN ('scheduled','confirmed') AND g.scheduled_date>now();

CREATE OR REPLACE FUNCTION public.support_fan_gain_for_gig(p_band_id uuid,p_attendance integer,p_rating numeric DEFAULT 10)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE v_existing integer:=0; v_conversion numeric;
BEGIN
  SELECT COALESCE(total_fans,0) INTO v_existing FROM public.bands WHERE id=p_band_id;
  v_conversion := LEAST(0.08,GREATEST(0.005,0.012+(COALESCE(p_rating,10)-10)*0.003));
  v_conversion := v_conversion/(1+ln(1+v_existing::numeric)/8.0);
  RETURN LEAST(250,GREATEST(0,round(GREATEST(COALESCE(p_attendance,0),0)*v_conversion)::integer));
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_fan_gain_for_gig(uuid,integer,numeric) TO authenticated,service_role;
