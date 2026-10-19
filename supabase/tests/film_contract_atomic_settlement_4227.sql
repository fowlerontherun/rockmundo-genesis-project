-- #4227; BEGIN/ROLLBACK, safe against live game state.
BEGIN;
DO $test$
DECLARE v_p record;v_film uuid;v_id uuid;v_a uuid;
  v_out jsonb;v_second jsonb;v_cash bigint;v_fame integer;
BEGIN
 IF has_function_privilege('authenticated','public.settle_film_contract_atomic(uuid,uuid)','execute')
  OR has_function_privilege('anon','public.settle_film_contract_atomic(uuid,uuid)','execute')
  OR NOT has_function_privilege('service_role','public.settle_film_contract_atomic(uuid,uuid)','execute')
  OR has_table_privilege('authenticated','public.film_contract_settlements','select')
 THEN RAISE EXCEPTION 'film_settlement_untrusted_roles_allowed'; END IF;
 SELECT p.id,p.user_id,p.cash,p.fame INTO v_p
 FROM public.profiles p JOIN auth.users u ON u.id=p.user_id
 ORDER BY p.created_at LIMIT 1 FOR UPDATE OF p;
 SELECT id INTO v_film FROM public.film_productions ORDER BY id LIMIT 1;
 IF v_p.id IS NULL OR v_film IS NULL
 THEN RAISE EXCEPTION 'film_fixture_missing'; END IF;

 INSERT INTO public.player_film_contracts
 (user_id,film_id,status,role_type,contract_year,
 compensation,fame_boost,filming_start_date,filming_end_date)
 VALUES(v_p.user_id,v_film,'accepted','cameo',2026,123,9,current_date-5,current_date-2)
 RETURNING id INTO v_id;
 INSERT INTO public.player_scheduled_activities
 (user_id,profile_id,activity_type,title,scheduled_start,scheduled_end,status,metadata)
 VALUES(v_p.user_id,v_p.id,'film_production','Rollback-only film fixture',
   now()-interval '3 days',now()-interval '2 days','in_progress',
   jsonb_build_object('contract_id',v_id))
 RETURNING id INTO v_a;

 v_out:=public.settle_film_contract_atomic(v_a,v_id);
 v_second:=public.settle_film_contract_atomic(v_a,v_id);
 IF v_out->>'settled' <> 'true' OR v_second->>'reason'<>'already_settled'
  OR (v_out->>'compensation_amount')::integer <> 123
  OR (v_out->>'fame_amount')::integer <> 9
 THEN RAISE EXCEPTION 'film_cash_fame_double_settlement'; END IF;
 SELECT cash,fame INTO v_cash,v_fame FROM public.profiles WHERE id=v_p.id;
 IF v_cash<>v_p.cash+123 OR v_fame<>v_p.fame+9
 THEN RAISE EXCEPTION 'film_profile_reward_incorrect'; END IF;
 IF (SELECT count(*) FROM public.film_contract_settlements
     WHERE contract_id=v_id AND activity_id=v_a)<>1
  OR (SELECT status FROM public.player_film_contracts WHERE id=v_id)<>'completed'
  OR (SELECT status FROM public.player_scheduled_activities WHERE id=v_a)<>'completed'
 THEN RAISE EXCEPTION 'film_receipt_or_schedule_commit_incomplete'; END IF;

 BEGIN
  PERFORM public.settle_film_contract_atomic(v_a,gen_random_uuid());
  RAISE EXCEPTION 'film_forged_contract_allowed';
 EXCEPTION WHEN others THEN
  IF SQLERRM<>'film_settlement_schedule_mismatch' THEN RAISE; END IF;
 END;
END $test$;
ROLLBACK;
SELECT 'film_contract_atomic_settlement_passed' result;
