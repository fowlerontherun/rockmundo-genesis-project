-- Fix perform_wellness_activity: don't block recovery/medical on low energy, and fix cash comparison
CREATE OR REPLACE FUNCTION public.perform_wellness_activity(_profile_id uuid, _catalog_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prof record;
  v_entry record;
  v_last record;
  v_day_count int;
  v_ind_count int;
  v_since timestamptz := now() - interval '24 hours';
  v_gate record;
  v_start timestamptz := now();
  v_end timestamptz;
  v_conflict boolean := false;
  v_eff jsonb;
  v_ail_risk jsonb;
  v_cooldown_until timestamptz;
  v_new jsonb;
  v_rolled text[] := ARRAY[]::text[];
  v_slug text;
  v_prob numeric;
  v_cash_delta int;
  v_life_mods jsonb;
  v_health_bonus int := 0;
  v_energy_bonus int := 0;
  v_mood_bonus int := 0;
  v_effective_stamina int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  IF _profile_id IS NULL OR _catalog_slug IS NULL THEN RAISE EXCEPTION 'profile_id and catalog_slug required'; END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = _profile_id;
  IF v_prof.id IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF v_prof.user_id <> v_uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_entry FROM public.wellness_activity_catalog WHERE slug = _catalog_slug AND is_active = true;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'activity not found'; END IF;

  IF COALESCE(v_prof.fame, 0) < COALESCE(v_entry.unlock_min_fame, 0) THEN
    RAISE EXCEPTION 'Locked until fame %', v_entry.unlock_min_fame;
  END IF;

  SELECT cooldown_until INTO v_last FROM public.wellness_activity_log
   WHERE profile_id = _profile_id AND catalog_slug = _catalog_slug
   ORDER BY performed_at DESC LIMIT 1;
  IF v_last.cooldown_until IS NOT NULL AND v_last.cooldown_until > now() THEN
    RAISE EXCEPTION 'On cooldown until %', v_last.cooldown_until;
  END IF;

  SELECT count(*) INTO v_day_count FROM public.wellness_activity_log
   WHERE profile_id = _profile_id AND performed_at >= v_since;
  IF v_day_count >= 8 THEN RAISE EXCEPTION 'Daily wellness action cap reached (8/day)'; END IF;

  IF v_entry.category = 'indulgence' THEN
    SELECT count(*) INTO v_ind_count FROM public.wellness_activity_log
     WHERE profile_id = _profile_id AND category = 'indulgence' AND performed_at >= v_since;
    IF v_ind_count >= 2 THEN RAISE EXCEPTION 'Only 2 indulgences per day'; END IF;
  END IF;

  -- Recovery and medical actions must remain accessible even when energy is low
  -- (a player with 0 energy still needs to sleep or see a doctor).
  v_effective_stamina := COALESCE(v_entry.stamina_cost, 0);
  IF v_entry.category IN ('recovery', 'medical') THEN
    v_effective_stamina := 0;
  END IF;

  IF COALESCE(v_prof.energy, 0) < v_effective_stamina THEN
    RAISE EXCEPTION 'Not enough energy (need %, have %)', v_effective_stamina, COALESCE(v_prof.energy, 0);
  END IF;

  -- Cash in profiles is stored as dollars/int; cost_cents is cents.
  IF COALESCE(v_entry.cost_cents, 0) > 0
     AND COALESCE(v_prof.cash, 0) < CEIL(v_entry.cost_cents / 100.0) THEN
    RAISE EXCEPTION 'Not enough cash';
  END IF;

  BEGIN
    -- Only gate performance-style activities. Never gate wellness recovery/medical/fitness self-care actions.
    IF v_entry.category NOT IN ('recovery', 'medical') THEN
      SELECT * INTO v_gate FROM public.evaluate_wellness_gate(_profile_id, 'wellness_' || v_entry.category);
      IF v_gate.allowed = false THEN RAISE EXCEPTION '%', COALESCE(v_gate.reason, 'blocked'); END IF;
    END IF;
  EXCEPTION WHEN undefined_function OR undefined_column THEN NULL;
  END;

  v_end := v_start + (COALESCE(v_entry.duration_minutes, 0) || ' minutes')::interval;

  IF COALESCE(v_entry.duration_minutes, 0) >= 120 AND COALESCE(v_entry.can_overlap, false) = false THEN
    BEGIN
      SELECT public.check_scheduling_conflict(v_uid, v_start, v_end, NULL) INTO v_conflict;
      IF v_conflict THEN RAISE EXCEPTION 'This overlaps another scheduled activity'; END IF;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END IF;

  v_eff := COALESCE(v_entry.stat_effects, '{}'::jsonb);
  v_cash_delta := (COALESCE(v_entry.cost_cents, 0) / 100)::int;

  v_life_mods := COALESCE(public.get_wellness_lifestyle_modifiers(_profile_id), '{}'::jsonb);
  v_health_bonus := COALESCE((v_life_mods->>'health_regen')::int, 0);
  v_energy_bonus := COALESCE((v_life_mods->>'energy_regen')::int, 0);
  v_mood_bonus   := COALESCE((v_life_mods->>'mood_regen')::int, 0);

  UPDATE public.profiles
  SET
    health = LEAST(100, GREATEST(0, COALESCE(health, 100) + COALESCE((v_eff ->> 'health')::int, (v_eff ->> 'physical_health')::int, 0) + v_health_bonus)),
    energy = LEAST(100, GREATEST(0, COALESCE(energy, 100) + COALESCE((v_eff ->> 'energy')::int, 0) - v_effective_stamina + v_energy_bonus)),
    mood = LEAST(100, GREATEST(0, COALESCE(mood, 70) + COALESCE((v_eff ->> 'mood')::int, (v_eff ->> 'happiness')::int, 0) + v_mood_bonus)),
    stress = LEAST(100, GREATEST(0, COALESCE(stress, 30) + COALESCE((v_eff ->> 'stress')::int, 0))),
    physical_health = LEAST(100, GREATEST(0, COALESCE(physical_health, health, 80) + COALESCE((v_eff ->> 'physical_health')::int, (v_eff ->> 'health')::int, 0) + v_health_bonus)),
    happiness = LEAST(100, GREATEST(0, COALESCE(happiness, mood, 72) + COALESCE((v_eff ->> 'happiness')::int, (v_eff ->> 'mood')::int, 0) + v_mood_bonus)),
    fatigue = LEAST(100, GREATEST(0, COALESCE(fatigue, 35) + COALESCE((v_eff ->> 'fatigue')::int, 0))),
    sleep_quality = LEAST(100, GREATEST(0, COALESCE(sleep_quality, 72) + COALESCE((v_eff ->> 'sleep_quality')::int, 0))),
    nutrition = LEAST(100, GREATEST(0, COALESCE(nutrition, 68) + COALESCE((v_eff ->> 'nutrition')::int, 0))),
    fitness = LEAST(100, GREATEST(0, COALESCE(fitness, 55) + COALESCE((v_eff ->> 'fitness')::int, 0))),
    motivation = LEAST(100, GREATEST(0, COALESCE(motivation, mood, 72) + COALESCE((v_eff ->> 'motivation')::int, 0))),
    burnout_risk = LEAST(100, GREATEST(0, COALESCE(burnout_risk, 18) + COALESCE((v_eff ->> 'burnout_risk')::int, 0))),
    cash = COALESCE(cash, 0) - v_cash_delta,
    last_health_update = now()
  WHERE id = _profile_id
  RETURNING to_jsonb(profiles.*) INTO v_new;

  v_new := jsonb_set(v_new, '{overall_wellness}',
    to_jsonb(LEAST(100, GREATEST(0, ROUND((
      COALESCE((v_new ->> 'health')::int, 80) +
      COALESCE((v_new ->> 'energy')::int, 80) +
      COALESCE((v_new ->> 'mood')::int, 72) +
      COALESCE((v_new ->> 'physical_health')::int, 80) +
      COALESCE((v_new ->> 'happiness')::int, 72) +
      COALESCE((v_new ->> 'sleep_quality')::int, 72) +
      COALESCE((v_new ->> 'nutrition')::int, 68) +
      COALESCE((v_new ->> 'fitness')::int, 55) +
      COALESCE((v_new ->> 'motivation')::int, 72) +
      (100 - COALESCE((v_new ->> 'stress')::int, 30)) +
      (100 - COALESCE((v_new ->> 'fatigue')::int, 35)) +
      (100 - COALESCE((v_new ->> 'burnout_risk')::int, 18))
    ) / 12.0)::int))));

  UPDATE public.profiles SET overall_wellness = (v_new ->> 'overall_wellness')::int WHERE id = _profile_id;

  v_cooldown_until := now() + (COALESCE(v_entry.cooldown_hours, 0) || ' hours')::interval;

  INSERT INTO public.wellness_activity_log
    (user_id, profile_id, catalog_id, catalog_slug, category, cooldown_until, stat_delta, cost_cents)
  VALUES
    (v_uid, _profile_id, v_entry.id, v_entry.slug, v_entry.category, v_cooldown_until, v_eff, COALESCE(v_entry.cost_cents, 0));

  IF v_entry.treats_ailment_slug IS NOT NULL THEN
    UPDATE public.player_ailments SET resolved_at = now()
    WHERE profile_id = _profile_id AND slug = v_entry.treats_ailment_slug AND resolved_at IS NULL;
  END IF;

  v_ail_risk := COALESCE(v_entry.ailment_risk, '{}'::jsonb);
  FOR v_slug, v_prob IN SELECT key, (value)::text::numeric FROM jsonb_each_text(v_ail_risk) LOOP
    IF random() < v_prob THEN
      v_rolled := array_append(v_rolled, v_slug);
      INSERT INTO public.player_ailments
        (user_id, profile_id, slug, name, severity, source, expected_recovery_at, description)
      VALUES
        (v_uid, _profile_id, v_slug, initcap(replace(v_slug, '_', ' ')), 2, v_entry.slug, now() + interval '72 hours', 'Contracted from ' || v_entry.name)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF COALESCE(v_entry.duration_minutes, 0) >= 60 THEN
    INSERT INTO public.player_scheduled_activities
      (user_id, profile_id, activity_type, scheduled_start, scheduled_end, duration_minutes, status, title, description, metadata)
    VALUES
      (v_uid, _profile_id, 'wellness_' || v_entry.category, v_start, v_end, v_entry.duration_minutes, 'in_progress', v_entry.name, v_entry.description,
       jsonb_build_object('wellness_catalog_slug', v_entry.slug, 'expected_benefits', v_entry.stat_effects));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'cooldown_until', v_cooldown_until,
    'lifestyle_bonus', jsonb_build_object('health', v_health_bonus, 'energy', v_energy_bonus, 'mood', v_mood_bonus),
    'new_stats', jsonb_build_object(
      'health', v_new -> 'health',
      'energy', v_new -> 'energy',
      'mood', v_new -> 'mood',
      'stress', v_new -> 'stress',
      'physical_health', v_new -> 'physical_health',
      'happiness', v_new -> 'happiness',
      'fatigue', v_new -> 'fatigue',
      'sleep_quality', v_new -> 'sleep_quality',
      'nutrition', v_new -> 'nutrition',
      'fitness', v_new -> 'fitness',
      'motivation', v_new -> 'motivation',
      'burnout_risk', v_new -> 'burnout_risk',
      'overall_wellness', v_new -> 'overall_wellness'
    ),
    'ailments_contracted', to_jsonb(v_rolled)
  );
END;
$function$;