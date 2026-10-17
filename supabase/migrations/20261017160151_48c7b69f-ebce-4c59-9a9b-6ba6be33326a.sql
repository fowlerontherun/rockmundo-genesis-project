CREATE TABLE public.seller_payout_accounts (
  user_id uuid PRIMARY KEY,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_payout_accounts TO authenticated;
GRANT ALL ON public.seller_payout_accounts TO service_role;
ALTER TABLE public.seller_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payout account" ON public.seller_payout_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.skin_market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  seller_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_kind text NOT NULL CHECK (listing_kind IN ('item','set')),
  item_type text CHECK (item_type IN ('clothing','instrument')),
  item_id uuid,
  collection_id uuid NOT NULL REFERENCES public.skin_collections(id),
  price_minor integer NOT NULL CHECK (price_minor BETWEEN 99 AND 4999),
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reserved','sold','cancelled')),
  reserved_by_profile_id uuid,
  reserved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((listing_kind='item' AND item_type IS NOT NULL AND item_id IS NOT NULL) OR (listing_kind='set' AND item_id IS NULL))
);
CREATE INDEX skin_market_listings_status_idx ON public.skin_market_listings(status, created_at DESC);
GRANT SELECT ON public.skin_market_listings TO authenticated;
GRANT ALL ON public.skin_market_listings TO service_role;
ALTER TABLE public.skin_market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Browse open listings" ON public.skin_market_listings FOR SELECT TO authenticated
  USING (status IN ('open','reserved') OR seller_user_id = auth.uid());

CREATE TABLE public.skin_market_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.skin_market_listings(id),
  seller_user_id uuid NOT NULL,
  seller_profile_id uuid NOT NULL,
  buyer_user_id uuid NOT NULL,
  buyer_profile_id uuid NOT NULL,
  stripe_session_id text UNIQUE,
  payment_intent_id text,
  amount_minor integer NOT NULL,
  fee_minor integer NOT NULL,
  seller_payout_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','refunded','expired','failed')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.skin_market_sales TO authenticated;
GRANT ALL ON public.skin_market_sales TO service_role;
ALTER TABLE public.skin_market_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own market sales" ON public.skin_market_sales FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.skin_market_fee(p_price integer) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT round(p_price * 0.15)::integer $$;

