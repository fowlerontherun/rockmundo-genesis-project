
-- Fix habits RPCs: profiles column is is_active, not is_active_character
CREATE OR REPLACE FUNCTION public.start_wellness_habit(_template_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_tpl record;
  v_habit_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id=v_uid AND is_active=true AND died_at IS NULL LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id=v_uid AND died_at IS NULL ORDER BY created_at LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;

  SELECT * INTO v_tpl FROM public.wellness_habit_templates WHERE slug=_template_slug AND is_active=true;
  IF v_tpl.slug IS NULL THEN RAISE EXCEPTION 'template not found'; END IF;

  INSERT INTO public.player_habits (user_id, profile_id, template_slug, name, description, category, target_per_week, is_active, current_streak, best_streak)
  VALUES (v_uid, v_profile_id, v_tpl.slug, v_tpl.name, v_tpl.description, v_tpl.category, v_tpl.target_per_week, true, 0, 0)
  RETURNING id INTO v_habit_id;
  RETURN v_habit_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_wellness_habit(_habit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habit record;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_habit FROM public.player_habits WHERE id=_habit_id AND user_id=v_uid;
  IF v_habit.id IS NULL THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF v_habit.last_completed_date = v_today THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already completed today');
  END IF;
  IF v_habit.last_completed_date = v_today - 1 THEN
    v_new_streak := COALESCE(v_habit.current_streak,0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;
  UPDATE public.player_habits
     SET current_streak = v_new_streak,
         best_streak = GREATEST(COALESCE(best_streak,0), v_new_streak),
         last_completed_date = v_today,
         updated_at = now()
   WHERE id=_habit_id;
  RETURN jsonb_build_object('ok', true, 'streak', v_new_streak);
END $$;

CREATE OR REPLACE FUNCTION public.stop_wellness_habit(_habit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.player_habits SET is_active=false, updated_at=now() WHERE id=_habit_id AND user_id=auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.start_wellness_habit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wellness_habit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_wellness_habit(uuid) TO authenticated;

-- Replace edge function with a Postgres RPC (edge function quota reached)
CREATE OR REPLACE FUNCTION public.perform_wellness_activity(_profile_id uuid, _catalog_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  v_conflict boolean;
  v_eff jsonb;
  v_ail_risk jsonb;
  v_cooldown_until timestamptz;
  v_new jsonb;
  v_rolled text[] := ARRAY[]::text[];
  v_slug text;
  v_prob numeric;
  v_ailment record;
  v_cash_delta int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  IF _profile_id IS NULL OR _catalog_slug IS NULL THEN RAISE EXCEPTION 'profile_id and catalog_slug required'; END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id=_profile_id;
  IF v_prof.id IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF v_prof.user_id <> v_uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_entry FROM public.wellness_activity_catalog WHERE slug=_catalog_slug AND is_active=true;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'activity not found'; END IF;

  IF COALESCE(v_prof.fame,0) < v_entry.unlock_min_fame THEN
    RAISE EXCEPTION 'Locked until fame %', v_entry.unlock_min_fame;
  END IF;

  SELECT cooldown_until INTO v_last FROM public.wellness_activity_log
    WHERE profile_id=_profile_id AND catalog_slug=_catalog_slug
    ORDER BY performed_at DESC LIMIT 1;
  IF v_last.cooldown_until IS NOT NULL AND v_last.cooldown_until > now() THEN
    RAISE EXCEPTION 'On cooldown until %', v_last.cooldown_until;
  END IF;

  SELECT count(*) INTO v_day_count FROM public.wellness_activity_log
    WHERE profile_id=_profile_id AND performed_at >= v_since;
  IF v_day_count >= 8 THEN RAISE EXCEPTION 'Daily wellness action cap reached (8/day)'; END IF;

  IF v_entry.category = 'indulgence' THEN
    SELECT count(*) INTO v_ind_count FROM public.wellness_activity_log
      WHERE profile_id=_profile_id AND category='indulgence' AND performed_at >= v_since;
    IF v_ind_count >= 2 THEN RAISE EXCEPTION 'Only 2 indulgences per day'; END IF;
  END IF;

  IF COALESCE(v_prof.energy,0) < v_entry.stamina_cost THEN
    RAISE EXCEPTION 'Not enough energy (need %, have %)', v_entry.stamina_cost, COALESCE(v_prof.energy,0);
  END IF;
  IF v_entry.cost_cents > 0 AND COALESCE(v_prof.cash,0)*100 < v_entry.cost_cents THEN
    RAISE EXCEPTION 'Not enough cash';
  END IF;

  BEGIN
    SELECT * INTO v_gate FROM public.evaluate_wellness_gate(_profile_id, 'wellness_'||v_entry.category);
    IF v_gate.allowed = false THEN
      RAISE EXCEPTION '%', COALESCE(v_gate.reason, 'blocked');
    END IF;
  EXCEPTION WHEN undefined_function OR undefined_column THEN NULL;
  END;

  v_end := v_start + (v_entry.duration_minutes || ' minutes')::interval;

  IF v_entry.duration_minutes >= 120 AND COALESCE(v_entry.can_overlap,false) = false THEN
    BEGIN
      SELECT public.check_scheduling_conflict(v_uid, v_start, v_end, NULL) INTO v_conflict;
      IF v_conflict THEN RAISE EXCEPTION 'This overlaps another scheduled activity'; END IF;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END IF;

  v_eff := COALESCE(v_entry.stat_effects, '{}'::jsonb);
  v_cash_delta := (v_entry.cost_cents/100)::int;

  UPDATE public.profiles SET
    health = LEAST(100, GREATEST(0, COALESCE(health,100) + COALESCE((v_eff->>'health')::int, (v_eff->>'physical_health')::int, 0))),
    energy = LEAST(100, GREATEST(0, COALESCE(energy,100) + COALESCE((v_eff->>'energy')::int, 0) - v_entry.stamina_cost)),
    mood = LEAST(100, GREATEST(0, COALESCE(mood,70) + COALESCE((v_eff->>'mood')::int, (v_eff->>'happiness')::int, 0))),
    stress = LEAST(100, GREATEST(0, COALESCE(stress,30) + COALESCE((v_eff->>'stress')::int, 0))),
    physical_health = LEAST(100, GREATEST(0, COALESCE(physical_health, health, 80) + COALESCE((v_eff->>'physical_health')::int, (v_eff->>'health')::int, 0))),
    happiness = LEAST(100, GREATEST(0, COALESCE(happiness, mood, 72) + COALESCE((v_eff->>'happiness')::int, (v_eff->>'mood')::int, 0))),
    fatigue = LEAST(100, GREATEST(0, COALESCE(fatigue,35) + COALESCE((v_eff->>'fatigue')::int, 0))),
    sleep_quality = LEAST(100, GREATEST(0, COALESCE(sleep_quality,72) + COALESCE((v_eff->>'sleep_quality')::int, 0))),
    nutrition = LEAST(100, GREATEST(0, COALESCE(nutrition,68) + COALESCE((v_eff->>'nutrition')::int, 0))),
    fitness = LEAST(100, GREATEST(0, COALESCE(fitness,55) + COALESCE((v_eff->>'fitness')::int, 0))),
    motivation = LEAST(100, GREATEST(0, COALESCE(motivation, mood, 72) + COALESCE((v_eff->>'motivation')::int, 0))),
    burnout_risk = LEAST(100, GREATEST(0, COALESCE(burnout_risk,18) + COALESCE((v_eff->>'burnout_risk')::int, 0))),
    cash = COALESCE(cash,0) - v_cash_delta,
    last_health_update = now()
  WHERE id=_profile_id
  RETURNING to_jsonb(profiles.*) INTO v_new;

  v_cooldown_until := now() + (v_entry.cooldown_hours || ' hours')::interval;

  INSERT INTO public.wellness_activity_log
    (user_id, profile_id, catalog_id, catalog_slug, category, cooldown_until, stat_delta, cost_cents)
  VALUES (v_uid, _profile_id, v_entry.id, v_entry.slug, v_entry.category, v_cooldown_until, v_eff, v_entry.cost_cents);

  IF v_entry.treats_ailment_slug IS NOT NULL THEN
    UPDATE public.player_ailments SET resolved_at = now()
     WHERE profile_id=_profile_id AND slug=v_entry.treats_ailment_slug AND resolved_at IS NULL;
  END IF;

  v_ail_risk := COALESCE(v_entry.ailment_risk, '{}'::jsonb);
  FOR v_slug, v_prob IN SELECT key, (value)::text::numeric FROM jsonb_each_text(v_ail_risk) LOOP
    IF random() < v_prob THEN
      v_rolled := array_append(v_rolled, v_slug);
      INSERT INTO public.player_ailments (user_id, profile_id, slug, name, severity, source, expected_recovery_at, description)
      VALUES (v_uid, _profile_id, v_slug, initcap(replace(v_slug,'_',' ')), 2, v_entry.slug, now() + interval '72 hours', 'Contracted from '||v_entry.name)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF v_entry.duration_minutes >= 60 THEN
    INSERT INTO public.player_scheduled_activities
      (user_id, profile_id, activity_type, scheduled_start, scheduled_end, duration_minutes, status, title, description, metadata)
    VALUES (v_uid, _profile_id, 'wellness_'||v_entry.category, v_start, v_end, v_entry.duration_minutes, 'in_progress', v_entry.name, v_entry.description,
      jsonb_build_object('wellness_catalog_slug', v_entry.slug, 'expected_benefits', v_entry.stat_effects));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'cooldown_until', v_cooldown_until,
    'new_stats', jsonb_build_object(
      'health', v_new->'health','energy',v_new->'energy','mood',v_new->'mood','stress',v_new->'stress',
      'physical_health',v_new->'physical_health','happiness',v_new->'happiness','fatigue',v_new->'fatigue',
      'sleep_quality',v_new->'sleep_quality','nutrition',v_new->'nutrition','fitness',v_new->'fitness',
      'motivation',v_new->'motivation','burnout_risk',v_new->'burnout_risk'
    ),
    'ailments_contracted', to_jsonb(v_rolled)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.perform_wellness_activity(uuid, text) TO authenticated;
