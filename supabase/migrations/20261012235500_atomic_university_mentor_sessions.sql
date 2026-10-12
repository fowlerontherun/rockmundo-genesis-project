-- Serialize education purchases against the authoritative character wallet.
CREATE OR REPLACE FUNCTION public.enroll_university_course_atomic(p_profile_id uuid,p_course_id uuid)
RETURNS public.player_university_enrollments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_course public.university_courses%rowtype;
 v_uni public.universities%rowtype;v_price integer;v_days integer;v_row public.player_university_enrollments%rowtype;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'education_profile_not_owned'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('university-course:'||p_course_id::text,0));
 SELECT * INTO v_course FROM public.university_courses WHERE id=p_course_id AND is_active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'university_course_not_available'; END IF;
 SELECT * INTO v_uni FROM public.universities WHERE id=v_course.university_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'university_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM public.player_university_enrollments WHERE profile_id=p_profile_id
 AND status IN ('enrolled','in_progress')) THEN RAISE EXCEPTION 'already_enrolled'; END IF;
 IF NOT public.skill_tier_unlocked(p_profile_id,v_course.skill_slug) OR
 coalesce((SELECT max(current_level) FROM public.skill_progress WHERE profile_id=p_profile_id
 AND skill_slug=v_course.skill_slug),0)<v_course.required_skill_level
 THEN RAISE EXCEPTION 'university_course_prerequisite_not_met'; END IF;
 IF v_course.max_enrollments IS NOT NULL AND (
 SELECT count(*) FROM public.player_university_enrollments
 WHERE course_id=p_course_id AND status IN ('enrolled','in_progress'))>=v_course.max_enrollments
 THEN RAISE EXCEPTION 'university_capacity_reached'; END IF;
 v_price:=floor(v_course.base_price*coalesce(v_uni.course_cost_modifier,1));
 v_days:=greatest(1,ceil(v_course.base_duration_days*(200-
 least(100,greatest(0,coalesce(v_uni.quality_of_learning,50))))/100.0));
 IF v_price<0 THEN RAISE EXCEPTION 'university_invalid_tuition'; END IF;
 UPDATE public.profiles SET cash=cash-v_price WHERE id=p_profile_id AND cash>=v_price;
 IF NOT FOUND THEN RAISE EXCEPTION 'university_insufficient_funds'; END IF;
 INSERT INTO public.player_university_enrollments
 (user_id,profile_id,university_id,course_id,scheduled_end_date,payment_amount,status)
 VALUES(v_profile.user_id,p_profile_id,v_uni.id,v_course.id,now()+make_interval(days=>v_days),
 v_price,'enrolled') RETURNING * INTO v_row;
 RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.book_mentor_session_atomic(p_profile_id uuid,p_mentor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_mentor public.education_mentors%rowtype;
 v_skill public.skill_progress%rowtype;v_xp integer;v_gain integer;v_level integer;v_max integer;
 v_remaining integer;v_required integer;v_session_id uuid;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'mentor_profile_not_owned'; END IF;
 SELECT * INTO v_mentor FROM public.education_mentors WHERE id=p_mentor_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'mentor_not_available'; END IF;
 IF v_mentor.city_id IS NOT NULL AND v_mentor.city_id IS DISTINCT FROM v_profile.current_city_id
 THEN RAISE EXCEPTION 'mentor_wrong_city'; END IF;
 IF v_mentor.available_day IS NOT NULL AND extract(dow FROM now() AT TIME ZONE
 coalesce((SELECT timezone FROM public.cities WHERE id=v_mentor.city_id),'UTC'))::integer
 <> v_mentor.available_day THEN RAISE EXCEPTION 'mentor_unavailable_today'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.player_master_discoveries
 WHERE profile_id=p_profile_id AND mentor_id=p_mentor_id)
 THEN RAISE EXCEPTION 'mentor_not_discovered'; END IF;
 IF EXISTS(SELECT 1 FROM public.player_mentor_sessions
 WHERE profile_id=p_profile_id AND mentor_id=p_mentor_id
 AND session_date>now()-make_interval(hours=>v_mentor.cooldown_hours))
 THEN RAISE EXCEPTION 'mentor_cooldown_active'; END IF;
 IF NOT public.skill_tier_unlocked(p_profile_id,v_mentor.focus_skill) THEN
 RAISE EXCEPTION 'mentor_skill_locked'; END IF;
 UPDATE public.profiles SET cash=cash-v_mentor.cost WHERE id=p_profile_id AND cash>=v_mentor.cost;
 IF NOT FOUND THEN RAISE EXCEPTION 'mentor_insufficient_funds'; END IF;
 SELECT * INTO v_skill FROM public.skill_progress WHERE profile_id=p_profile_id
 AND skill_slug=v_mentor.focus_skill FOR UPDATE;
 v_level:=coalesce(v_skill.current_level,0);
 v_max:=public.progression_skill_max_level(v_mentor.focus_skill);
 v_xp:=floor(v_mentor.base_xp*(1+v_level*.1));
 v_gain:=greatest(0,floor(v_xp*v_mentor.skill_gain_ratio));
 v_remaining:=coalesce(v_skill.current_xp,0)+v_gain;
 v_required:=coalesce(nullif(v_skill.required_xp,0),public.progression_skill_required_xp(v_level));
 WHILE v_level<v_max AND v_required>0 AND v_remaining>=v_required LOOP
  v_remaining:=v_remaining-v_required;v_level:=v_level+1;
  v_required:=CASE WHEN v_level<v_max THEN public.progression_skill_required_xp(v_level) ELSE 0 END;
 END LOOP;
 IF v_level>=v_max THEN v_remaining:=0;v_required:=0; END IF;
 INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp,last_practiced_at)
 VALUES(p_profile_id,v_mentor.focus_skill,v_level,v_remaining,v_required,now())
 ON CONFLICT(profile_id,skill_slug) DO UPDATE SET current_level=excluded.current_level,
 current_xp=excluded.current_xp,required_xp=excluded.required_xp,last_practiced_at=excluded.last_practiced_at;
 UPDATE public.profiles SET experience=coalesce(experience,0)+v_xp WHERE id=p_profile_id;
 INSERT INTO public.player_mentor_sessions(user_id,profile_id,mentor_id,xp_earned,skill_value_gained)
 VALUES(v_profile.user_id,p_profile_id,p_mentor_id,v_xp,v_gain) RETURNING id INTO v_session_id;
 INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,skill_slug,metadata)
 VALUES(v_profile.user_id,p_profile_id,'mentor_session',v_xp,v_mentor.focus_skill,
 jsonb_build_object('mentor_id',p_mentor_id,'session_id',v_session_id));
 RETURN jsonb_build_object('xpEarned',v_xp,'skillValueGained',v_gain,'sessionId',v_session_id);
END $$;
REVOKE ALL ON FUNCTION public.enroll_university_course_atomic(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.book_mentor_session_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enroll_university_course_atomic(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_mentor_session_atomic(uuid,uuid) TO authenticated;
