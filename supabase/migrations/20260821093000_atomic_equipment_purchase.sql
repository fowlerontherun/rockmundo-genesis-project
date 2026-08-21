-- Atomic equipment purchasing for the live legacy cash-based economy.
-- This migration intentionally does not depend on the newer finance ledger tables.

CREATE TABLE IF NOT EXISTS public.equipment_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    equipment_id uuid NOT NULL REFERENCES public.equipment_catalog(id),
    inventory_id uuid REFERENCES public.player_equipment_inventory(id),
    amount numeric NOT NULL CHECK (amount > 0),
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_purchases_profile
ON public.equipment_purchases(profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.purchase_equipment_atomic(
    p_profile_id uuid,
    p_equipment_id uuid,
    p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_equipment public.equipment_catalog;
    v_existing public.equipment_purchases;
    v_inventory_id uuid;
    v_purchase_id uuid;
    v_remaining_cash numeric;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
    IF p_profile_id IS NULL THEN RAISE EXCEPTION 'profile_required'; END IF;
    IF p_equipment_id IS NULL THEN RAISE EXCEPTION 'equipment_required'; END IF;
    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
        RAISE EXCEPTION 'idempotency_key_invalid';
    END IF;

    SELECT * INTO v_existing
    FROM public.equipment_purchases
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.profile_id <> p_profile_id OR v_existing.equipment_id <> p_equipment_id THEN
            RAISE EXCEPTION 'idempotency_key_conflict';
        END IF;
        RETURN jsonb_build_object(
            'status', 'already_completed',
            'purchaseId', v_existing.id,
            'inventoryId', v_existing.inventory_id,
            'equipmentId', v_existing.equipment_id,
            'amount', v_existing.amount
        );
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id AND user_id = v_user_id
    FOR UPDATE;

    IF v_profile.id IS NULL THEN RAISE EXCEPTION 'profile_not_owned_by_user'; END IF;

    SELECT * INTO v_equipment
    FROM public.equipment_catalog
    WHERE id = p_equipment_id AND is_available = true
    FOR UPDATE;

    IF v_equipment.id IS NULL THEN RAISE EXCEPTION 'equipment_not_available'; END IF;
    IF v_equipment.base_price IS NULL OR v_equipment.base_price <= 0 THEN
        RAISE EXCEPTION 'equipment_price_invalid';
    END IF;
    IF v_equipment.stock_quantity IS NOT NULL AND v_equipment.stock_quantity <= 0 THEN
        RAISE EXCEPTION 'equipment_out_of_stock';
    END IF;
    IF COALESCE(v_profile.cash, 0) < v_equipment.base_price THEN
        RAISE EXCEPTION 'insufficient_funds';
    END IF;

    UPDATE public.profiles
    SET cash = cash - v_equipment.base_price
    WHERE id = p_profile_id
    RETURNING cash INTO v_remaining_cash;

    IF v_equipment.stock_quantity IS NOT NULL THEN
        UPDATE public.equipment_catalog
        SET stock_quantity = stock_quantity - 1
        WHERE id = p_equipment_id AND stock_quantity > 0;
        IF NOT FOUND THEN RAISE EXCEPTION 'equipment_out_of_stock'; END IF;
    END IF;

    INSERT INTO public.player_equipment_inventory (user_id, equipment_id)
    VALUES (v_user_id, p_equipment_id)
    RETURNING id INTO v_inventory_id;

    INSERT INTO public.equipment_purchases (
        profile_id, user_id, equipment_id, inventory_id, amount, idempotency_key
    ) VALUES (
        p_profile_id, v_user_id, p_equipment_id, v_inventory_id, v_equipment.base_price, p_idempotency_key
    ) RETURNING id INTO v_purchase_id;

    RETURN jsonb_build_object(
        'status', 'completed',
        'purchaseId', v_purchase_id,
        'inventoryId', v_inventory_id,
        'equipmentId', p_equipment_id,
        'amount', v_equipment.base_price,
        'remainingCash', v_remaining_cash
    );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_equipment_atomic(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_equipment_atomic(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_equipment_atomic(uuid, uuid, text) TO authenticated;

ALTER TABLE public.equipment_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their equipment purchases" ON public.equipment_purchases;
CREATE POLICY "Users can view their equipment purchases"
ON public.equipment_purchases
FOR SELECT TO authenticated
USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
