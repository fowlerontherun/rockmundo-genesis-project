-- #2182 isolated test-db-only fixture harness. Uses a transaction rollback.
-- Never run on production: row locks and deliberate constraint violations.
BEGIN;
DO $test$
DECLARE
  v_edition uuid;
  v_completed uuid;
  v_brands uuid[];
  v_main uuid;
  v_count integer;
  v_constraint text;
BEGIN
  IF to_regclass('public.festival_edition_sponsor_assignments') IS NULL THEN
    RAISE EXCEPTION 'edition sponsor migration is missing';
  END IF;
  IF has_table_privilege('authenticated',
       'public.festival_edition_sponsor_assignments', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated role must not write sponsor identities directly';
  END IF;

  SELECT id INTO v_edition FROM public.festival_editions_v2
  WHERE status = 'configuring' AND locked_at IS NULL AND configuration_locked_at IS NULL
  LIMIT 1 FOR UPDATE;
  SELECT id INTO v_completed FROM public.festival_editions_v2
  WHERE status = 'completed' LIMIT 1;
  IF v_edition IS NULL OR v_completed IS NULL THEN
    RAISE EXCEPTION 'requires one editable and one completed edition test fixture';
  END IF;

  SELECT array_agg(id ORDER BY name, id) INTO v_brands FROM (
    SELECT id,name FROM public.sponsorship_brands
    WHERE is_active AND coalesce(available_budget,0)>0 AND logo_url IS NOT NULL
      AND NOT coalesce(exclusivity_pref,false)
    ORDER BY name,id LIMIT 8
  ) eligible;
  IF coalesce(array_length(v_brands,1),0)<7 THEN
    RAISE EXCEPTION 'requires seven distinct eligible fictional brands';
  END IF;

  INSERT INTO public.festival_edition_sponsor_assignments(
    festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
    logo_url_snapshot,category_snapshot,region_snapshot
  ) VALUES(v_edition,v_brands[1],'main','ignored','ignored','ignored','ignored')
  RETURNING id INTO v_main;
  IF NOT EXISTS (
    SELECT 1 FROM public.festival_edition_sponsor_assignments a
    JOIN public.sponsorship_brands b ON b.id=a.sponsorship_brand_id
    WHERE a.id=v_main AND a.brand_name_snapshot=b.name AND a.logo_url_snapshot=b.logo_url
  ) THEN RAISE EXCEPTION 'brand snapshot not sourced from canonical catalogue'; END IF;

  BEGIN
    INSERT INTO public.festival_edition_sponsor_assignments(
      festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
      logo_url_snapshot,category_snapshot,region_snapshot
    ) VALUES(v_edition,v_brands[2],'main','x','x','x','x');
    RAISE EXCEPTION 'accepted a second main sponsor';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.festival_edition_sponsor_assignments(
      festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
      logo_url_snapshot,category_snapshot,region_snapshot
    ) VALUES(v_edition,v_brands[1],'supporting','x','x','x','x');
    RAISE EXCEPTION 'accepted a duplicate active canonical brand';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  FOR v_count IN 2..5 LOOP
    INSERT INTO public.festival_edition_sponsor_assignments(
      festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
      logo_url_snapshot,category_snapshot,region_snapshot
    ) VALUES(v_edition,v_brands[v_count],'supporting','x','x','x','x');
  END LOOP;
  BEGIN
    INSERT INTO public.festival_edition_sponsor_assignments(
      festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
      logo_url_snapshot,category_snapshot,region_snapshot
    ) VALUES(v_edition,v_brands[6],'supporting','x','x','x','x');
    RAISE EXCEPTION 'accepted a fifth supporting sponsor';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.festival_edition_sponsor_assignments
    SET brand_name_snapshot = 'tampered' WHERE id=v_main;
    RAISE EXCEPTION 'identity snapshot was mutable';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.festival_edition_sponsor_assignments(
      festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
      logo_url_snapshot,category_snapshot,region_snapshot
    ) VALUES(v_completed,v_brands[7],'main','x','x','x','x');
    RAISE EXCEPTION 'completed edition accepted sponsor assignment';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE public.festival_edition_sponsor_assignments
  SET status='cancelled' WHERE id=v_main;
  IF NOT EXISTS(SELECT 1 FROM public.festival_edition_sponsor_assignments
    WHERE id=v_main AND cancelled_at IS NOT NULL) THEN
    RAISE EXCEPTION 'cancellation did not receive an audit timestamp';
  END IF;

  -- A replacement can reuse the freed main slot; the old historical record remains.
  INSERT INTO public.festival_edition_sponsor_assignments(
    festival_edition_id,sponsorship_brand_id,role,brand_name_snapshot,
    logo_url_snapshot,category_snapshot,region_snapshot
  ) VALUES(v_edition,v_brands[7],'main','x','x','x','x');
END;
$test$;
ROLLBACK;
