-- Allow authenticated users to decrement catalog stock via a controlled function
CREATE OR REPLACE FUNCTION public.decrement_stage_equipment_catalog_stock(
  item_id TEXT,
  amount INTEGER DEFAULT 1
) RETURNS public.stage_equipment_catalog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.stage_equipment_catalog;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;

  UPDATE public.stage_equipment_catalog
  SET amount_available = GREATEST(amount_available - amount, 0),
      updated_at = now()
  WHERE id = item_id
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item % not found', item_id USING ERRCODE = 'P0002';
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_stage_equipment_catalog_stock(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_stage_equipment_catalog_stock(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stage_equipment_catalog_stock(TEXT, INTEGER) TO service_role;
