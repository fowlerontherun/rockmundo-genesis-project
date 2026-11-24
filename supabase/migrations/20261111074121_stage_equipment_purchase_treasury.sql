-- Keep the purchase result independently of inventory so a network retry cannot
-- charge again even if the equipment has since been removed.
CREATE TABLE public.stage_equipment_purchase_receipts (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (profile_id, request_id)
);

ALTER TABLE public.stage_equipment_purchase_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stage_equipment_purchase_receipts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.purchase_band_stage_equipment_atomic(
  p_band_id uuid,
  p_catalog_item_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public.current_player_profile_id();
  v_catalog public.equipment_catalog;
  v_receipt public.stage_equipment_purchase_receipts;
  v_equipment_id uuid;
  v_price integer;
  v_result jsonb;
  v_key text;
BEGIN
  IF v_profile_id IS NULL OR p_request_id IS NULL OR p_band_id IS NULL OR p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'invalid_equipment_purchase_request';
  END IF;

  IF NOT public._band_active_member(p_band_id, v_profile_id) THEN
    RAISE EXCEPTION 'not_band_member' USING ERRCODE = '42501';
  END IF;

  v_key := 'stage_equipment_purchase:' || v_profile_id::text || ':' || p_request_id::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));

  SELECT * INTO v_receipt FROM public.stage_equipment_purchase_receipts
  WHERE profile_id = v_profile_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_receipt.band_id <> p_band_id OR v_receipt.catalog_item_id <> p_catalog_item_id THEN
      RAISE EXCEPTION 'equipment_purchase_request_mismatch';
    END IF;
    RETURN v_receipt.result;
  END IF;

  SELECT * INTO v_catalog FROM public.equipment_catalog
  WHERE id = p_catalog_item_id AND category = 'stage' AND is_available
  FOR SHARE;
  IF NOT FOUND OR v_catalog.base_price IS NULL OR v_catalog.base_price < 0 THEN
    RAISE EXCEPTION 'stage_equipment_unavailable';
  END IF;

  v_price := v_catalog.base_price::integer;
  PERFORM public._debit_atomic_booking_payment(
    p_band_id, v_profile_id, 'band', v_price::bigint * 100,
    'stage_equipment_purchase', v_key, 'Stage equipment: ' || v_catalog.name
  );

  INSERT INTO public.band_stage_equipment (
    band_id, equipment_name, equipment_type, quality_rating, condition_rating,
    condition, purchase_cost, purchase_date, size_units, notes, is_active
  ) VALUES (
    p_band_id, v_catalog.name, coalesce(nullif(v_catalog.subcategory, ''), 'general'),
    greatest(0, least(100, coalesce(v_catalog.quality_rating, 80))),
    100, 'excellent', v_price, now(), 3,
    jsonb_build_object(
      'weight', 'medium', 'size', 'medium', 'baseCondition', 'brand_new',
      'showsPerformed', 0, 'liveSelected', false, 'value', v_price,
      'liveImpact', coalesce(nullif(v_catalog.description, ''), 'Professional shared stage equipment.'),
      'rarity', coalesce(v_catalog.rarity, 'normal'),
      'lastConditionTier', 'brand_new', 'lastConditionPoints', 100
    )::text, false
  ) RETURNING id INTO v_equipment_id;

  v_result := jsonb_build_object(
    'equipment_id', v_equipment_id, 'equipment_name', v_catalog.name, 'price', v_price
  );
  INSERT INTO public.stage_equipment_purchase_receipts (
    profile_id, request_id, band_id, catalog_item_id, result
  ) VALUES (v_profile_id, p_request_id, p_band_id, p_catalog_item_id, v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_band_stage_equipment_atomic(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_band_stage_equipment_atomic(uuid, uuid, uuid)
  TO authenticated;
