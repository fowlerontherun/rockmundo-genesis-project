-- #4222: retire browser-selected winnings. All playable outcomes, payouts,
-- profile debits and receipts are owned by one locked PostgreSQL transaction.
-- The original schema incorrectly linked profile_id -> auth.users(id).
-- This table has no production history; preserve character identity with
-- the real profiles(id) FK and read RLS before enabling new game entries.
ALTER TABLE public.casino_transactions
  DROP CONSTRAINT casino_transactions_profile_id_fkey;
ALTER TABLE public.casino_transactions
  ADD CONSTRAINT casino_transactions_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "Users can read own casino transactions" ON public.casino_transactions;
CREATE POLICY "Users can read own casino transactions" ON public.casino_transactions
 FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.profiles p
   WHERE p.id=casino_transactions.profile_id AND p.user_id=auth.uid()));

REVOKE ALL ON FUNCTION public.play_casino_round(text,numeric,numeric,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.casino_transactions
  FROM PUBLIC,anon,authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS casino_transactions_request_id_unique
 ON public.casino_transactions ((metadata->>'request_id'))
 WHERE metadata ? 'request_id';

-- Rejection sampling from pgcrypto bytes (avoids modulo bias).
CREATE OR REPLACE FUNCTION public.casino_secure_index(p_range integer)
RETURNS integer LANGUAGE plpgsql VOLATILE
SET search_path='' AS $fn$
DECLARE v_byte integer; v_limit integer;
BEGIN
 IF p_range IS NULL OR p_range<2 OR p_range>256 THEN
   RAISE EXCEPTION 'CASINO_INVALID_RANDOM_RANGE';
 END IF;
 v_limit:=(256/p_range)*p_range;
 LOOP
   v_byte:=get_byte(extensions.gen_random_bytes(1),0);
   IF v_byte<v_limit THEN RETURN v_byte%p_range; END IF;
 END LOOP;
END;
$fn$;
REVOKE ALL ON FUNCTION public.casino_secure_index(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.casino_secure_index(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.play_casino_round_authoritative(
 p_game_type text,
 p_bet_amount integer,
 p_choices jsonb,
 p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_profile_id uuid;
 v_cash bigint;
 v_prior public.casino_transactions%ROWTYPE;
 v_result jsonb:='{}'::jsonb;
 v_choices jsonb:=coalesce(p_choices,'{}'::jsonb);
 v_bet jsonb;
 v_bet_type text;
 v_amount integer;
 v_number integer;
 v_roll integer;
 v_payout bigint:=0;
 v_multiplier integer;
 v_slot text;
 v_symbols text[]:=ARRAY[]::text[];
 v_a text; v_b text; v_c text;
 v_slot_index integer;
 v_num_bets integer;
 v_total_bet bigint:=0;
 v_developed boolean:=false;
 v_addiction uuid;
 v_transaction_id uuid;
 v_new_cash bigint;
 v_net bigint;
 v_roulette_red integer[]:=ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'CASINO_UNAUTHENTICATED'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'CASINO_REQUEST_ID_REQUIRED'; END IF;
 IF p_game_type NOT IN ('slots','roulette') THEN
   RAISE EXCEPTION 'CASINO_GAME_NOT_YET_SERVER_AUTHORIZED';
 END IF;
 IF p_bet_amount IS NULL OR p_bet_amount<10 OR p_bet_amount>10000 THEN
   RAISE EXCEPTION 'CASINO_BET_OUT_OF_RANGE';
 END IF;

 -- Serialize wallet changes and repeated requests for this character.
 v_profile_id:=public.current_active_player_profile_id();
 IF v_profile_id IS NULL THEN RAISE EXCEPTION 'CASINO_ACTIVE_CHARACTER_REQUIRED'; END IF;
 SELECT cash INTO v_cash FROM public.profiles
 WHERE id=v_profile_id AND user_id=v_user AND is_active IS TRUE
   AND died_at IS NULL AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CASINO_ACTIVE_CHARACTER_REQUIRED'; END IF;

 -- Request ID is globally unique: a character switch cannot reuse a
 -- completed request to debit a second profile.
 SELECT * INTO v_prior FROM public.casino_transactions
 WHERE metadata->>'request_id'=p_request_id::text;
 IF FOUND THEN
   IF v_prior.profile_id<>v_profile_id OR v_prior.game_type<>p_game_type OR
     v_prior.bet_amount<>p_bet_amount OR
     coalesce(v_prior.metadata->'choices','{}'::jsonb)<>v_choices THEN
     RAISE EXCEPTION 'CASINO_REQUEST_CONFLICT';
   END IF;
   RETURN jsonb_build_object('alreadyCompleted',true,'roundId',v_prior.id,
     'netResult',v_prior.net_result,'payout',v_prior.payout,
     'newCash',v_cash,'outcome',v_prior.metadata->'outcome',
     'developedAddiction',false);
 END IF;

 IF v_cash<p_bet_amount THEN RAISE EXCEPTION 'insufficient_funds'; END IF;

 IF p_game_type='slots' THEN
   IF v_choices<>'{}'::jsonb THEN RAISE EXCEPTION 'CASINO_SLOTS_INVALID_CHOICES'; END IF;
   FOR v_slot_index IN 1..3 LOOP
     v_roll:=public.casino_secure_index(44);
     v_slot:=CASE
       WHEN v_roll<2 THEN 'diamond'
       WHEN v_roll<6 THEN 'star'
       WHEN v_roll<14 THEN 'guitar'
       WHEN v_roll<22 THEN 'microphone'
       WHEN v_roll<32 THEN 'drums'
       ELSE 'vinyl' END;
     v_symbols:=array_append(v_symbols,v_slot);
   END LOOP;
   v_a:=v_symbols[1];v_b:=v_symbols[2];v_c:=v_symbols[3];
   v_multiplier:=CASE
     WHEN v_a=v_b AND v_b=v_c THEN CASE v_a
       WHEN 'diamond' THEN 50 WHEN 'star' THEN 25
       WHEN 'guitar' THEN 10 WHEN 'microphone' THEN 10
       WHEN 'drums' THEN 8 ELSE 5 END
     WHEN v_a=v_b OR v_b=v_c OR v_a=v_c THEN 2
     ELSE 0 END;
   v_payout:=p_bet_amount::bigint*v_multiplier;
   v_result:=jsonb_build_object('reels',to_jsonb(v_symbols),
     'multiplier',v_multiplier,'isJackpot',v_multiplier=50,
     'matchType',CASE WHEN v_multiplier=0 THEN NULL
       WHEN v_a=v_b AND v_b=v_c THEN 'Three '||v_a||'s'
       ELSE 'Pair' END);
 ELSE
   IF jsonb_typeof(v_choices)<>'object' OR
      jsonb_typeof(v_choices->'bets')<>'array' THEN
     RAISE EXCEPTION 'CASINO_ROULETTE_BETS_REQUIRED';
   END IF;
   v_num_bets:=jsonb_array_length(v_choices->'bets');
   IF v_num_bets<1 OR v_num_bets>50 OR (SELECT count(*) FROM jsonb_object_keys(v_choices))<>1 THEN
     RAISE EXCEPTION 'CASINO_ROULETTE_BET_COUNT';
   END IF;
   -- A single cryptographically generated server roll applies to all bets.
   v_number:=public.casino_secure_index(37);
   FOR v_bet IN SELECT value FROM jsonb_array_elements(v_choices->'bets') LOOP
     IF jsonb_typeof(v_bet)<>'object' OR
       coalesce(v_bet->>'type','') NOT IN
         ('straight','red','black','odd','even','low','high',
          'dozen1','dozen2','dozen3','col1','col2','col3')
     THEN RAISE EXCEPTION 'CASINO_ROULETTE_BAD_BET'; END IF;
     v_bet_type:=v_bet->>'type';
     IF coalesce(v_bet->>'amount','') !~ '^[0-9]{1,5}$' THEN
       RAISE EXCEPTION 'CASINO_ROULETTE_INVALID_STAKE'; END IF;
     v_amount:=(v_bet->>'amount')::integer;
     IF v_amount<1 OR v_amount>10000 THEN
       RAISE EXCEPTION 'CASINO_ROULETTE_INVALID_STAKE'; END IF;
     IF v_bet_type='straight' THEN
       IF coalesce(v_bet->>'number','') !~ '^([0-9]|[12][0-9]|3[0-6])$'
         THEN RAISE EXCEPTION 'CASINO_ROULETTE_INVALID_NUMBER'; END IF;
       v_roll:=(v_bet->>'number')::integer;
     ELSIF v_bet ? 'number' THEN
       RAISE EXCEPTION 'CASINO_ROULETTE_UNEXPECTED_NUMBER';
     END IF;
     v_total_bet:=v_total_bet+v_amount;
     v_multiplier:=0;
     IF (v_bet_type='straight' AND v_roll=v_number) THEN
       v_multiplier:=36;
     ELSIF v_number<>0 THEN
       IF (v_bet_type='red' AND v_number=ANY(v_roulette_red)) OR
          (v_bet_type='black' AND NOT v_number=ANY(v_roulette_red)) OR
          (v_bet_type='odd' AND v_number%2=1) OR
          (v_bet_type='even' AND v_number%2=0) OR
          (v_bet_type='low' AND v_number<=18) OR
          (v_bet_type='high' AND v_number>=19) THEN v_multiplier:=2;
       ELSIF (v_bet_type='dozen1' AND v_number<=12) OR
             (v_bet_type='dozen2' AND v_number BETWEEN 13 AND 24) OR
             (v_bet_type='dozen3' AND v_number>=25) OR
             (v_bet_type='col1' AND v_number%3=1) OR
             (v_bet_type='col2' AND v_number%3=2) OR
             (v_bet_type='col3' AND v_number%3=0) THEN v_multiplier:=3;
       END IF;
     END IF;
     v_payout:=v_payout+v_amount::bigint*v_multiplier;
   END LOOP;
   IF v_total_bet<>p_bet_amount THEN
     RAISE EXCEPTION 'CASINO_ROULETTE_STAKE_MISMATCH'; END IF;
   v_result:=jsonb_build_object('result',v_number,
     'color',CASE WHEN v_number=0 THEN 'green'
       WHEN v_number=ANY(v_roulette_red) THEN 'red' ELSE 'black' END);
 END IF;

 v_net:=v_payout-p_bet_amount;
 UPDATE public.profiles SET cash=cash+v_net
 WHERE id=v_profile_id AND user_id=v_user AND cash>=p_bet_amount
 RETURNING cash INTO v_new_cash;
 IF NOT FOUND THEN RAISE EXCEPTION 'CASINO_FUNDS_CHANGED'; END IF;

 INSERT INTO public.casino_transactions(
   profile_id,game_type,bet_amount,payout,net_result,metadata)
 VALUES (v_profile_id,p_game_type,p_bet_amount,v_payout,v_net,
   jsonb_build_object('request_id',p_request_id,'choices',v_choices,'outcome',v_result,
     'server_authoritative',true))
 RETURNING id INTO v_transaction_id;

 -- Server-side addiction chance is rolled once, never on an idempotent replay.
 IF public.casino_secure_index(20)=0 THEN
   SELECT id INTO v_addiction FROM public.player_addictions
   WHERE profile_id=v_profile_id AND addiction_type='gambling'
     AND status IN ('active','recovering') ORDER BY created_at LIMIT 1 FOR UPDATE;
   IF v_addiction IS NOT NULL THEN
     UPDATE public.player_addictions SET severity=least(100,severity+3),
       updated_at=now() WHERE id=v_addiction;
   ELSE
     INSERT INTO public.player_addictions(
       user_id,profile_id,addiction_type,severity,status,triggered_at,days_clean,relapse_count)
     VALUES (v_user,v_profile_id,'gambling',10,'active',now(),0,0);
     v_developed:=true;
   END IF;
 END IF;
 RETURN jsonb_build_object('alreadyCompleted',false,'roundId',v_transaction_id,
   'netResult',v_net,'newCash',v_new_cash,'payout',v_payout,
   'outcome',v_result,'developedAddiction',v_developed);
END;
$fn$;
REVOKE ALL ON FUNCTION public.play_casino_round_authoritative(text,integer,jsonb,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.play_casino_round_authoritative(text,integer,jsonb,uuid)
 TO authenticated,service_role;
