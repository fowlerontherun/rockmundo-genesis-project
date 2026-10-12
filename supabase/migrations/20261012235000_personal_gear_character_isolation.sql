-- Personal gear is character-owned. Backfill only when ownership is unambiguous.
ALTER TABLE public.player_personal_gear ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_personal_gear gear SET profile_id=opening.profile_id
FROM public.blind_box_openings opening
WHERE opening.instrument_id=gear.id AND opening.profile_id IS NOT NULL
AND gear.profile_id IS NULL;
UPDATE public.player_personal_gear gear SET profile_id=owners.id
FROM (
 SELECT max(id::text)::uuid AS id,user_id FROM public.profiles
 WHERE died_at IS NULL GROUP BY user_id HAVING count(*)=1
) owners WHERE gear.user_id=owners.user_id AND gear.profile_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_personal_gear_character ON public.player_personal_gear(profile_id);
CREATE OR REPLACE FUNCTION public.sell_personal_gear_for_profile(p_gear_id uuid,p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cost numeric;v_refund integer;v_account uuid;v_gear_name text;
BEGIN
 SELECT user_id INTO v_account FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'gear_character_not_owned'; END IF;
 SELECT purchase_cost,gear_name INTO v_cost,v_gear_name FROM public.player_personal_gear
 WHERE id=p_gear_id AND profile_id=p_profile_id AND user_id=v_account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'gear_not_owned_by_character'; END IF;
 v_refund:=greatest(0,floor(coalesce(v_cost,0)/2));
 DELETE FROM public.player_personal_gear
 WHERE id=p_gear_id AND profile_id=p_profile_id AND user_id=v_account;
 IF NOT FOUND THEN RAISE EXCEPTION 'gear_sale_failed'; END IF;
 UPDATE public.blind_box_openings SET instrument_id=NULL
 WHERE instrument_id=p_gear_id AND profile_id=p_profile_id;
 DELETE FROM public.player_equipment WHERE user_id=p_profile_id AND equipment_id IN (
  SELECT id FROM public.equipment_items WHERE name=v_gear_name AND subcategory='blind_box');
 UPDATE public.profiles SET cash=coalesce(cash,0)+v_refund WHERE id=p_profile_id;
 RETURN jsonb_build_object('success',true,'refund',v_refund);
END $$;
REVOKE ALL ON FUNCTION public.sell_personal_gear_for_profile(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sell_personal_gear_for_profile(uuid,uuid) TO authenticated;
