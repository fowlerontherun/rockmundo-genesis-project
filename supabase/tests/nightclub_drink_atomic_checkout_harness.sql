-- Production-safe regression: all successful test purchases and wallet journals
-- are inside a transaction that is ROLLED BACK. No real player rewards persist.
BEGIN;
DO $test$
DECLARE
 v_user uuid; v_profile uuid; v_club uuid; v_drink text; v_price integer;
 v_cash_before bigint; v_energy_before integer;
 v_request uuid:=gen_random_uuid();
 v_first jsonb; v_retry jsonb; v_cash_after bigint; v_energy_after integer;
 v_count integer;
BEGIN
 IF has_function_privilege('anon','public.purchase_nightclub_drink(uuid,uuid,text,uuid)','EXECUTE')
   OR has_table_privilege('authenticated','public.nightclub_drink_purchases','INSERT')
   OR NOT has_function_privilege('authenticated',
       'public.purchase_nightclub_drink(uuid,uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Nightclub drink API permissions are unsafe'; END IF;

 SELECT p.user_id,p.id,c.id,m.item->>'id',(m.item->>'price')::integer,p.cash,p.energy
 INTO v_user,v_profile,v_club,v_drink,v_price,v_cash_before,v_energy_before
 FROM public.profiles p
 JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 CROSS JOIN LATERAL jsonb_array_elements(c.drink_menu) AS m(item)
 WHERE p.is_active IS TRUE AND p.user_id IS NOT NULL
   AND c.metadata->>'live_interactions_enabled'='true'
   AND (m.item->>'price') ~ '^[0-9]{1,6}$'
   AND (m.item->>'price')::integer BETWEEN 1 AND 100000
   AND p.cash > (m.item->>'price')::integer
 LIMIT 1;
 IF v_user IS NULL THEN RAISE EXCEPTION 'Missing controlled nightclub test fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 v_first:=public.purchase_nightclub_drink(v_profile,v_club,v_drink,v_request);
 v_retry:=public.purchase_nightclub_drink(v_profile,v_club,v_drink,v_request);
 SELECT cash,energy INTO v_cash_after,v_energy_after
 FROM public.profiles WHERE id=v_profile;
 SELECT count(*) INTO v_count FROM public.nightclub_drink_purchases
   WHERE request_id=v_request AND user_id=v_user;
 IF v_cash_after<>v_cash_before-v_price OR v_count<>1
    OR coalesce((v_retry->>'replayed')::boolean,false) IS FALSE
    OR (v_retry->>'cash_after')::bigint<>v_cash_after
 THEN RAISE EXCEPTION 'Atomic buy/retry did not debit once'; END IF;
 IF v_energy_after<v_energy_before OR v_energy_after>100
 THEN RAISE EXCEPTION 'Nightclub purchase energy delta was invalid'; END IF;

 -- Another authenticated account cannot spend the selected character's cash.
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.purchase_nightclub_drink(v_profile,v_club,v_drink,gen_random_uuid());
  RAISE EXCEPTION 'Unowned profile purchase wrongly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
 BEGIN
  PERFORM public.purchase_nightclub_drink(v_profile,v_club,'wrong-item',v_request);
  RAISE EXCEPTION 'Reused key changed its purchase details';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile)<>v_cash_after
 THEN RAISE EXCEPTION 'Rejected retry spent money'; END IF;

 -- Negative insufficient-funds check, also rolled back.
 UPDATE public.profiles SET cash=0 WHERE id=v_profile;
 BEGIN
  PERFORM public.purchase_nightclub_drink(v_profile,v_club,v_drink,gen_random_uuid());
  RAISE EXCEPTION 'Insufficient-funds purchase was accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT cash FROM public.profiles WHERE id=v_profile)<>0
 THEN RAISE EXCEPTION 'Insufficient funds changed balance'; END IF;
END;
$test$;
ROLLBACK;
