-- Protect accepted Battle of the Bands entries when legacy UTC start times
-- and city-local event times fall on the SAME day. One battle per local date.
-- Does not move or cancel any registered battle.
CREATE OR REPLACE FUNCTION public.generate_botb_events(p_horizon_events integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
    -- Extend loop headroom for legacy dates; never generate beyond the
    -- requested number of distinct future LOCAL calendar days per city.
    FOR v_i IN 0..(v_horizon + 12) LOOP
      v_local_date := v_anchor_date + ((v_first + v_i) * v_city.frequency_weeks * 7);
      v_date := (v_local_date::timestamp + interval '19 hours') AT TIME ZONE v_city.city_timezone;
      IF v_date <= now() THEN CONTINUE; END IF;

      -- The exact UTC timestamp can differ during DST migrations or for old
      -- UTC-anchored entries: a unique (city_id, scheduled_date) cannot prevent
      -- two same-day battles. Count accepted events toward the horizon.
      IF EXISTS(
        SELECT 1 FROM public.botb_events existing
        WHERE existing.city_id=v_city.id AND existing.status='upcoming'
          AND existing.scheduled_date>now()
          AND (existing.scheduled_date AT TIME ZONE v_city.city_timezone)::date=v_local_date
      ) THEN
        v_count := v_count + 1;
        IF v_count >= v_horizon THEN EXIT; END IF;
        CONTINUE;
      END IF;

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

-- Cleanup ONLY future, unentered rows duplicating the calendar day of an
-- accepted entry. Lock rows before re-checking entries to avoid withdrawing
-- a registration created concurrently.
DO $deduplicate$
DECLARE v_targets integer;
BEGIN
  SELECT COUNT(*) INTO v_targets
  FROM public.botb_events e
  JOIN public.cities c ON c.id=e.city_id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
    AND NOT EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id)
    AND EXISTS(
      SELECT 1 FROM public.botb_events kept
      WHERE kept.city_id=e.city_id AND kept.id<>e.id
        AND kept.status='upcoming' AND kept.scheduled_date>now()
        AND EXISTS(SELECT 1 FROM public.botb_entries registered WHERE registered.event_id=kept.id)
        AND (kept.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date =
            (e.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date
    );
  IF v_targets>10 THEN
    RAISE EXCEPTION 'More than 10 duplicate unentered battles; manual review required (% rows)',v_targets;
  END IF;
  PERFORM 1
  FROM public.botb_events e JOIN public.cities c ON c.id=e.city_id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
    AND NOT EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id)
    AND EXISTS(
      SELECT 1 FROM public.botb_events kept
      WHERE kept.city_id=e.city_id AND kept.id<>e.id
        AND kept.status='upcoming' AND kept.scheduled_date>now()
        AND EXISTS(SELECT 1 FROM public.botb_entries registered WHERE registered.event_id=kept.id)
        AND (kept.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date =
            (e.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date
    )
  FOR UPDATE OF e;
  DELETE FROM public.botb_events e USING public.cities c
  WHERE e.city_id=c.id AND e.status='upcoming' AND e.scheduled_date>now()
    AND NOT EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id)
    AND EXISTS(
      SELECT 1 FROM public.botb_events kept
      WHERE kept.city_id=e.city_id AND kept.id<>e.id
        AND kept.status='upcoming' AND kept.scheduled_date>now()
        AND EXISTS(SELECT 1 FROM public.botb_entries registered WHERE registered.event_id=kept.id)
        AND (kept.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date =
            (e.scheduled_date AT TIME ZONE COALESCE(NULLIF(c.timezone,''),'UTC'))::date
    );
END;
$deduplicate$;
