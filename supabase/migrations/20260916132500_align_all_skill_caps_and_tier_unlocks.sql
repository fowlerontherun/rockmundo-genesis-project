-- Align every skill XP path with the canonical per-skill cap.

UPDATE public.skill_parent_links spl
SET unlock_threshold = public.progression_skill_max_level(parent.slug::text)
FROM public.skill_definitions parent
WHERE parent.id = spl.parent_skill_id
  AND spl.unlock_threshold IS NOT NULL
  AND spl.unlock_threshold > public.progression_skill_max_level(parent.slug::text);

CREATE OR REPLACE FUNCTION public.skill_tier_unlocked(p_profile_id uuid, p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caps jsonb;
  v_prereq text;
  v_required_level integer;
  v_level integer;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN RETURN true; END IF;

  SELECT sd.tier_caps INTO v_caps
  FROM public.skill_definitions sd
  WHERE sd.slug::text = p_slug
  LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;

  IF coalesce(v_caps->>'requires', '') <> '' THEN
    v_prereq := v_caps->>'requires';
    v_required_level := CASE
      WHEN (v_caps->>'required_level') ~ '^[0-9]+$'
        THEN greatest(1, (v_caps->>'required_level')::integer)
      ELSE public.progression_skill_max_level(v_prereq)
    END;

    SELECT sp.current_level INTO v_level
    FROM public.skill_progress sp
    WHERE sp.profile_id = p_profile_id
      AND sp.skill_slug = v_prereq;

    RETURN coalesce(v_level, 0) >= v_required_level;
  END IF;

  IF position('_basic_' in p_slug) > 0 THEN
    RETURN true;
  ELSIF position('_professional_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_professional_', '_basic_');
  ELSIF position('_mastery_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_mastery_', '_professional_');
  ELSE
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_prereq
  ) THEN
    RETURN false;
  END IF;

  v_required_level := public.progression_skill_max_level(v_prereq);

  SELECT sp.current_level INTO v_level
  FROM public.skill_progress sp
  WHERE sp.profile_id = p_profile_id
    AND sp.skill_slug = v_prereq;

  RETURN coalesce(v_level, 0) >= v_required_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public._d10_award_skill_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v public.skill_progress%rowtype;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_max integer;
