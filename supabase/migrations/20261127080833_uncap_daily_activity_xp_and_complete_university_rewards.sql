-- Remove the general daily activity XP ceiling. Activity eligibility, per-source
-- anti-farming limits and the separate daily AP ceiling are unchanged.
ALTER TABLE public.profile_activity_xp_bonuses
  DROP CONSTRAINT profile_activity_xp_bonuses_xp_awarded_check;
ALTER TABLE public.profile_activity_xp_bonuses
  ADD CONSTRAINT profile_activity_xp_bonuses_xp_awarded_check
  CHECK (xp_awarded >= 0 AND (xp_awarded > 0 OR ap_awarded > 0));

CREATE OR REPLACE FUNCTION public.award_daily_activity_xp_atomic(
 p_profile_id uuid, p_grant_date date, p_xp integer, p_ap integer,
 p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp' AS $$
DECLARE v_inserted integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- An AP-only settlement is valid when the source has already credited XP.
 IF p_profile_id IS NULL OR p_grant_date IS NULL OR p_xp IS NULL OR p_xp < 0
    OR p_ap IS NULL OR p_ap NOT BETWEEN 0 AND 20
    OR (p_xp = 0 AND p_ap = 0)
    OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'Invalid activity bonus' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.profile_activity_xp_bonuses(profile_id,grant_date,xp_awarded,ap_awarded,metadata)
 VALUES(p_profile_id,p_grant_date,p_xp,p_ap,p_metadata)
 ON CONFLICT(profile_id,grant_date) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN RETURN false; END IF;
 INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 UPDATE public.player_xp_wallet SET
  xp_balance=coalesce(xp_balance,0)+p_xp,
  lifetime_xp=coalesce(lifetime_xp,0)+p_xp,
  skill_xp_balance=coalesce(skill_xp_balance,0)+p_xp,
  skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+p_xp,
  attribute_points_balance=coalesce(attribute_points_balance,0)+p_ap,
  attribute_points_lifetime=coalesce(attribute_points_lifetime,0)+p_ap,
  last_recalculated=now()
 WHERE profile_id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Activity bonus wallet missing'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.award_daily_activity_xp_atomic(uuid,date,integer,integer,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_daily_activity_xp_atomic(uuid,date,integer,integer,jsonb)
  TO service_role;

-- The completion receipt is the idempotency boundary. It is inserted before
-- every reward write, and all writes share the same Postgres transaction.
-- The nightly activity processor will still award AP for this ledger row, but
-- the xp_wallet_credited marker prevents a second XP deposit.
CREATE OR REPLACE FUNCTION public.finalize_university_course(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.player_university_enrollments%rowtype; c public.university_courses%rowtype;
 sp public.skill_progress%rowtype; v_attendance integer; v_bonus integer; v_inserted uuid;
 v_level integer; v_xp integer; v_max integer; v_required integer; v_user uuid;
 v_skill_slug text;
BEGIN
 SELECT * INTO e FROM public.player_university_enrollments WHERE id=p_enrollment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('completed',false,'reason','enrollment_missing'); END IF;
 IF e.status::text NOT IN ('enrolled','in_progress','completed')
    OR e.scheduled_end_date IS NULL OR e.scheduled_end_date>now() THEN
  RETURN jsonb_build_object('completed',false,'reason','not_due');
 END IF;
 IF EXISTS(SELECT 1 FROM public.university_course_completions WHERE enrollment_id=e.id) THEN
  RETURN jsonb_build_object('completed',true,'awarded',false,'reason','already_completed');
 END IF;
 SELECT * INTO STRICT c FROM public.university_courses WHERE id=e.course_id;
 -- Older courses can still reference legacy skill names. The skill_progress
 -- trigger normalises INSERTs to canonical slugs, so subsequent SELECTs must
 -- use the same canonical value or the entire completion rolls back.
 SELECT coalesce((SELECT alias.canonical_slug
                  FROM private.skill_alias_resolution_20261026 alias
                  WHERE alias.legacy_slug=c.skill_slug),c.skill_slug) INTO v_skill_slug;
 SELECT user_id INTO STRICT v_user FROM public.profiles WHERE id=e.profile_id FOR UPDATE;
 SELECT least(2147483647,coalesce(sum(greatest(0,xp_earned)),0))::integer
 INTO v_attendance FROM public.player_university_attendance
 WHERE enrollment_id=e.id AND NOT coalesce(was_locked_out,false);
 v_bonus:=public.university_completion_bonus(v_attendance);
 INSERT INTO public.university_course_completions(enrollment_id,profile_id,attendance_xp,bonus_xp,completed_at)
 VALUES(e.id,e.profile_id,v_attendance,v_bonus,e.scheduled_end_date)
 ON CONFLICT(enrollment_id) DO NOTHING RETURNING enrollment_id INTO v_inserted;
 IF v_inserted IS NULL THEN RETURN jsonb_build_object('completed',true,'awarded',false); END IF;
 IF v_bonus>0 THEN
  v_max:=public.progression_skill_max_level(v_skill_slug);
  INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp,last_practiced_at)
  VALUES(e.profile_id,v_skill_slug,0,0,public.progression_skill_required_xp(0),now())
  ON CONFLICT(profile_id,skill_slug) DO NOTHING;
  SELECT * INTO STRICT sp FROM public.skill_progress
    WHERE profile_id=e.profile_id AND skill_slug=v_skill_slug FOR UPDATE;
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
  UPDATE public.skill_progress SET current_level=v_level,current_xp=v_xp,
    required_xp=v_required,last_practiced_at=now(),updated_at=now() WHERE id=sp.id;
  UPDATE public.profiles SET experience=coalesce(experience,0)+v_bonus WHERE id=e.profile_id;
  INSERT INTO public.player_xp_wallet(profile_id) VALUES(e.profile_id)
    ON CONFLICT(profile_id) DO NOTHING;
  UPDATE public.player_xp_wallet SET
    xp_balance=coalesce(xp_balance,0)+v_bonus,
    lifetime_xp=coalesce(lifetime_xp,0)+v_bonus,
    skill_xp_balance=coalesce(skill_xp_balance,0)+v_bonus,
    skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_bonus,
    last_recalculated=now()
  WHERE profile_id=e.profile_id;
  INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,skill_slug,metadata)
  VALUES(v_user,e.profile_id,'university_completion',v_bonus,v_skill_slug,
    jsonb_build_object('enrollment_id',e.id,'attendance_xp',v_attendance,
                       'bonus_rate',0.20,'xp_wallet_credited',true));
 END IF;
 UPDATE public.player_university_enrollments SET status='completed'::public.enrollment_status,
   actual_completion_date=coalesce(actual_completion_date,e.scheduled_end_date),
   total_xp_earned=least(2147483647,coalesce(total_xp_earned,0)::bigint+v_bonus)::integer,
   updated_at=now() WHERE id=e.id;
 RETURN jsonb_build_object('completed',true,'awarded',v_bonus>0,'bonus_xp',v_bonus);
