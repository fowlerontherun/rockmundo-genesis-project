-- Make city Healthcare and Quality of Life affect the authoritative daily
-- wellness/recovery processor. Rating 50 remains neutral through the shared
-- city_gameplay_modifiers contract.

CREATE OR REPLACE FUNCTION public.process_daily_wellness(_profile_id uuid, _day date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p profiles%rowtype;
  new_energy int;
  new_fatigue int;
  new_nutrition int;
  new_stress int;
  new_sleep int;
  new_motivation int;
  new_burnout int;
  score int;
  state text;
  v_recovery_multiplier numeric := 1;
  v_ailment_recovery_step int;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = _profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF p.current_city_id IS NOT NULL THEN
    SELECT COALESCE(m.recovery_multiplier, 1)
    INTO v_recovery_multiplier
    FROM public.city_gameplay_modifiers(p.current_city_id) m;
  END IF;

  v_recovery_multiplier := LEAST(1.10, GREATEST(0.90, COALESCE(v_recovery_multiplier, 1)));

  IF p.wellness_last_processed_on IS NOT NULL AND p.wellness_last_processed_on >= _day THEN
    score := calculate_overall_wellness(p.energy, p.physical_health, p.happiness, p.stress, p.fatigue, p.sleep_quality, p.nutrition, p.fitness, p.motivation, p.burnout_risk);
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'overall_wellness', score,
      'state', wellness_state(score),
      'city_recovery_multiplier', v_recovery_multiplier
    );
  END IF;

  new_energy := least(100, greatest(0, coalesce(p.energy,80) + round(3 * v_recovery_multiplier)::int));
  new_fatigue := least(100, greatest(0, coalesce(p.fatigue,35) - round(4 * v_recovery_multiplier)::int));
  new_nutrition := least(100, greatest(0, coalesce(p.nutrition,68) - 3));
  new_stress := least(100, greatest(0, coalesce(p.stress,28) + 1));
  new_sleep := least(100, greatest(0, coalesce(p.sleep_quality,72) - 2));
  new_motivation := least(100, greatest(0, coalesce(p.motivation,72) + case when coalesce(p.happiness,72) > 70 then 1 else -1 end));
  new_burnout := least(100, greatest(0, coalesce(p.burnout_risk,18) + case when coalesce(p.stress,28) > 70 then 5 else -round(3 * v_recovery_multiplier)::int end + case when coalesce(p.fatigue,35) > 75 then 4 else 0 end));
  score := calculate_overall_wellness(new_energy, p.physical_health, p.happiness, new_stress, new_fatigue, new_sleep, new_nutrition, p.fitness, new_motivation, new_burnout);
  state := wellness_state(score);

  UPDATE profiles
  SET energy = new_energy,
      fatigue = new_fatigue,
      nutrition = new_nutrition,
      stress = new_stress,
      sleep_quality = new_sleep,
      motivation = new_motivation,
      burnout_risk = new_burnout,
      wellness_last_processed_on = _day,
      last_health_update = now()
  WHERE id = _profile_id;

  INSERT INTO wellness_history(user_id, profile_id, processed_on, overall_wellness, state, values, source)
  VALUES (
    p.user_id,
    p.id,
    _day,
    score,
    state,
    jsonb_build_object(
      'energy',new_energy,
      'physical_health',p.physical_health,
      'happiness',p.happiness,
      'stress',new_stress,
      'fatigue',new_fatigue,
      'sleep_quality',new_sleep,
      'nutrition',new_nutrition,
      'fitness',p.fitness,
      'motivation',new_motivation,
      'burnout_risk',new_burnout,
      'city_recovery_multiplier',v_recovery_multiplier
    ),
    'daily'
  )
  ON CONFLICT (profile_id, processed_on, source) DO NOTHING;

  v_ailment_recovery_step := GREATEST(
    1,
    ROUND((CASE WHEN new_fatigue < 50 THEN 26 ELSE 18 END) * v_recovery_multiplier)::int
  );

  UPDATE player_ailments
  SET recovery_progress = least(100, recovery_progress + v_ailment_recovery_step),
      resolved_at = CASE
        WHEN recovery_progress + v_ailment_recovery_step >= 100 THEN now()
        ELSE resolved_at
      END
  WHERE profile_id = _profile_id
    AND resolved_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'overall_wellness', score,
    'state', state,
    'city_recovery_multiplier', v_recovery_multiplier,
    'ailment_recovery_step', v_ailment_recovery_step
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[wellness_daily_processing_failure] profile_id=%, day=%, error=%', _profile_id, _day, sqlerrm;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_daily_wellness(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_daily_wellness(uuid, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
