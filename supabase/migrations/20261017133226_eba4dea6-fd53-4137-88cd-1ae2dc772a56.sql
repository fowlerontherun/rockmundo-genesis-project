CREATE TABLE public.skin_collection_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.skin_collections(id),
  stripe_session_id text NOT NULL UNIQUE,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  items_granted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skin_collection_purchases TO authenticated;
GRANT ALL ON public.skin_collection_purchases TO service_role;
ALTER TABLE public.skin_collection_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players see their own set purchases" ON public.skin_collection_purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Collection items are sold only as paid sets, never with in-game cash.
CREATE OR REPLACE FUNCTION public.block_cash_purchase_of_collection_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_collection uuid;
BEGIN
  IF TG_TABLE_NAME = 'clothing_skin_purchases' THEN
    SELECT collection_id INTO v_collection FROM public.avatar_clothing_items WHERE id = NEW.clothing_item_id;
  ELSE
    SELECT collection_id INTO v_collection FROM public.instrument_skin_items WHERE id = NEW.instrument_skin_item_id;
  END IF;
  IF v_collection IS NOT NULL THEN
    RAISE EXCEPTION 'collection_items_sold_as_paid_set';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER block_cash_collection_clothing BEFORE INSERT ON public.clothing_skin_purchases
  FOR EACH ROW EXECUTE FUNCTION public.block_cash_purchase_of_collection_items();
CREATE TRIGGER block_cash_collection_instrument BEFORE INSERT ON public.instrument_skin_purchases
  FOR EACH ROW EXECUTE FUNCTION public.block_cash_purchase_of_collection_items();

CREATE OR REPLACE FUNCTION public.grant_paid_skin_collection(
  p_session_id text, p_user_id uuid, p_profile_id uuid, p_collection_id uuid,
  p_amount_minor integer, p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing public.skin_collection_purchases; v_count integer := 0; v_n integer;
BEGIN
  SELECT * INTO v_existing FROM public.skin_collection_purchases WHERE stripe_session_id = p_session_id;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_granted','items',v_existing.items_granted);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'profile_not_owned_by_user';
  END IF;
  INSERT INTO public.player_owned_skins (profile_id, item_type, item_id)
  SELECT p_profile_id, 'clothing', c.id FROM public.avatar_clothing_items c
  WHERE c.collection_id = p_collection_id
    AND NOT EXISTS (SELECT 1 FROM public.player_owned_skins o WHERE o.profile_id = p_profile_id AND o.item_type='clothing' AND o.item_id=c.id);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;
  INSERT INTO public.player_owned_skins (profile_id, item_type, item_id)
  SELECT p_profile_id, 'instrument', i.id FROM public.instrument_skin_items i
  WHERE i.collection_id = p_collection_id
    AND NOT EXISTS (SELECT 1 FROM public.player_owned_skins o WHERE o.profile_id = p_profile_id AND o.item_type='instrument' AND o.item_id=i.id);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;
  INSERT INTO public.skin_collection_purchases (user_id, profile_id, collection_id, stripe_session_id, amount_minor, currency, items_granted)
  VALUES (p_user_id, p_profile_id, p_collection_id, p_session_id, p_amount_minor, p_currency, v_count);
  RETURN jsonb_build_object('status','granted','items',v_count);
END $$;
REVOKE ALL ON FUNCTION public.grant_paid_skin_collection(text,uuid,uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_paid_skin_collection(text,uuid,uuid,uuid,integer,text) TO service_role;