CREATE OR REPLACE FUNCTION public._skin_item_collection(p_type text, p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_type='clothing' THEN (SELECT collection_id FROM avatar_clothing_items WHERE id=p_id)
              ELSE (SELECT collection_id FROM instrument_skin_items WHERE id=p_id) END
$$;
REVOKE ALL ON FUNCTION public._skin_item_collection(text,uuid) FROM PUBLIC, anon, authenticated;

-- Items in a listing (one item, or every item of the set)
CREATE OR REPLACE FUNCTION public._skin_listing_items(p_kind text, p_type text, p_item uuid, p_collection uuid)
RETURNS TABLE(item_type text, item_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_type, p_item WHERE p_kind='item'
  UNION ALL SELECT 'clothing', c.id FROM avatar_clothing_items c WHERE p_kind='set' AND c.collection_id=p_collection
  UNION ALL SELECT 'instrument', i.id FROM instrument_skin_items i WHERE p_kind='set' AND i.collection_id=p_collection
$$;
REVOKE ALL ON FUNCTION public._skin_listing_items(text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- Item can be sold if it came from a paid set or a market purchase
CREATE OR REPLACE FUNCTION public._skin_item_tradeable(p_profile uuid, p_type text, p_item uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM player_owned_skins o WHERE o.profile_id=p_profile AND o.item_type=p_type AND o.item_id=p_item)
  AND (
    EXISTS (SELECT 1 FROM skin_collection_purchases p WHERE p.profile_id=p_profile AND p.collection_id=_skin_item_collection(p_type,p_item))
    OR EXISTS (SELECT 1 FROM skin_market_sales s WHERE s.buyer_profile_id=p_profile AND s.status='completed'
               AND s.items @> jsonb_build_array(jsonb_build_object('item_type',p_type,'item_id',p_item)))
  )
$$;
REVOKE ALL ON FUNCTION public._skin_item_tradeable(uuid,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._skin_item_listed(p_profile uuid, p_type text, p_item uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM skin_market_listings l WHERE l.seller_profile_id=p_profile AND l.status IN ('open','reserved')
    AND ((l.listing_kind='item' AND l.item_type=p_type AND l.item_id=p_item)
      OR (l.listing_kind='set' AND l.collection_id=_skin_item_collection(p_type,p_item))))
$$;
REVOKE ALL ON FUNCTION public._skin_item_listed(uuid,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._block_equip_listed_skin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_equipped AND NOT COALESCE(OLD.is_equipped,false) AND _skin_item_listed(NEW.profile_id, NEW.item_type, NEW.item_id) THEN
    RAISE EXCEPTION 'This item is listed on the Skin Market. Cancel the listing to wear it.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._block_equip_listed_skin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER block_equip_listed_skin BEFORE UPDATE ON public.player_owned_skins FOR EACH ROW EXECUTE FUNCTION public._block_equip_listed_skin();

CREATE OR REPLACE FUNCTION public.create_skin_listing(p_profile_id uuid, p_kind text, p_item_type text, p_item_id uuid, p_collection_id uuid, p_price_minor integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_collection uuid; v_id uuid; r record; v_n int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_profile_id AND user_id=v_uid) THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM seller_payout_accounts WHERE user_id=v_uid AND charges_enabled) THEN RAISE EXCEPTION 'Set up payouts before selling'; END IF;
  IF p_price_minor IS NULL OR p_price_minor < 99 OR p_price_minor > 4999 THEN RAISE EXCEPTION 'Price must be between £0.99 and £49.99'; END IF;
  IF p_kind = 'item' THEN
    IF p_item_type NOT IN ('clothing','instrument') OR p_item_id IS NULL THEN RAISE EXCEPTION 'Choose an item'; END IF;
    v_collection := _skin_item_collection(p_item_type, p_item_id);
  ELSIF p_kind = 'set' THEN
    v_collection := p_collection_id; p_item_type := NULL; p_item_id := NULL;
  ELSE RAISE EXCEPTION 'Invalid listing type'; END IF;
  IF v_collection IS NULL THEN RAISE EXCEPTION 'Only items from skin sets can be sold'; END IF;
  FOR r IN SELECT * FROM _skin_listing_items(p_kind, p_item_type, p_item_id, v_collection) LOOP
    v_n := v_n + 1;
    IF NOT _skin_item_tradeable(p_profile_id, r.item_type, r.item_id) THEN
      RAISE EXCEPTION 'You can only sell items bought with real money that you still own';
    END IF;
    IF _skin_item_listed(p_profile_id, r.item_type, r.item_id) THEN RAISE EXCEPTION 'This item is already listed'; END IF;
  END LOOP;
  IF v_n = 0 THEN RAISE EXCEPTION 'Nothing to sell'; END IF;
  INSERT INTO skin_market_listings (seller_user_id, seller_profile_id, listing_kind, item_type, item_id, collection_id, price_minor)
  VALUES (v_uid, p_profile_id, p_kind, p_item_type, p_item_id, v_collection, p_price_minor) RETURNING id INTO v_id;
  UPDATE player_owned_skins o SET is_equipped=false FROM _skin_listing_items(p_kind, p_item_type, p_item_id, v_collection) li
   WHERE o.profile_id=p_profile_id AND o.item_type=li.item_type AND o.item_id=li.item_id AND o.is_equipped;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_skin_listing(uuid,text,text,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_skin_listing(uuid,text,text,uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_skin_listing(p_listing_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE skin_market_listings SET status='cancelled', updated_at=now()
   WHERE id=p_listing_id AND seller_user_id=auth.uid()
     AND (status='open' OR (status='reserved' AND reserved_until < now()));
  IF NOT FOUND THEN RAISE EXCEPTION 'This listing cannot be cancelled right now'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.cancel_skin_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_skin_listing(uuid) TO authenticated;

-- Service role: hold a listing for a buyer for 30 minutes and open a pending sale
CREATE OR REPLACE FUNCTION public.reserve_skin_listing(p_listing_id uuid, p_buyer_user_id uuid, p_buyer_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l skin_market_listings; v_acct text; v_sale uuid; v_fee int;
BEGIN
  SELECT * INTO l FROM skin_market_listings WHERE id=p_listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF NOT (l.status='open' OR (l.status='reserved' AND l.reserved_until < now())) THEN RAISE EXCEPTION 'This listing is no longer available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_buyer_profile_id AND user_id=p_buyer_user_id) THEN RAISE EXCEPTION 'Character not found'; END IF;
  IF l.seller_user_id = p_buyer_user_id THEN RAISE EXCEPTION 'You cannot buy your own listing'; END IF;
  IF EXISTS (SELECT 1 FROM _skin_listing_items(l.listing_kind,l.item_type,l.item_id,l.collection_id) li
             JOIN player_owned_skins o ON o.profile_id=p_buyer_profile_id AND o.item_type=li.item_type AND o.item_id=li.item_id) THEN
    RAISE EXCEPTION 'This character already owns this item';
  END IF;
  SELECT stripe_account_id INTO v_acct FROM seller_payout_accounts WHERE user_id=l.seller_user_id AND charges_enabled;
  IF v_acct IS NULL THEN RAISE EXCEPTION 'The seller cannot receive payments right now'; END IF;
  UPDATE skin_market_sales SET status='expired' WHERE listing_id=l.id AND status='pending';
  UPDATE skin_market_listings SET status='reserved', reserved_by_profile_id=p_buyer_profile_id, reserved_until=now()+interval '30 minutes', updated_at=now() WHERE id=l.id;
  v_fee := skin_market_fee(l.price_minor);
  INSERT INTO skin_market_sales (listing_id, seller_user_id, seller_profile_id, buyer_user_id, buyer_profile_id, amount_minor, fee_minor, seller_payout_minor, currency)
  VALUES (l.id, l.seller_user_id, l.seller_profile_id, p_buyer_user_id, p_buyer_profile_id, l.price_minor, v_fee, l.price_minor - v_fee, l.currency)
  RETURNING id INTO v_sale;
  RETURN jsonb_build_object('sale_id', v_sale, 'price_minor', l.price_minor, 'fee_minor', v_fee, 'currency', l.currency,
    'destination', v_acct, 'listing_kind', l.listing_kind, 'collection_id', l.collection_id, 'item_type', l.item_type, 'item_id', l.item_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_skin_listing(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_skin_listing(uuid,uuid,uuid) TO service_role;

-- Service role: after payment, move items from seller to buyer
CREATE OR REPLACE FUNCTION public.complete_skin_market_sale(p_session_id text, p_payment_intent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s skin_market_sales; l skin_market_listings; v_items jsonb := '[]'::jsonb; r record;
BEGIN
  SELECT * INTO s FROM skin_market_sales WHERE stripe_session_id=p_session_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF s.status='completed' THEN RETURN jsonb_build_object('status','already_completed','items',jsonb_array_length(s.items)); END IF;
  SELECT * INTO l FROM skin_market_listings WHERE id=s.listing_id FOR UPDATE;
  IF l.status IN ('sold','cancelled') OR (l.status='reserved' AND l.reserved_by_profile_id <> s.buyer_profile_id) THEN
    UPDATE skin_market_sales SET status='failed', payment_intent_id=p_payment_intent WHERE id=s.id;
    RETURN jsonb_build_object('status','needs_refund');
  END IF;
  FOR r IN SELECT * FROM _skin_listing_items(l.listing_kind,l.item_type,l.item_id,l.collection_id) LOOP
    DELETE FROM player_owned_skins WHERE profile_id=s.seller_profile_id AND item_type=r.item_type AND item_id=r.item_id;
    IF FOUND THEN
      INSERT INTO player_owned_skins (profile_id,item_type,item_id) VALUES (s.buyer_profile_id,r.item_type,r.item_id)
        ON CONFLICT (profile_id,item_type,item_id) DO NOTHING;
      v_items := v_items || jsonb_build_array(jsonb_build_object('item_type',r.item_type,'item_id',r.item_id));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_items)=0 THEN
    UPDATE skin_market_sales SET status='failed', payment_intent_id=p_payment_intent WHERE id=s.id;
    UPDATE skin_market_listings SET status='cancelled', updated_at=now() WHERE id=l.id;
    RETURN jsonb_build_object('status','needs_refund');
  END IF;
  UPDATE skin_market_listings SET status='sold', updated_at=now() WHERE id=l.id;
  UPDATE skin_market_sales SET status='completed', payment_intent_id=p_payment_intent, items=v_items, completed_at=now() WHERE id=s.id;
  RETURN jsonb_build_object('status','completed','items',jsonb_array_length(v_items));
END $$;
REVOKE ALL ON FUNCTION public.complete_skin_market_sale(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_skin_market_sale(text,text) TO service_role;

-- Service role: refund returns items to the seller
CREATE OR REPLACE FUNCTION public.refund_skin_market_sale(p_payment_intent text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s skin_market_sales; r record;
BEGIN
  SELECT * INTO s FROM skin_market_sales WHERE payment_intent_id=p_payment_intent FOR UPDATE;
  IF s.id IS NULL OR s.status <> 'completed' THEN RETURN jsonb_build_object('status','ignored'); END IF;
  FOR r IN SELECT (e->>'item_type') AS item_type, (e->>'item_id')::uuid AS item_id FROM jsonb_array_elements(s.items) e LOOP
    DELETE FROM player_owned_skins WHERE profile_id=s.buyer_profile_id AND item_type=r.item_type AND item_id=r.item_id;
    IF FOUND THEN
      INSERT INTO player_owned_skins (profile_id,item_type,item_id) VALUES (s.seller_profile_id,r.item_type,r.item_id)
        ON CONFLICT (profile_id,item_type,item_id) DO NOTHING;
    END IF;
  END LOOP;
  UPDATE skin_market_sales SET status='refunded' WHERE id=s.id;
  RETURN jsonb_build_object('status','refunded');
END $$;
REVOKE ALL ON FUNCTION public.refund_skin_market_sale(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_skin_market_sale(text) TO service_role;