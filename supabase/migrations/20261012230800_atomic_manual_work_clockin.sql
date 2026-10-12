-- Manual work clock-in is a single operation. Never leave a paid shift without activity.
CREATE OR REPLACE FUNCTION public.clock_in_work_shift_atomic(p_profile_id uuid,p_employment_id uuid)
RETURNS public.shift_history LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%rowtype;e public.player_employment%rowtype;j public.jobs%rowtype;
 v_shift public.shift_history%rowtype;v_begin time;v_end time;v_duration integer;v_end_at timestamptz;v_earnings integer;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'work_profile_not_owned'; END IF;
 SELECT * INTO e FROM public.player_employment WHERE id=p_employment_id AND profile_id=p.id AND status='employed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'employment_not_active'; END IF;
 SELECT * INTO j FROM public.jobs WHERE id=e.job_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'job_not_active'; END IF;
 IF j.city_id IS NOT NULL AND j.city_id IS DISTINCT FROM p.current_city_id THEN
  RAISE EXCEPTION 'work_requires_job_city'; END IF;
 IF EXISTS (SELECT 1 FROM public.shift_history
  WHERE employment_id=e.id AND shift_date=(now() AT TIME ZONE 'UTC')::date)
 THEN RAISE EXCEPTION 'already_clocked_in_today'; END IF;
 IF EXISTS (SELECT 1 FROM public.profile_activity_statuses
  WHERE profile_id=p.id AND status='active' AND ends_at>now())
 THEN RAISE EXCEPTION 'activity_conflict'; END IF;
 v_begin:=j.start_time;v_end:=j.end_time;
 v_duration:=mod((extract(hour from v_end)::integer*60+extract(minute from v_end)::integer)-
   (extract(hour from v_begin)::integer*60+extract(minute from v_begin)::integer)+1440,1440);
 IF v_duration=0 THEN v_duration:=1440; END IF;
 v_earnings:=greatest(0,round(j.hourly_wage*v_duration/60.0));
 v_end_at:=now()+make_interval(mins=>v_duration);
 INSERT INTO public.shift_history(employment_id,profile_id,job_id,shift_date,clock_in_time,
  earnings,health_impact,fame_impact,xp_earned,status)
 VALUES(e.id,p.id,j.id,(now() AT TIME ZONE 'UTC')::date,now(),v_earnings,
  j.health_impact_per_shift,j.fame_impact_per_shift,round(v_earnings/10.0),'in_progress')
 RETURNING * INTO v_shift;
 INSERT INTO public.profile_activity_statuses(profile_id,activity_type,status,started_at,ends_at,metadata)
 VALUES(p.id,'work_shift','active',now(),v_end_at,
  jsonb_build_object('job_id',j.id,'shift_history_id',v_shift.id,'earnings_pending',v_earnings));
 UPDATE public.profiles SET health=greatest(0,coalesce(health,100)+coalesce(j.health_impact_per_shift,0)),
  energy=greatest(0,coalesce(energy,100)-coalesce(j.energy_cost_per_shift,0))
 WHERE id=p.id;
 RETURN v_shift;
END $$;
REVOKE ALL ON FUNCTION public.clock_in_work_shift_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clock_in_work_shift_atomic(uuid,uuid) TO authenticated;