BEGIN
  IF p_xp <= 0 THEN RAISE EXCEPTION 'xp must be positive'; END IF;
  IF NOT public.skill_tier_unlocked(p_profile_id, p_skill_slug) THEN
    RAISE EXCEPTION 'skill is locked';
  END IF;

  v_max := public.progression_skill_max_level(p_skill_slug);

  SELECT * INTO v
  FROM public.skill_progress
  WHERE profile_id = p_profile_id
    AND skill_slug = p_skill_slug
    AND coalesce(current_level, 0) >= 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'skill is not unlocked'; END IF;

  v_level := least(greatest(coalesce(v.current_level, 1), 0), v_max);
  v_xp := greatest(coalesce(v.current_xp, 0), 0);

  IF v_level >= v_max THEN
    UPDATE public.skill_progress
    SET current_level = v_max,
        current_xp = 0,
        required_xp = 0,
        last_practiced_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v.id
    RETURNING * INTO v;
    RETURN to_jsonb(v);
  END IF;

  v_xp := v_xp + p_xp;
  v_required := coalesce(nullif(v.required_xp, 0), public.progression_skill_required_xp(v_level));

  WHILE v_level < v_max AND v_xp >= v_required LOOP
    v_xp := v_xp - v_required;
    v_level := v_level + 1;
    IF v_level < v_max THEN
      v_required := public.progression_skill_required_xp(v_level);
    END IF;
  END LOOP;

  IF v_level >= v_max THEN
    v_level := v_max;
    v_xp := 0;
    v_required := 0;
  END IF;

  UPDATE public.skill_progress
  SET current_level = v_level,
      current_xp = v_xp,
      required_xp = v_required,
      last_practiced_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = v.id
  RETURNING * INTO v;

  RETURN to_jsonb(v);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_skill_practice(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_activity public.player_scheduled_activities%ROWTYPE;
  v_progress public.skill_progress%ROWTYPE;
  v_slug text;
  v_reward constant integer := 5;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_max integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.player_scheduled_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND OR v_activity.activity_type <> 'skill_practice' THEN
    RAISE EXCEPTION 'invalid practice activity' USING ERRCODE='P0001';
  END IF;
  IF v_activity.status IN ('cancelled', 'missed') THEN
    RAISE EXCEPTION 'practice was not completed' USING ERRCODE='P0001';
  END IF;
  IF v_activity.scheduled_end > timezone('utc', now()) THEN
    RAISE EXCEPTION 'practice has not ended' USING ERRCODE='P0001';
  END IF;

  v_slug := COALESCE(v_activity.metadata->>'skillSlug', v_activity.metadata->>'skill_slug');
  IF v_slug IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.skill_definitions WHERE slug::text = v_slug
  ) THEN
    RAISE EXCEPTION 'invalid practice skill metadata' USING ERRCODE='P0001';
  END IF;
  IF NOT public.skill_tier_unlocked(v_activity.profile_id, v_slug) THEN
    RAISE EXCEPTION 'practiced skill is locked' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_practice_reward_ledger WHERE activity_id = p_activity_id
  ) THEN
    SELECT * INTO v_progress FROM public.skill_progress
    WHERE profile_id = v_activity.profile_id AND skill_slug = v_slug;
    RETURN jsonb_build_object('already_rewarded', true, 'xp_awarded', v_reward, 'skill_progress', to_jsonb(v_progress));
  END IF;

  SELECT * INTO v_progress
  FROM public.skill_progress
  WHERE profile_id = v_activity.profile_id
    AND skill_slug = v_slug
    AND current_level >= 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'practiced skill is no longer unlocked' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.skill_practice_reward_ledger(activity_id, profile_id, skill_slug, xp_awarded, idempotency_key)
  VALUES (p_activity_id, v_activity.profile_id, v_slug, v_reward, 'skill-practice:' || p_activity_id);

  v_max := public.progression_skill_max_level(v_slug);
  v_level := least(greatest(coalesce(v_progress.current_level, 0), 0), v_max);
  v_xp := greatest(coalesce(v_progress.current_xp, 0), 0);

  IF v_level < v_max THEN
    v_xp := v_xp + v_reward;
    v_required := coalesce(nullif(v_progress.required_xp, 0), public.progression_skill_required_xp(v_level));
    WHILE v_level < v_max AND v_xp >= v_required LOOP
      v_xp := v_xp - v_required;
      v_level := v_level + 1;
      IF v_level < v_max THEN
        v_required := public.progression_skill_required_xp(v_level);
      END IF;
    END LOOP;
  END IF;

  IF v_level >= v_max THEN
    v_level := v_max;
    v_xp := 0;
    v_required := 0;
  END IF;

  UPDATE public.skill_progress
  SET current_level = v_level,
      current_xp = v_xp,
      required_xp = v_required,
      last_practiced_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = v_progress.id
  RETURNING * INTO v_progress;

  UPDATE public.player_scheduled_activities
  SET status = 'completed',
      completed_at = timezone('utc', now()),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('practiceRewarded', true)
  WHERE id = p_activity_id;

  RETURN jsonb_build_object('already_rewarded', false, 'xp_awarded', v_reward, 'skill_progress', to_jsonb(v_progress));
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_active_practice_session(
  p_profile_id uuid,
  p_instrument_slug text,
  p_song_id uuid,
  p_song_title text,
  p_level_reached integer,
  p_score integer,
  p_longest_combo integer,
  p_notes_hit integer,
  p_notes_missed integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_sessions_today integer := 0;
  v_xp_today integer := 0;
  v_accuracy integer;
  v_level integer;
  v_base integer := 25;
  v_level_bonus integer;
  v_accuracy_bonus integer;
  v_combo_bonus integer;
  v_total integer;
  v_factor numeric := 1;
  v_awarded integer;
  v_skill public.skill_progress%rowtype;
  v_new_xp integer;
  v_required integer;
  v_new_level integer;
  v_difficulty text;
  v_max integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='P0001'; END IF;
  IF p_instrument_slug NOT IN ('guitar','bass','drums','vocals','basic_keyboard','basic_strings','basic_percussions','basic_electronic_instruments') THEN
    RAISE EXCEPTION 'Unsupported practice instrument.' USING ERRCODE='P0001';
  END IF;
  IF coalesce(p_notes_hit,0) < 0 OR coalesce(p_notes_missed,0) < 0 OR coalesce(p_longest_combo,0) < 0 THEN
    RAISE EXCEPTION 'Invalid practice result.' USING ERRCODE='P0001';
  END IF;
  IF coalesce(p_notes_hit,0)+coalesce(p_notes_missed,0)=0 THEN RAISE EXCEPTION 'No scored notes were recorded.' USING ERRCODE='P0001'; END IF;
  IF p_longest_combo > p_notes_hit THEN RAISE EXCEPTION 'Combo cannot exceed notes hit.' USING ERRCODE='P0001'; END IF;

  PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This character is not available.' USING ERRCODE='P0001'; END IF;
  IF NOT public.skill_tier_unlocked(p_profile_id, p_instrument_slug) THEN
    RAISE EXCEPTION 'Practice skill is locked.' USING ERRCODE='P0001';
  END IF;

  v_level := greatest(1, least(coalesce(p_level_reached,1), floor(coalesce(p_notes_hit,0)/8.0)::integer+1));
  v_accuracy := round((p_notes_hit::numeric/greatest(1,p_notes_hit+p_notes_missed))*100)::integer;
  SELECT count(*), coalesce(sum(xp_earned),0) INTO v_sessions_today,v_xp_today
  FROM public.stage_practice_sessions
  WHERE profile_id=p_profile_id AND played_at>=date_trunc('day',now());

  v_level_bonus := v_level*12;
  v_accuracy_bonus := round(v_accuracy*0.6);
  v_combo_bonus := round(p_longest_combo*0.5);
  v_total := v_base+v_level_bonus+v_accuracy_bonus+v_combo_bonus;
  IF v_sessions_today>=4 THEN
    v_factor:=greatest(0.2,1-((v_sessions_today-4)*0.25));
    v_total:=round(v_total*v_factor);
  END IF;
  v_awarded:=greatest(0,least(v_total,750-v_xp_today));

  SELECT * INTO v_skill
  FROM public.skill_progress
  WHERE profile_id=p_profile_id AND skill_slug=p_instrument_slug
  FOR UPDATE;

  IF FOUND THEN
    v_max := public.progression_skill_max_level(p_instrument_slug);
    v_new_level := least(greatest(coalesce(v_skill.current_level,0),0),v_max);
    v_new_xp := greatest(coalesce(v_skill.current_xp,0),0);

    IF v_new_level < v_max THEN
      v_new_xp := v_new_xp + v_awarded;
      v_required := coalesce(nullif(v_skill.required_xp,0), public.progression_skill_required_xp(v_new_level));
      WHILE v_new_level < v_max AND v_new_xp >= v_required LOOP
        v_new_xp := v_new_xp-v_required;
        v_new_level := v_new_level+1;
        IF v_new_level < v_max THEN
          v_required := public.progression_skill_required_xp(v_new_level);
        END IF;
      END LOOP;
    END IF;

    IF v_new_level >= v_max THEN
      v_new_level := v_max;
      v_new_xp := 0;
      v_required := 0;
    END IF;

    UPDATE public.skill_progress
    SET current_xp=v_new_xp,
        current_level=v_new_level,
        required_xp=v_required,
        last_practiced_at=now(),
        updated_at=now()
    WHERE id=v_skill.id;
  END IF;

  SELECT CASE
    WHEN coalesce(current_level,0)<=3 THEN 'beginner'
    WHEN coalesce(current_level,0)<=8 THEN 'intermediate'
    WHEN coalesce(current_level,0)<=14 THEN 'advanced'
    ELSE 'master'
  END INTO v_difficulty
  FROM public.skill_progress
  WHERE profile_id=p_profile_id AND skill_slug=p_instrument_slug;
  v_difficulty:=coalesce(v_difficulty,'beginner');

  INSERT INTO public.stage_practice_sessions(user_id,profile_id,instrument_slug,song_id,song_title,level_reached,score,accuracy_pct,longest_combo,notes_hit,notes_missed,xp_earned,difficulty)
  VALUES(v_user,p_profile_id,p_instrument_slug,p_song_id,coalesce(nullif(trim(p_song_title),''),'Practice Track'),v_level,greatest(0,coalesce(p_score,0)),v_accuracy,p_longest_combo,p_notes_hit,p_notes_missed,v_awarded,v_difficulty);

  RETURN jsonb_build_object('awarded',true,'sessions_today',v_sessions_today+1,'xp_today',v_xp_today+v_awarded,'base_xp',v_base,'level_bonus',v_level_bonus,'accuracy_bonus',v_accuracy_bonus,'combo_bonus',v_combo_bonus,'total_xp',v_total,'actual_xp_awarded',v_awarded,'accuracy',v_accuracy,'level_reached',v_level,'diminishing',v_factor<1,'daily_cap_hit',v_awarded<v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_university_course_tier_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_slug text;
BEGIN
  SELECT uc.skill_slug INTO v_slug
  FROM public.university_courses uc
  WHERE uc.id = NEW.course_id;

  IF v_slug IS NULL THEN RETURN NEW; END IF;

  IF NOT public.skill_tier_unlocked(NEW.profile_id, v_slug) THEN
    RAISE EXCEPTION 'university_course_prerequisite_not_met:%', v_slug
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
