-- #4216 step-by-step crash recovery certification. Disposable LOCAL DATABASE ONLY.
-- Never run against production: CREATE TRIGGER locks settlement tables until rollback.
-- Run with PGOPTIONS='-c app.allow_test_fixtures=true' on local Postgres.
BEGIN;
DO $gate$ BEGIN
 IF current_setting('app.allow_test_fixtures',true) IS DISTINCT FROM 'true'
 THEN RAISE EXCEPTION 'refusing trigger-based tests outside a disposable database'; END IF;
END $gate$;
CREATE OR REPLACE FUNCTION pg_temp.work_shift_fail_step() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
 v_match boolean:=false;
 v_shift text:=current_setting('app.work_shift_test_id',true);
 v_profile text:=current_setting('app.work_shift_test_profile',true);
 v_employment text:=current_setting('app.work_shift_test_employment',true);
BEGIN
 CASE TG_TABLE_NAME
  WHEN 'city_treasury_ledger' THEN v_match:=NEW.reference_id::text=v_shift;
  WHEN 'shift_history' THEN v_match:=NEW.id::text=v_shift;
  WHEN 'player_employment' THEN v_match:=NEW.id::text=v_employment;
  WHEN 'profiles' THEN v_match:=NEW.id::text=v_profile;
  WHEN 'experience_ledger' THEN v_match:=NEW.metadata->>'shift_id'=v_shift;
  WHEN 'profile_activity_statuses' THEN v_match:=OLD.id::text=current_setting('app.work_shift_test_activity',true);
  WHEN 'work_shift_settlements' THEN v_match:=NEW.shift_id::text=v_shift;
 END CASE;
 IF v_match AND current_setting('app.work_shift_fail_at',true)=TG_TABLE_NAME
 THEN RAISE EXCEPTION 'injected_work_shift_step_failure'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER test_work_shift_tax AFTER INSERT ON public.city_treasury_ledger
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_status AFTER UPDATE ON public.shift_history
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_employment AFTER UPDATE ON public.player_employment
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_cash AFTER UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_xp AFTER INSERT ON public.experience_ledger
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_activity AFTER DELETE ON public.profile_activity_statuses
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
CREATE TRIGGER test_work_shift_receipt AFTER INSERT ON public.work_shift_settlements
 FOR EACH ROW EXECUTE FUNCTION pg_temp.work_shift_fail_step();
DO $verify$
DECLARE
 v_emp public.player_employment%rowtype;
 v_job public.jobs%rowtype;
 v_shift uuid;
 v_activity uuid;
 v_cash_before bigint;
 v_employment_before integer;
 v_treasury_before bigint;
 v_receipt jsonb;
 v_stage text;
BEGIN
 SELECT e.* INTO v_emp FROM public.player_employment e
 JOIN public.profiles p ON p.id=e.profile_id JOIN public.jobs j ON j.id=e.job_id
 WHERE p.user_id IS NOT NULL AND j.city_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
 AND (SELECT greatest(0,least(50,l.income_tax_rate))
    FROM public.city_laws l WHERE l.city_id=j.city_id AND l.effective_until IS NULL
    ORDER BY l.effective_from DESC LIMIT 1)>0
 ORDER BY e.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'taxable clean fixture missing'; END IF;
 SELECT * INTO v_job FROM public.jobs WHERE id=v_emp.job_id;
 PERFORM set_config('app.work_shift_test_employment',v_emp.id::text,true);
 PERFORM set_config('app.work_shift_test_profile',v_emp.profile_id::text,true);
 FOR v_stage IN SELECT unnest(ARRAY['city_treasury_ledger','shift_history',
  'player_employment','profiles','experience_ledger',
  'profile_activity_statuses','work_shift_settlements']) LOOP
  INSERT INTO public.shift_history(employment_id,profile_id,job_id,shift_date,
    clock_in_time,earnings,xp_earned,status)
  VALUES(v_emp.id,v_emp.profile_id,v_job.id,current_date,now()-interval '2 hours',
    200,20,'in_progress') RETURNING id INTO v_shift;
  INSERT INTO public.profile_activity_statuses(profile_id,activity_type,status,
    started_at,ends_at,metadata)
  VALUES(v_emp.profile_id,'work_shift','active',now()-interval '2 hours',
   now()-interval '1 minute',jsonb_build_object('shift_history_id',v_shift))
  RETURNING id INTO v_activity;
  v_cash_before:=(SELECT coalesce(cash,0) FROM public.profiles WHERE id=v_emp.profile_id);
  v_employment_before:=(SELECT coalesce(shifts_completed,0) FROM public.player_employment WHERE id=v_emp.id);
  v_treasury_before:=(SELECT coalesce(balance,0) FROM public.city_treasury WHERE city_id=v_job.city_id);
  PERFORM set_config('app.work_shift_test_id',v_shift::text,true);
  PERFORM set_config('app.work_shift_test_activity',v_activity::text,true);
  PERFORM set_config('app.work_shift_fail_at',v_stage,true);
  BEGIN
   PERFORM public.settle_work_shift_atomic(v_activity,v_shift);
   RAISE EXCEPTION 'injection did not fail at %',v_stage;
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'injected_work_shift_step_failure' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.shift_history WHERE id=v_shift)<>'in_progress'
   OR (SELECT coalesce(cash,0) FROM public.profiles WHERE id=v_emp.profile_id)<>v_cash_before
   OR (SELECT coalesce(shifts_completed,0) FROM public.player_employment WHERE id=v_emp.id)<>v_employment_before
   OR (SELECT coalesce(balance,0) FROM public.city_treasury WHERE city_id=v_job.city_id)<>v_treasury_before
   OR EXISTS(SELECT 1 FROM public.work_shift_settlements WHERE shift_id=v_shift)
   OR EXISTS(SELECT 1 FROM public.experience_ledger WHERE activity_type='work_shift'
     AND metadata->>'shift_id'=v_shift::text)
   OR EXISTS(SELECT 1 FROM public.city_treasury_ledger WHERE reference_id=v_shift)
   OR NOT EXISTS(SELECT 1 FROM public.profile_activity_statuses WHERE id=v_activity)
  THEN RAISE EXCEPTION 'partial transaction leaked after injection at %',v_stage; END IF;
  PERFORM set_config('app.work_shift_fail_at','',true);
  v_receipt:=public.settle_work_shift_atomic(v_activity,v_shift);
  IF v_receipt->>'settled' IS DISTINCT FROM 'true'
   OR (SELECT count(*) FROM public.work_shift_settlements WHERE shift_id=v_shift)<>1
   OR (SELECT count(*) FROM public.experience_ledger WHERE activity_type='work_shift'
     AND metadata->>'shift_id'=v_shift::text)<>1
  THEN RAISE EXCEPTION 'retry after injected % did not settle once',v_stage; END IF;
 END LOOP;
END $verify$;
ROLLBACK;
SELECT 'work_shift_failure_injection_passed' AS result;
