-- Server-side professor XP application for the atomic auto-attendance award path.
-- Manual attendance is routed through the trusted university-manual-attendance Edge Function.
-- Atomic university attendance reward; one transactional RPC owns all core awards.
CREATE OR REPLACE FUNCTION public.record_university_attendance_reward(
  p_enrollment_id uuid,
  p_attendance_date date,
  p_xp integer,
  p_remote boolean,
  p_connection_failed boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e public.player_university_enrollments%ROWTYPE;
  c public.university_courses%ROWTYPE;
  sp public.skill_progress%ROWTYPE;
  v_max integer;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_completed boolean;
  v_user uuid;
  v_experience numeric;
  v_awarded_xp integer;
  v_professor_bonus numeric;
BEGIN
  IF p_attendance_date IS NULL OR p_attendance_date > (now() AT TIME ZONE 'UTC')::date
     OR p_xp IS NULL OR p_xp < 1 OR p_xp > 100000
  THEN RAISE EXCEPTION 'invalid university attendance reward' USING ERRCODE='22023'; END IF;

  SELECT * INTO e FROM public.player_university_enrollments
    WHERE id=p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'enrollment not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_university_attendance
     WHERE enrollment_id=e.id AND attendance_date=p_attendance_date) THEN
    RETURN jsonb_build_object('awarded',false,'reason','already_attended');
  END IF;
  IF e.status NOT IN ('enrolled','in_progress') THEN
    RETURN jsonb_build_object('awarded',false,'reason','enrollment_not_active');
  END IF;
  SELECT * INTO STRICT c FROM public.university_courses WHERE id=e.course_id;
  IF NOT public.skill_tier_unlocked(e.profile_id,c.skill_slug) THEN
    RETURN jsonb_build_object('awarded',false,'reason','tier_locked');
  END IF;
  -- Resolve the bonus at the authoritative reward boundary, never in the browser.
  -- Use the actual award instant so a new month's professor is never applied retroactively.
  SELECT public.university_visiting_professor_bonus(e.university_id, c.skill_slug,
    now()) INTO v_professor_bonus;
  v_awarded_xp := LEAST(170000, floor(p_xp * (1 + COALESCE(v_professor_bonus, 0)))::integer);
  SELECT user_id, experience INTO v_user, v_experience
    FROM public.profiles WHERE id=e.profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile missing'; END IF;

  v_completed := e.scheduled_end_date <= now();
  INSERT INTO public.player_university_attendance
    (enrollment_id,attendance_date,xp_earned,was_locked_out,was_remote,connection_failed)
  VALUES (e.id,p_attendance_date,v_awarded_xp,false,COALESCE(p_remote,false),COALESCE(p_connection_failed,false));

  v_max := public.progression_skill_max_level(c.skill_slug);
  INSERT INTO public.skill_progress
    (profile_id,skill_slug,current_level,current_xp,required_xp,last_practiced_at)
  VALUES(e.profile_id,c.skill_slug,0,0,public.progression_skill_required_xp(0),now())
  ON CONFLICT (profile_id,skill_slug) DO NOTHING;
  SELECT * INTO STRICT sp FROM public.skill_progress
    WHERE profile_id=e.profile_id AND skill_slug=c.skill_slug FOR UPDATE;
  v_level := LEAST(GREATEST(COALESCE(sp.current_level,0),0),v_max);
  v_xp := GREATEST(COALESCE(sp.current_xp,0),0);
  IF v_level < v_max THEN
    v_required := COALESCE(NULLIF(sp.required_xp,0),public.progression_skill_required_xp(v_level));
    v_xp := v_xp + v_awarded_xp;
    WHILE v_level < v_max AND v_xp >= v_required LOOP
      v_xp := v_xp-v_required;
      v_level := v_level+1;
      IF v_level < v_max THEN v_required := public.progression_skill_required_xp(v_level); END IF;
    END LOOP;
    IF v_level >= v_max THEN v_xp:=0; v_required:=0; END IF;
    UPDATE public.skill_progress SET current_level=v_level,current_xp=v_xp,
      required_xp=v_required,last_practiced_at=now(),updated_at=now()
      WHERE id=sp.id;
  END IF;

  UPDATE public.player_university_enrollments SET
    days_attended=COALESCE(days_attended,0)+1,
    total_xp_earned=COALESCE(total_xp_earned,0)+v_awarded_xp,
    status=CASE WHEN v_completed THEN 'completed' ELSE 'in_progress' END,
    actual_completion_date=CASE WHEN v_completed THEN now() ELSE NULL END
    WHERE id=e.id;
  UPDATE public.profiles SET experience=COALESCE(experience,0)+v_awarded_xp WHERE id=e.profile_id;

  INSERT INTO public.experience_ledger
    (user_id,profile_id,activity_type,xp_amount,skill_slug,metadata)
  VALUES(v_user,e.profile_id,'university_attendance',v_awarded_xp,c.skill_slug,
    jsonb_build_object('enrollment_id',e.id,'attendance_date',p_attendance_date,
      'completed',v_completed,'was_remote',p_remote,'connection_failed',p_connection_failed,'professor_bonus',v_professor_bonus));

  RETURN jsonb_build_object('awarded',true,'xp',v_awarded_xp,'professor_bonus',v_professor_bonus,'completed',v_completed);
END $$;
REVOKE ALL ON FUNCTION public.record_university_attendance_reward(uuid,date,integer,boolean,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_university_attendance_reward(uuid,date,integer,boolean,boolean)
 TO service_role;

