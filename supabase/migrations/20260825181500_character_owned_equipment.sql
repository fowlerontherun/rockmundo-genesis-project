-- Gear belongs to a character profile, not to the auth account.
-- Existing account-owned inventory is assigned to the account's active living character.

ALTER TABLE public.player_equipment_inventory ADD COLUMN IF NOT EXISTS profile_id uuid;
ALTER TABLE public.player_equipment ADD COLUMN IF NOT EXISTS profile_id uuid;

UPDATE public.player_equipment_inventory pei
SET profile_id = (
  SELECT p.id FROM public.profiles p
  WHERE p.user_id = pei.user_id AND p.died_at IS NULL AND p.deleted_at IS NULL
  ORDER BY COALESCE(p.is_active,false) DESC, p.updated_at DESC NULLS LAST, p.created_at DESC, p.id
  LIMIT 1
)
WHERE pei.profile_id IS NULL;

UPDATE public.player_equipment pe
SET profile_id = (
  SELECT p.id FROM public.profiles p
  WHERE (p.id = pe.user_id OR p.user_id = pe.user_id) AND p.died_at IS NULL AND p.deleted_at IS NULL
  ORDER BY CASE WHEN p.id = pe.user_id THEN 0 ELSE 1 END, COALESCE(p.is_active,false) DESC, p.updated_at DESC NULLS LAST, p.created_at DESC
  LIMIT 1
)
WHERE pe.profile_id IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.player_equipment_inventory WHERE profile_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate equipment inventory: unresolved character owner';
  END IF;
  IF EXISTS (SELECT 1 FROM public.player_equipment WHERE profile_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate player equipment: unresolved character owner';
  END IF;
END $$;

ALTER TABLE public.player_equipment_inventory ALTER COLUMN profile_id SET NOT NULL;
ALTER TABLE public.player_equipment ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE public.player_equipment_inventory DROP CONSTRAINT IF EXISTS player_equipment_inventory_profile_id_fkey;
ALTER TABLE public.player_equipment_inventory ADD CONSTRAINT player_equipment_inventory_profile_id_fkey FOREIGN KEY(profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.player_equipment DROP CONSTRAINT IF EXISTS player_equipment_profile_id_fkey;
ALTER TABLE public.player_equipment ADD CONSTRAINT player_equipment_profile_id_fkey FOREIGN KEY(profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_player_equipment_inventory_profile ON public.player_equipment_inventory(profile_id,is_equipped,purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_equipment_profile ON public.player_equipment(profile_id,is_equipped,purchased_at DESC);

DROP POLICY IF EXISTS "Users can manage their own inventory" ON public.player_equipment_inventory;
DROP POLICY IF EXISTS "Users can view their own inventory" ON public.player_equipment_inventory;
DROP POLICY IF EXISTS "Users can manage their character inventory" ON public.player_equipment_inventory;
DROP POLICY IF EXISTS "Users can view their character inventory" ON public.player_equipment_inventory;
DROP POLICY IF EXISTS "Active character can manage inventory" ON public.player_equipment_inventory;
DROP POLICY IF EXISTS "Active character can view inventory" ON public.player_equipment_inventory;
CREATE POLICY "Active character can manage inventory" ON public.player_equipment_inventory FOR ALL
USING (profile_id = public.current_profile_id() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid() AND p.user_id=user_id))
WITH CHECK (profile_id = public.current_profile_id() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid() AND p.user_id=user_id));
CREATE POLICY "Active character can view inventory" ON public.player_equipment_inventory FOR SELECT
USING (profile_id = public.current_profile_id() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid() AND p.user_id=user_id));

DROP POLICY IF EXISTS "Users can manage their own equipment" ON public.player_equipment;
DROP POLICY IF EXISTS "Users can manage their character equipment" ON public.player_equipment;
DROP POLICY IF EXISTS "Active character can manage equipment" ON public.player_equipment;
CREATE POLICY "Active character can manage equipment" ON public.player_equipment FOR ALL
USING (profile_id = public.current_profile_id() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()))
WITH CHECK (profile_id = public.current_profile_id() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.ensure_inventory_character_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_profile uuid; v_user uuid;
BEGIN
  IF NEW.profile_id IS NULL THEN
    SELECT p.id INTO v_profile FROM public.profiles p
    WHERE p.user_id=NEW.user_id AND p.died_at IS NULL AND p.deleted_at IS NULL
    ORDER BY COALESCE(p.is_active,false) DESC,p.updated_at DESC NULLS LAST,p.created_at DESC,p.id LIMIT 1;
    NEW.profile_id:=v_profile;
  END IF;
  SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.id=NEW.profile_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Equipment owner profile not found'; END IF;
  NEW.user_id:=v_user;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_inventory_character_owner ON public.player_equipment_inventory;
CREATE TRIGGER trg_inventory_character_owner BEFORE INSERT OR UPDATE OF profile_id,user_id ON public.player_equipment_inventory
FOR EACH ROW EXECUTE FUNCTION public.ensure_inventory_character_owner();

CREATE OR REPLACE FUNCTION public.ensure_player_equipment_character_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_profile uuid;
BEGIN
  IF NEW.profile_id IS NULL THEN
    SELECT p.id INTO v_profile FROM public.profiles p WHERE p.id=NEW.user_id AND p.died_at IS NULL AND p.deleted_at IS NULL LIMIT 1;
    IF v_profile IS NULL THEN
      SELECT p.id INTO v_profile FROM public.profiles p WHERE p.user_id=NEW.user_id AND p.died_at IS NULL AND p.deleted_at IS NULL
      ORDER BY COALESCE(p.is_active,false) DESC,p.updated_at DESC NULLS LAST,p.created_at DESC,p.id LIMIT 1;
    END IF;
    NEW.profile_id:=v_profile;
  END IF;
  IF NEW.profile_id IS NULL THEN RAISE EXCEPTION 'Equipment owner profile not found'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_player_equipment_character_owner ON public.player_equipment;
CREATE TRIGGER trg_player_equipment_character_owner BEFORE INSERT OR UPDATE OF profile_id,user_id ON public.player_equipment
FOR EACH ROW EXECUTE FUNCTION public.ensure_player_equipment_character_owner();

CREATE OR REPLACE FUNCTION public.list_transferable_equipment(sender_profile_id uuid DEFAULT NULL)
RETURNS TABLE(inventory_id uuid,equipment_id uuid,name text,category text,condition integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_sender uuid:=COALESCE(sender_profile_id,public.current_profile_id());
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_sender AND p.user_id=auth.uid() AND p.died_at IS NULL AND p.deleted_at IS NULL) THEN RETURN; END IF;
  RETURN QUERY SELECT pei.id,pei.equipment_id,ec.name,ec.category,COALESCE(pei.condition,100)
  FROM public.player_equipment_inventory pei JOIN public.equipment_catalog ec ON ec.id=pei.equipment_id
  WHERE pei.profile_id=v_sender AND COALESCE(pei.is_equipped,false)=false ORDER BY ec.name,pei.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.send_equipment_to_player(target_profile_id uuid,inventory_id uuid,sender_profile_id uuid DEFAULT NULL,note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_sender uuid:=COALESCE(sender_profile_id,public.current_profile_id()); v_recipient_user uuid; v_equipment uuid; v_name text; v_transfer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_sender AND p.user_id=auth.uid() AND p.died_at IS NULL AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Active character is not available'; END IF;
  IF target_profile_id IS NULL OR target_profile_id=v_sender THEN RAISE EXCEPTION 'Choose another character'; END IF;
  SELECT p.user_id INTO v_recipient_user FROM public.profiles p WHERE p.id=target_profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL;
  IF v_recipient_user IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF public.are_profiles_blocked(v_sender,target_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  SELECT pei.equipment_id,ec.name INTO v_equipment,v_name FROM public.player_equipment_inventory pei JOIN public.equipment_catalog ec ON ec.id=pei.equipment_id
  WHERE pei.id=inventory_id AND pei.profile_id=v_sender AND COALESCE(pei.is_equipped,false)=false FOR UPDATE;
  IF v_equipment IS NULL THEN RAISE EXCEPTION 'That item is no longer available to send'; END IF;
  UPDATE public.player_equipment_inventory SET profile_id=target_profile_id,user_id=v_recipient_user,is_equipped=false,updated_at=now() WHERE id=inventory_id;
  INSERT INTO public.player_social_transfers(sender_profile_id,recipient_profile_id,transfer_type,equipment_inventory_id,equipment_id,note)
  VALUES(v_sender,target_profile_id,'equipment',inventory_id,v_equipment,NULLIF(BTRIM(note),'')) RETURNING id INTO v_transfer;
  RETURN jsonb_build_object('transfer_id',v_transfer,'inventory_id',inventory_id,'equipment_id',v_equipment,'name',v_name);
END $$;

-- Atomic shop purchase now writes both account identity and authoritative character owner.
CREATE OR REPLACE FUNCTION public.purchase_equipment_atomic(p_profile_id uuid,p_equipment_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_user uuid:=auth.uid(); v_profile public.profiles; v_eq public.equipment_catalog; v_existing public.equipment_purchases; v_inventory uuid; v_purchase uuid; v_cash numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_profile_id IS NULL THEN RAISE EXCEPTION 'profile_required'; END IF;
  IF p_equipment_id IS NULL THEN RAISE EXCEPTION 'equipment_required'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'idempotency_key_invalid'; END IF;
  SELECT * INTO v_existing FROM public.equipment_purchases WHERE idempotency_key=p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.profile_id<>p_profile_id OR v_existing.equipment_id<>p_equipment_id THEN RAISE EXCEPTION 'idempotency_key_conflict'; END IF;
    RETURN jsonb_build_object('status','already_completed','purchaseId',v_existing.id,'inventoryId',v_existing.inventory_id,'equipmentId',v_existing.equipment_id,'amount',v_existing.amount);
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=v_user AND died_at IS NULL AND deleted_at IS NULL FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'profile_not_owned_by_user'; END IF;
  SELECT * INTO v_eq FROM public.equipment_catalog WHERE id=p_equipment_id AND is_available=true FOR UPDATE;
  IF v_eq.id IS NULL THEN RAISE EXCEPTION 'equipment_not_available'; END IF;
  IF v_eq.base_price IS NULL OR v_eq.base_price<=0 THEN RAISE EXCEPTION 'equipment_price_invalid'; END IF;
  IF v_eq.stock_quantity IS NOT NULL AND v_eq.stock_quantity<=0 THEN RAISE EXCEPTION 'equipment_out_of_stock'; END IF;
  IF COALESCE(v_profile.cash,0)<v_eq.base_price THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  UPDATE public.profiles SET cash=cash-v_eq.base_price WHERE id=p_profile_id RETURNING cash INTO v_cash;
  IF v_eq.stock_quantity IS NOT NULL THEN
    UPDATE public.equipment_catalog SET stock_quantity=stock_quantity-1 WHERE id=p_equipment_id AND stock_quantity>0;
    IF NOT FOUND THEN RAISE EXCEPTION 'equipment_out_of_stock'; END IF;
  END IF;
  INSERT INTO public.player_equipment_inventory(user_id,profile_id,equipment_id) VALUES(v_user,p_profile_id,p_equipment_id) RETURNING id INTO v_inventory;
  INSERT INTO public.equipment_purchases(profile_id,user_id,equipment_id,inventory_id,amount,idempotency_key)
  VALUES(p_profile_id,v_user,p_equipment_id,v_inventory,v_eq.base_price,p_idempotency_key) RETURNING id INTO v_purchase;
  RETURN jsonb_build_object('status','completed','purchaseId',v_purchase,'inventoryId',v_inventory,'equipmentId',p_equipment_id,'amount',v_eq.base_price,'remainingCash',v_cash);
END $$;

NOTIFY pgrst,'reload schema';
