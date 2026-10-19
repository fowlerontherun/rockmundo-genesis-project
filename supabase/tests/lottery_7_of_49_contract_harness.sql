-- Can be run on a staging or live database: no test fixtures, ticket
-- purchases, draw state changes or player-account writes. All checks roll back.
BEGIN;
DO $check$
DECLARE
  fake_profile uuid := gen_random_uuid();
  fake_draw uuid := gen_random_uuid();
  fake_ticket uuid := gen_random_uuid();
  invalid_test integer[];
  invalid_bonus integer;
  expected text;
  result boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'lottery_test_missing_auth_context';
  END IF;

  -- Exactly 7 valid numbers + bonus passes selection validation, then
  -- stops because no draw exists. A test must never spend real cash.
  BEGIN
    PERFORM public.buy_lottery_ticket_atomic(fake_profile,fake_draw,
      ARRAY[1,7,13,23,35,42,49],10);
    RAISE EXCEPTION 'lottery_test_unexpected_purchase';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'lottery_draw_not_open' THEN RAISE; END IF;
  END;

  -- A selection with 6 main numbers, duplicates, 0 or 50, or invalid
  -- bonus must be rejected before touching the draw or profile.
  FOR invalid_test,invalid_bonus IN
    SELECT x.numbers,x.bonus
    FROM (VALUES
      (ARRAY[1,2,3,4,5,6]::integer[],1),
      (ARRAY[1,2,3,4,5,6,6]::integer[],1),
      (ARRAY[0,2,3,4,5,6,7]::integer[],1),
      (ARRAY[1,2,3,4,5,6,50]::integer[],1),
      (ARRAY[1,2,3,4,5,6,7]::integer[],0),
      (ARRAY[1,2,3,4,5,6,7]::integer[],11),
      (NULL::integer[],1),
      (ARRAY[1,2,3,4,5,6,7]::integer[],NULL::integer)
    ) x(numbers,bonus)
  LOOP
    BEGIN
      PERFORM public.buy_lottery_ticket_atomic(fake_profile,fake_draw,invalid_test,invalid_bonus);
      RAISE EXCEPTION 'lottery_test_accepted_invalid_selection';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'invalid_lottery_selection' THEN RAISE; END IF;
    END;
  END LOOP;

  -- 7 matches must pass bound validation (nonexistent ticket yields false);
  -- 8 matches must fail even for a nonexistent ticket.
  result := public.settle_lottery_ticket_atomic(fake_ticket,7,true,2,0,0);
  IF result IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'lottery_test_settlement_did_not_return_false';
  END IF;
  BEGIN
    PERFORM public.settle_lottery_ticket_atomic(fake_ticket,8,true,2,0,0);
    RAISE EXCEPTION 'lottery_test_accepted_eight_matches';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invalid_lottery_settlement' THEN RAISE; END IF;
  END;

  -- The deployed processor must continue to select seven numbers from 49,
  -- use a 1..10 bonus, refund $2 for three matches and award real jackpot.
  IF NOT (
    pg_get_functiondef('public.process_weekly_lottery_draw()'::regprocedure) LIKE '%n:=floor(random()*49)%'
    AND pg_get_functiondef('public.process_weekly_lottery_draw()'::regprocedure) LIKE '%bonus:=floor(random()*10)%'
    AND pg_get_functiondef('public.process_weekly_lottery_draw()'::regprocedure) LIKE '%elsif matches=3 then cash:=2%'
    AND pg_get_functiondef('public.process_weekly_lottery_draw()'::regprocedure) LIKE '%cash:=d.jackpot_amount%'
  ) THEN RAISE EXCEPTION 'lottery_test_draw_contract_drift'; END IF;

  -- Browser must never be able to invoke the privileged payout helper.
  IF has_function_privilege('authenticated','public.settle_lottery_ticket_atomic(uuid,integer,boolean,integer,integer,integer)','execute')
     OR has_function_privilege('anon','public.settle_lottery_ticket_atomic(uuid,integer,boolean,integer,integer,integer)','execute')
     OR NOT has_function_privilege('authenticated','public.buy_lottery_ticket_atomic(uuid,uuid,integer[],integer)','execute')
  THEN RAISE EXCEPTION 'lottery_test_rpc_privilege_drift'; END IF;
END
$check$;
ROLLBACK;
SELECT 'lottery_7_of_49_contract_harness_passed' AS result;
