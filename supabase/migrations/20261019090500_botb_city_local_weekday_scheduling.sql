-- Schedule at 19:00 in the CITY's timezone (including DST), not 19:00 UTC.
-- Keep entered future events and their advertised prizes exactly as booked.
CREATE OR REPLACE FUNCTION public.generate_botb_events(p_horizon_events integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $generate$
DECLARE
  v_city record;
  v_anchor_date date;
  v_today date;
  v_local_date date;
  v_first integer;
  v_date timestamptz;
  v_i integer;
  v_created integer := 0;
  v_inserted integer;
  v_count integer;
  v_horizon integer := LEAST(12,GREATEST(1,COALESCE(p_horizon_events,3)));
BEGIN
  FOR v_city IN SELECT c.id,COALESCE(NULLIF(c.timezone,''),'UTC') AS city_timezone,
    COALESCE(s.weekday,5) AS weekday,
    COALESCE(s.frequency_weeks,2) AS frequency_weeks,
    COALESCE(s.prize_money,5000) AS prize_money
    FROM public.cities c LEFT JOIN public.botb_city_settings s ON s.city_id=c.id
  LOOP
    v_anchor_date := date '2026-01-02' + (v_city.weekday - 5);
    v_today := (now() AT TIME ZONE v_city.city_timezone)::date;
    v_first := GREATEST(0,CEIL(
      (v_today - v_anchor_date)::numeric / (v_city.frequency_weeks * 7)
    )::integer);
    v_count := 0;
    FOR v_i IN 0..v_horizon LOOP
      v_local_date := v_anchor_date + ((v_first + v_i) * v_city.frequency_weeks * 7);
      v_date := (v_local_date::timestamp + interval '19 hours') AT TIME ZONE v_city.city_timezone;
      IF v_date <= now() THEN CONTINUE; END IF;
      INSERT INTO public.botb_events(city_id,scheduled_date,prize_money)
      VALUES(v_city.id,v_date,v_city.prize_money)
      ON CONFLICT(city_id,scheduled_date) DO NOTHING;
      GET DIAGNOSTICS v_inserted=ROW_COUNT;
      v_created:=v_created+v_inserted;
      v_count:=v_count+1;
      IF v_count >= v_horizon THEN EXIT; END IF;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$generate$;
REVOKE ALL ON FUNCTION public.generate_botb_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_botb_events(integer) TO service_role;

-- Future unentered UTC-default event rows are replaced by local-time events.
-- Event rows with registrants are deliberately left unchanged.
DO $lock_future$ BEGIN
  PERFORM 1 FROM public.botb_events
    WHERE status='upcoming' AND scheduled_date>now()
    FOR UPDATE;
END; $lock_future$;
DELETE FROM public.botb_events e
WHERE e.status='upcoming' AND e.scheduled_date>now()
  AND NOT EXISTS(SELECT 1 FROM public.botb_entries be WHERE be.event_id=e.id);
SELECT public.generate_botb_events(3);
