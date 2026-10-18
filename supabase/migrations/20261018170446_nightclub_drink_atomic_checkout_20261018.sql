-- Applied directly to production as ledger version 20261018170446.
-- Atomic, idempotent nightclub drinks with canonical venue menu + optional stock.
-- Never trust client price/effect or use a stale client wallet snapshot.
CREATE TABLE IF NOT EXISTS public.nightclub_drink_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  club_id uuid NOT NULL REFERENCES public.city_night_clubs(id),
  drink_id text NOT NULL,
  drink_name text NOT NULL,
  cash_spent integer NOT NULL CHECK (cash_spent > 0 AND cash_spent <= 100000),
  energy_gained integer NOT NULL CHECK (energy_gained BETWEEN 0 AND 50),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nightclub_drink_purchases_request_uniq UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS nightclub_drink_purchases_profile_idx
  ON public.nightclub_drink_purchases (profile_id, created_at DESC);
ALTER TABLE public.nightclub_drink_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nightclub_drink_purchases FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_drink_purchases TO authenticated;
DROP POLICY IF EXISTS "Owned nightclub drink purchase receipts"
 ON public.nightclub_drink_purchases;
CREATE POLICY "Owned nightclub drink purchase receipts"
 ON public.nightclub_drink_purchases FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
 ));

