-- #4270 / #4271: consent-based, character-scoped, server-authoritative teaching.
-- Rollout: deploy this migration together with the new teaching UI; verify the
-- cron job and both authenticated role gates before enabling invitations.
-- Legacy client-completed sessions are NEVER converted to paid XP receipts.

BEGIN;

ALTER TABLE public.player_teaching_sessions
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz,
  ADD COLUMN IF NOT EXISTS teaching_tier text;
ALTER TABLE public.player_teaching_sessions
  ADD CONSTRAINT teaching_session_duration_allowed
  CHECK (session_duration_days IN (1,2,3,5,7)) NOT VALID;
ALTER TABLE public.player_teaching_sessions
  ADD CONSTRAINT teaching_session_profiles_distinct
  CHECK (teacher_profile_id <> student_profile_id) NOT VALID;

-- Existing rows were authored by clients with untrusted rewards and no consent.
-- Preserve their historical identities, but never allow them to be settled.
UPDATE public.player_teaching_sessions
SET status = 'cancelled', student_xp_earned = 0, teacher_xp_earned = 0
WHERE accepted_at IS NULL AND status IN ('pending','scheduled','in_progress','completed');

CREATE UNIQUE INDEX IF NOT EXISTS teaching_active_pair_skill_unique
ON public.player_teaching_sessions(teacher_profile_id,student_profile_id,skill_slug)
WHERE status IN ('pending','scheduled','in_progress');

CREATE TABLE IF NOT EXISTS public.player_teaching_reward_ledger (
  session_id uuid NOT NULL REFERENCES public.player_teaching_sessions(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  skill_slug text NOT NULL,
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0 AND xp_awarded <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,profile_id)
);
ALTER TABLE public.player_teaching_reward_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players read their teaching reward receipts" ON public.player_teaching_reward_ledger;
CREATE POLICY "Players read their teaching reward receipts"
ON public.player_teaching_reward_ledger FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
));
REVOKE ALL ON public.player_teaching_reward_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.player_teaching_reward_ledger TO authenticated;

-- Browser mutations are not trusted, even if their profile_id is owned.
DROP POLICY IF EXISTS "Users can create teaching sessions as teacher" ON public.player_teaching_sessions;
DROP POLICY IF EXISTS "Users can update own teaching sessions" ON public.player_teaching_sessions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.player_teaching_sessions FROM PUBLIC, anon, authenticated;

