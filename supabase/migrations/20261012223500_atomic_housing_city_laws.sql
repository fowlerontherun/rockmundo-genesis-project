-- One trusted transaction for character-owned property sale and mayor laws.
CREATE OR REPLACE FUNCTION public.sell_player_property_atomic(
 p_profile_id uuid, p_property_id uuid, p_multiplier numeric DEFAULT 1
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;v_property public.player_properties%rowtype;v_amount integer;
BEGIN
 SELECT user_id INTO v_owner FROM public.profiles
 WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'property_profile_unauthorized'; END IF;
 SELECT * INTO v_property FROM public.player_properties
 WHERE id=p_property_id AND user_id=v_owner AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'property_not_owned_or_already_sold'; END IF;
 IF p_multiplier IS NULL OR p_multiplier < 0.5 OR p_multiplier > 2.5
 THEN RAISE EXCEPTION 'invalid_property_market_multiplier'; END IF;
 v_amount:=round(v_property.purchase_price*p_multiplier*0.7);
 IF v_amount<0 THEN RAISE EXCEPTION 'invalid_sale_price'; END IF;
 DELETE FROM public.player_properties WHERE id=v_property.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'property_sale_conflict'; END IF;
 UPDATE public.profiles SET cash=coalesce(cash,0)+v_amount WHERE id=p_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'property_payout_failed'; END IF;
 RETURN v_amount;
END $$;

CREATE OR REPLACE FUNCTION public.update_city_laws_atomic(
 p_profile_id uuid,p_city_id uuid,p_updates jsonb,
 p_change_reason text DEFAULT NULL,p_game_year integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_mayor public.city_mayors%rowtype;
 v_old public.city_laws%rowtype;v_new public.city_laws%rowtype;
 v_field text;v_allowed text[]:=ARRAY[
  'income_tax_rate','sales_tax_rate','travel_tax','alcohol_legal_age',
  'drug_policy','noise_curfew_hour','busking_license_fee','venue_permit_cost',
  'prohibited_genres','promoted_genres','festival_permit_required',
  'max_concert_capacity','community_events_funding'
 ];v_changes integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid())
 THEN RAISE EXCEPTION 'mayor_profile_unauthorized'; END IF;
 SELECT * INTO v_mayor FROM public.city_mayors WHERE city_id=p_city_id
 AND profile_id=p_profile_id AND is_current=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_current_mayor'; END IF;
 SELECT * INTO v_old FROM public.city_laws WHERE city_id=p_city_id
 AND effective_until IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'city_laws_not_found'; END IF;
 IF jsonb_typeof(p_updates)<>'object' THEN RAISE EXCEPTION 'invalid_city_law_updates'; END IF;
 FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
  IF NOT (v_field=ANY(v_allowed)) THEN RAISE EXCEPTION 'invalid_city_law_field: %',v_field; END IF;
 END LOOP;
 SELECT * INTO v_new FROM jsonb_populate_record(v_old,p_updates);
 FOR v_field IN SELECT jsonb_object_keys(p_updates) LOOP
  IF to_jsonb(v_old)->v_field IS DISTINCT FROM to_jsonb(v_new)->v_field THEN
   INSERT INTO public.city_law_history(city_id,mayor_id,law_field,old_value,new_value,change_reason,game_year)
   VALUES(p_city_id,v_mayor.id,v_field,to_jsonb(v_old)->>v_field,
     coalesce(to_jsonb(v_new)->>v_field,'null'),p_change_reason,p_game_year);
   v_changes:=v_changes+1;
  END IF;
 END LOOP;
 IF v_changes>0 THEN
  UPDATE public.city_laws SET income_tax_rate=v_new.income_tax_rate,
   sales_tax_rate=v_new.sales_tax_rate,travel_tax=v_new.travel_tax,
   alcohol_legal_age=v_new.alcohol_legal_age,drug_policy=v_new.drug_policy,
   noise_curfew_hour=v_new.noise_curfew_hour,busking_license_fee=v_new.busking_license_fee,
   venue_permit_cost=v_new.venue_permit_cost,prohibited_genres=v_new.prohibited_genres,
   promoted_genres=v_new.promoted_genres,festival_permit_required=v_new.festival_permit_required,
   max_concert_capacity=v_new.max_concert_capacity,
   community_events_funding=v_new.community_events_funding,
   enacted_by_mayor_id=v_mayor.id,updated_at=now()
  WHERE id=v_old.id;
  UPDATE public.city_mayors SET policies_enacted=coalesce(policies_enacted,0)+1 WHERE id=v_mayor.id;
 END IF;
 RETURN to_jsonb(v_new);
END $$;

REVOKE ALL ON FUNCTION public.sell_player_property_atomic(uuid,uuid,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_city_laws_atomic(uuid,uuid,jsonb,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sell_player_property_atomic(uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_city_laws_atomic(uuid,uuid,jsonb,text,integer) TO authenticated;
