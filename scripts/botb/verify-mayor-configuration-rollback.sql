-- Rollback-only verification of mayor-authorized BOTB configuration changes.
-- It finds an active mayor, changes one city's weekday, frequency and prize,
-- verifies the city-specific update, then rolls EVERYTHING back.
-- Never remove the intentional named rollback exception.
DO $mayor_botb_smoke$
DECLARE
  v_mayor record;
  v_weekday integer;
  v_frequency integer;
  v_prize integer;
  v_before_total integer;
  v_after_total integer;
  v_before_entered integer;
  v_after_entered integer;
BEGIN
  SELECT cm.city_id,p.user_id,s.weekday,s.frequency_weeks,s.prize_money
  INTO v_mayor
  FROM public.city_mayors cm
  JOIN public.profiles p ON p.id=cm.profile_id
  JOIN public.botb_city_settings s ON s.city_id=cm.city_id
  WHERE cm.is_current AND (cm.term_end IS NULL OR cm.term_end>now())
    AND p.user_id IS NOT NULL
  ORDER BY cm.term_start DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_NO_ACTIVE_MAYOR_FOR_TEST'; END IF;

  v_weekday:=(v_mayor.weekday+1)%7;
  v_frequency:=CASE WHEN v_mayor.frequency_weeks=4 THEN 1 ELSE 4 END;
  v_prize:=CASE WHEN v_mayor.prize_money=7500 THEN 10000 ELSE 7500 END;

  SELECT count(*) INTO v_before_total FROM public.botb_events
  WHERE status='upcoming';
  SELECT count(*) INTO v_before_entered FROM public.botb_events e
  WHERE e.status='upcoming'
    AND EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id);

  BEGIN
    PERFORM set_config('request.jwt.claim.sub',v_mayor.user_id::text,true);
    PERFORM public.configure_city_botb(v_mayor.city_id,v_weekday,v_frequency,v_prize);

    IF NOT EXISTS(
      SELECT 1 FROM public.botb_city_settings s
      WHERE s.city_id=v_mayor.city_id AND s.weekday=v_weekday
        AND s.frequency_weeks=v_frequency AND s.prize_money=v_prize
    ) THEN RAISE EXCEPTION 'BOTB_MAYOR_TEST_SETTINGS_DID_NOT_CHANGE'; END IF;

    IF NOT EXISTS(
      SELECT 1 FROM public.botb_events e
      JOIN public.cities c ON c.id=e.city_id
      WHERE e.city_id=v_mayor.city_id AND e.status='upcoming'
        AND e.prize_money=v_prize
        AND extract(dow from (e.scheduled_date AT TIME ZONE c.timezone))::integer=v_weekday
    ) THEN RAISE EXCEPTION 'BOTB_MAYOR_TEST_EVENT_DID_NOT_REGENERATE'; END IF;

    RAISE EXCEPTION 'BOTB_MAYOR_SMOKE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'BOTB_MAYOR_SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  IF NOT EXISTS(
    SELECT 1 FROM public.botb_city_settings s
    WHERE s.city_id=v_mayor.city_id
      AND s.weekday=v_mayor.weekday
      AND s.frequency_weeks=v_mayor.frequency_weeks
      AND s.prize_money=v_mayor.prize_money
  ) THEN RAISE EXCEPTION 'BOTB_MAYOR_SETTINGS_ROLLBACK_LEAK'; END IF;

  SELECT count(*) INTO v_after_total FROM public.botb_events
  WHERE status='upcoming';
  SELECT count(*) INTO v_after_entered FROM public.botb_events e
  WHERE e.status='upcoming'
    AND EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id);
  IF v_before_total<>v_after_total OR v_before_entered<>v_after_entered
  THEN RAISE EXCEPTION 'BOTB_MAYOR_EVENTS_ROLLBACK_LEAK'; END IF;
END;
$mayor_botb_smoke$;
SELECT 'PASS' AS rollback_safe_mayor_configuration;
