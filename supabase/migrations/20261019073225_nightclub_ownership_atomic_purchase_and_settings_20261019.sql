-- Applied directly to production 2026-10-19 as 20261019073225.
-- Historical club records stay unverified; this does not alter their cash history.
CREATE TABLE public.nightclub_purchase_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 club_id uuid NOT NULL REFERENCES public.city_night_clubs(id), request_id uuid NOT NULL,
 cash_spent integer NOT NULL CHECK (cash_spent>0),
 purchased_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id), UNIQUE(club_id));
ALTER TABLE public.nightclub_purchase_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners see nightclub receipts" ON public.nightclub_purchase_receipts
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()) AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(select auth.uid())));
REVOKE ALL ON public.nightclub_purchase_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_purchase_receipts TO authenticated;
ALTER TABLE public.player_owned_nightclubs ADD COLUMN verified_purchase_id uuid UNIQUE
 REFERENCES public.nightclub_purchase_receipts(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX nightclub_verified_club_idx ON public.player_owned_nightclubs(club_id)
 WHERE verified_purchase_id IS NOT NULL;
UPDATE public.player_owned_nightclubs p SET
 cover_charge=CASE WHEN p.cover_charge NOT BETWEEN 0 AND 500
 THEN least(500,greatest(0,coalesce(c.cover_charge,10))) ELSE p.cover_charge END,
 drink_markup_pct=CASE WHEN p.drink_markup_pct NOT BETWEEN 0 AND 200
 THEN 0 ELSE p.drink_markup_pct END,updated_at=now()
 FROM public.city_night_clubs c WHERE c.id=p.club_id AND
 (p.cover_charge NOT BETWEEN 0 AND 500 OR p.drink_markup_pct NOT BETWEEN 0 AND 200);
ALTER TABLE public.player_owned_nightclubs
 ADD CONSTRAINT nightclub_owner_cover_bounds CHECK(cover_charge BETWEEN 0 AND 500);
ALTER TABLE public.player_owned_nightclubs
 ADD CONSTRAINT nightclub_owner_markup_bounds CHECK(drink_markup_pct BETWEEN 0 AND 200);
REVOKE ALL ON public.player_owned_nightclubs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_owned_nightclubs TO authenticated;
DROP POLICY IF EXISTS "Players can create own nightclubs" ON public.player_owned_nightclubs;
DROP POLICY IF EXISTS "Players can delete own nightclubs" ON public.player_owned_nightclubs;
DROP POLICY IF EXISTS "Players can update own nightclubs" ON public.player_owned_nightclubs;
CREATE OR REPLACE FUNCTION public.purchase_nightclub_atomic(p_profile_id uuid, p_club_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 actor uuid:=(select auth.uid());
 profile public.profiles%ROWTYPE;
 club public.city_night_clubs%ROWTYPE;
 prior public.nightclub_purchase_receipts%ROWTYPE;
 price integer;
 receipt uuid;
 owned uuid;
 prior_context text:=current_setting('app.player_cash_context',true);
BEGIN
 IF actor IS NULL OR p_profile_id IS NULL OR p_club_id IS NULL OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'Authenticated buyer, club and request required' USING ERRCODE='42501';
 END IF;
 IF public.current_active_player_profile_id() IS DISTINCT FROM p_profile_id THEN
  RAISE EXCEPTION 'Select your active character before purchasing' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('nightclub-purchase:'||p_club_id::text)::bigint);
 SELECT * INTO prior FROM public.nightclub_purchase_receipts
  WHERE user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.profile_id IS DISTINCT FROM p_profile_id OR prior.club_id IS DISTINCT FROM p_club_id THEN
   RAISE EXCEPTION 'Request ID already used for a different purchase' USING ERRCODE='23505';
  END IF;
  SELECT id INTO owned FROM public.player_owned_nightclubs
   WHERE verified_purchase_id=prior.id AND profile_id=p_profile_id AND club_id=p_club_id;
  IF owned IS NULL THEN RAISE EXCEPTION 'Receipt ownership missing' USING ERRCODE='23503'; END IF;
  RETURN jsonb_build_object('receipt_id',prior.id,'owned_club_id',owned,
   'club_id',p_club_id,'cash_spent',prior.cash_spent,'replayed',true);
 END IF;
 SELECT * INTO club FROM public.city_night_clubs WHERE id=p_club_id;
 IF NOT FOUND OR club.city_id IS NULL OR club.quality_level NOT BETWEEN 1 AND 5 THEN
  RAISE EXCEPTION 'Invalid nightclub or quality' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM public.player_owned_nightclubs WHERE club_id=p_club_id) THEN
  RAISE EXCEPTION 'Nightclub already claimed; contact support for disputed ownership'
   USING ERRCODE='23505';
 END IF;
 price:=CASE club.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000 WHEN 3 THEN 50000
  WHEN 4 THEN 150000 WHEN 5 THEN 500000 END;
 SELECT * INTO profile FROM public.profiles WHERE id=p_profile_id AND user_id=actor FOR UPDATE;
 IF NOT FOUND OR profile.current_city_id IS DISTINCT FROM club.city_id THEN
  RAISE EXCEPTION 'Travel to the club city before buying' USING ERRCODE='42501';
 END IF;
 IF coalesce(profile.cash,0)<price THEN
  RAISE EXCEPTION 'Insufficient funds' USING ERRCODE='22023';
 END IF;
 PERFORM set_config('app.player_cash_context',
  jsonb_build_object('classification','nightclub_purchase','display_category','nightclub_purchase',
    'description','Bought nightclub','external_cash_flow',true,
    'idempotency_key','nightclub:'||p_request_id::text)::text,true);
 UPDATE public.profiles SET cash=cash-price WHERE id=p_profile_id AND cash>=price;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cash balance changed during checkout' USING ERRCODE='22023'; END IF;
 PERFORM set_config('app.player_cash_context',coalesce(prior_context,''),true);
 INSERT INTO public.nightclub_purchase_receipts(user_id,profile_id,club_id,request_id,cash_spent)
 VALUES(actor,p_profile_id,p_club_id,p_request_id,price) RETURNING id INTO receipt;
 INSERT INTO public.player_owned_nightclubs(profile_id,club_id,club_name,city_id,
   quality_level,capacity,cover_charge,purchase_price,verified_purchase_id)
 VALUES(p_profile_id,p_club_id,club.name,club.city_id,club.quality_level,
   greatest(1,coalesce(club.capacity,100)),
   least(500,greatest(0,coalesce(club.cover_charge,10))),price,receipt)
 RETURNING id INTO owned;
 RETURN jsonb_build_object('receipt_id',receipt,'owned_club_id',owned,
   'club_id',p_club_id,'cash_spent',price,'replayed',false);
