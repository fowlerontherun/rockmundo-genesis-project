-- #4216 rollback-only settlement regression; any exception rolls back every fixture.
-- Tests positive city tax, replay, zero pay/XP, negative reward rejection,
-- completed-without-receipt quarantine, and distinct character ownership.
BEGIN;
DO $verify$
DECLARE
 v_emp public.player_employment%rowtype;
 v_other public.player_employment%rowtype;
 v_job public.jobs%rowtype;
 v_profile public.profiles%rowtype;
 v_other_profile public.profiles%rowtype;
 v_shift uuid;
 v_activity uuid;
 v_other_shift uuid;
 v_other_activity uuid;
 v_receipt jsonb;
 v_replay jsonb;
 v_cash bigint;
 v_other_cash bigint;
 v_tax integer;
 v_xp_count integer;
BEGIN
 SELECT e.* INTO v_emp FROM public.player_employment e
 JOIN public.profiles p ON p.id=e.profile_id
 JOIN public.jobs j ON j.id=e.job_id
 WHERE p.user_id IS NOT NULL AND j.city_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.city_laws l WHERE l.city_id=j.city_id
   AND l.effective_until IS NULL AND l.income_tax_rate > 0)
  AND NOT EXISTS (SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
 ORDER BY e.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'need a clean employment in a taxable city'; END IF;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_emp.profile_id;
 SELECT * INTO v_job FROM public.jobs WHERE id=v_emp.job_id;
 v_cash:=coalesce(v_profile.cash,0);

 INSERT INTO public.shift_history (employment_id,profile_id,job_id,shift_date,
   clock_in_time,earnings,health_impact,fame_impact,xp_earned,status)
 VALUES(v_emp.id,v_profile.id,v_job.id,current_date,now()-interval '2 hours',
   200,0,0,25,'in_progress') RETURNING id INTO v_shift;
 INSERT INTO public.profile_activity_statuses (profile_id,activity_type,status,
  started_at,ends_at,metadata)
 VALUES(v_profile.id,'work_shift','active',now()-interval '2 hours',
  now()-interval '1 minute',jsonb_build_object('shift_history_id',v_shift))
 RETURNING id INTO v_activity;
 v_receipt:=public.settle_work_shift_atomic(v_activity,v_shift);
 v_tax:=(v_receipt->>'city_tax')::integer;
 IF v_receipt->>'settled' IS DISTINCT FROM 'true' OR v_tax<=0
  OR (v_receipt->>'gross')::integer<>200
  OR (v_receipt->>'net')::integer<>200-v_tax
  OR (SELECT cash FROM public.profiles WHERE id=v_profile.id) IS DISTINCT FROM v_cash+200-v_tax
  OR (SELECT count(*) FROM public.work_shift_settlements WHERE shift_id=v_shift)<>1
  OR (SELECT count(*) FROM public.experience_ledger WHERE activity_type='work_shift'
       AND metadata->>'shift_id'=v_shift::text AND xp_amount=25)<>1
  OR (SELECT count(*) FROM public.city_treasury_ledger
       WHERE type='employment_income_tax' AND reference_id=v_shift AND amount=v_tax)<>1
  OR (SELECT status FROM public.shift_history WHERE id=v_shift)<>'completed'
  OR EXISTS (SELECT 1 FROM public.profile_activity_statuses WHERE id=v_activity)
 THEN RAISE EXCEPTION 'taxed settlement incomplete: %',v_receipt; END IF;
 v_replay:=public.settle_work_shift_atomic(v_activity,v_shift);
 IF v_replay->>'settled' IS DISTINCT FROM 'false'
  OR (SELECT count(*) FROM public.experience_ledger
      WHERE activity_type='work_shift' AND metadata->>'shift_id'=v_shift::text)<>1
 THEN RAISE EXCEPTION 'replay duplicated settlement'; END IF;

 -- Zero-valued shifts should settle once with a zero XP ledger row and no city tax.
 INSERT INTO public.shift_history (employment_id,profile_id,job_id,shift_date,
   clock_in_time,earnings,xp_earned,status)
 VALUES(v_emp.id,v_profile.id,v_job.id,current_date,now()-interval '1 hour',0,0,'in_progress')
 RETURNING id INTO v_shift;
 INSERT INTO public.profile_activity_statuses (profile_id,activity_type,status,
  started_at,ends_at,metadata)
 VALUES(v_profile.id,'work_shift','active',now()-interval '1 hour',
  now()-interval '1 minute',jsonb_build_object('shift_history_id',v_shift))
 RETURNING id INTO v_activity;
 v_cash:=(SELECT cash FROM public.profiles WHERE id=v_profile.id);
 v_receipt:=public.settle_work_shift_atomic(v_activity,v_shift);
 IF v_receipt->>'settled' IS DISTINCT FROM 'true'
  OR (v_receipt->>'net')::integer<>0 OR (v_receipt->>'xp')::integer<>0
  OR (v_receipt->>'city_tax')::integer<>0
  OR (SELECT cash FROM public.profiles WHERE id=v_profile.id) IS DISTINCT FROM v_cash
  OR (SELECT count(*) FROM public.experience_ledger
      WHERE activity_type='work_shift' AND metadata->>'shift_id'=v_shift::text AND xp_amount=0)<>1
  OR EXISTS (SELECT 1 FROM public.city_treasury_ledger WHERE reference_id=v_shift)
 THEN RAISE EXCEPTION 'zero shift inconsistency'; END IF;

 -- Corrupt negative wages or XP must NOT silently produce a zero-paying receipt.
 FOR v_xp_count IN 1..2 LOOP
  INSERT INTO public.shift_history (employment_id,profile_id,job_id,shift_date,
    clock_in_time,earnings,xp_earned,status)
  VALUES(v_emp.id,v_profile.id,v_job.id,current_date,now()-interval '1 hour',
   CASE WHEN v_xp_count=1 THEN -10 ELSE 10 END,
   CASE WHEN v_xp_count=1 THEN 10 ELSE -10 END,'in_progress')
  RETURNING id INTO v_shift;
  INSERT INTO public.profile_activity_statuses (profile_id,activity_type,status,
    started_at,ends_at,metadata)
  VALUES(v_profile.id,'work_shift','active',now()-interval '1 hour',
   now()-interval '1 minute',jsonb_build_object('shift_history_id',v_shift))
  RETURNING id INTO v_activity;
  BEGIN
   PERFORM public.settle_work_shift_atomic(v_activity,v_shift);
   RAISE EXCEPTION 'accepted_negative_rewards';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM IS DISTINCT FROM 'work_shift_negative_rewards_require_review' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.shift_history WHERE id=v_shift)<>'in_progress'
   OR EXISTS (SELECT 1 FROM public.work_shift_settlements WHERE shift_id=v_shift)
   OR EXISTS (SELECT 1 FROM public.experience_ledger
      WHERE activity_type='work_shift' AND metadata->>'shift_id'=v_shift::text)
  THEN RAISE EXCEPTION 'negative shift had side effects'; END IF;
  DELETE FROM public.profile_activity_statuses WHERE id=v_activity;
 END LOOP;

 -- A legacy completion without a trusted receipt must be flagged, not marked as a clean replay.
 INSERT INTO public.shift_history (employment_id,profile_id,job_id,shift_date,
   clock_in_time,earnings,xp_earned,status)
 VALUES(v_emp.id,v_profile.id,v_job.id,current_date,now()-interval '1 hour',10,10,'completed')
 RETURNING id INTO v_shift;
 BEGIN
  PERFORM public.settle_work_shift_atomic(gen_random_uuid(),v_shift);
  RAISE EXCEPTION 'accepted_unverified_legacy_completion';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM IS DISTINCT FROM 'work_shift_completed_without_receipt_requires_review' THEN RAISE; END IF;
 END;

 SELECT e.* INTO v_other FROM public.player_employment e
 JOIN public.profiles p ON p.id=e.profile_id WHERE p.user_id IS NOT NULL
  AND p.id<>v_profile.id
  AND NOT EXISTS (SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
 ORDER BY e.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'need two distinct profile fixtures'; END IF;
 SELECT * INTO v_other_profile FROM public.profiles WHERE id=v_other.profile_id;
 v_other_cash:=coalesce(v_other_profile.cash,0);
 INSERT INTO public.shift_history (employment_id,profile_id,job_id,shift_date,
   clock_in_time,earnings,xp_earned,status)
 VALUES(v_other.id,v_other.profile_id,v_other.job_id,current_date,
   now()-interval '1 hour',100,8,'in_progress') RETURNING id INTO v_other_shift;
 INSERT INTO public.profile_activity_statuses (profile_id,activity_type,status,
   started_at,ends_at,metadata)
 VALUES(v_other.profile_id,'work_shift','active',now()-interval '1 hour',
   now()-interval '1 minute',jsonb_build_object('shift_history_id',v_other_shift))
 RETURNING id INTO v_other_activity;
 v_receipt:=public.settle_work_shift_atomic(v_other_activity,v_other_shift);
 IF v_receipt->>'settled' IS DISTINCT FROM 'true'
  OR (SELECT cash FROM public.profiles WHERE id=v_other.profile_id)
    IS DISTINCT FROM v_other_cash+(v_receipt->>'net')::integer
  OR (SELECT count(*) FROM public.experience_ledger
    WHERE activity_type='work_shift' AND metadata->>'shift_id'=v_other_shift::text
     AND profile_id=v_other.profile_id AND user_id=v_other_profile.user_id)<>1
 THEN RAISE EXCEPTION 'second profile settlement leaked or mismatched'; END IF;
END;
$verify$;
ROLLBACK;
SELECT 'work_shift_atomic_regression_passed' AS result;