CREATE OR REPLACE FUNCTION public.purchase_nightclub_drink(p_profile_id uuid, p_club_id uuid, p_drink_id text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_profile public.profiles%ROWTYPE;
 v_club public.city_night_clubs%ROWTYPE;
 v_receipt public.nightclub_drink_purchases%ROWTYPE;
 v_item jsonb;
 v_item_pos integer;
 v_name text;
 v_effect text;
 v_price_text text;
 v_price integer;
 v_stock_text text;
 v_stock integer;
 v_energy integer;
 v_cash bigint;
 v_energy_after integer;
 v_energy_gained integer;
 v_result jsonb;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL OR p_profile_id IS NULL
    OR p_club_id IS NULL OR p_drink_id IS NULL
    OR length(p_drink_id) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'Authenticated nightclub purchase request required'
     USING ERRCODE='42501';
 END IF;
 -- Lock the player's wallet first to serialize retries and simultaneous purchases.
 SELECT * INTO v_profile FROM public.profiles
 WHERE id=p_profile_id AND user_id=v_actor AND is_active IS TRUE FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'An active owned character is required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_receipt FROM public.nightclub_drink_purchases
 WHERE user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
   IF v_receipt.profile_id IS DISTINCT FROM p_profile_id
     OR v_receipt.club_id IS DISTINCT FROM p_club_id
     OR v_receipt.drink_id IS DISTINCT FROM p_drink_id THEN
     RAISE EXCEPTION 'Idempotency key already belongs to a different purchase'
       USING ERRCODE='22023';
   END IF;
   RETURN v_receipt.result || jsonb_build_object('replayed',true);
 END IF;

 -- Lock the nightclub menu, including optional stock, before checking current price.
 SELECT * INTO v_club FROM public.city_night_clubs
 WHERE id=p_club_id FOR UPDATE;
 IF NOT FOUND OR v_club.city_id IS DISTINCT FROM v_profile.current_city_id
    OR coalesce((v_club.metadata->>'live_interactions_enabled')::boolean,true) IS FALSE THEN
   RAISE EXCEPTION 'Nightclub purchase unavailable at current location'
     USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(v_club.drink_menu) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Nightclub drink menu is unavailable'
     USING ERRCODE='22023';
 END IF;

 SELECT menu.item,(menu.ordinality-1)::integer
   INTO v_item,v_item_pos
 FROM jsonb_array_elements(v_club.drink_menu) WITH ORDINALITY AS menu(item,ordinality)
 WHERE menu.item->>'id'=p_drink_id
 LIMIT 1;
 IF v_item IS NULL THEN
   RAISE EXCEPTION 'Drink is no longer available' USING ERRCODE='22023';
 END IF;
 v_price_text := v_item->>'price';
 v_name := nullif(btrim(v_item->>'name'),'');
 IF v_name IS NULL OR v_price_text IS NULL
    OR v_price_text !~ '^[0-9]{1,6}$' THEN
   RAISE EXCEPTION 'Drink has invalid menu price or name' USING ERRCODE='22023';
 END IF;
 v_price := v_price_text::integer;
 IF v_price NOT BETWEEN 1 AND 100000 THEN
   RAISE EXCEPTION 'Drink is not priced for purchase' USING ERRCODE='22023';
 END IF;
 IF coalesce(v_profile.cash,0) < v_price THEN
   RAISE EXCEPTION 'Insufficient cash for nightclub drink' USING ERRCODE='22023';
 END IF;

 -- Optional stock can be added to each menu entry by club operators.
 -- Missing stock means unmetered inventory (the current legacy catalogue).
 v_stock_text := v_item->>'stock';
 IF v_stock_text IS NOT NULL THEN
   IF v_stock_text !~ '^[0-9]{1,8}$' THEN
     RAISE EXCEPTION 'Invalid nightclub drink inventory' USING ERRCODE='22023';
   END IF;
   v_stock := v_stock_text::integer;
   IF v_stock < 1 THEN
     RAISE EXCEPTION 'Nightclub drink is out of stock' USING ERRCODE='22023';
   END IF;
 END IF;

 -- Existing legacy mechanic is +5 energy; respect explicit +N energy menu effects.
 v_effect := coalesce(v_item->>'effect','');
 v_energy := 5;
 IF v_effect ~* '^\+[0-9]{1,2} energy$' THEN
   v_energy := least(50,greatest(0,substring(v_effect FROM '[0-9]+')::integer));
 END IF;
 v_energy_after := least(100,coalesce(v_profile.energy,0)+v_energy);
 v_energy_gained := v_energy_after-coalesce(v_profile.energy,0);

 -- Auto-finance trigger journals exactly this cash change atomically.
 PERFORM set_config('app.player_cash_context',
   jsonb_build_object(
    'classification','nightclub_drink',
    'display_category','nightclub_drink',
    'description','Nightclub drink: '||v_name,
    'club_id',p_club_id,
    'drink_id',p_drink_id,
    'external_cash_flow',false
   )::text,true);
 UPDATE public.profiles SET cash=cash-v_price,energy=v_energy_after
 WHERE id=p_profile_id AND user_id=v_actor AND cash>=v_price
 RETURNING cash,energy INTO v_cash,v_energy_after;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Nightclub drink payment could not be committed'
     USING ERRCODE='22023';
 END IF;
 PERFORM set_config('app.player_cash_context','',true);

 IF v_stock IS NOT NULL THEN
   UPDATE public.city_night_clubs
   SET drink_menu=jsonb_set(drink_menu,ARRAY[v_item_pos::text,'stock'],
     to_jsonb(v_stock-1),false)
   WHERE id=p_club_id;
 END IF;

 v_result := jsonb_build_object(
   'purchase_id',p_request_id,'club_id',p_club_id,'drink_id',p_drink_id,
   'drink_name',v_name,'cash_spent',v_price,'energy_gained',v_energy_gained,
   'cash_after',v_cash,'energy_after',v_energy_after,'replayed',false
 );
 INSERT INTO public.nightclub_drink_purchases(
   user_id,profile_id,club_id,drink_id,drink_name,request_id,cash_spent,energy_gained,result
 ) VALUES(v_actor,p_profile_id,p_club_id,p_drink_id,v_name,p_request_id,v_price,
           v_energy_gained,v_result);
 RETURN v_result;
END;
$function$

REVOKE ALL ON FUNCTION public.purchase_nightclub_drink(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.purchase_nightclub_drink(uuid,uuid,text,uuid)
 TO authenticated;
COMMENT ON FUNCTION public.purchase_nightclub_drink(uuid,uuid,text,uuid) IS
 'Owned character, canonical venue drink price and optional stock, locked atomic wallet and energy update with auto-journal, once-only request receipt.';
