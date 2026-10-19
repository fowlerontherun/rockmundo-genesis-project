-- #4226: safe to run against production. All calls use synthetic
-- unowned identifiers and all effects are rolled back.
BEGIN;
DO $verify$
DECLARE
  v_target text;
  v_signature text;
  v_dummy uuid := gen_random_uuid();
  v_result text;
  v_count integer:=0;
BEGIN
  FOR v_target,v_signature IN
    SELECT x.name,x.signature FROM (VALUES
      ('increment_user_cash','public.increment_user_cash(uuid,numeric)'),
      ('increment_user_fame','public.increment_user_fame(uuid,numeric)'),
      ('update_player_health','public.update_player_health(uuid,numeric)'),
      ('increment_profile_xp','public.increment_profile_xp(uuid,integer)'),
      ('increment_value','public.increment_value(uuid,numeric)'),
      ('increment_performance_count','public.increment_performance_count(uuid)'),
      ('increment_relationship_score','public.increment_relationship_score(uuid,uuid,text,numeric)')
    ) x(name,signature)
  LOOP
    IF has_function_privilege('anon',v_signature,'execute')
       OR has_function_privilege('authenticated',v_signature,'execute')
       OR NOT has_function_privilege('service_role',v_signature,'execute') THEN
      RAISE EXCEPTION 'unsafe_privileged_helper: %',v_signature;
    END IF;
    v_count:=v_count+1;
  END LOOP;
  IF v_count<>7 THEN RAISE EXCEPTION 'incomplete_helper_matrix'; END IF;

  IF has_function_privilege('anon','public.attend_award_red_carpet_atomic(uuid,uuid,text)','execute')
     OR NOT has_function_privilege('authenticated','public.attend_award_red_carpet_atomic(uuid,uuid,text)','execute')
     OR has_function_privilege('anon','public.send_friend_gift_atomic(uuid,uuid,text,text,uuid)','execute')
     OR NOT has_function_privilege('authenticated','public.send_friend_gift_atomic(uuid,uuid,text,text,uuid)','execute')
     OR has_table_privilege('authenticated','public.award_red_carpet_events','INSERT')
     OR has_table_privilege('authenticated','public.friend_gifts','INSERT') THEN
    RAISE EXCEPTION 'atomic_reward_permission_bypass';
  END IF;

  -- No cash, XP, fame or gift writes against any real account:
  -- fake authenticated identity and fake target IDs must fail closed.
  PERFORM set_config('request.jwt.claim.sub',v_dummy::text,true);
  BEGIN
    PERFORM public.attend_award_red_carpet_atomic(
      gen_random_uuid(),gen_random_uuid(),'custom');
    RAISE EXCEPTION 'red_carpet_accepted_unowned_character';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'red_carpet_profile_not_owned' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.send_friend_gift_atomic(
      gen_random_uuid(),gen_random_uuid(),'flowers',NULL,gen_random_uuid());
    RAISE EXCEPTION 'friend_gift_accepted_unowned_character';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'friend_gift_sender_not_owned' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.attend_award_red_carpet_atomic(
      gen_random_uuid(),gen_random_uuid(),'super_vip');
    RAISE EXCEPTION 'red_carpet_accepted_fake_outfit';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'red_carpet_invalid_outfit' THEN RAISE; END IF;
  END;

  -- Check reward provenance and replay guards in the deployed definitions.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid='public.send_friend_gift_atomic(uuid,uuid,text,text,uuid)'::regprocedure
       AND pg_get_functiondef(p.oid) ILIKE '%FOR UPDATE%'
       AND pg_get_functiondef(p.oid) ILIKE '%friend_gift_insufficient_cash%'
       AND pg_get_functiondef(p.oid) ILIKE '%request_id%'
       AND pg_get_functiondef(p.oid) ILIKE '%affection_score%'
  ) THEN RAISE EXCEPTION 'gift_atomic_contract_drift'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid='public.attend_award_red_carpet_atomic(uuid,uuid,text)'::regprocedure
       AND pg_get_functiondef(p.oid) ILIKE '%outfit_choice%'
       AND pg_get_functiondef(p.oid) ILIKE '%fame = fame + v_fame%'
       AND pg_get_functiondef(p.oid) ILIKE '%status = ''live''%'
  ) THEN RAISE EXCEPTION 'award_atomic_contract_drift'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='friend_gifts'
      AND indexname='friend_gifts_request_id_unique_20261019'
  ) THEN RAISE EXCEPTION 'gift_request_uniqueness_missing'; END IF;
END
$verify$;
ROLLBACK;
SELECT 'privileged_helper_isolation_and_atomic_rewards_passed' AS result;