END
$function$;

CREATE OR REPLACE FUNCTION public.update_nightclub_settings(p_owned_club_id uuid, p_cover_charge integer DEFAULT NULL::integer, p_drink_markup_pct integer DEFAULT NULL::integer, p_is_open boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 active_id uuid:=public.current_active_player_profile_id();
 club public.player_owned_nightclubs%ROWTYPE;
BEGIN
 IF (select auth.uid()) IS NULL OR active_id IS NULL OR p_owned_club_id IS NULL THEN
  RAISE EXCEPTION 'Active owner required' USING ERRCODE='42501';
 END IF;
 IF p_cover_charge IS NULL AND p_drink_markup_pct IS NULL AND p_is_open IS NULL THEN
  RAISE EXCEPTION 'Choose a setting to change' USING ERRCODE='22023';
 END IF;
 IF (p_cover_charge IS NOT NULL AND p_cover_charge NOT BETWEEN 0 AND 500)
 OR (p_drink_markup_pct IS NOT NULL AND p_drink_markup_pct NOT BETWEEN 0 AND 200) THEN
  RAISE EXCEPTION 'Cover must be 0 to 500 and markup 0 to 200 percent' USING ERRCODE='22023';
 END IF;
 SELECT * INTO club FROM public.player_owned_nightclubs
 WHERE id=p_owned_club_id AND profile_id=active_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nightclub not owned by active character' USING ERRCODE='42501'; END IF;
 UPDATE public.player_owned_nightclubs SET
  cover_charge=coalesce(p_cover_charge,cover_charge),
  drink_markup_pct=coalesce(p_drink_markup_pct,drink_markup_pct),
  is_open=coalesce(p_is_open,is_open),updated_at=now()
 WHERE id=p_owned_club_id RETURNING * INTO club;
 RETURN jsonb_build_object('owned_club_id',club.id,'cover_charge',club.cover_charge,
 'drink_markup_pct',club.drink_markup_pct,'is_open',club.is_open);
END
$function$;

REVOKE ALL ON FUNCTION public.purchase_nightclub_atomic(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_nightclub_atomic(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.update_nightclub_settings(uuid,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_nightclub_settings(uuid,integer,integer,boolean) TO authenticated;
COMMENT ON COLUMN public.player_owned_nightclubs.verified_purchase_id IS
 'NULL for unverified legacy claims; require valid receipt for future DJ owner scheduling privileges.';