-- Internal reward writer: called only by the privileged settlement procedure.
CREATE OR REPLACE FUNCTION public.grant_teaching_skill_xp(
  p_profile_id uuid, p_skill_slug text, p_xp integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_progress public.skill_progress%ROWTYPE;
  v_level integer;
  v_xp integer;
  v_required integer;
BEGIN
  IF p_xp < 1 OR p_xp > 1000 THEN
    RAISE EXCEPTION 'Invalid teaching XP award' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_progress FROM public.skill_progress
  WHERE profile_id=p_profile_id AND skill_slug=p_skill_slug AND current_level>=1
  FOR UPDATE;
  v_level := v_progress.current_level;
  v_xp := coalesce(v_progress.current_xp,0)+p_xp;
  v_required := coalesce(nullif(v_progress.required_xp,0),public.progression_skill_required_xp(v_level));
  WHILE v_xp >= v_required LOOP
    v_xp := v_xp-v_required;
    v_level := v_level+1;
    v_required := public.progression_skill_required_xp(v_level);
  END LOOP;
  UPDATE public.skill_progress
  SET current_level=v_level,current_xp=v_xp,required_xp=v_required,
      last_practiced_at=now(),updated_at=now()
  WHERE id=v_progress.id;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_teaching_skill_xp(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.grant_teaching_skill_xp(uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.request_teaching_lesson(
  p_teacher_profile_id uuid, p_student_profile_id uuid, p_skill_slug text, p_duration_days integer
) RETURNS public.player_teaching_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_teacher public.profiles%ROWTYPE;
  v_student public.profiles%ROWTYPE;
  v_skill_level integer;
  v_student_level integer;
  v_tier text;
  v_cap integer;
  v_count integer;
  v_session public.player_teaching_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_teacher_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a lesson' USING ERRCODE='42501';
  END IF;
  IF p_duration_days NOT IN (1,2,3,5,7)
    OR p_teacher_profile_id = p_student_profile_id
    OR nullif(trim(p_skill_slug),'') IS NULL
    OR p_skill_slug LIKE 'teaching_%' THEN
    RAISE EXCEPTION 'Invalid teaching lesson' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_teacher FROM public.profiles
    WHERE id=p_teacher_profile_id AND user_id=auth.uid() AND coalesce(is_active,true)
      AND deleted_at IS NULL AND died_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teacher profile not owned by caller' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_student FROM public.profiles
    WHERE id=p_student_profile_id AND coalesce(is_active,true) AND deleted_at IS NULL AND died_at IS NULL;
  IF NOT FOUND OR v_student.user_id = v_teacher.user_id THEN
    RAISE EXCEPTION 'Student must be another active account' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted'
    AND ((f.requestor_id=v_teacher.id AND f.addressee_id=v_student.id)
      OR (f.requestor_id=v_student.id AND f.addressee_id=v_teacher.id)))
    OR public.are_profiles_blocked(v_teacher.id,v_student.id) THEN
    RAISE EXCEPTION 'Student must be an accepted, unblocked friend' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug=p_skill_slug) THEN
    RAISE EXCEPTION 'Unknown teaching skill' USING ERRCODE='22023';
  END IF;
  SELECT current_level INTO v_skill_level FROM public.skill_progress
    WHERE profile_id=v_teacher.id AND skill_slug=p_skill_slug;
  SELECT current_level INTO v_student_level FROM public.skill_progress
    WHERE profile_id=v_student.id AND skill_slug=p_skill_slug;
  IF coalesce(v_student_level,0)<1 OR coalesce(v_skill_level,0)<=v_student_level THEN
    RAISE EXCEPTION 'Teacher must have an unlocked skill above the student level' USING ERRCODE='22023';
  END IF;
  v_tier := CASE
    WHEN v_skill_level >= 1 AND EXISTS
      (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
        AND skill_slug='teaching_mastery_teaching' AND current_level>=1) THEN 'mastery'
    WHEN v_skill_level >= 3 AND EXISTS
      (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
        AND skill_slug='teaching_professional_teaching' AND current_level>=1) THEN 'professional'
    WHEN v_skill_level >= 5 AND EXISTS
      (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
        AND skill_slug='teaching_basic_teaching' AND current_level>=1) THEN 'basic'
    ELSE NULL END;
  IF v_tier IS NULL THEN RAISE EXCEPTION 'Teaching tier not unlocked' USING ERRCODE='42501'; END IF;
  v_cap := CASE WHEN v_tier='mastery' THEN 2 ELSE 1 END;

  -- Stable teacher lock makes cap and duplicate admission race-safe.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_teacher.id::text || ':teaching',0));
  SELECT count(*) INTO v_count FROM public.player_teaching_sessions
    WHERE teacher_profile_id=v_teacher.id AND status IN ('pending','scheduled','in_progress');
  IF v_count >= v_cap THEN RAISE EXCEPTION 'Teaching student limit reached' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_teaching_sessions
    WHERE teacher_profile_id=v_teacher.id AND student_profile_id=v_student.id
      AND skill_slug=p_skill_slug AND status IN ('pending','scheduled','in_progress')) THEN
    RAISE EXCEPTION 'An invitation already exists for this skill' USING ERRCODE='23505';
  END IF;

  INSERT INTO public.player_teaching_sessions (
    teacher_profile_id,student_profile_id,skill_slug,session_duration_days,
    status,teacher_xp_earned,student_xp_earned
  ) VALUES (v_teacher.id,v_student.id,p_skill_slug,p_duration_days,'pending',0,0)
  RETURNING * INTO v_session;
  INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
    VALUES (v_student.user_id,v_student.id,'education','info','Teaching invitation',
      'A friend invited you to study '||p_skill_slug,'/teaching',
      jsonb_build_object('teaching_session_id',v_session.id));
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.request_teaching_lesson(uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_teaching_lesson(uuid,uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_teaching_lesson(
  p_session_id uuid, p_student_profile_id uuid, p_accept boolean
) RETURNS public.player_teaching_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.player_teaching_sessions%ROWTYPE;
  v_student public.profiles%ROWTYPE;
  v_teacher public.profiles%ROWTYPE;
  v_teacher_level integer;
  v_student_level integer;
  v_tier text;
  v_start timestamptz;
  v_end timestamptz;
  v_day integer;
  v_profile uuid;
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_session FROM public.player_teaching_sessions WHERE id=p_session_id FOR UPDATE;
  SELECT * INTO v_student FROM public.profiles
    WHERE id=p_student_profile_id AND user_id=auth.uid() AND coalesce(is_active,true)
      AND deleted_at IS NULL AND died_at IS NULL;
  IF NOT FOUND OR v_session.id IS NULL OR v_session.student_profile_id<>v_student.id THEN
    RAISE EXCEPTION 'This teaching invitation is not yours' USING ERRCODE='42501';
  END IF;
  IF v_session.status <> 'pending' OR v_session.created_at < now()-interval '7 days' THEN
    RAISE EXCEPTION 'Teaching invitation is no longer pending' USING ERRCODE='22023';
  END IF;
  IF p_accept IS NOT TRUE THEN
    UPDATE public.player_teaching_sessions SET status='cancelled',completed_at=now()
      WHERE id=p_session_id RETURNING * INTO v_session;
    RETURN v_session;
  END IF;
  SELECT * INTO v_teacher FROM public.profiles
    WHERE id=v_session.teacher_profile_id AND coalesce(is_active,true)
      AND deleted_at IS NULL AND died_at IS NULL;
  IF NOT FOUND OR v_teacher.user_id=v_student.user_id
    OR public.are_profiles_blocked(v_teacher.id,v_student.id)
    OR NOT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted'
      AND ((f.requestor_id=v_teacher.id AND f.addressee_id=v_student.id)
        OR (f.requestor_id=v_student.id AND f.addressee_id=v_teacher.id))) THEN
    RAISE EXCEPTION 'Teaching friendship no longer eligible' USING ERRCODE='42501';
  END IF;
  SELECT current_level INTO v_teacher_level FROM public.skill_progress
    WHERE profile_id=v_teacher.id AND skill_slug=v_session.skill_slug;
  SELECT current_level INTO v_student_level FROM public.skill_progress
    WHERE profile_id=v_student.id AND skill_slug=v_session.skill_slug;
  IF coalesce(v_student_level,0)<1 OR coalesce(v_teacher_level,0)<=v_student_level THEN
    RAISE EXCEPTION 'Teaching skill requirements changed' USING ERRCODE='22023';
  END IF;
  v_tier := CASE
    WHEN EXISTS (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
      AND skill_slug='teaching_mastery_teaching' AND current_level>=1) THEN 'mastery'
    WHEN v_teacher_level>=3 AND EXISTS (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
      AND skill_slug='teaching_professional_teaching' AND current_level>=1) THEN 'professional'
    WHEN v_teacher_level>=5 AND EXISTS (SELECT 1 FROM public.skill_progress WHERE profile_id=v_teacher.id
      AND skill_slug='teaching_basic_teaching' AND current_level>=1) THEN 'basic'
    ELSE NULL END;
  IF v_tier IS NULL THEN RAISE EXCEPTION 'Teacher no longer qualified' USING ERRCODE='22023'; END IF;

  -- One hour per day, same UTC start, for 1/2/3/5/7 days.
  -- Booking both sides in this transaction prevents half-booked lessons.
  PERFORM pg_advisory_xact_lock(hashtextextended(least(v_teacher.id,v_student.id)::text || ':teaching-calendar',0));
  PERFORM pg_advisory_xact_lock(hashtextextended(greatest(v_teacher.id,v_student.id)::text || ':teaching-calendar',0));
  v_start := date_trunc('hour',now()) + interval '2 hours';
  FOR v_day IN 0..v_session.session_duration_days-1 LOOP
    v_end := v_start + (v_day * interval '1 day') + interval '1 hour';
    FOREACH v_profile IN ARRAY ARRAY[v_teacher.id,v_student.id] LOOP
      IF public.check_profile_scheduling_conflict(v_profile,
        v_start+(v_day * interval '1 day'),v_end,NULL) THEN
        RAISE EXCEPTION 'A teaching participant has a schedule conflict' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END LOOP;
  FOR v_day IN 0..v_session.session_duration_days-1 LOOP
    FOREACH v_profile IN ARRAY ARRAY[v_teacher.id,v_student.id] LOOP
      v_user := CASE WHEN v_profile=v_teacher.id THEN v_teacher.user_id ELSE v_student.user_id END;
      INSERT INTO public.player_scheduled_activities (
        user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,
        title,description,metadata
      ) VALUES (
        v_user,v_profile,'teaching',v_start+(v_day*interval '1 day'),
        v_start+(v_day*interval '1 day')+interval '1 hour','scheduled',
        'Player teaching: '||v_session.skill_slug,
        'Mutually accepted teaching lesson',
        jsonb_build_object('teaching_session_id',v_session.id,
          'lesson_day',v_day+1,'role',CASE WHEN v_profile=v_teacher.id THEN 'teacher' ELSE 'student' END)
      );
    END LOOP;
  END LOOP;
  UPDATE public.player_teaching_sessions
  SET accepted_at=now(),started_at=v_start,teaching_tier=v_tier,
      scheduled_end=v_start+((v_session.session_duration_days-1)*interval '1 day')+interval '1 hour',
      status='scheduled'
  WHERE id=v_session.id RETURNING * INTO v_session;
  INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
  VALUES (v_teacher.user_id,v_teacher.id,'education','info','Teaching accepted',
    'Your teaching invitation was accepted','/teaching',
    jsonb_build_object('teaching_session_id',v_session.id));
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_teaching_lesson(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_teaching_lesson(uuid,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_teaching_lesson(
  p_session_id uuid,p_profile_id uuid
) RETURNS public.player_teaching_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_session public.player_teaching_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=p_profile_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Teaching participant required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_session FROM public.player_teaching_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR p_profile_id NOT IN (v_session.teacher_profile_id,v_session.student_profile_id) THEN
    RAISE EXCEPTION 'Not a teaching participant' USING ERRCODE='42501';
  END IF;
  IF v_session.status NOT IN ('pending','scheduled','in_progress')
    OR (v_session.scheduled_end IS NOT NULL AND v_session.scheduled_end<=now()) THEN
    RAISE EXCEPTION 'Teaching session is no longer cancellable' USING ERRCODE='22023';
  END IF;
  UPDATE public.player_teaching_sessions SET status='cancelled',completed_at=now()
    WHERE id=v_session.id RETURNING * INTO v_session;
  UPDATE public.player_scheduled_activities
    SET status='cancelled',completed_at=now()
  WHERE metadata->>'teaching_session_id'=v_session.id::text
    AND activity_type='teaching' AND status IN ('scheduled','in_progress');
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_teaching_lesson(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_teaching_lesson(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_due_teaching_lessons(p_batch integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.player_teaching_sessions%ROWTYPE;
  v_teacher public.profiles%ROWTYPE;
  v_student public.profiles%ROWTYPE;
  v_level integer;
  v_factor numeric;
  v_repeat integer;
  v_student_xp integer;
  v_teacher_xp integer;
  v_teacher_skill text;
  v_count integer := 0;
  v_slots integer;
BEGIN
  FOR v_session IN
    SELECT * FROM public.player_teaching_sessions
    WHERE accepted_at IS NOT NULL AND status IN ('scheduled','in_progress')
      AND scheduled_end<=now()
    ORDER BY scheduled_end,id FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(coalesce(p_batch,100),1),200)
  LOOP
    BEGIN
      SELECT * INTO STRICT v_teacher FROM public.profiles WHERE id=v_session.teacher_profile_id;
      SELECT * INTO STRICT v_student FROM public.profiles WHERE id=v_session.student_profile_id;

      -- A lost friendship, missing calendar, or cancelled attendance cannot settle.
      SELECT count(*) INTO v_slots FROM public.player_scheduled_activities
        WHERE activity_type='teaching' AND metadata->>'teaching_session_id'=v_session.id::text
          AND status NOT IN ('cancelled','missed')
          AND scheduled_end<=now();
      IF v_slots <> (2*v_session.session_duration_days)
        OR public.are_profiles_blocked(v_teacher.id,v_student.id)
        OR NOT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status='accepted'
          AND ((f.requestor_id=v_teacher.id AND f.addressee_id=v_student.id)
            OR (f.requestor_id=v_student.id AND f.addressee_id=v_teacher.id))) THEN
        UPDATE public.player_teaching_sessions SET status='cancelled',completed_at=now()
          WHERE id=v_session.id;
        UPDATE public.player_scheduled_activities SET status='cancelled',completed_at=now()
          WHERE activity_type='teaching' AND metadata->>'teaching_session_id'=v_session.id::text
            AND status IN ('scheduled','in_progress');
        CONTINUE;
      END IF;

      SELECT current_level INTO STRICT v_level FROM public.skill_progress
        WHERE profile_id=v_teacher.id AND skill_slug=v_session.skill_slug;
      IF v_level < 1 THEN RAISE EXCEPTION 'Teacher target skill unavailable'; END IF;
      v_factor:=least(1,v_level::numeric/20);
      v_repeat:=(SELECT count(*) FROM public.player_teaching_sessions
        WHERE teacher_profile_id=v_teacher.id AND student_profile_id=v_student.id
          AND skill_slug=v_session.skill_slug AND status='completed'
          AND completed_at>now()-interval '30 days');
      v_teacher_skill:='teaching_'||v_session.teaching_tier||'_teaching';
      v_student_xp:=round(
        (CASE v_session.teaching_tier
          WHEN 'mastery' THEN 90+30*v_factor
          WHEN 'professional' THEN 70+30*v_factor
          ELSE 50+30*v_factor END)
        *v_session.session_duration_days
        *CASE WHEN v_repeat=0 THEN 1 WHEN v_repeat=1 THEN 0.75
          WHEN v_repeat=2 THEN 0.5 ELSE 0.25 END);
      v_teacher_xp:=round(
        (CASE v_session.teaching_tier
          WHEN 'mastery' THEN 50+10*v_factor
          WHEN 'professional' THEN 40+10*v_factor
          ELSE 30+10*v_factor END)
        *v_session.session_duration_days
        *CASE WHEN v_repeat=0 THEN 1 WHEN v_repeat=1 THEN 0.75
          WHEN v_repeat=2 THEN 0.5 ELSE 0.25 END);
      -- Unique per-recipient receipts + row locks make retries/replays harmless.
      INSERT INTO public.player_teaching_reward_ledger(session_id,profile_id,skill_slug,xp_awarded)
        VALUES(v_session.id,v_student.id,v_session.skill_slug,v_student_xp);
      PERFORM public.grant_teaching_skill_xp(v_student.id,v_session.skill_slug,v_student_xp);
      INSERT INTO public.player_teaching_reward_ledger(session_id,profile_id,skill_slug,xp_awarded)
        VALUES(v_session.id,v_teacher.id,v_teacher_skill,v_teacher_xp);
      PERFORM public.grant_teaching_skill_xp(v_teacher.id,v_teacher_skill,v_teacher_xp);
      UPDATE public.player_teaching_sessions SET status='completed',
        completed_at=now(),student_xp_earned=v_student_xp,teacher_xp_earned=v_teacher_xp
        WHERE id=v_session.id;
      UPDATE public.player_scheduled_activities SET status='completed',completed_at=now()
        WHERE activity_type='teaching' AND metadata->>'teaching_session_id'=v_session.id::text
          AND status IN ('scheduled','in_progress');
      INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
        VALUES
        (v_student.user_id,v_student.id,'education','success','Teaching complete',
          'You earned '||v_student_xp||' skill XP','/teaching',
          jsonb_build_object('teaching_session_id',v_session.id)),
        (v_teacher.user_id,v_teacher.id,'education','success','Teaching complete',
          'You earned '||v_teacher_xp||' teaching XP','/teaching',
          jsonb_build_object('teaching_session_id',v_session.id));
      v_count:=v_count+1;
    EXCEPTION WHEN OTHERS THEN
      -- Per-session savepoint: no partial reward may be committed on a failure.
      RAISE WARNING 'Teaching session % not settled (retryable): %',v_session.id,SQLERRM;
    END;
  END LOOP;
  -- Expire unanswered invitations so teachers cannot be blocked forever.
  UPDATE public.player_teaching_sessions SET status='cancelled',completed_at=now()
    WHERE accepted_at IS NULL AND status='pending'
      AND created_at<now()-interval '7 days';
  UPDATE public.player_teaching_sessions SET status='in_progress'
    WHERE accepted_at IS NOT NULL AND status='scheduled' AND started_at<=now()
      AND scheduled_end>now();
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_due_teaching_lessons(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_due_teaching_lessons(integer) TO service_role;

-- Database-native recurring settlement: no stored HTTP JWT and no browser job.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='settle-player-teaching') THEN
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='settle-player-teaching';
    END IF;
    PERFORM cron.schedule('settle-player-teaching','*/15 * * * *',
      'SELECT public.settle_due_teaching_lessons(100);');
  END IF;
END
$cron$;

COMMIT;
