
CREATE UNIQUE INDEX IF NOT EXISTS major_event_instances_event_year_uidx
  ON public.major_event_instances (event_id, year);

CREATE OR REPLACE FUNCTION public.generate_major_event_instances(p_max_year integer DEFAULT 6)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epoch timestamptz := '2026-01-01T00:00:00Z';
  v_days_per_month integer := 10;   -- real days per game month
  v_created integer := 0;
  v_year integer;
  ev record;
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
BEGIN
  FOR v_year IN 1..GREATEST(p_max_year, 1) LOOP
    FOR ev IN SELECT * FROM public.major_events WHERE is_active LOOP
      IF COALESCE(ev.frequency_years, 1) > 1
         AND ((v_year - 1) % ev.frequency_years) <> 0 THEN
        CONTINUE;
      END IF;

      -- real-world date for game year/month, mid-month
      v_start := v_epoch
        + make_interval(days => ((v_year - 1) * 12 + (ev.month - 1)) * v_days_per_month)
        + make_interval(days => 4, hours => 19);
      v_end := v_start + make_interval(hours => GREATEST(COALESCE(ev.duration_hours, 3), 1));
      v_status := CASE WHEN v_end < now() THEN 'completed' ELSE 'upcoming' END;

      INSERT INTO public.major_event_instances (event_id, year, event_date, event_start, event_end, status)
      VALUES (ev.id, v_year, v_start, v_start, v_end, v_status)
      ON CONFLICT (event_id, year) DO UPDATE
        SET event_date = EXCLUDED.event_date,
            event_start = EXCLUDED.event_start,
            event_end = EXCLUDED.event_end,
            status = CASE WHEN public.major_event_instances.status IN ('completed','past')
                          THEN public.major_event_instances.status
                          ELSE EXCLUDED.status END;
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  -- close out anything whose window has passed
  UPDATE public.major_event_instances
     SET status = 'completed'
   WHERE status = 'upcoming' AND event_end IS NOT NULL AND event_end < now();

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_major_event_instances(integer) TO authenticated, service_role;

-- performances are stored against the character (profile), not the account
DROP POLICY IF EXISTS "Users can view their own performances" ON public.major_event_performances;
DROP POLICY IF EXISTS "Users can insert their own performances" ON public.major_event_performances;
DROP POLICY IF EXISTS "Users can update their own performances" ON public.major_event_performances;

CREATE POLICY "Players view own major event performances"
  ON public.major_event_performances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players insert own major event performances"
  ON public.major_event_performances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players update own major event performances"
  ON public.major_event_performances FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their song performances" ON public.major_event_song_performances;
CREATE POLICY "Players view own major event song performances"
  ON public.major_event_song_performances FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.major_event_performances p
    WHERE p.id = major_event_song_performances.performance_id
      AND (p.user_id = auth.uid() OR p.user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  ));

GRANT SELECT ON public.major_events TO anon, authenticated;
GRANT SELECT ON public.major_event_instances TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.major_event_performances TO authenticated;
GRANT SELECT ON public.major_event_song_performances TO authenticated;
GRANT ALL ON public.major_events TO service_role;
GRANT ALL ON public.major_event_instances TO service_role;
GRANT ALL ON public.major_event_performances TO service_role;
GRANT ALL ON public.major_event_song_performances TO service_role;

SELECT public.generate_major_event_instances(6);
