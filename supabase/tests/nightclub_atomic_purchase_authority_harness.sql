-- Run as privileged test runner. All synthetic purchase writes are rolled back.
BEGIN;
DO $verify$
DECLARE
 v_actor uuid; v_profile uuid; v_club uuid; v_price integer;
 v_before bigint; v_after bigint; v_request uuid:=gen_random_uuid();
 v_first jsonb; v_repeat jsonb; v_owned uuid; v_count integer;
BEGIN
 IF has_table_privilege('authenticated','public.player_owned_nightclubs','INSERT')
 OR has_table_privilege('authenticated','public.player_owned_nightclubs','UPDATE')
 OR has_table_privilege('authenticated','public.player_owned_nightclubs','DELETE')
 OR has_function_privilege('anon','public.purchase_nightclub_atomic(uuid,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.purchase_nightclub_atomic(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Nightclub purchase grants allow client bypass'; END IF;
 SELECT p.user_id,p.id,c.id,
 CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000
 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END,p.cash
 INTO v_actor,v_profile,v_club,v_price,v_before
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active=true AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash >= CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
 WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 IF v_actor IS NULL THEN
  RAISE NOTICE 'No eligible active user/club fixture on this database; role ACL assertions passed. Run full checkout against a seeded environment.';
  RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 v_first:=public.purchase_nightclub_atomic(v_profile,v_club,v_request);
 v_repeat:=public.purchase_nightclub_atomic(v_profile,v_club,v_request);
 IF v_first->>'receipt_id' IS NULL OR v_first->>'owned_club_id' IS NULL
 OR (v_first->>'cash_spent')::integer<>v_price
 OR (v_first->>'replayed')::boolean
 OR (v_repeat->>'replayed')::boolean IS DISTINCT FROM true
 OR v_repeat->>'receipt_id'<>v_first->>'receipt_id'
 THEN RAISE EXCEPTION 'Purchase receipt or replay contract failed'; END IF;
 SELECT cash INTO v_after FROM public.profiles WHERE id=v_profile;
 IF v_after<>v_before-v_price THEN RAISE EXCEPTION 'Cash debited incorrectly: %, %',v_before,v_after; END IF;
 SELECT count(*) INTO v_count FROM public.nightclub_purchase_receipts WHERE request_id=v_request;
 IF v_count<>1 THEN RAISE EXCEPTION 'Multiple purchase receipts on retry'; END IF;
 v_owned:=(v_first->>'owned_club_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
   WHERE o.id=v_owned AND o.profile_id=v_profile AND o.club_id=v_club
   AND o.verified_purchase_id=(v_first->>'receipt_id')::uuid)
 THEN RAISE EXCEPTION 'Ownership missing matching receipt'; END IF;
 BEGIN
   PERFORM public.purchase_nightclub_atomic(v_profile,v_club,gen_random_uuid());
   RAISE EXCEPTION 'Second checkout illegally purchased occupied club';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
   PERFORM public.update_nightclub_settings(v_owned,501,NULL,NULL);
   RAISE EXCEPTION 'Settings accepted unsafe cover';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.update_nightclub_settings(v_owned,27,12,false);
 IF NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs WHERE id=v_owned
  AND cover_charge=27 AND drink_markup_pct=12 AND is_open=false)
 THEN RAISE EXCEPTION 'Safe settings update failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
   PERFORM public.update_nightclub_settings(v_owned,45,NULL,NULL);
   RAISE EXCEPTION 'Other user changed nightclub settings';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'Nightclub checkout rollback-only fixture passed';
END $verify$;
ROLLBACK;