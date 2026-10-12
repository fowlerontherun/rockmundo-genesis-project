-- Underworld stock, payment, purchase records, rewards and consumption are authoritative.
CREATE OR REPLACE FUNCTION public.buy_underworld_product_atomic(
 p_profile_id uuid,p_product_id uuid,p_payment_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_product public.underworld_products%rowtype;
 v_user uuid;v_effects jsonb;v_store boolean;v_expires timestamptz;
 v_type text;v_value numeric;v_purchase public.underworld_purchases%rowtype;
 v_skill text;v_skill_xp numeric;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'underworld_profile_not_owned'; END IF;
 v_user:=v_profile.user_id;
 SELECT * INTO v_product FROM public.underworld_products WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(v_product.is_available,false) THEN RAISE EXCEPTION 'underworld_product_unavailable'; END IF;
 IF v_product.stock_limit IS NOT NULL AND coalesce(v_product.current_stock,0)<1 THEN RAISE EXCEPTION 'underworld_out_of_stock'; END IF;
 v_effects:=coalesce(v_product.effects,'{}'::jsonb);
 IF jsonb_typeof(v_effects)<>'object' THEN RAISE EXCEPTION 'invalid_underworld_effects'; END IF;
 v_store:=(v_product.category IN ('skill_book','consumable') AND coalesce(v_product.duration_hours,0)<=0);
 v_skill:=nullif(v_effects->>'skill_slug','');
 v_skill_xp:=coalesce((v_effects->>'skill_xp')::numeric,0);
 IF NOT v_store AND v_skill IS NOT NULL AND v_skill_xp>0
 AND NOT EXISTS(SELECT 1 FROM public.skill_progress WHERE profile_id=p_profile_id AND skill_slug=v_skill)
 THEN RAISE EXCEPTION 'underworld_skill_not_unlocked'; END IF;
 IF p_payment_method='cash' THEN
  IF coalesce(v_product.price_cash,0)<=0 THEN RAISE EXCEPTION 'underworld_cash_payment_unavailable'; END IF;
  UPDATE public.profiles SET cash=cash-v_product.price_cash
  WHERE id=p_profile_id AND cash>=v_product.price_cash;
  IF NOT FOUND THEN RAISE EXCEPTION 'underworld_insufficient_cash'; END IF;
 ELSIF p_payment_method='crypto' THEN
  IF v_product.price_token_id IS NULL OR coalesce(v_product.price_token_amount,0)<=0
  THEN RAISE EXCEPTION 'underworld_crypto_payment_unavailable'; END IF;
  UPDATE public.player_token_holdings SET quantity=quantity-v_product.price_token_amount
  WHERE profile_id=p_profile_id AND token_id=v_product.price_token_id
  AND quantity>=v_product.price_token_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'underworld_insufficient_tokens'; END IF;
 ELSE RAISE EXCEPTION 'underworld_invalid_payment_method'; END IF;
 IF v_product.stock_limit IS NOT NULL THEN
  UPDATE public.underworld_products SET current_stock=current_stock-1 WHERE id=v_product.id;
 END IF;
 IF coalesce(v_product.duration_hours,0)>0 THEN
  v_type:=coalesce(
   (SELECT key FROM jsonb_each_text(v_effects)
    WHERE key IN ('xp_multiplier','fame_multiplier','energy_regen','all_multiplier',
    'gig_quality_boost','gig_earnings_boost','recording_quality_boost',
    'songwriting_quality_boost','creativity_boost') AND value::numeric>0
    ORDER BY key LIMIT 1),'');
  IF v_type='' THEN RAISE EXCEPTION 'underworld_unsupported_timed_reward'; END IF;
  v_value:=(v_effects->>v_type)::numeric;
  v_expires:=now()+make_interval(hours=>v_product.duration_hours);
  INSERT INTO public.player_active_boosts(user_id,profile_id,product_id,boost_type,boost_value,expires_at)
  VALUES(v_user,p_profile_id,v_product.id,v_type,v_value,v_expires);
 ELSIF NOT v_store THEN
  UPDATE public.profiles SET
   health=least(100,greatest(0,coalesce(health,100)+coalesce((v_effects->>'health')::numeric,0))),
   energy=least(100,greatest(0,coalesce(energy,100)+coalesce((v_effects->>'energy')::numeric,0))),
   experience=coalesce(experience,0)+coalesce((v_effects->>'xp')::numeric,0),
   fame=greatest(0,coalesce(fame,0)+coalesce((v_effects->>'fame')::numeric,0))
  WHERE id=p_profile_id;
  IF v_skill IS NOT NULL AND v_skill_xp>0 THEN
   UPDATE public.skill_progress SET current_xp=coalesce(current_xp,0)+v_skill_xp
   WHERE profile_id=p_profile_id AND skill_slug=v_skill;
   IF NOT FOUND THEN RAISE EXCEPTION 'underworld_skill_award_failed'; END IF;
  END IF;
 END IF;
 INSERT INTO public.underworld_purchases(user_id,profile_id,product_id,paid_with,
  cash_amount,token_id,token_amount,effects_applied,expires_at,is_used,quantity)
 VALUES(v_user,p_profile_id,v_product.id,p_payment_method,
  CASE WHEN p_payment_method='cash' THEN v_product.price_cash END,
  CASE WHEN p_payment_method='crypto' THEN v_product.price_token_id END,
  CASE WHEN p_payment_method='crypto' THEN v_product.price_token_amount END,
  v_effects,v_expires,NOT v_store,1)
 RETURNING * INTO v_purchase;
 RETURN jsonb_build_object('success',true,'purchaseId',v_purchase.id,'expiresAt',v_expires,
 'storedInInventory',v_store);
END $$;

CREATE OR REPLACE FUNCTION public.consume_underworld_item_atomic(p_profile_id uuid,p_purchase_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_purchase public.underworld_purchases%rowtype;
 v_product public.underworld_products%rowtype;v_effects jsonb;v_skill text;v_skill_xp numeric;
 v_exposure jsonb:=NULL;v_qty integer;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'underworld_profile_not_owned'; END IF;
 SELECT * INTO v_purchase FROM public.underworld_purchases
 WHERE id=p_purchase_id AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND OR v_purchase.is_used OR coalesce(v_purchase.quantity,0)<1
 OR (v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at<=now())
 THEN RAISE EXCEPTION 'underworld_item_unavailable'; END IF;
 SELECT * INTO v_product FROM public.underworld_products WHERE id=v_purchase.product_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'underworld_product_not_found'; END IF;
 v_effects:=coalesce(v_purchase.effects_applied,'{}'::jsonb);
 IF jsonb_typeof(v_effects)<>'object' THEN RAISE EXCEPTION 'underworld_reward_invalid'; END IF;
 v_skill:=nullif(v_effects->>'skill_slug','');
 v_skill_xp:=coalesce((v_effects->>'skill_xp')::numeric,0);
 IF v_skill IS NOT NULL AND v_skill_xp>0 THEN
  UPDATE public.skill_progress SET current_xp=coalesce(current_xp,0)+v_skill_xp
  WHERE profile_id=p_profile_id AND skill_slug=v_skill;
  IF NOT FOUND THEN RAISE EXCEPTION 'underworld_skill_not_unlocked'; END IF;
 END IF;
 UPDATE public.profiles SET
  health=least(100,greatest(0,coalesce(health,100)+coalesce((v_effects->>'health')::numeric,0))),
  energy=least(100,greatest(0,coalesce(energy,100)+coalesce((v_effects->>'energy')::numeric,0))),
  experience=coalesce(experience,0)+coalesce((v_effects->>'xp')::numeric,0),
  fame=greatest(0,coalesce(fame,0)+coalesce((v_effects->>'fame')::numeric,0)),
  cash=greatest(0,coalesce(cash,0)+coalesce((v_effects->>'cash')::numeric,0))
 WHERE id=p_profile_id;
 IF v_product.addiction_type IS NOT NULL THEN
  v_exposure:=public.record_addiction_exposure(p_profile_id,v_product.addiction_type,
   CASE WHEN v_product.category='consumable' THEN 18 WHEN v_product.category='booster' THEN 12 ELSE 8 END,
   'underworld_item',v_product.id::text);
  IF coalesce((v_exposure->>'ok')::boolean,false)=false
  THEN RAISE EXCEPTION 'underworld_exposure_not_recorded'; END IF;
 END IF;
 v_qty:=v_purchase.quantity-1;
 UPDATE public.underworld_purchases SET quantity=v_qty,is_used=(v_qty=0)
 WHERE id=v_purchase.id;
 RETURN jsonb_build_object('success',true,'productId',v_product.id,
  'productName',v_product.name,'exposure',v_exposure);
END $$;
REVOKE ALL ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_underworld_product_atomic(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_underworld_item_atomic(uuid,uuid) TO authenticated;
