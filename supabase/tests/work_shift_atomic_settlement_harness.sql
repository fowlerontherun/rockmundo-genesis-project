-- Production rollback-only verification, 18 Oct 2026.
-- No real shift, cash, XP, tax or band morale persists.
BEGIN;
DO $work_test$
DECLARE
 v_employment public.player_employment%rowtype;
 v_job public.jobs%rowtype;
 v_profile public.profiles%rowtype;
 v_shift uuid;
 v_activity uuid;
 v_first jsonb;
 v_again jsonb;
 v_before_cash bigint;
 v_before_shifts int;
 v_before_xp int;
 v_before_receipts bigint;
BEGIN
 SELECT e.* INTO v_employment FROM public.player_employment e
 JOIN public.profiles p ON p.id=e.profile_id
 WHERE p.user_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
 LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'no clean employment test fixture'; END IF;
 SELECT * INTO v_job FROM public.jobs WHERE id=v_employment.job_id;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_employment.profile_id;
 v_before_cash:=v_profile.cash;
 v_before_shifts:=v_employment.shifts_completed;
 SELECT count(*) INTO v_before_xp FROM public.experience_ledger
 WHERE profile_id=v_profile.id AND activity_type='work_shift';
 SELECT count(*) INTO v_before_receipts FROM public.work_shift_settlements;

 INSERT INTO public.shift_history(employment_id,profile_id,job_id,shift_date,
  clock_in_time,earnings,health_impact,fame_impact,xp_earned,status)
 VALUES(v_employment.id,v_profile.id,v_job.id,current_date,
  now()-interval '2 hours',100,0,0,10,'in_progress')
 RETURNING id INTO v_shift;
 INSERT INTO public.profile_activity_statuses(profile_id,activity_type,status,
  started_at,ends_at,metadata)
 VALUES(v_profile.id,'work_shift','active',now()-interval '2 hours',
  now()-interval '1 minute',jsonb_build_object('shift_history_id',v_shift))
 RETURNING id INTO v_activity;
 v_first:=public.settle_work_shift_atomic(v_activity,v_shift);
 IF v_first->>'settled' IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'initial settle failed: %',v_first; END IF;
 v_again:=public.settle_work_shift_atomic(v_activity,v_shift);
 IF v_again->>'settled' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'repeat settle paid twice %',v_again; END IF;
 IF (SELECT count(*) FROM public.work_shift_settlements) <> v_before_receipts+1
  OR (SELECT count(*) FROM public.experience_ledger
       WHERE profile_id=v_profile.id AND activity_type='work_shift') <> v_before_xp+1
  OR (SELECT shifts_completed FROM public.player_employment
       WHERE id=v_employment.id) IS DISTINCT FROM v_before_shifts+1
  OR (SELECT cash FROM public.profiles WHERE id=v_profile.id)
       IS DISTINCT FROM v_before_cash+(v_first->>'net')::integer
  OR EXISTS(SELECT 1 FROM public.profile_activity_statuses WHERE id=v_activity)
 THEN RAISE EXCEPTION 'atomic settlement side effects inconsistent'; END IF;
 IF has_function_privilege('anon','public.settle_work_shift_atomic(uuid,uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.settle_work_shift_atomic(uuid,uuid)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.settle_work_shift_atomic(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'RPC EXECUTE grants unsafe'; END IF;
END;
$work_test$;
ROLLBACK;
