-- P0 #4222: BEGIN/ROLLBACK production-safe authoritative casino tests.
BEGIN;

CREATE TEMP TABLE casino_fixture AS
WITH chosen AS (
 SELECT p.id profile_id,p.user_id,p.cash
 FROM public.profiles p WHERE p.cash>=2000
   AND p.id=public.current_active_player_profile_id()
 LIMIT 1
)
SELECT * FROM chosen;
-- Fallback: simulate an actual active session using a real high-balance user.
DO $setup$
DECLARE v_user uuid;
BEGIN
 SELECT user_id INTO v_user FROM public.profiles p
 WHERE cash>=2000 AND id=(
   SELECT p2.id FROM public.profiles p2
   WHERE p2.user_id=p.user_id AND p2.is_active=true
     AND p2.died_at IS NULL AND p2.deleted_at IS NULL
   ORDER BY p2.updated_at DESC NULLS LAST,p2.created_at DESC NULLS LAST,p2.id LIMIT 1)
 ORDER BY p.user_id LIMIT 1;
 IF v_user IS NULL THEN RAISE EXCEPTION 'casino fixture user unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
END;
$setup$;

CREATE TEMP TABLE casino_initial AS
SELECT id,user_id,cash FROM public.profiles WHERE user_id=auth.uid();

CREATE TEMP TABLE casino_roulette AS
SELECT public.play_casino_round_authoritative(
  'roulette',100,'{"bets":[{"type":"red","amount":100}]}'::jsonb,
  '10000000-0000-4000-8000-000000000002'::uuid
) AS result;

CREATE TEMP TABLE casino_replay AS
SELECT public.play_casino_round_authoritative(
  'roulette',100,'{"bets":[{"type":"red","amount":100}]}'::jsonb,
  '10000000-0000-4000-8000-000000000002'::uuid
) AS result;

CREATE TEMP TABLE casino_slots AS
SELECT public.play_casino_round_authoritative(
  'slots',100,'{}'::jsonb,
  '10000000-0000-4000-8000-000000000003'::uuid
) AS result;

CREATE TEMP TABLE casino_exceptions(name text, rejected boolean);
DO $negative$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 BEGIN
   PERFORM public.play_casino_round_authoritative('roulette',100,
     '{"bets":[{"type":"red","amount":100}],"payout":3600}'::jsonb,
     '10000000-0000-4000-8000-000000000004'::uuid);
   INSERT INTO casino_exceptions VALUES ('forged_payout',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'CASINO_ROULETTE_BET_COUNT%' THEN RAISE; END IF;
   INSERT INTO casino_exceptions VALUES ('forged_payout',true);
 END;
 BEGIN
   PERFORM public.play_casino_round_authoritative('roulette',100,
     '{"bets":[{"type":"straight","number":36,"amount":10}]}'::jsonb,
     '10000000-0000-4000-8000-000000000005'::uuid);
   INSERT INTO casino_exceptions VALUES ('bet_sum',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'CASINO_ROULETTE_STAKE_MISMATCH%' THEN RAISE; END IF;
   INSERT INTO casino_exceptions VALUES ('bet_sum',true);
 END;
 BEGIN
   PERFORM public.play_casino_round_authoritative('slots',100,
     '{"reels":["diamond","diamond","diamond"],"payout":5000}'::jsonb,
     '10000000-0000-4000-8000-000000000006'::uuid);
   INSERT INTO casino_exceptions VALUES ('claimed_reels',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'CASINO_SLOTS_INVALID_CHOICES%' THEN RAISE; END IF;
   INSERT INTO casino_exceptions VALUES ('claimed_reels',true);
 END;
 BEGIN
   PERFORM public.play_casino_round_authoritative('blackjack',100,'{}'::jsonb,
     '10000000-0000-4000-8000-000000000007'::uuid);
   INSERT INTO casino_exceptions VALUES ('unsupported_game',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'CASINO_GAME_NOT_YET_SERVER_AUTHORIZED%' THEN RAISE; END IF;
   INSERT INTO casino_exceptions VALUES ('unsupported_game',true);
 END;
 BEGIN
   PERFORM public.play_casino_round_authoritative('roulette',100,'{"bets":[{"type":"black","amount":100}]}'::jsonb,
     '10000000-0000-4000-8000-000000000002'::uuid);
   INSERT INTO casino_exceptions VALUES ('same_id_different_choices',false);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'CASINO_REQUEST_CONFLICT%' THEN RAISE; END IF;
   INSERT INTO casino_exceptions VALUES ('same_id_different_choices',true);
 END;
END;
$negative$;

SELECT
 (SELECT result->>'roundId' FROM casino_roulette)=(SELECT result->>'roundId' FROM casino_replay) replay_same_receipt,
 (SELECT result->>'alreadyCompleted' FROM casino_replay)='true' replay_not_paid_twice,
 (SELECT result->>'alreadyCompleted' FROM casino_roulette)='false' first_round_completed,
 (SELECT (result->>'payout')::int IN (0,200) FROM casino_roulette) roulette_payout_is_real,
 (SELECT CASE WHEN (result#>>'{outcome,result}')::int=0 THEN (result->>'payout')::int=0
        WHEN (result#>>'{outcome,result}')::int=ANY(ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
          THEN (result->>'payout')::int=200
        ELSE (result->>'payout')::int=0 END FROM casino_roulette) roulette_result_corresponds_to_payout,
 (SELECT jsonb_array_length(result#>'{outcome,reels}')=3 FROM casino_slots) three_server_reels,
 (SELECT (result->>'payout')::int=100*(result#>>'{outcome,multiplier}')::int FROM casino_slots) slots_multiplier_valid,
 (SELECT count(*)=2 FROM public.casino_transactions WHERE metadata ? 'request_id'
   AND profile_id=public.current_active_player_profile_id()) two_unique_ledger_entries,
 (SELECT p.cash=i.cash+
        (r.result->>'netResult')::bigint+(s.result->>'netResult')::bigint
  FROM public.profiles p JOIN casino_initial i ON p.id=i.id
   CROSS JOIN casino_roulette r CROSS JOIN casino_slots s
  WHERE p.id=public.current_active_player_profile_id()) cash_settled_once,
 NOT EXISTS(SELECT 1 FROM public.profiles p JOIN casino_initial i ON i.id=p.id
    WHERE p.id<>public.current_active_player_profile_id() AND p.cash<>i.cash) other_characters_unchanged,
 (SELECT count(*)=5 AND bool_and(rejected) FROM casino_exceptions) all_forged_requests_rejected,
 NOT has_function_privilege('anon','public.play_casino_round(text,numeric,numeric,jsonb)','EXECUTE') old_anon_denied,
 NOT has_function_privilege('authenticated','public.play_casino_round(text,numeric,numeric,jsonb)','EXECUTE') old_browser_denied,
 NOT has_table_privilege('authenticated','public.casino_transactions','INSERT') direct_ledger_insert_denied,
 has_function_privilege('authenticated','public.play_casino_round_authoritative(text,integer,jsonb,uuid)','EXECUTE') new_browser_rpc_allowed,
 NOT has_function_privilege('anon','public.play_casino_round_authoritative(text,integer,jsonb,uuid)','EXECUTE') new_anon_rpc_denied;

ROLLBACK;
