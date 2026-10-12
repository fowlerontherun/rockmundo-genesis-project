-- All housing money and ownership changes belong to one database transaction.
-- Prices and location are read from database records rather than browser parameters.
CREATE OR REPLACE FUNCTION public.purchase_housing_atomic(p_profile_id uuid,p_housing_type_id uuid)
RETURNS public.player_properties LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%rowtype;h public.housing_types%rowtype;v_mult numeric;v_price integer;v_property public.player_properties%rowtype;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'housing_profile_not_owned'; END IF;
 SELECT * INTO h FROM public.housing_types WHERE id=p_housing_type_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'housing_not_available'; END IF;
 SELECT price_multiplier INTO v_mult FROM public.housing_market_prices WHERE country=h.country;
 v_mult:=coalesce(v_mult,1);
 IF v_mult<=0 THEN RAISE EXCEPTION 'housing_market_price_unavailable'; END IF;
 v_price:=round(h.base_price*v_mult);
 IF v_price<=0 THEN RAISE EXCEPTION 'invalid_housing_price'; END IF;
 UPDATE public.profiles SET cash=cash-v_price WHERE id=p.id AND cash>=v_price;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_housing_funds'; END IF;
 INSERT INTO public.player_properties(user_id,profile_id,housing_type_id,country,purchase_price,daily_upkeep)
 VALUES(p.user_id,p.id,h.id,h.country,v_price,round(v_price*0.001))
 RETURNING * INTO v_property;
 RETURN v_property;
END $$;

CREATE OR REPLACE FUNCTION public.start_housing_rental_atomic(p_profile_id uuid,p_rental_type_id uuid,p_city_id uuid)
RETURNS public.player_rentals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%rowtype;r public.rental_types%rowtype;v_country text;v_living numeric;
 v_weekly integer;v_result public.player_rentals%rowtype;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'rental_profile_not_owned'; END IF;
 SELECT * INTO r FROM public.rental_types WHERE id=p_rental_type_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'rental_type_not_found'; END IF;
 SELECT country,cost_of_living INTO v_country,v_living FROM public.cities WHERE id=p_city_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'rental_city_not_found'; END IF;
 IF EXISTS (SELECT 1 FROM public.player_rentals WHERE profile_id=p.id AND status='active') THEN
  RAISE EXCEPTION 'active_rental_already_exists';
 END IF;
 v_weekly:=round(r.base_weekly_cost*(0.4+coalesce(v_living,50)/100*1.2));
 IF v_weekly<=0 THEN RAISE EXCEPTION 'invalid_rent'; END IF;
 UPDATE public.profiles SET cash=cash-v_weekly WHERE id=p.id AND cash>=v_weekly;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_rental_funds'; END IF;
 INSERT INTO public.player_rentals(user_id,profile_id,rental_type_id,country,weekly_cost)
 VALUES(p.user_id,p.id,r.id,v_country,v_weekly)
 RETURNING * INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.purchase_housing_atomic(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.start_housing_rental_atomic(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_housing_atomic(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_housing_rental_atomic(uuid,uuid,uuid) TO authenticated;
