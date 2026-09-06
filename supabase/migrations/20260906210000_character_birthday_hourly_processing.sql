-- Process accelerated-game birthdays server-side so notifications and event instances
-- are created even when a player is offline during their eight-hour birthday.

CREATE OR REPLACE FUNCTION public.process_character_birthdays()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g record;
  p public.profiles%rowtype;
  v_age integer;
  v_event public.birthday_event_catalog%rowtype;
  v_sxp integer;
  v_ap integer;
  v_processed integer := 0;
BEGIN
  SELECT * INTO g FROM public.rockmundo_game_date_at(now());

  FOR p IN
    SELECT *
    FROM public.profiles
    WHERE deleted_at IS NULL
      AND birth_game_month = g.game_month
      AND birth_game_day = g.game_day
  LOOP
    v_age := public.calculate_character_age(p.id, g.game_year, g.game_month, g.game_day);
    v_sxp := LEAST(1000, 500 + v_age * 5);
    v_ap := LEAST(10, 5 + FLOOR(v_age / 20.0)::integer);

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.profile_id = p.id
        AND n.type = 'birthday'
        AND n.metadata->>'game_year' = g.game_year::text
    ) THEN
      INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
      VALUES(
        p.user_id,
        p.id,
        'character',
        'birthday',
        '🎂 Happy Birthday!',
        format('You turned %s today. Your birthday reward is %s SXP + %s AP.', v_age, v_sxp, v_ap),
        '/character',
        jsonb_build_object('game_year', g.game_year, 'age', v_age, 'sxp', v_sxp, 'ap', v_ap)
      );
    END IF;

    IF v_age <= 100 AND NOT EXISTS (
      SELECT 1 FROM public.player_birthday_event_instances i
      WHERE i.profile_id = p.id AND i.game_year = g.game_year
    ) THEN
      SELECT * INTO v_event
      FROM public.birthday_event_catalog e
      WHERE e.is_active = true
        AND v_age BETWEEN e.min_age AND e.max_age
      ORDER BY md5(p.id::text || ':' || g.game_year::text || ':' || e.id::text)
      LIMIT 1;

      IF v_event.id IS NOT NULL THEN
        INSERT INTO public.player_birthday_event_instances(user_id, profile_id, game_year, age, event_id)
        VALUES(p.user_id, p.id, g.game_year, v_age, v_event.id)
        ON CONFLICT (profile_id, game_year) DO NOTHING;
      END IF;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'game_year', g.game_year,
    'game_month', g.game_month,
    'game_day', g.game_day,
    'birthdays_processed', v_processed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_character_birthdays() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_character_birthdays() TO service_role;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'process-character-birthdays-hourly'
  LIMIT 1;

  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'process-character-birthdays-hourly',
    '17 * * * *',
    'select public.process_character_birthdays();'
  );
END $$;
