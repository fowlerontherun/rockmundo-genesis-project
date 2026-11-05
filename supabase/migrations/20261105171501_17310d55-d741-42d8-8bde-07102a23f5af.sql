CREATE TABLE public.university_course_completions (
 enrollment_id uuid PRIMARY KEY REFERENCES public.player_university_enrollments(id),
 profile_id uuid NOT NULL,
 attendance_xp integer NOT NULL,
 bonus_xp integer NOT NULL,
 completed_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.university_course_completions TO authenticated;
GRANT ALL ON public.university_course_completions TO service_role;
ALTER TABLE public.university_course_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view course completion rewards" ON public.university_course_completions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));

CREATE FUNCTION public.university_completion_bonus(p_attendance_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT floor(greatest(0,coalesce(p_attendance_xp,0))::numeric * 0.20)::integer;
$$;

CREATE FUNCTION public.finalize_university_course(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.player_university_enrollments%rowtype; c public.university_courses%rowtype;
 sp public.skill_progress%rowtype; v_attendance integer; v_bonus integer; v_inserted uuid;
 v_level integer; v_xp integer; v_max integer; v_required integer; v_user uuid;
BEGIN
 SELECT * INTO e FROM public.player_university_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('completed',false,'reason','enrollment_missing'); END IF;
 IF e.status::text NOT IN ('enrolled','in_progress','completed') OR e.scheduled_end_date IS NULL OR e.scheduled_end_date>now() THEN
 RETURN jsonb_build_object('completed',false,'reason','not_due'); END IF;
 IF EXISTS(SELECT 1 FROM public.university_course_completions WHERE enrollment_id=e.id) THEN
 RETURN jsonb_build_object('completed',true,'awarded',false,'reason','already_completed'); END IF;
 SELECT * INTO STRICT c FROM public.university_courses WHERE id=e.course_id;
 SELECT user_id INTO STRICT v_user FROM public.profiles WHERE id=e.profile_id FOR UPDATE;
 SELECT least(2147483647,coalesce(sum(greatest(0,xp_earned)),0))::integer INTO v_attendance
 FROM public.player_university_attendance WHERE enrollment_id=e.id AND NOT coalesce(was_locked_out,false);
 v_bonus:=public.university_completion_bonus(v_attendance);
 INSERT INTO public.university_course_completions(enrollment_id,profile_id,attendance_xp,bonus_xp,completed_at)
 VALUES(e.id,e.profile_id,v_attendance,v_bonus,e.scheduled_end_date)
 ON CONFLICT(enrollment_id) DO NOTHING RETURNING enrollment_id INTO v_inserted;
 IF v_inserted IS NULL THEN RETURN jsonb_build_object('completed',true,'awarded',false); END IF;
 IF v_bonus>0 THEN
  v_max:=public.progression_skill_max_level(c.skill_slug);
  INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp,last_practiced_at)
  VALUES(e.profile_id,c.skill_slug,0,0,public.progression_skill_required_xp(0),now()) ON CONFLICT(profile_id,skill_slug) DO NOTHING;
  SELECT * INTO STRICT sp FROM public.skill_progress WHERE profile_id=e.profile_id AND skill_slug=c.skill_slug FOR UPDATE;
  v_level:=least(greatest(coalesce(sp.current_level,0),0),v_max);
  v_xp:=greatest(coalesce(sp.current_xp,0),0);
  v_required:=coalesce(nullif(sp.required_xp,0),public.progression_skill_required_xp(v_level));
  IF v_level<v_max THEN
   v_xp:=v_xp+v_bonus;
   WHILE v_level<v_max AND v_xp>=v_required LOOP
    v_xp:=v_xp-v_required; v_level:=v_level+1;
    IF v_level<v_max THEN v_required:=public.progression_skill_required_xp(v_level); END IF;
   END LOOP;
  END IF;
  IF v_level>=v_max THEN v_xp:=0;v_required:=0; END IF;
  UPDATE public.skill_progress SET current_level=v_level,current_xp=v_xp,required_xp=v_required,last_practiced_at=now(),updated_at=now() WHERE id=sp.id;
  UPDATE public.profiles SET experience=coalesce(experience,0)+v_bonus WHERE id=e.profile_id;
  INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,skill_slug,metadata)
  VALUES(v_user,e.profile_id,'university_completion',v_bonus,c.skill_slug,jsonb_build_object('enrollment_id',e.id,'attendance_xp',v_attendance,'bonus_rate',0.20));
 END IF;
 UPDATE public.player_university_enrollments SET status='completed'::public.enrollment_status,
 actual_completion_date=e.scheduled_end_date,total_xp_earned=least(2147483647,coalesce(total_xp_earned,0)::bigint+v_bonus)::integer,updated_at=now() WHERE id=e.id;
 RETURN jsonb_build_object('completed',true,'awarded',v_bonus>0,'bonus_xp',v_bonus);
END $$;
REVOKE ALL ON FUNCTION public.finalize_university_course(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_university_course(uuid) TO service_role;

CREATE FUNCTION public.finish_due_university_courses()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e record; v_count integer:=0;
BEGIN
 FOR e IN SELECT id FROM public.player_university_enrollments WHERE status IN ('enrolled','in_progress') AND scheduled_end_date<=now() ORDER BY scheduled_end_date,id LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.finalize_university_course(e.id); v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.finish_due_university_courses() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_due_university_courses() TO service_role;

CREATE FUNCTION public.university_completion_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status::text='completed' AND OLD.status::text IN ('enrolled','in_progress') THEN
  PERFORM public.finalize_university_course(NEW.id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.university_completion_on_status_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER university_completion_reward AFTER UPDATE OF status ON public.player_university_enrollments FOR EACH ROW EXECUTE FUNCTION public.university_completion_on_status_change();

CREATE FUNCTION public.guard_university_player_completion_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF NEW.status::text NOT IN ('enrolled','in_progress','dropped') OR
     (to_jsonb(NEW)-ARRAY['auto_attend','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['auto_attend','status','updated_at']) OR
     (NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text<>'dropped') THEN
   RAISE EXCEPTION 'Course deadlines and completion rewards are managed by the game' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER university_player_completion_guard BEFORE UPDATE ON public.player_university_enrollments FOR EACH ROW EXECUTE FUNCTION public.guard_university_player_completion_fields();
REVOKE INSERT ON public.player_university_enrollments FROM authenticated;

-- Existing attendance processor runs first; reconcile after its final-day reward.
-- Hourly SQL backstop also finishes manual/no-attendance courses if the worker fails.
SELECT cron.schedule('finish-due-university-courses','10 * * * *','SELECT public.finish_due_university_courses();');
SELECT public.finish_due_university_courses();