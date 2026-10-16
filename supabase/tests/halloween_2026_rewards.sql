-- Run against a migrated, isolated test database. All fixture changes
-- happen inside this transaction and are rolled back.
BEGIN;
DO $$
DECLARE
  v_start timestamptz := ('2026-10-24 00:00 Europe/London')::timestamptz;
  v_end timestamptz := ('2026-11-02 00:00 Europe/London')::timestamptz;
  v_five integer;
  v_ten integer;
  v_fifteen integer;
  v_hat uuid;
  v_gig uuid;
  v_profile uuid;
  v_saved integer;
BEGIN
  -- DST transition: October 24 starts in BST, November 2 starts in GMT.
  IF v_start <> '2026-10-23 23:00:00+00'::timestamptz
     OR v_end <> '2026-11-02 00:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Wrong UK real-world Halloween bounds';
  END IF;

  -- Exhaustive bucket distribution; no random() dependence or re-rolls.
  SELECT count(*) FILTER (WHERE public.halloween_2026_bonus_for_roll(n)=5),
         count(*) FILTER (WHERE public.halloween_2026_bonus_for_roll(n)=10),
         count(*) FILTER (WHERE public.halloween_2026_bonus_for_roll(n)=15)
    INTO v_five,v_ten,v_fifteen FROM generate_series(0,99) n;
  IF v_five <> 50 OR v_ten <> 35 OR v_fifteen <> 15 THEN
    RAISE EXCEPTION 'Halloween boost buckets incorrect: % % %',v_five,v_ten,v_fifteen;
  END IF;
  IF public.halloween_2026_bonus_for_roll(-1)<>0
    OR public.halloween_2026_bonus_for_roll(100)<>0 THEN
    RAISE EXCEPTION 'Out-of-range roll earned a bonus';
  END IF;

  -- The rules are active only behind both independently controlled gates.
  IF NOT EXISTS(SELECT 1 FROM public.system_settings
     WHERE key='halloween_2026_event'
       AND value->>'enabled'='false'
       AND value->>'rewards_live'='false') THEN
    RAISE EXCEPTION 'Seasonal announcement/reward gates did not default to off';
  END IF;

  SELECT id INTO v_hat FROM public.avatar_clothing_items
    WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat';
  IF v_hat IS NULL THEN RAISE EXCEPTION 'Pumpkin wearable catalogue missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.avatar_clothing_items
     WHERE id=v_hat AND (wearable_slot<>'headwear' OR price<>0
       OR render_config->>'headwearStyle'<>'pumpkin')) THEN
    RAISE EXCEPTION 'Pumpkin wardrobe metadata incorrect';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.achievements
    WHERE slug='pumpkin-headliner-2026') THEN
    RAISE EXCEPTION 'Permanent Halloween achievement not seeded';
  END IF;

  -- The only reward modification API runs as service role; the browser
  -- cannot query bonus data or insert claims by bypassing the UI.
  IF has_function_privilege('anon','public.get_halloween_2026_gig_bonus(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.get_halloween_2026_gig_bonus(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Halloween gig bonus resolver exposed to the browser';
  END IF;
  IF has_table_privilege('authenticated','public.halloween_2026_first_rewards','INSERT')
     OR has_table_privilege('anon','public.halloween_2026_gig_outfits','UPDATE') THEN
    RAISE EXCEPTION 'Halloween private reward tables exposed';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c
     WHERE c.oid='public.halloween_2026_first_rewards'::regclass)
     OR NOT (SELECT c.relrowsecurity FROM pg_class c
     WHERE c.oid='public.halloween_2026_gig_outfits'::regclass) THEN
    RAISE EXCEPTION 'Halloween RLS unexpectedly disabled';
  END IF;

  -- Optional in-db snapshot race regression, when the test database has a
  -- seeded gig and character. The transaction never modifies live records.
  SELECT id INTO v_gig FROM public.gigs ORDER BY created_at LIMIT 1;
  SELECT id INTO v_profile FROM public.profiles WHERE user_id IS NOT NULL ORDER BY id LIMIT 1;
  IF v_gig IS NOT NULL AND v_profile IS NOT NULL THEN
    INSERT INTO public.halloween_2026_gig_outfits
      (gig_id,profile_id,was_equipped,performance_pct)
    VALUES(v_gig,v_profile,true,10)
    ON CONFLICT (gig_id,profile_id) DO NOTHING;
    SELECT performance_pct INTO v_saved
      FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_gig AND profile_id=v_profile;
    INSERT INTO public.halloween_2026_gig_outfits
      (gig_id,profile_id,was_equipped,performance_pct)
    VALUES(v_gig,v_profile,false,0)
    ON CONFLICT (gig_id,profile_id) DO NOTHING;
    IF (SELECT performance_pct FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_gig AND profile_id=v_profile) <> v_saved THEN
      RAISE EXCEPTION 'Snapshot was re-rolled or overwritten';
    END IF;
  END IF;
END;
$$;
ROLLBACK;
