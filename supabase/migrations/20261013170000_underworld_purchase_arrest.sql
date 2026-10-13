-- Underworld arrest is decided and recorded inside the purchase transaction.
-- Any missing prison or failed persistence aborts the purchase and restores payment/stock.
CREATE OR REPLACE FUNCTION public.underworld_purchase_arrest_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_product public.underworld_products%ROWTYPE;
 v_profile public.profiles%ROWTYPE;v_prison uuid;v_chance numeric;
 v_sentence integer;v_bail bigint;v_penalty bigint;
BEGIN
 SELECT * INTO v_product FROM public.underworld_products WHERE id=NEW.product_id;
 SELECT * INTO v_profile FROM public.profiles WHERE id=NEW.profile_id FOR UPDATE;
 IF NOT FOUND OR v_product.id IS NULL THEN RAISE EXCEPTION 'UNDERWORLD_ARREST_CONTEXT_MISSING'; END IF;
 IF coalesce(v_profile.is_imprisoned,false) OR EXISTS(
   SELECT 1 FROM public.player_imprisonments WHERE profile_id=NEW.profile_id AND status='imprisoned'
 ) THEN RAISE EXCEPTION 'ALREADY_IMPRISONED'; END IF;
 -- 8% base purchase risk, 12% for explicit contraband.
 v_chance := CASE WHEN v_product.category='contraband' THEN 0.12 ELSE 0.08 END
   * (1 + least(0.2,greatest(0,coalesce(v_profile.fame,0)) / 25000.0));
 IF random() >= v_chance THEN RETURN NEW; END IF;
 SELECT id INTO v_prison FROM public.prisons
 WHERE city_id=v_profile.current_city_id ORDER BY id LIMIT 1;
 IF v_prison IS NULL THEN SELECT id INTO v_prison FROM public.prisons ORDER BY id LIMIT 1; END IF;
 IF v_prison IS NULL THEN RAISE EXCEPTION 'NO_PRISON_AVAILABLE_FOR_ARREST'; END IF;
 v_sentence := CASE WHEN v_product.category='contraband' THEN 2 + floor(random()*6)::int ELSE 1 + floor(random()*3)::int END;
 v_bail := CASE WHEN v_product.category='contraband' THEN 500 + floor(random()*1501)::bigint ELSE 200 + floor(random()*601)::bigint END;
 v_penalty := CASE WHEN v_product.category='contraband' THEN 100 ELSE 50 END;
 INSERT INTO public.player_imprisonments(user_id,profile_id,prison_id,original_sentence_days,
 remaining_sentence_days,release_date,reason,status,bail_amount)
 VALUES(NEW.user_id,NEW.profile_id,v_prison,v_sentence,v_sentence,now()+make_interval(days=>v_sentence),
 CASE WHEN v_product.category='contraband' THEN 'contraband' ELSE 'drug_purchase' END,
 'imprisoned',v_bail);
 UPDATE public.profiles SET is_imprisoned=true,fame=greatest(0,coalesce(fame,0)-v_penalty)
 WHERE id=NEW.profile_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.underworld_purchase_arrest_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS underworld_purchase_arrest ON public.underworld_purchases;
CREATE TRIGGER underworld_purchase_arrest AFTER INSERT ON public.underworld_purchases
FOR EACH ROW EXECUTE FUNCTION public.underworld_purchase_arrest_trigger();
