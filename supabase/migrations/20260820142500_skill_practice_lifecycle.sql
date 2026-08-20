-- Server-authoritative skill-practice booking and reward lifecycle.

CREATE TABLE public.skill_practice_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.player_scheduled_activities(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  skill_slug text NOT NULL,
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0),
  idempotency_key text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT skill_practice_reward_activity_unique UNIQUE (activity_id),
  CONSTRAINT skill_practice_reward_idempotency_unique UNIQUE (idempotency_key)
);

ALTER TABLE public.skill_practice_reward_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their practice rewards"
  ON public.skill_practice_reward_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.check_profile_scheduling_conflict(
  p_profile_id uuid, p_start timestamptz, p_end timestamptz, p_exclude_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_scheduled_activities a
    WHERE a.profile_id = p_profile_id
      AND a.status IN ('scheduled', 'in_progress')
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND tstzrange(a.scheduled_start, a.scheduled_end, '[)') && tstzrange(p_start, p_end, '[)')
  );
$$;

REVOKE ALL ON FUNCTION public.check_profile_scheduling_conflict(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_profile_scheduling_conflict(uuid,timestamptz,timestamptz,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.schedule_skill_practice(
  p_profile_id uuid, p_skill_slug text, p_scheduled_start timestamptz, p_scheduled_end timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count integer;
  v_activity public.player_scheduled_activities%ROWTYPE;
  v_gate record;
  v_skill_name text;
BEGIN
  IF p_scheduled_start <= timezone('utc', now()) OR p_scheduled_end <= p_scheduled_start
     OR p_scheduled_end - p_scheduled_start <> interval '1 hour' THEN
    RAISE EXCEPTION 'PRACTICE_PAST: choose a valid future one-hour slot' USING ERRCODE='P0001';
  END IF;

  SELECT p.user_id INTO v_user_id FROM public.profiles p
  WHERE p.id=p_profile_id AND p.user_id=auth.uid() AND p.is_active=true AND p.died_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRACTICE_PROFILE: active profile required' USING ERRCODE='P0001'; END IF;

  SELECT sd.display_name INTO v_skill_name FROM public.skill_definitions sd
  JOIN public.skill_progress sp ON sp.skill_slug=sd.slug AND sp.profile_id=p_profile_id
  WHERE sd.slug=p_skill_slug AND sp.current_level >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRACTICE_SKILL: skill is invalid or locked' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_gate FROM public.evaluate_wellness_gate(p_profile_id, 'training') LIMIT 1;
  IF v_gate.allowed IS FALSE THEN
    RAISE EXCEPTION 'PRACTICE_WELLNESS: %', COALESCE(v_gate.reason, 'training unavailable') USING ERRCODE='P0001';
  END IF;

  -- Serialize all bookings for this character/day so cap and conflict checks are atomic.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || (p_scheduled_start AT TIME ZONE 'UTC')::date::text, 0));

  IF public.check_profile_scheduling_conflict(p_profile_id,p_scheduled_start,p_scheduled_end,NULL) THEN
    RAISE EXCEPTION 'PRACTICE_CONFLICT: time slot occupied' USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO v_count FROM public.player_scheduled_activities a
  WHERE a.profile_id=p_profile_id AND a.activity_type='skill_practice'
    AND a.status IN ('scheduled','in_progress','completed')
    AND a.scheduled_start >= ((p_scheduled_start AT TIME ZONE 'UTC')::date AT TIME ZONE 'UTC')
    AND a.scheduled_start < (((p_scheduled_start AT TIME ZONE 'UTC')::date + 1) AT TIME ZONE 'UTC');
  IF v_count >= 5 THEN RAISE EXCEPTION 'PRACTICE_DAILY_CAP: daily limit reached' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.player_scheduled_activities
    (user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title,description,metadata)
  VALUES (v_user_id,p_profile_id,'skill_practice',p_scheduled_start,p_scheduled_end,'scheduled',
    'Practice '||v_skill_name,'Skill practice session for '||v_skill_name,
    jsonb_build_object('isPractice',true,'skillSlug',p_skill_slug,'skillName',v_skill_name))
  RETURNING * INTO v_activity;
  RETURN jsonb_build_object('activity_id',v_activity.id,'sessions_remaining',4-v_count,
    'practice_date',(p_scheduled_start AT TIME ZONE 'UTC')::date);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_skill_practice(uuid,text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_skill_practice(uuid,text,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_skill_practice(p_activity_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_activity public.player_scheduled_activities%ROWTYPE;
  v_progress public.skill_progress%ROWTYPE;
  v_slug text;
  v_reward constant integer := 5;
  v_level integer;
  v_xp integer;
  v_required integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_activity FROM public.player_scheduled_activities WHERE id=p_activity_id FOR UPDATE;
  IF NOT FOUND OR v_activity.activity_type <> 'skill_practice' THEN RAISE EXCEPTION 'invalid practice activity' USING ERRCODE='P0001'; END IF;
  IF v_activity.status IN ('cancelled','missed') THEN RAISE EXCEPTION 'practice was not completed' USING ERRCODE='P0001'; END IF;
  IF v_activity.scheduled_end > timezone('utc',now()) THEN RAISE EXCEPTION 'practice has not ended' USING ERRCODE='P0001'; END IF;

  IF EXISTS (SELECT 1 FROM public.skill_practice_reward_ledger WHERE activity_id=p_activity_id) THEN
    SELECT * INTO v_progress FROM public.skill_progress
      WHERE profile_id=v_activity.profile_id AND skill_slug=v_activity.metadata->>'skillSlug';
    RETURN jsonb_build_object('already_rewarded',true,'xp_awarded',v_reward,'skill_progress',to_jsonb(v_progress));
  END IF;

  v_slug := v_activity.metadata->>'skillSlug';
  IF v_slug IS NULL OR NOT EXISTS (SELECT 1 FROM public.skill_definitions WHERE slug=v_slug) THEN
    RAISE EXCEPTION 'invalid practice skill metadata' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_progress FROM public.skill_progress
    WHERE profile_id=v_activity.profile_id AND skill_slug=v_slug AND current_level >= 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'practiced skill is no longer unlocked' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.skill_practice_reward_ledger(activity_id,profile_id,skill_slug,xp_awarded,idempotency_key)
  VALUES (p_activity_id,v_activity.profile_id,v_slug,v_reward,'skill-practice:'||p_activity_id);

  v_level := v_progress.current_level; v_xp := COALESCE(v_progress.current_xp,0)+v_reward;
  v_required := COALESCE(NULLIF(v_progress.required_xp,0),public.progression_skill_required_xp(v_level));
  WHILE v_xp >= v_required LOOP
    v_xp := v_xp-v_required; v_level := v_level+1;
    v_required := public.progression_skill_required_xp(v_level);
  END LOOP;
  UPDATE public.skill_progress SET current_level=v_level,current_xp=v_xp,required_xp=v_required,
    last_practiced_at=timezone('utc',now()),updated_at=timezone('utc',now())
  WHERE id=v_progress.id RETURNING * INTO v_progress;
  UPDATE public.player_scheduled_activities SET status='completed',completed_at=timezone('utc',now()),
    metadata=COALESCE(metadata,'{}')||jsonb_build_object('practiceRewarded',true)
  WHERE id=p_activity_id;
  RETURN jsonb_build_object('already_rewarded',false,'xp_awarded',v_reward,'skill_progress',to_jsonb(v_progress));
END;
$$;

REVOKE ALL ON FUNCTION public.complete_skill_practice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_skill_practice(uuid) TO service_role;
