-- Run only against an isolated festival test database.
-- The outer rollback guarantees the fixture brand remains unchanged.
BEGIN;
DO $test$
DECLARE
  v_brand_id uuid;
  v_constraint text;
BEGIN
  SELECT id INTO v_brand_id
  FROM public.sponsorship_brands
  WHERE is_active AND nullif(btrim(logo_url), '') IS NOT NULL
  LIMIT 1 FOR UPDATE;

  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'brand logo guard harness requires an active branded fixture';
  END IF;

  BEGIN
    UPDATE public.sponsorship_brands SET logo_url = NULL WHERE id = v_brand_id;
    RAISE EXCEPTION 'active brand accepted a NULL logo';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'sponsorship_brands_active_logo_not_blank' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.sponsorship_brands SET logo_url = '   ' WHERE id = v_brand_id;
    RAISE EXCEPTION 'active brand accepted a blank logo';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'sponsorship_brands_active_logo_not_blank' THEN
      RAISE;
    END IF;
  END;

  -- Deactivating a brand must permit removal of its logo for future repair.
  UPDATE public.sponsorship_brands
  SET is_active = false, logo_url = NULL
  WHERE id = v_brand_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inactive brand update did not succeed';
  END IF;
END;
$test$;
ROLLBACK;
