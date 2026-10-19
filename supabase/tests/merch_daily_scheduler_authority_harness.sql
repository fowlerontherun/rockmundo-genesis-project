-- Production read-only / rollback-only #4249 certification.
BEGIN;
DO $verify$
DECLARE
 v_day date:=(now() at time zone 'UTC')::date;
 v_claim jsonb;
 v_finished boolean;
 v_unauthorized jsonb;
 v_count bigint;
 v_fake_run_id uuid:=gen_random_uuid();
 v_different_run_id uuid:=gen_random_uuid();
 v_order uuid;
 v_band uuid;
BEGIN
 select count(*) into v_count from public.merch_sales_simulation_runs
 where sales_day=v_day and status='completed';
 if v_count<>1 then raise exception 'today_simulation_not_sealed'; end if;

 v_claim:=public.claim_daily_merch_simulation();
 if v_claim->>'claimed' is distinct from 'false'
    or v_claim->>'reason' is distinct from 'already_claimed' then
    raise exception 'merch_simulation_duplicate_daily_claim'; end if;

 select public.finish_daily_merch_simulation(
   gen_random_uuid(),'completed',0,null) into v_finished;
 if v_finished is distinct from false then
   raise exception 'merch_simulation_forged_completion'; end if;

 begin
   perform public.record_simulated_merch_sale_atomic(
    gen_random_uuid(),1,gen_random_uuid(),gen_random_uuid(),null,
    1,20,20,0,0,20,'online','fan','UK',0);
   raise exception 'unknown_merch_run_accepted';
 exception when others then
   if sqlerrm<>'merch_simulation_run_not_active' then raise; end if;
 end;

 if has_function_privilege('anon','public.claim_daily_merch_simulation()','execute')
    or has_function_privilege('authenticated','public.claim_daily_merch_simulation()','execute')
    or has_function_privilege('anon','public.finish_daily_merch_simulation(uuid,text,integer,text)','execute')
    or has_function_privilege('authenticated','public.finish_daily_merch_simulation(uuid,text,integer,text)','execute')
    or has_function_privilege('anon','public.record_simulated_merch_sale_atomic(uuid,integer,uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric)','execute')
    or has_function_privilege('authenticated','public.record_simulated_merch_sale_atomic(uuid,integer,uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric)','execute')
    or not has_function_privilege('service_role','public.claim_daily_merch_simulation()','execute')
    or not has_function_privilege('service_role','public.record_simulated_merch_sale_atomic(uuid,integer,uuid,uuid,uuid,integer,integer,integer,numeric,numeric,numeric,text,text,text,numeric)','execute')
 then raise exception 'merch_simulation_privileged_function_access_drift'; end if;

 if (select count(*) from cron.job where jobid=62 and jobname='simulate-merch-sales-daily'
     and active and schedule='0 6 * * *'
     and command ilike '%vault.decrypted_secrets%'
     and command ilike '%x-cron-secret%'
     and command not ilike '%Bearer %'
     and command not ilike '%eyJ%')<>1
 then raise exception 'merch_simulation_cron_authority_drift'; end if;

 -- Prove that both the per-run sequence and underlying order are unique
 -- using a synthetic receipt that is rolled back. Existing orders are READ
 -- only and no inventory/cash/earnings writes take place.
 SELECT id,band_id INTO v_order,v_band FROM public.merch_orders
 ORDER BY created_at DESC LIMIT 1;
 IF v_order IS NULL THEN RAISE EXCEPTION 'fixture_requires_existing_order'; END IF;
 INSERT INTO public.merch_sales_simulation_runs
   (sales_day,run_id,status) VALUES ('2032-01-01',v_fake_run_id,'running'),
     ('2032-01-02',v_different_run_id,'running');
 INSERT INTO public.merch_simulation_sale_receipts
   (run_id,sale_sequence,order_id,band_id)
 VALUES (v_fake_run_id,1,v_order,v_band);
 BEGIN
   INSERT INTO public.merch_simulation_sale_receipts
     (run_id,sale_sequence,order_id,band_id)
   VALUES (v_fake_run_id,1,v_order,v_band);
   RAISE EXCEPTION 'duplicate_merch_run_sale_allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO public.merch_simulation_sale_receipts
     (run_id,sale_sequence,order_id,band_id)
   VALUES (v_different_run_id,1,v_order,v_band);
   RAISE EXCEPTION 'duplicate_merch_order_receipt_allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;

 if (select count(*) from pg_indexes where schemaname='public'
      and tablename='merch_simulation_sale_receipts' and indexdef ilike '%unique%') < 1
 then raise exception 'merch_simulation_sale_uniqueness_missing'; end if;
END
$verify$;
ROLLBACK;
SELECT 'merch_daily_scheduler_authority_harness_passed' result;
