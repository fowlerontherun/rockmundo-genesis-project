-- End-to-end database-integration smoke: purchase -> reserve -> cook ->
-- finalise -> consume. Only temporary fixture data; no live recipes/offers
-- are enabled, and all financial/food changes roll back on test completion.
--
-- CAUTION: Run in a privileged, controlled SQL test environment only.
-- This test temporarily enables an actual recipe and offers inside a
-- subtransaction, and impersonates one eligible user via local JWT claims.
DO $full$
DECLARE
 v_player public.profiles%rowtype;
 v_city uuid;
 v_slug text;
 v_offer uuid;
 v_purchase_key uuid;
 v_purchase jsonb;
 v_retry jsonb;
 v_total bigint := 0;
 v_original_cash bigint;
 v_session_id uuid := gen_random_uuid();
 v_food_id uuid;
 v_result jsonb;
 v_second jsonb;
 v_consume_key uuid := gen_random_uuid();
 v_meal jsonb;
 v_meal_retry jsonb;
 v_start timestamptz;
 v_row_count integer;
BEGIN
  SELECT p.* INTO v_player FROM public.profiles p
  WHERE p.is_active AND p.died_at IS NULL AND p.deleted_at IS NULL
    AND p.current_city_id IS NOT NULL AND p.cash >= 100
    AND NOT EXISTS (
      SELECT 1 FROM public.cooking_sessions s
      WHERE s.profile_id=p.id AND s.status IN ('pending','running')
    )
  ORDER BY p.cash DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COOKING_FULL_CHAIN_NEEDS_ELIGIBLE_TEST_PROFILE';
  END IF;
  v_city:=v_player.current_city_id;
  v_original_cash:=v_player.cash;
  BEGIN
    -- Always disabled in the committed production state. These temporary
    -- flags and offers roll back along with the test purchases.
    UPDATE public.cooking_recipes SET is_active=true WHERE slug='rice-bowl';
    IF NOT FOUND THEN RAISE EXCEPTION 'MISSING_RICE_BOWL_RECIPE'; END IF;
    PERFORM set_config('request.jwt.claim.sub',v_player.user_id::text,true);
    PERFORM set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
      'sub',v_player.user_id::text,'role','authenticated',
      'is_anonymous',false)::text,true);
    IF auth.uid() IS DISTINCT FROM v_player.user_id THEN
      RAISE EXCEPTION 'JWT_SIMULATION_FAILED';
    END IF;

    FOREACH v_slug IN ARRAY ARRAY['mushrooms','rice','soy-seasoning']::text[]
    LOOP
      -- There is no player location containing all three starter items in
      -- the seed market. Upsert test-only offers inside this rolled back block.
      INSERT INTO public.cooking_city_market_offers(
        city_id,ingredient_slug,unit_price,quality,stock,max_stock,is_active,
        local_speciality
      ) VALUES (v_city,v_slug,8,88,8,12,true,false)
      ON CONFLICT(city_id,ingredient_slug) DO UPDATE SET
        is_active=true,
        max_stock=greatest(public.cooking_city_market_offers.max_stock,3),
        stock=greatest(public.cooking_city_market_offers.stock,3)
      RETURNING id INTO v_offer;

      v_purchase_key:=gen_random_uuid();
      v_purchase:=public.purchase_cooking_market_ingredient(
        v_player.id,v_offer,1,v_purchase_key);
      IF v_purchase->>'status'<>'completed' THEN
        RAISE EXCEPTION 'PURCHASE_FAILED_FOR_%: %',v_slug,v_purchase;
      END IF;
      v_retry:=public.purchase_cooking_market_ingredient(
        v_player.id,v_offer,1,v_purchase_key);
      IF v_retry->>'status'<>'already_completed'
        OR v_retry->>'purchaseId' IS DISTINCT FROM v_purchase->>'purchaseId' THEN
        RAISE EXCEPTION 'PURCHASE_RETRY_DUPLICATED_FOR_%',v_slug;
      END IF;
      v_total:=v_total+(v_purchase->>'totalPrice')::bigint;
    END LOOP;

    IF (SELECT cash FROM public.profiles WHERE id=v_player.id)
       <> v_original_cash-v_total THEN
      RAISE EXCEPTION 'CASH_NOT_CHARGED_EXACTLY_ONCE';
    END IF;
    SELECT count(*) INTO v_row_count FROM public.cooking_market_purchases
    WHERE profile_id=v_player.id AND purchased_at>=transaction_timestamp();
    -- Do not use a transaction-start timestamp to count multiple clock-time
    -- test purchases: the real cash/stock/lot receipts are checked per SKU.

    IF public.begin_cooking_session(v_player.id,'rice-bowl',v_session_id)
       IS DISTINCT FROM v_session_id THEN
       RAISE EXCEPTION 'COOKING_SESSION_START_FAILED';
    END IF;
    IF public.begin_cooking_session(v_player.id,'rice-bowl',v_session_id)
       IS DISTINCT FROM v_session_id THEN
       RAISE EXCEPTION 'COOKING_SESSION_RETRY_FAILED';
    END IF;
    IF (SELECT count(*) FROM public.cooking_session_ingredients
      WHERE session_id=v_session_id) <> 3 THEN
      RAISE EXCEPTION 'THREE_INGREDIENT_RESERVATIONS_REQUIRED';
    END IF;
    IF (SELECT count(*) FROM public.cooking_ingredient_lots
      WHERE profile_id=v_player.id AND quantity>0
        AND ingredient_slug IN ('mushrooms','rice','soy-seasoning')) > 0 THEN
      RAISE EXCEPTION 'PURCHASED_STOCK_NOT_RESERVED';
    END IF;

    -- Use the actual transition-checking RPCs for action acceptance;
    -- then replace only server timestamps in the test transaction so
    -- an hour of gameplay can be verified synchronously in SQL.
    v_start:=clock_timestamp()-interval '60 seconds';
    UPDATE public.cooking_sessions
      SET started_at=v_start, updated_at=v_start,
          expires_at=v_start+interval '120 seconds'
      WHERE id=v_session_id;
    PERFORM public.record_cooking_action(v_session_id,'heat',null,'medium');
    PERFORM public.record_cooking_action(v_session_id,'add','mushrooms',null);
    PERFORM public.record_cooking_action(v_session_id,'add','rice',null);
    PERFORM public.record_cooking_action(v_session_id,'remove','mushrooms',null);
    PERFORM public.record_cooking_action(v_session_id,'remove','rice',null);
    PERFORM public.record_cooking_action(v_session_id,'add','soy-seasoning',null);
    PERFORM public.record_cooking_action(v_session_id,'remove','soy-seasoning',null);

    UPDATE public.cooking_session_actions
    SET recorded_at=v_start+make_interval(secs=>CASE action_sequence
      WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3
      WHEN 4 THEN 21 WHEN 5 THEN 22 WHEN 6 THEN 23
      WHEN 7 THEN 36 ELSE 50 END)
    WHERE session_id=v_session_id;

    v_result:=public.finalize_manual_cooking(v_session_id);
    IF v_result->>'status'<>'completed'
      OR (v_result->>'score')::integer<>100 OR
      v_result->>'batch_id' IS NULL THEN
      RAISE EXCEPTION 'VALID_DISH_DID_NOT_COMPLETE: %',v_result;
    END IF;
    v_food_id:=(v_result->>'batch_id')::uuid;
    v_second:=public.finalize_manual_cooking(v_session_id);
    IF v_second->>'batch_id' IS DISTINCT FROM v_result->>'batch_id' THEN
      RAISE EXCEPTION 'DUPLICATE_FINISH_CREATED_NEW_BATCH';
    END IF;
    IF (SELECT count(*) FROM public.cooking_food_batches
      WHERE crafting_session_id=v_session_id)<>1 THEN
      RAISE EXCEPTION 'EXPECTED_ONE_FINISHED_FOOD_BATCH';
    END IF;
    IF (SELECT portions FROM public.cooking_food_batches WHERE id=v_food_id)<>2 THEN
      RAISE EXCEPTION 'RICE_BOWL_WRONG_PORTIONS';
    END IF;

    v_meal:=public.consume_cooking_food_atomic(
      v_player.id,v_food_id,v_consume_key);
    IF v_meal->>'status'<>'completed' OR
      (v_meal->>'remainingPortions')::integer<>1 OR
      (v_meal->>'effectApplied')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'EATING_FINISHED_FOOD_FAILED: %',v_meal;
    END IF;
    v_meal_retry:=public.consume_cooking_food_atomic(
      v_player.id,v_food_id,v_consume_key);
    IF v_meal_retry->>'status'<>'already_completed' OR
      v_meal_retry->>'consumptionId' IS DISTINCT FROM v_meal->>'consumptionId' THEN
      RAISE EXCEPTION 'EATING_RETRY_DEDUCTED_MORE_THAN_ONCE';
    END IF;
    IF (SELECT portions FROM public.cooking_food_batches WHERE id=v_food_id)<>1 THEN
      RAISE EXCEPTION 'DUPLICATE_CONSUMPTION_DEDUCTED_MULTIPLE_PORTIONS';
    END IF;
    IF (SELECT count(*) FROM public.cooking_food_consumptions
      WHERE food_batch_id=v_food_id)<>1 THEN
      RAISE EXCEPTION 'FOOD_CONSUMPTION_LEDGER_MISMATCH';
    END IF;
    IF (SELECT count(*) FROM public.cooking_active_food_effects
      WHERE profile_id=v_player.id AND effect_slug='rehearsal'
        AND expires_at>clock_timestamp())<>1 THEN
      RAISE EXCEPTION 'VALID_FOOD_EFFECT_NOT_RECORDED';
    END IF;
    IF (SELECT cash FROM public.profiles WHERE id=v_player.id)
       <>v_original_cash-v_total THEN
      RAISE EXCEPTION 'COOKING_OR_EATING_CHANGED_CASH';
    END IF;

    RAISE EXCEPTION USING ERRCODE='PZ001',
      MESSAGE='ROLLBACK_FULL_COOKING_CHAIN_FIXTURE';
  EXCEPTION WHEN SQLSTATE 'PZ001' THEN
    PERFORM set_config('app.cooking_full_chain_smoke','passed',false);
  END;
END $full$;

SELECT current_setting('app.cooking_full_chain_smoke',true) as full_chain_passed,
  (SELECT count(*) FROM public.cooking_market_purchases) as persisted_purchases,
  (SELECT count(*) FROM public.cooking_food_batches) as persisted_food,
  (SELECT count(*) FROM public.cooking_food_consumptions) as persisted_meals,
  (SELECT count(*) FROM public.cooking_city_market_offers WHERE is_active) as active_market_offers,
  (SELECT count(*) FROM public.cooking_recipes WHERE is_active) as active_recipes;
