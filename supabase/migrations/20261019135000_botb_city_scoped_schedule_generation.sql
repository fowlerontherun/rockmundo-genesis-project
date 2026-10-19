-- 2026-10-19: eliminate global schedule regeneration from a mayor transaction.
-- Mayor actions lock ONE city, not every other city's mayor workspace.
-- The hourly cycle retains its public.generate_botb_events(integer) API.
CREATE OR REPLACE FUNCTION public.generate_botb_city_events(
  p_city_id uuid, p_horizon_events integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $city_botb$
DECLARE
  v_city record;
  v_weekday integer;
  v_frequency_weeks integer;
  v_prize_money integer;
  v_anchor_date date;
  v_today date;
  v_local_date date;
  v_first integer;
  v_date timestamptz;
  v_i integer;
  v_created integer := 0;
  v_inserted integer;
  v_count integer := 0;
  v_horizon integer := LEAST(12,GREATEST(1,COALESCE(p_horizon_events,3)));
BEGIN
  -- Shared lock order for the mayor configuration, cron and this helper.
  SELECT c.id, COALESCE(NULLIF(c.timezone,''),'UTC') AS city_timezone
    INTO v_city FROM public.cities c
    WHERE c.id=p_city_id FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_CITY_NOT_FOUND'; END IF;

  -- Separate SELECT after city lock sees the mayor's last committed settings.
  SELECT s.weekday,s.frequency_weeks,s.prize_money
    INTO v_weekday,v_frequency_weeks,v_prize_money
    FROM public.botb_city_settings s WHERE s.city_id=v_city.id;
  IF NOT FOUND THEN
    v_weekday:=5; v_frequency_weeks:=2; v_prize_money:=5000;
  END IF;

  v_anchor_date := date '2026-01-02' + (v_weekday-5);
  v_today := (now() AT TIME ZONE v_city.city_timezone)::date;
  v_first := GREATEST(0,CEIL(
    (v_today-v_anchor_date)::numeric/(v_frequency_weeks*7))::integer);

  -- Count pre-existing future LOCAL calendar days, including grandfathered
  -- events with registered players. Never create a same-day second battle.
  FOR v_i IN 0..(v_horizon+12) LOOP
    v_local_date := v_anchor_date + ((v_first+v_i)*v_frequency_weeks*7);
    v_date := (v_local_date::timestamp+interval '19 hours')
      AT TIME ZONE v_city.city_timezone;
    IF v_date<=now() THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.botb_events e
      WHERE e.city_id=v_city.id AND e.status='upcoming'
        AND e.scheduled_date>now()
        AND (e.scheduled_date AT TIME ZONE v_city.city_timezone)::date=v_local_date
    ) THEN
      v_count:=v_count+1;
      IF v_count>=v_horizon THEN EXIT; END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.botb_events(city_id,scheduled_date,prize_money)
      VALUES (v_city.id,v_date,v_prize_money)
      ON CONFLICT(city_id,scheduled_date) DO NOTHING;
    GET DIAGNOSTICS v_inserted=ROW_COUNT;
    v_created:=v_created+v_inserted;
    v_count:=v_count+1;
    IF v_count>=v_horizon THEN EXIT; END IF;
  END LOOP;
  RETURN v_created;
END;
$city_botb$;

REVOKE ALL ON FUNCTION public.generate_botb_city_events(uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_botb_city_events(uuid,integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.generate_botb_events(p_horizon_events integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $all_botb$
DECLARE
  v_city record;
  v_created integer := 0;
BEGIN
  FOR v_city IN SELECT id FROM public.cities ORDER BY id LOOP
    v_created := v_created+
      public.generate_botb_city_events(v_city.id,p_horizon_events);
  END LOOP;
  RETURN v_created;
END;
$all_botb$;

REVOKE ALL ON FUNCTION public.generate_botb_events(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_botb_events(integer)
  TO service_role;

-- Replace ONLY the global scheduling call in the mayor's existing RPC.
-- Preserve all server-side mayor identity checks and audit logging.
DO $patch_mayor$
DECLARE
  v_old text := pg_get_functiondef(
    'public.configure_city_botb(uuid,integer,integer,integer)'::regprocedure);
  v_new text;
BEGIN
  IF position('PERFORM public.generate_botb_events(3);' IN v_old)=0
     OR position('p.user_id=auth.uid()' IN v_old)=0 THEN
     RAISE EXCEPTION 'BOTB mayor configuration drift; abort';
  END IF;
  v_new:=replace(v_old,
    'PERFORM public.generate_botb_events(3);',
    'PERFORM public.generate_botb_city_events(p_city_id,3);');
  IF v_new=v_old THEN RAISE EXCEPTION 'BOTB mayor scheduling patch not applied'; END IF;
  EXECUTE v_new;
END;
$patch_mayor$;
