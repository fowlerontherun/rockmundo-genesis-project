-- Guard against retrying a partially credited legacy shift. Rollback-only.
BEGIN;
DO $test$
DECLARE v_emp public.player_employment%rowtype;v_profile public.profiles%rowtype;
 v_shift uuid;v_activity uuid;v_before_cash bigint;v_before_receipts bigint;v_before_treasury bigint;
BEGIN
 SELECT e.* INTO v_emp FROM public.player_employment e JOIN public.profiles p ON p.id=e.profile_id
 WHERE p.user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id) LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'No clean fixture'; END IF;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_emp.profile_id;
 v_before_cash:=v_profile.cash;
 SELECT count(*) INTO v_before_receipts FROM public.work_shift_settlements;
 SELECT count(*) INTO v_before_treasury FROM public.city_treasury_ledger;
 INSERT INTO public.shift_history(employment_id,profile_id,job_id,shift_date,clock_in_time,earnings,xp_earned,status)
 VALUES(v_emp.id,v_profile.id,v_emp.job_id,current_date,now()-interval '2 hours',200,20,'in_progress') RETURNING id INTO v_shift;
 INSERT INTO public.profile_activity_statuses(profile_id,activity_type,status,started_at,ends_at,metadata)
 VALUES(v_profile.id,'work_shift','active',now()-interval '2 hours',now()-interval '1 minute',
  jsonb_build_object('shift_history_id',v_shift)) RETURNING id INTO v_activity;
 INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata)
 VALUES(v_profile.user_id,v_profile.id,'work_shift',20,jsonb_build_object('shift_id',v_shift));
 BEGIN
  PERFORM public.settle_work_shift_atomic(v_activity,v_shift);
  RAISE EXCEPTION 'accepted pre-existing partial settlement';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'work_shift_existing_partial_settlement_requires_review' THEN RAISE; END IF;
 END;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile.id) IS DISTINCT FROM v_before_cash
   OR (SELECT count(*) FROM public.work_shift_settlements)<>v_before_receipts
   OR (SELECT count(*) FROM public.city_treasury_ledger)<>v_before_treasury
   OR (SELECT status FROM public.shift_history WHERE id=v_shift)<>'in_progress'
 THEN RAISE EXCEPTION 'rejected partial settlement left side effects'; END IF;
END;
$test$;
ROLLBACK;