END $$;
REVOKE ALL ON FUNCTION public.finalize_university_course(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_university_course(uuid) TO service_role;

-- Catch historical completed enrollments without a receipt too. Replaying is
-- safe: no course with a receipt can award again, and verified attendance is
-- the only basis for bonus XP. An empty-attendance course still graduates with
-- a zero-XP receipt.
CREATE OR REPLACE FUNCTION public.finish_due_university_courses()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e record; v_count integer:=0;
BEGIN
 FOR e IN
  SELECT enrollment.id
  FROM public.player_university_enrollments enrollment
  WHERE enrollment.scheduled_end_date<=now()
    AND (enrollment.status IN ('enrolled','in_progress') OR
      (enrollment.status='completed' AND NOT EXISTS(
        SELECT 1 FROM public.university_course_completions receipt
        WHERE receipt.enrollment_id=enrollment.id)))
  ORDER BY enrollment.scheduled_end_date,enrollment.id LIMIT 500
  FOR UPDATE OF enrollment SKIP LOCKED
 LOOP
  PERFORM public.finalize_university_course(e.id); v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.finish_due_university_courses() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_due_university_courses() TO service_role;

-- Legacy configuration keys were advisory: the hard stop was in the worker
-- and RPC. Remove the obsolete global-cap controls from balance management.
DELETE FROM public.game_balance_config
WHERE key IN ('daily_xp_cap','daily_activity_xp_cap');
