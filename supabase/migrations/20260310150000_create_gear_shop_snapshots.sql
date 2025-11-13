-- Add reserved funds tracking and expose gear shop snapshot function
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reserved_funds bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_gear_shop_item_snapshot(p_equipment_id uuid DEFAULT NULL)
RETURNS TABLE (
  equipment_id uuid,
  stock integer,
  cash bigint,
  reserved_funds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    ei.id AS equipment_id,
    ei.stock,
    p.cash,
    p.reserved_funds
  FROM public.profiles AS p
  JOIN public.equipment_items AS ei ON TRUE
  WHERE p.user_id = v_user_id
    AND (p_equipment_id IS NULL OR ei.id = p_equipment_id);
END;
$$;

COMMENT ON FUNCTION public.get_gear_shop_item_snapshot IS
  'Returns the player''s cash, reserved funds, and stock snapshot for gear shop items. Optional item filter reduces the result to a single gear piece.';
